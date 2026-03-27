import {
  section,
  row,
  radio,
  button,
  checkbox,
  stat,
  divider,
  tabs,
  select,
  option,
  textInput,
  numberInput,
  slider,
} from "../../../../controls.ts";
import { receive, Sketch } from "../../../../lab.ts";
import { Life } from "./model.ts";
import Stamps, { GosperGliderGun } from "./stamps.ts";
import Rules, { Rule } from "../rules.ts";
import { number2 } from "../../../../common.ts";

const Controller = [
  section("Simulation & View", [
    checkbox("running", "Life", false),
    row([button("clear", "Clear"), button("fit", "Fit"), checkbox("auto", "Auto-fit", true)]),
    slider("padding", 0, 100, 20, 1, "View Padding"),
  ]),
  divider(),
  section("Input", [
    row([radio("input", "cell", "Cell", true), radio("input", "stamp", "Stamp")]),
    row([radio("input", "move", "Move"), radio("input", "pick", "Pick"), radio("input", "erase", "Erase")]),
    divider(),
    tabs("input", {
      cell: [
        select(
          "rule",
          Object.entries(Rules).map(([key, rule]) => option(key, rule)),
          Rules.GOL,
          "Rule",
        ),
        textInput("ruleName", undefined, undefined, "Name"),
        row([textInput("ruleBorn", undefined, undefined, "Born"), textInput("ruleLive", undefined, undefined, "Live")]),
        row([
          numberInput("ruleDecay", undefined, undefined, "Decay"),
          textInput("ruleColor", undefined, undefined, "Color"),
        ]),
        button("ruleSave", "Save as custom rule"),
      ],
      stamp: [
        select(
          "stampSelect",
          Object.entries(Stamps).map(([key, stamp]) => option(key, stamp)),
          Stamps.Glider,
          "Stamp",
        ),
        row([checkbox("stampRotate", "Rotate on click", false)]),
        stat("stampSize", "Size: —"),
      ],
      move: [stat("viewCenter", "Center: (0, 0)"), stat("viewScale", "Scale: 1.0×"), button("resetView", "Reset View")],
      pick: [stat("pickedRule", "Rule: —"), stat("pickedPos", "Position: —"), button("copyRule", "Copy to Cell Mode")],
      erase: [
        row([radio("eraseMode", "single", "Single", true), radio("eraseMode", "brush", "Brush")]),
        numberInput("eraseBrushSize", 3, "Size", "Brush size"),
      ],
    }),
  ]),
  divider(),
  section("Stats", [
    row([stat("population", "0", "Population"), stat("generation", "0", "Generation")]),
    row([stat("alive", "0", "Alive"), stat("dying", "0", "Dying")]),
    stat("bounds", "—", "Bounds"),
    stat("unstable", "0", "Unstable"),
  ]),
] as const;

class GameOfLife extends Sketch<typeof Controller> {
  readonly schema = Controller;

  life = new Life();
  updateInterval = -2;

  viewPosition = [0, 0];
  viewScale = 20;

  override setup(): void {
    this.controls.subscribe("clear", () => this.life.cells.clear());
    this.controls.subscribe("fit", () => this.approachTargetFit(this.controls.values.padding, 1));

    this.p5.mousePressed = () => {
      if (this.p5.mouseX < 0) return;

      const button = this.p5.mouseButton;
      switch (this.controls.values.input) {
        case "cell": {
          if (button === "left") this.life.place(this.mousePosition(), this.controls.values.rule);
          break;
        }
        case "stamp":
          break;
        case "move":
          break;
        case "pick":
          break;
        case "erase":
          break;
      }
    };
    this.p5.mouseDragged = () => {
      switch (this.controls.values.input) {
        case "cell":
          break;
        case "stamp":
          break;
        case "move":
          break;
        case "pick":
          break;
        case "erase":
          break;
      }
    };
    this.p5.mouseReleased = () => {
      switch (this.controls.values.input) {
        case "cell":
          break;
        case "stamp":
          break;
        case "move":
          break;
        case "pick":
          break;
        case "erase":
          break;
      }
      this.p5.mouseWheel = () => {};
    };

    this.life.stamp([0, 0], GosperGliderGun);
  }
  override update(): void {
    if (this.controls.values.auto) this.approachTargetFit(this.controls.values.padding, 0.1);
    if (!this.controls.values.running) return;
    this.life.update();
    this.controls.set("generation", Number(this.controls.values.generation) + 1 + "");
  }

  override draw(): void {
    const { p5 } = this;
    p5.colorMode("hsl", 1);
    p5.background(0);
    p5.translate(p5.width / 2 + this.viewPosition[0], p5.height / 2 + this.viewPosition[1]);
    p5.scale(this.viewScale);

    this.life.all().forEach(({ item: { rule, decay }, position }) => this.drawCell(rule, position, { decay }));

    this.controls.values.rule;

    const inputPosition = this.mousePosition();
    switch (this.controls.values.input) {
      case "cell":
        this.drawCell(this.controls.values.rule, inputPosition, { alpha: 0.75 });
        break;
      case "stamp":
        break;
      case "move":
        break;
      case "pick":
        break;
      case "erase":
        break;
      default: {
        const exhaustive: never = this.controls.values.input;
        console.error(`Unknown cell behavior: ${exhaustive}`);
      }
    }
  }

  drawCell(rule: Rule, [x, y]: number2, opts: { decay?: number; alpha?: number }) {
    const color = this.p5.color(rule.color.hex);

    const cellDecay = opts.decay ?? 0;
    const maxDecay = rule.decay ?? 1;
    const customDecay = opts.alpha ?? 1;

    // color.setAlpha((1 - cellDecay / (maxDecay + 1)) * customDecay);

    this.p5.noStroke();
    this.p5.fill(color);
    this.p5.square(x, y, 1);
  }

  mousePosition(): number2 {
    const x = (this.p5.mouseX - this.p5.width / 2 - this.viewPosition[0]) / this.viewScale;
    const y = (this.p5.mouseY - this.p5.height / 2 - this.viewPosition[1]) / this.viewScale;
    return [Math.floor(x), Math.floor(y)];
  }

  approachTargetFit(padding: number, asdf: number): void {
    const [low, high] = this.life.bounds();
    const width = high[0] - low[0] + 1 + padding;
    const height = high[1] - low[1] + 1 + padding;
    if (width <= 0 || height <= 0 || this.p5.width <= 0 || this.p5.height <= 0) return;
    const targetScale = Math.min(this.p5.width / width, this.p5.height / height);
    if (!isFinite(targetScale)) return;
    this.viewScale += (targetScale - this.viewScale) * asdf;
    this.viewPosition[0] = -((low[0] + high[0] + 1) / 2) * this.viewScale;
    this.viewPosition[1] = -((low[1] + high[1] + 1) / 2) * this.viewScale;
  }
}

receive(GameOfLife);

// ({ p5: sketch, controls }) => {
//   sketch.draw = () => {

//     // Update statistics
//     const cells = life.all();
//     const alive = cells.filter(({ item }) => !item.isDead()).length;
//     const dying = cells.length - alive;
//     const [low, high] = life.bounds();

//     controls.set("population", String(cells.length));
//     controls.set("generation", String(generation));
//     controls.set("alive", String(alive));
//     controls.set("dying", String(dying));
//     controls.set("bounds", cells.length > 0 ? `(${low[0]}, ${low[1]}) → (${high[0]}, ${high[1]})` : "—");
//     controls.set("unstable", String(life.unstable.getItems().length));
//   };
// };
