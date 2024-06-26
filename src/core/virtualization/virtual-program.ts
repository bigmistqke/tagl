import { Registry } from '@tagl/core/data-structures/registry'
import { BufferOptions, TypedArray } from '@tagl/core/types'

import { ValidUniformValues } from '../tokens'
import { BufferRegistry, TextureRegistry } from './registries'
import { TextureSlots } from './texture-slots'

export class VirtualProgram {
  private attributes: Map<number, Float32Array>
  private uniforms: Registry<WebGLUniformLocation, TypedArray | number | boolean | HTMLImageElement>
  private buffers: BufferRegistry
  private textures: TextureRegistry
  private textureSlots: TextureSlots

  constructor(gl: WebGL2RenderingContext) {
    this.attributes = new Map<number, Float32Array>()
    this.uniforms = new Registry<WebGLUniformLocation, Float32Array | number>()
    this.buffers = BufferRegistry.getInstance(gl)
    this.textures = TextureRegistry.getInstance(gl)
    this.textureSlots = TextureSlots.create(gl)
  }

  checkAttribute(name: number, value: Float32Array) {
    return this.attributes.get(name) === value
  }
  dirtyAttribute(location: number) {
    const value = this.attributes.get(location)
    if (value) this.buffers.dirty(value)
  }
  setAttribute(name: number, value: Float32Array) {
    this.attributes.set(name, value)
  }

  registerBuffer<T extends BufferSource>(value: T, options: BufferOptions) {
    return this.buffers.register(value, options)
  }
  dirtyBuffer(value: Float32Array) {
    this.buffers.dirty(value)
  }

  registerUniform<T extends ValidUniformValues>(location: WebGLUniformLocation, value: () => T) {
    return this.uniforms.register<T>(location, value)
  }
  updateUniform(name: string, value: Float32Array | number) {
    this.uniforms.update(name, value)
  }
  dirtyUniform(name: string) {
    this.uniforms.dirty(name)
  }
}

const virtualPrograms = new Map<WebGLProgram, VirtualProgram>()
export const createVirtualProgram = (gl: WebGL2RenderingContext, program: WebGLProgram) => {
  virtualPrograms.set(program, new VirtualProgram(gl))
}
export const getVirtualProgram = (program: WebGLProgram) => {
  const virtualProgram = virtualPrograms.get(program)
  if (!virtualProgram) throw 'could not find virtualProgram'
  return virtualProgram
}
