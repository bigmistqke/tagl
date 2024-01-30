import zeptoid from 'zeptoid'

import { glsl } from 'src'
import { compile } from '../compilation'
import { RegistryBase } from '../data-structures/registry'
import { Token } from '../types'
import { createInstantiator, createWebGLProgram } from '../utils'
import { createVirtualProgram } from './virtual-program'

/** caches `WebGLBuffer` based on reference */
export class BufferRegistry extends RegistryBase<Float32Array, WebGLBuffer> {
  constructor(private gl: WebGL2RenderingContext) {
    super()
  }
  register(value: Float32Array) {
    return super._register(value, () => {
      const buffer = this.gl.createBuffer()
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)
      this.gl.bufferData(this.gl.ARRAY_BUFFER, value, this.gl.STATIC_DRAW)
      if (!buffer) throw 'Unable to create texture'
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
export class ShaderLocationRegistry extends RegistryBase<
  WebGLProgram,
  (number | WebGLUniformLocation)[]
> {
  register = super._register
  static getInstance = createInstantiator<TemplateStringsArray>()(this)
}

/** caches `WebGLProgram` based on vertex's and fragment's `TemplateStringArray` */
export class ProgramRegistry extends RegistryBase<
  TemplateStringsArray,
  RegistryBase<TemplateStringsArray, WebGLProgram>
> {
  constructor(private gl: WebGL2RenderingContext) {
    super()
  }
  register(vertex: ReturnType<typeof glsl>, fragment: ReturnType<typeof glsl>) {
    const registry = super._register(
      vertex.template,
      () => new RegistryBase<TemplateStringsArray, WebGLProgram>()
    )
    return registry.value._register(fragment.template, () => {
      const program = createWebGLProgram(
        this.gl,
        vertex.compilation.code,
        fragment.compilation.code
      )

      createVirtualProgram(this.gl, program)

      return program
    })
  }
  static getInstance = createInstantiator<WebGL2RenderingContext>()(this)
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
      initializeGl(gl)
      return {
        program: undefined,
      }
    })
  }
}

const initializeGl = (gl: WebGL2RenderingContext) => {
  const resizeObserver = new ResizeObserver(() => {
    if (gl.canvas instanceof OffscreenCanvas) {
      throw 'can not autosize OffscreenCanvas'
    }
    gl.canvas.width = gl.canvas.clientWidth
    gl.canvas.height = gl.canvas.clientHeight
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  })
  resizeObserver.observe(gl.canvas as HTMLCanvasElement)
}

export const glRegistry = new GLRegistry()
