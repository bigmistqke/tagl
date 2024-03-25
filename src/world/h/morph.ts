import { Atom, Uniform, atomize, batch } from '@tagl/core'
import { mat4 } from 'gl-matrix'
import { Node3D } from '../primitives/node-3d'
import { h } from './h'

type MorphConfig<T extends readonly any[], TResult extends Node3D> = {
  from: T | Atom<T>
  to: (value: Atom<T[number]>, index: number) => TResult
  matrix?: Atom<mat4> | Uniform<mat4>
}

export class Morph<T extends readonly any[], TResult extends Node3D | null> extends Node3D {
  each: Atom<T>

  private _shapes: TResult[] = []
  private _atoms: Atom<T>[]

  constructor(private config: MorphConfig<T, TResult>) {
    super(config.matrix)
    this.each = atomize<T>(config.from)
    this._atoms = this.each.get().map((value) => new Atom(value))

    this.each.subscribe((each) => {
      batch(() => {
        this._updateAtoms()
        this._updateShapes()
      })
    })
    batch(() => {
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
    const get = this.each.get()
    for (let i = 0; i < get.length; i++) {
      this._atoms[i]?.set(get[i])
    }
  }

  private _updateShapes() {
    console.log('updateSHapes', this.origin, this)

    const delta = this._atoms.length - this._shapes.length
    const length = this._shapes.length
    if (delta > 0) {
      const newShapes = Array.from({ length: delta }).map((_, index) => {
        const shape = this.config.to(this._atoms[length + index]!, index + (length - 1))
        return (shape instanceof Node3D ? shape.bind(this) : shape) as TResult
      })
      this._shapes.push(...newShapes)
    } else if (delta < 0) {
      this._shapes.splice(length + delta, delta * -1).forEach((shape) => {
        if (shape instanceof Node3D) {
          console.log('UNBIND!', shape)
          shape.unbind()
        }
      })
    }
  }
}

export const morph = <T extends readonly any[], TResult extends Node3D>(
  config: MorphConfig<T, TResult>,
  ...children: Node3D[]
) => h(Morph<T, TResult>, config, ...children)
