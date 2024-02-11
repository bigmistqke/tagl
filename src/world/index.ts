import { mat4 } from 'gl-matrix'

import { DequeMap, GL, Program, ShaderToken, attribute, createGL, glsl, isShader, uniform } from '../core'
import { Setter, Token } from '../core/types'

/**********************************************************************************/
/*                                                                                */
/*                                      CONTEXT                                   */
/*                                                                                */
/**********************************************************************************/

const createContext = <TContext>(_context?: TContext) => {
  let context = _context
  return {
    execute: <T>(_context: TContext, callback: () => T): T => {
      context = _context
      const result = callback()
      context = undefined
      return result
    },
    use: () => {
      if (!context) throw 'context is undefined!'
      return context
    },
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                      CONTEXT                                   */
/*                                                                                */
/**********************************************************************************/

let context = createContext<ContextApi>()
const useContext = context.use

type ContextApi = {
  gl: GL
  camera: Token<Float32Array>
  perspective: Token<Float32Array>
  matrix: Token<Float32Array>
}

/**********************************************************************************/
/*                                                                                */
/*                                       GROUP                                    */
/*                                                                                */
/**********************************************************************************/

export type Group = {
  add: (object3D: Object3D) => void
  children: DequeMap<Object3D, Program>
  draw: () => void
  flag: () => void
  matrix: Setter<Float32Array>
  needsUpdate: boolean
  remove: (object3D: Object3D) => void
  update: () => void
}
export type Object3D = Group & {
  program: () => Program
}
export const createGroup = (options?: { matrix: Float32Array; children?: any[] }) => {
  const parent = useContext()
  const children = new DequeMap<Object3D, Program>()

  let _matrix = options?.matrix || new Float32Array()
  const matrix = uniform.mat4(mat4.add(_matrix, _matrix, parent.matrix.value) as Float32Array)

  const api = {
    ...parent,
    matrix,
  }

  const group: Group = {
    add: (object3D: Object3D) => {
      context.execute(api, () => children.push(object3D, object3D.program()))
      api.gl.requestRender()
    },
    children,
    draw: () => children.forEach((child) => child.key.draw()),
    flag: () => {
      if (group.needsUpdate) return
      group.needsUpdate = true
      children.forEach((child) => child.key.flag())
    },
    matrix: (value) => {
      if (typeof value === 'function') {
        _matrix = value(_matrix)
      } else {
        _matrix = value
      }
      group.update()
    },
    needsUpdate: false,
    update: () => {
      matrix.set(mat4.add(_matrix, _matrix, parent.matrix.value) as Float32Array)
      children.forEach((child) => child.key.update())
    },
    remove: (object3D: Object3D) => {
      children.remove(object3D)
      api.gl.requestRender()
    },
  }

  return group
}

/**********************************************************************************/
/*                                                                                */
/*                                       SCENE                                    */
/*                                                                                */
/**********************************************************************************/

export const createScene = (canvas = document.createElement('canvas')) => {
  const getPerspective = () =>
    mat4.perspective(mat4.create(), Math.PI / 2, canvas.clientWidth / canvas.clientHeight, 0, Infinity) as Float32Array

  const gl = createGL(canvas)

  const camera = uniform.mat4(mat4.create() as Float32Array)
  const matrix = uniform.mat4(mat4.create() as Float32Array)
  const perspective = uniform.mat4(getPerspective())

  new ResizeObserver(() => {
    perspective.set(getPerspective())
    gl.requestRender()
  }).observe(canvas as HTMLCanvasElement)

  const api: ContextApi = {
    gl,
    camera,
    perspective,
    matrix,
  }

  const group = context.execute(api, () => createGroup())
  gl.setStack(group.children)

  return {
    add: group.add,
    remove: group.remove,
    camera: camera.set,
    canvas,
    ...gl,
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                       SHAPE                                    */
/*                                                                                */
/**********************************************************************************/

type ShapeOptionsShader =
  | ShaderToken
  | ((props: {
      camera: Token<Float32Array>
      color: Token<Float32Array>
      matrix: Token<Float32Array>
      perspective: Token<Float32Array>
      uv: Token<Float32Array>
      vertices: Token<Float32Array>
    }) => ShaderToken)

type ShapeOptionsBase = {
  matrix: Float32Array
  color: Float32Array
  vertices: Float32Array
  uv: Float32Array
  vertex?: ShapeOptionsShader
  fragment?: ShapeOptionsShader
}

type ShapeOptionsCount = ShapeOptionsBase & {
  count: number
  indices?: never
}
type ShapeOptionsIndices = ShapeOptionsBase & {
  indices: number[]
  count?: never
}
export type ShapeOptions = ShapeOptionsCount | ShapeOptionsIndices

export type Shape = Object3D & {
  color: Token<Float32Array>
  vertices: Token<Float32Array>
  matrix: Token<Float32Array>
  uv: Token<Float32Array>
}

export const createShape = (options: ShapeOptions): Shape => {
  const color = uniform.vec3(options.color)
  const matrix = uniform.mat4(options.matrix)
  const vertices = attribute.vec3(options.vertices)
  const uv = attribute.vec2(options.uv)

  return {
    matrix,
    color,
    vertices,
    uv,
    program: () => {
      const { camera, perspective, gl } = useContext()

      const vertex = isShader(options.vertex)
        ? options.vertex
        : typeof options.vertex === 'function'
        ? options.vertex({ camera, perspective, color, vertices, matrix, uv })
        : glsl`#version 300 es
            precision highp float;
            out vec2 uv;  
            void main(void) {
              uv = ${uv};
              gl_Position = ${perspective} * ${camera} * ${matrix} *vec4(${vertices} * 0.1, 1);
              gl_PointSize = 5.;
            }`

      const fragment = isShader(options.fragment)
        ? options.fragment
        : typeof options.fragment === 'function'
        ? options.fragment({ camera, perspective, color, vertices, matrix, uv })
        : glsl`#version 300 es
            precision highp float;
            out vec4 color;
            in vec2 uv;
            void main(void) {
              color = vec4(${color}, 1.);
            }`

      return gl.createProgram(
        options.count ? { vertex, fragment, count: options.count } : { vertex, fragment, indices: options.indices! }
      )
    },
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                       PLANE                                    */
/*                                                                                */
/**********************************************************************************/

const _plane = {
  vertices: new Float32Array([-0.5, -0.5, 0.0, 0.5, -0.5, 0.0, -0.5, 0.5, 0.0, 0.5, 0.5, 0.0]),
  uv: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
  indices: [0, 1, 2, 3, 2, 1],
}
export const createPlane = (options: Omit<ShapeOptions, 'vertices' | 'indices' | 'uv' | 'count'>) =>
  createShape({
    ...options,
    ..._plane,
  })
