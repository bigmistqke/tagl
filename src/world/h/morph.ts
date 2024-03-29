import { Atom, Effect, Uniform, atomize } from '@tagl/core'
import { mat4 } from 'gl-matrix'
import { Node3D } from '../primitives/node-3d'

export class Morph<T extends any[], TResult extends Node3D> extends Node3D {
  from: Atom<T, any>
  to: (value: Atom<T[number]>, index: number) => TResult

  constructor(config: {
    from: Atom<T>
    to: (value: Atom<T[number]>, index: number) => TResult
    matrix?: Atom<mat4> | Uniform<mat4>
  }) {
    super(mat4.create())
    this.from = atomize(config.from)
    this.to = config.to

    const atom = indexArray(
      this.from,
      (value, index) => this.to(value, index).bind(this),
      (node) => node.unbind()
    )

    new Effect([atom], () => {})
  }
}

export function indexArray<T extends any[], TOutput extends Node3D>(
  input: Atom<T>,
  onBind: (value: Atom<T[number]>, index: number) => TOutput,
  onCleanup: (output: TOutput) => void
) {
  const atoms: Atom[] = []
  const output: any[] = []

  return new Atom([input], ([input]) => {
    const offset = output.length
    const delta = (input?.length || 0) - offset

    for (let i = 0; i < Math.min(atoms.length, input?.length || 0); i++) {
      atoms[i]!.set(input[i])
    }

    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        const index = i + offset

        const atom = new Atom(input[index]!)
        atoms.push(atom)

        output.push(onBind(atom, index))
      }
    } else if (delta < 0) {
      for (let i = 0; i < -delta; i++) {
        onCleanup(output.pop())
        atoms.pop()
      }
    }

    return output
  })
}
