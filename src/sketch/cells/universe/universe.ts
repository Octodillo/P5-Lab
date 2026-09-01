import { Coordinate, Tuple, TupleMap } from "../../common.ts";
import Cell from "./cell.ts";

export default class Universe<Dimensions extends number>
  extends TupleMap<Cell<Dimensions, string>, Dimensions> {
  public readonly origin = () => new Array(this.dimentionality).fill(0);
  public readonly one = () => new Array(this.dimentionality).fill(1);
  public readonly unit = (direction: number) => {
    const o = this.origin();
    o[direction] = 1;
    return o;
  };

  constructor(public readonly dimentionality: Dimensions) {
    super();
  }

  // private listeners = new TupleMap<Cell<Dimensions>[], Dimensions>();
  // private currentListener
  // public listen(){}
  // public unlisten(listener??this.currentListener)

  public override set(position: Coordinate<Dimensions>, cell: Cell<Dimensions, string>) {
    this.get(position)?.banish();
    super.set(position, cell);
  }

  public override unset(position: Tuple<number, Dimensions>): boolean {
    this.get(position)?.banish();
    return super.unset(position);
  }

  public override clear(): void {
    throw new Error("Not implemented");
  }

  public neighborhood(center: Coordinate<Dimensions>, distance: number): Coordinate<Dimensions>[] {
    if (distance < 0) return [];

    const dims = this.dimentionality;
    const results: Coordinate<Dimensions>[] = [];
    const offsets = this.origin();

    const recurse = (idx: number) => {
      if (idx === dims) {
        // skip the center itself (all-zero offset)
        if (offsets.every((o) => o === 0)) return;
        const coord = (center as number[]).map((c, i) => c + offsets[i]) as Coordinate<Dimensions>;
        results.push(coord);
        return;
      }

      for (let o = -distance; o <= distance; o++) {
        offsets[idx] = o;
        recurse(idx + 1);
      }
    };

    recurse(0);
    return results;
  }

  public readonly neighbors = (center: Coordinate<Dimensions>, distance: number) =>
    this.neighborhood(center, distance)
      .map((pos) => this.get(pos))
      .filter((maybeCell) => !!maybeCell);
}
