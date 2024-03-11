import { GL } from '.'
import { ReferenceCount } from './data-structures/reference-count'
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
import { dataTypeToSize, uniformDataTypeToFunctionName } from './utils'
import { VirtualProgram } from './virtualization/virtual-program'

/**********************************************************************************/
/*                                                                                */
/*                                    CONSTANTS                                   */
/*                                                                                */
/**********************************************************************************/

export const $TYPE = Symbol('atom')

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
  subscribe: (callback: (value: T) => void) => () => void
  __: {
    bind: (options: { gl: GL; virtualProgram: VirtualProgram; location: TLocation }) => Token<T, TLocation>
    requestRender: () => void
    getLocation: (options: { gl: GL; program: WebGLProgram; name: string }) => TLocation
    notify: () => void
    subscriptions: ReferenceCount<(value: T) => void>
    template: (name: string) => string | undefined
    update: (options: { gl: GL; virtualProgram: VirtualProgram; location: TLocation }) => void
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                       ATOM                                     */
/*                                                                                */
/**********************************************************************************/

export type Atom<T = any> = {
  [$TYPE]: 'atom'
  set: Setter<T>
  get: Accessor<T>
  subscribe: (callback: (value: T) => void) => () => void
  __: {
    bind: (options: { gl: GL; virtualProgram: VirtualProgram }, callback?: () => false | void) => void
    requestRender: () => void
    notify: () => void
  }
}

export const atom = <T>(value: T) => {
  const cache = new Set<GL>()

  let shouldNotify = true
  let shouldRender = true
  const config = {
    preventNotification: () => (shouldNotify = false),
    preventRender: () => (shouldRender = false),
  }

  const subscriptions = new ReferenceCount<(value: T) => void>()
  const bindings = new ReferenceCount<() => void>()
  const requestRender = () => bindings.forEach((callback) => callback())
  const notify = () => subscriptions.forEach((callback) => callback(value))

  const atom: Atom<T> = {
    [$TYPE]: 'atom',
    get: () => value,
    set: (_value) => {
      if (typeof _value === 'function') {
        // @ts-expect-error
        value = _value(value, config)
      } else {
        value = _value
      }
      if (shouldNotify) notify()
      if (shouldRender) requestRender()
      shouldNotify = true
      shouldRender = true
    },
    subscribe: (callback: (value: T) => void) => {
      subscriptions.add(callback)
      return () => subscriptions.delete(callback)
    },
    __: {
      bind: ({ gl }, callback) => {
        if (cache.has(gl)) return
        cache.add(gl)
        bindings.add(() => callback?.() !== false && !gl.isPending && gl.requestRender())
      },
      requestRender,
      notify,
    },
  }

  return atom
}

/**********************************************************************************/
/*                                                                                */
/*                                   SUBSCRIBE                                    */
/*                                                                                */
/**********************************************************************************/

export const effect = (callback: () => void, dependencies: (Atom | Token | BufferToken)[]) => {
  const cleanups = dependencies.map((dependency) => dependency.subscribe(callback))
  callback()
  return () => cleanups.forEach((cleanup) => cleanup())
}

/**********************************************************************************/
/*                                                                                */
/*                                    UNIFORM                                     */
/*                                                                                */
/**********************************************************************************/

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
      const { __, get, subscribe, set } = isAtom(value) ? value : atom<any>(value)

      const token: Token<Exclude<typeof value, Atom>> = {
        [$TYPE]: 'token',
        get,
        set,
        subscribe,
        __: {
          requestRender: __.requestRender,
          subscriptions: __.subscriptions,
          notify: __.notify,
          bind: (options) => {
            const uniform = options.virtualProgram.registerUniform(options.location, get)
            __.bind(options, () => {
              if (uniform.dirty) return false
              uniform.dirty = true
            })
            return token
          },
          template: (name: string) => `uniform ${type} ${name};`,
          getLocation: ({ gl, program, name }) => gl.ctx.getUniformLocation(program, name)!,
          update: ({ gl, virtualProgram, location }) => {
            const uniform = virtualProgram.registerUniform(location, get)

            if (uniform.value === get() && !uniform.dirty) {
              return
            }

            uniform.dirty = false
            uniform.value = get()

            if (type.includes('mat')) {
              // @ts-expect-error
              gl.ctx[functionName](location, false, get())
            } else {
              // @ts-expect-error
              gl.ctx[functionName](location, get())
            }
          },
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
      const size = dataTypeToSize(type)

      const { get, set, subscribe, __ } = isAtom(value) ? value : atom<any>(value)

      const token: Token<Exclude<typeof value, Atom>> = {
        [$TYPE]: 'token',
        get,
        set,
        subscribe,
        __: {
          bind: (options) => {
            __.bind(options, () => {
              options.virtualProgram.dirtyAttribute(options.location as number)
            })
            return token
          },
          update: ({ gl, virtualProgram, location }) => {
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
          getLocation: ({ gl, program, name }) => gl.ctx.getAttribLocation(program, name)!,
        },
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

export type BufferToken<T = Float32Array> = {
  [$TYPE]: 'buffer'
  set: Setter<T>
  get: Accessor<T>
  subscribe: (callback: (value: T) => void) => () => void
  __: {
    bind: (options: { gl: GL; virtualProgram: VirtualProgram }) => BufferToken<T>
    update: (options: { gl: GL; virtualProgram: VirtualProgram }) => BufferToken<T>
  }
}

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
      bind: (options) => {
        __.bind(options)
        return token
      },
      update: ({ gl, virtualProgram }) => {
        const buffer = virtualProgram.registerBuffer(get(), options)

        // NOTE: maybe we can prevent having to do unnecessary binds here?
        gl.ctx.bindBuffer(gl.ctx[options.target], buffer.value)
        if (buffer.dirty) {
          gl.ctx.bufferData(gl.ctx[options.target], get(), gl.ctx[options.usage])
          buffer.dirty = false
        }

        return token
      },
    },
  }

  return token
}

/**********************************************************************************/
/*                                                                                */
/*                                       UTILS                                    */
/*                                                                                */
/**********************************************************************************/

type Infer<T, TKey extends keyof AtomTypes<any>> = T extends { get: infer TAccessor }
  ? TAccessor extends Accessor<infer TValue>
    ? AtomTypes<TValue>[TKey]
    : AtomTypes[TKey]
  : AtomTypes[TKey]

type AtomTypes<T = any> = {
  atom: Atom<T>
  bufferToken: BufferToken<T>
  token: Token<T>
}

export const isToken = <T>(value: T): value is Infer<T, 'token'> =>
  typeof value === 'object' && value !== null && $TYPE in value && value[$TYPE] === 'token'
export const isBufferToken = <T>(value: T): value is Infer<T, 'bufferToken'> =>
  typeof value === 'object' && value !== null && $TYPE in value && value[$TYPE] === 'buffer'
export const isAtom = <T>(value: T): value is Infer<T, 'atom'> =>
  typeof value === 'object' && value !== null && $TYPE in value && value[$TYPE] === 'atm'
