import { Atom, atomize, subscribe } from '@tagl/core'
import { Node3D, Scene } from '@tagl/world'
import { mat4 } from 'gl-matrix'
import { h } from './h'

type MatchConfig<T extends Record<string, Node3D>> = {
  when: Atom<keyof T> | any
  cases: T
  matrix?: Atom<mat4>
}
export class Match<T extends Record<string, Node3D>> extends Node3D {
  cases: Atom<T>
  when: Atom<keyof T>
  _parent = new Atom<Node3D | Scene | undefined>(undefined)
  previous?: Node3D

  constructor(config: MatchConfig<T>) {
    super(config.matrix)
    this.when = atomize(config.when)
    this.cases = atomize(config.cases)
    subscribe([this.when, this._parent], ([when, _parent]) => {
      if (!_parent) return
      if (this.previous) this.previous.unbind()
      const node = this.cases.get()[when]
      if (node) {
        node.bind(_parent)
        this.previous = node
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

export const match = <
  const TChildren extends (Node3D | Atom<Node3D | undefined>)[],
  TCases extends Record<string, Node3D>
>(
  config: MatchConfig<TCases>,
  ...shapes: TChildren
) => h(Match, config, ...shapes)
