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
  return arrays.reduce<unknown[][]>((acc, arr) => acc.flatMap(a => (arr as unknown[]).map(b => [...a, b])), [[]]) as T[];
}
