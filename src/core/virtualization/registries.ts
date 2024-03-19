import zeptoid from 'zeptoid'

import { GL, Program } from 'src/core'
import { compile } from '../compilation'
import { RegistryBase } from '../data-structures/registry'
import { Token } from '../tokens'
import { BufferOptions, GLLocation } from '../types'
import { createInstantiator, createWebGLProgram } from '../utils'
import { createVirtualProgram } from './virtual-program'

/** caches `WebGLBuffer` based on reference */
export class BufferRegistry extends RegistryBase<BufferSource, WebGLBuffer> {
  constructor(private gl: WebGL2RenderingContext) {
    super()
  }
  register<T extends BufferSource>(value: T, options: BufferOptions) {
    return super._register(value, () => {
      const buffer = this.gl.createBuffer()
      this.gl.bindBuffer(this.gl[options.target], buffer)
      this.gl.bufferData(this.gl[options.target], value, this.gl[options.usage])
      if (!buffer) throw 'Unable to create buffer'
      return buffer
    })
  }
  static getInstance = createInstantiator<WebGL2RenderingContext>()(this)
}

/** caches `WebGLTextures` based on reference */
export class TextureRegistry extends RegistryBase<
  WebGLTexture,
  {
    texture: WebGLTexture
    dirty: boolean
  }
> {
  constructor(private gl: WebGL2RenderingContext) {
    super()
  }
  createTexture() {
    const texture = this.gl.createTexture()
    if (!texture) throw 'Unable to create texture'
    return { texture, dirty: true }
  }
  register(value: any) {
    return super._register(value, this.createTexture)
  }
  static getInstance = createInstantiator<WebGL2RenderingContext>()(this)
}

class ShaderCompilationRegistry extends RegistryBase<
  TemplateStringsArray,
  {
    compilation: ReturnType<typeof compile>
    names: string[]
  }
> {
  register(template: TemplateStringsArray, tokens: Token[]) {
    return super._register(template, () => {
      const names = tokens.map(() => `_${zeptoid()}`)
      return {
        compilation: compile(template, tokens, names),
        names,
      }
    })
  }
}

/** caches tagl's compilation of `glsl`-shader based on its `TemplateStringArray` */
export const shaderCompilationRegistry = new ShaderCompilationRegistry()

/** caches uniform/attribute-locations based on `glsl`-shader's `TemplateStringArray` and `WebGLProgram`  */
export class ShaderLocationRegistry extends RegistryBase<WebGLProgram, (number | WebGLUniformLocation)[]> {
  register = super._register
  static getInstance = createInstantiator<TemplateStringsArray>()(this)
}

export type ProgramRecord = {
  glProgram: WebGLProgram
  locations: {
    vertex: GLLocation[]
    fragment: GLLocation[]
  }
}

/** caches `WebGLProgram` based on vertex's and fragment's `TemplateStringArray` */
export class ProgramRegistry extends RegistryBase<
  TemplateStringsArray,
  RegistryBase<TemplateStringsArray, ProgramRecord>
> {
  constructor(private gl: GL) {
    super()
  }
  register(program: Program) {
    return super
      ._register(program.vertex.template, () => new RegistryBase<TemplateStringsArray, ProgramRecord>())
      .value._register(program.fragment.template, () => {
        const glProgram = createWebGLProgram(
          this.gl.ctx,
          program.vertex.compilation.code,
          program.fragment.compilation.code
        )

        createVirtualProgram(this.gl.ctx, glProgram)

        program.glProgram = glProgram

        return {
          glProgram,
          locations: {
            vertex: program.vertex.getLocations(program),
            fragment: program.fragment.getLocations(program),
          },
        }
      })
  }
  static getInstance = createInstantiator<GL>()(this)
}

/** caches `WebGLProgram` based on vertex's and fragment's `TemplateStringArray` */
class GLRegistry extends RegistryBase<
  WebGL2RenderingContext,
  {
    program: WebGLProgram | undefined
  }
> {
  register(gl: WebGL2RenderingContext) {
    return super._register(gl, () => {
      return {
        program: undefined,
      }
    })
  }
}

export const glRegistry = new GLRegistry()
