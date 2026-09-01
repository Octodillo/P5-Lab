import { Pool, Vec2 } from "../../../common.ts";
import type { BoundaryGroup } from "../boundary.ts";
import { computeSteering } from "./forces.ts";

export interface SteeringParams {
  // Flocking forces
  alignment: number;
  cohesion: number;
  separation: {
    strength: number;
    reach: number;
  };

  // Maintain a baseline speed
  cruise: {
    strength: number;
    target: number;
  };

  // Steer away from imminent wall collisions
  avoid: {
    boundaries: readonly BoundaryGroup[];

    strength: number;
    lookahead: number;
    whiskers: number;
    spread: number;

    /**
     * Time-to-impact horizon, in frames. A wall further off than this in
     * *time* is ignored; urgency ramps from 0 there to 1 at contact.
     */
    horizon: number;
    /**
     * Perpendicular distance within which a wall is urgent regardless of how
     * slowly it is being approached. This is what stops a boid from settling
     * into a parallel glide hard against a wall.
     */
    clearance: number;
    /**
     * How much of the escape direction may be spent slowing down rather than
     * turning, at full urgency. 0 = pure lateral steering.
     */
    braking: number;
  };

  // Move toward (positive strength) or away from (negative) a target
  target?: {
    strength: number;
    position: Vec2;
  };

  gravity: number;
}

/**
 * Hard positional correction, applied after `updatePosition` rather than as a
 * steering force: even if `avoid` is overwhelmed by flocking, a boid must
 * never end a frame on the wrong side of a wall.
 */
export interface BoundaryParams {
  boundaries: readonly BoundaryGroup[];
  padding: number;
  restitution: number;
  enforce: boolean;
}

/** Below this speed a boid has no meaningful heading. */
export const STATIONARY = 1e-6;

/**
 * Probe origin/heading for this frame, shared by `avoid` and the whisker
 * debug overlay so what gets drawn is exactly what gets tested. Undefined
 * when the boid is effectively stationary and has no heading to probe along.
 */
export interface ProbeContext {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
}

export function probeContext(boid: Boid): ProbeContext | undefined {
  const speed = boid.velocity.mag();
  if (speed < STATIONARY) return undefined;

  return {
    x: boid.position.x,
    y: boid.position.y,
    dx: boid.velocity.x / speed,
    dy: boid.velocity.y / speed,
    speed,
  };
}

/**
 * The `avoid` params, reshaped for `boundary.ts`'s `ProbeConfig`.
 *
 * `minRange` is floored at `clearance` rather than 0, and that floor is load
 * bearing: probe range is `lookahead × speed`, so a braking boid shortens its
 * own whiskers. Left unfloored that closes a feedback loop — brake, see less,
 * lose the wall entirely, stop braking — which showed up as a boid going blind
 * a few units short of the corner it was slowing for.
 */
export function probeConfig(params: SteeringParams) {
  return {
    count: params.avoid.whiskers,
    spread: params.avoid.spread,
    lookahead: params.avoid.lookahead,
    minRange: params.avoid.clearance,
  };
}

export class Boid {
  constructor(
    public position = new Vec2(0, 0),
    public velocity = new Vec2(0, 0),
    public size = 5,
    public perceptionRadius = 60,
  ) {}

  private perceived: Boid[] = [];
  public perceive(others: Boid[]) {
    this.perceived = others; // TODO filter by radius/FOV
  }
  public getPerceived() {
    return this.perceived;
  }

  public updateVelocity(params: SteeringParams) {
    this.velocity.add(computeSteering(this, params));
  }

  public updatePosition() {
    this.position.add(this.velocity);
  }
}

export class Flock {
  proletariat = new Pool(() =>
    new Boid(new Vec2(200 * (Math.random() - 0.5), 200 * (Math.random() - 0.5)))
  );
  bourgeoisie: Boid[] = [];

  get members(): Boid[] {
    return [...this.proletariat.items, ...this.bourgeoisie];
  }

  update(params: SteeringParams) {
    const members = this.members;
    members.forEach((boid) => boid.perceive(members));
    members.forEach((boid) => boid.updateVelocity(params));
    members.forEach((boid) => boid.updatePosition());
  }
}
