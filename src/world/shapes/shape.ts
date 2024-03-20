import { mat4 } from 'gl-matrix'

import { ShaderToken, atom, attribute, glsl, isShader, uniform } from '@tagl/core'
import { Atom } from '@tagl/core/atom'
import { BufferToken, Token, buffer } from '@tagl/core/tokens'
import { Mat4, RenderMode, Vec3 } from '@tagl/core/types'
import { isAtom, isBufferToken, isToken } from '@tagl/core/utils'
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
  matrix: Mat4 | Token<Mat4> | Atom<Mat4>
  color: Vec3 | Atom<Vec3>
  vertices: Float32Array | Token<Float32Array> | Atom<Float32Array>
  uv: Float32Array | Token<Float32Array> | Atom<Float32Array>
  vertex?: ShapeOptionsShader
  fragment?: ShapeOptionsShader
  mode?: RenderMode | Atom<RenderMode>
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

export class Shape<TData extends Record<string, any> = {}> {
  cache = new Map<Scene, Program>()
  color: Token<Float32Array | [number, number, number], number | WebGLUniformLocation>
  count: Atom<number> | Atom<number | undefined>
  data: Partial<TData> = {}
  indices: BufferToken<Uint16Array> | undefined
  node: Node3D
  program: Program | undefined = undefined
  uv: Token<Float32Array, number | WebGLUniformLocation>
  vertices: Token<Float32Array, number | WebGLUniformLocation>
  /** local matrix */
  matrix: Token<mat4>
  mode: Atom<RenderMode>

  constructor(private options: ShapeOptions) {
    this.color = uniform.vec3(options.color)
    this.vertices = isToken(options.vertices) ? options.vertices : attribute.vec3(options.vertices)
    this.uv = isToken(options.uv) ? options.uv : attribute.vec2(options.uv)
    this.matrix = isToken(options.matrix) ? options.matrix : uniform.mat4(options.matrix)

    this.mode = isAtom(options.mode) ? options.mode : atom(options.mode || 'TRIANGLES')

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
