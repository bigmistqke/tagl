import { DequeMap } from './data-structures/deque-map'
import { ShaderToken, glsl } from './glsl'
import { Atom, BufferToken, atom, buffer, isAtom, isBufferToken } from './tokens'
import { GLLocation } from './types'
import { ProgramRegistry, glRegistry, type ProgramRecord } from './virtualization/registries'
import { VirtualProgram, getVirtualProgram } from './virtualization/virtual-program'

export const createGL = (canvas: HTMLCanvasElement) => {
  return new GL(canvas)
}

export class GL {
  ctx: WebGL2RenderingContext
  isPending = false
  stack = atom<(Program | Program[] | DequeMap<any, Program>)[]>([])
  private _scheduledRender = false
  private _onResizeCallbacks = new Set<(canvas: HTMLCanvasElement) => void>()
  private _onBeforeRenderCallbacks = new Set<() => void>()
  private _onLoops: ((now: number) => void)[] = []
  looping = false

  constructor(public canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('webgl2')
    if (!ctx) throw 'could not get context webgl2'
    this.ctx = ctx
    this.stack.subscribe(this.requestRender.bind(this))
  }

  onBeforeRender(callback: () => {}) {
    this._onBeforeRenderCallbacks.add(callback)
    return () => this._onBeforeRenderCallbacks.delete(callback)
  }
  onLoop(callback: (now: number) => void) {
    this._onLoops.push(callback)

    if (this._onLoops.length === 1) {
      this.looping = true
      requestAnimationFrame(this.loop.bind(this))
    }
    return () => {
      this._onLoops.splice(this._onLoops.indexOf(callback), -1)
    }
  }
  onResize(callback: (canvas: HTMLCanvasElement) => void) {
    this._onResizeCallbacks.add(callback)
    return () => this._onResizeCallbacks.delete(callback)
  }

  autosize() {
    const resizeObserver = new ResizeObserver(() => {
      if (this.canvas instanceof OffscreenCanvas) {
        throw 'can not autosize OffscreenCanvas'
      }
      this.canvas.width = this.canvas.clientWidth
      this.canvas.height = this.canvas.clientHeight
      this.ctx.viewport(0, 0, this.canvas.width, this.canvas.height)
      this.requestRender()
      this._onResizeCallbacks.forEach((callback) => callback(this.canvas))
    })
    resizeObserver.observe(this.canvas)
  }
  requestRender() {
    if (this.isPending) {
      this._scheduledRender = true
      return
    }
    this.isPending = true
    if (this.looping) return
    requestIdleCallback(this.render.bind(this))
  }
  createProgram(
    options: {
      vertex: ReturnType<typeof glsl>
      fragment: ReturnType<typeof glsl>
    } & (
      | { count: number | Atom<number>; indices?: never }
      | { indices: number[] | Atom<Uint16Array> | BufferToken<Uint16Array>; count?: never }
    )
  ) {
    return new Program({ gl: this, ...options })
  }

  private loop(now: number) {
    if (this._onLoops.length === 0) {
      this.looping = false
      return
    }
    requestAnimationFrame(this.loop.bind(this))
    for (let i = 0; i < this._onLoops.length; i++) {
      const node = this._onLoops[i]
      if (node) {
        node(now)
      }
    }
    if (this.isPending) this.render()
  }

  private async render() {
    this.isPending = false
    this._scheduledRender = false

    this._onBeforeRenderCallbacks.forEach((callback) => callback())

    for (let i = 0; i < this.stack.get().length; i++) {
      const element = this.stack.get()[i]
      if (element instanceof DequeMap) {
        element.forEach((program) => program.value.draw())
      } else if (Array.isArray(element)) {
        for (let i = 0; i < element.length; i++) {
          element[i]!.draw()
        }
      } else {
        element!.draw()
      }
    }

    if (this._scheduledRender) this.render()
  }
}

type ProgramOptions = {
  gl: GL
  vertex: ReturnType<typeof glsl>
  fragment: ReturnType<typeof glsl>
} & (
  | { count: number | Atom<number>; indices?: never }
  | { indices: number[] | Atom<Uint16Array> | BufferToken<Uint16Array>; count?: never }
)

export class Program {
  fragment: ShaderToken
  gl: GL
  glProgram: WebGLProgram
  locations: { vertex: GLLocation[]; fragment: GLLocation[] }
  vertex: ShaderToken
  virtualProgram: VirtualProgram
  visible: boolean

  private _glRecord: { value: { program: WebGLProgram | undefined }; dirty: boolean }
  private _indicesBuffer: BufferToken<Uint16Array> | undefined
  private _onBeforeDrawHandlers: (() => void)[]
  private _options: ProgramOptions

  constructor(options: ProgramOptions) {
    this.gl = options.gl
    this.vertex = options.vertex
    this.fragment = options.fragment

    this._options = options
    this._glRecord = glRegistry.register(options.gl.ctx)

    const { glProgram, locations } = ProgramRegistry.getInstance(options.gl).register(this).value as ProgramRecord

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
        isBufferToken(options.indices)
          ? options.indices
          : buffer(isAtom(options.indices) ? options.indices : new Uint16Array(options.indices), {
              target: 'ELEMENT_ARRAY_BUFFER',
              usage: 'STATIC_DRAW',
            })
      ).__.bind(this)
    } else {
      if (typeof options.count === 'object') {
        options.count.__.bind(this)
      }
    }
  }

  onBeforeDraw(callback: () => void) {
    this._onBeforeDrawHandlers.push(callback)
    return () => {
      console.error('TODO')
    }
  }

  draw() {
    if (!this.visible) return
    if (this._glRecord.value.program !== this.glProgram) {
      this.gl.ctx.useProgram(this.glProgram)
      this._glRecord.value.program = this.glProgram
    }

    this._onBeforeDrawHandlers.forEach((handler) => handler())
    this.vertex.update(this, this.locations.vertex)
    this.fragment.update(this, this.locations.fragment)

    if (this._options.indices) {
      this._indicesBuffer!.__.update(this)

      this.gl.ctx.drawElements(this.gl.ctx.TRIANGLES, this._indicesBuffer!.get().length, this.gl.ctx.UNSIGNED_SHORT, 0)
    } else {
      this.gl.ctx.drawArrays(
        this.gl.ctx.TRIANGLES,
        0,
        typeof this._options.count === 'number' ? this._options.count : this._options.count.get()
      )
    }
  }
}
