import { Vec2 } from "../../../common.ts";
import { checkbox, row, section, slider } from "../../../controls.ts";
import { receive, Sketch } from "../../../lab.ts";
import { type BoundaryGroup, boxBoundary, container } from "../boundary.ts";
import { Flock } from "./boid.ts";
import { drawBoid } from "./drawing.ts";

const Controller = [
  section("Setup", [
    slider("count", 0, 1000, 100, 1, "Boid Count"),
    row([
      checkbox("enableBigBoid", "Enable Big Boid"),
      checkbox("debugBigBoid", "Inspect Big Boid"),
    ]),
  ]),
  section("Flocking Forces", [
    slider("fov", 10, 360, 270, 5, "Field of view (°)"),
    slider("alignment", 0, 5, 1, 0.1, "Alignment"),
    slider("cohesion", 0, 1, 0.1, 0.01, "Cohesion"),
    slider("separation", 0, 60, 40, 1, "Separation"),
    slider("separationReach", 0.5, 5, 2, 0.1, "Separation reach"),
  ]),
  section("Boundaries", [
    slider("avoidStrength", 0, 5, 1.5, 0.05, "Avoidance strength"),
    slider("avoidLookahead", 1, 60, 20, 1, "Lookahead (frames)"),
    slider("avoidWhiskers", 1, 9, 3, 1, "Whisker count"),
    slider("avoidSpread", 0, 180, 70, 5, "Whisker spread (°)"),
    slider("avoidHorizon", 1, 120, 30, 1, "Threat horizon (frames)"),
    slider("avoidClearance", 0, 200, 60, 5, "Clearance (units)"),
    slider("avoidBraking", 0, 2, 0.5, 0.05, "Braking blend"),
  ]),
  section("Other", [
    slider("cruise", 0, 10, 3, 0.1, "Target Speed"),
    slider("cruiseStrength", 0, 1, 0.3, 0.01, "Speed Control Strength"),
    slider("mouse", -1, 1, 0, 0.01, "Seek Mouse"),
    slider("gravity", 0, 1, 0, 0.1, "Gravity (!?)"),
  ]),
] as const;

class Boids extends Sketch<typeof Controller> {
  schema = Controller;

  flock = new Flock();

  private containerGroup: BoundaryGroup = container([]);
  private containerFor = { w: 0, h: 0 };

  override setup(): void {
    this.controls.subscribe("count", (v) => this.flock.proletariat.resize(v));
  }

  /** Canvas-edge container, rebuilt only when the canvas actually resizes. */
  private getBoundaries = (): readonly BoundaryGroup[] => {
    const { width, height } = this.p5;
    if (this.containerFor.w !== width || this.containerFor.h !== height) {
      this.containerGroup = container(boxBoundary(width, height));
      this.containerFor = { w: width, h: height };
    }
    return [this.containerGroup];
  };

  override update(): void {
    this.flock.update(this.steeringParams());
  }

  override draw(): void {
    const { p5: p } = this;
    p.translate(p.width / 2, p.height / 2);
    p.background(0.1);
    const params = this.steeringParams();
    this.flock.members.forEach((boid) => drawBoid(p, boid, params, { color: p.color("white") }));
  }

  private steeringParams = () => ({
    alignment: this.controls.values.alignment,
    cohesion: this.controls.values.cohesion,
    separation: {
      strength: this.controls.values.separation,
      reach: this.controls.values.separationReach,
    },
    cruise: {
      strength: this.controls.values.cruiseStrength,
      target: this.controls.values.cruise,
    },
    gravity: this.controls.values.gravity,
    target: {
      strength: this.controls.values.mouse,
      position: new Vec2(this.p5.mouseX - this.p5.width / 2, this.p5.mouseY - this.p5.height / 2),
    },
    avoid: {
      boundaries: this.getBoundaries(),
      strength: this.controls.values.avoidStrength,
      lookahead: this.controls.values.avoidLookahead,
      whiskers: this.controls.values.avoidWhiskers,
      spread: (this.controls.values.avoidSpread * Math.PI) / 180,
      horizon: this.controls.values.avoidHorizon,
      clearance: this.controls.values.avoidClearance,
      braking: this.controls.values.avoidBraking,
    },
  });
}

receive(Boids);
