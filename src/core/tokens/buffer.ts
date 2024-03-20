import { Program } from '..'
import { Atom } from '../atom'
import { Token } from './token'

/**********************************************************************************/
/*                                                                                */
/*                                      types                                     */
/*                                                                                */
/**********************************************************************************/

export type BufferUsage =
  | 'STATIC_DRAW'
  | 'DYNAMIC_DRAW'
  | 'STREAM_DRAW'
  | 'STATIC_READ'
  | 'DYNAMIC_READ'
  | 'STREAM_READ'
  | 'STATIC_COPY'
  | 'DYNAMIC_COPY'
  | 'STREAM_COPY'

export type BufferOptions = {
  name?: string
  target:
    | 'ARRAY_BUFFER'
    | 'ELEMENT_ARRAY_BUFFER'
    | 'COPY_READ_BUFFER'
    | 'COPY_WRITE_BUFFER'
    | 'TRANSFORM_FEEDBACK_BUFFER'
    | 'UNIFORM_BUFFER'
    | 'PIXEL_PACK_BUFFER'
    | 'PIXEL_UNPACK_BUFFER'
  usage: BufferUsage
}

/**********************************************************************************/
/*                                                                                */
/*                                     Buffer                                     */
/*                                                                                */
/**********************************************************************************/

export class Buffer<T extends BufferSource> extends Token<T> {
  __: {
    bind: (program: Program) => Buffer<T>
    update: (program: Program) => void
  }

  constructor(value: T | Atom<T>, options: BufferOptions) {
    super(value)
    this.__ = {
      bind: (program) => {
        this.atom.__.bind(program)
        return this
      },
      update: (program) => {
        const buffer = program.virtualProgram.registerBuffer(this.get(), options)

        if (!cache.has(program)) {
          cache.set(program, new Map())
        }
        const cached = cache.get(program)!

        if (cached.get(options.target) !== buffer.value) {
          // NOTE: maybe we can prevent having to do unnecessary binds here?
          program.gl.ctx.bindBuffer(program.gl.ctx[options.target], buffer.value)
          cached.set(options.target, buffer.value)
        }

        if (buffer.dirty) {
          program.gl.ctx.bufferData(program.gl.ctx[options.target], this.get(), program.gl.ctx[options.usage])
          buffer.dirty = false
        }
      },
    }
  }
}

const cache = new WeakMap<Program, Map<string, WebGLBuffer>>()

export const buffer = <T extends BufferSource>(value: T | Atom<T>, _options?: BufferOptions) => {
  return new Buffer(value, {
    target: 'ARRAY_BUFFER',
    usage: 'STATIC_DRAW',
    ..._options,
  })
}
