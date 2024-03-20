import { mat2, mat3, mat4, vec2, vec3, vec4 } from 'gl-matrix'
import { Atom } from '../atom'
import { Program } from '../gl'
import { DataType, Format, InternalFormat, Mat2, Mat3, Mat4, TypedArray, ValueOf, Vec2, Vec3, Vec4 } from '../types'
import { uniformDataTypeToFunctionName } from '../utils'
import { Token } from './token'

/**********************************************************************************/
/*                                                                                */
/*                                      types                                     */
/*                                                                                */
/**********************************************************************************/

export type TextureOptions = {
  dataType: DataType
  format: Format
  height: number
  internalFormat: InternalFormat
  width: number
}

export type UniformParameters = Parameters<Uniforms[keyof Uniforms]>
export type UniformReturnType = ReturnType<ValueOf<Uniforms>>
export type Sampler2DOptions = TextureOptions & {
  border: number
  magFilter: 'NEAREST' | 'LINEAR'
  minFilter: 'NEAREST' | 'LINEAR'
  wrapS: 'CLAMP_TO_EDGE'
  wrapT: 'CLAMP_TO_EDGE'
}

// prettier-ignore
export type Uniforms = {
  float:     (value: number | Atom<number>) => Uniform<number>
  int:       (value: number | Atom<number>) => Uniform<number>
  bool:      (value: boolean | Atom<boolean>) => Uniform<boolean>
  vec2:      (value: Vec2 | Atom<Vec2>) => Uniform<Vec2>
  vec3:      (value: Vec3 | Atom<Vec3>) => Uniform<Vec3>
  vec4:      (value: Vec4 | Atom<Vec4>) => Uniform<Vec4>
  ivec2:     (value: Vec2 | Atom<Vec2>) => Uniform<Vec2>
  ivec3:     (value: Vec3 | Atom<Vec3>) => Uniform<Vec3>
  ivec4:     (value: Vec4 | Atom<Vec4>) => Uniform<Vec4>
  mat2:      (value: Mat2 | Atom<Mat2>) => Uniform<Mat2>
  mat3:      (value: Mat3 | Atom<Mat3>) => Uniform<Mat3>
  mat4:      (value: Mat4 | Atom<Mat4>) => Uniform<Mat4>
  sampler2D: (
    value: Float32Array | HTMLImageElement | Atom<Float32Array> | Atom<HTMLImageElement>
  ) => Uniform<Float32Array | HTMLImageElement>
  isampler2D: (
    value: Float32Array | HTMLImageElement | Atom<Float32Array> | Atom<HTMLImageElement>
  ) => Uniform<Float32Array | HTMLImageElement>
  samplerCube: (
    value: Float32Array | HTMLImageElement | Atom<Float32Array> | Atom<HTMLImageElement>
  ) => Uniform<Float32Array | HTMLImageElement>
}

/**********************************************************************************/
/*                                                                                */
/*                                     Uniform                                    */
/*                                                                                */
/**********************************************************************************/

export class Uniform<
  T extends number | boolean | TypedArray | vec2 | vec3 | vec4 | mat2 | mat3 | mat4 | HTMLImageElement
> extends Token<T> {
  __: {
    bind: (program: Program, location: WebGLUniformLocation) => Uniform<T>
    getLocation: (program: Program, name: string) => WebGLUniformLocation
    notify: () => void
    requestRender: () => void
    template: (name: string) => string | undefined
    update: (program: Program, location: WebGLUniformLocation) => void
  }

  constructor(value: T, type: keyof Uniforms) {
    super(value)

    const functionName = uniformDataTypeToFunctionName(type)

    this.__ = {
      requestRender: this.atom.__.requestRender,
      notify: this.atom.__.notify,
      bind: (program, location) => {
        const uniform = program.virtualProgram.registerUniform(location, this.get)
        this.atom.__.bind(program, () => {
          if (uniform.dirty) return false
          uniform.dirty = true
        })
        return this
      },
      template: (name: string) => `uniform ${type} ${name};`,
      getLocation: (program, name) => program.gl.ctx.getUniformLocation(program.glProgram, name)!,
      update: (program, location) => {
        const uniform = program.virtualProgram.registerUniform(location, this.get)

        if (uniform.value === this.get() && !uniform.dirty) {
          return
        }

        uniform.dirty = false
        uniform.value = this.get()

        if (type.includes('mat')) {
          // @ts-expect-error
          program.gl.ctx[functionName](location, false, uniform.value)
        } else {
          // @ts-expect-error
          program.gl.ctx[functionName](location, uniform.value)
        }
      },
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                  uniform-proxy                                 */
/*                                                                                */
/**********************************************************************************/

/**
 * template-helper to inject attribute into `glsl`
 * @example
 * ```ts
 * const matrix = uniform.mat4(new Float32Array([...]))
 *
 * glsl`
 *  mat4 matrix = ${matrix};
 * `
 * matrix.set(matrix => {
 *    matrix[0] = 0
 *    return matrix
 * })
 * */
export const uniform = new Proxy({} as Uniforms, {
  get(target, type: keyof Uniforms) {
    return (...[value, options]: UniformParameters) => new Uniform(value, type)
  },
})
