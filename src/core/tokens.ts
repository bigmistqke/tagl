import { $TYPE, Program } from '.'
import { Atom, atom } from './atom'
import {
  Accessor,
  DataType,
  Format,
  InternalFormat,
  Mat2,
  Mat3,
  Mat4,
  Setter,
  ValueOf,
  Vec2,
  Vec3,
  Vec4,
} from './types'
import { dataTypeToSize, isAtom, uniformDataTypeToFunctionName } from './utils'

/**********************************************************************************/
/*                                       TYPES                                    */
/**********************************************************************************/
/* VARIABLE: UNIFORM + ATTRIBUTE */
type Variable<TValueDefault, TTOptionsDefault = unknown, TProperties = {}> = <
  const TValue extends TValueDefault,
  const TTOptions extends TTOptionsDefault
>(
  value: TValue | Atom<TValue>,
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
  vec2: Variable<Vec2>
  vec3: Variable<Vec3>
  vec4: Variable<Vec4>
  ivec2: Variable<Vec2>
  ivec3: Variable<Vec3>
  ivec4: Variable<Vec4>
  mat2: Variable<Mat2>
  mat3: Variable<Mat3>
  mat4: Variable<Mat4>
  sampler2D: Variable<Float32Array | HTMLImageElement, Sampler2DOptions>
  isampler2D: Variable<Float32Array, Sampler2DOptions>
  samplerCube: Variable<Float32Array, Sampler2DOptions>
}

export type Token<T = Float32Array, TLocation = WebGLUniformLocation | number> = {
  [$TYPE]: 'token'
  set: Setter<T>
  get: Accessor<T>
  onBeforeDraw: (callback: () => void) => () => void
  onBind: (handler: (program: Program) => void) => () => void
  subscribe: (callback: (value: T) => void) => () => void
  __: {
    bind: (program: Program, location: TLocation) => Token<T, TLocation>
    getLocation: (program: Program, name: string) => TLocation
    notify: () => void
    requestRender: () => void
    template: (name: string) => string | undefined
    update: (program: Program, location: TLocation) => void
  }
}

/**********************************************************************************/
/*                                    UNIFORM                                     */
/**********************************************************************************/
/**
 * Utility to inject uniform into `glsl`-templates.
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
      const { __, get, subscribe, onBeforeDraw, set, onBind } = isAtom(value) ? value : atom<any>(value)

      const token: Token<Exclude<typeof value, Atom>> = {
        [$TYPE]: 'token',
        get,
        set,
        subscribe,
        onBeforeDraw,
        onBind,
        __: {
          requestRender: __.requestRender,
          notify: __.notify,
          bind: (program, location) => {
            const uniform = program.virtualProgram.registerUniform(location, get)
            __.bind(program, () => {
              if (uniform.dirty) return false
              uniform.dirty = true
            })
            return token
          },
          template: (name: string) => `uniform ${type} ${name};`,
          getLocation: (program, name) => program.gl.ctx.getUniformLocation(program.glProgram, name)!,
          update: (program, location) => {
            const uniform = program.virtualProgram.registerUniform(location, get)

            if (uniform.value === get() && !uniform.dirty) {
              return
            }

            uniform.dirty = false
            uniform.value = get()

            if (type.includes('mat')) {
              // @ts-expect-error
              program.gl.ctx[functionName](location, false, get())
            } else {
              // @ts-expect-error
              program.gl.ctx[functionName](location, get())
            }
          },
        },
      }
      return token
    }
  },
})

/**********************************************************************************/
/*                                    ATTRIBUTE                                   */
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
      const size = dataTypeToSize(type)

      const { get, set, subscribe, __ } = isAtom(value) ? value : atom<any>(value)

      const token: Token<Exclude<typeof value, Atom>> = {
        [$TYPE]: 'token',
        get,
        set,
        subscribe,
        __: {
          bind: (program, location) => {
            __.bind(program, () => {
              program.virtualProgram.dirtyAttribute(location as number)
            })
            return token
          },
          update: ({ virtualProgram, gl }, location) => {
            const buffer = virtualProgram.registerBuffer(get(), {
              usage: 'STATIC_DRAW',
              target: 'ARRAY_BUFFER',
            })

            if (buffer.dirty || !virtualProgram.checkAttribute(location as number, get())) {
              gl.ctx.bindBuffer(gl.ctx.ARRAY_BUFFER, buffer.value)
              if (buffer.dirty) {
                gl.ctx.bufferData(gl.ctx.ARRAY_BUFFER, get(), gl.ctx.STATIC_DRAW)
                buffer.dirty = false
              }
            } else {
              return
            }
            virtualProgram.setAttribute(location as number, get())

            gl.ctx.vertexAttribPointer(location as number, size, gl.ctx.FLOAT, false, 0, 0)
            gl.ctx.enableVertexAttribArray(location as number)
          },
          template: (name) => `in ${type} ${name};`,
          getLocation: (program, name) => program.gl.ctx.getAttribLocation(program.glProgram, name)!,
        },
      }
      return token
    }
  },
}) /**********************************************************************************/
/*                                      BUFFER                                    */

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

export type BufferToken<T = Float32Array> = {
  [$TYPE]: 'buffer'
  set: Setter<T>
  get: Accessor<T>
  subscribe: (callback: (value: T) => void) => () => void
  __: {
    bind: (program: Program) => BufferToken<T>
    update: (program: Program) => BufferToken<T>
  }
}

const cache = new WeakMap<Program, Map<string, WebGLBuffer>>()

export const buffer = <T extends BufferSource>(value: T | Atom<T>, _options?: BufferOptions): BufferToken<T> => {
  const options: BufferOptions = {
    target: 'ARRAY_BUFFER',
    usage: 'STATIC_DRAW',
    ..._options,
  }

  const { get, subscribe, set, __ } = isAtom<T>(value) ? value : atom(value)

  const token: BufferToken<T> = {
    [$TYPE]: 'buffer',
    get,
    set,
    subscribe,
    __: {
      bind: (program) => {
        __.bind(program)
        return token
      },
      update: (program) => {
        const buffer = program.virtualProgram.registerBuffer(get(), options)

        if (!cache.has(program)) {
          cache.set(program, new Map())
        }
        const cached = cache.get(program)!

        if (cached.get(options.target) !== buffer.value) {
          // NOTE: maybe we can prevent having to do unnecessary binds here?
          program.gl.ctx.bindBuffer(program.gl.ctx[options.target], buffer.value)
          cached.set(options.target, buffer.value)
        }

        if (buffer.dirty) {
          program.gl.ctx.bufferData(program.gl.ctx[options.target], get(), program.gl.ctx[options.usage])
          buffer.dirty = false
        }

        //return token
      },
    },
  }

  return token
}
