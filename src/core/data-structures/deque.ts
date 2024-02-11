class DequeNode<TValue> {
  next: DequeNode<TValue> | null = null
  prev: DequeNode<TValue> | null = null
  constructor(public value: TValue) {}
}

export class Deque<TValue> {
  head: null | DequeNode<TValue> = null
  tail: null | DequeNode<TValue> = null
  map = new Map<TValue, DequeNode<TValue>>()

  has(value: TValue) {
    return this.map.has(value)
  }

  get(value: TValue) {
    return this.map.get(value)?.value
  }

  forEach(callback: (value: TValue, index: number) => void) {
    let index = 0
    let current = this.head
    while (true) {
      if (!current) break
      callback(current.value, index)
      index++
      current = current.next
    }
  }

  /** Pushes a new node or moves it to the end if it already exists */
  push(value: TValue) {
    const existingNode = this.map.get(value)

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

      // Move to the end
      existingNode.prev = this.tail
      existingNode.next = null
      if (this.tail) {
        this.tail.next = existingNode
      }
      this.tail = existingNode
      return existingNode.value
    }

    const newNode = new DequeNode(value)

    if (!this.head || !this.tail) {
      // initialize
      this.head = this.tail = newNode
    } else {
      this.tail.next = newNode
      newNode.prev = this.tail
      this.tail = newNode
    }
    this.map.set(value, newNode)

    return newNode.value
  }

  remove(value: TValue) {
    const existingNode = this.map.get(value)
    if (!existingNode) return
    if (existingNode.next) existingNode.next.prev = existingNode.prev
    if (existingNode.prev) existingNode.prev.next = existingNode.next
    this.map.delete(existingNode.value)
  }
}
