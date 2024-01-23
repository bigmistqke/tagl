import { Registry } from './data-structures/Registry'
import type { AttributeTypes, Setter, Token, UniformTypes } from './types'
import { dataTypeToSize, uniformDataTypeToFunctionName } from './utils'
import {
  ProgramRegistry,
  ShaderLocationRegistry,
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

  const onUpdates = new Set<() => void>()

  const token: Token = {
    initialize: (program, virtualProgram, name) =>
      onUpdates.add(() => {
        virtualProgram.dirtyUniform(name)
        getStacks(program)?.forEach((stack) => stack.draw())
      }),
    getLocation: (gl, program, name) => gl.getUniformLocation(program, name)!,
    update: (gl, virtualProgram, name, location) => {
      const uniform = virtualProgram.registerUniform(name, () => value)

      if (uniform.value === value && !uniform.dirty) {
        DEBUG && console.info('early return uniform')
        return
      }

      virtualProgram.updateUniform(name, value)

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

  const onUpdates = new Set<() => void>()

  const token: Token = {
    initialize: (program, virtualProgram, name) => {
      onUpdates.add(() => {
        virtualProgram.dirtyAttribute(name)
        getStacks(program)?.forEach((stack) => stack.draw())
      })
    },
    getLocation: (gl, program, name) => gl.getAttribLocation(program, name)!,
    update: (gl, virtualProgram, name, location) => {
      const buffer = virtualProgram.registerBuffer(value)
      if (buffer.dirty || !virtualProgram.checkAttribute(name, value)) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer.value)
        if (buffer.dirty) {
          gl.bufferData(gl.ARRAY_BUFFER, value, gl.STATIC_DRAW)
          buffer.dirty = false
        }
      } else {
        DEBUG && console.info('early return attribute')
        return
      }
      virtualProgram.setAttribute(name, value)

      gl.vertexAttribPointer(
        location as number,
        dataTypeToSize(type),
        gl.FLOAT,
        false,
        0,
        0
      )
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

  return {
    compilation,
    template,
    initialize: (
      gl: WebGL2RenderingContext,
      program: WebGLProgram,
      virtualProgram: VirtualProgram
    ) => {
      tokens.forEach((token, index) => {
        token.initialize(program, virtualProgram, names[index]!)
      })
      locationsRegistry.register(program, () =>
        tokens.map((token, index) =>
          token.getLocation(gl, program, names[index]!)
        )
      )
    },
    update: (
      gl: WebGL2RenderingContext,
      program: WebGLProgram,
      virtualProgram: VirtualProgram
    ) => {
      const locations = locationsRegistry.get(program)?.value
      if (!locations) {
        console.error('no locations')
        return
      }
      tokens.forEach((token, index) =>
        token.update(gl, virtualProgram, names[index]!, locations[index]!)
      )
    },
  }
}

const gls = new WeakSet<WebGL2RenderingContext>()
const initializeGl = (gl: WebGL2RenderingContext) => {
  if (gls.has(gl)) return
  gls.add(gl)
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
  initializeGl(gl)
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
      gl.useProgram(program)
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
      requestAnimationFrame(() => {
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
