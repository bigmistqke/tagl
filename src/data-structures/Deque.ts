class DequeNode<TKey, TValue> {
  next: DequeNode<TKey, TValue> | null = null;
  prev: DequeNode<TKey, TValue> | null = null;
  constructor(
    public key: TKey,
    public value: TValue,
  ) {}
}

export class Deque<TKey, TValue> {
  head: null | DequeNode<TKey, TValue> = null;
  tail: null | DequeNode<TKey, TValue> = null;
  map = new Map<TKey, DequeNode<TKey, TValue>>();

  has(key: TKey) {
    return this.map.has(key);
  }

  get(key: TKey) {
    return this.map.get(key)?.value;
  }

  /** Pushes a new node or moves it to the end if it already exists */
  touch(key: TKey, callback: () => TValue) {
    const existingNode = this.map.get(key);

    if (existingNode) {
      if (existingNode === this.tail) return existingNode.value;

      // Remove from its current position
      if (existingNode.prev) {
        existingNode.prev.next = existingNode.next;
      }
      if (existingNode.next) {
        existingNode.next.prev = existingNode.prev;
      }
      if (this.head === existingNode) {
        this.head = existingNode.next;
      }

      // Move to the end
      existingNode.prev = this.tail;
      existingNode.next = null;
      if (this.tail) {
        this.tail.next = existingNode;
      }
      this.tail = existingNode;
      return existingNode.value;
    }

    const newNode = new DequeNode(key, callback());

    if (!this.head || !this.tail) {
      // initialize
      this.head = this.tail = newNode;
    } else {
      this.tail.next = newNode;
      newNode.prev = this.tail;
      this.tail = newNode;
    }
    this.map.set(key, newNode);

    return newNode.value;
  }

  /** Removes and returns the first node */
  shift() {
    if (!this.head) {
      return null;
    }
    const removedValue = this.head.value;
    this.map.delete(this.head.key);

    if (this.head === this.tail) {
      this.head = this.tail = null;
    } else {
      this.head = this.head.next;
      if (this.head) {
        this.head.prev = null;
      }
    }
    return removedValue;
  }
}
