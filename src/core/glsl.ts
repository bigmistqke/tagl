import { Program } from './create-gl'
import { Token } from './tokens'
import { GLLocation } from './types'
import { shaderCompilationRegistry } from './virtualization/registries'

const GLSL = Symbol()
export const glsl = function (template: TemplateStringsArray, ...tokens: Token<any>[]) {
  let { names, compilation } = shaderCompilationRegistry.register(template, tokens).value
  return {
    [GLSL]: true,
    compilation,
    template,
    getLocations: (program: Program) => tokens.map((token, index) => token.__.getLocation(program, names[index]!)),
    bind: (program: Program, locations: GLLocation[]) => {
      for (let index = 0; index < tokens.length; index++) {
        tokens[index]!.__.bind(program, locations[index]!)
      }
    },
    update: (program: Program, locations: GLLocation[]) => {
      for (let index = 0; index < tokens.length; index++) {
        tokens[index]!.__.update(program, locations[index]!)
      }
    },
  }
}
export type ShaderToken = ReturnType<typeof glsl>

export const isShader = (value: any): value is ShaderToken => typeof value === 'object' && GLSL in value
