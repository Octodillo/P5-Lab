import { Boid, cruise, contain, seek, flock, average, flee } from "./boid.ts";
import { section, slider, checkbox, row, radio } from "../../controls.ts";
import { cases } from "../../decision.ts";
import { Sketch, receive } from "../../lab.ts";

const rand = (max = 1) => Math.random() * max;
const nudge = (range = 1) => 2 * (0.5 - rand()) * range;

const Controller = [
  section("Flocking Forces", [
    slider("alignment", 0, 5, 1, 0.1),
    slider("cohesion", 0, 1, 0.1, 0.01),
    slider("separation", 0, 500, 100, 10),
    slider("separationReach", 0.5, 5, 2, 0.1),
  ]),
  section("Boundary", [slider("containment", 0, 1, 0.5, 0.01)]),
  section("Speed", [slider("targetSpeed", 0, 10, 3, 0.1), slider("speedControl", 0, 1, 0.3, 0.01)]),
  section("Display", [checkbox("showCollisions", "Show Collisions", true)]),
  section("Mouse", [
    row([
      radio("mouseBehavior", "flee", "Flee"),
      radio("mouseBehavior", "ignore", "Ignore", true),
      radio("mouseBehavior", "seek", "Seek"),
    ]),
    slider("mouseForce", 0, 1, 0.1, 0.01),
  ]),
] as const;

class BoidsSketch extends Sketch<typeof Controller> {
  readonly schema = Controller;

  private boids: Boid[] = [];
  private mousePos!: ReturnType<typeof this.p5.createVector>;

  private getForce = () => {
    const {
      alignment,
      cohesion,
      separation,
      separationReach,
      containment,
      targetSpeed,
      speedControl,
      mouseBehavior,
      mouseForce,
    } = this.controls.values;
    return average(
      flock(alignment, cohesion, separation, separationReach),
      contain(this.p5, containment),
      cruise(targetSpeed, speedControl),
      cases(
        {
          flee: flee(this.mousePos, mouseForce),
          seek: seek(this.mousePos, mouseForce),
          ignore: this.p5.createVector(0, 0),
        },
        mouseBehavior,
      ),
    );
  };

  override setup(): void {
    const { p5 } = this;
    p5.colorMode("hsb", 1.0);

    this.mousePos = p5.createVector(0, 0);

    this.boids = [
      new Boid({
        position: p5.createVector(0, 0),
        velocity: p5.createVector(0, 0),
        perception: { radius: 100, angle: 360 },
        display: {
          color: p5.color("red"),
          size: 50,
        },
        steering: this.getForce,
      }),
      ...new Array(300).fill(0).map(
        _ =>
          new Boid({
            display: { size: 5, color: p5.color(rand(), rand(), rand()) },
            perception: { radius: 60 + 10 * nudge(), angle: 270 + nudge(30) },
            velocity: p5.createVector(nudge(5), nudge(5)),
            position: p5.createVector(nudge(p5.width / 2), nudge(p5.height / 2)),
            steering: this.getForce,
          }),
      ),
    ];
  }

  update(): void {
    const { p5 } = this;
    this.mousePos.set(p5.mouseX - p5.width / 2, p5.mouseY - p5.height / 2);

    this.boids.forEach(b => b.updateVelocity(this.boids));
    this.boids.forEach(b => b.updatePosition());
  }

  draw(): void {
    const { p5 } = this;
    const { showCollisions } = this.controls.values;

    p5.translate(p5.width / 2, p5.height / 2);
    p5.background(0.1);

    this.boids.forEach(b => b.draw(p5));

    if (showCollisions) {
      let collisions = 0;
      for (let i = 0; i < this.boids.length; i++) {
        for (let j = i + 1; j < this.boids.length; j++) {
          const distSq = this.boids[i].distanceSquared(this.boids[j]);
          const minDist = this.boids[i].config.display.size + this.boids[j].config.display.size;
          if (distSq < minDist * minDist) collisions++;
        }
      }

      p5.resetMatrix();
      p5.fill("white");
      p5.text(`Collisions: ${collisions} (${((collisions / this.boids.length) * 100).toFixed(1)}%)`, 10, 20);
    }
  }
}

receive(BoidsSketch);
