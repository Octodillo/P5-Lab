// Obsolete, outdated, broken

import { initSketch } from "../../sketch.ts";
import { LifeModel } from "./life.ts";
import * as Rules from "../rules.ts";
import {
  button,
  divider,
  option,
  radio,
  row,
  section,
  select,
  stat,
  textInput,
} from "../../controls.ts";

type BrushType = "draw" | "erase" | "stamp";

const builtInRules = Object.entries(Rules)
  .filter(([key]) => key !== "default")
  .map(([_, rule]) => option(rule.name, rule.name));

const stampOptions = [
  option("Glider", "Glider"),
  option("Small Exploder", "SmallExploder"),
  option("Lightweight Spaceship", "LightweightSpaceship"),
  option("Tumbler", "Tumbler"),
  option("Gosper Glider Gun", "GosperGliderGun"),
  option("Laser Gun", "LaserGun"),
];

initSketch(
  [
    section("Simulation", [
      button("step", "▶ Single Step"),
      button("togglePlay", "▶▶ Play"),
      button("toggleZoom", "🔓 Auto Zoom"),
      button("clear", "Clear"),
    ]),
    divider(),
    section("Drawing", [
      row([
        radio<BrushType>("brushType", "draw", "Draw", true),
        radio<BrushType>("brushType", "erase", "Erase"),
        radio<BrushType>("brushType", "stamp", "Stamp"),
      ]),
      select("ruleSelect", builtInRules, Rules.GOL.name),
      select("stampSelect", stampOptions, "Glider"),
      textInput("ruleName", "", "Name"),
      textInput("ruleBorn", "", "Born (comma separated)"),
      textInput("ruleLive", "", "Live (comma separated)"),
      textInput("ruleDecay", "", "Decay frames"),
      textInput("ruleColor", "", "Color (hex)"),
      button("saveRule", "Save Rule"),
      stat("hoverInfo", ""),
    ]),
    divider(),
    section("Stats", [
      stat("cellCount", "Cells: 0"),
      stat("volatile", "Active: 0"),
      stat("scale", "Zoom: 1.00x"),
      stat("center", "Pan: (0, 0)"),
    ]),
  ],
  ({ p5: p, controls }) => {
    const life = new LifeModel(
      {
        sketch: p,
        center: p.createVector(0, 0),
        scale: 20,
        grid: undefined,
        colors: { grid: {} },
      },
      controls,
    );

    p.draw = () => life.draw();
  },
);
