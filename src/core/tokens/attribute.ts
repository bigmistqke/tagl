import { Token } from 'typescript'
import { $TYPE } from '..'
import { atom, Atom } from '../atom'
import { BufferOptions, ValueOf } from '../types'
import { dataTypeToSize, isAtom } from '../utils'
import { Variable } from './types'

export type AttributeOptions = BufferOptions & {
  stride: number
  offset: number
  instanced: number | boolean
  instanceCount?: number
}

export type AttributeProxy = {
  float: Variable<Float32Array, AttributeOptions>
  int: Variable<Float32Array, AttributeOptions>
  vec2: Variable<Float32Array, AttributeOptions>
  vec3: Variable<Float32Array, AttributeOptions>
  vec4: Variable<Float32Array, AttributeOptions>
  ivec2: Variable<Float32Array, AttributeOptions>
  ivec3: Variable<Float32Array, AttributeOptions>
  ivec4: Variable<Float32Array, AttributeOptions>
  mat2: Variable<Float32Array, AttributeOptions>
  mat3: Variable<Float32Array, AttributeOptions>
  mat4: Variable<Float32Array, AttributeOptions>
}
export type AttributeParameters = Parameters<AttributeProxy[keyof AttributeProxy]>
export type AttributeReturnType = ReturnType<ValueOf<AttributeProxy>>

/**
 * template-helper to inject attribute into `glsl`
 * @example
 * ```ts
 * // dynamic
 * const [vertices] = createSignal
 *  new Float32Array([
      -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
    ])
 * )
 * glsl`
 *  vec2 vertices = ${attribute.vec2(vertices)};
 * `
 * 
 * // static
 * glsl`
 *  vec2 vertices = ${attribute.vec2(new Float32Array([
      -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
    ]))};
 * `
 * ```
 * */
export const attribute = new Proxy({} as AttributeProxy, {
  get(_, type: keyof AttributeProxy) {
    return (...[value, _options]: AttributeParameters): Token => {
      const size = dataTypeToSize(type)

      const _atom = isAtom(value) ? value : atom<any>(value)
      const get = () => _atom.get.bind(_atom)()

      const token: Token<Exclude<typeof value, Atom>> = {
        [$TYPE]: 'token',
        get: _atom.get.bind(_atom),
        set: _atom.set.bind(_atom),
        subscribe: _atom.subscribe.bind(_atom),
        __: {
          bind: (program, location) => {
            _atom.__.bind(program, () => {
              program.virtualProgram.dirtyAttribute(location as number)
            })
            return token
          },
          update: ({ virtualProgram, gl }, location) => {
            const buffer = virtualProgram.registerBuffer(get(), {
              usage: 'STATIC_DRAW',
              target: 'ARRAY_BUFFER',
            })

            if (buffer.dirty || !virtualProgram.checkAttribute(location as number, get())) {
              gl.ctx.bindBuffer(gl.ctx.ARRAY_BUFFER, buffer.value)
              if (buffer.dirty) {
                gl.ctx.bufferData(gl.ctx.ARRAY_BUFFER, get(), gl.ctx.STATIC_DRAW)
                buffer.dirty = false
              }
            } else {
              return
            }
            virtualProgram.setAttribute(location as number, get())

            gl.ctx.vertexAttribPointer(location as number, size, gl.ctx.FLOAT, false, 0, 0)
            gl.ctx.enableVertexAttribArray(location as number)
          },
          template: (name) => `in ${type} ${name};`,
          getLocation: (program, name) => program.gl.ctx.getAttribLocation(program.glProgram, name)!,
        },
      }
      return token
    }
  },
})
