import { Program } from '..'
import { BufferOptions, TypedArray, ValueOf, WrapWithAtom } from '../types'
import { dataTypeToSize } from '../utils'
import { Token } from './token'

/**********************************************************************************/
/*                                                                                */
/*                                      types                                     */
/*                                                                                */
/**********************************************************************************/

export type AttributeOptions = BufferOptions & {
  stride: number
  offset: number
  instanced: number | boolean
  instanceCount?: number
}

type AttributeFactory = <T extends TypedArray>(
  value: T | WrapWithAtom<T>,
  options?: AttributeOptions
) => Attribute<T>

// prettier-ignore
export type Attributes = {
  float: AttributeFactory
  int:   AttributeFactory
  vec2:  AttributeFactory
  vec3:  AttributeFactory
  vec4:  AttributeFactory
  ivec2: AttributeFactory
  ivec3: AttributeFactory
  ivec4: AttributeFactory
  mat2:  AttributeFactory
  mat3:  AttributeFactory
  mat4:  AttributeFactory
}

export type AttributeParameters = Parameters<Attributes[keyof Attributes]>
export type AttributeReturnType = ReturnType<ValueOf<Attributes>>

/**********************************************************************************/
/*                                                                                */
/*                                    Attribute                                   */
/*                                                                                */
/**********************************************************************************/

/**
 * Represents a WebGL attribute that extends the functionality of a Token with WebGL-specific behaviors.
 * This class allows for the binding and updating of WebGL program attributes.
 *
 * @template T - The type of the data stored in the attribute, constrained to BufferSource.
 * @extends Token<T>
 */
export class Attribute<T extends BufferSource> extends Token<T> {
  /**
   * Internal methods for WebGL attribute operations, including binding, updating, and rendering requests.
   * @private
   */

  __: {
    // bind: (program: Program, location: number) => Attribute<T>
    getLocation: (program: Program, name: string) => number
    // notify: () => void
    // requestRender: () => void
    template: (name: string) => string | undefined
    update: (program: Program, location: number) => void
  }

  /**
   * Creates an instance of Attribute.
   *
   * @param {T} value - The initial value of the attribute, must be a BufferSource.
   * @param {keyof Attributes} type - The data type of the attribute which determines how it will be used and interpreted in WebGL.
   */
  constructor(value: T, type: keyof Attributes) {
    super(value)
    const size = dataTypeToSize(type)
    this.__ = {
      update: ({ virtualProgram, gl }, location) => {
        const buffer = virtualProgram.registerBuffer(this.get(), {
          usage: 'STATIC_DRAW',
          target: 'ARRAY_BUFFER',
        })

        if (buffer.dirty || !virtualProgram.checkAttribute(location as number, this.get)) {
          gl.ctx.bindBuffer(gl.ctx.ARRAY_BUFFER, buffer.value)
          if (buffer.dirty) {
            gl.ctx.bufferData(gl.ctx.ARRAY_BUFFER, this.get(), gl.ctx.STATIC_DRAW)
            buffer.dirty = false
          }
        } else {
          return
        }
        virtualProgram.setAttribute(location as number, this.get())

        gl.ctx.vertexAttribPointer(location as number, size, gl.ctx.FLOAT, false, 0, 0)
        gl.ctx.enableVertexAttribArray(location as number)
      },
      template: (name) => `in ${type} ${name};`,
      getLocation: (program, name) => program.gl.ctx.getAttribLocation(program.glProgram, name)!,
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                attribute-proxy                                 */
/*                                                                                */
/**********************************************************************************/

/**
 * template-helper to inject attribute into `glsl`
 * @example
 * ```ts
 * const vertices = attribute.vec2(new Float32Array([...]))
 *
 * glsl`
 *  vec2 vertices = ${vertices};
 * `
 * vertices.set(vertex => {
 *    vertex[0] = 0
 *    return vertex
 * })
 * */
export const attribute = new Proxy({} as Attributes, {
  get(_, type: keyof Attributes) {
    return (...[value, _options]: AttributeParameters) => new Attribute(value, type)
  },
})
