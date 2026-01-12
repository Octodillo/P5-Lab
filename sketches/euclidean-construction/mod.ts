import { SketchController, ButtonControl, RowBuilder } from "../common.ts";
import { hexagon } from "./constructions.ts";
import { Construction } from "./lib.ts";

new SketchController((sketch, controls) => {
  const construction = new Construction(sketch, true);
  const mouse = sketch.createVector();
  construction
    .point({
      name: "mouse",
      vector: mouse,
      visible: true,
      color: sketch.color("pink"),
    })
    .point({
      name: "O",
      vector: sketch.createVector(),
      visible: true,
      color: sketch.color("lightblue"),
    })
    .point({
      name: "i",
      vector: sketch.createVector(100, 0),
      visible: true,
      color: sketch.color("lightgreen"),
    })
    .point({
      name: "j",
      vector: sketch.createVector(0, 100),
      visible: true,
      color: sketch.color("lightgreen"),
    })
    .line({
      name: "x-axis",
      point1: "O",
      point2: "i",
      color: sketch.color("gray"),
    })
    .line({
      name: "y-axis",
      point1: "O",
      point2: "j",
      color: sketch.color("gray"),
    });

  // hexagon({ construction, prefix: "hexagon", center: "O", edge: "mouse" });

  sketch.draw = () => {
    sketch.background(0);
    sketch.translate(sketch.width / 2, sketch.height / 2);
    sketch.scale(1, -1);
    mouse.set(sketch.mouseX - sketch.width / 2, sketch.height / 2 - sketch.mouseY);
    construction.draw();
  };

  controls.section("Drawing");

  controls.divider();

  controls
    .section("Elementary")
    .row("Tools")
    .button("Hand", () => {})
    .button("Point", () => {})
    .button("Line", () => {})
    .button("Circle", () => {})
    .endRow();

  controls
    .section("Compound")
    .button("Intersection", () => {})
    .button("Perpendicular Bisector", () => {})
    .button("Midpoint", () => {})
    .button("Erected Perpendicular", () => {})
    .button("Circumcenter", () => {})
    .button("Circle thru 3", () => {});

  // Example: programmatically click the Hand button
  controls.get("Elementary").get<RowBuilder>("Tools").get<ButtonControl>("Hand").click();
}).init();
