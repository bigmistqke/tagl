import { Program } from 'typescript'
import { $TYPE } from '..'
import { Atom, atom } from '../atom'
import { Accessor, Setter } from '../types'
import { isAtom } from '../utils'

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

export type BufferToken<T = Float32Array> = {
  [$TYPE]: 'buffer'
  set: Setter<T>
  get: Accessor<T>
  subscribe: (callback: (value: T) => void) => () => void
  __: {
    bind: (program: Program) => BufferToken<T>
    update: (program: Program) => BufferToken<T>
  }
}

const cache = new WeakMap<Program, Map<string, WebGLBuffer>>()

export const buffer = <T extends BufferSource>(value: T | Atom<T>, _options?: BufferOptions): BufferToken<T> => {
  const options: BufferOptions = {
    target: 'ARRAY_BUFFER',
    usage: 'STATIC_DRAW',
    ..._options,
  }

  const _atom = isAtom<T>(value) ? value : atom(value)

  const token: BufferToken<T> = {
    [$TYPE]: 'buffer',
    get: _atom.get.bind(_atom),
    set: _atom.set.bind(_atom),
    subscribe: _atom.subscribe.bind(_atom),
    __: {
      bind: (program) => {
        _atom.__.bind(program)
        return token
      },
      update: (program) => {
        const buffer = program.virtualProgram.registerBuffer(_atom.get(), options)

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
          program.gl.ctx.bufferData(program.gl.ctx[options.target], _atom.get(), program.gl.ctx[options.usage])
          buffer.dirty = false
        }

        //return token
      },
    },
  }

  return token
}
