import { mat4, vec3 } from 'gl-matrix'

import { GL, Program, ShaderToken, attribute, glsl, isShader, uniform } from '../core'

import { Atom, BufferToken, Token, atom, buffer, effect, isAtom, isBufferToken, isToken } from '../core/tokens'
import { Mat4, Vec3 } from '../core/types'
import { traverseParent } from './utils'

/**********************************************************************************/
/*                                                                                */
/*                                    NODE3D                                      */
/*                                                                                */
/**********************************************************************************/

export class Node3D {
  localMatrix: Token<Mat4>
  dirty = true
  worldMatrix: Token<mat4>
  children: Node3D[] = []
  parent: Node3D | Origin3D | undefined = undefined

  origin: Origin3D | undefined

  private _onMountHandlers: (() => void)[] = []
  private _onCleanupHandlers: (() => void)[] = []
  private _onUpdateHandlers: (() => void)[] = []

  constructor(public object: Shape) {
    this.worldMatrix = uniform.mat4(mat4.clone(object.matrix.get()))
    this.worldMatrix.onBind((program) => {
      this.localMatrix.subscribe(() => program.gl.requestRender())
    })

    this.localMatrix = object.matrix
    this.localMatrix.subscribe(this._updateDirty.bind(this))
  }

  onMount(callback: () => void) {
    this._onMountHandlers.push(callback)
    return () => {
      console.error('TODO')
    }
  }
  onCleanup(callback: () => void) {
    this._onCleanupHandlers.push(callback)
    return () => {
      console.error('TODO')
    }
  }
  onUpdate(callback: () => void) {
    this._onUpdateHandlers.push(callback)
    return () => {
      console.error('TODO')
    }
  }

  bind(parent: Node3D | Origin3D) {
    parent.children.push(this)
    this.parent = parent

    const scene = traverseParent(this)

    this._traverseChildren((node) => node.mount(scene))

    if (this.dirty) {
      const scene = getScene(this.object)
      if (scene) {
        scene.node.nodesToUpdate.push(this)
        this._traverseChildren((node) => {
          if (node.dirty) return false
          node.dirty = true
          scene.node.nodesToUpdate.push(node)
        })
      }
    }
    return this
  }
  unbind() {
    this._traverseChildren((node) => node.cleanup())
    this.cleanup()
    if (this.parent) {
      this.parent.children.findIndex((child) => child === this)
    }

    this.parent = undefined
  }

  mount(origin: Origin3D | undefined) {
    this.origin = origin
    this._onMountHandlers.forEach((callback) => callback())
  }

  cleanup() {
    this.origin = undefined
    this._onCleanupHandlers.forEach((callback) => callback())
  }

  update() {
    this.worldMatrix.set((matrix) => mat4.multiply(matrix, this.parent!.worldMatrix.get(), this.localMatrix.get()))
    this._onUpdateHandlers.forEach((callback) => callback())
    this.dirty = false
  }

  private _updateDirty() {
    if (this.dirty) return

    this.dirty = true

    const origin = this.origin

    if (origin instanceof Origin3D) {
      origin.nodesToUpdate.push(this)
      this._traverseChildren((node) => {
        if (node.dirty) return false
        node.dirty = true
        origin.nodesToUpdate.push(node)
      })
    } else {
      this._traverseChildren((node) => {
        if (node.dirty) return false
        node.dirty = true
      })
    }
  }
  private _traverseChildren(callback: (object3D: Node3D) => false | void) {
    if (!callback(this)) return false
    if (this.children.find((child) => child._traverseChildren(callback) === false)) return false
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                    ORIGIN3D                                    */
/*                                                                                */
/**********************************************************************************/

export class Origin3D {
  children: Node3D[] = []
  nodesToUpdate: Node3D[] = []
  worldMatrix = atom(mat4.create())
  constructor(public scene: Scene) {}
  update(): void {
    this.nodesToUpdate.forEach((node) => {
      node.update()
    })
    this.nodesToUpdate.length = 0
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                       SCENE                                    */
/*                                                                                */
/**********************************************************************************/

const getScene = (object: Scene | Shape) => {
  let parentNode = traverseParent(object.node)
  return parentNode && 'scene' in parentNode ? parentNode.scene : undefined
}

export const createScene = (canvas = document.createElement('canvas')) => {
  return new Scene(canvas)
}

export class Scene extends GL {
  camera = uniform.mat4(mat4.create())
  node = new Origin3D(this)

  perspective: Token<mat4>

  constructor(public canvas: HTMLCanvasElement) {
    super(canvas)
    this.perspective = uniform.mat4(this._perspective())
    this.onResize(() => this.perspective.set(this._perspective))
    this.onBeforeRender(() => {
      this.node.update()
      return true
    })
  }

  private _perspective = (matrix?: mat4) =>
    mat4.perspective(
      matrix || mat4.create(),
      Math.PI / 2,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0,
      Infinity
    )
}

/**********************************************************************************/
/*                                                                                */
/*                                      SHAPE                                      */
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
  indices: Uint16Array | BufferToken<Uint16Array> | Atom<Uint16Array>
  count?: never
}
export type ShapeOptions = ShapeOptionsCount | ShapeOptionsIndices

export const createShape = <TOptions extends ShapeOptions>(options: TOptions) => {
  return new Shape(options)
}

export class Shape {
  cache = new Map<Scene, Program>()
  indices: BufferToken<Uint16Array> | undefined
  color: Token<Float32Array | [number, number, number], number | WebGLUniformLocation>
  vertices: Token<Float32Array, number | WebGLUniformLocation>
  uv: Token<Float32Array, number | WebGLUniformLocation>
  node: Node3D

  count: Atom<number> | Atom<number | undefined>

  /** local matrix */
  matrix: Token<mat4>

  private _program: Program | undefined = undefined

  constructor(private options: ShapeOptions) {
    this.color = uniform.vec3(options.color)
    this.vertices = isToken(options.vertices) ? options.vertices : attribute.vec3(options.vertices)
    this.uv = isToken(options.uv) ? options.uv : attribute.vec2(options.uv)
    this.matrix = isToken(options.matrix) ? options.matrix : uniform.mat4(options.matrix)

    this.count = isAtom(options.count) ? options.count : atom(options.count)
    this.indices = options.indices
      ? isBufferToken(options.indices)
        ? options.indices
        : buffer(options.indices, {
            target: 'ELEMENT_ARRAY_BUFFER',
            usage: 'STATIC_DRAW',
          })
      : undefined

    this.node = new Node3D(this)
    this.node.onMount(this._mount.bind(this))
    this.node.onCleanup(this._cleanup.bind(this))
  }

  bind(parent: Shape | Scene) {
    this.node.bind(parent.node)
    return this
  }
  unbind() {
    return this.node.unbind
  }

  private _mount() {
    const scene = getScene(this)

    if (!scene) return

    const cached = this._program
    if (cached) {
      this._program = cached
      scene.stack.set((stack) => {
        stack.push(cached)
        return stack
      })
      return
    }

    const vertex = isShader(this.options.vertex)
      ? this.options.vertex
      : typeof this.options.vertex === 'function'
      ? this.options.vertex({
          camera: scene.camera,
          perspective: scene.perspective,
          color: this.color,
          vertices: this.vertices,
          matrix: this.node.worldMatrix,
          uv: this.uv,
        })
      : glsl`#version 300 es
        precision highp float;
        void main(void) {
          gl_Position = ${scene.perspective} * ${scene.camera} * ${this.node.worldMatrix} * vec4(${this.vertices} * 0.1, 1);
          gl_PointSize = 5.;
        }`

    const fragment = isShader(this.options.fragment)
      ? this.options.fragment
      : typeof this.options.fragment === 'function'
      ? this.options.fragment({
          camera: scene.camera,
          perspective: scene.perspective,
          color: this.color,
          vertices: this.vertices,
          matrix: this.node.worldMatrix,
          uv: this.uv,
        })
      : glsl`#version 300 es
        precision highp float;
        out vec4 color;
        void main(void) {
          color = vec4(${this.color}, 1.);
        }`

    const programOptions = this.indices
      ? { vertex, fragment, indices: this.indices }
      : { vertex, fragment, count: this.options.count! }

    const program = (this._program = scene.createProgram(programOptions))

    scene.stack.set((stack) => {
      stack.push(program)
      return stack
    })
  }

  private _cleanup() {
    const scene = getScene(this)

    if (!scene || !this._program) return

    scene.stack.set((stack, flags) => {
      const index = stack.findIndex((program) => program === this._program)
      if (index !== -1) {
        stack.splice(index, 1)
      } else {
        flags.preventRender()
        flags.preventNotification()
      }
      return stack
    })
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
  indices: new Uint16Array([0, 1, 2, 3, 2, 1]),
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
  indices:  new Uint16Array([
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
  ]),
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

const cache = {
  vertices: [] as Float32Array[],
  indices: [] as Uint16Array[],
}

export class Disc {
  indices: Atom<Uint16Array>
  node: Node3D
  radius: Atom<number>
  segments: Atom<number>
  shape: Shape
  uv: Atom<Float32Array>
  vertices: Atom<Float32Array>
  matrix: Token<mat4>

  constructor(
    options: Omit<ShapeOptions, 'vertices' | 'indices' | 'uv'> & {
      radius: number
      segments: number
    }
  ) {
    this.radius = atom(options.radius)
    this.segments = atom(options.segments)

    this.vertices = atom(new Float32Array())
    this.uv = atom(new Float32Array())
    this.indices = atom(new Uint16Array())

    effect(this.update.bind(this), [this.radius, this.segments])

    this.shape = createShape({
      vertices: this.vertices,
      uv: this.uv,
      indices: this.indices,
      matrix: options.matrix,
      color: options.color,
    })
    this.node = this.shape.node
    this.matrix = this.shape.matrix
  }

  bind(object: Scene | Shape | { shape: Shape }) {
    this.shape.bind('shape' in object ? object.shape : object)
    return this
  }

  unbind() {
    this.shape.unbind()
  }

  update() {
    const size = this.segments.get() + 1

    this.vertices.set(() => {
      const cached = cache.vertices[this.segments.get()]
      if (cached) return cached

      const vertices = new Float32Array(size * 3)

      for (let index = 0; index <= vertices.length; index = index + 3) {
        const vertex = vertices.subarray(index, index + 2)
        if (index === 0) {
          vec3.set(vertex, 0, 0, 0)
          continue
        }
        const ratio = (index / 3 - 1) / this.segments.get()
        vec3.set(
          vertex,
          Math.sin(ratio * Math.PI * 2) * this.radius.get(),
          Math.cos(ratio * Math.PI * 2) * this.radius.get(),
          0
        )
      }

      this.uv.set(vertices)

      return (cache.vertices[this.segments.get()] = vertices)
    })

    this.indices.set(() => {
      const cached = cache.indices[this.segments.get()]
      if (cached) return cached

      const indices: number[] = []
      for (let i = 1; i < size; i++) {
        if (i + 1 === size) {
          indices.push(i, 1, 0)
        } else {
          indices.push(i, i + 1, 0)
        }
      }

      return (cache.indices[this.segments.get()] = new Uint16Array(indices))
    })
  }
}

export const createDisc = (
  options: Omit<ShapeOptions, 'vertices' | 'indices' | 'uv'> & {
    radius: number
    segments: number
  }
) => {
  return new Disc(options)
}
