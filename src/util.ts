/**
 * A managed collection backed by a factory function.
 * Grows and shrinks to a target count on demand.
 *
 * ```ts
 * const pool = new Pool(() => ({ x: random(), y: random() }));
 * pool.resize(50);       // spawn 50 items
 * pool.resize(20);       // remove 30 oldest
 * pool.forEach(item => { ... });
 * ```
 */
export class Pool<T> implements Iterable<T> {
  readonly items: T[] = [];

  constructor(private readonly spawn: () => T) {}

  /** Grow or shrink to match `count`. New items are appended; excess items are removed from the front. */
  resize(count: number): void {
    const diff = count - this.items.length;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) this.items.push(this.spawn());
    } else if (diff < 0) {
      this.items.splice(0, -diff);
    }
  }

  get length(): number {
    return this.items.length;
  }

  forEach(fn: (item: T, index: number) => void): void {
    this.items.forEach(fn);
  }

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }
}
