import p5, { Color, Vector } from "p5";
import { decide, Decider, proxy } from "../../decision.ts";

interface BoidD {
  position: p5.Vector;
  velocity: p5.Vector;

  perception: {
    radius: number;
    angle: number;
  };

  steering: Force;

  display: {
    color: Color;
    size: number;

    self?: boolean;
    perception?: boolean;
    percieved?: boolean;
    goal?: boolean;

    forces?: {
      alignment?: boolean;
      cohesion?: boolean;
      separation?: boolean;
      // avoidance?: boolean;
      // seeking?: boolean;
      total?: boolean;
    };
  };
}

export class Boid {
  constructor(public config: BoidD) {}

  public draw(p5: p5) {
    const angle = this.config.velocity.heading();

    if (this.config.display.perception) {
      p5.fill(0.5, 0.4);
      p5.noStroke();
      p5.circle(this.config.position.x, this.config.position.y, 2 * this.config.perception.radius);
    }

    if (this.config.display.self ?? true) {
      p5.push();
      p5.translate(this.config.position.x, this.config.position.y);
      p5.rotate(angle);
      p5.fill(this.config.display.color);
      p5.noStroke();

      const size = this.config.display.size;
      const radius = size / 2;
      p5.beginShape();
      p5.vertex(radius, 0);
      p5.vertex(-radius * 0.6, radius * 0.6);
      p5.vertex(-radius * 0.2, 0);
      p5.vertex(-radius * 0.6, -radius * 0.6);
      p5.endShape(p5.CLOSE);

      p5.pop();
    }

    if (this.config.display.percieved) {
      p5.colorMode(p5.HSB, 1);
      p5.noStroke();
      p5.fill(1, 0.4);

      this.percieved.forEach(boid =>
        p5.circle(boid.config.position.x, boid.config.position.y, boid.config.display.size + 10),
      );
    }

    // Visualize the total steering force
    if (this.config.display.forces?.total) {
      const force = decide(this.config.steering, { self: this, percieved: this.percieved });
      p5.stroke("cyan");
      p5.strokeWeight(2);
      p5.line(
        this.config.position.x,
        this.config.position.y,
        this.config.position.x + force.x * 50,
        this.config.position.y + force.y * 50,
      );
      p5.strokeWeight(1);
    }

    // display internal info
    // p5.circle(this.config.position.x, this.config.position.y, this.config.display.size);
  }

  public updateVelocity(boids: Boid[]) {
    this.percieve(boids);
    this.config.velocity.add(decide(this.config.steering, { self: this, percieved: this.percieved }));
  }

  public updatePosition() {
    this.config.position.add(this.config.velocity);
  }

  private percieved: Boid[] = [];
  protected percieve(boids: Boid[]): Boid[] {
    return (this.percieved = boids
      .filter(other => other !== this)
      .filter(other => this.distanceSquared(other) <= this.config.perception.radius * this.config.perception.radius));
  }

  // public getAvoidanceForce(obstacles: unknown[]): p5.Vector {
  //   return new p5.p5.Vector(0, 0);
  // }

  public target: p5.Vector | undefined = undefined;
  public getTargetingForce() {
    if (this.target === undefined) return new p5.Vector(0, 0);
  }

  public distanceSquared(other: Boid) {
    const dx = this.config.position.x - other.config.position.x;
    const dy = this.config.position.y - other.config.position.y;
    return dx * dx + dy * dy;
  }
}

type Force = Decider<p5.Vector, { self: Boid; percieved: Boid[] }>;

export const zeroSafe =
  (force: Force): Force =>
  ({ self, percieved }) =>
    percieved.length === 0 ? new p5.Vector(0, 0) : decide(force, { self, percieved });

export const average = (...forces: Force[]): Force => proxy(add(...forces), sum => sum.div(forces.length || 1));

export const align = (strength: number): Force =>
  zeroSafe(({ self, percieved }) => {
    const avg = new p5.Vector(0, 0);
    for (const boid of percieved) {
      avg.add(boid.config.velocity.copy().normalize());
    }
    avg.div(percieved.length);
    return avg.sub(self.config.velocity.copy().normalize()).mult(strength);
  });

export const cohese = (strength: number): Force =>
  zeroSafe(({ self, percieved }) => {
    const center = new p5.Vector(0, 0);
    for (const boid of percieved) {
      center.add(boid.config.position);
    }
    center.div(percieved.length);

    const toCenter = center.sub(self.config.position);
    const d = toCenter.mag();
    const R = self.config.perception.radius;
    if (d < 1e-6) return new p5.Vector(0, 0);

    // Bell curve: 4·(d/R)·(1 - d/R), peak of 1.0 at d = R/2
    // Near center (d≈0): ≈0 (no clumping)
    // At R/2: full strength (sweet spot)
    // Near edge (d≈R): ≈0 (no shoving in)
    const t = Math.min(d / R, 1);
    const bell = 4 * t * (1 - t);

    return toCenter.normalize().mult(strength * bell);
  });

export const separate =
  (strength: number, reach = 2): Force =>
  ({ self, percieved }) => {
    const force = new p5.Vector(0, 0);
    for (const boid of percieved) {
      const diff = p5.Vector.sub(self.config.position, boid.config.position);
      const d = diff.mag();
      const radius = reach * (self.config.display.size + boid.config.display.size);

      if (d >= radius || d < 1e-6) continue;

      // Quadratic ramp: full strength at d=0, zero at d=radius
      const t = 1 - d / radius;
      force.add(diff.normalize().mult(strength * t * t));
    }
    return force;
  };

export const flock = (alignment: number, cohesion: number, separation: number, reach = 2): Force =>
  average(align(alignment), cohese(cohesion), separate(separation, reach));

// Force combinators
export const weight = (force: Force, w: number): Force => proxy(force, v => v.mult(w));

export const add =
  (...forces: Force[]): Force =>
  ctx =>
    forces.map(force => decide(force, ctx)).reduce((acc, f) => acc.add(f), new p5.Vector(0, 0));

export const cruise =
  (target: number, strength: number): Force =>
  ({
    self: {
      config: { velocity },
    },
  }) =>
    velocity
      .copy()
      .normalize()
      .mult((target - velocity.mag()) * strength);

// Steering behaviors
export const seek =
  (target: Decider<Vector, Boid>, strength = 1): Force =>
  ({ self }) =>
    decide(target, self).copy().sub(self.config.position).setMag(strength);

export const flee =
  (target: Decider<Vector, Boid>, strength = 1): Force =>
  ({ self }) =>
    self.config.position.copy().sub(decide(target, self)).setMag(strength);

export const wander = (strength = 1, jitter = 0.1): Force => {
  let angle = Math.random() * Math.PI * 2;
  return ({ self: _self }) => {
    angle += (Math.random() - 0.5) * jitter;
    return new p5.Vector(Math.cos(angle), Math.sin(angle)).mult(strength);
  };
};

// Boundary forces
export const contain =
  (p: p5, strength = 1, margin = 50): Force =>
  ({ self }) => {
    const { position } = self.config;
    const force = new p5.Vector(0, 0);

    const hw = p.width / 2;
    const hh = p.height / 2;

    // Distance from position to each wall (positive = inside bounds)
    const dLeft = position.x + hw;
    const dRight = hw - position.x;
    const dTop = position.y + hh;
    const dBottom = hh - position.y;

    // Quadratic ramp: exactly zero outside margin, grows smoothly within it.
    // Past the wall (dist < 0), force keeps growing — no cap needed.
    const ramp = (distToWall: number) => {
      if (distToWall >= margin) return 0;
      const t = 1 - distToWall / margin;
      return t * t;
    };

    force.x += strength * ramp(dLeft); // Push right from left wall
    force.x -= strength * ramp(dRight); // Push left from right wall
    force.y += strength * ramp(dTop); // Push down from top wall
    force.y -= strength * ramp(dBottom); // Push up from bottom wall

    return force;
  };

export const wrap =
  (p: p5): Force =>
  ({ self }) => {
    const { position } = self.config;
    const left = -p.width / 2;
    const right = p.width / 2;
    const top = -p.height / 2;
    const bottom = p.height / 2;

    if (position.x < left) position.x = right;
    if (position.x > right) position.x = left;
    if (position.y < top) position.y = bottom;
    if (position.y > bottom) position.y = top;
    return new p5.Vector(0, 0);
  };
