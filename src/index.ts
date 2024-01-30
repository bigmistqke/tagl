import type {
  AttributeTypes,
  GLLocation,
  Setter,
  Token,
  UniformTypes,
} from './types'
import { dataTypeToSize, uniformDataTypeToFunctionName } from './utils'
import {
  ProgramRecord,
  ProgramRegistry,
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
    for (let i = 0; i < onUpdates.length; i++) {
      onUpdates[i]!()
    }
  }
  const functionName = uniformDataTypeToFunctionName(type)

  const onUpdates: (() => void)[] = []
  const virtualPrograms = new Set<VirtualProgram>()

  const getValue = () => value

  const token: Token = {
    compile: (name: string) => `uniform ${type} ${name};`,
    getLocation: ({ gl, program, name }) =>
      gl.ctx.getUniformLocation(program, name)!,
    initialize: ({ gl, virtualProgram, location }) => {
      if (virtualPrograms.has(virtualProgram)) return
      virtualPrograms.add(virtualProgram)
      const uniform = virtualProgram.registerUniform(location, getValue)
      onUpdates.push(() => {
        if (uniform.dirty) return
        uniform.dirty = true
        if (!gl.isPending) gl.requestRender()
      })
    },
    update: ({ gl, virtualProgram, location }) => {
      const uniform = virtualProgram.registerUniform(location, getValue)

      if (uniform.value === value && !uniform.dirty) {
        DEBUG && console.info('early return uniform')
        return
      }

      uniform.dirty = false
      uniform.value = value

      if (type.includes('mat')) {
        // @ts-expect-error
        gl.ctx[functionName](location, false, value)
      } else {
        // @ts-expect-error
        gl.ctx[functionName](location, value)
      }
    },
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
    for (let i = 0; i < onUpdates.length; i++) {
      onUpdates[i]!()
    }
  }

  const virtualPrograms = new Set<VirtualProgram>()
  const onUpdates: (() => void)[] = []
  const size = dataTypeToSize(type)

  const token: Token = {
    initialize: ({ gl, virtualProgram, location }) => {
      if (virtualPrograms.has(virtualProgram)) return
      virtualPrograms.add(virtualProgram)
      onUpdates.push(() => {
        virtualProgram.dirtyAttribute(location as number)
        if (!gl.isPending) gl.requestRender()
      })
    },
    getLocation: ({ gl, program, name }) =>
      gl.ctx.getAttribLocation(program, name)!,
    update: ({ gl, virtualProgram, location }) => {
      const buffer = virtualProgram.registerBuffer(value)
      if (
        buffer.dirty ||
        !virtualProgram.checkAttribute(location as number, value)
      ) {
        gl.ctx.bindBuffer(gl.ctx.ARRAY_BUFFER, buffer.value)
        if (buffer.dirty) {
          gl.ctx.bufferData(gl.ctx.ARRAY_BUFFER, value, gl.ctx.STATIC_DRAW)
          buffer.dirty = false
        }
      } else {
        DEBUG && console.info('early return attribute')
        return
      }
      virtualProgram.setAttribute(location as number, value)

      gl.ctx.vertexAttribPointer(
        location as number,
        size,
        gl.ctx.FLOAT,
        false,
        0,
        0
      )
      gl.ctx.enableVertexAttribArray(location as number)
    },
    compile: (name) => `in ${type} ${name};`,
  }
  return [token, setValue]
}

export const glsl = function (
  template: TemplateStringsArray,
  ...tokens: Token[]
) {
  let { names, compilation } = shaderCompilationRegistry.register(
    template,
    tokens
  ).value
  return {
    compilation,
    template,
    getLocations: ({ gl, program }: { gl: GL; program: WebGLProgram }) =>
      tokens.map((token, index) =>
        token.getLocation({ gl, program, name: names[index]! })
      ),
    initialize: ({
      gl,
      virtualProgram,
      locations,
    }: {
      gl: GL
      virtualProgram: VirtualProgram
      locations: GLLocation[]
    }) => {
      for (let index = 0; index < tokens.length; index++) {
        tokens[index]!.initialize({
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
        tokens[index]!.update({
          gl,
          virtualProgram,
          location: locations[index]!,
        })
      }
    },
  }
}

export type Program = {
  draw: () => void
  program: WebGLProgram
}

export type GL = {
  ctx: WebGL2RenderingContext
  setStack(...programs: Program[]): void
  isPending: boolean
  requestRender: () => void
  createProgram: ({
    vertex,
    fragment,
    count,
  }: {
    vertex: ReturnType<typeof glsl>
    fragment: ReturnType<typeof glsl>
    count: number
  }) => Program
  onLoop: (callback: (now: number) => void) => () => void
}

export const createGL = (canvas: HTMLCanvasElement): GL => {
  const ctx = canvas.getContext('webgl2')
  let stack: Program[] = []

  if (!ctx) throw 'could not get context webgl2'

  const onLoops: ((now: number) => void)[] = [] //new Deque<(now: number) => void>()
  let looping = false

  const loop = (now: number) => {
    if (onLoops.length === 0) {
      looping = false
      return
    }
    requestAnimationFrame(loop)
    for (let i = 0; i < onLoops.length; i++) {
      const node = onLoops[i]
      if (node) {
        node(now)
      }
    }
    if (gl.isPending) render()
  }

  const render = () => {
    for (let i = 0; i < stack.length; i++) {
      stack[i]!.draw()
    }
    gl.isPending = false
  }

  const gl = {
    ctx,
    setStack(...programs: Program[]) {
      stack = programs
    },
    isPending: false,
    requestRender: () => {
      gl.isPending = true
      if (looping) return
      requestIdleCallback(render)
    },
    createProgram: ({
      vertex,
      fragment,
      count,
    }: {
      vertex: ReturnType<typeof glsl>
      fragment: ReturnType<typeof glsl>
      count: number
    }) => {
      const gl_record = glRegistry.register(gl.ctx)

      const { program, locations } = ProgramRegistry.getInstance(gl).register(
        vertex,
        fragment
      ).value as ProgramRecord

      const virtualProgram = getVirtualProgram(program)

      gl.ctx.useProgram(program)

      const vertexOptions = {
        gl,
        virtualProgram,
        locations: locations.vertex,
      }
      const fragmentOptions = {
        gl,
        virtualProgram,
        locations: locations.fragment,
      }

      vertex.initialize(vertexOptions)
      fragment.initialize(fragmentOptions)

      return {
        draw: () => {
          if (gl_record.value.program !== program) {
            gl.ctx.useProgram(program)
            gl_record.value.program = program
          }
          vertex.update(vertexOptions)
          fragment.update(fragmentOptions)
          gl.ctx.drawArrays(gl.ctx.TRIANGLES, 0, count)
        },
        program,
      }
    },
    onLoop: (callback: (now: number) => void) => {
      onLoops.push(callback)

      if (onLoops.length === 1) {
        looping = true
        requestAnimationFrame(loop)
      }
      return () => {
        // onLoops.splice(onLoops.indexOf(callback), -1)
      }
    },
  }
  return gl
}
