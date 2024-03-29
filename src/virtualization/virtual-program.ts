import { Registry } from '../data-structures/Registry'
import { BufferRegistry, TextureRegistry } from './registries'
import { TextureSlots } from './texture-slots'

export class VirtualProgram {
  private attributes: Map<string, Float32Array>
  private uniforms: Registry<string, Float32Array | number>
  private buffers: BufferRegistry
  private textures: TextureRegistry
  private textureSlots: TextureSlots

  constructor(gl: WebGL2RenderingContext) {
    this.attributes = new Map<string, Float32Array>()
    this.uniforms = new Registry<string, Float32Array | number>()
    this.buffers = BufferRegistry.getInstance(gl)
    this.textures = TextureRegistry.getInstance(gl)
    this.textureSlots = TextureSlots.create(gl)
  }

  checkAttribute(name: string, value: Float32Array) {
    return this.attributes.get(name) === value
  }
  dirtyAttribute(name: string) {
    const value = this.attributes.get(name)
    if (value) this.buffers.dirty(value)
  }
  setAttribute(name: string, value: Float32Array) {
    this.attributes.set(name, value)
  }

  registerBuffer(value: Float32Array) {
    return this.buffers.register(value)
  }
  dirtyBuffer(value: Float32Array) {
    this.buffers.dirty(value)
  }

  registerUniform(name: string, value: () => Float32Array | number) {
    return this.uniforms.register(name, value)
  }
  updateUniform(name: string, value: Float32Array | number) {
    this.uniforms.update(name, value)
  }
  dirtyUniform(name: string) {
    this.uniforms.dirty(name)
  }
}

const virtualPrograms = new Map<WebGLProgram, VirtualProgram>()
export const createVirtualProgram = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram
) => {
  virtualPrograms.set(program, new VirtualProgram(gl))
}
export const getVirtualProgram = (program: WebGLProgram) => {
  const virtualProgram = virtualPrograms.get(program)
  if (!virtualProgram) throw 'could not find virtualProgram'
  return virtualProgram
}
