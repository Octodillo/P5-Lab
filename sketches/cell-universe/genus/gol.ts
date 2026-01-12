import { Coordinate } from "../../common.ts";
import { Rule } from "../../life-v1/rules.ts";
import Cell from "../cell.ts";
import Universe from "../universe.ts";

type GOLBehavior = "spawn" | "survive" | "die" | "decay" | "despawn";
export class GOL extends Cell<2, GOLBehavior> {
  constructor(universe: Universe<2>, position: Coordinate<2>, public rule: Rule) {
    super(universe, position);
  }

  override getNextBehavior(): GOLBehavior {
    throw new Error("Method not implemented.");
  }

  override behave(behavior: GOLBehavior): void {
    throw new Error("Method not implemented.");
  }
}

export abstract class UniversePlugin<Genus extends Cell<number, string>> {}

class GOLPlugin extends UniversePlugin<GOL> {}
