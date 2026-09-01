import p5, { Color } from "p5";
import { Vec2 } from "../../common.ts";
import { decide, Decider } from "../../decision.ts";
import { type BoundaryGroup, enforce, type ProbeConfig, type ProbeContext } from "./boundary.ts";
import { drawForces, drawPerception, drawPercieved, drawWhiskers } from "./debug.ts";
import type { Force } from "./forces.ts";

export interface BoidD {
  position: Vec2;
  velocity: Vec2;

  perception: {
    radius: number;
    /**
     * Total field-of-view arc in degrees, centered on the heading. 360 sees
     * everything; 270 leaves a 90° blind spot astern. A Decider so a control
     * can scale it live without discarding each boid's own variation.
     *
     * Distinct from the whisker spread in `bounds.probe`: that samples walls
     * ahead, this is how far around itself the boid can see flockmates.
     */
    angle: Decider<number, Boid>;
  };

  steering: Force;

  /**
   * Walls the boid is hard-confined by. Steering forces try to keep it clear;
   * `enforce` guarantees it never ends a frame on the wrong side.
   */
  bounds?: {
    /**
     * Convex groups, not a flat wall list — `enforce` needs to know which
     * walls belong to the same shape to tell "inside a solid" from "merely
     * behind one of its outward-facing lines".
     */
    groups: Decider<readonly BoundaryGroup[], Boid>;
    /** How far off the wall the boid is held. Defaults to its own radius. */
    padding?: Decider<number, Boid>;
    /** 0 = slide along the wall, 1 = mirror bounce. */
    restitution?: Decider<number, Boid>;
    /** Set false to watch the steering fail on its own. */
    enforce?: Decider<boolean, Boid>;
    /** Probe shape, shared with the debug overlay so it draws what's tested. */
    probe?: ProbeConfig;
  };

  display: {
    color: Color;
    size: number;

    self?: boolean;
    /** Draw the field-of-view wedge (or full circle at 360°). */
    perception?: Decider<boolean, Boid>;
    /** Highlight the neighbours currently inside this boid's FOV. */
    percieved?: Decider<boolean, Boid>;
    whiskers?: Decider<boolean, Boid>;

    /**
     * Draw the individual steering forces that make up this boid's total.
     *
     * Each entry is evaluated at draw time and rendered as a labelled vector,
     * so the components must be supplied here rather than inferred — `average`
     * and `flock` collapse their inputs into one vector, which cannot be taken
     * apart after the fact.
     */
    forces?: Decider<boolean, Boid>;
    forceComponents?: readonly { label: string; color: string; force: Force }[];
  };
}

/** Below this speed a boid has no meaningful heading. */
const STATIONARY = 1e-6;

export class Boid {
  constructor(public config: BoidD) {}

  /** Neighbours seen on the last `updateVelocity`. */
  public percieved: Boid[] = [];

  /** True when the last `updatePosition` had to shove this boid back inside. */
  public corrected = false;

  public updateVelocity(boids: Boid[]) {
    this.percieve(boids);
    this.config.velocity.add(
      decide(this.config.steering, { self: this, percieved: this.percieved }),
    );
  }

  public updatePosition() {
    this.config.position.add(this.config.velocity);

    const bounds = this.config.bounds;
    if (!bounds || !decide(bounds.enforce ?? true, this)) return;

    this.corrected = enforce(
      decide(bounds.groups, this),
      this.config.position,
      this.config.velocity,
      decide(bounds.padding ?? this.config.display.size / 2, this),
      decide(bounds.restitution ?? 0, this),
    );
  }

  /** Probe origin/heading for this frame. Undefined when effectively stationary. */
  public probeContext(): ProbeContext | undefined {
    const { position, velocity } = this.config;
    const speed = velocity.mag();
    if (speed < STATIONARY) return undefined;

    return { x: position.x, y: position.y, dx: velocity.x / speed, dy: velocity.y / speed, speed };
  }

  public distanceSquared(other: Boid) {
    const dx = this.config.position.x - other.config.position.x;
    const dy = this.config.position.y - other.config.position.y;
    return dx * dx + dy * dy;
  }

  public draw(p: p5) {
    const { display } = this.config;
    const heading = this.config.velocity.heading();

    if (decide(display.perception ?? false, this)) drawPerception(p, this, heading);
    if (display.self ?? true) this.drawBody(p, heading);
    if (decide(display.percieved ?? false, this)) drawPercieved(p, this);
    if (decide(display.whiskers ?? false, this)) drawWhiskers(p, this);
    if (decide(display.forces ?? false, this)) drawForces(p, this);
  }

  /** The arrowhead, pointing along the heading. */
  private drawBody(p: p5, heading: number) {
    const radius = this.config.display.size / 2;

    p.push();
    p.translate(this.config.position.x, this.config.position.y);
    p.rotate(heading);
    p.fill(this.config.display.color);
    p.noStroke();

    p.beginShape();
    p.vertex(radius, 0);
    p.vertex(-radius * 0.6, radius * 0.6);
    p.vertex(-radius * 0.2, 0);
    p.vertex(-radius * 0.6, -radius * 0.6);
    p.endShape(p.CLOSE);

    p.pop();
  }

  /**
   * Neighbours within both the perception radius and the field of view.
   *
   * The FOV is a cone around the heading, so `angle` is the *total* arc: 360
   * sees everything, 270 leaves a 90° blind spot astern. The test compares
   * cosines rather than calling `acos` per neighbour — `dot(heading, toOther)`
   * against `cos(angle/2)`, with the comparison flipped for reflex angles
   * where the cosine threshold goes negative.
   *
   * Note this is deliberately *not* the whisker spread: that is a sampling
   * knob for wall probing, while this is the boid's eyesight.
   */
  protected percieve(boids: Boid[]): Boid[] {
    const { position, velocity, perception } = this.config;
    const angle = decide(perception.angle, this);
    const radiusSq = perception.radius * perception.radius;

    // Heading is undefined when stationary; fall back to omnidirectional.
    const speed = velocity.mag();
    const omni = angle >= 360 || speed < STATIONARY;

    const hx = omni ? 0 : velocity.x / speed;
    const hy = omni ? 0 : velocity.y / speed;
    // Small tolerance so a neighbour sitting exactly on the cone edge is not
    // excluded by float error in cos().
    const threshold = omni ? -1 : Math.cos((angle * Math.PI) / 360) - 1e-9;

    const result: Boid[] = [];
    for (const other of boids) {
      if (other === this) continue;

      const dx = other.config.position.x - position.x;
      const dy = other.config.position.y - position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > radiusSq) continue;

      // A neighbour sitting exactly on top of this boid has no direction;
      // treat it as visible rather than dividing by zero.
      if (!omni && distSq > 1e-12) {
        if ((dx * hx + dy * hy) / Math.sqrt(distSq) < threshold) continue;
      }

      result.push(other);
    }

    return (this.percieved = result);
  }
}
