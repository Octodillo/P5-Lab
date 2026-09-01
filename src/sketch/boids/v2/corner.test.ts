/**
 * Corner-seeking repro for whisker-based boundary avoidance.
 *
 * Run headless:
 *
 *   deno run src/sketch/boids/v2/corner.test.ts
 *
 * Setup: a single boid inside a large container box, launched at a shallow
 * angle toward one of its corners. Every force but `avoid` is zeroed — no
 * flocking (the boid is alone anyway), no cruise, no gravity, no target, and
 * no proximity pressure. Whatever the boid does is entirely `avoid`'s doing.
 *
 * Expected: the boid should peel away from the corner well before reaching it.
 * The bug: it steers *into* the corner, closing distance monotonically, and
 * only deflects at the very last moment.
 */

import { Vec2 } from "../../../common.ts";
import {
  barrier,
  type BoundaryGroup,
  boxBoundary,
  castWhiskers,
  container,
  polygon,
  signedDistance,
  solid,
  wallBoundary,
  walls,
  whiskers,
} from "../boundary.ts";
import { Boid, probeConfig, probeContext, type SteeringParams } from "./boid.ts";
import { avoid } from "./forces.ts";

// ---------------------------------------------------------------------------
// Scenario plumbing
// ---------------------------------------------------------------------------

/** Params with everything except `avoid` switched off. */
const avoidOnly = (
  boundaries: readonly BoundaryGroup[],
  overrides: Partial<SteeringParams["avoid"]> = {},
): SteeringParams => ({
  alignment: 0,
  cohesion: 0,
  separation: { strength: 0, reach: 0 },
  cruise: { strength: 0, target: 0 },
  gravity: 0,
  avoid: {
    boundaries,
    strength: 1.5,
    lookahead: 20,
    whiskers: 3,
    spread: (70 * Math.PI) / 180,
    horizon: 30,
    clearance: 60,
    braking: 0.5,
    ...overrides,
  },
});

interface Scenario {
  name: string;
  /** The corner (vertex) we expect the boid *not* to seek. */
  corner: Vec2;
  boid: Boid;
  params: SteeringParams;
  /**
   * Extra per-frame acceleration, standing in for whatever else is acting on
   * the boid — flockmates, mostly. Avoidance has to win against this, not just
   * against an empty canvas.
   */
  nudge?: Vec2;
  /**
   * Scenarios this design is not expected to survive. Recorded rather than
   * omitted so the ceiling stays visible: a known-failing case that silently
   * disappears from the suite is a limitation nobody remembers.
   */
  expectFail?: string;
  /**
   * What this scenario is actually asking.
   *
   * - `standoff`: keep clear of `corner`, judged against the configured
   *   clearance.
   * - `containment`: stay inside the container, whatever the distances. Used
   *   where the question is "can something push this boid through a wall",
   *   for which proximity to a wall is the expected state rather than a fault.
   */
  criterion?: "standoff" | "containment";
  /** Required standoff override, for obstacles smaller than `clearance`. */
  standoff?: number;
}

/**
 * Boid inside a 800x600 container, aimed just off the bottom-right interior
 * corner. "Not quite directly" so that if avoidance were neutral it would
 * drift past rather than hit dead-on.
 */
const containerCorner = (): Scenario => {
  const corner = new Vec2(400, 300);
  const start = new Vec2(-300, -220);

  // Aim ~4 degrees off the straight line to the corner.
  const toCorner = corner.copy().sub(start).normalize();
  const angle = Math.atan2(toCorner.y, toCorner.x) + (4 * Math.PI) / 180;
  const speed = 3;

  return {
    name: "container corner (800x600 box, aimed at bottom-right)",
    corner,
    boid: new Boid(start, new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed)),
    params: avoidOnly([container(boxBoundary(800, 600))]),
  };
};

/**
 * Boid outside a solid hexagon, aimed just off one of its vertices. Same
 * geometry from the other side: two walls meeting at a convex point, both
 * facing the boid.
 */
const hexVertex = (): Scenario => {
  const radius = 120;
  const hex = polygon(0, 0, radius, 6, 0);

  // With rotation 0 and 6 sides, vertex 0 sits at (radius, 0).
  const corner = new Vec2(radius, 0);
  const start = new Vec2(400, 0);

  // Approach the vertex head-on-ish, 4 degrees off.
  const angle = Math.PI + (4 * Math.PI) / 180;
  const speed = 3;

  return {
    name: "hexagon vertex (r=120 solid, approached from +x)",
    corner,
    boid: new Boid(start, new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed)),
    // Wrap the hex in a roomy container so the boid can't wander to infinity.
    params: avoidOnly([solid(hex), container(boxBoundary(1600, 1200))]),
    // A convex vertex is only detectable from much closer than a long wall:
    // the whiskers first catch this one at ~49 units. Judging it against the
    // full clearance would demand a reaction before the boid can see anything,
    // so the bar is half that — still well clear of the surface.
    standoff: 30,
  };
};

/**
 * A boid gliding parallel to a wall while something shoves it wallward every
 * frame — the flockmate squeeze.
 *
 * This is the case that broke the previous attempt: lateral-only steering lets
 * a boid settle into a parallel glide, and once parallel the restoring force
 * decays to nothing, so a steady inward push walks it straight through the
 * wall. The `nudge` here is deliberately larger than `avoid` can produce on its
 * own, because separation in the real sketch is (strength 40 vs 1.5).
 */
const wallSqueeze = (): Scenario => {
  // Track the wall itself rather than a corner: the failure is translation
  // through the wall, not corner-seeking.
  const corner = new Vec2(400, 0);
  const start = new Vec2(400 - 120, -250);

  return {
    name: "wall squeeze (parallel glide + steady inward shove)",
    corner,
    boid: new Boid(start, new Vec2(0, 3)),
    params: avoidOnly([container(boxBoundary(800, 600))]),
    // Steady push toward +x, i.e. into the right wall.
    nudge: new Vec2(0.35, 0),
    // Hugging the wall is the *expected* behaviour here; the question is only
    // whether the shove ever gets the boid through it.
    criterion: "containment",
  };
};

/**
 * A concave pocket: three walls forming a dead-end the boid flies into.
 *
 * Expected to fail. Summed normals always point directly away from walls, so
 * in a pocket they point back the way the boid came — there is no way for a
 * purely reactive method to discover that the exit requires travelling
 * *alongside* a wall first. This is the classic potential-field local minimum,
 * and escaping it is what a predictive method (velocity obstacles, or any
 * search over candidate futures) buys you.
 *
 * Kept in the suite as an executable statement of that ceiling.
 */
const concavePocket = (): Scenario => {
  // A three-sided box open to the left, mouth at x = -100.
  const pocket = barrier([
    ...wallBoundary(-100, -150, 200, -150), // top, blocking downward
    ...wallBoundary(200, 150, -100, 150), // bottom, blocking upward
    ...wallBoundary(200, -150, 200, 150), // back wall, blocking leftward
  ]);

  const corner = new Vec2(200, 0); // deepest point of the pocket
  const start = new Vec2(-300, 10);

  return {
    name: "concave pocket (three-sided dead end)",
    corner,
    boid: new Boid(start, new Vec2(3, 0)),
    params: avoidOnly([pocket, container(boxBoundary(1200, 900))]),
    expectFail: "reactive avoidance has no escape from a local minimum",
  };
};

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

interface Sample {
  frame: number;
  x: number;
  y: number;
  distToCorner: number;
  /** Lateral steering magnitude this frame; signed left-positive. */
  steer: number;
  /** How many whiskers found a wall. */
  hits: number;
  /**
   * Worst penetration past any wall this frame, in units. Positive means the
   * boid is on the solid side of something — steering has already failed and
   * only `enforce` would be saving it.
   */
  breach: number;
}

/**
 * How far outside its containers the boid is, in units; 0 when properly
 * contained. Only `container` groups are checked — being outside a `solid` or
 * behind a `barrier` is the normal state, not a breach.
 */
const breachOf = (groups: readonly BoundaryGroup[], x: number, y: number): number => {
  let worst = 0;
  for (const group of groups) {
    if (group.kind !== "container") continue;
    for (const bound of group.walls) {
      worst = Math.max(worst, -signedDistance(bound, x, y));
    }
  }
  return worst;
};

const run = (scenario: Scenario, frames: number): Sample[] => {
  const { boid, params, corner } = scenario;
  const samples: Sample[] = [];
  const segments = walls(params.avoid.boundaries);

  for (let frame = 0; frame <= frames; frame++) {
    const context = probeContext(boid);
    const fan = context
      ? castWhiskers(whiskers(probeConfig(params), context), segments, context)
      : [];
    const hits = fan.filter((w) => w.distance !== Infinity).length;

    const force = avoid(boid, params);
    // Signed lateral component, positive = steering left of heading.
    const speed = boid.velocity.mag();
    const leftX = speed > 0 ? -boid.velocity.y / speed : 0;
    const leftY = speed > 0 ? boid.velocity.x / speed : 0;
    const steer = force.x * leftX + force.y * leftY;

    samples.push({
      frame,
      x: boid.position.x,
      y: boid.position.y,
      distToCorner: boid.position.copy().sub(corner).mag(),
      steer,
      hits,
      breach: breachOf(params.avoid.boundaries, boid.position.x, boid.position.y),
    });

    boid.velocity.add(force);
    if (scenario.nudge) boid.velocity.add(scenario.nudge);
    boid.updatePosition();
  }

  return samples;
};

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * Required standoff, as a multiple of the scenario's `clearance` setting.
 *
 * Deliberately *not* derived from the distance at which the whiskers first saw
 * the corner: probe range is floored at `clearance`, so raising clearance makes
 * the boid see further and moves that bar up faster than the improvement it is
 * meant to measure — a goalpost that runs away from the fix. Judging against
 * the configured clearance instead asks the honest question, "did the boid keep
 * the distance it was told to keep?"
 */
const STANDOFF = 0.6;

const report = (scenario: Scenario, samples: Sample[]): boolean => {
  console.log(`\n=== ${scenario.name} ===`);
  console.log("  frame        x        y   dist→corner    steer  hits");

  const step = Math.max(1, Math.floor(samples.length / 30));
  for (const s of samples) {
    if (s.frame % step !== 0 && s.frame !== samples.length - 1) continue;
    console.log(
      `  ${String(s.frame).padStart(5)} ${s.x.toFixed(1).padStart(8)} ${
        s.y.toFixed(1).padStart(8)
      } ${s.distToCorner.toFixed(1).padStart(13)} ${s.steer.toFixed(3).padStart(8)} ${
        String(s.hits).padStart(5)
      }`,
    );
  }

  const closest = samples.reduce((a, b) => (b.distToCorner < a.distToCorner ? b : a));
  const firstContact = samples.find((s) => s.hits > 0);

  console.log(
    `\n  start ${samples[0].distToCorner.toFixed(1)} → closest ${
      closest.distToCorner.toFixed(1)
    } (frame ${closest.frame})`,
  );

  const worstBreach = samples.reduce((max, s) => Math.max(max, s.breach), 0);
  const criterion = scenario.criterion ?? "standoff";
  const required = scenario.standoff ?? scenario.params.avoid.clearance * STANDOFF;

  if (firstContact) {
    console.log(
      `  saw corner at ${firstContact.distToCorner.toFixed(1)} (frame ${firstContact.frame}); ` +
        `required standoff ${required.toFixed(1)} (${
          scenario.standoff !== undefined
            ? "scenario override"
            : `${scenario.params.avoid.clearance} clearance × ${STANDOFF}`
        })`,
    );

    // Sign flips while the corner is in view: the signature of the fan
    // disagreeing with itself, which is what a nearest-hit rule produces when
    // two walls trade places as "closest" frame to frame.
    const inView = samples.filter((s) => s.frame >= firstContact.frame && s.hits > 0);
    let flips = 0;
    for (let i = 1; i < inView.length; i++) {
      const prev = inView[i - 1].steer;
      const curr = inView[i].steer;
      if (prev !== 0 && curr !== 0 && Math.sign(prev) !== Math.sign(curr)) flips++;
    }
    console.log(`  steering sign flips while corner in view: ${flips}`);
  } else {
    console.log("  whiskers never saw the corner");
  }

  console.log(`  worst breach past a container wall: ${worstBreach.toFixed(1)}`);

  // Two independent ways to fail: getting too close to the corner, or leaving
  // the container at all. The squeeze scenario is judged by the second — it is
  // about being pushed through a wall, not about corner-seeking.
  const reasons: string[] = [];
  if (worstBreach > 0.5) reasons.push(`breached by ${worstBreach.toFixed(1)}`);
  if (criterion === "standoff") {
    if (!firstContact) reasons.push("never detected the corner");
    if (closest.distToCorner < required) {
      reasons.push(`closed to ${closest.distToCorner.toFixed(1)} < ${required.toFixed(1)}`);
    }
  }

  const passed = reasons.length === 0;

  if (scenario.expectFail) {
    // A known-failing scenario that starts passing is still news worth
    // surfacing — it means the ceiling moved.
    console.log(
      passed
        ? `  UNEXPECTED PASS (known limitation: ${scenario.expectFail}) — ceiling moved?`
        : `  KNOWN FAIL (${scenario.expectFail}): ${reasons.join("; ")}`,
    );
    return true;
  }

  console.log(
    passed
      ? criterion === "containment"
        ? `  PASS: stayed contained (closest approach ${closest.distToCorner.toFixed(1)})`
        : `  PASS: kept ${closest.distToCorner.toFixed(1)} clear, stayed contained`
      : `  FAIL: ${reasons.join("; ")}`,
  );
  return passed;
};

const scenarios = [containerCorner(), hexVertex(), wallSqueeze(), concavePocket()];
const results = scenarios.map((scenario) => report(scenario, run(scenario, 400)));

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed`);
if (failed > 0) Deno.exit(1);
