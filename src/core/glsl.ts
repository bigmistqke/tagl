import { GL } from './create-gl'
import { Token } from './tokens'
import { GLLocation } from './types'
import { shaderCompilationRegistry } from './virtualization/registries'
import { VirtualProgram } from './virtualization/virtual-program'

const GLSL = Symbol()
export const glsl = function (template: TemplateStringsArray, ...tokens: Token<any>[]) {
  let { names, compilation } = shaderCompilationRegistry.register(template, tokens).value
  return {
    [GLSL]: true,
    compilation,
    template,
    getLocations: ({ gl, program }: { gl: GL; program: WebGLProgram }) =>
      tokens.map((token, index) => token.__.getLocation({ gl, program, name: names[index]! })),
    bind: ({ gl, virtualProgram, locations }: { gl: GL; virtualProgram: VirtualProgram; locations: GLLocation[] }) => {
      for (let index = 0; index < tokens.length; index++) {
        tokens[index]!.__.bind({
          gl,
          virtualProgram,
          location: locations[index]!,
        })
      }
    },
    update: ({
      gl,
      virtualProgram,
      locations,
    }: {
      gl: GL
      virtualProgram: VirtualProgram
      locations: GLLocation[]
    }) => {
      for (let index = 0; index < tokens.length; index++) {
        tokens[index]!.__.update({
          gl,
          virtualProgram,
          location: locations[index]!,
        })
      }
    },
  }
}
export type ShaderToken = ReturnType<typeof glsl>

export const isShader = (value: any): value is ShaderToken => typeof value === 'object' && GLSL in value
