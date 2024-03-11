import { mat4, vec3 } from 'gl-matrix'

import { GL, Program, ShaderToken, attribute, createGL, glsl, isShader, uniform } from '../core'

import { Atom, BufferToken, Token, atom, buffer, effect, isAtom, isBufferToken, isToken } from '../core/tokens'
import { Mat4, Vec3 } from '../core/types'
import { traverse } from './utils'

export interface Object3D {
  /** local matrix */
  matrix: Token<mat4>
  bind: (parent: Object3D | Scene) => Object3D
  unbind: () => void
  __: {
    children: Set<Object3D>
    parent: Scene | Object3D | undefined
    mount: () => void
    unmount: () => void
    matrix: Token<mat4>
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                       SCENE                                    */
/*                                                                                */
/**********************************************************************************/

const getScene = (object: Object3D | Scene): Scene | undefined => {
  if ('parent' in object.__) {
    if (object.__.parent) return getScene(object.__.parent)
  } else {
    return object as Scene
  }
}

type Scene = GL & {
  camera: Token<mat4>
  matrix: Token<mat4>
  perspective: Token<mat4>
  stack: Atom<Program[]>
  __: {
    children: Set<Object3D>
    matrix: Token<mat4>
  }
}

export const createScene = (canvas = document.createElement('canvas')) => {
  const getPerspective = () =>
    mat4.perspective(mat4.create(), Math.PI / 2, canvas.clientWidth / canvas.clientHeight, 0, Infinity)

  const gl = createGL(canvas)

  const camera = uniform.mat4(mat4.create())
  const matrix = uniform.mat4(mat4.create())
  const perspective = uniform.mat4(getPerspective())

  gl.onResize(() => perspective.set(getPerspective()))

  const stack = atom<Program[]>([])

  gl.setStack(stack.get())
  stack.subscribe(() => gl.requestRender())

  const scene: Scene = {
    ...gl,
    stack,
    camera,
    matrix,
    perspective,
    __: {
      children: new Set(),
      matrix,
    },
  }

  return scene
}

/**********************************************************************************/
/*                                                                                */
/*                                       SHAPE                                    */
/*                                                                                */
/**********************************************************************************/

type ShapeOptionsShader =
  | ShaderToken
  | ((props: {
      camera: Token<Mat4>
      color: Token<Vec3>
      matrix: Token<Mat4>
      perspective: Token<Mat4>
      uv: Token<Float32Array>
      vertices: Token<Float32Array>
    }) => ShaderToken)

type ShapeOptionsBase = {
  matrix: Mat4 | Token<Mat4> | Atom<Mat4>
  color: Vec3 | Atom<Vec3>
  vertices: Float32Array | Token<Float32Array> | Atom<Float32Array>
  uv: Float32Array | Token<Float32Array> | Atom<Float32Array>
  vertex?: ShapeOptionsShader
  fragment?: ShapeOptionsShader
}

type ShapeOptionsCount = ShapeOptionsBase & {
  count: number | Atom<number>
  indices?: never
}
type ShapeOptionsIndices = ShapeOptionsBase & {
  indices: number[] | BufferToken<Uint16Array> | Atom<Uint16Array>
  count?: never
}
export type ShapeOptions = ShapeOptionsCount | ShapeOptionsIndices

export interface Shape extends Object3D {
  bind: (parent: Object3D | Scene) => Shape
  color: Token<Vec3>
  vertices: Token<Float32Array>
  matrix: Token<Mat4>
  uv: Token<Float32Array>
}

export const createShape = <TOptions extends ShapeOptions>(
  options: TOptions
): TOptions['indices'] extends never ? Shape : Shape & { indices: BufferToken<Uint16Array> } => {
  const color = uniform.vec3(options.color)
  const vertices = isToken(options.vertices) ? options.vertices : attribute.vec3(options.vertices)
  const uv = isToken(options.uv) ? options.uv : attribute.vec2(options.uv)

  const matrix = uniform.mat4(mat4.clone('get' in options.matrix ? options.matrix.get() : options.matrix))
  const localMatrix = isToken(options.matrix) ? options.matrix : uniform.mat4(options.matrix)

  let shouldUpdateMatrix = true

  const onBeforeDrawHandler = () => {
    if (!shouldUpdateMatrix) return
    const parentMatrix = shape.__.parent?.__.matrix
    if (parentMatrix) {
      matrix.set((matrix, { preventRender }) => {
        preventRender()
        return mat4.multiply(matrix, parentMatrix.get(), localMatrix.get())
      })
    }
    shouldUpdateMatrix = false
  }
  const dirtyMatrix = () => {
    if (shouldUpdateMatrix) return
    shouldUpdateMatrix = true
    matrix.__.requestRender()
  }
  localMatrix.subscribe(dirtyMatrix)

  const indicesBuffer = options.indices
    ? isBufferToken(options.indices)
      ? options.indices
      : buffer(isAtom(options.indices) ? options.indices : new Uint16Array(options.indices), {
          target: 'ELEMENT_ARRAY_BUFFER',
          usage: 'STATIC_DRAW',
        })
    : undefined

  const cache = new Map<Scene, Program>()
  const createProgram = (scene: Scene) => {
    const cached = cache.get(scene)
    if (cached) return cached

    const { camera, perspective, createProgram } = scene

    const vertex = isShader(options.vertex)
      ? options.vertex
      : typeof options.vertex === 'function'
      ? options.vertex({ camera, perspective, color, vertices, matrix, uv })
      : glsl`#version 300 es
          precision highp float;
          void main(void) {
            gl_Position = ${perspective} * ${camera} * ${matrix} * vec4(${vertices} * 0.1, 1);
            gl_PointSize = 5.;
          }`

    const fragment = isShader(options.fragment)
      ? options.fragment
      : typeof options.fragment === 'function'
      ? options.fragment({ camera, perspective, color, vertices, matrix, uv })
      : glsl`#version 300 es
          precision highp float;
          out vec4 color;
          void main(void) {
            color = vec4(${color}, 1.);
          }`

    const programOptions = indicesBuffer
      ? { vertex, fragment, indices: indicesBuffer }
      : { vertex, fragment, count: options.count! }

    const program = createProgram(programOptions)
    program.onBeforeDraw(onBeforeDrawHandler)
    cache.set(scene, program)

    return program
  }

  const current: {
    cleanup: (() => void) | undefined
    program: Program | undefined
    scene: Scene | undefined
  } = {
    cleanup: undefined,
    program: undefined,
    scene: undefined,
  }

  const shape: Shape = {
    color,
    matrix: localMatrix,
    vertices,
    uv,
    bind: (parent) => {
      parent.__.children.add(shape)
      shape.__.parent = parent
      current.cleanup = parent.__.matrix.subscribe(dirtyMatrix)
      traverse(shape, (object3D) => object3D.__.mount())
      return shape
    },
    unbind: () => {
      shape.__.unmount()
      traverse(shape, (object3D) => object3D.__.unmount())

      shape.__.parent?.__.children.delete(shape)
      shape.__.parent = undefined

      if (current.cleanup) {
        current.cleanup()
      }

      current.scene = undefined
      current.cleanup = undefined
      current.program = undefined
    },
    __: {
      children: new Set(),
      parent: undefined,
      matrix,
      mount: () => {
        if (!shape.__.parent) return
        current.scene = getScene(shape.__.parent)
        if (!current.scene) return
        const currentProgram = createProgram(current.scene)
        current.program = currentProgram

        current.scene.stack.set((stack) => {
          stack.push(currentProgram)
          return stack
        })
      },
      unmount: () => {
        if (!shape.__.parent) return
        current.scene = getScene(shape.__.parent)
        if (!current.scene) return
        const currentProgram = current.program
        if (!currentProgram) return
        current.scene.stack.set((stack, flags) => {
          const index = stack.findIndex((program) => program === currentProgram)
          if (index !== -1) {
            stack.splice(index, 1)
          } else {
            flags.preventRender()
            flags.preventNotification()
          }
          return stack
        })
      },
    },
  }

  if (options.indices) {
    return {
      ...shape,
      indices: indicesBuffer!,
    } as Shape & { indices: BufferToken<Uint16Array> }
  }
  // @ts-expect-error
  return shape
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

/**********************************************************************************/
/*                                                                                */
/*                                        CUBE                                    */
/*                                                                                */
/**********************************************************************************/

// prettier-ignore
const _cube = {
  vertices: new Float32Array([
    // Front face
    -0.5, -0.5,  0.5,    0.5, -0.5,  0.5,    0.5,  0.5,  0.5,   -0.5,  0.5,  0.5,
    // Back face
    -0.5, -0.5, -0.5,   -0.5,  0.5, -0.5,    0.5,  0.5, -0.5,    0.5, -0.5, -0.5,
    // Top face
    -0.5,  0.5, -0.5,   -0.5,  0.5,  0.5,    0.5,  0.5,  0.5,    0.5,  0.5, -0.5,
    // Bottom face
    -0.5, -0.5, -0.5,    0.5, -0.5, -0.5,    0.5, -0.5,  0.5,   -0.5, -0.5,  0.5,
    // Right face
    0.5, -0.5, -0.5,    0.5,  0.5,  -0.5,    0.5,  0.5,  0.5,    0.5, -0.5,  0.5,
    // Left face
    -0.5, -0.5, -0.5,   -0.5, -0.5,  0.5,   -0.5,  0.5,  0.5,   -0.5,  0.5, -0.5,
  ]),
  uv: new Float32Array([
    // Front face
    0.0, 1.0,  // Vertex 0
    1.0, 1.0,  // Vertex 1
    1.0, 0.0,  // Vertex 2
    0.0, 0.0,  // Vertex 3
    // Back face
    0.0, 1.0,  // Vertex 4
    1.0, 1.0,  // Vertex 5
    1.0, 0.0,  // Vertex 6
    0.0, 0.0,  // Vertex 7
    // Top face
    0.0, 1.0,  // Vertex 8
    1.0, 1.0,  // Vertex 9
    1.0, 0.0,  // Vertex 10
    0.0, 0.0,  // Vertex 11
    // Bottom face
    0.0, 1.0,  // Vertex 12
    1.0, 1.0,  // Vertex 13
    1.0, 0.0,  // Vertex 14
    0.0, 0.0,  // Vertex 15
    // Right face
    0.0, 1.0,  // Vertex 16
    1.0, 1.0,  // Vertex 17
    1.0, 0.0,  // Vertex 18
    0.0, 0.0,  // Vertex 19
    // Left face
    0.0, 1.0,  // Vertex 20
    1.0, 1.0,  // Vertex 21
    1.0, 0.0,  // Vertex 22
    0.0, 0.0   // Vertex 23
  ]),
  indices:  [
    // Front face
    0,   1,  2,  0,  2,  3,
    // Back face
    4,   5,  6,  4,  6,  7,
    // Top face
    8,   9, 10,  8, 10, 11,
    // Bottom face
    12, 13, 14, 12, 14, 15,
    // Right face
    16, 17, 18, 16, 18, 19,
    // Left face
    20, 21, 22, 20, 22, 23,
  ],
}
export const createCube = (options: Omit<ShapeOptions, 'vertices' | 'indices' | 'uv' | 'count'>) =>
  createShape({
    ...options,
    ..._cube,
  })

/**********************************************************************************/
/*                                                                                */
/*                                       DISC                                     */
/*                                                                                */
/**********************************************************************************/

export const createDisc = (
  options: Omit<ShapeOptions, 'vertices' | 'indices' | 'uv'> & {
    radius: number
    segments: number
  }
) => {
  const radius = atom(options.radius)
  const segments = atom(options.segments)

  const vertices = atom(new Float32Array())
  const uv = atom(new Float32Array())
  const indices = atom(new Uint16Array())

  const update = () => {
    const size = segments.get() + 1

    vertices.set(() => {
      const vertices = new Float32Array(size * 3)

      for (let index = 0; index <= vertices.length; index = index + 3) {
        const vertex = vertices.subarray(index, index + 2)
        if (index === 0) {
          vec3.set(vertex, 0, 0, 0)
          continue
        }
        const ratio = (index / 3 - 1) / segments.get()
        vec3.set(vertex, Math.sin(ratio * Math.PI * 2) * radius.get(), Math.cos(ratio * Math.PI * 2) * radius.get(), 0)
      }

      uv.set(vertices)

      return vertices
    })

    indices.set(() => {
      const indices: number[] = []
      for (let i = 1; i < size; i++) {
        if (i + 1 === size) {
          indices.push(i, 1, 0)
        } else {
          indices.push(i, i + 1, 0)
        }
      }

      return new Uint16Array(indices)
    })
  }

  effect(update, [radius, segments])

  const shape = createShape({
    vertices,
    uv,
    indices,
    matrix: options.matrix,
    color: options.color,
  })

  return {
    ...shape,
    radius,
    segments,
  }
}
