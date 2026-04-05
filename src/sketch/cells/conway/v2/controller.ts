import {
  section,
  checkbox,
  row,
  button,
  slider,
  divider,
  radio,
  tabs,
  select,
  option,
  textInput,
  numberInput,
  stat,
} from "../../../../controls.ts";

import Rules from "../rules.ts";
import Stamps from "./stamps.ts";

export default [
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
