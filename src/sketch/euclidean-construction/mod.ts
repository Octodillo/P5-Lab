import { initSketch } from "../../lab.ts";
import { section, row, button, divider } from "../../controls.ts";
import { hexagon } from "./constructions.ts";
import { Construction } from "./lib.ts";

initSketch(
  [
    section("Drawing", []),
    divider(),
    section("Elementary", [
      row([button("hand", "Hand"), button("point", "Point"), button("line", "Line"), button("circle", "Circle")]),
    ]),
    section("Compound", [
      button("intersection", "Intersection"),
      button("perp-bisector", "Perpendicular Bisector"),
      button("midpoint", "Midpoint"),
      button("erected-perp", "Erected Perpendicular"),
      button("circumcenter", "Circumcenter"),
      button("circle-thru-3", "Circle thru 3"),
    ]),
  ],
  ({ p5: sketch, controls }) => {
    const construction = new Construction(sketch, false);
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
        color: sketch.color("white"),
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
        visible: true,
      })
      .line({
        name: "y-axis",
        point1: "O",
        point2: "j",
        color: sketch.color("gray"),
        visible: true,
      })
      .line({
        name: "vector",
        point1: "O",
        point2: "mouse",
        color: sketch.color("pink"),
        segment: true,
        visible: true,
      });

    hexagon({ construction, prefix: "hex", center: "O", edge: "mouse" });

    // hexagon({ construction, prefix: "hexagon", center: "O", edge: "mouse" });

    // Subscribe to button clicks
    controls.subscribe("hand", () => {});
    controls.subscribe("point", () => {});
    controls.subscribe("line", () => {});
    controls.subscribe("circle", () => {});
    controls.subscribe("intersection", () => {});
    controls.subscribe("perp-bisector", () => {});
    controls.subscribe("midpoint", () => {});
    controls.subscribe("erected-perp", () => {});
    controls.subscribe("circumcenter", () => {});
    controls.subscribe("circle-thru-3", () => {});

    sketch.draw = () => {
      sketch.background(0);
      sketch.translate(sketch.width / 2, sketch.height / 2);
      sketch.scale(1, -1);
      mouse.set(sketch.mouseX - sketch.width / 2, sketch.height / 2 - sketch.mouseY);
      construction.draw();
    };
  },
);
