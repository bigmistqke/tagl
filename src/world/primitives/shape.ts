import { vec3 } from 'gl-matrix'

import {
  Atom,
  Attribute,
  Buffer,
  Program,
  ShaderToken,
  Token,
  Uniform,
  atomize,
  attribute,
  buffer,
  glsl,
  isShader,
  uniform,
} from '@tagl/core'
import { Mat4, RenderMode, Vec3 } from '@tagl/core/types'
import { Scene } from '@tagl/world'
import { Node3D } from '@tagl/world/primitives/node-3d'

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
  matrix: Mat4 | Uniform<Mat4> | Atom<Mat4>
  color: Vec3 | Atom<Vec3>
  vertices: Float32Array | Attribute<Float32Array> | Atom<Float32Array>
  uv: Float32Array | Attribute<Float32Array> | Atom<Float32Array>
  vertex?: ShapeOptionsShader
  fragment?: ShapeOptionsShader
  mode?: RenderMode | Atom<RenderMode>
}

type ShapeOptionsCount = ShapeOptionsBase & {
  count: number | Atom<number>
  indices?: never
}
type ShapeOptionsIndices = ShapeOptionsBase & {
  indices: Uint16Array | Buffer<Uint16Array> | Atom<Uint16Array>
  count?: never
}
export type ShapeOptions = ShapeOptionsCount | ShapeOptionsIndices

export class Shape extends Node3D {
  cache = new Map<Scene, Program>()

  mode: Atom<RenderMode>
  color: Uniform<vec3>
  vertices: Attribute<Float32Array>
  uv: Attribute<Float32Array>
  count: Atom<number> | undefined
  indices: Buffer<Uint16Array> | undefined
  program: any

  constructor(private shapeOptions: ShapeOptions) {
    const matrix =
      shapeOptions.matrix instanceof Token ? shapeOptions.matrix : uniform.mat4(shapeOptions.matrix)

    super(matrix)

    this.color = uniform.vec3(shapeOptions.color)
    this.vertices =
      shapeOptions.vertices instanceof Attribute
        ? shapeOptions.vertices
        : attribute.vec3(shapeOptions.vertices)
    this.uv =
      shapeOptions.uv instanceof Attribute ? shapeOptions.uv : attribute.vec2(shapeOptions.uv)

    this.mode = atomize(shapeOptions.mode || 'TRIANGLES')
    this.count = shapeOptions.count !== undefined ? atomize(shapeOptions.count) : undefined

    this.indices =
      shapeOptions.indices !== undefined
        ? shapeOptions.indices instanceof Buffer
          ? shapeOptions.indices
          : buffer(shapeOptions.indices, {
              target: 'ELEMENT_ARRAY_BUFFER',
              usage: 'STATIC_DRAW',
            })
        : undefined

    this.onMount(this._mount.bind(this))
    this.onCleanup(this._cleanup.bind(this))
  }

  private _mount(scene: Scene | undefined) {
    if (!scene) return

    const cached = this.program
    if (cached) {
      this.program = cached
      scene.stack.set((stack) => {
        stack.push(cached)
        return stack
      })
      return
    }

    const vertex = isShader(this.shapeOptions.vertex)
      ? this.shapeOptions.vertex
      : typeof this.shapeOptions.vertex === 'function'
      ? this.shapeOptions.vertex({
          camera: scene.camera,
          perspective: scene.perspective,
          color: this.color,
          vertices: this.vertices,
          matrix: this.worldMatrix,
          uv: this.uv,
        })
      : glsl`#version 300 es
        precision highp float;
        void main(void) {
          gl_Position = ${scene.perspective} * ${scene.camera} * ${this.worldMatrix} * vec4(${this.vertices} * 0.1, 1);
          gl_PointSize = 5.;
        }`

    const fragment = isShader(this.shapeOptions.fragment)
      ? this.shapeOptions.fragment
      : typeof this.shapeOptions.fragment === 'function'
      ? this.shapeOptions.fragment({
          camera: scene.camera,
          perspective: scene.perspective,
          color: this.color,
          vertices: this.vertices,
          matrix: this.worldMatrix,
          uv: this.uv,
        })
      : glsl`#version 300 es
        precision highp float;
        out vec4 color;
        void main(void) {
          color = vec4(${this.color}, 1.);
        }`

    const programOptions = this.indices
      ? { mode: this.mode, vertex, fragment, indices: this.indices }
      : { mode: this.mode, vertex, fragment, count: this.shapeOptions.count! }

    const program = (this.program = scene.createProgram(programOptions))

    scene.stack.set((stack) => {
      stack.push(program)
      return stack
    })
  }

  private _cleanup() {
    this.origin?.stack.set((stack) => {
      const index = stack.findIndex((program) => program === this.program)
      stack.splice(index, 1)
      return stack
    })
  }
}
