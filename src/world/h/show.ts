import { Atom, Effect } from '@tagl/core'
import { Node3D } from '@tagl/world'
import { mat4 } from 'gl-matrix'
import { h } from './h'

type ShowConfig = { when: Atom<any> | any; matrix?: Atom<mat4> }
export class Show extends Node3D {
  when: Atom<boolean>
  node = new Node3D()

  constructor(config: ShowConfig) {
    super(config.matrix)
    this.when = config.when

    new Effect([this.when], ([when]) => {
      if (when) {
        super.bind(this.node)
      } else {
        super.unbind()
      }
    })
  }

  bind(parent: Node3D) {
    this.node.bind(parent)
    return this
  }
}

export const show = <const TChildren extends (Node3D | Atom<Node3D | undefined>)[]>(
  config: ShowConfig,
  ...shapes: TChildren
) => h(Show, config, ...shapes)
