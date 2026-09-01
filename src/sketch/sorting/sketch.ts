import { button, option, row, section, select, slider } from "../../controls.ts";
import { receive, Sketch } from "../../lab.ts";

const Controller = [
  section("Setup", [
    slider("length", 5, 500, 100, 1, "Array length"),
    select("generateMode", [option("Linear", "linear"), option("Few Unique", "fewUnique")], "linear", "Array Mode"),
    select("shuffleMode", [], undefined, "Shuffle Mode"),
    row([button("generate", "Generate"), button("shuffle", "Shuffle")]),
  ]),
  section("Sorting", [
    select("algorithm", [option("bubble", "Bubble Sort")], undefined, "Algorithm"),
    row([slider("compareMs", 0, 1000, 200, 10, "Compare Delay"), slider("swapMs", 0, 1000, 200, 10, "Swap Delay")]),
    button("go", "Sort!"),
  ]),
] as const;

class SortingVis extends Sketch<typeof Controller> {
  schema = Controller;

  arr: number[] = [];

  override setup(): void {
    throw new Error("Method not implemented.");
  }

  override draw(): void {
    throw new Error("Method not implemented.");
  }

  override update(): void {}

  public generate() {
    switch (this.controls.values.generateMode) {
      case "linear":
        break;
      case "fewUnique":
        break;
      default: {
        const _exclusiveCheck: never = this.controls.values.generateMode;
      }
    }
  }
}

receive(SortingVis);
