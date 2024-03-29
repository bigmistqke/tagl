import { mat2, mat3, mat4, vec2, vec3, vec4 } from 'gl-matrix'
import { Atom } from '../atom'
import { Program } from '../gl'
import {
  DataType,
  Format,
  InternalFormat,
  Mat2,
  Mat3,
  Mat4,
  TypedArray,
  ValueOf,
  Vec2,
  Vec3,
  Vec4,
  WrapWithAtom,
} from '../types'
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

type UniformFactory<T extends ValidUniformValues> = (value: T | Atom<T>) => Uniform<T>

// prettier-ignore
export type Uniforms = {
  float:       UniformFactory<number> 
  int:         UniformFactory<number> 
  bool:        UniformFactory<boolean> 
  vec2:        UniformFactory<Vec2> 
  vec3:        UniformFactory<Vec3> 
  vec4:        UniformFactory<Vec4> 
  ivec2:       UniformFactory<Vec2> 
  ivec3:       UniformFactory<Vec3> 
  ivec4:       UniformFactory<Vec4> 
  mat2:        UniformFactory<Mat2> 
  mat3:        UniformFactory<Mat3> 
  mat4:        UniformFactory<Mat4> 
  sampler2D:   UniformFactory<TypedArray | HTMLImageElement> 
  isampler2D:  UniformFactory<TypedArray | HTMLImageElement> 
  samplerCube: UniformFactory<TypedArray | HTMLImageElement> 
}

export type ValidUniformValues =
  | number
  | boolean
  | vec2
  | vec3
  | vec4
  | mat2
  | mat3
  | mat4
  | HTMLImageElement
  | TypedArray

export type ValidUniformAtoms = WrapWithAtom<ValidUniformValues>

/**********************************************************************************/
/*                                                                                */
/*                                     Uniform                                    */
/*                                                                                */
/**********************************************************************************/

export class Uniform<T extends ValidUniformValues | ValidUniformAtoms> extends Token<T> {
  __: {
    getLocation: (program: Program, name: string) => WebGLUniformLocation
    template: (name: string) => string | undefined
    update: (program: Program, location: WebGLUniformLocation) => void
  }

  constructor(value: T, type: keyof Uniforms) {
    super(value)

    const functionName = uniformDataTypeToFunctionName(type)

    this.__ = {
      template: (name: string) => `uniform ${type} ${name};`,
      getLocation: (program, name) => program.gl.ctx.getUniformLocation(program.glProgram, name)!,
      update: (program, location) => {
        const uniform = program.virtualProgram.registerUniform(location, this.get.bind(this))

        // if (uniform.value === this.get() && !uniform.dirty) {
        //   return
        // }

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
    return (...[value]: UniformParameters) => new Uniform(value, type)
  },
})
