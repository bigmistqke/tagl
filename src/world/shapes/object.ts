import { mat4 } from 'gl-matrix'

import { Token } from '@tagl/core/tokens'
import { Scene } from '@tagl/world'
import { Node3D } from '@tagl/world/scene-graph'

import { Shape } from './shape'

export class Object<TData extends Record<string, any> = {}> {
  color: Shape<TData>['color']
  vertices: Shape<TData>['vertices']
  indices: Shape<TData>['indices']
  node: Node3D
  matrix: Token<mat4>
  uv: Token<Float32Array>

  constructor(public shape: Shape<TData>) {
    this.color = shape.color
    this.vertices = shape.vertices
    this.indices = shape.indices
    this.node = shape.node
    this.matrix = shape.matrix
    this.uv = shape.uv
  }

  bind(object: Scene | Shape | Object) {
    this.shape.bind('shape' in object ? object.shape : object)
    return this
  }

  unbind() {
    this.shape.unbind()
  }
}
