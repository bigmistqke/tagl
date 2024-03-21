import { Atom, atomize, effect } from '@tagl/core'
import { Node3D, Scene } from '@tagl/world'
import { mat4 } from 'gl-matrix'

export class Show extends Node3D {
  when: Atom<boolean>
  _parent = new Atom<Node3D | Scene | undefined>(undefined)

  constructor(config: { when: Atom<boolean> | boolean; matrix: Atom<mat4> }) {
    super(config.matrix)
    this.when = atomize(config.when)
    effect([this.when, this._parent], () => {
      const _parent = this._parent.get()
      if (_parent) {
        if (this.when.get()) {
          super.bind(_parent)
        } else {
          super.unbind()
        }
      }
    })
  }
  bind(parent: Node3D | Scene) {
    this._parent.set(parent)
    return this
  }
  unbind() {
    this._parent.set(undefined)
    return this
  }
}
