import { Atom, atomize } from './atom'
import { DequeMap } from './data-structures/deque-map'
import { glsl, type ShaderToken } from './glsl'
import { Buffer, buffer } from './tokens'
import { Token } from './tokens/token'
import { GLLocation, RenderMode } from './types'
import { ProgramRegistry, glRegistry, type ProgramRecord } from './virtualization/registries'
import { VirtualProgram, getVirtualProgram } from './virtualization/virtual-program'

/**
 * Represents a WebGL2 rendering and management system.
 */
export class GL {
  ctx: WebGL2RenderingContext
  isPending = false
  stack = new Atom<(Program | Program[] | DequeMap<any, Program>)[]>([])
  looping = false

  private batching = false
  private _onResizeCallbacks: ((canvas: HTMLCanvasElement) => void)[] = []
  private _onBeforeRenderCallbacks: ((now: number) => void)[] = []
  private _onLoopCallbacks: ((now: number) => void)[] = []

  /**
   * @param {HTMLCanvasElement} canvas - The HTML canvas element to use for WebGL2 rendering.
   */
  constructor(public canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('webgl2')
    if (!ctx) throw 'could not get context webgl2'
    this.ctx = ctx
    this.stack.subscribe(this.requestRender.bind(this))
  }

  /**
   * Automatically adjusts the canvas size to match its display size and sets up resize observation.
   * Throws an error if called on an OffscreenCanvas.
   */
  autosize() {
    const resizeObserver = new ResizeObserver(() => {
      if (this.canvas instanceof OffscreenCanvas) {
        throw 'can not autosize OffscreenCanvas'
      }
      this.canvas.width = this.canvas.clientWidth
      this.canvas.height = this.canvas.clientHeight
      this.ctx.viewport(0, 0, this.canvas.width, this.canvas.height)
      this.requestRender()
      for (let i = 0; i < this._onResizeCallbacks.length; i++) {
        this._onResizeCallbacks[i]!(this.canvas)
      }
    })
    resizeObserver.observe(this.canvas)
  }

  /**
   * Requests rendering. If already pending, schedules another render.
   * Uses `requestIdleCallback` to defer rendering until the browser is idle.
   */
  requestRender() {
    if (this.isPending) {
      return
    }
    this.isPending = true
    if (this.looping || this.batching) return
    requestIdleCallback(this.render.bind(this))
  }

  batch(callback: () => void) {
    try {
      this.batching = true
      callback()
    } finally {
      this.batching = false
      if (this.isPending) {
        requestAnimationFrame(this.render.bind(this))
      }
    }
  }

  /**
   * Creates and returns a new Program instance.
   * @param {Object} options - Configuration options for the program.
   * @returns {Program} A new Program instance.
   */
  createProgram(
    options: {
      vertex: ReturnType<typeof glsl>
      fragment: ReturnType<typeof glsl>
      mode: Atom<RenderMode> | RenderMode
    } & (
      | { count: number | Atom<number>; indices?: never }
      | { indices: number[] | Atom<Uint16Array> | Buffer<Uint16Array>; count?: never }
    )
  ): Program {
    return new Program({ gl: this, ...options })
  }

  /**
   * Registers a callback to be called before rendering.
   * @param {Function} callback - The callback function to register.
   * @returns {Function} A function that, when called, will unregister the provided callback.
   */
  onBeforeRender(callback: (now: number) => void): Function {
    this._onBeforeRenderCallbacks.push(callback)
    return () => {
      this._onBeforeRenderCallbacks.splice(this._onBeforeRenderCallbacks.indexOf(callback), -1)
    }
  }

  /**
   * Registers a callback to be called at each animation frame if looping is enabled.
   * @param {Function} callback - The callback function to register, receiving the current timestamp.
   * @returns {Function} A function that, when called, will unregister the provided callback.
   */
  onLoop(callback: (now: number) => void): Function {
    this._onLoopCallbacks.push(callback)

    if (this._onLoopCallbacks.length === 1) {
      this.looping = true
      requestAnimationFrame(this.loop.bind(this))
    }
    return () => {
      this._onLoopCallbacks.splice(this._onLoopCallbacks.indexOf(callback), -1)
    }
  }

  /**
   * Registers a callback to be called when the canvas is resized.
   * @param {Function} callback - The callback function to register, receiving the canvas element.
   * @returns {Function} A function that, when called, will unregister the provided callback.
   */
  onResize(callback: (canvas: HTMLCanvasElement) => void): Function {
    this._onResizeCallbacks.push(callback)
    return () => {
      this._onResizeCallbacks.splice(this._onResizeCallbacks.indexOf(callback), -1)
    }
  }

  /**
   * The internal loop called by `requestAnimationFrame`, responsible for executing loop callbacks.
   * @private
   * @param {number} now - The current timestamp provided by `requestAnimationFrame`.
   */
  private loop(now: number) {
    if (this._onLoopCallbacks.length === 0) {
      this.looping = false
      return
    }
    requestAnimationFrame(this.loop.bind(this))
    for (let i = 0; i < this._onLoopCallbacks.length; i++) {
      const node = this._onLoopCallbacks[i]
      if (node) {
        node(now)
      }
    }
    if (this.isPending) this.render(now)
  }

  /**
   * Performs the actual rendering logic. Called directly or scheduled by `requestRender`.
   */
  render() {
    this.isPending = false

    this.ctx.enable(this.ctx.DEPTH_TEST)
    this.ctx.depthFunc(this.ctx.LEQUAL)
    this.ctx.depthRange(0.2, 10)
    this.ctx.clearDepth(1.0)

    for (let i = 0; i < this._onBeforeRenderCallbacks.length; i++) {
      this._onBeforeRenderCallbacks[i]!()
    }

    const stack = this.stack.get()

    for (let i = 0; i < stack.length; i++) {
      const element = stack[i]
      if (element instanceof DequeMap) {
        element.forEach((program) => program.value.render())
      } else if (Array.isArray(element)) {
        for (let i = 0; i < element.length; i++) {
          element[i]!.render()
        }
      } else {
        element!.render()
      }
    }
  }
}

type ProgramOptions = {
  gl: GL
  vertex: ReturnType<typeof glsl>
  fragment: ReturnType<typeof glsl>
  mode: Atom<RenderMode> | RenderMode
} & (
  | { count: number | Atom<number>; indices?: never }
  | { indices: number[] | Atom<Uint16Array> | Buffer<Uint16Array>; count?: never }
)

/**
 * Represents a shader program in WebGL, encapsulating both vertex and fragment shaders,
 * along with their respective locations and other configurations.
 */
export class Program {
  fragment: ShaderToken
  gl: GL
  glProgram: WebGLProgram
  locations: { vertex: GLLocation[]; fragment: GLLocation[] }
  vertex: ShaderToken
  virtualProgram: VirtualProgram
  visible: boolean
  mode: Atom<RenderMode>

  private _glRecord: { value: { program: WebGLProgram | undefined }; dirty: boolean }
  private _indicesBuffer: Buffer<Uint16Array> | undefined
  private _onBeforeDrawHandlers: (() => void)[]
  private _options: ProgramOptions

  /**
   * Creates an instance of Program with specified options.
   * @param {ProgramOptions} options - Configuration options for the program, including the GL context, vertex and fragment shaders, and optional draw parameters.
   */
  constructor(options: ProgramOptions) {
    this.gl = options.gl
    this.vertex = options.vertex
    this.fragment = options.fragment
    this.mode = atomize(options.mode || 'TRIANGLES')

    this._options = options
    this._glRecord = glRegistry.register(options.gl.ctx)

    const { glProgram, locations } = ProgramRegistry.getInstance(options.gl).register(this)
      .value as ProgramRecord

    this.glProgram = glProgram
    this.locations = locations
    this.virtualProgram = getVirtualProgram(glProgram)
    this.visible = true

    this._onBeforeDrawHandlers = []

    options.gl.ctx.useProgram(glProgram)
    options.vertex.bind(this, locations.vertex)
    options.fragment.bind(this, locations.fragment)

    if (options.indices) {
      this._indicesBuffer = (
        options.indices instanceof Token
          ? options.indices
          : buffer(
              options.indices instanceof Atom ? options.indices : new Uint16Array(options.indices),
              {
                target: 'ELEMENT_ARRAY_BUFFER',
                usage: 'STATIC_DRAW',
              }
            )
      ).__.bind(this)
    } else {
      if (typeof options.count === 'object') {
        options.count.__.bind(this)
      }
    }
  }

  /**
   * Registers a callback to be executed before each draw call.
   * @param {() => void} callback - The callback function to execute before drawing.
   * @returns {Function} A function that, when called, will unregister the provided callback.
   */
  onBeforeDraw(callback: () => void): Function {
    this._onBeforeDrawHandlers.push(callback)
    return () => {
      console.error('TODO')
    }
  }

  /**
   * Executes the rendering process for this program. It updates shader parameters and initiates the draw call.
   * Only performs operations if the program is marked as visible. It updates the WebGL context with the program's shaders
   * if they have changed since the last render. Executes all registered before draw handlers, updates the shaders' data,
   * and then performs either a `drawElements` or `drawArrays` operation based on the configuration.
   */
  render() {
    if (!this.visible) return
    if (this._glRecord.value.program !== this.glProgram) {
      this.gl.ctx.useProgram(this.glProgram)
      this._glRecord.value.program = this.glProgram
    }

    for (let i = 0; i < this._onBeforeDrawHandlers.length; i++) {
      this._onBeforeDrawHandlers[i]!()
    }

    this.vertex.update(this, this.locations.vertex)
    this.fragment.update(this, this.locations.fragment)

    if (this._options.indices) {
      this._indicesBuffer!.__.update(this)
      this.gl.ctx.drawElements(
        this.gl.ctx[this.mode.get()],
        this._indicesBuffer!.get().length,
        this.gl.ctx.UNSIGNED_SHORT,
        0
      )
    } else {
      this.gl.ctx.drawArrays(
        this.gl.ctx[this.mode.get()],
        0,
        typeof this._options.count === 'number' ? this._options.count : this._options.count.get()
      )
    }
  }
}
