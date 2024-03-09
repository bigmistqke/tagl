import { DequeMap } from './data-structures/deque-map'
import { glsl } from './glsl'
import { buffer } from './tokens'
import { ProgramRegistry, glRegistry, type ProgramRecord } from './virtualization/registries'
import { getVirtualProgram } from './virtualization/virtual-program'

export type Program = {
  draw: () => void
  program: WebGLProgram
}

type ProgramOptions = {
  vertex: ReturnType<typeof glsl>
  fragment: ReturnType<typeof glsl>
} & ({ count: number; indices?: never } | { indices: number[]; count?: never })

export class GL {
  ctx: WebGL2RenderingContext
  isPending = false
  looping = false
  onLoops: ((now: number) => void)[] = [] //new Deque<(now: number) => void>()
  stack: (Program | DequeMap<any, Program>)[] = []

  constructor(public canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('webgl2')
    if (!ctx) throw 'gl is not defined'
    this.ctx = ctx
  }

  private loop(now: number) {
    if (this.onLoops.length === 0) {
      this.looping = false
      return
    }
    requestAnimationFrame(this.loop.bind(this))
    for (let i = 0; i < this.onLoops.length; i++) {
      const node = this.onLoops[i]
      if (node) {
        node(now)
      }
    }
    if (this.isPending) this.render()
  }

  private render() {
    for (let i = 0; i < this.stack.length; i++) {
      const element = this.stack[i]
      if (element instanceof DequeMap) {
        element.forEach((program) => program.value.draw())
      } else {
        element!.draw()
      }
    }
    this.isPending = false
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
    })
    resizeObserver.observe(this.canvas as HTMLCanvasElement)
  }
  setStack(...programs: (Program | DequeMap<any, Program>)[]) {
    this.stack = programs
  }
  requestRender() {
    this.isPending = true
    if (this.looping) return
    requestAnimationFrame(this.render.bind(this))
  }
  createProgram({ vertex, fragment, count, indices }: ProgramOptions) {
    const gl_record = glRegistry.register(this.ctx)

    const { program, locations } = ProgramRegistry.getInstance(this).register(vertex, fragment).value as ProgramRecord

    const virtualProgram = getVirtualProgram(program)

    this.ctx.useProgram(program)

    const config = {
      gl: this,
      virtualProgram,
    }
    const vertexConfig = {
      ...config,
      locations: locations.vertex,
    }
    const fragmentConfig = {
      ...config,
      locations: locations.fragment,
    }

    vertex.bind(vertexConfig)
    fragment.bind(fragmentConfig)

    const indicesBuffer = indices
      ? buffer(new Uint16Array(indices), {
          target: 'ELEMENT_ARRAY_BUFFER',
          usage: 'STATIC_DRAW',
        }).bind(config)
      : undefined

    const visible = true

    return {
      draw: () => {
        if (!visible) return
        if (gl_record.value.program !== program) {
          this.ctx.useProgram(program)
          gl_record.value.program = program
        }
        indicesBuffer?.update(config)

        vertex.update(vertexConfig)
        fragment.update(fragmentConfig)
        if (count) {
          this.ctx.drawArrays(this.ctx.TRIANGLES, 0, count)
        } else if (indices && indicesBuffer) {
          console.log('render')
          this.ctx.drawElements(this.ctx.TRIANGLES, indices.length, this.ctx.UNSIGNED_SHORT, 0)
        }
      },
      program,
      visible,
    }
  }
  onLoop(callback: (now: number) => void) {
    this.onLoops.push(callback)

    if (this.onLoops.length === 1) {
      this.looping = true
      requestAnimationFrame(this.loop.bind(this))
    }
    return () => {
      // onLoops.splice(onLoops.indexOf(callback), -1)
    }
  }
}
