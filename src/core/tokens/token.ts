import { Atom } from '../atom'
import { Program } from '../gl'
import { Accessor, Setter } from '../types'

export class Token<T = any> {
  get: Accessor<T>
  set: Setter<T>
  subscribe: (callback: (value: any) => void) => () => void
  onBeforeDraw: (callback: () => void) => () => void
  onBind: (handler: (program: Program) => void) => () => void
  atom: Atom<T>
  constructor(value: T | Atom<T>) {
    this.atom = value instanceof Atom ? value : new Atom<any>(value)
    this.get = this.atom.get.bind(this.atom)
    this.set = this.atom.set.bind(this.atom)
    this.subscribe = this.atom.subscribe.bind(this.atom)
    this.onBeforeDraw = this.atom.onBeforeDraw.bind(this.atom)
    this.onBind = this.atom.onBind.bind(this.atom)
  }
}
