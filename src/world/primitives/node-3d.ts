import { mat4 } from 'gl-matrix'
import { TODO } from 'internal-utils'

import { Atom, atomize, uniform } from '@tagl/core'
import { Token, Uniform } from '@tagl/core/tokens'

import { traverseChildren } from '@tagl/world/utils/traverse-children'
import { Scene } from './'

export class Node3D {
  /**
   * - `0` clean node
   * - `1` dirty offspring
   * - `2` dirty node
   */
  flag: 0 | 1 | 2 = 0
  worldMatrix: Uniform<mat4>
  children = new Atom<Node3D[]>([])
  parent: Node3D | Scene | undefined = undefined
  origin: Scene | undefined

  private _onMountHandlers: ((origin: Scene | undefined) => void)[] = []
  private _onCleanupHandlers: ((origin: Scene | undefined) => void)[] = []
  private _onWorldMatrixUpdateHandlers: (() => void)[] = []
  localMatrix: Token<mat4> | Atom<mat4>

  constructor(localMatrix: mat4 | Token<mat4> | Atom<mat4> = new Atom(mat4.create())) {
    this.localMatrix = atomize(localMatrix)
    this.worldMatrix = uniform.mat4(
      mat4.clone(localMatrix instanceof Atom ? localMatrix.get() : localMatrix)
    )
  }

  onMount(callback: (origin: Scene | undefined) => void) {
    this._onMountHandlers.push(callback)
    return TODO('cleanup onMount')
  }
  onCleanup(callback: (origin: Scene | undefined) => void) {
    this._onCleanupHandlers.push(callback)
    return TODO('cleanup onCleanup')
  }
  onWorldMatrixUpdate(callback: () => void) {
    this._onWorldMatrixUpdateHandlers.push(callback)
    return TODO('cleanup onUpdate')
  }

  bind(parent: Node3D | Scene) {
    if (parent === this.parent) return

    if (!parent) {
      console.error('no parent', this)
      return this
    }

    parent.children.set((children) => {
      children.push(this)
      return children
    })
    this.parent = parent

    this.origin = 'origin' in parent ? parent.origin : parent

    this.mount()

    if (this.origin instanceof Scene) {
      traverseChildren(this, (node) => {
        node.origin = this.origin
        node.mount()
      })
    }

    this.worldMatrix.derive(
      [this.localMatrix, this.parent!.worldMatrix],
      ([localMatrix, parentMatrix], matrix) => {
        return mat4.multiply(matrix!, parentMatrix, localMatrix)
      }
    )

    this.flag = 2

    return this
  }

  unbind() {
    if (!this.parent) return

    traverseChildren(this, (node) => node.cleanup())

    this.cleanup()

    if (this.parent) {
      this.parent.children.set((children) => {
        const index = children.findIndex((child) => child === this)
        if (index !== -1) children.splice(index, 1)
        return children
      })
    }

    this.parent = undefined
  }

  mount() {
    this.origin = this.parent
      ? 'origin' in this.parent
        ? this.parent.origin
        : this.parent
      : undefined

    for (let i = 0; i < this._onMountHandlers.length; i++) {
      this._onMountHandlers[i]!(this.origin)
    }
  }

  cleanup() {
    for (let i = 0; i < this._onCleanupHandlers.length; i++) {
      this._onCleanupHandlers[i]!(this.origin)
    }
    // this.origin = undefined
  }
}
