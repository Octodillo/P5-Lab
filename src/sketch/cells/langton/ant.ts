import { Map2 } from "../../../common.ts";
import { ControlDesc, section } from "../../../controls.ts";
import { receive, Sketch } from "../../../lab.ts";

class Colony extends Map2<boolean> {}

const controls = [section("Bla", [])];

receive(
  class extends Sketch<typeof controls> {
    override schema = controls;
    override update(): void {
      throw new Error("Method not implemented.");
    }
    override draw(): void {
      throw new Error("Method not implemented.");
    }
  },
);
