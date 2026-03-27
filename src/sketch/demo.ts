import {
  button,
  checkbox,
  divider,
  option,
  radio,
  row,
  section,
  select,
  SelectDesc,
  slider,
  SliderDesc,
  stat,
} from "../controls.ts";
import { Sketch, receive } from "../lab.ts";

const Shapes = ["square", "circle", "triangle"] as const;
type Shape = (typeof Shapes)[number];

const Controller = [
  section("Shape", [
    button("randomize", "Randomize"),
    row([
      radio("shape", "square", "Square", true),
      radio("shape", "circle", "Circle"),
      radio("shape", "triangle", "Triangle"),
    ]),
    row([checkbox("outline", "Outline", true), checkbox("pulse", "Pulse")]),
    select("color", [
      option("Indigo", "#6366f1"),
      option("Emerald", "#10b981"),
      option("Rose", "#f43f5e"),
      option("Amber", "#f59e0b"),
      option("Cyan", "#06b6d4"),
    ]),
    slider("size", 20, 200, 80, 1),
  ]),
  divider(),
  section("Animation", [slider("speed", 0, 100, 50, 1), stat("info", "")]),
] as const;

class ControlsDemo extends Sketch<typeof Controller> {
  readonly schema = Controller;

  private rotation = 0;
  private pulsePhase = 0;

  override setup(): void {
    this.controls.subscribe("randomize", () => {
      this.controls.set("pulse", Math.random() > 0.5);
      this.controls.set("outline", Math.random() > 0.5);

      const colors = this.controls.about<SelectDesc>("color")!.options;
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      this.controls.set("color", randomColor.value);

      const size = this.controls.about("size")!;
      this.controls.set("size", this.p5.random(size.min, size.max).toFixed());

      const speed = this.controls.about<SliderDesc>("speed")!;
      this.controls.set("speed", this.p5.random(speed.min, speed.max).toFixed());
    });
  }

  update(): void {
    const { speed } = this.controls.values;
    this.rotation += speed / 2500;
    this.pulsePhase += 0.05;
  }

  draw(): void {
    const { p5 } = this;
    const { shape, outline, pulse, color, size } = this.controls.values;

    p5.background(30);

    const pulseFactor = pulse ? 1 + Math.sin(this.pulsePhase) * 0.2 : 1;
    const currentSize = size * pulseFactor;

    this.controls.set("info", `${shape} | ${Math.round(currentSize)}px`);

    p5.push();
    p5.translate(p5.width / 2, p5.height / 2);
    p5.rotate(this.rotation);

    p5.fill(color);
    if (outline) {
      p5.stroke(255);
      p5.strokeWeight(2);
    } else {
      p5.noStroke();
    }

    switch (shape as Shape) {
      case "square":
        p5.rectMode(p5.CENTER);
        p5.rect(0, 0, currentSize, currentSize);
        break;
      case "circle":
        p5.ellipse(0, 0, currentSize, currentSize);
        break;
      case "triangle": {
        const h = (currentSize * Math.sqrt(3)) / 2;
        p5.triangle(0, -h / 2, -currentSize / 2, h / 2, currentSize / 2, h / 2);
        break;
      }
    }

    p5.pop();
  }
}

receive(ControlsDemo);
