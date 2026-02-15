import { number2 } from "../../../common.ts";
import { initSketch } from "../../../sketch.ts";
import { Life } from "../../life-v2./gol/v2/model.ts";
import Rules from "../../life-v1/rules.ts";
import { Glider, GosperGliderGun } from "../../gol/v2/stamps.ts";
import {
  button,
  checkbox,
  divider,
  numberInput,
  option,
  radio,
  row,
  section,
  select,
  stat,
  tabs,
  textInput,
} from "../../../controls.ts";

type SimMode = "stop" | "run" | "turbo";

initSketch(
  [
    section("Simulation & View", [
      row([
        radio<SimMode>("mode", "stop", "Stop", true),
        radio<SimMode>("mode", "run", "Run"),
        radio<SimMode>("mode", "turbo", "Turbo"),
      ]),
      row([button("clear", "Clear"), button("step", "Step")]),
      row([button("fit", "Fit to active"), checkbox("auto", "Auto-fit", true)]),
      row([stat("population", "0", "Population"), stat("generation", "0", "Generation")]),
      row([stat("alive", "0", "Alive"), stat("dying", "0", "Dying")]),
      stat("bounds", "—", "Bounds"),
      stat("unstable", "0", "Unstable"),
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
            Object.entries(Rules).map(([key, rule]) => option(rule.name, key)),
            Rules.GOL.name,
            "Rule",
          ),
          textInput("ruleName", undefined, undefined, "Name"),
          row([
            textInput("ruleBorn", undefined, undefined, "Born"),
            textInput("ruleLive", undefined, undefined, "Live"),
          ]),
          row([
            numberInput("ruleDecay", undefined, undefined, "Decay"),
            textInput("ruleColor", undefined, undefined, "Color"),
          ]),
          button("ruleSave", "Save as custom rule"),
        ],
        stamp: [
          select(
            "stampSelect",
            [option("Glider", "glider"), option("Gosper Glider Gun", "gosperGliderGun")],
            "glider",
            "Pattern",
          ),
          row([checkbox("stampRotate", "Rotate on click", false)]),
          stat("stampSize", "Size: —"),
        ],
        move: [
          stat("viewCenter", "Center: (0, 0)"),
          stat("viewScale", "Scale: 1.0×"),
          button("resetView", "Reset View"),
        ],
        pick: [
          stat("pickedRule", "Rule: —"),
          stat("pickedPos", "Position: —"),
          button("copyRule", "Copy to Cell Mode"),
        ],
        erase: [
          row([radio("eraseMode", "single", "Single", true), radio("eraseMode", "brush", "Brush")]),
          numberInput("eraseBrushSize", 3, "Size", "Brush size"),
        ],
      }),
    ]),
  ],
  ({ p5: sketch, controls }) => {
    const life = new Life();

    controls.subscribe("clear", () => life.cells.clear());
    controls.subscribe("step", () => life.update());

    let simMode = -2;
    controls.subscribe<SimMode>("mode", mode => {
      if (simMode >= 0) clearInterval(simMode);
      if (mode === "stop") simMode = -2;
      else if (mode === "run") simMode = -1;
      else simMode = setInterval(() => life.update(), 0);
    });

    life.stamp([0, 0], GosperGliderGun);
    // life.place([0, 0], Rules.Gnarl);
    // life.place([0, 1], Rules.Star);
    // life.stamp([0, 0], Glider);

    const center: number2 = [0, 200]; // x,y
    let scale = 20;
    let zoom = false;

    function approachTargetFit(speed: number) {
      const padding = 20;

      const [low, high] = life.bounds();
      const [width, height] = [high[0] - low[0] + 1 + padding, high[1] - low[1] + 1 + padding];
      const [scaleX, scaleY] = [sketch.width / width, sketch.height / height];
      const targetScale = Math.min(scaleX, scaleY);
      const [targetX, targetY] = [
        -((low[0] + high[0] + 1) / 2) * targetScale,
        -((low[1] + high[1] + 1) / 2) * targetScale,
      ];

      scale += (targetScale - scale) * speed;
      center[0] += (targetX - center[0]) * speed;
      center[1] += (targetY - center[1]) * speed;
    }

    controls.subscribe("fit", () => approachTargetFit(1));
    controls.subscribe<boolean>("auto", v => (zoom = v));

    let generation = 0;
    const originalUpdate = life.update.bind(life);
    life.update = () => {
      originalUpdate();
      generation++;
    };

    sketch.draw = () => {
      if (simMode === -1) life.update();
      if (zoom) approachTargetFit(0.15);

      // Update statistics
      const cells = life.all();
      const alive = cells.filter(({ item }) => !item.isDead()).length;
      const dying = cells.length - alive;
      const [low, high] = life.bounds();

      controls.set("population", String(cells.length));
      controls.set("generation", String(generation));
      controls.set("alive", String(alive));
      controls.set("dying", String(dying));
      controls.set("bounds", cells.length > 0 ? `(${low[0]}, ${low[1]}) → (${high[0]}, ${high[1]})` : "—");
      controls.set("unstable", String(life.unstable.getItems().length));

      sketch.push();
      sketch.colorMode("hsl", 1); // easiest to think about
      sketch.background(0);
      sketch.translate(sketch.width / 2 + center[0], sketch.height / 2 + center[1]);
      sketch.scale(scale);

      cells.forEach(({ item: cell, position: [x, y] }) => {
        const rule = cell.rule.color;
        const color = sketch.color(rule.hex);
        const alpha = cell.alpha();
        color.setAlpha(alpha);

        sketch.noStroke();
        sketch.fill(color);
        sketch.square(x, y, 1);
      });
      sketch.pop();
    };
  },
);
