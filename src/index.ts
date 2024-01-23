import { Registry } from './data-structures/Registry'
import type { AttributeTypes, Setter, Token, UniformTypes } from './types'
import { dataTypeToSize, uniformDataTypeToFunctionName } from './utils'
import {
  ProgramRegistry,
  ShaderLocationRegistry,
  glRegistry,
  shaderCompilationRegistry,
} from './virtualization/registries'
import {
  VirtualProgram,
  getVirtualProgram,
} from './virtualization/virtual-program'

const DEBUG = false

export const createUniform = (
  type: UniformTypes,
  value: Float32Array
): [Token, Setter] => {
  const setValue: Setter = (_value) => {
    value = typeof _value === 'function' ? _value(value) : _value
    onUpdates.forEach((update) => update())
  }
  const functionName = uniformDataTypeToFunctionName(type)

  const onUpdates: (() => void)[] = []
  const virtualPrograms = new Set<VirtualProgram>()

  const token: Token = {
    initialize: (program, virtualProgram, location) => {
      if (virtualPrograms.has(virtualProgram)) return
      virtualPrograms.add(virtualProgram)
      const uniform = virtualProgram.registerUniform(location, () => value)
      onUpdates.push(() => {
        uniform.dirty = true
        getStacks(program)?.forEach((stack) => stack.draw())
      })
    },
    getLocation: (gl, program, name) => gl.getUniformLocation(program, name)!,
    update: (gl, virtualProgram, location) => {
      const uniform = virtualProgram.registerUniform(location, () => value)

      if (uniform.value === value && !uniform.dirty) {
        DEBUG && console.info('early return uniform')
        return
      }

      uniform.dirty = false
      uniform.value = value

      // virtualProgram.updateUniform(name, value)

      if (type.includes('mat')) {
        // @ts-expect-error
        gl[functionName](location, false, value)
      } else {
        // @ts-expect-error
        gl[functionName](location, value)
      }
    },
    compile: (name: string) => `uniform ${type} ${name};`,
  }
  return [token, setValue]
}

export const createAttribute = (
  type: AttributeTypes,
  value: Float32Array
): [Token, Setter] => {
  const setValue = (
    _value: Float32Array | ((value: Float32Array) => Float32Array)
  ) => {
    value = typeof _value === 'function' ? _value(value) : _value
    onUpdates.forEach((update) => update())
  }

  const virtualPrograms = new Set<VirtualProgram>()
  const onUpdates: (() => void)[] = []
  const size = dataTypeToSize(type)

  const token: Token = {
    initialize: (program, virtualProgram, location) => {
      if (virtualPrograms.has(virtualProgram)) return
      virtualPrograms.add(virtualProgram)
      onUpdates.push(() => {
        virtualProgram.dirtyAttribute(location as number)
        getStacks(program)?.forEach((stack) => stack.draw())
      })
    },
    getLocation: (gl, program, name) => gl.getAttribLocation(program, name)!,
    update: (gl, virtualProgram, location) => {
      const buffer = virtualProgram.registerBuffer(value)
      if (
        buffer.dirty ||
        !virtualProgram.checkAttribute(location as number, value)
      ) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer.value)
        if (buffer.dirty) {
          gl.bufferData(gl.ARRAY_BUFFER, value, gl.STATIC_DRAW)
          buffer.dirty = false
        }
      } else {
        DEBUG && console.info('early return attribute')
        return
      }
      virtualProgram.setAttribute(location as number, value)

      gl.vertexAttribPointer(location as number, size, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(location as number)
    },
    compile: (name) => `in ${type} ${name};`,
  }
  return [token, setValue]
}

export const glsl = function (
  template: TemplateStringsArray,
  ...tokens: Token[]
) {
  const locationsRegistry = ShaderLocationRegistry.getInstance(template)
  let { names, compilation } = shaderCompilationRegistry.register(
    template,
    tokens
  ).value

  const getLocations = (program: WebGLProgram) => {
    const locations = locationsRegistry.get(program)?.value
    if (!locations) {
      throw 'no locations'
    }
    return locations
  }

  return {
    compilation,
    template,
    initialize: (
      gl: WebGL2RenderingContext,
      program: WebGLProgram,
      virtualProgram: VirtualProgram
    ) => {
      const locations = locationsRegistry.register(program, () =>
        tokens.map((token, index) =>
          token.getLocation(gl, program, names[index]!)
        )
      ).value
      for (let index = 0; index < tokens.length; index++) {
        tokens[index]!.initialize(program, virtualProgram, locations[index]!)
      }
    },
    update: (
      gl: WebGL2RenderingContext,
      program: WebGLProgram,
      virtualProgram: VirtualProgram
    ) => {
      const locations = getLocations(program)
      for (let index = 0; index < tokens.length; index++) {
        tokens[index]!.update(gl, virtualProgram, locations[index]!)
      }
    },
  }
}

export const createProgram = ({
  gl,
  vertex,
  fragment,
  count,
}: {
  gl: WebGL2RenderingContext
  vertex: ReturnType<typeof glsl>
  fragment: ReturnType<typeof glsl>
  count: number
}) => {
  const gl_record = glRegistry.register(gl)

  const program = ProgramRegistry.getInstance(gl).register(
    vertex,
    fragment
  ).value

  const virtualProgram = getVirtualProgram(program)

  gl.useProgram(program)
  vertex.initialize(gl, program, virtualProgram)
  fragment.initialize(gl, program, virtualProgram)

  return {
    draw: () => {
      if (gl_record.value.program !== program) {
        gl.useProgram(program)
        gl_record.value.program = program
      }
      vertex.update(gl, program, virtualProgram)
      fragment.update(gl, program, virtualProgram)
      gl.drawArrays(gl.TRIANGLES, 0, count)
    },
    program,
  }
}

const programToStackRegistry = new Registry<WebGLProgram, Set<Stack>>()
const getStacks = (program: WebGLProgram) =>
  programToStackRegistry.get(program)?.value

type Stack = {
  draw: () => void
}

export const createStack = (
  ...programs: ReturnType<typeof createProgram>[]
) => {
  let isPending = false

  const stack = {
    draw: () => {
      if (isPending) {
        return
      }
      isPending = true
      requestIdleCallback(() => {
        programs.forEach((program) => program.draw())
        isPending = false
      })
    },
  }

  programs.forEach((program) => {
    const record = programToStackRegistry.register(
      program.program,
      () => new Set<Stack>()
    )
    record.value.add(stack)
  })

  return stack
}
