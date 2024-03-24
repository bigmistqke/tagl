import { TypedArray } from '../types'

export class Frame<T extends TypedArray> {
  offset = 0
  constructor(private _array: T) {}
  cast() {
    return this as unknown as T & { array: Float32Array; offset: number }
  }
  set(array: T) {
    this._array = array
  }
  get 0() {
    return this._array[this.offset + 0]!
  }
  set 0(value: number) {
    this._array[this.offset + 0] = value
  }
  get 1() {
    return this._array[this.offset + 1]!
  }
  set 1(value: number) {
    this._array[this.offset + 1] = value
  }
  get 2() {
    return this._array[this.offset + 2]!
  }
  set 2(value: number) {
    this._array[this.offset + 2] = value
  }
  get 3() {
    return this._array[this.offset + 3]!
  }
  set 3(value: number) {
    this._array[this.offset + 3] = value
  }
  get 4() {
    return this._array[this.offset + 4]!
  }
  set 4(value: number) {
    this._array[this.offset + 4] = value
  }
  get 5() {
    return this._array[this.offset + 5]!
  }
  set 5(value: number) {
    this._array[this.offset + 5] = value
  }
  get 6() {
    return this._array[this.offset + 6]!
  }
  set 6(value: number) {
    this._array[this.offset + 6] = value
  }
  get 7() {
    return this._array[this.offset + 7]!
  }
  set 7(value: number) {
    this._array[this.offset + 7] = value
  }
  get 8() {
    return this._array[this.offset + 8]!
  }
  set 8(value: number) {
    this._array[this.offset + 8] = value
  }
  get 9() {
    return this._array[this.offset + 9]!
  }
  set 9(value: number) {
    this._array[this.offset + 9] = value
  }
  get 10() {
    return this._array[this.offset + 10]!
  }
  set 10(value: number) {
    this._array[this.offset + 10] = value
  }
  get 11() {
    return this._array[this.offset + 11]!
  }
  set 11(value: number) {
    this._array[this.offset + 11] = value
  }
  get 12() {
    return this._array[this.offset + 12]!
  }
  set 12(value: number) {
    this._array[this.offset + 12] = value
  }
  get 13() {
    return this._array[this.offset + 13]!
  }
  set 13(value: number) {
    this._array[this.offset + 13] = value
  }
  get 14() {
    return this._array[this.offset + 14]!
  }
  set 14(value: number) {
    this._array[this.offset + 14] = value
  }
  get 15() {
    return this._array[this.offset + 15]!
  }
  set 15(value: number) {
    this._array[this.offset + 15] = value
  }
}
