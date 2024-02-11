class DequeMapNode<TKey, TValue> {
  next: DequeMapNode<TKey, TValue> | null = null
  prev: DequeMapNode<TKey, TValue> | null = null
  constructor(public key: TKey, public value: TValue) {}
}

export class DequeMap<TKey, TValue> {
  head: null | DequeMapNode<TKey, TValue> = null
  tail: null | DequeMapNode<TKey, TValue> = null
  map = new Map<TKey, DequeMapNode<TKey, TValue>>()

  has(key: TKey) {
    return this.map.has(key)
  }

  get(key: TKey) {
    return this.map.get(key)?.value
  }

  forEach(callback: (node: DequeMapNode<TKey, TValue>, index: number) => void) {
    let index = 0
    let current = this.head
    while (true) {
      if (!current) break
      callback(current, index)
      index++
      current = current.next
    }
  }

  remove(key: TKey) {
    const existingNode = this.map.get(key)
    if (!existingNode) return
    if (existingNode.next) existingNode.next.prev = existingNode.prev
    if (existingNode.prev) existingNode.prev.next = existingNode.next
    this.map.delete(key)
  }

  moveNodeToEnd(node: DequeMapNode<TKey, TValue>) {
    // Move to the end
    node.prev = this.tail
    node.next = null
    if (this.tail) {
      this.tail.next = node
    }
    this.tail = node
  }

  /** Pushes a new node or moves it to the end if it already exists */
  push(key: TKey, value: TValue) {
    const existingNode = this.map.get(key)

    if (existingNode) {
      this.remove(key)
    }

    const newNode = new DequeMapNode(key, value)

    if (!this.head || !this.tail) {
      // initialize
      this.head = this.tail = newNode
    } else {
      this.tail.next = newNode
      newNode.prev = this.tail
      this.tail = newNode
    }
    this.map.set(key, newNode)

    return newNode.value
  }

  /** Pushes a new node or moves it to the end if it already exists */
  touch(key: TKey, callback: () => TValue) {
    const existingNode = this.map.get(key)

    if (existingNode) {
      if (existingNode === this.tail) return existingNode.value

      // Remove from its current position
      if (existingNode.prev) {
        existingNode.prev.next = existingNode.next
      }
      if (existingNode.next) {
        existingNode.next.prev = existingNode.prev
      }
      if (this.head === existingNode) {
        this.head = existingNode.next
      }

      this.moveNodeToEnd(existingNode)
      return existingNode.value
    }

    const newNode = new DequeMapNode(key, callback())

    if (!this.head || !this.tail) {
      // initialize
      this.head = this.tail = newNode
    } else {
      this.tail.next = newNode
      newNode.prev = this.tail
      this.tail = newNode
    }
    this.map.set(key, newNode)

    return newNode.value
  }

  /** Removes and returns the first node */
  shift() {
    if (!this.head) {
      return null
    }
    const removedValue = this.head.value
    this.map.delete(this.head.key)

    if (this.head === this.tail) {
      this.head = this.tail = null
    } else {
      this.head = this.head.next
      if (this.head) {
        this.head.prev = null
      }
    }
    return removedValue
  }
}
