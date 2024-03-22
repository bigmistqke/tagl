import { Atom, atomize, effect } from '@tagl/core'
import { Node3D } from '../primitives/node-3d'

export class For<T extends readonly any[], TResult extends Node3D> extends Node3D {
  each: Atom<T>

  private _shapes: TResult[] = []
  private _atoms: Atom<T>[]

  constructor(private config: { each: T | Atom<T>; shape: (value: Atom<T[number]>) => TResult }) {
    super()
    this.each = atomize<T>(config.each)
    this._atoms = this.each.get().map((value) => new Atom(value))

    effect([this.each], () => {
      this._updateAtoms()
      this._updateShapes()
    })
  }

  private _updateAtoms() {
    const each = this.each.get()
    const delta = each.length - this._atoms.length
    if (delta > 0) {
      const newAtoms = Array.from({ length: delta }).map((v) => new Atom<T>(null!))
      this._atoms.push(...newAtoms)
    } else if (delta < 0) {
      this._atoms.splice(each.length + delta, delta * -1)
    }
    this.each.get().forEach((value, index) => this._atoms[index]?.set(value, true))
  }

  private _updateShapes() {
    const delta = this._atoms.length - this._shapes.length
    const length = this._shapes.length
    if (delta > 0) {
      const newShapes = Array.from({ length: delta }).map((_, index) => {
        return this.config.shape(this._atoms[length + index]!).bind(this)
      })
      this._shapes.push(...newShapes)
    } else if (delta < 0) {
      this._shapes.splice(length + delta, delta * -1).forEach((shape) => {
        shape.unbind()
      })
    }
  }
}
