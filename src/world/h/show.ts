import { Atom, Effect, atomize } from '@tagl/core'
import { Node3D, Scene } from '@tagl/world'
import { mat4 } from 'gl-matrix'
import { h } from './h'

type ShowConfig = { when: Atom<any> | any; matrix?: Atom<mat4> }
export class Show extends Node3D {
  when: Atom<boolean>
  _parent = new Atom<Node3D | Scene | undefined>(undefined)

  constructor(config: ShowConfig) {
    super(config.matrix)
    this.when = atomize(config.when)
    new Effect([this.when, this._parent], ([when, _parent]) => {
      if (!_parent) return
      if (when) {
        super.bind(_parent)
      } else {
        super.unbind()
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

export const show = <const TChildren extends (Node3D | Atom<Node3D | undefined>)[]>(
  config: ShowConfig,
  ...shapes: TChildren
) => h(Show, config, ...shapes)
