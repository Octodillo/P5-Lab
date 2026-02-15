import { Coordinate } from "../../common.ts";
import { Rule, GOL as Conway } from "../life-v1/rules.ts";
import Universe from "./universe.ts";

interface CellLocation<Dimensions extends number> {
  universe: Universe<Dimensions>;
  position: Coordinate<Dimensions>;
}

type CellBehavior<C> = C extends Cell<infer _, infer B> ? B : never;
type CellDimensions<C> = C extends Cell<infer D, infer _> ? D : never;

export default abstract class Cell<Dimensions extends number, Behavior extends string> {
  private location?: CellLocation<Dimensions>;

  public get universe() {
    return this.location?.universe;
  }
  public get position() {
    return this.location?.position;
  }

  constructor(universe: Universe<Dimensions>, position: Coordinate<Dimensions>) {
    this.move({ universe, position });
  }

  public move(to: { universe: Universe<Dimensions>; position: Coordinate<Dimensions> }) {
    const { universe, position } = to;

    const sameUniverse = this.universe === universe;
    const samePosition = this.position?.every((scalar, dimension) => scalar === position[dimension]);
    if (sameUniverse && samePosition) return;

    this.banish();
    this.location = to;
    universe.set(position, this);
  }

  public banish() {
    if (!this.location) return;
    const { universe, position } = this.location;
    this.location = undefined;
    universe.unset(position);
  }

  public get isBanished() {
    return !this.location;
  }

  abstract getNextBehavior(): Behavior;
  abstract behave(behavior: Behavior): void;
}

type GOLBehavior = "spawn" | "survive" | "die" | "decay" | "despawn";
export class GOL extends Cell<2, GOLBehavior> {
  override getNextBehavior(): GOLBehavior {
    throw new Error("Method not implemented.");
  }
  override behave(behavior: GOLBehavior): void {
    throw new Error("Method not implemented.");
  }

  constructor(
    universe: Universe<2>,
    position: Coordinate<2>,
    public rule: Rule,
  ) {
    super(universe, position);
  }

  static initialize(universe: Universe<2>) {}
}

export abstract class UniversePlugin<Genus extends Cell<CellDimensions<Genus>, CellBehavior<Genus>>> {
  constructor(private universe: Universe<CellDimensions<Genus>>) {}

  abstract initialize(): void;
  abstract tick(): void;
  abstract dispose(): void;
}

class GOLPlugin extends UniversePlugin<GOL> {
  override tick(): void {
    throw new Error("Method not implemented.");
  }
  override dispose(): void {
    throw new Error("Method not implemented.");
  }
  override initialize(): void {}
}

// const Life = new Universe(2);
// const gol = new GOL(Life, [0, 0], Conway); // automatically add to Life
