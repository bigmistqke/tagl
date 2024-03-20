import { mat4, vec3 } from 'gl-matrix'
import { $TYPE } from '.'
import { Atom } from './atom'
import { BufferToken, Token } from './tokens'
import { Accessor } from './types'

/**********************************************************************************/
/*                                        LOG                                     */
/**********************************************************************************/
const DEBUG = false

export const log = (...args: any) => {
  if (!DEBUG) return
  console.info(...args)
}

/**********************************************************************************/
/*                      IS-TOKEN / IS-BUFFER-TOKEN / IS-ATOM                      */
/**********************************************************************************/

type InferAtomType<T, TKey extends keyof AtomTypes<any>> = T extends { get: infer TAccessor }
  ? TAccessor extends Accessor<infer TValue>
    ? AtomTypes<TValue>[TKey]
    : AtomTypes[TKey]
  : AtomTypes[TKey]

type AtomTypes<T = any> = {
  atom: Atom<T>
  bufferToken: BufferToken<T>
  token: Token<T>
}

//@ts-expect-error
export const isToken = <T>(value: T): value is InferAtomType<T, 'token'> =>
  typeof value === 'object' && value !== null && $TYPE in value && value[$TYPE] === 'token'

//@ts-expect-error
export const isBufferToken = <T>(value: T): value is InferAtomType<T, 'bufferToken'> =>
  typeof value === 'object' && value !== null && $TYPE in value && value[$TYPE] === 'buffer'

//@ts-expect-error
export const isAtom = <T>(value: T): value is InferAtomType<T, 'atom'> => value instanceof Atom
/**********************************************************************************/
/*                                       WEBGL                                    */
/**********************************************************************************/

export function createWebGLProgram(gl: WebGLRenderingContext, vertex: string, fragment: string) {
  const program = gl.createProgram()

  var vertexShader = createWebGLShader(gl, vertex, 'vertex')
  var fragmentShader = createWebGLShader(gl, fragment, 'fragment')

  if (!program || !vertexShader || !fragmentShader) throw 'program undefined'

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)

  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('error while creating program', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    throw gl.getProgramInfoLog(program)
  }

  return program
}
function createWebGLShader(gl: WebGLRenderingContext, src: string, type: 'vertex' | 'fragment') {
  const shader = gl.createShader(type === 'fragment' ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER)

  /* cration shader failed */
  if (!shader) {
    console.error(type, `error while creating shader`)
    return null
  }

  gl.shaderSource(shader, src)
  gl.compileShader(shader)

  /* compilation shader failed */
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(type, gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }

  return shader
}

/**********************************************************************************/
/*                               CREATE INSTANTIATOR                              */
/**********************************************************************************/

export const createInstantiator =
  <TKey extends object>() =>
  <TReturnValue>(value: new (key: TKey) => TReturnValue) => {
    const cacheMap = new WeakMap<TKey, TReturnValue>()
    return (key: TKey) => {
      const cachedRegistry = cacheMap.get(key)
      if (cachedRegistry) return cachedRegistry
      const newRegistry = new value(key)
      cacheMap.set(key, newRegistry)
      return newRegistry as TReturnValue
    }
  }

/**********************************************************************************/
/*                                        MISC                                    */
/**********************************************************************************/

export const dataTypeToSize = (dataType: string) => {
  if (dataType.includes('vec')) {
    return +dataType.slice(-1)
  }
  if (dataType.includes('mat')) {
    return Math.pow(+dataType.slice(-1), 2)
  }
  return 1
}

export const uniformDataTypeToFunctionName = (dataType: string) => {
  switch (dataType) {
    case 'float':
      return 'uniform1f'
    case 'int':
    case 'bool':
      return 'uniform1i'
    default:
      // 2 | 3 | 4
      const count = dataType[dataType.length - 1] as any as 2 | 3 | 4
      if (dataType.includes('mat')) return `uniformMatrix${count}fv`
      //  i | f
      const type = dataType[0] === 'b' || dataType[0] === 'i' ? 'i' : 'f'
      return `uniform${count}${type}v`
  }
}

export const getTranslationFromMatrix = (scratch: vec3, matrix: mat4) =>
  vec3.set(
    scratch,
    matrix[12], // x translation
    matrix[13], // y translation
    matrix[14] // z translation
  )
