import p5 from "p5";
import { Vec2 } from "../../../common.ts";
import { castWhiskers, walls, whiskers } from "../boundary.ts";
import { type Boid, probeConfig, probeContext, type SteeringParams } from "./boid.ts";
import type { ForceComponent } from "./forces.ts";

/**
 * This sketch runs in HSB mode, so every colour is given explicit components —
 * a bare two-argument `fill()` reads as hue/saturation here, not grey/alpha.
 */

/** Field-of-view wedge (or full circle at 360°). Outlined, not filled: a
 * whole flock showing FOV at once would otherwise saturate stacked
 * translucent wedges to a solid wash. */
function drawPerception(p: p5, boid: Boid, heading: number, fov: number) {
  const { x, y } = boid.position;
  const radius = boid.perceptionRadius;

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
}

/** Highlight the neighbours currently inside this boid's FOV. */
function drawPerceived(p: p5, boid: Boid) {
  p.noStroke();
  p.fill(p.color(0, 0, 1, 0.35));

  for (const other of boid.getPerceived()) {
    p.circle(other.position.x, other.position.y, other.size + 10);
  }
}

/** The whole whisker fan that gets tested, with hits marked. */
function drawWhiskers(p: p5, boid: Boid, params: SteeringParams) {
  const context = probeContext(boid);
  if (!context) return;

  const segments = walls(params.avoid.boundaries);
  const fan = castWhiskers(whiskers(probeConfig(params), context), segments, context);

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
}

/** Length of a force vector on screen, per unit of magnitude. */
const FORCE_SCALE = 50;

function drawVector(p: p5, x: number, y: number, v: Vec2, label: string) {
  const ex = x + v.x * FORCE_SCALE;
  const ey = y + v.y * FORCE_SCALE;

  p.line(x, y, ex, ey);
  p.noStroke();
  p.circle(ex, ey, 4);
  p.text(label, ex + 5, ey - 3);
}

/** Each labelled steering component, plus the resultant the boid steers by. */
function drawForces(
  p: p5,
  boid: Boid,
  params: SteeringParams,
  components: readonly ForceComponent[],
) {
  const { x, y } = boid.position;

  p.textSize(11);
  for (const { label, color, force } of components) {
    const vector = force(boid, params);
    if (vector.magSq() < 1e-12) continue;

    p.stroke(p.color(color));
    p.fill(p.color(color));
    p.strokeWeight(2);
    drawVector(p, x, y, vector, label);
  }

  const total = components.reduce((sum, c) => sum.add(c.force(boid, params)), new Vec2());
  p.stroke(p.color("cyan"));
  p.fill(p.color("cyan"));
  p.strokeWeight(3);
  drawVector(p, x, y, total, "total");
  p.strokeWeight(1);
}

/** The arrowhead, pointing along the heading. */
function drawBody(p: p5, boid: Boid, heading: number, color: p5.Color) {
  const radius = boid.size / 2;

  p.push();
  p.translate(boid.position.x, boid.position.y);
  p.rotate(heading);
  p.fill(color);
  p.noStroke();

  p.beginShape();
  p.vertex(radius, 0);
  p.vertex(-radius * 0.6, radius * 0.6);
  p.vertex(-radius * 0.2, 0);
  p.vertex(-radius * 0.6, -radius * 0.6);
  p.endShape(p.CLOSE);

  p.pop();
}

export interface DrawOptions {
  color: p5.Color;
  body?: boolean;
  fov?: number;
  perceived?: boolean;
  whiskers?: boolean;
  forces?: readonly ForceComponent[];
}

export function drawBoid(p: p5, boid: Boid, params: SteeringParams, options: DrawOptions) {
  const heading = boid.velocity.heading();

  if (options.fov !== undefined) drawPerception(p, boid, heading, options.fov);
  if (options.body ?? true) drawBody(p, boid, heading, options.color);
  if (options.perceived) drawPerceived(p, boid);
  if (options.whiskers) drawWhiskers(p, boid, params);
  if (options.forces) drawForces(p, boid, params, options.forces);
}
