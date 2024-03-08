export class ReferenceCount<TData> {
  map: Map<TData, number> = new Map()
  add(data: TData) {
    const count = this.map.get(data)
    this.map.set(data, count ? count + 1 : 1)
    return () => this.delete(data)
  }
  delete(data: TData) {
    const count = this.map.get(data)
    if (!count) return

    if (count === 1) {
      this.map.delete(data)
    } else {
      this.map.set(data, count - 1)
    }
  }
  forEach(callback: (data: TData) => void) {
    for (const value of this.map.keys()) {
      callback(value)
    }
  }
}
