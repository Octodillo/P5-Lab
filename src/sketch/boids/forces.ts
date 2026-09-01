import p5 from "p5";
import { Vec2 } from "../../common.ts";
import { decide, Decider, proxy } from "../../decision.ts";
import type { Boid } from "./boid.ts";
import { pressure, probe, type ProbeContext, walls } from "./boundary.ts";

/**
 * A steering force, resolved against the boid applying it and the flockmates it
 * can currently see. Deciders throughout, so control values are read live
 * rather than baked in when the flock is built.
 */
export type Force = Decider<Vec2, ForceContext>;
export interface ForceContext {
  self: Boid;
  percieved: Boid[];
}

const zero = () => new Vec2(0, 0);

/** Skip a force entirely when the boid sees nobody — every flocking term needs neighbours. */
export const social = (force: Force): Force => (ctx) =>
  ctx.percieved.length === 0 ? zero() : decide(force, ctx);

// -- Combinators --------------------------------------------------------------

export const add = (...forces: Force[]): Force => (ctx) =>
  forces.reduce((sum, force) => sum.add(decide(force, ctx)), zero());

export const average = (...forces: Force[]): Force =>
  proxy(add(...forces), (sum) => sum.div(forces.length || 1));

export const weight = (force: Force, w: number): Force => proxy(force, (v) => v.mult(w));

// -- Flocking -----------------------------------------------------------------

export const align = (strength: number): Force =>
  social(({ self, percieved }) => {
    const avg = zero();
    for (const boid of percieved) avg.add(boid.config.velocity.copy().normalize());
    avg.div(percieved.length);

    return avg.sub(self.config.velocity.copy().normalize()).mult(strength);
  });

export const cohese = (strength: number): Force =>
  social(({ self, percieved }) => {
    const center = zero();
    for (const boid of percieved) center.add(boid.config.position);
    center.div(percieved.length);

    const toCenter = center.sub(self.config.position);
    const d = toCenter.mag();
    if (d < 1e-6) return zero();

    // Bell curve: 4·(d/R)·(1 - d/R), peaking at 1.0 when d = R/2. Near the
    // center it fades to nothing (no clumping) and so does it near the edge
    // (no shoving distant boids in); the pull is strongest in between.
    const t = Math.min(d / self.config.perception.radius, 1);
    const bell = 4 * t * (1 - t);

    return toCenter.normalize().mult(strength * bell);
  });

/**
 * Push away from crowding neighbours.
 *
 * Two changes from the obvious formulation, both to stop this force spiking
 * while `align` and `cohese` stay smooth:
 *
 * - **Averaged, not summed.** Summing makes the magnitude scale with crowd
 *   size — near-zero whenever nobody is close, then enormous the moment
 *   several neighbours converge. That is what pushed the strength slider two
 *   orders of magnitude above its siblings and made the force feel spiky.
 *   Averaging bounds it by `strength` at any density; direction still resolves
 *   correctly because opposing neighbours cancel before the divide.
 * - **Linear ramp, not quadratic.** `t²` spends most of its range near zero,
 *   so the force stays negligible right up until contact and then slams on.
 *   Linear starts pushing earlier and more gently.
 *
 * Measured over 300 boids × 1200 frames × 5 seeds, this holds boids apart
 * slightly *better* than the old sum-of-quadratics (1.6 vs 2.4 mean overlaps)
 * while cutting the magnitude's max/median ratio from ~17500 to ~42.
 *
 * Note that averaging alone is not enough: dropping the per-neighbour
 * reinforcement entirely (normalising the direction and scaling by only the
 * nearest neighbour's urgency) measured far worse — 9-60 overlaps — because
 * a dense cluster genuinely does need several neighbours pushing the same way
 * to reinforce each other.
 *
 * The smoothness is not unconditional, which is why the slider tops out where
 * it does. Past ~50 strength the flock compresses into clusters where many
 * neighbours sit deep inside the separation radius at once, the ramp leaves
 * its gentle region, and spikiness climbs back to old levels (~14000 at 55,
 * ~28000 at 70) even though overlaps stay low. Around 40 is the knee: firm
 * enough to keep boids apart, loose enough to stay smooth.
 */
export const separate = (strength: number, reach = 2): Force => ({ self, percieved }) => {
  const force = zero();
  let contributors = 0;

  for (const boid of percieved) {
    const diff = Vec2.sub(self.config.position, boid.config.position);
    const d = diff.mag();
    const radius = reach * (self.config.display.size / 2 + boid.config.display.size / 2);
    if (d >= radius || d < 1e-6) continue;

    // Linear ramp: full strength at d=0, zero at d=radius.
    force.add(diff.normalize().mult(strength * (1 - d / radius)));
    contributors++;
  }

  if (contributors > 1) force.div(contributors);
  return force;
};

export const flock = (alignment: number, cohesion: number, separation: number, reach = 2): Force =>
  average(align(alignment), cohese(cohesion), separate(separation, reach));

// -- Targeting ----------------------------------------------------------------

export const cruise = (target: number, strength: number): Force => ({ self }) => {
  const { velocity } = self.config;
  return velocity.copy().normalize().mult((target - velocity.mag()) * strength);
};

export const seek = (target: Decider<Vec2, Boid>, strength = 1): Force => ({ self }) =>
  decide(target, self).copy().sub(self.config.position).setMag(strength);

export const flee = (target: Decider<Vec2, Boid>, strength = 1): Force => ({ self }) =>
  self.config.position.copy().sub(decide(target, self)).setMag(strength);

/** Random walk: the heading drifts by up to `jitter` radians per frame. */
export const wander = (strength = 1, jitter = 0.1): Force => {
  let angle = Math.random() * Math.PI * 2;
  return () => {
    angle += (Math.random() - 0.5) * jitter;
    return new Vec2(Math.cos(angle), Math.sin(angle)).mult(strength);
  };
};

// -- Screen edges -------------------------------------------------------------
// Simple alternatives to the `avoid` + `enforce` wall system, for sketches that
// only need to be kept on-screen and do not place obstacles.

/** Steer away from the canvas edges, ramping up within `margin` of each one. */
export const contain = (p: p5, strength = 1, margin = 50): Force => ({ self }) => {
  const { position } = self.config;
  const force = zero();

  const hw = p.width / 2;
  const hh = p.height / 2;

  // Quadratic ramp: exactly zero outside margin, grows smoothly within it.
  // Past the wall (dist < 0), force keeps growing — no cap needed.
  const ramp = (distToWall: number) => {
    if (distToWall >= margin) return 0;
    const t = 1 - distToWall / margin;
    return t * t;
  };

  force.x += strength * ramp(position.x + hw) - strength * ramp(hw - position.x);
  force.y += strength * ramp(position.y + hh) - strength * ramp(hh - position.y);

  return force;
};

/**
 * Teleport across the canvas on exit, so the world is a torus.
 *
 * A positional effect rather than a real force — it returns zero and mutates
 * the boid — but it is shaped as a Force so it can sit in the same steering
 * list as everything else.
 */
export const wrap = (p: p5): Force => ({ self }) => {
  const { position } = self.config;
  const hw = p.width / 2;
  const hh = p.height / 2;

  if (position.x < -hw) position.x = hw;
  if (position.x > hw) position.x = -hw;
  if (position.y < -hh) position.y = hh;
  if (position.y > hh) position.y = -hh;

  return zero();
};

// -- Boundary avoidance -------------------------------------------------------

export interface AvoidConfig {
  /** Steering strength applied at the moment of an imminent hit. */
  strength: Decider<number, ProbeContext>;
  /**
   * Distance within which walls push regardless of heading, as a safety net
   * for boids shoved sideways into a wall by their flock. 0 disables it.
   */
  margin: Decider<number, ProbeContext>;
  /** Strength of that proximity push. */
  pressure: Decider<number, ProbeContext>;
}

/**
 * Predictive boundary avoidance.
 *
 * Casts a fan of whiskers along the heading and steers away from the first
 * wall they hit, ramping up as the impact gets closer. Because the ray length
 * scales with speed, a fast boid commits to its turn early enough to complete
 * it — which is what actually keeps it from crossing, rather than a positional
 * clamp that only reacts once the boid is already at the wall.
 *
 * Steering is purely lateral: the force is always perpendicular to the boid's
 * heading, picking whichever side leads away from the wall. A boid carries
 * momentum it cannot reverse, so braking into an obstacle only stalls it in
 * place; turning is the manoeuvre that actually resolves the situation.
 */
export const avoid = (config: AvoidConfig): Force => ({ self }) => {
  const force = zero();
  if (!self.config.bounds?.probe) return force;

  const context = self.probeContext();
  if (!context) return force;

  const segments = walls(decide(self.config.bounds.groups, self));

  const hit = probe(segments, self.config.bounds.probe, context);
  if (hit) {
    // Both candidate directions are perpendicular to the *heading* (not to the
    // wall), so the steer can only rotate the boid, never oppose its travel.
    const leftX = -context.dy;
    const leftY = context.dx;

    // Pick the side that gets away from the wall: whichever perpendicular has
    // a positive component along the outward normal.
    const { nx, ny } = hit.bound;
    let dot = leftX * nx + leftY * ny;
    // Exactly head-on: no preferred side from the normal, so break the tie with
    // the wall's tangent to keep neighbouring boids turning together.
    if (Math.abs(dot) < 1e-6) dot = leftX * -ny + leftY * nx;
    const sign = dot >= 0 ? 1 : -1;

    // Urgency scales the magnitude — the turn gets harder as the wall closes —
    // but the direction stays purely lateral at every distance.
    const mag = decide(config.strength, context) * (1 - hit.slack);
    force.x += leftX * sign * mag;
    force.y += leftY * sign * mag;
  }

  const margin = decide(config.margin, context);
  if (margin > 0) {
    const push = pressure(segments, context.x, context.y, margin, zero());

    // `pressure` is deliberately heading-agnostic — it is the safety net for a
    // boid shoved sideways into a wall. But its raw push points straight off
    // the surface, which for a boid facing the wall is mostly *backwards*.
    // Drop that braking component and keep only what turns or clears it.
    const backwards = push.x * context.dx + push.y * context.dy;
    if (backwards < 0) {
      push.x -= context.dx * backwards;
      push.y -= context.dy * backwards;
    }

    force.add(push.mult(decide(config.pressure, context)));
  }

  return force;
};
