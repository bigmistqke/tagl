import { GL } from '.'
import { BufferToken, DataType, Format, InternalFormat, Token, ValueOf } from './types'
import { dataTypeToSize, log, uniformDataTypeToFunctionName } from './utils'
import { VirtualProgram } from './virtualization/virtual-program'

/**********************************************************************************/
/*                                                                                */
/*                                       TYPES                                    */
/*                                                                                */
/**********************************************************************************/

/* VARIABLE: UNIFORM + ATTRIBUTE */
type Variable<TValueDefault, TTOptionsDefault = unknown, TProperties = {}> = <
  const TValue extends TValueDefault,
  const TTOptions extends TTOptionsDefault
>(
  value: TValue,
  options?: Partial<TTOptions>
) => Token<TValue>

export type TextureOptions = {
  dataType: DataType
  format: Format
  height: number
  internalFormat: InternalFormat
  width: number
}

export type UniformParameters = Parameters<UniformProxy[keyof UniformProxy]>
export type UniformReturnType = ReturnType<ValueOf<UniformProxy>>
export type Sampler2DOptions = TextureOptions & {
  border: number
  magFilter: 'NEAREST' | 'LINEAR'
  minFilter: 'NEAREST' | 'LINEAR'
  wrapS: 'CLAMP_TO_EDGE'
  wrapT: 'CLAMP_TO_EDGE'
}

export type UniformProxy = {
  float: Variable<number>
  int: Variable<number>
  bool: Variable<boolean>
  vec2: Variable<Float32Array>
  ivec2: Variable<Float32Array>
  bvec2: Variable<Float32Array>
  vec3: Variable<Float32Array>
  ivec3: Variable<Float32Array>
  bvec3: Variable<Float32Array>
  vec4: Variable<Float32Array>
  ivec4: Variable<Float32Array>
  bvec4: Variable<Float32Array>
  mat2: Variable<Float32Array>
  mat3: Variable<Float32Array>
  mat4: Variable<Float32Array>
  sampler2D: Variable<Float32Array | HTMLImageElement, Sampler2DOptions>
  isampler2D: Variable<Float32Array, Sampler2DOptions>
  samplerCube: Variable<Float32Array, Sampler2DOptions>
}

/**
 * template-helper to inject uniform into `glsl`
 * @example
 *
 * ```ts
 * // dynamic
 * const [color] = createSignal([0, 1, 2])
 * glsl`
 *  vec3 color = ${uniform.vec3(color)};
 * `
 * // static
 * glsl`
 *  vec3 color = ${uniform.vec3([0, 1, 2])};
 * `
 * ```
 * */
export const uniform = new Proxy({} as UniformProxy, {
  get(target, type: string) {
    return (...[value, options]: UniformParameters) => {
      const functionName = uniformDataTypeToFunctionName(type)
      const onUpdates: (() => void)[] = []
      const virtualPrograms = new Set<VirtualProgram>()
      const getValue = () => value
      const token: Token = {
        set: (_value) => {
          value = typeof _value === 'function' ? _value(value) : _value
          for (let i = 0; i < onUpdates.length; i++) {
            onUpdates[i]!()
          }
        },
        get value() {
          return getValue()
        },
        compile: (name: string) => `uniform ${type} ${name};`,
        getLocation: ({ gl, program, name }) => gl.ctx.getUniformLocation(program, name)!,
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
      return token
    }
  },
})

/**********************************************************************************/
/*                                                                                */
/*                                    ATTRIBUTE                                   */
/*                                                                                */
/**********************************************************************************/

export type AttributeOptions = BufferOptions & {
  stride: number
  offset: number
  instanced: number | boolean
  instanceCount?: number
}

export type AttributeProxy = {
  float: Variable<Float32Array, AttributeOptions>
  int: Variable<Float32Array, AttributeOptions>
  vec2: Variable<Float32Array, AttributeOptions>
  vec3: Variable<Float32Array, AttributeOptions>
  vec4: Variable<Float32Array, AttributeOptions>
  ivec2: Variable<Float32Array, AttributeOptions>
  ivec3: Variable<Float32Array, AttributeOptions>
  ivec4: Variable<Float32Array, AttributeOptions>
  mat2: Variable<Float32Array, AttributeOptions>
  mat3: Variable<Float32Array, AttributeOptions>
  mat4: Variable<Float32Array, AttributeOptions>
}
export type AttributeParameters = Parameters<AttributeProxy[keyof AttributeProxy]>
export type AttributeReturnType = ReturnType<ValueOf<AttributeProxy>>

/**
 * template-helper to inject attribute into `glsl`
 * @example
 * ```ts
 * // dynamic
 * const [vertices] = createSignal
 *  new Float32Array([
      -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
    ])
 * )
 * glsl`
 *  vec2 vertices = ${attribute.vec2(vertices)};
 * `
 * 
 * // static
 * glsl`
 *  vec2 vertices = ${attribute.vec2(new Float32Array([
      -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
    ]))};
 * `
 * ```
 * */
export const attribute = new Proxy({} as AttributeProxy, {
  get(_, type: keyof AttributeProxy) {
    return (...[value, _options]: AttributeParameters): Token => {
      const virtualPrograms = new Set<VirtualProgram>()
      const onUpdates: (() => void)[] = []
      const size = dataTypeToSize(type)

      const token: Token = {
        get value() {
          return value
        },
        set: (_value) => {
          value = typeof _value === 'function' ? _value(value) : _value
          for (let i = 0; i < onUpdates.length; i++) {
            onUpdates[i]!()
          }
        },
        initialize: ({ gl, virtualProgram, location }) => {
          if (virtualPrograms.has(virtualProgram)) return
          virtualPrograms.add(virtualProgram)
          onUpdates.push(() => {
            virtualProgram.dirtyAttribute(location as number)
            if (!gl.isPending) gl.requestRender()
          })
        },
        getLocation: ({ gl, program, name }) => gl.ctx.getAttribLocation(program, name)!,
        update: ({ gl, virtualProgram, location }) => {
          const buffer = virtualProgram.registerBuffer(value, {
            usage: 'STATIC_DRAW',
            target: 'ARRAY_BUFFER',
          })
          if (buffer.dirty || !virtualProgram.checkAttribute(location as number, value)) {
            gl.ctx.bindBuffer(gl.ctx.ARRAY_BUFFER, buffer.value)
            if (buffer.dirty) {
              gl.ctx.bufferData(gl.ctx.ARRAY_BUFFER, value, gl.ctx.STATIC_DRAW)
              buffer.dirty = false
            }
          } else {
            log('early return attribute')
            return
          }
          virtualProgram.setAttribute(location as number, value)

          gl.ctx.vertexAttribPointer(location as number, size, gl.ctx.FLOAT, false, 0, 0)
          gl.ctx.enableVertexAttribArray(location as number)
        },
        compile: (name) => `in ${type} ${name};`,
      }
      return token
    }
  },
})
/**********************************************************************************/
/*                                                                                */
/*                                      BUFFER                                    */
/*                                                                                */
/**********************************************************************************/

export type BufferUsage =
  | 'STATIC_DRAW'
  | 'DYNAMIC_DRAW'
  | 'STREAM_DRAW'
  | 'STATIC_READ'
  | 'DYNAMIC_READ'
  | 'STREAM_READ'
  | 'STATIC_COPY'
  | 'DYNAMIC_COPY'
  | 'STREAM_COPY'

export type BufferOptions = {
  name?: string
  target:
    | 'ARRAY_BUFFER'
    | 'ELEMENT_ARRAY_BUFFER'
    | 'COPY_READ_BUFFER'
    | 'COPY_WRITE_BUFFER'
    | 'TRANSFORM_FEEDBACK_BUFFER'
    | 'UNIFORM_BUFFER'
    | 'PIXEL_PACK_BUFFER'
    | 'PIXEL_UNPACK_BUFFER'
  usage: BufferUsage
}

export const buffer = (value: Float32Array, _options?: BufferOptions): BufferToken => {
  const options: BufferOptions = {
    target: 'ARRAY_BUFFER',
    usage: 'STATIC_DRAW',
    ..._options,
  }

  const gls = new Set<GL>()
  const onUpdates: (() => void)[] = []

  const token: BufferToken = {
    set: (_value) => {
      value = typeof _value === 'function' ? _value(value) : _value
      for (let i = 0; i < onUpdates.length; i++) {
        onUpdates[i]!()
      }
    },
    initialize: ({ gl }) => {
      if (!gls.has(gl)) {
        gls.add(gl)
        onUpdates.push(() => !gl.isPending && gl.requestRender())
      }
      return token
    },
    update: ({ gl, virtualProgram }) => {
      const buffer = virtualProgram.registerBuffer(value, options)
      if (buffer.dirty) {
        gl.ctx.bindBuffer(gl.ctx[options.target], buffer.value)
        if (buffer.dirty) {
          gl.ctx.bufferData(gl.ctx[options.target], value, gl.ctx[options.usage])
          buffer.dirty = false
        }
      } else {
        log('early return attribute')
      }
      return token
    },
  }

  return token
}
