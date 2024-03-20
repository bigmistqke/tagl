import { mat4 } from 'gl-matrix'
import { TODO } from 'internal-utils'

import { Program, atom, uniform } from '@tagl/core'
import { Token } from '@tagl/core/tokens'
import { Mat4 } from '@tagl/core/types'

import { Scene } from '@tagl/world'
import { Shape } from '@tagl/world/shapes'

import { traverseChildren } from './utils/traverse-children'
import { traverseParent } from './utils/traverse-parent'

/**********************************************************************************/
/*                                    NODE3D                                      */
/**********************************************************************************/

export class Node3D {
  localMatrix: Token<Mat4>
  /**
   * - `0` clean node
   * - `1` dirty offspring
   * - `2` dirty node
   */
  flag: 0 | 1 | 2 = 0
  worldMatrix: Token<mat4>
  children: Node3D[] = []
  parent: Node3D | Origin3D | undefined = undefined
  origin: Origin3D | undefined

  private _onMountHandlers: ((origin: Origin3D | undefined) => void)[] = []
  private _onCleanupHandlers: ((origin: Origin3D | undefined) => void)[] = []
  private _onUpdateHandlers: (() => void)[] = []
  private _program: Program | undefined

  constructor(public shape: Shape) {
    this.worldMatrix = uniform.mat4(mat4.clone(shape.matrix.get()), { id: 'hallo' })
    this.worldMatrix.onBind((program) => {
      this._program = program
    })

    this.localMatrix = shape.matrix
    this.localMatrix.subscribe(() => {
      this._dirty()
      this.worldMatrix.__.requestRender()
    })
  }

  onMount(callback: (origin: Origin3D | undefined) => void) {
    this._onMountHandlers.push(callback)
    return TODO('cleanup onMount')
  }
  onCleanup(callback: (origin: Origin3D | undefined) => void) {
    this._onCleanupHandlers.push(callback)
    return TODO('cleanup onCleanup')
  }
  onUpdate(callback: () => void) {
    this._onUpdateHandlers.push(callback)
    return TODO('cleanup onUpdate')
  }

  bind(parent: Node3D | Origin3D) {
    parent.children.push(this)
    this.parent = parent

    this.origin = 'origin' in parent ? parent.origin : parent

    this.mount()

    if (this.origin instanceof Origin3D) {
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
    traverseChildren(this, (node) => {
      node.origin = undefined
      node.cleanup()
    })
    this.cleanup()

    if (this.parent) {
      const index = this.parent.children.findIndex((child) => child === this)
      if (index !== -1) this.parent.children.splice(index, 1)
    }

    this.parent = undefined
  }

  mount() {
    this.origin?.addToUpdates(this)
    for (let i = 0; i < this._onMountHandlers.length; i++) {
      this._onMountHandlers[i]!(this.origin)
    }
  }

  cleanup() {
    for (let i = 0; i < this._onCleanupHandlers.length; i++) {
      this._onCleanupHandlers[i]!(this.origin)
    }
  }

  update() {
    try {
      if (this.flag === 2) {
        this.worldMatrix.set((matrix, flags) => {
          flags.preventRender()
          //flags.preventNotification()

          mat4.multiply(matrix, this.parent!.worldMatrix.get(), this.localMatrix.get())

          return matrix
        })
        for (let i = 0; i < this._onUpdateHandlers.length; i++) {
          this._onUpdateHandlers[i]!()
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

    traverseChildren(this, (node, stop) => {
      if (node.flag === 0) {
        node.flag = 2
        this.origin?.addToUpdates(node)
      } else stop()
    })

    traverseParent(this, (node, stop) => {
      if (node instanceof Node3D) {
        if (node.flag === 0) {
          node.flag = 1
          this.origin?.addToUpdates(node)
        } else {
          stop()
        }
      }
    })

    this._program?.gl.requestRender()
  }
}

/**********************************************************************************/
/*                                    ORIGIN3D                                    */
/**********************************************************************************/

export class Origin3D {
  children: Node3D[] = []
  worldMatrix = atom(mat4.create())

  private _updates: Node3D[] = new Array(5000)
  private _updatesTotal: number = 0

  constructor(public scene: Scene) {}
  update(): void {
    for (let i = 0; i < this._updatesTotal; i++) {
      this._updates[i]!.update()
    }
    this._updatesTotal = 0
  }

  addToUpdates(node: Node3D) {
    this.scene.requestRender()
    this._updates[this._updatesTotal] = node
    this._updatesTotal++
  }
}
