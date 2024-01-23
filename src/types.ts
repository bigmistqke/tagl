import {
  BufferRegistry,
  TextureRegistry,
  UniformRegistry,
} from './virtualization/registries'
import { type TextureSlots } from './virtualization/texture-slots'
import { VirtualProgram } from './virtualization/virtual-program'

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
export type Token = {
  initialize: (
    program: WebGLProgram,
    virtualProgram: VirtualProgram,
    name: string
  ) => void
  getLocation: (
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    name: string
  ) => WebGLUniformLocation
  compile: (name: string) => string | undefined
  update: (
    gl: WebGL2RenderingContext,
    virtualProgram: VirtualProgram,
    name: string,
    location: WebGLUniformLocation | number
  ) => void
}
export type Setter = (
  value: Float32Array | ((value: Float32Array) => Float32Array)
) => void
export type GLProgramMemory = {
  buffers: BufferRegistry
  attributes: Map<string, WebGLBuffer>
  uniforms: UniformRegistry
  textures: TextureRegistry
  textureslots: TextureSlots
}
export type GLProgram = {
  draw: () => void
  program: WebGLProgram
}
