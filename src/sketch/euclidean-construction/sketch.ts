import { button, divider, row, section } from "../../controls.ts";
import { receive, Sketch } from "../../lab.ts";
import { hexagon } from "./constructions.ts";
import { Construction } from "./lib.ts";

const Controller = [
  section("Drawing", []),
  divider(),
  section("Elementary", [
    row([
      button("hand", "Hand"),
      button("point", "Point"),
      button("line", "Line"),
      button("circle", "Circle"),
    ]),
  ]),
  section("Compound", [
    button("intersection", "Intersection"),
    button("perp-bisector", "Perpendicular Bisector"),
    button("midpoint", "Midpoint"),
    button("erected-perp", "Erected Perpendicular"),
    button("circumcenter", "Circumcenter"),
    button("circle-thru-3", "Circle thru 3"),
  ]),
] as const;

class EuclideanConstruction extends Sketch<typeof Controller> {
  readonly schema = Controller;

  private construction!: Construction;
  private mouse!: ReturnType<typeof this.p5.createVector>;

  override setup(): void {
    const { p5 } = this;
    this.construction = new Construction(p5, false);
    this.mouse = p5.createVector();

    this.construction
      .point({
        name: "mouse",
        vector: this.mouse,
        visible: true,
        color: p5.color("pink"),
      })
      .point({
        name: "O",
        vector: p5.createVector(),
        visible: true,
        color: p5.color("white"),
      })
      .point({
        name: "i",
        vector: p5.createVector(100, 0),
        visible: true,
        color: p5.color("lightgreen"),
      })
      .point({
        name: "j",
        vector: p5.createVector(0, 100),
        visible: true,
        color: p5.color("lightgreen"),
      })
      .line({
        name: "x-axis",
        point1: "O",
        point2: "i",
        color: p5.color("gray"),
        visible: true,
      })
      .line({
        name: "y-axis",
        point1: "O",
        point2: "j",
        color: p5.color("gray"),
        visible: true,
      })
      .line({
        name: "vector",
        point1: "O",
        point2: "mouse",
        color: p5.color("pink"),
        segment: true,
        visible: true,
      });

    hexagon({ construction: this.construction, prefix: "hex", center: "O", edge: "mouse" });

    this.controls.subscribe("hand", () => {});
    this.controls.subscribe("point", () => {});
    this.controls.subscribe("line", () => {});
    this.controls.subscribe("circle", () => {});
    this.controls.subscribe("intersection", () => {});
    this.controls.subscribe("perp-bisector", () => {});
    this.controls.subscribe("midpoint", () => {});
    this.controls.subscribe("erected-perp", () => {});
    this.controls.subscribe("circumcenter", () => {});
    this.controls.subscribe("circle-thru-3", () => {});
  }

  update(): void {}

  draw(): void {
    const { p5 } = this;
    p5.background(0);
    p5.translate(p5.width / 2, p5.height / 2);
    p5.scale(1, -1);
    this.mouse.set(p5.mouseX - p5.width / 2, p5.height / 2 - p5.mouseY);
    this.construction.draw();
  }
}

receive(EuclideanConstruction);
