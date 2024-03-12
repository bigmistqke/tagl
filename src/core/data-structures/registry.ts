type Record<TData> = { value: TData; dirty: boolean }

export class RegistryBase<TKey, TData = unknown> {
  private map = new Map<TKey, Record<TData>>()

  has(key: TKey) {
    return this.map.has(key)
  }

  get(key: TKey) {
    return this.map.get(key)
  }

  _register(key: TKey, initialize: () => TData) {
    const record = this.map.get(key)

    if (!record) {
      const record = {
        value: initialize(),
        dirty: true,
      }
      this.map.set(key, record)
      return record
    } else {
      return record
    }
  }
}

export class Registry<TKey, TData = unknown> extends RegistryBase<TKey, TData> {
  register = super._register
}
