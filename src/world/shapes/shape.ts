import { mat4, vec3 } from 'gl-matrix'

import { Program, ShaderToken, attribute, glsl, isShader, uniform } from '@tagl/core'
import { Atom } from '@tagl/core/atom'
import { Attribute, Buffer, Uniform, buffer } from '@tagl/core/tokens'
import { Token } from '@tagl/core/tokens/token'
import { Mat4, RenderMode, Vec3 } from '@tagl/core/types'
import { Scene } from '@tagl/world'
import { Node3D, Origin3D } from '@tagl/world/scene-graph'

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

export class Shape {
  cache = new Map<Scene, Program>()

  /** local matrix */
  matrix: Token<mat4>
  mode: Atom<RenderMode>
  color: Uniform<vec3>
  vertices: Attribute<Float32Array>
  uv: Attribute<Float32Array>
  count: Atom<number> | undefined
  indices: Buffer<Uint16Array> | undefined
  node: Node3D
  program: any

  constructor(private options: ShapeOptions) {
    this.color = uniform.vec3(options.color)
    this.vertices = options.vertices instanceof Token ? options.vertices : attribute.vec3(options.vertices)
    this.uv = options.uv instanceof Token ? options.uv : attribute.vec2(options.uv)
    this.matrix = options.matrix instanceof Token ? options.matrix : uniform.mat4(options.matrix)

    this.mode = options.mode instanceof Atom ? options.mode : new Atom(options.mode || 'TRIANGLES')

    this.count =
      options.count instanceof Atom ? options.count : options.count !== undefined ? new Atom(options.count) : undefined

    this.indices =
      options.indices !== undefined
        ? options.indices instanceof Token
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

  private _mount(origin: Origin3D | undefined) {
    if (!origin) return

    const scene = origin.scene

    const cached = this.program
    if (cached) {
      this.program = cached
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
      ? { mode: this.mode, vertex, fragment, indices: this.indices }
      : { mode: this.mode, vertex, fragment, count: this.options.count! }

    const program = (this.program = scene.createProgram(programOptions))

    scene.stack.set((stack) => {
      stack.push(program)
      return stack
    })
  }

  private _cleanup(origin: Origin3D | undefined) {
    if (!origin) return

    const scene = origin.scene

    scene.stack.set((stack, flags) => {
      const index = stack.findIndex((program) => program === this.program)
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
