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

export type GL = {
  autosize: () => void
  onResize: (callback: (canvas: HTMLCanvasElement) => void) => () => void
  ctx: WebGL2RenderingContext
  setStack(...programs: (Program | DequeMap<any, Program>)[]): void
  isPending: boolean
  requestRender: () => void
  createProgram: (options: ProgramOptions) => Program
  onLoop: (callback: (now: number) => void) => () => void
}

export const createGL = (canvas: HTMLCanvasElement): GL => {
  const ctx = canvas.getContext('webgl2')

  let stack: (Program | DequeMap<any, Program>)[] = []

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

  const render = () => {
    for (let i = 0; i < stack.length; i++) {
      const element = stack[i]
      if (element instanceof DequeMap) {
        element.forEach((program) => program.value.draw())
      } else {
        element!.draw()
      }
    }
    gl.isPending = false
  }

  const onResizeCallbacks = new Set<(canvas: HTMLCanvasElement) => void>()

  const gl: GL = {
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
    setStack(...programs: (Program | DequeMap<any, Program>)[]) {
      stack = programs
    },
    isPending: false,
    requestRender: () => {
      gl.isPending = true
      if (looping) return
      requestAnimationFrame(render)
    },
    createProgram: ({ vertex, fragment, count, indices }: ProgramOptions) => {
      const gl_record = glRegistry.register(gl.ctx)

      const { program, locations } = ProgramRegistry.getInstance(gl).register(vertex, fragment).value as ProgramRecord

      const virtualProgram = getVirtualProgram(program)

      gl.ctx.useProgram(program)

      const config = {
        gl,
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

      vertex.initialize(vertexConfig)
      fragment.initialize(fragmentConfig)

      const indicesBuffer = indices
        ? buffer(new Uint16Array(indices), {
            target: 'ELEMENT_ARRAY_BUFFER',
            usage: 'STATIC_DRAW',
          }).initialize(config)
        : undefined

      const visible = true

      return {
        draw: () => {
          if (!visible) return
          if (gl_record.value.program !== program) {
            gl.ctx.useProgram(program)
            gl_record.value.program = program
          }
          indicesBuffer?.update(config)

          vertex.update(vertexConfig)
          fragment.update(fragmentConfig)
          if (count) {
            gl.ctx.drawArrays(gl.ctx.TRIANGLES, 0, count)
          } else if (indices && indicesBuffer) {
            gl.ctx.drawElements(gl.ctx.TRIANGLES, indices.length, gl.ctx.UNSIGNED_SHORT, 0)
          }
        },
        program,
        visible,
      }
    },
    onLoop: (callback: (now: number) => void) => {
      onLoops.push(callback)

      if (onLoops.length === 1) {
        looping = true
        requestAnimationFrame(loop)
      }
      return () => {
        // onLoops.splice(onLoops.indexOf(callback), -1)
      }
    },
  }

  return gl
}
