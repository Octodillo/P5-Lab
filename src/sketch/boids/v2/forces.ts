import { Vec2 } from "../../../common.ts";
import { escape, threats, walls } from "../boundary.ts";
import { Boid, probeConfig, probeContext, STATIONARY, type SteeringParams } from "./boid.ts";

export type Force = (self: Boid, params: SteeringParams) => Vec2;

/** A force paired with the label/color its debug overlay draws it as. */
export interface ForceComponent {
  label: string;
  color: string;
  force: Force;
}

const social = (force: Force): Force => (self: Boid, params: SteeringParams) =>
  self.getPerceived().length === 0 ? new Vec2() : force(self, params);

export const align = social((self, params) =>
  self
    .getPerceived()
    .reduce((sum, other) => sum.add(other.velocity.copy().normalize()), new Vec2())
    .div(self.getPerceived().length)
    .sub(self.velocity.copy().normalize())
    .mult(params.alignment)
);

/**
 * Bell curve: 4·(d/R)·(1 - d/R), peaking at 1.0 when d = R/2. Near the center
 * it fades to nothing (no clumping) and so does it near the edge (no shoving
 * distant boids in); the pull is strongest in between.
 */
export const cohese = social((self, params) => {
  const perceived = self.getPerceived();
  const center = perceived.reduce((sum, other) => sum.add(other.position), new Vec2()).div(
    perceived.length,
  );

  const toCenter = center.sub(self.position);
  const d = toCenter.mag();
  if (d < 1e-6) return new Vec2();

  const t = Math.min(d / self.perceptionRadius, 1);
  const bell = 4 * t * (1 - t);

  return toCenter.normalize().mult(params.cohesion * bell);
});

/**
 * Push away from crowding neighbours. Averaged (not summed) so the magnitude
 * stays bounded regardless of crowd size, and ramped linearly (not
 * quadratically) so it starts pushing gently well before contact. See v1's
 * `separate` for the measurements behind these two choices.
 */
export const separate: Force = (self, params) => {
  const force = new Vec2();
  let contributors = 0;

  for (const other of self.getPerceived()) {
    const diff = self.position.copy().sub(other.position);
    const d = diff.mag();
    const radius = params.separation.reach * (self.size / 2 + other.size / 2);
    if (d >= radius || d < 1e-6) continue;

    force.add(diff.normalize().mult(params.separation.strength * (1 - d / radius)));
    contributors++;
  }

  if (contributors > 1) force.div(contributors);
  return force;
};

export const flock: Force = (self, params) =>
  align(self, params).add(cohese(self, params)).add(separate(self, params)).div(3);

/** Steer toward (or away from, with a negative target) a baseline speed. */
export const cruise: Force = (self, params) => {
  const speed = self.velocity.mag();
  if (speed < STATIONARY) return new Vec2();
  return self.velocity
    .copy()
    .normalize()
    .mult((params.cruise.target - speed) * params.cruise.strength);
};

/**
 * Predictive boundary avoidance.
 *
 * Whiskers find the walls; `threats` scores each by time-to-impact and
 * `escape` sums them in the normal basis to get a direction out. That sum is
 * what handles corners: two converging walls add to their bisector rather
 * than fighting over which one gets to steer.
 *
 * Converting the escape direction into a force is the remaining judgement
 * call. Pure lateral steering keeps the rotational character that makes boids
 * read as boids, but cannot help when the way out is directly astern. So the
 * along-heading component is admitted in proportion to urgency: a boid with
 * time turns, a boid out of time also brakes.
 */
export const avoid: Force = (self, params) => {
  const force = new Vec2();

  const context = probeContext(self);
  if (!context) return force;

  const segments = walls(params.avoid.boundaries);
  const found = threats(
    segments,
    probeConfig(params),
    context,
    params.avoid.horizon,
    params.avoid.clearance,
  );
  if (found.length === 0) return force;

  const out = escape(found);
  if (out.magSq() < 1e-12) return force;

  // Peak urgency decides how much braking is allowed; the escape direction
  // decides where to go.
  const urgency = found.reduce((max, t) => Math.max(max, t.urgency), 0);

  const leftX = -context.dy;
  const leftY = context.dx;

  // Split the escape into "turn" (lateral) and "brake" (against the heading).
  const lateral = out.x * leftX + out.y * leftY;
  const along = out.x * context.dx + out.y * context.dy;

  // Braking only ever slows: a positive `along` means the way out is ahead,
  // which the lateral term already handles. Scaling by urgency keeps a boid
  // with room to manoeuvre from shedding speed for no reason.
  const brake = Math.min(0, along) * urgency * params.avoid.braking;

  const mag = params.avoid.strength;
  force.x += (leftX * lateral + context.dx * brake) * mag;
  force.y += (leftY * lateral + context.dy * brake) * mag;

  return force;
};

/** Steer toward `target.position`, scaled by `target.strength` (negative flees). */
export const targeting: Force = (self, params) => {
  if (!params.target) return new Vec2();
  return params.target.position.copy().sub(self.position).setMag(params.target.strength);
};

export const gravity: Force = (_self, params) => new Vec2(0, params.gravity);

/** Sum of every top-level steering term. */
export const computeSteering = (self: Boid, params: SteeringParams): Vec2 =>
  flock(self, params)
    .add(cruise(self, params))
    .add(avoid(self, params))
    .add(targeting(self, params))
    .add(gravity(self, params));
