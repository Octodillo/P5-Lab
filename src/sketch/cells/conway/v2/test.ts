import { assert } from "https://deno.land/std@0.208.0/assert/assert.ts";
import { Life } from "./model.ts";
import Rules from "../rules.ts";

Deno.test("cells are born and killed", () => {
  const life = new Life();

  life.place([0, 0], Rules.GOL);
  life.place([1, 0], Rules.GOL);
  life.place([0, 1], Rules.GOL);

  life.place([3, 3], Rules.GOL);

  life.update();

  assert(!!life.get([1, 1]), "Cell wasn't born");
  assert(!life.get([3, 3]), "Cell didn't die");
});

// --- Block (2x2 still life) should be stable ---
Deno.test("block stays stable over multiple ticks", () => {
  const life = new Life();
  life.place([0, 0], Rules.GOL);
  life.place([1, 0], Rules.GOL);
  life.place([0, 1], Rules.GOL);
  life.place([1, 1], Rules.GOL);

  for (let i = 0; i < 10; i++) {
    life.update();
    assert(!!life.get([0, 0]), `tick ${i}: [0,0] died`);
    assert(!!life.get([1, 0]), `tick ${i}: [1,0] died`);
    assert(!!life.get([0, 1]), `tick ${i}: [0,1] died`);
    assert(!!life.get([1, 1]), `tick ${i}: [1,1] died`);
    assert(!life.get([0, 0])!.isDead(), `tick ${i}: [0,0] is marked dead`);
  }
});

// --- Blinker oscillator ---
Deno.test("blinker oscillates between horizontal and vertical", () => {
  const life = new Life();
  // Horizontal blinker: (0,0) (1,0) (2,0)
  life.place([0, 0], Rules.GOL);
  life.place([1, 0], Rules.GOL);
  life.place([2, 0], Rules.GOL);

  life.update();

  // Should become vertical: (1,-1) (1,0) (1,1)
  assert(!!life.get([1, -1]) && !life.get([1, -1])!.isDead(), "blinker: [1,-1] should be alive");
  assert(!!life.get([1, 0]) && !life.get([1, 0])!.isDead(), "blinker: [1,0] should be alive");
  assert(!!life.get([1, 1]) && !life.get([1, 1])!.isDead(), "blinker: [1,1] should be alive");
  // Corners should be empty (not alive)
  assert(!life.get([0, 0]) || life.get([0, 0])!.isDead(), "blinker: [0,0] should not be alive");
  assert(!life.get([2, 0]) || life.get([2, 0])!.isDead(), "blinker: [2,0] should not be alive");

  life.update();

  // Should return to horizontal
  assert(!!life.get([0, 0]) && !life.get([0, 0])!.isDead(), "blinker period 2: [0,0] should be alive");
  assert(!!life.get([1, 0]) && !life.get([1, 0])!.isDead(), "blinker period 2: [1,0] should be alive");
  assert(!!life.get([2, 0]) && !life.get([2, 0])!.isDead(), "blinker period 2: [2,0] should be alive");
});

// --- Placing on an occupied position should not corrupt state ---
Deno.test("placing on occupied position replaces cell and keeps neighbor graph intact", () => {
  const life = new Life();
  life.place([0, 0], Rules.GOL);
  life.place([1, 0], Rules.GOL);
  life.place([0, 1], Rules.GOL);

  // Place on top of an existing cell
  const oldCell = life.get([0, 0]);
  life.place([0, 0], Rules.GOL);
  const newCell = life.get([0, 0]);

  // Cell count shouldn't change, and the reference should be new
  assert(life.all().length === 3, `Expected 3 cells, got ${life.all().length}`);
  assert(newCell !== oldCell, "place on occupied position should replace the cell");

  // After update, the L-shape should still birth [1,1] — verifies the neighbor
  // graph wasn't corrupted by the overwrite (old cell's stale references cleaned up)
  life.update();
  const born = life.get([1, 1]);
  assert(!!born && !born.isDead(), "[1,1] should be born — neighbor graph may be corrupt");
});

// --- delete on a decaying cell should fully remove it ---
Deno.test("delete removes a decaying cell cleanly", () => {
  const life = new Life();
  // Use Star Wars rule which has decay
  life.place([0, 0], Rules.Star);

  // Kill it so it enters decay
  life.get([0, 0])!.die();
  assert(life.get([0, 0])!.isDead(), "cell should be dead (decaying)");
  assert(!!life.get([0, 0]), "cell should still exist in map while decaying");

  // Now force-delete it
  life.delete([0, 0]);
  assert(!life.get([0, 0]), "cell should be fully removed from map after delete");
});

// --- kill then update: neighbors should correctly lose a neighbor ---
Deno.test("killing a cell updates neighbor counts correctly", () => {
  const life = new Life();
  // Place a block
  life.place([0, 0], Rules.GOL);
  life.place([1, 0], Rules.GOL);
  life.place([0, 1], Rules.GOL);
  life.place([1, 1], Rules.GOL);

  // Kill one corner — the block should collapse
  life.kill([0, 0]);

  // After one update, the remaining 3 cells in an L should birth a new cell at [0,0]
  // and all 3 original cells should survive (each has 2 neighbors = survives in GOL)
  life.update();

  // [0,0] should be reborn (3 live neighbors → born)
  // Actually: [1,0] has neighbors [0,0](dead), [1,1], [0,1]? Let's check:
  // [1,0] neighbors: [0,0](dead/decaying), [1,1](alive), [0,1](alive) → 2 live → survives
  // [0,1] neighbors: [0,0](dead/decaying), [1,0](alive), [1,1](alive) → 2 live → survives
  // [1,1] neighbors: [1,0](alive), [0,1](alive), [0,0](dead/decaying) → 2 live → survives
  // [0,0] empty spot: neighbors [1,0](alive), [0,1](alive), [1,1](alive) → 3 live → born!
  assert(!!life.get([1, 0]) && !life.get([1, 0])!.isDead(), "[1,0] should survive");
  assert(!!life.get([0, 1]) && !life.get([0, 1])!.isDead(), "[0,1] should survive");
  assert(!!life.get([1, 1]) && !life.get([1, 1])!.isDead(), "[1,1] should survive");
  // [0,0] should be reborn since it has exactly 3 live neighbors
  assert(!!life.get([0, 0]) && !life.get([0, 0])!.isDead(), "[0,0] should be reborn");
});

// --- Bounds should shrink when cells are removed ---
Deno.test("bounds shrink after cells are deleted", () => {
  const life = new Life();
  life.place([0, 0], Rules.GOL);
  life.place([10, 10], Rules.GOL);

  const [lo, hi] = life.bounds();
  assert(lo[0] === 0 && lo[1] === 0, "initial low bound");
  assert(hi[0] === 10 && hi[1] === 10, "initial high bound");

  life.delete([10, 10]);

  const [, hi2] = life.bounds();
  assert(hi2[0] <= 0 && hi2[1] <= 0, `bounds should shrink, but high is [${hi2}]`);
});

// --- Glider should move diagonally ---
Deno.test("glider moves one cell diagonally after 4 ticks", () => {
  const life = new Life();
  // Standard glider:
  //   .X.
  //   ..X
  //   XXX
  life.place([1, 0], Rules.GOL);
  life.place([2, 1], Rules.GOL);
  life.place([0, 2], Rules.GOL);
  life.place([1, 2], Rules.GOL);
  life.place([2, 2], Rules.GOL);

  for (let i = 0; i < 4; i++) life.update();

  // After 4 ticks, glider should have moved (+1, +1) relative to start
  // Original positions shifted by (1,1):
  const expected: [number, number][] = [
    [2, 1],
    [3, 2],
    [1, 3],
    [2, 3],
    [3, 3],
  ];

  const alive = life
    .all()
    .filter(({ item }) => !item.isDead())
    .map(({ position }) => position);

  assert(alive.length === 5, `expected 5 alive cells, got ${alive.length}`);
  for (const [ex, ey] of expected) {
    const cell = life.get([ex, ey]);
    assert(!!cell && !cell.isDead(), `expected alive cell at [${ex},${ey}]`);
  }
});

// --- GOL cell with decay=undefined dies instantly (no lingering) ---
Deno.test("GOL cell is deleted on the same tick it dies", () => {
  const life = new Life();
  life.place([5, 5], Rules.GOL);

  // Isolated cell: will die on first update
  life.update();

  // With no decay rule, the cell should be fully gone — not lingering as dead
  const cell = life.get([5, 5]);
  assert(!cell, `GOL cell should be deleted immediately, but it still exists (decay=${cell?.decay})`);
});

// --- Decaying cells should not block births ---
Deno.test("decaying Star Wars cell does not count as alive for birth checks", () => {
  const life = new Life();
  // Place a Star Wars cell and let it die so it's decaying
  life.place([0, 0], Rules.Star);
  life.update(); // dies, enters decay

  assert(life.get([0, 0])?.isDead(), "should be decaying");

  // Now place 2 live Star Wars cells adjacent to [1, 1]
  // Star Wars born rule: [2, 7, 8]. So we need exactly 2 live neighbors for birth.
  life.place([1, 0], Rules.Star);
  life.place([2, 1], Rules.Star);

  life.update();

  // [1,1] has 2 live neighbors ([1,0] and [2,1]) plus the decaying [0,0].
  // If decaying cells are correctly excluded, [1,1] should be born (2 live neighbors).
  // If decaying cells are incorrectly counted as alive, it would see 3 → not born.
  const cell = life.get([1, 1]);
  assert(!!cell && !cell.isDead(), "[1,1] should be born with exactly 2 live neighbors");
});

// --- die(instant=true) should bypass decay entirely ---
Deno.test("die(instant=true) removes cell immediately without decay", () => {
  const life = new Life();
  life.place([0, 0], Rules.Star);

  life.get([0, 0])!.die(true);

  assert(!life.get([0, 0]), "instant death should remove cell from map immediately");
});

// --- Double die should be idempotent ---
Deno.test("calling die() twice doesn't double-advance decay", () => {
  const life = new Life();
  life.place([0, 0], Rules.Star);

  const cell = life.get([0, 0])!;
  cell.die();
  const decayAfterFirst = cell.decay;
  cell.die();
  const decayAfterSecond = cell.decay;

  assert(
    decayAfterFirst === decayAfterSecond,
    `die() should be idempotent: decay went from ${decayAfterFirst} to ${decayAfterSecond}`,
  );
});

// --- Decaying cells block births at their position ---
Deno.test("decaying cell blocks birth at its position", () => {
  const life = new Life();
  // Create a Star Wars cell and let it start decaying
  life.place([1, 1], Rules.Star);
  life.update(); // [1,1] dies (isolated), enters decay

  assert(life.get([1, 1])?.isDead(), "should be decaying");

  // Now surround [1,1] with exactly 2 live Star Wars cells (born: [2])
  life.place([0, 0], Rules.Star);
  life.place([2, 0], Rules.Star);

  life.update();

  // The decaying cell occupies the position, preventing a birth there
  const cell = life.get([1, 1]);
  assert(!!cell && cell.isDead(), "decaying cell should block birth at its position");
});

// --- Multi-rule interaction: GOL and Star Wars cells as neighbors ---
Deno.test("cells of different rules coexist and follow their own rules", () => {
  const life = new Life();
  // GOL cell at [0,0], Star Wars cells around it
  life.place([0, 0], Rules.GOL);
  life.place([1, 0], Rules.Star);
  life.place([0, 1], Rules.Star);

  // [0,0] has 2 neighbors → survives (GOL live: [2,3])
  // [1,0] has 2 neighbors → dies (Star live: [3,4,5,6])
  // [0,1] has 2 neighbors → dies (Star live: [3,4,5,6])
  life.update();

  const gol = life.get([0, 0]);
  const star1 = life.get([1, 0]);
  const star2 = life.get([0, 1]);

  assert(!!gol && !gol.isDead(), "GOL cell should survive with 2 neighbors");
  assert(!!star1 && star1.isDead(), "Star Wars cell should die with 2 neighbors");
  assert(!!star2 && star2.isDead(), "Star Wars cell should die with 2 neighbors");
});

// --- Birth rule uses neighbor's rule, not some global rule ---
Deno.test("born cell inherits rule from a neighbor, chosen randomly", () => {
  const life = new Life();
  // GOL born: [3]. Place 3 GOL cells around [1,1]
  life.place([0, 0], Rules.GOL);
  life.place([1, 0], Rules.GOL);
  life.place([2, 0], Rules.GOL);

  life.update();

  // [1,-1] should be born (3 neighbors, all GOL → born rule matches)
  const born = life.get([1, -1]);
  assert(!!born && !born.isDead(), "[1,-1] should be born");
  // It should inherit the GOL rule from its neighbors
  assert(born!.rule === Rules.GOL, "born cell should have GOL rule");
});

// --- Killing a cell that's already been deleted is a no-op ---
Deno.test("kill on empty position is a no-op", () => {
  const life = new Life();
  // Should not throw
  life.kill([99, 99]);
  life.delete([99, 99]);
  assert(true, "no crash on killing/deleting nonexistent positions");
});

// --- Star Wars decay=6: exactly 5 updates from alive to deleted, with correct decay values ---
Deno.test("Star Wars: isolated cell decays through all stages in 5 updates", () => {
  const life = new Life();
  const cell = life.place([0, 0], Rules.Star);

  // Update 1: die + first decay tick
  life.update();
  assert(!!life.get([0, 0]), "update 1: should still exist");
  assert(cell.isDead(), "update 1: should be dead");
  assert(cell.decay === 1, `update 1: expected decay=1, got ${cell.decay}`);

  // Updates 2-4: continuing decay
  for (let i = 2; i <= 4; i++) {
    life.update();
    assert(!!life.get([0, 0]), `update ${i}: should still exist`);
    assert(cell.decay === i, `update ${i}: expected decay=${i}, got ${cell.decay}`);
  }

  // Update 5: should be deleted
  life.update();
  assert(!life.get([0, 0]), "update 5: should be deleted");
});

// --- Dead cells should not gain new neighbors via connect ---
Deno.test("dead cell does not accumulate phantom neighbors", () => {
  const life = new Life();
  life.place([0, 0], Rules.GOL);
  life.place([1, 0], Rules.GOL);

  // Kill [0,0]
  life.get([0, 0])!.die();

  // Now place a new cell adjacent to the dead one
  life.place([0, 1], Rules.GOL);

  // The dead cell at [0,0] should NOT have connected to [0,1]
  // Check: [0,1]'s live neighbor count should only include [1,0]
  // (This is tested indirectly: if dead cell connects, it inflates neighbor counts)
  // After update, [0,0] should not come back to life just from 2 neighbors
  life.update();

  // With only 2 live neighbors ([1,0] and [0,1]), [0,0] should NOT be born (GOL needs 3)
  const reborn = life.get([0, 0]);
  assert(!reborn || reborn.isDead(), "[0,0] should not be reborn with only 2 neighbors");
});
