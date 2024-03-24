import { Atom, uniform } from '@tagl/core'
import { Token } from '@tagl/core/tokens'
import { Mat4 } from '@tagl/core/types'
import { mat4 } from 'gl-matrix'
import { Node3D } from './node-3d'
import { Scene } from './scene'

export class Base {
  node: Node3D
  /** local matrix */
  matrix: Token<mat4>
  constructor(matrix: Mat4 | Atom<Mat4> | Token<Mat4>) {
    this.matrix = matrix instanceof Token ? matrix : uniform.mat4(matrix)
    this.node = new Node3D(this.matrix)
  }

  bind(parent: Base | Scene) {
    this.node.bind(parent instanceof Scene ? parent.node : parent.node)
    return this
  }
  unbind() {
    this.node.unbind()
    return this
  }
}
