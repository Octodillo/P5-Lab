import { initSketch } from "../../sketch.ts";
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
} from "../../controls.ts";

const Shapes = ["square", "circle", "triangle"] as const;
type Shape = (typeof Shapes)[number];

initSketch(
  [
    section("Shape", [
      button("randomize", "Randomize"),
      row([
        radio<Shape>("shape", "square", "Square", true),
        radio<Shape>("shape", "circle", "Circle"),
        radio<Shape>("shape", "triangle", "Triangle"),
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
  ],
  ({ p5, controls }) => {
    // State derived from controls
    let shape: Shape = "square";
    let showOutline = true;
    let pulseEnabled = false;
    let shapeColor = "#6366f1";
    let shapeSize = 80;
    let rotationSpeed = 0.02;

    // Animation state
    let rotation = 0;
    let pulsePhase = 0;

    // Wire up observers
    controls.subscribe<Shape>("shape", v => (shape = v));
    controls.subscribe<boolean>("outline", v => (showOutline = v));
    controls.subscribe<boolean>("pulse", v => (pulseEnabled = v));
    controls.subscribe<string>("color", v => (shapeColor = v));
    controls.subscribe<number>("size", v => (shapeSize = v));
    controls.subscribe<number>("speed", v => (rotationSpeed = v / 2500));

    // Button click handler
    controls.subscribe("randomize", () => {
      const _randomShape = Shapes[Math.floor(Math.random() * Shapes.length)];
      // set random shape !?

      controls.set("pulse", Math.random() > 0.5);
      controls.set("outline", Math.random() > 0.5);

      const colors = controls.about<SelectDesc>("color")!.options;
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      controls.set("color", randomColor.value);

      const size = controls.about<SliderDesc>("size")!;
      controls.set("size", p5.random(size.min, size.max).toFixed());

      const speed = controls.about<SliderDesc>("speed")!;
      controls.set("speed", p5.random(speed.min, speed.max).toFixed());
    });

    p5.draw = () => {
      p5.background(30);

      rotation += rotationSpeed;
      pulsePhase += 0.05;

      // Calculate pulse effect
      const pulseFactor = pulseEnabled ? 1 + Math.sin(pulsePhase) * 0.2 : 1;
      const currentSize = shapeSize * pulseFactor;

      // Update stat
      controls.set("info", `${shape} | ${Math.round(currentSize)}px`);

      // Draw shape
      p5.push();
      p5.translate(p5.width / 2, p5.height / 2);
      p5.rotate(rotation);

      p5.fill(shapeColor);
      if (showOutline) {
        p5.stroke(255);
        p5.strokeWeight(2);
      } else {
        p5.noStroke();
      }

      switch (shape) {
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
    };
  },
);
