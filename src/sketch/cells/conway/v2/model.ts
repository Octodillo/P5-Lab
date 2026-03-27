// import { assert } from "https://deno.land/std@0.208.0/assert/assert.ts";
import { Rule } from "../rules.ts";
import { Map2, number2, Set2 } from "../../../../common.ts";
import { Stamp } from "./stamps.ts";

type CellBehavior = (typeof Cell.Behaviors)[number];

export class Cell {
  public static readonly Behaviors = ["born", "live", "die", "decay"] as const;

  private _decay = 0;
  get decay() {
    return this._decay;
  }

  private neighbors: Cell[] = [];

  constructor(
    public readonly life: Life,
    public readonly rule: Rule,
    public readonly position: number2,
  ) {}

  getNextBehavior() {
    if (this.isDead()) return "decay";
    const behavior = !this.rule.live.includes(this.neighbors.length) ? "die" : "live";
    return behavior;
  }

  behave(behavior: CellBehavior) {
    switch (behavior) {
      case "born":
        this.life.set(this.position, this);
        this.connect();
        break;
      case "live":
        break;
      case "die":
        this.die();
        break;
      case "decay":
        this.advanceDecay();
        break;
      default:
        console.error(`Unknown behavior: ${behavior satisfies never}`);
    }
  }

  connect(neighbor?: Cell) {
    this.life.destablize(this.position);
    if (neighbor) {
      if (this.neighbors.includes(neighbor)) return;
      if (this.isDead()) {
        return; // Don't connect dead cells
      }
      this.neighbors.push(neighbor);
      neighbor.connect(this);
    } else {
      this.disconnect();
      this.neighbors = this.life.neighbors(this.position);
      this.neighbors.forEach(neighbor => neighbor.connect(this));
    }
  }

  disconnect(neighbor?: Cell) {
    if (neighbor) {
      const index = this.neighbors.indexOf(neighbor);
      if (index === -1) return;
      this.neighbors.splice(index, 1);
      neighbor.disconnect(this);
    } else {
      // Copy array before iterating, since recursive disconnect() calls will modify it
      [...this.neighbors].forEach(neighbor => neighbor.disconnect(this));
      this.neighbors = [];
      this.life.surroundingPositions(this.position, true).forEach(position => this.life.destablize(position));
    }
  }

  die(instant = false) {
    if (this.isDead()) return;
    this.disconnect();
    if (instant) this.life.delete(this.position);
    else this.advanceDecay();
  }

  advanceDecay() {
    this._decay++;
    this.life.destablize(this.position);
    if (this.decay >= (this.rule.decay ?? 1) - 1) this.life.delete(this.position);
  }

  isDead = () => this.decay > 0;
}

export class Life {
  cells = new Map2<Cell>();
  unstable = new Set2();

  set(position: number2, cell: Cell) {
    this.delete(position);
    this.cells.set(position, cell);

    // update bounds
    this.low[0] = Math.min(this.low[0], position[0]);
    this.low[1] = Math.min(this.low[1], position[1]);
    this.high[0] = Math.max(this.high[0], position[0]);
    this.high[1] = Math.max(this.high[1], position[1]);
  }

  place(position: number2, rule: Rule) {
    this.delete(position);
    const cell = new Cell(this, rule, position);
    cell.behave("born");
    return cell;
  }

  stamp([x, y]: number2, stamp: Stamp) {
    stamp.positions.forEach(([dx, dy]) => this.place([x + dx, y + dy], stamp.rule));
  }

  delete(position: number2) {
    this.get(position)?.disconnect();
    this.cells.unset(position);
    this.surroundingPositions(position, true).forEach(pos => this.destablize(pos));
  }

  surroundingPositions(center: number2, includeCenter = false): number2[] {
    const [x, y] = center;
    const ret: number2[] = [
      [x - 1, y - 1],
      [x, y - 1],
      [x + 1, y - 1],
      [x - 1, y],
      [x + 1, y],
      [x - 1, y + 1],
      [x, y + 1],
      [x + 1, y + 1],
    ];
    if (includeCenter) ret.push(center);
    return ret;
  }

  get = (position: number2) => this.cells.get(position);
  all = () => this.cells.getItems();
  kill = (position: number2) => this.get(position)?.die();
  destablize = (position: number2) => this.unstable.add(position);
  neighbors = (center: number2) =>
    this.surroundingPositions(center)
      .map(position => this.get(position))
      .filter((cell): cell is Cell => cell !== undefined && !cell.isDead());

  update() {
    const actions = this.unstable
      .getItems()
      .map(position => {
        const cell = this.get(position);
        if (cell) return { cell, behavior: cell.getNextBehavior() as CellBehavior };
        const neighbors = this.neighbors(position);
        const candidates = neighbors
          .filter(neighbor => neighbor.rule.born.includes(neighbors.length))
          .map(neighbor => neighbor.rule);
        if (candidates.length === 0) return undefined;
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        const born = new Cell(this, chosen, position);
        return { cell: born, behavior: "born" as CellBehavior };
      })
      .filter(action => !!action);

    this.unstable.clear();

    // Apply non-birth actions first to avoid modifying graph during planning phase
    actions.sort((a, b) => (a.behavior === "born" ? 1 : 0) - (b.behavior === "born" ? 1 : 0));
    actions.forEach(({ cell, behavior }) => cell.behave(behavior));
  }

  private low = [Infinity, Infinity];
  private high = [-Infinity, -Infinity];
  bounds = () => {
    return [this.low, this.high];
  };
}
