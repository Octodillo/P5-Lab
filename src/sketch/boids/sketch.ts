import { Vec2 } from "../../common.ts";
import { Boid } from "./boid.ts";
import {
  align,
  average,
  avoid,
  cohese,
  cruise,
  flee,
  flock,
  type Force,
  seek,
  separate,
} from "./forces.ts";
import {
  barrier,
  blockBoundary,
  type BoundaryGroup,
  boxBoundary,
  container,
  polygon,
  signedDistance,
  solid,
  wallBoundary,
  walls,
} from "./boundary.ts";
import { button, checkbox, option, radio, row, section, select, slider } from "../../controls.ts";
import { cases, decide } from "../../decision.ts";
import { receive, Sketch } from "../../lab.ts";

const rand = (max = 1) => Math.random() * max;
const nudge = (range = 1) => 2 * (0.5 - rand()) * range;

type ShapeKind = "block" | "triangle" | "hexagon" | "wall";

const Controller = [
  section("Flocking Forces", [
    slider("alignment", 0, 5, 1, 0.1, "Alignment"),
    slider("cohesion", 0, 1, 0.1, 0.01, "Cohesion"),
    slider("separation", 0, 60, 40, 1, "Separation"),
    slider("separationReach", 0.5, 5, 2, 0.1, "Separation reach"),
    slider("fov", 10, 360, 270, 5, "Field of view (°)"),
  ]),
  section("Boundaries", [
    slider("avoidance", 0, 5, 1.5, 0.05, "Avoidance strength"),
    slider("lookahead", 1, 60, 20, 1, "Lookahead (frames)"),
    slider("whiskers", 1, 9, 3, 1, "Whisker count"),
    slider("spread", 0, 180, 70, 5, "Whisker spread (°)"),
    slider("wallMargin", 0, 150, 40, 5, "Proximity margin"),
    slider("wallPressure", 0, 5, 1, 0.05, "Proximity strength"),
    slider("restitution", 0, 1, 0, 0.05, "Bounciness"),
    row([checkbox("hardEnforce", "Hard confine", true)]),
  ]),
  section("Obstacles", [
    row([
      select(
        "shape",
        [
          option("Block", "block"),
          option("Triangle", "triangle"),
          option("Hexagon", "hexagon"),
          option("Wall", "wall"),
        ],
        "block",
        "Shape",
      ),
      button("place", "Place"),
    ]),
    slider("shapeSize", 20, 300, 90, 5, "Size"),
    button("clearShapes", "Clear obstacles"),
  ]),
  section("Speed", [
    slider("targetSpeed", 0, 10, 3, 0.1, "Target Speed"),
    slider("speedControl", 0, 1, 0.3, 0.01, "Speed Control Strength"),
  ]),

  section("Mouse", [
    row([
      radio("mouseBehavior", "flee", "Flee"),
      radio("mouseBehavior", "ignore", "Ignore", true),
      radio("mouseBehavior", "seek", "Seek"),
    ]),
    slider("mouseForce", 0, 1, 0.1, 0.01, "Mouse Force"),
  ]),
  section("Debug", [
    row([
      checkbox("showCollisions", "Show Collisions", false),
      checkbox("showEscapes", "Show escapes"),
    ]),
    row([checkbox("showBounds", "Show walls", true), checkbox("showMargins", "Show margins")]),
    row([checkbox("showWhiskers", "Show whiskers"), checkbox("showFov", "Show FOV")]),
    row([checkbox("inspectLead", "Inspect lead boid", true)]),
  ]),
] as const;

class BoidsSketch extends Sketch<typeof Controller> {
  readonly schema = Controller;

  private boids: Boid[] = [];
  private mousePos!: Vec2;

  /** The screen-edge container, rebuilt only when the canvas resizes. */
  private containerGroup: BoundaryGroup = container([]);
  private containerFor = { w: 0, h: 0 };

  /** User-placed obstacles. Each is its own convex solid group. */
  private obstacles: { kind: ShapeKind; group: BoundaryGroup }[] = [];

  /** Container + obstacles. Rebuilt only when either changes. */
  private groupCache: BoundaryGroup[] = [];
  private groupCacheStale = true;

  private getGroups = (): readonly BoundaryGroup[] => {
    const { width, height } = this.p5;
    if (this.containerFor.w !== width || this.containerFor.h !== height) {
      this.containerGroup = container(boxBoundary(width, height));
      this.containerFor = { w: width, h: height };
      this.groupCacheStale = true;
    }

    if (this.groupCacheStale) {
      this.groupCache = [this.containerGroup, ...this.obstacles.map((o) => o.group)];
      this.groupCacheStale = false;
    }

    return this.groupCache;
  };

  /**
   * Placement is a small state machine: idle → armed (button clicked) →
   * dragging (mouse down on canvas) → idle (release commits the shape).
   */
  private placement: "idle" | "armed" | "dragging" = "idle";
  /** Canvas-space anchor set on mouse-down; the drag sizes the shape from it. */
  private anchor = { x: 0, y: 0 };
  /** Live cursor in canvas space, kept current for the placement preview. */
  private cursor = { x: 0, y: 0 };

  /** Convert p5's top-left pixel coords to the centered space the sim uses. */
  private toCanvas(x: number, y: number) {
    return { x: x - this.p5.width / 2, y: y - this.p5.height / 2 };
  }

  private trackCursor = () => {
    const { x, y } = this.toCanvas(this.p5.mouseX, this.p5.mouseY);
    this.cursor.x = x;
    this.cursor.y = y;
  };

  /**
   * Build the previewed shape spanning origin → cursor. Before the press the
   * origin is the cursor itself, which yields a default-sized shape under the
   * pointer; during a drag it is the anchor, so the drag sizes the shape.
   */
  private previewGroup(origin = this.anchor): BoundaryGroup {
    const kind = this.controls.values.shape as ShapeKind;
    const { x: ax, y: ay } = origin;
    const { x: cx, y: cy } = this.cursor;

    if (kind === "wall") {
      // A wall is drawn end-to-end rather than sized from a center. With no
      // drag yet there is no direction to use, so show a default-length
      // horizontal segment centered on the cursor. It is a `barrier`, not a
      // `solid`: a lone segment encloses nothing, and treating it as a solid
      // would make its infinite line swallow half the canvas.
      if (Math.hypot(cx - ax, cy - ay) < 4) {
        const half = this.controls.values.shapeSize / 2;
        return barrier(wallBoundary(cx - half, cy, cx + half, cy));
      }
      return barrier(wallBoundary(ax, ay, cx, cy));
    }

    // Drag distance sets the radius; fall back to the slider for a bare click.
    const dragged = Math.hypot(cx - ax, cy - ay);
    const size = dragged > 4 ? dragged : this.controls.values.shapeSize / 2;
    const rotation = dragged > 4 ? Math.atan2(cy - ay, cx - ax) : 0;

    if (kind === "block") return solid(blockBoundary(ax, ay, size * 2, size * 2));
    return solid(polygon(ax, ay, size, kind === "triangle" ? 3 : 6, rotation));
  }

  /**
   * Scatter a few solid shapes to start with, so the flock has something to
   * navigate before the user places anything.
   *
   * Placement is rejection-sampled: shapes keep clear of the screen edge and
   * of each other, so the flock always has room to route between them. The
   * attempt cap just bounds the loop — falling short of `count` on a small
   * canvas is fine.
   */
  private scatterObstacles(count = 5) {
    const { width, height } = this.p5;
    const kinds: ShapeKind[] = ["block", "triangle", "hexagon"];

    // Everything scales off the smaller screen dimension so a narrow canvas
    // still gets obstacles instead of rejecting every candidate.
    const span = Math.min(width, height);
    const maxRadius = Math.max(12, span * 0.13);
    const minRadius = Math.max(8, span * 0.05);
    const edge = span * 0.06; // keep shapes off the container walls
    const gap = span * 0.07; // free space between neighbouring shapes
    const clearOrigin = span * 0.09; // room for the lead boid at (0, 0)

    const placed: { x: number; y: number; r: number }[] = [];

    for (let attempt = 0; attempt < count * 40 && placed.length < count; attempt++) {
      const radius = minRadius + rand(maxRadius - minRadius);
      const x = nudge(Math.max(0, width / 2 - edge - radius));
      const y = nudge(Math.max(0, height / 2 - edge - radius));

      const clashes = placed.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + radius + gap);
      if (clashes) continue;

      // Leave the origin clear — the large lead boid spawns there.
      if (Math.hypot(x, y) < radius + clearOrigin) continue;

      const kind = kinds[Math.floor(rand(kinds.length))];
      const group = kind === "block"
        ? solid(blockBoundary(x, y, radius * 2, radius * 2))
        : solid(polygon(x, y, radius, kind === "triangle" ? 3 : 6, rand(Math.PI * 2)));

      this.obstacles.push({ kind, group });
      placed.push({ x, y, r: radius });
    }

    this.groupCacheStale = true;
    return placed;
  }

  /**
   * Probe shape, as Deciders reading live control values. These are the knobs
   * that actually drive cost: whisker count multiplies the ray tests per boid,
   * and lookahead sets how far each ray reaches.
   */
  private probe = {
    count: () => this.controls.values.whiskers,
    spread: () => (this.controls.values.spread * Math.PI) / 180,
    lookahead: () => this.controls.values.lookahead,
    minRange: () => this.controls.values.wallMargin,
  };

  /**
   * Wrap a force built from control values so it is rebuilt per evaluation.
   *
   * The force constructors take plain numbers, but the sliders move at runtime;
   * this defers construction to steering time so the current values are always
   * the ones used, without rebuilding the flock on every change.
   */
  private live(build: (values: this["controls"]["values"]) => Force): Force {
    return (context) => decide(build(this.controls.values), context);
  }

  /**
   * The four top-level steering terms.
   *
   * The debug overlay references these same objects rather than reconstructing
   * equivalent forces, so what it draws is exactly what the flock steers by.
   */
  private terms = {
    flock: this.live((v) => flock(v.alignment, v.cohesion, v.separation, v.separationReach)),
    avoid: this.live((v) =>
      avoid({ strength: v.avoidance, margin: v.wallMargin, pressure: v.wallPressure })
    ),
    cruise: this.live((v) => cruise(v.targetSpeed, v.speedControl)),
    mouse: this.live((v) =>
      cases(
        {
          flee: flee(this.mousePos, v.mouseForce),
          seek: seek(this.mousePos, v.mouseForce),
          ignore: new Vec2(0, 0),
        },
        v.mouseBehavior,
      )
    ),
  };

  private getForce = average(
    this.terms.flock,
    this.terms.avoid,
    this.terms.cruise,
    this.terms.mouse,
  );

  /**
   * Components for the debug overlay.
   *
   * These mirror `getForce`'s structure rather than flattening it: `flock`
   * averages its three sub-forces before the outer `average` divides again, so
   * splitting them into peers here would show vectors the boid never uses (and
   * weight flocking 2x if it were fed back into the simulation). The three
   * flocking sub-forces are drawn dimmer to mark them as inputs to `flock`.
   */
  private forceComponents: readonly { label: string; color: string; force: Force }[] = [
    { label: "flock", color: "#8dff8d", force: this.terms.flock },
    { label: "avoid", color: "#ffcc66", force: this.terms.avoid },
    { label: "cruise", color: "#c9a0ff", force: this.terms.cruise },
    { label: "mouse", color: "#ff7a7a", force: this.terms.mouse },
    // Sub-forces of `flock`, shown for insight into how it resolves.
    { label: "· align", color: "#3f7f99", force: this.live((v) => align(v.alignment)) },
    { label: "· cohese", color: "#4f9f4f", force: this.live((v) => cohese(v.cohesion)) },
    {
      label: "· separate",
      color: "#99546b",
      force: this.live((v) => separate(v.separation, v.separationReach)),
    },
  ];

  override setup(): void {
    const { p5 } = this;
    p5.colorMode("hsb", 1.0);

    this.mousePos = new Vec2(0, 0);

    this.controls.subscribe("place", () => {
      this.placement = "armed";
    });

    this.controls.subscribe("clearShapes", () => {
      this.obstacles = [];
      this.groupCacheStale = true;
    });

    // LabMouse turns p5's single-slot mouse handlers into an emitter, so
    // placement can listen without stomping on anything else that wants
    // mouse input (the flee/seek target already reads the position directly).
    this.mouse.on("pressed", () => {
      if (this.placement !== "armed") return;
      this.trackCursor();
      this.anchor.x = this.cursor.x;
      this.anchor.y = this.cursor.y;
      this.placement = "dragging";
    });

    this.mouse.on("dragged", () => {
      if (this.placement === "dragging") this.trackCursor();
    });

    this.mouse.on("moved", () => {
      if (this.placement !== "idle") this.trackCursor();
    });

    this.mouse.on("released", () => {
      if (this.placement !== "dragging") return;
      this.trackCursor();

      const group = this.previewGroup();
      // A stray click with no drag still yields a slider-sized shape; only a
      // degenerate wall (zero length) produces nothing worth keeping.
      if (group.walls.length > 0) {
        this.obstacles.push({ kind: this.controls.values.shape as ShapeKind, group });
        this.groupCacheStale = true;
      }
      this.placement = "idle";
    });

    const bounds = () => ({
      groups: this.getGroups,
      probe: this.probe,
      restitution: () => this.controls.values.restitution,
      enforce: () => this.controls.values.hardEnforce,
    });

    // Obstacles first: boids pick spawn points that avoid them.
    this.scatterObstacles();

    /**
     * A spawn point outside every scattered shape, so none start trapped.
     *
     * Tests the real geometry rather than a bounding circle — a point is
     * inside a convex solid exactly when it is behind all of that solid's
     * walls, the same test `enforce` applies. The margin keeps boids off the
     * surface so they do not spawn mid-correction.
     */
    const spawnMargin = 12;
    const insideAnyShape = (x: number, y: number) =>
      this.obstacles.some(({ group }) =>
        group.walls.every((w) => signedDistance(w, x, y) < spawnMargin)
      );

    const freeSpawn = () => {
      for (let attempt = 0; attempt < 60; attempt++) {
        const x = nudge(p5.width / 2);
        const y = nudge(p5.height / 2);
        if (!insideAnyShape(x, y)) return new Vec2(x, y);
      }
      // Fallback: hug a container corner, which the scatter always leaves free.
      return new Vec2(nudge(p5.width / 2) * 0.98, nudge(p5.height / 2) * 0.98);
    };

    this.boids = [
      new Boid({
        position: new Vec2(0, 0),
        velocity: new Vec2(0, 0),
        perception: { radius: 100, angle: () => this.controls.values.fov },
        display: {
          color: p5.color("red"),
          size: 50,
          // The lead boid is the inspection subject: one checkbox turns on the
          // full picture for it, while the flock-wide toggles stay independent.
          whiskers: () => this.controls.values.inspectLead || this.controls.values.showWhiskers,
          perception: () => this.controls.values.inspectLead || this.controls.values.showFov,
          percieved: () => this.controls.values.inspectLead,
          forces: () => this.controls.values.inspectLead,
          forceComponents: this.forceComponents,
        },
        bounds: bounds(),
        steering: this.getForce,
      }),
      ...new Array(300).fill(0).map((_) => {
        // Captured per boid: the slider sets the flock's baseline FOV and this
        // offset keeps each individual slightly different.
        const fovOffset = nudge(30);

        return new Boid({
          display: {
            size: 5,
            color: p5.color(rand(), rand(), rand()),
            whiskers: () => this.controls.values.showWhiskers,
            perception: () => this.controls.values.showFov,
          },
          perception: {
            radius: 60 + 10 * nudge(),
            angle: () => this.controls.values.fov + fovOffset,
          },
          velocity: new Vec2(nudge(5), nudge(5)),
          position: freeSpawn(),
          bounds: bounds(),
          steering: this.getForce,
        });
      }),
    ];
  }

  update(): void {
    const { p5 } = this;
    this.mousePos.set(p5.mouseX - p5.width / 2, p5.mouseY - p5.height / 2);

    this.boids.forEach((b) => b.updateVelocity(this.boids));
    this.boids.forEach((b) => b.updatePosition());
  }

  draw(): void {
    const { p5 } = this;
    const { showCollisions, showBounds, showEscapes, wallMargin } = this.controls.values;

    p5.translate(p5.width / 2, p5.height / 2);
    p5.background(0.1);

    if (showBounds) {
      const segments = walls(this.getGroups());
      p5.strokeWeight(2);
      p5.stroke(p5.color(0, 0, 0.8));
      segments.forEach((w) => p5.line(w.ax, w.ay, w.bx, w.by));

      // Margin band: where proximity pressure starts pushing back.
      if (wallMargin > 0) {
        p5.strokeWeight(1);
        p5.stroke(p5.color(0, 0, 0.35));
        segments.forEach((w) =>
          p5.line(
            w.ax + w.nx * wallMargin,
            w.ay + w.ny * wallMargin,
            w.bx + w.nx * wallMargin,
            w.by + w.ny * wallMargin,
          )
        );
      }
      p5.strokeWeight(1);
    }

    // Placement preview: ghosted outline following the cursor before commit.
    if (this.placement !== "idle") {
      const preview = this.placement === "dragging"
        ? this.previewGroup()
        : this.previewGroup(this.cursor);

      p5.strokeWeight(2);
      p5.stroke(p5.color(0.15, 0.9, 1));
      preview.walls.forEach((w) => p5.line(w.ax, w.ay, w.bx, w.by));

      // Normal ticks, so the solid side is obvious before committing.
      p5.strokeWeight(1);
      p5.stroke(p5.color(0.15, 0.6, 0.7));
      preview.walls.forEach((w) => {
        const mx = (w.ax + w.bx) / 2;
        const my = (w.ay + w.by) / 2;
        p5.line(mx, my, mx + w.nx * 12, my + w.ny * 12);
      });
      p5.strokeWeight(1);
    }

    this.boids.forEach((b) => b.draw(p5));

    if (showEscapes) {
      const escapes = this.boids.filter((b) => b.corrected).length;
      p5.resetMatrix();
      p5.fill(p5.color("white"));
      p5.noStroke();
      p5.text(`Wall corrections this frame: ${escapes}`, 10, 40);
      p5.translate(p5.width / 2, p5.height / 2);
    }

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
      p5.text(
        `Collisions: ${collisions} (${((collisions / this.boids.length) * 100).toFixed(1)}%)`,
        10,
        20,
      );
    }
  }
}

receive(BoidsSketch);
