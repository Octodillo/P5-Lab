import { number2, SketchController } from "../common.ts";
import { Life } from "./model.ts";
import Rules from "../life-v1/rules.ts";
import { Glider, GosperGliderGun } from "../life-v2/stamps.ts";

new SketchController((sketch, controls) => {
  const life = new Life();
  life.stamp([0, 0], GosperGliderGun);
  // life.place([0, 0], Rules.Gnarl);
  // life.place([0, 1], Rules.Star);
  // life.stamp([0, 0], Glider);

  const center: number2 = [0, 200]; // x,y
  let scale = 20;

  let asap = -1;
  let frame = false;

  let zoom = false;

  function getTargetFit() {
    const padding = 20;

    const [low, high] = life.bounds();
    const [width, height] = [high[0] - low[0] + 1 + padding, high[1] - low[1] + 1 + padding];
    const [scaleX, scaleY] = [sketch.width / width, sketch.height / height];
    const targetScale = Math.min(scaleX, scaleY);
    const [targetX, targetY] = [
      -((low[0] + high[0] + 1) / 2) * targetScale,
      -((low[1] + high[1] + 1) / 2) * targetScale,
    ];
    const ret = { scale: targetScale, x: targetX, y: targetY };
    return ret;
  }

  function approachTargetFit(speed: number) {
    const fit = getTargetFit();
    scale += (fit.scale - scale) * speed;
    center[0] += (fit.x - center[0]) * speed;
    center[1] += (fit.y - center[1]) * speed;
  }

  sketch.draw = () => {
    if (frame) life.update();
    if (zoom) approachTargetFit(0.15);

    sketch.push();
    sketch.colorMode("hsl", 1); // easiest to think about
    sketch.background(0);
    sketch.translate(sketch.width / 2 + center[0], sketch.height / 2 + center[1]);
    sketch.scale(scale);

    life.all().forEach(({ item: cell, position: [x, y] }) => {
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

  controls
    .section("Simulation")
    .row("Playback")
    .button("Step", () => life.update())
    .checkbox("Play", "Play", false, play => (frame = play))
    .checkbox("Turbo", "Turbo", false, turbo => {
      if (turbo)
        asap = setInterval(
          () =>
            Array(5)
              .fill(0)
              .forEach(() => life.update()),
          0
        );
      else clearInterval(asap);
    });

  controls
    .divider()
    .section("View")
    .row("Zoom")
    .button("Fit", () => approachTargetFit(1))
    .checkbox("Auto", "Auto", false, auto => (zoom = auto));
}).init();
