export type Tuple<T, N extends number> = N extends N ? (number extends N ? T[] : _TupleOf<T, N, []>) : never;

type _TupleOf<T, N extends number, R extends unknown[]> = R["length"] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export type number2 = Tuple<number, 2>;

export type Coordinate<Dimensions extends number> = Tuple<number, Dimensions>;
type NestedMap = Map<number, NestedMap | unknown>;

export class TupleMap<Item, N extends number> {
  private items: NestedMap = new Map();

  set(position: Tuple<number, N>, item: Item) {
    let current: NestedMap = this.items;
    const coords = position as number[];

    // Navigate/create nested structure for all dimensions except last
    for (let i = 0; i < coords.length - 1; i++) {
      const coord = coords[i];
      if (!current.has(coord)) {
        current.set(coord, new Map());
      }
      current = current.get(coord) as NestedMap;
    }

    // Set the item at the final dimension
    current.set(coords[coords.length - 1], item);
  }

  get(position: Tuple<number, N>): Item | undefined {
    let current: NestedMap = this.items;
    const coords = position as number[];

    // Navigate through nested structure
    for (let i = 0; i < coords.length - 1; i++) {
      const coord = coords[i];
      const next = current.get(coord);
      if (!next || !(next instanceof Map)) return undefined;
      current = next as NestedMap;
    }

    return current.get(coords[coords.length - 1]) as Item | undefined;
  }

  has(position: Tuple<number, N>): boolean {
    let current: NestedMap = this.items;
    const coords = position as number[];

    // Navigate through nested structure
    for (let i = 0; i < coords.length - 1; i++) {
      const coord = coords[i];
      const next = current.get(coord);
      if (!next || !(next instanceof Map)) return false;
      current = next as NestedMap;
    }

    return current.has(coords[coords.length - 1]);
  }

  unset(position: Tuple<number, N>): boolean {
    const coords = position as number[];
    const path: NestedMap[] = [this.items];

    // Build path to the target
    let current: NestedMap = this.items;
    for (let i = 0; i < coords.length - 1; i++) {
      const coord = coords[i];
      const next = current.get(coord);
      if (!next || !(next instanceof Map)) return false;
      current = next as NestedMap;
      path.push(current);
    }

    // Delete the final item
    const deleted = current.delete(coords[coords.length - 1]);

    // Clean up empty maps in reverse order
    for (let i = coords.length - 1; i > 0; i--) {
      if (path[i].size === 0) {
        path[i - 1].delete(coords[i - 1]);
      } else {
        break;
      }
    }

    return deleted;
  }

  clear() {
    this.items.clear();
  }

  forEach(callback: (item: Item, position: Tuple<number, N>) => void) {
    const traverse = (map: NestedMap, path: number[]) => {
      map.forEach((value, key) => {
        const currentPath = [...path, key];
        if (value instanceof Map) {
          traverse(value as NestedMap, currentPath);
        } else {
          callback(value as Item, currentPath as Tuple<number, N>);
        }
      });
    };
    traverse(this.items, []);
  }

  getItems(): { position: Tuple<number, N>; item: Item }[] {
    const items: { position: Tuple<number, N>; item: Item }[] = [];
    this.forEach((item, position) => {
      items.push({ position, item });
    });
    return items;
  }
}

export class TupleSet<N extends number> {
  private items: NestedMap = new Map();

  add(position: Tuple<number, N>) {
    let current: NestedMap = this.items;
    const coords = position as number[];

    // Navigate/create nested structure for all dimensions except last
    for (let i = 0; i < coords.length - 1; i++) {
      const coord = coords[i];
      if (!current.has(coord)) {
        current.set(coord, new Map());
      }
      current = current.get(coord) as NestedMap;
    }

    // For the final dimension, use a Set or a sentinel value
    // We'll use true as a sentinel since we only care about existence
    current.set(coords[coords.length - 1], true);
  }

  has(position: Tuple<number, N>): boolean {
    let current: NestedMap = this.items;
    const coords = position as number[];

    // Navigate through nested structure
    for (let i = 0; i < coords.length - 1; i++) {
      const coord = coords[i];
      const next = current.get(coord);
      if (!next || !(next instanceof Map)) return false;
      current = next as NestedMap;
    }

    return current.has(coords[coords.length - 1]);
  }

  delete(position: Tuple<number, N>): boolean {
    const coords = position as number[];
    const path: NestedMap[] = [this.items];

    // Build path to the target
    let current: NestedMap = this.items;
    for (let i = 0; i < coords.length - 1; i++) {
      const coord = coords[i];
      const next = current.get(coord);
      if (!next || !(next instanceof Map)) return false;
      current = next as NestedMap;
      path.push(current);
    }

    // Delete the final item
    const deleted = current.delete(coords[coords.length - 1]);

    // Clean up empty maps in reverse order
    for (let i = coords.length - 1; i > 0; i--) {
      if (path[i].size === 0) {
        path[i - 1].delete(coords[i - 1]);
      } else {
        break;
      }
    }

    return deleted;
  }

  clear() {
    this.items.clear();
  }

  forEach(callback: (position: Tuple<number, N>) => void) {
    const traverse = (map: NestedMap, path: number[]) => {
      map.forEach((value, key) => {
        const currentPath = [...path, key];
        if (value instanceof Map) {
          traverse(value as NestedMap, currentPath);
        } else {
          callback(currentPath as Tuple<number, N>);
        }
      });
    };
    traverse(this.items, []);
  }

  getItems(): Tuple<number, N>[] {
    const items: Tuple<number, N>[] = [];
    this.forEach(position => {
      items.push(position);
    });
    return items;
  }
}

export class Map2<Item> {
  private items = new Map<number, Map<number, Item>>(); // x -> y -> item

  set([x, y]: number2, item: Item) {
    if (!this.items.get(x)) this.items.set(x, new Map());
    this.items.get(x)!.set(y, item);
  }

  get([x, y]: number2): Item | undefined {
    return this.items.get(x)?.get(y);
  }

  has([x, y]: number2): boolean {
    return this.items.get(x)?.has(y) ?? false;
  }

  unset([x, y]: number2) {
    const column = this.items.get(x);
    if (!column) return false;
    const ret = column.delete(y);
    if (column.size === 0) this.items.delete(x);
    return ret;
  }

  clear() {
    this.items.clear();
  }

  forEach(callback: (item: Item, position: number2) => void) {
    this.items.forEach((ys, x) => {
      ys.forEach((item, y) => callback(item, [x, y]));
    });
  }

  getItems(): { position: number2; item: Item }[] {
    const items: { position: number2; item: Item }[] = [];
    this.items.forEach((ys, x) => {
      ys.forEach((item, y) => items.push({ position: [x, y], item }));
    });
    return items;
  }
}

export class Set2 {
  private items = new Map<number, Set<number>>(); // x -> set of y

  add(position: [number, number]) {
    const [x, y] = position;
    if (!this.items.get(x)) this.items.set(x, new Set());
    this.items.get(x)!.add(y);
  }

  has(position: [number, number]): boolean {
    const [x, y] = position;
    return this.items.get(x)?.has(y) ?? false;
  }

  delete(position: [number, number]) {
    const [x, y] = position;
    const column = this.items.get(x);
    if (!column) return false;
    const ret = column.delete(y);
    if (column.size === 0) this.items.delete(x);
    return ret;
  }

  clear() {
    this.items.clear();
  }

  forEach(callback: (position: number2) => void) {
    this.items.forEach((ys, x) => {
      ys.forEach(y => callback([x, y]));
    });
  }

  getItems(): number2[] {
    const items: number2[] = [];
    this.items.forEach((ys, x) => {
      ys.forEach(y => items.push([x, y]));
    });
    return items;
  }
}

/**
 * Zip multiple arrays together.
 * Returns an array of arrays where the i-th element contains the i-th elements of the input arrays.
 * The length of the result is determined by the shortest input array.
 */
export function zip<T>(...arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  const length = Math.min(...arrays.map(arr => arr.length));
  return Array.from({ length }, (_, i) => arrays.map(arr => arr[i]));
}

export function cross<T extends unknown[]>(...arrays: { [K in keyof T]: T[K][] }): T[] {
  if (arrays.length === 0) return [[]] as unknown as T[];
  return arrays.reduce<unknown[][]>(
    (acc, arr) => acc.flatMap(a => (arr as unknown[]).map(b => [...a, b])),
    [[]],
  ) as T[];
}

export function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
}

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

  constructor(
    private readonly spawn: () => T,
    private readonly setup?: (spawned: T) => void,
  ) {}

  /** Grow or shrink to match `count`. New items are appended; excess items are removed from the front. */
  resize(count: number): void {
    const diff = count - this.items.length;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        const spawned = this.spawn();
        this.setup?.(spawned);
        this.items.push(spawned);
      }
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

/**
 * A mutable 2D vector, chainable like `p5.Vector` but with no p5 dependency.
 *
 * Boids (and anything else doing vector math) need this because pulling in
 * `p5.Vector` drags in all of p5, which only runs in a browser — making the
 * math untestable and unrunnable outside one. `Vec2` is plain arithmetic, so
 * it works in Deno tests, Node, or anywhere else.
 *
 * Mutating methods (`add`, `sub`, `mult`, `div`, `normalize`, `setMag`, `set`,
 * `limit`, `rotate`) return `this` for chaining, mirroring `p5.Vector`'s
 * mutate-and-return-self convention. Use `.copy()` first if you need to keep
 * the original.
 *
 * ```ts
 * const v = new Vec2(3, 4).normalize().mult(2);
 * const sum = Vec2.add(a, b); // non-mutating static form
 * ```
 */
export class Vec2 {
  constructor(
    public x = 0,
    public y = 0,
  ) {}

  copy(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  set(x: number, y: number): this;
  set(v: Vec2): this;
  set(xOrV: number | Vec2, y?: number): this {
    if (xOrV instanceof Vec2) {
      this.x = xOrV.x;
      this.y = xOrV.y;
    } else {
      this.x = xOrV;
      this.y = y ?? 0;
    }
    return this;
  }

  add(v: Vec2): this;
  add(x: number, y: number): this;
  add(xOrV: number | Vec2, y?: number): this {
    if (xOrV instanceof Vec2) {
      this.x += xOrV.x;
      this.y += xOrV.y;
    } else {
      this.x += xOrV;
      this.y += y ?? 0;
    }
    return this;
  }

  sub(v: Vec2): this;
  sub(x: number, y: number): this;
  sub(xOrV: number | Vec2, y?: number): this {
    if (xOrV instanceof Vec2) {
      this.x -= xOrV.x;
      this.y -= xOrV.y;
    } else {
      this.x -= xOrV;
      this.y -= y ?? 0;
    }
    return this;
  }

  mult(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  div(scalar: number): this {
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }

  mag(): number {
    return Math.sqrt(this.magSq());
  }

  magSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  /** Unit vector in the same direction. Leaves a zero-length vector at (0, 0). */
  normalize(): this {
    const m = this.mag();
    if (m > 1e-12) this.div(m);
    return this;
  }

  /** Clamp magnitude to at most `max`, preserving direction. */
  limit(max: number): this {
    if (this.magSq() > max * max) this.normalize().mult(max);
    return this;
  }

  /** Set magnitude while preserving direction. */
  setMag(mag: number): this {
    return this.normalize().mult(mag);
  }

  /** Heading angle in radians, matching `p5.Vector.heading()` (atan2(y, x)). */
  heading(): number {
    return Math.atan2(this.y, this.x);
  }

  /** Rotate in place by `angle` radians. */
  rotate(angle: number): this {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const { x, y } = this;
    this.x = x * cos - y * sin;
    this.y = x * sin + y * cos;
    return this;
  }

  dot(v: Vec2): number {
    return this.x * v.x + this.y * v.y;
  }

  /** Z-component of the 3D cross product; sign gives turn direction. */
  cross(v: Vec2): number {
    return this.x * v.y - this.y * v.x;
  }

  dist(v: Vec2): number {
    return Math.hypot(this.x - v.x, this.y - v.y);
  }

  equals(v: Vec2): boolean {
    return this.x === v.x && this.y === v.y;
  }

  toString(): string {
    return `Vec2(${this.x}, ${this.y})`;
  }

  static zero(): Vec2 {
    return new Vec2(0, 0);
  }

  static fromAngle(angle: number, length = 1): Vec2 {
    return new Vec2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  static add(a: Vec2, b: Vec2): Vec2 {
    return a.copy().add(b);
  }

  static sub(a: Vec2, b: Vec2): Vec2 {
    return a.copy().sub(b);
  }

  static mult(v: Vec2, scalar: number): Vec2 {
    return v.copy().mult(scalar);
  }

  static div(v: Vec2, scalar: number): Vec2 {
    return v.copy().div(scalar);
  }
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends ReadonlyArray<infer U>
      ? ReadonlyArray<DeepPartial<U>>
      : DeepPartial<T[P]>;
};
