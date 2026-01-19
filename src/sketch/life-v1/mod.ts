import { SketchController } from "../common.ts";
import { LifeModel } from "./life.ts";

new SketchController((p, controls) => {
  const life = new LifeModel(
    {
      sketch: p,
      center: p.createVector(0, 0),
      scale: 20, // Will be overridden by auto-fit on initialization
      grid: undefined,
      colors: {
        grid: {},
      },
    },
    controls
  );
  const origin = p.createVector(0, 0);
  // [origin, ...life.neighborPositions(origin)].forEach(pos => life.set(pos, Star));
  // life.stamp(GosperGliderGun, origin.sub(19, 10));
  // life.stamp(LaserGun, origin);
  // life.set(origin, Gnarl);
  // life.set(p.createVector(1, 0), Star);

  p.draw = () => life.draw();
}).init();
