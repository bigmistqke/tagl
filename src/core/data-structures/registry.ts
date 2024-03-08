/** Map with reference-count and dirty-property */
export class RegistryBase<TKey, TData = unknown> {
  map = new Map<TKey, { value: TData; count: number; dirty: boolean }>()

  has(key: TKey) {
    return this.map.has(key)
  }

  get(key: TKey) {
    return this.map.get(key)
  }

  _register(key: TKey, data: () => TData) {
    const record = this.map.get(key)
    if (!record) {
      const entry = {
        value: data(),
        count: 1,
        dirty: true,
      }
      this.map.set(key, entry)
      return entry
    } else {
      record.count++
      return record
    }
  }

  update(key: TKey, data: TData) {
    const entry = this.map.get(key)
    if (entry) {
      entry.value = data
      entry.dirty = false
    }
  }

  dirty(key: TKey) {
    const entry = this.map.get(key)
    if (entry) entry.dirty = true
  }

  cleanup(key: TKey) {
    const record = this.map.get(key)
    if (!record) return undefined
    record.count--
    if (record.count === 0) {
      this.map.delete(key)
    }
    return record
  }
}

/** Map with reference-count and dirty-property */
export class Registry<TKey, TData = unknown> extends RegistryBase<TKey, TData> {
  register = super._register
}
