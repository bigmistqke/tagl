import { mat2, mat3, mat4, vec2, vec3, vec4 } from 'gl-matrix'
import { Registry } from './data-structures/registry'
import { Atom } from './reactive'
import { Token } from './tokens'
import { BufferRegistry, TextureRegistry } from './virtualization/registries'
import { type TextureSlots } from './virtualization/texture-slots'

/**********************************************************************************/
/*                                    UTILITIES                                   */
/**********************************************************************************/

export type Accessor<T> = () => T
export type ValueOf<T extends Record<string, any>> = T[keyof T]
export type IsUnion<T, B = T> = T extends T ? ([B] extends [T] ? false : true) : never
export type Check<T, U extends any[]> = T extends U[number] ? true : false
export type TupleOf<T = number, N = 1, Acc extends T[] = []> = Acc['length'] extends N
  ? Acc
  : TupleOf<T, N, [T, ...Acc]>
export type MatrixOf<T = number, N = 1> = TupleOf<TupleOf<T, N>, N>
export type ResolveTuple<T extends any> = {
  [P in keyof T]: T[P] extends (...args: any) => any ? ReturnType<T[P]> : T[P]
}
export type Resolve<T> = T extends (...args: any[]) => any ? ReturnType<T> : T

export type Mat2 = mat2
export type Mat3 = mat3
export type Mat4 = mat4
export type Vec2 = vec2
export type Vec3 = vec3
export type Vec4 = vec4

export type WrapWithAtom<T> = T extends any ? Atom<T> : never
export type AtomMappedReturnValues<Atoms extends (Atom<any> | Token<any>)[]> = {
  [TKey in keyof Atoms]: ReturnType<Atoms[TKey]['get']>
}

/**********************************************************************************/
/*                                       TOKENS                                   */
/**********************************************************************************/

export type UniformTypes = AttributeTypes | 'sampler2d'
export type AttributeTypes =
  | 'float'
  | 'int'
  | 'vec2'
  | 'ivec2'
  | 'vec3'
  | 'ivec3'
  | 'vec4'
  | 'ivec4'
  | 'mat2'
  | 'mat3'
  | 'mat4'

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

type SetterControl = {
  preventRender: () => void
  preventNotification: () => void
}
export type Setter<T = Float32Array> = (
  value: T | ((value: T, control: SetterControl) => T)
) => void
export type GLProgramMemory = {
  buffers: BufferRegistry
  attributes: Map<string, WebGLBuffer>
  uniforms: Registry<WebGLUniformLocation, Float32Array | number>
  textures: TextureRegistry
  textureslots: TextureSlots
}
export type GLProgram = {
  draw: () => void
  program: WebGLProgram
}

export type GLLocation = WebGLUniformLocation | number

/**********************************************************************************/
/*                                  WEBGL-FORMATS                                 */
/**********************************************************************************/

//prettier-ignore
type FormatWebGL = 
  /* General-purpose formats */
  | 'RGBA'                 // RGBA, 8 bits per channel
  | 'RGB'                  // RGB, 8 bits per channel
  | 'ALPHA'                // Alpha channel only, 8 bits
  | 'LUMINANCE'            // Single color channel, 8 bits
  | 'LUMINANCE_ALPHA'      // Luminance (grey) and alpha, 8 bits each
  /* Special-purpose formats */
  | 'DEPTH_COMPONENT'      // Depth component, typically 16 or 24 bits
  | 'DEPTH_STENCIL'; // Depth combined with stencil, 24 bits for depth, 8 for stencil
type FormatWebGL2 = 'RED' | 'RG' | 'RED_INTEGER' | 'RG_INTEGER' | 'RGB_INTEGER'
export type Format = FormatWebGL | FormatWebGL2

//prettier-ignore
type InternalFormatWebGL = 
  /* General-purpose formats */
  | 'RGBA'                 // RGBA, 8 bits per channel
  | 'RGB'                  // RGB, 8 bits per channel
  | 'ALPHA'                // Alpha channel only, 8 bits
  | 'LUMINANCE'            // Single color channel, 8 bits
  | 'LUMINANCE_ALPHA'      // Luminance (grey) and alpha, 8 bits each
  /* Depth and stencil formats */
  | 'DEPTH_COMPONENT'      // Depth component, typically 16 or 24 bits
  | 'DEPTH_STENCIL'; // Depth combined with stencil, 24 bits for depth, 8 for stencil
// Types for WebGL 2 internal formats with detailed annotations
//prettier-ignore
type InternalFormatWebGL2 =
  /* 8-bit single channel formats */
  | 'R8'             // Normalized unsigned byte red channel format
  | 'R8_SNORM'       // Normalized signed byte red channel format
  | 'R8UI'           // Unsigned integer red channel format
  | 'R8I'            // Signed integer red channel format
  /* 16-bit single channel formats */
  | 'R16UI'          // Unsigned integer 16-bit red channel format
  | 'R16I'           // Signed integer 16-bit red channel format
  | 'R16F'           // Floating point 16-bit red channel format
  /* 32-bit single channel formats */
  | 'R32UI'          // Unsigned integer 32-bit red channel format
  | 'R32I'           // Signed integer 32-bit red channel format
  | 'R32F'           // Floating point 32-bit red channel format
  /* 8-bit dual channel formats */
  | 'RG8'            // Normalized unsigned byte red and green channels format
  | 'RG8_SNORM'      // Normalized signed byte red and green channels format
  | 'RG8UI'          // Unsigned integer red and green channels format
  | 'RG8I'           // Signed integer red and green channels format
  /* 16-bit dual channel formats */
  | 'RG16UI'         // Unsigned integer 16-bit red and green channels format
  | 'RG16I'          // Signed integer 16-bit red and green channels format
  | 'RG16F'          // Floating point 16-bit red and green channels format
  /* 32-bit dual channel formats */
  | 'RG32UI'         // Unsigned integer 32-bit red and green channels format
  | 'RG32I'          // Signed integer 32-bit red and green channels format
  | 'RG32F'          // Floating point 32-bit red and green channels format
  /* 8-bit RGB formats */
  | 'RGB8'           // Normalized unsigned byte RGB format
  | 'SRGB8'          // sRGB color space format
  | 'RGB565'         // Compact RGB format (5 bits red, 6 bits green, 5 bits blue)
  /* High dynamic range and wide gamut formats */
  | 'R11F_G11F_B10F' // Packed floating-point format with shared exponent
  | 'RGB9_E5'        // High dynamic range RGB format with shared exponent
  /* 16-bit RGB formats */
  | 'RGB16F'         // Floating point 16-bit RGB format
  /* 32-bit RGB formats */
  | 'RGB32F'         // Floating point 32-bit RGB format
  /* 8-bit RGBA formats */
  | 'RGBA8'          // Normalized unsigned byte RGBA format
  | 'SRGB8_ALPHA8'   // sRGB color space format with alpha channel
  | 'RGB5_A1'        // Compact RGBA format (5 bits for RGB, 1 bit for alpha)
  | 'RGBA4'          // Compact RGBA format (4 bits per channel)
  /* 16-bit RGBA formats */
  | 'RGBA16F'        // Floating point 16-bit RGBA format
  /* 32-bit RGBA formats */
  | 'RGBA32F'        // Floating point 32-bit RGBA format
  /* Depth and stencil formats */
  | 'DEPTH_COMPONENT16'  // 16-bit depth component format
  | 'DEPTH_COMPONENT24'  // 24-bit depth component format
  | 'DEPTH_COMPONENT32F' // 32-bit floating point depth format
  | 'DEPTH24_STENCIL8'   // Combined 24-bit depth and 8-bit stencil format
  | 'DEPTH32F_STENCIL8'; // Combined 32-bit floating point depth and 8-bit stencil format
export type InternalFormat = InternalFormatWebGL | InternalFormatWebGL2
export type DataType =
  | 'UNSIGNED_BYTE'
  | 'BYTE'
  | 'UNSIGNED_SHORT'
  | 'SHORT'
  | 'UNSIGNED_INT'
  | 'INT'
  | 'FLOAT'
  | 'HALF_FLOAT'

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

export type RenderMode =
  | 'TRIANGLES'
  | 'LINES'
  | 'POINTS'
  | 'TRIANGLE_FAN'
  | 'TRIANGLE_STRIP'
  | 'LINE_STRIP'
  | 'LINE_LOOP'
