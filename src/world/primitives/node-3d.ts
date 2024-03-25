import { mat4 } from 'gl-matrix'
import { TODO } from 'internal-utils'

import { Atom, atomize, uniform } from '@tagl/core'
import { Token, Uniform } from '@tagl/core/tokens'

import { traverseChildren } from '@tagl/world/utils/traverse-children'
import { traverseParent } from '../utils/traverse-parent'
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
  localMatrix: any

  constructor(localMatrix: mat4 | Token<mat4> | Atom<mat4> = new Atom(mat4.create())) {
    this.localMatrix = localMatrix instanceof Token ? localMatrix : atomize(localMatrix)
    this.worldMatrix = uniform.mat4(mat4.clone(this.localMatrix.get()))
    this.localMatrix.subscribe(this._dirty.bind(this))
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

    this.origin?.addToUpdates(this)
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

    this.origin?.addToUpdates(this)
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

  updateWorldMatrix() {
    try {
      if (this.flag === 2) {
        this.worldMatrix.set((matrix, flags) => {
          // flags.preventRender()
          flags.preventNotification()

          mat4.multiply(matrix, this.parent!.worldMatrix.get(), this.localMatrix.get())

          return matrix
        })
        for (let i = 0; i < this._onWorldMatrixUpdateHandlers.length; i++) {
          this._onWorldMatrixUpdateHandlers[i]!()
        }
      }
    } finally {
      this.flag = 0
    }
  }

  private _dirty() {
    if (this.flag) return

    this.origin?.addToUpdates(this)
    this.flag = 2

    traverseChildren(this, this._dirtyChildrenCallback.bind(this))
    traverseParent(this, this._dirtyParentCallback.bind(this))

    if (this.origin && !this.origin.isPending) {
      this.origin.requestRender()
    }
  }

  private _dirtyChildrenCallback(node: Node3D, stop: () => void) {
    if (node.flag === 0) {
      node.flag = 2
      this.origin?.addToUpdates(node)
    } else stop()
  }

  private _dirtyParentCallback(node: Node3D | Scene, stop: () => void) {
    if (node instanceof Node3D) {
      if (node.flag === 0) {
        node.flag = 1
        this.origin?.addToUpdates(node)
      } else {
        stop()
      }
    }
  }
}
