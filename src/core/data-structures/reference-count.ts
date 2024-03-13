export class ReferenceCount<TData> {
  private map: Map<TData, number> = new Map()
  private array: TData[] = []
  add(data: TData) {
    const count = this.map.get(data)
    this.map.set(data, count ? count + 1 : 1)
    if (!count) {
      this.array = Array.from(this.map.keys())
    }
    return () => this.delete(data)
  }
  delete(data: TData) {
    const count = this.map.get(data)
    if (!count) return
    if (count === 1) {
      this.map.delete(data)
      this.array = Array.from(this.map.keys())
    } else {
      this.map.set(data, count - 1)
    }
  }
  forEach(callback: (data: TData) => void) {
    for (let i = 0; i < this.array.length; i++) {
      callback(this.array[i]!)
    }
  }
}
