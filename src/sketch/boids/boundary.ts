import { Vec2 } from "../../common.ts";
import { decide, type Decider } from "../../decision.ts";

/**
 * A boundary is a directed line segment. The inward normal is the left-hand
 * perpendicular of (b - a), so winding order decides which side is "inside":
 * walk from `a` to `b` and the interior is on your left.
 *
 * Normals are precomputed because boundaries are static relative to the number
 * of probe tests run against them each frame.
 */
export interface Boundary {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;

  /** Unit inward normal. */
  readonly nx: number;
  readonly ny: number;

  /** Edge vector, cached. */
  readonly ex: number;
  readonly ey: number;
  /** 1 / (ex² + ey²), cached for projection. */
  readonly invLenSq: number;
}

export const boundary = (ax: number, ay: number, bx: number, by: number): Boundary => {
  const ex = bx - ax;
  const ey = by - ay;
  const lenSq = ex * ex + ey * ey;
  const len = Math.sqrt(lenSq) || 1;

  return {
    ax,
    ay,
    bx,
    by,
    // Left-hand perpendicular of the edge direction.
    nx: ey / len,
    ny: -ex / len,
    ex,
    ey,
    invLenSq: 1 / (lenSq || 1),
  };
};

/**
 * Close a vertex ring into segments.
 *
 * Winding decides which side is solid. Normals point to the left of a→b, so
 * listing a box's corners counter-clockwise in screen space (y down) yields
 * inward normals — a *container*, open inside. Reversing that order flips
 * every normal outward, giving a solid the boids are pushed out of. `solid`
 * does the reversing, so callers list vertices in one natural order either way.
 */
export const ring = (points: readonly (readonly [number, number])[], solid = false): Boundary[] => {
  const ordered = solid ? [...points].reverse() : points;
  const walls: Boundary[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const [ax, ay] = ordered[i];
    const [bx, by] = ordered[(i + 1) % ordered.length];
    // Skip zero-length edges; they have no meaningful normal.
    if (ax === bx && ay === by) continue;
    walls.push(boundary(ax, ay, bx, by));
  }
  return walls;
};

/** Four inward-facing walls of a centered w × h box — a container. */
export const boxBoundary = (w: number, h: number): Boundary[] => {
  const hw = w / 2;
  const hh = h / 2;
  return ring([
    [-hw, -hh],
    [-hw, hh],
    [hw, hh],
    [hw, -hh],
  ]);
};

/** A regular n-gon obstacle centered at (cx, cy). */
export const polygon = (
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rotation = 0,
): Boundary[] => {
  const points: [number, number][] = [];
  // y grows downward on screen, so a *negative* angle step walks the vertices
  // in the same rotational order as `blockBoundary` lists its corners. That
  // matters: `ring(solid)` reverses whatever it is given, so both shapes must
  // agree on their starting winding to end up solid.
  for (let i = 0; i < sides; i++) {
    const angle = rotation - (i / sides) * Math.PI * 2;
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return ring(points, true);
};

/** An axis-aligned solid box centered at (cx, cy). */
export const blockBoundary = (cx: number, cy: number, w: number, h: number): Boundary[] => {
  const hw = w / 2;
  const hh = h / 2;
  return ring(
    [
      [cx - hw, cy - hh],
      [cx - hw, cy + hh],
      [cx + hw, cy + hh],
      [cx + hw, cy - hh],
    ],
    true,
  );
};

/** A single wall segment — one-sided, blocking from its left as it runs a→b. */
export const wallBoundary = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Boundary[] => [boundary(ax, ay, bx, by)];

/** Signed distance from a point to the boundary's infinite line. Positive = inside. */
export const signedDistance = (bound: Boundary, x: number, y: number): number =>
  (x - bound.ax) * bound.nx + (y - bound.ay) * bound.ny;

/**
 * Squared distance from a point to the *segment* (not the infinite line), plus
 * the closest point. Used for proximity pressure near wall ends and corners.
 */
const closestPoint = (
  bound: Boundary,
  x: number,
  y: number,
): { x: number; y: number; distSq: number; t: number } => {
  const raw = ((x - bound.ax) * bound.ex + (y - bound.ay) * bound.ey) * bound.invLenSq;
  const t = Math.max(0, Math.min(1, raw));
  const cx = bound.ax + t * bound.ex;
  const cy = bound.ay + t * bound.ey;
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx, y: cy, distSq: dx * dx + dy * dy, t: raw };
};

/**
 * Ray/segment intersection. Returns the ray parameter t (distance along a unit
 * direction) of the hit, or Infinity if the ray misses.
 *
 * Only front-facing hits count: a ray already behind the wall, or travelling
 * away from it, is not an impending collision.
 */
export const rayHit = (
  bound: Boundary,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
): number => {
  const denominator = dx * bound.nx + dy * bound.ny;
  // Moving parallel to, or away from, the inward normal — no front-facing hit.
  if (denominator >= -1e-9) return Infinity;

  const t = -signedDistance(bound, ox, oy) / denominator;
  if (t < 0 || t > maxDist) return Infinity;

  // Confirm the hit lands within the segment's extent, not the infinite line.
  const hx = ox + dx * t;
  const hy = oy + dy * t;
  const along = ((hx - bound.ax) * bound.ex + (hy - bound.ay) * bound.ey) * bound.invLenSq;
  if (along < 0 || along > 1) return Infinity;

  return t;
};

export interface ProbeContext {
  /** Origin of the probe fan. */
  x: number;
  y: number;
  /** Unit heading. */
  dx: number;
  dy: number;
  /** Current speed, in units per frame. */
  speed: number;
}

/** How the probe fan is shaped. Both knobs dominate the per-boid cost. */
export interface ProbeConfig {
  /**
   * Number of whiskers in the fan. 1 = straight ahead only. Even counts are
   * rounded up to keep the fan symmetric around the heading.
   */
  count: Decider<number, ProbeContext>;
  /** Total angular width of the fan, in radians. */
  spread: Decider<number, ProbeContext>;
  /**
   * How far ahead to look, in *frames of travel*. The actual ray length is
   * `lookahead * speed`, so fast boids start turning earlier.
   */
  lookahead: Decider<number, ProbeContext>;
  /** Minimum ray length, so a nearly-stopped boid still sees walls. */
  minRange: Decider<number, ProbeContext>;
}

export interface ProbeHit {
  bound: Boundary;
  /** Distance along the whisker to the impact. */
  distance: number;
  /** Whisker direction that hit. */
  dx: number;
  dy: number;
  /** 0 = imminent contact, 1 = at the edge of perception. */
  slack: number;
}

/**
 * Cast a fan of whiskers and return the most imminent hit, or undefined.
 *
 * Walks every boundary per whisker. That is O(count × boundaries), which is
 * fine while the boundary count stays small; a broadphase would only pay off
 * past a few dozen walls.
 */
/** One ray of the probe fan. */
export interface Whisker {
  /** Unit direction. */
  dx: number;
  dy: number;
  /** How far this ray reaches. */
  range: number;
  /** Distance to the nearest wall along it, or Infinity if clear. */
  distance: number;
  bound?: Boundary;
}

/**
 * Generate the fan for a probe context. Shared by `probe` and the debug
 * overlay so what gets drawn is exactly what gets tested — a separately
 * derived visualization would drift from the real behaviour.
 */
export const whiskers = (config: ProbeConfig, context: ProbeContext): Whisker[] => {
  const count = Math.max(1, Math.round(decide(config.count, context)));
  const spread = decide(config.spread, context);
  const range = Math.max(
    decide(config.minRange, context),
    decide(config.lookahead, context) * context.speed,
  );

  // Whiskers sweep from -spread/2 to +spread/2 around the heading.
  const step = count > 1 ? spread / (count - 1) : 0;
  const start = count > 1 ? -spread / 2 : 0;

  const fan: Whisker[] = [];
  for (let i = 0; i < count; i++) {
    const angle = start + step * i;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Rotate the heading by `angle`.
    fan.push({
      dx: context.dx * cos - context.dy * sin,
      dy: context.dx * sin + context.dy * cos,
      range,
      distance: Infinity,
    });
  }
  return fan;
};

/** Fill in each whisker's nearest hit, in place. */
export const castWhiskers = (
  fan: Whisker[],
  bounds: readonly Boundary[],
  context: ProbeContext,
): Whisker[] => {
  for (const w of fan) {
    for (const bound of bounds) {
      const distance = rayHit(bound, context.x, context.y, w.dx, w.dy, w.range);
      if (distance < w.distance) {
        w.distance = distance;
        w.bound = bound;
      }
    }
  }
  return fan;
};

export const probe = (
  bounds: readonly Boundary[],
  config: ProbeConfig,
  context: ProbeContext,
): ProbeHit | undefined => {
  const fan = castWhiskers(whiskers(config, context), bounds, context);

  let best: ProbeHit | undefined;
  for (const w of fan) {
    if (w.distance === Infinity || !w.bound) continue;
    if (best && w.distance >= best.distance) continue;
    best = {
      bound: w.bound,
      distance: w.distance,
      dx: w.dx,
      dy: w.dy,
      slack: w.distance / w.range,
    };
  }

  return best;
};

/**
 * A convex group of walls enforced as a unit.
 *
 * The grouping is what makes enforcement correct, and it is not optional.
 * `signedDistance` tests an *infinite line*, so a single wall's "violated"
 * half-plane extends across the whole canvas. Correcting wall-by-wall only
 * works when the walls' half-planes intersect to form exactly the region you
 * mean — true for a convex container, false for anything else.
 *
 * - `container`: the boid must satisfy every wall. Violating any one means it
 *   is out, so each violated wall is pushed back independently.
 * - `solid`: the boid is inside only when it violates *every* wall. Any wall
 *   it satisfies means it is already clear, and the group is skipped entirely.
 *   Only meaningful for a closed convex ring.
 * - `barrier`: individual one-sided segments with no interior. A boid is only
 *   corrected when it is behind a segment *and* alongside its span, so an open
 *   wall blocks without its infinite line affecting the rest of the canvas.
 */
export interface BoundaryGroup {
  readonly kind: "container" | "solid" | "barrier";
  readonly walls: readonly Boundary[];
}

export const container = (walls: readonly Boundary[]): BoundaryGroup => ({
  kind: "container",
  walls,
});
export const solid = (walls: readonly Boundary[]): BoundaryGroup => ({ kind: "solid", walls });
export const barrier = (walls: readonly Boundary[]): BoundaryGroup => ({ kind: "barrier", walls });

/**
 * Flatten groups to a plain wall list for `probe`/`pressure`. Those work
 * per-segment — a ray hits one wall, and proximity measures distance to one
 * segment — so grouping is irrelevant to them and only `enforce` needs it.
 */
export const walls = (groups: readonly BoundaryGroup[]): Boundary[] =>
  groups.flatMap((g) => [...g.walls]);

/**
 * Push a point out of every group it has penetrated, and kill the component of
 * its velocity heading inward so it does not immediately re-enter.
 *
 * This is the hard guarantee behind the soft steering: even if the steering
 * force is overwhelmed by flocking, a boid cannot end a frame inside a solid
 * or outside the container. `padding` keeps it visually clear of the surface.
 *
 * Returns true if any correction was applied.
 */
export const enforce = (
  groups: readonly BoundaryGroup[],
  position: Vec2,
  velocity: Vec2,
  padding = 0,
  restitution = 0,
  passes = 4,
): boolean => {
  let corrected = false;

  // Resolving one group can push the point into another, so sweep until a
  // pass finds nothing left to fix.
  for (let pass = 0; pass < passes; pass++) {
    let movedThisPass = false;
    for (const group of groups) {
      if (resolve(group, position, velocity, padding, restitution)) movedThisPass = true;
    }
    if (!movedThisPass) break;
    corrected = true;
  }

  return corrected;
};

/**
 * How far behind an open barrier a point can be and still be pulled back.
 * Comfortably exceeds a fast boid's per-frame travel, so a genuine crossing is
 * always caught, while a boid deep behind the wall is left alone.
 */
const BARRIER_REACH = 40;

/** Eject the point from one group. Returns true if it moved. */
const resolve = (
  group: BoundaryGroup,
  position: Vec2,
  velocity: Vec2,
  padding: number,
  restitution: number,
): boolean => {
  if (group.kind === "container") {
    let corrected = false;

    // Every wall must be satisfied; each violated one is pushed back on its
    // own normal. At a corner the point projects past the end of both walls,
    // so both push and the outer loop's extra passes settle it.
    for (const bound of group.walls) {
      const depth = padding - signedDistance(bound, position.x, position.y);
      if (depth <= 0) continue;

      position.x += bound.nx * depth;
      position.y += bound.ny * depth;
      applyVelocity(bound, velocity, restitution);
      corrected = true;
    }

    return corrected;
  }

  if (group.kind === "barrier") {
    let corrected = false;

    for (const bound of group.walls) {
      const depth = padding - signedDistance(bound, position.x, position.y);
      if (depth <= 0) continue;

      // An open segment has no interior, so its infinite line must not act
      // beyond its own extent — only correct points actually alongside it.
      const near = closestPoint(bound, position.x, position.y);
      if (near.t < 0 || near.t > 1) continue;

      // Nor may it act arbitrarily deep. A one-sided wall has no far side to
      // own: a boid well past it either started there or approached from
      // behind, and teleporting it across would be worse than letting it be.
      // Only pull back points shallow enough to have crossed this frame.
      if (depth > padding + BARRIER_REACH) continue;

      position.x += bound.nx * depth;
      position.y += bound.ny * depth;
      applyVelocity(bound, velocity, restitution);
      corrected = true;
    }

    return corrected;
  }

  // Solid: find the wall the point is least deeply behind. If any wall is
  // satisfied (depth <= 0) the point is outside the shape and must be left
  // alone — this is the check whose absence dragged the whole flock to a
  // single corner, since without it every boid on screen looked "behind"
  // some outward-facing wall.
  let shallowest: Boundary | undefined;
  let shallowestDepth = Infinity;

  for (const bound of group.walls) {
    const depth = padding - signedDistance(bound, position.x, position.y);
    if (depth <= 0) return false;
    if (depth < shallowestDepth) {
      shallowestDepth = depth;
      shallowest = bound;
    }
  }

  if (!shallowest) return false;

  // Eject through the nearest surface only — pushing on every wall at once
  // would overshoot past the shape.
  position.x += shallowest.nx * shallowestDepth;
  position.y += shallowest.ny * shallowestDepth;
  applyVelocity(shallowest, velocity, restitution);

  return true;
};

/** Remove (or reflect) the velocity component heading into a wall. */
const applyVelocity = (bound: Boundary, velocity: Vec2, restitution: number) => {
  const into = velocity.x * bound.nx + velocity.y * bound.ny;
  if (into >= 0) return;
  const scale = 1 + restitution;
  velocity.x -= bound.nx * into * scale;
  velocity.y -= bound.ny * into * scale;
};

/**
 * Proximity fallback: steer away from any wall within `margin`, regardless of
 * heading. Whiskers alone leave a boid sliding *along* a wall unbothered,
 * which is usually right — but a boid pinned into a corner by flockmates needs
 * a push that does not depend on where it is pointing.
 */
export const pressure = (
  bounds: readonly Boundary[],
  x: number,
  y: number,
  margin: number,
  out: Vec2,
): Vec2 => {
  const marginSq = margin * margin;

  for (const bound of bounds) {
    const near = closestPoint(bound, x, y);
    if (near.distSq >= marginSq) continue;

    const distance = Math.sqrt(near.distSq);
    // Quadratic ramp: full strength at the wall, zero at the margin.
    const t = 1 - distance / margin;
    const falloff = t * t;

    // Push along the actual separation where possible; fall back to the wall
    // normal when the boid is sitting exactly on the segment.
    if (distance > 1e-6) {
      out.x += ((x - near.x) / distance) * falloff;
      out.y += ((y - near.y) / distance) * falloff;
    } else {
      out.x += bound.nx * falloff;
      out.y += bound.ny * falloff;
    }
  }

  return out;
};

/**
 * One wall the fan found, scored by how urgently it needs avoiding.
 *
 * Aggregated *per wall*, not per whisker: a fan that happens to sample the
 * same wall three times has found one threat, not three. Counting per whisker
 * would weight a wall by how much of the fan it occupies — an artifact of
 * fan resolution rather than geometry, and one that shifts under the whisker
 * count slider.
 */
export interface Threat {
  bound: Boundary;
  /** Shortest distance to this wall across the whiskers that found it. */
  distance: number;
  /**
   * Frames until impact at the current closing speed, or Infinity when not
   * closing. Unlike `1 - distance/range` this does not collapse to zero at
   * the edge of perception, so a wall is resisted from the moment it is seen.
   */
  ttc: number;
  /** Rate of approach along this wall's normal, in units per frame. */
  closing: number;
  /** Perpendicular gap to the wall's line. */
  gap: number;
  /** 0 = no threat, 1 = maximally urgent. */
  urgency: number;
}

/**
 * Score every wall the fan can see.
 *
 * Urgency is the greater of two independent pressures:
 *
 * - **Time**: frames until impact, against `horizon`. Makes fast boids turn
 *   earlier without a separate lookahead term in the force.
 * - **Space**: perpendicular gap, against `clearance`. Makes proximity urgent
 *   on its own.
 *
 * Time alone is not enough, and the reason is subtle. As a boid turns parallel
 * to a wall its closing speed falls, so time-to-impact *rises* even as the gap
 * shrinks — the signal stabilizes just under the horizon and urgency decays to
 * nothing while the boid is still drifting in. That is the asymptotic wall-hug:
 * an equilibrium that holds only until a flockmate pushes the boid across it.
 * A gap-based term does not care how slowly the boid is approaching, so it
 * keeps a floor under the resistance no matter the heading.
 *
 * Taking the max rather than the sum keeps each pressure interpretable on its
 * own and bounds the result at 1 without normalizing.
 */
export const threats = (
  bounds: readonly Boundary[],
  config: ProbeConfig,
  context: ProbeContext,
  horizon: number,
  clearance: number,
): Threat[] => {
  const fan = castWhiskers(whiskers(config, context), bounds, context);

  // Nearest hit per distinct wall.
  const nearest = new Map<Boundary, number>();
  for (const w of fan) {
    if (w.distance === Infinity || !w.bound) continue;
    const prior = nearest.get(w.bound);
    if (prior === undefined || w.distance < prior) nearest.set(w.bound, w.distance);
  }

  const found: Threat[] = [];
  for (const [bound, distance] of nearest) {
    // Closing speed is measured along the wall normal, not along the whisker:
    // what matters is how fast the gap to the wall itself is shrinking.
    const closing = -(context.dx * bound.nx + context.dy * bound.ny) * context.speed;
    // Perpendicular gap, which is what `closing` eats into.
    const gap = signedDistance(bound, context.x, context.y);

    const ttc = closing > 1e-9 ? Math.max(0, gap) / closing : Infinity;

    const byTime = ttc < horizon ? 1 - ttc / horizon : 0;
    const byGap = clearance > 0 ? Math.max(0, 1 - Math.max(0, gap) / clearance) : 0;
    const urgency = Math.max(byTime, byGap);
    if (urgency <= 0) continue;

    found.push({ bound, distance, ttc, closing, gap, urgency });
  }

  return found;
};

/**
 * Combine scored walls into a single escape direction.
 *
 * Summed in the *normal* basis, weighted by urgency. This is the load-bearing
 * choice: two walls meeting at a corner contribute normals that add to their
 * bisector, so the way out of a corner falls out of the arithmetic instead of
 * needing to be detected. Summing in a left/right basis relative to the
 * heading — as a per-whisker lateral force does — destroys exactly that
 * information, and opposing walls cancel to noise.
 *
 * The returned vector is not normalized: its magnitude carries total urgency,
 * so a single distant wall yields a gentle nudge and a corner at close range
 * yields a large one.
 */
export const escape = (found: readonly Threat[], out = new Vec2()): Vec2 => {
  for (const threat of found) {
    out.x += threat.bound.nx * threat.urgency;
    out.y += threat.bound.ny * threat.urgency;
  }
  return out;
};
