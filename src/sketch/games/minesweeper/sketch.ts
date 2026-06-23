import { button, checkbox, divider, numberInput, row, section, slider } from "../../../controls.ts";
import { Sketch, receive } from "../../../lab.ts";
import Minesweeper from "./game.ts";

const Controller = [
  section("Generator", [
    numberInput("width", 16, "Width...", "Width"),
    numberInput("height", 16, "Height...", "Height"),
    slider("density", 0, 1, 0.4, 0.01, "Density"),
    button("generate", "Generate!"),
    divider(),
    row([checkbox("easyDig", "Easy Digging"), checkbox("easyFlag", "Easy Flagging")]),
  ]),
  section("Editor", []),
  section("Solver", []),
];

receive(
  class extends Sketch<typeof Controller> {
    override schema = Controller;
    private game = new Minesweeper();

    override setup(): void {
      this.controls.subscribe("generate", _ =>
        this.game.generate(this.controls.values.width, this.controls.values.height, this.controls.values.density),
      );
    }

    override update(): void {}

    override draw(): void {
      this.p5.background(this.p5.color("#222"));
      this.game.draw(this.p5);
    }
  },
);
