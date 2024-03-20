import { $TYPE } from '..'
import { atom } from '../atom'
import { DataType, Format, InternalFormat, Mat2, Mat3, Mat4, ValueOf, Vec2, Vec3, Vec4 } from '../types'
import { isAtom, uniformDataTypeToFunctionName } from '../utils'
import { Token, Variable } from './types'

export type TextureOptions = {
  dataType: DataType
  format: Format
  height: number
  internalFormat: InternalFormat
  width: number
}

export type UniformParameters = Parameters<UniformProxy[keyof UniformProxy]>
export type UniformReturnType = ReturnType<ValueOf<UniformProxy>>
export type Sampler2DOptions = TextureOptions & {
  border: number
  magFilter: 'NEAREST' | 'LINEAR'
  minFilter: 'NEAREST' | 'LINEAR'
  wrapS: 'CLAMP_TO_EDGE'
  wrapT: 'CLAMP_TO_EDGE'
}

export type UniformProxy = {
  float: Variable<number>
  int: Variable<number>
  bool: Variable<boolean>
  vec2: Variable<Vec2>
  vec3: Variable<Vec3>
  vec4: Variable<Vec4>
  ivec2: Variable<Vec2>
  ivec3: Variable<Vec3>
  ivec4: Variable<Vec4>
  mat2: Variable<Mat2>
  mat3: Variable<Mat3>
  mat4: Variable<Mat4>
  sampler2D: Variable<Float32Array | HTMLImageElement, Sampler2DOptions>
  isampler2D: Variable<Float32Array, Sampler2DOptions>
  samplerCube: Variable<Float32Array, Sampler2DOptions>
}

/**
 * Utility to inject uniform into `glsl`-templates.
 * @example
 *
 * ```ts
 * // dynamic
 * const [color] = createSignal([0, 1, 2])
 * glsl`
 *  vec3 color = ${uniform.vec3(color)};
 * `
 * // static
 * glsl`
 *  vec3 color = ${uniform.vec3([0, 1, 2])};
 * `
 * ```
 * */
export const uniform = new Proxy({} as UniformProxy, {
  get(target, type: string) {
    return (...[value, options]: UniformParameters) => {
      const functionName = uniformDataTypeToFunctionName(type)
      const _atom = isAtom(value) ? value : atom<any>(value)

      const get = () => _atom.get.bind(_atom)()

      const token: Token = {
        [$TYPE]: 'token',
        get: _atom.get.bind(_atom),
        set: _atom.set.bind(_atom),
        subscribe: _atom.subscribe.bind(_atom),
        onBeforeDraw: _atom.onBeforeDraw.bind(_atom),
        onBind: _atom.onBind.bind(_atom),
        __: {
          requestRender: _atom.__.requestRender.bind(_atom),
          notify: _atom.__.notify.bind(_atom),
          bind: (program, location) => {
            const uniform = program.virtualProgram.registerUniform(location, get)
            _atom.__.bind(program, () => {
              if (uniform.dirty) return false
              uniform.dirty = true
            })
            return token
          },
          template: (name: string) => `uniform ${type} ${name};`,
          getLocation: (program, name) => program.gl.ctx.getUniformLocation(program.glProgram, name)!,
          update: (program, location) => {
            const uniform = program.virtualProgram.registerUniform(location, get)

            if (uniform.value === get() && !uniform.dirty) {
              return
            }

            uniform.dirty = false
            uniform.value = get()

            if (type.includes('mat')) {
              // @ts-expect-error
              program.gl.ctx[functionName](location, false, uniform.value)
            } else {
              // @ts-expect-error
              program.gl.ctx[functionName](location, uniform.value)
            }
          },
        },
      }
      return token
    }
  },
})
