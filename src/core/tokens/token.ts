import { Atom } from '../atom'

export class Token<T = any> extends Atom<T> {
  constructor(value: T | Atom<T>) {
    if (value instanceof Atom) return value
    super(value)
  }
}
