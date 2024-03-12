import { DequeMap } from './data-structures/deque-map'
import { glsl } from './glsl'
import { Atom, BufferToken, buffer, isAtom, isBufferToken } from './tokens'
import { GLLocation } from './types'
import { ProgramRegistry, glRegistry, type ProgramRecord } from './virtualization/registries'
import { VirtualProgram, getVirtualProgram } from './virtualization/virtual-program'

export const createGL = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('webgl2')

  let stack: (Program | Program[] | DequeMap<any, Program>)[] = []

  if (!ctx) throw 'could not get context webgl2'

  const onLoops: ((now: number) => void)[] = [] //new Deque<(now: number) => void>()
  let looping = false

  const loop = (now: number) => {
    if (onLoops.length === 0) {
      looping = false
      return
    }
    requestAnimationFrame(loop)
    for (let i = 0; i < onLoops.length; i++) {
      const node = onLoops[i]
      if (node) {
        node(now)
      }
    }
    if (gl.isPending) render()
  }

  const render = async () => {
    gl.isPending = false
    gl.scheduledRender = false

    for (let i = 0; i < stack.length; i++) {
      const element = stack[i]
      if (element instanceof DequeMap) {
        element.forEach((program) => program.value.draw())
      } else if (Array.isArray(element)) {
        element.forEach((program) => program.draw())
      } else {
        element!.draw()
      }
    }

    if (gl.scheduledRender) render()
  }

  const onResizeCallbacks = new Set<(canvas: HTMLCanvasElement) => void>()

  const gl: {
    autosize: () => void
    onResize: (callback: (canvas: HTMLCanvasElement) => void) => () => void
    ctx: WebGL2RenderingContext
    setStack(...programs: (Program | Program[] | DequeMap<any, Program>)[]): void
    isPending: boolean
    scheduledRender: boolean
    requestRender: () => void
    createProgram: (options: Omit<ProgramOptions, 'gl'>) => Program
    onLoop: (callback: (now: number) => void) => () => void
  } = {
    autosize: () => {
      const resizeObserver = new ResizeObserver(() => {
        if (canvas instanceof OffscreenCanvas) {
          throw 'can not autosize OffscreenCanvas'
        }
        canvas.width = canvas.clientWidth
        canvas.height = canvas.clientHeight
        ctx.viewport(0, 0, canvas.width, canvas.height)
        gl.requestRender()
        onResizeCallbacks.forEach((callback) => callback(canvas))
      })
      resizeObserver.observe(canvas as HTMLCanvasElement)
    },
    onResize: (callback: (canvas: HTMLCanvasElement) => void) => {
      onResizeCallbacks.add(callback)
      return () => onResizeCallbacks.delete(callback)
    },
    ctx,
    setStack(...programs: (Program | Program[] | DequeMap<any, Program>)[]) {
      stack = programs
    },
    isPending: false,
    scheduledRender: false,
    requestRender: () => {
      if (gl.isPending) {
        gl.scheduledRender = true
        return
      }
      gl.isPending = true
      if (looping) return
      requestIdleCallback(render)
    },
    createProgram: (
      options: {
        vertex: ReturnType<typeof glsl>
        fragment: ReturnType<typeof glsl>
      } & (
        | { count: number | Atom<number>; indices?: never }
        | { indices: number[] | Atom<Uint16Array> | BufferToken<Uint16Array>; count?: never }
      )
    ) => new Program({ gl, ...options }),
    onLoop: (callback: (now: number) => void) => {
      onLoops.push(callback)

      if (onLoops.length === 1) {
        looping = true
        requestAnimationFrame(loop)
      }
      return () => {
        onLoops.splice(onLoops.indexOf(callback), -1)
      }
    },
  }

  return gl
}

export type GL = ReturnType<typeof createGL>

type Config = {
  gl: GL
  virtualProgram: VirtualProgram
  program: Program
}

type ProgramOptions = {
  gl: GL
  vertex: ReturnType<typeof glsl>
  fragment: ReturnType<typeof glsl>
} & (
  | { count: number | Atom<number>; indices?: never }
  | { indices: number[] | Atom<Uint16Array> | BufferToken<Uint16Array>; count?: never }
)

class Program {
  visible: boolean
  glProgram: WebGLProgram

  private _config: Config
  private _fragmentConfig: Config & { locations: GLLocation[] }
  private _glRecord: { value: { program: WebGLProgram | undefined }; count: number; dirty: boolean }
  private _indicesBuffer: BufferToken<Uint16Array> | undefined
  private _onBeforeDrawHandlers: (() => void)[]
  private _options: ProgramOptions
  private _vertexConfig: Config & { locations: GLLocation[] }

  constructor(options: ProgramOptions) {
    this._options = options
    this._glRecord = glRegistry.register(options.gl.ctx)

    const { glProgram, locations } = ProgramRegistry.getInstance(options.gl).register(options.vertex, options.fragment)
      .value as ProgramRecord

    const virtualProgram = getVirtualProgram(glProgram)

    this.glProgram = glProgram
    this.visible = true
    this._onBeforeDrawHandlers = []

    this._config = {
      gl: options.gl,
      virtualProgram,
      program: this,
    }
    this._vertexConfig = {
      ...this._config,
      locations: locations.vertex,
    }
    this._fragmentConfig = {
      ...this._config,
      locations: locations.fragment,
    }

    options.gl.ctx.useProgram(glProgram)
    options.vertex.bind(this._vertexConfig)
    options.fragment.bind(this._fragmentConfig)

    if (options.indices) {
      this._indicesBuffer = (
        isBufferToken(options.indices)
          ? options.indices
          : buffer(isAtom(options.indices) ? options.indices : new Uint16Array(options.indices), {
              target: 'ELEMENT_ARRAY_BUFFER',
              usage: 'STATIC_DRAW',
            })
      ).__.bind(this._config)
    } else {
      if (typeof options.count === 'object') {
        options.count.__.bind(this._config)
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
      this._options.gl.ctx.useProgram(this.glProgram)
      this._glRecord.value.program = this.glProgram
    }

    this._onBeforeDrawHandlers.forEach((handler) => handler())
    this._options.vertex.update(this._vertexConfig)
    this._options.fragment.update(this._fragmentConfig)

    if (this._options.indices) {
      this._indicesBuffer!.__.bind(this._config)
      this._indicesBuffer!.__.update(this._config)

      this._options.gl.ctx.drawElements(
        this._options.gl.ctx.TRIANGLES,
        this._indicesBuffer!.get().length,
        this._options.gl.ctx.UNSIGNED_SHORT,
        0
      )
    } else {
      this._options.gl.ctx.drawArrays(
        this._options.gl.ctx.TRIANGLES,
        0,
        typeof this._options.count === 'number' ? this._options.count : this._options.count.get()
      )
    }
  }
}
