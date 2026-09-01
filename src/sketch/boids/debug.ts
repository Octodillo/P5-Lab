import p5 from "p5";
import { decide } from "../../decision.ts";
import type { Boid } from "./boid.ts";
import { castWhiskers, walls, whiskers } from "./boundary.ts";

/**
 * Debug overlays for a single boid.
 *
 * Each is an independent layer the boid's `display` config can switch on. They
 * live here rather than in `Boid.draw` so the class keeps to simulation state
 * and its own body, and so the overlays can be read as a set.
 *
 * This sketch runs in HSB mode, so every colour is given explicit components —
 * a bare two-argument `fill()` reads as hue/saturation here, not grey/alpha.
 */

/** Field-of-view wedge (or full circle at 360°). */
export const drawPerception = (p: p5, boid: Boid, heading: number) => {
  const { x, y } = boid.config.position;
  const { radius } = boid.config.perception;
  const fov = decide(boid.config.perception.angle, boid);

  // Outlined rather than filled: with a whole flock showing FOV at once,
  // stacked translucent wedges saturate to a solid wash.
  p.noFill();
  p.strokeWeight(1);
  p.stroke(p.color(0, 0, 1, 0.18));

  if (fov >= 360) {
    p.circle(x, y, 2 * radius);
    return;
  }

  // Wedge centered on the heading, so the blind spot astern is visible.
  const half = (fov * Math.PI) / 360;
  p.arc(x, y, 2 * radius, 2 * radius, heading - half, heading + half, p.PIE);
};

/** Highlight the neighbours currently inside this boid's FOV. */
export const drawPercieved = (p: p5, boid: Boid) => {
  p.noStroke();
  p.fill(p.color(0, 0, 1, 0.35));

  for (const other of boid.percieved) {
    p.circle(other.config.position.x, other.config.position.y, other.config.display.size + 10);
  }
};

/** The whole whisker fan that gets tested, with hits marked. */
export const drawWhiskers = (p: p5, boid: Boid) => {
  const probe = boid.config.bounds?.probe;
  if (!probe) return;

  const context = boid.probeContext();
  if (!context) return;

  const segments = walls(decide(boid.config.bounds!.groups, boid));
  const fan = castWhiskers(whiskers(probe, context), segments, context);

  p.noFill();
  for (const w of fan) {
    const clear = w.distance === Infinity;
    const reach = clear ? w.range : w.distance;

    p.strokeWeight(clear ? 1 : 2);
    p.stroke(clear ? p.color(0, 0, 0.55, 0.5) : p.color("orange"));
    p.line(context.x, context.y, context.x + w.dx * reach, context.y + w.dy * reach);

    if (!clear) {
      p.stroke(p.color("red"));
      p.strokeWeight(2);
      p.circle(context.x + w.dx * w.distance, context.y + w.dy * w.distance, 6);
    }
  }
  p.strokeWeight(1);
};

/** Length of a force vector on screen, per unit of magnitude. */
const FORCE_SCALE = 50;

const drawVector = (p: p5, x: number, y: number, vx: number, vy: number, label: string) => {
  const ex = x + vx * FORCE_SCALE;
  const ey = y + vy * FORCE_SCALE;

  p.line(x, y, ex, ey);
  p.noStroke();
  p.circle(ex, ey, 4);
  p.text(label, ex + 5, ey - 3);
};

/** Each labelled steering component, plus the resultant the boid steers by. */
export const drawForces = (p: p5, boid: Boid) => {
  const { x, y } = boid.config.position;
  const context = { self: boid, percieved: boid.percieved };

  p.textSize(11);
  for (const { label, color, force } of boid.config.display.forceComponents ?? []) {
    const vector = decide(force, context);
    if (vector.magSq() < 1e-12) continue;

    p.stroke(p.color(color));
    p.fill(p.color(color));
    p.strokeWeight(2);
    drawVector(p, x, y, vector.x, vector.y, label);
  }

  const total = decide(boid.config.steering, context);
  p.stroke(p.color("cyan"));
  p.fill(p.color("cyan"));
  p.strokeWeight(3);
  drawVector(p, x, y, total.x, total.y, "total");
  p.strokeWeight(1);
};
