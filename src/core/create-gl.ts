import { DequeMap } from './data-structures/deque-map'
import { glsl } from './glsl'
import { Atom, BufferToken, buffer, isAtom, isBufferToken } from './tokens'
import { ProgramRegistry, glRegistry, type ProgramRecord } from './virtualization/registries'
import { getVirtualProgram } from './virtualization/virtual-program'

export type Program = {
  draw: () => void
  program: WebGLProgram
}

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
    createProgram: (options: ProgramOptions) => Program
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
    createProgram: ({
      vertex,
      fragment,
      count,
      indices,
    }: {
      vertex: ReturnType<typeof glsl>
      fragment: ReturnType<typeof glsl>
    } & (
      | { count: number | Atom<number>; indices?: never }
      | { indices: number[] | Atom<Uint16Array> | BufferToken<Uint16Array>; count?: never }
    )) => {
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

      vertex.bind(vertexConfig)
      fragment.bind(fragmentConfig)

      const visible = true

      if (indices) {
        const indicesBuffer = (
          isBufferToken<Uint16Array>(indices)
            ? indices
            : buffer(isAtom<Uint16Array>(indices) ? indices : new Uint16Array(indices), {
                target: 'ELEMENT_ARRAY_BUFFER',
                usage: 'STATIC_DRAW',
              })
        ).__.bind(config)

        return {
          draw: () => {
            if (!visible) return
            if (gl_record.value.program !== program) {
              gl.ctx.useProgram(program)
              gl_record.value.program = program
            }

            vertex.update(vertexConfig)
            fragment.update(fragmentConfig)

            indicesBuffer.__.bind(config)
            indicesBuffer.__.update(config)

            gl.ctx.drawElements(gl.ctx.TRIANGLES, indicesBuffer.get().length, gl.ctx.UNSIGNED_SHORT, 0)
          },
          program,
          visible,
        }
      } else {
        if (typeof count === 'object') {
          count.__.bind(config)
        }
        return {
          draw: () => {
            if (!visible) return
            if (gl_record.value.program !== program) {
              gl.ctx.useProgram(program)
              gl_record.value.program = program
            }

            vertex.update(vertexConfig)
            fragment.update(fragmentConfig)

            gl.ctx.drawArrays(gl.ctx.TRIANGLES, 0, typeof count === 'number' ? count : count.get())
          },
          program,
          visible,
        }
      }
    },
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
