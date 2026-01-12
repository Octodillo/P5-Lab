import p5 from "p5";
import { GOL, Rule, Star } from "./rules.ts";
import { LifeModel } from "./life.ts";

export interface Stamp {
  rule: Rule;
  positions: p5.Vector[];
}

export const Glider: Stamp = {
  rule: GOL,
  positions: [new p5.Vector(0, 0), new p5.Vector(1, 0), new p5.Vector(2, 0), new p5.Vector(2, 1), new p5.Vector(1, 2)],
};

export const SmallExploder: Stamp = {
  rule: GOL,
  positions: [
    new p5.Vector(0, 1),
    new p5.Vector(1, 0),
    new p5.Vector(1, 1),
    new p5.Vector(1, 2),
    new p5.Vector(2, 0),
    new p5.Vector(2, 2),
    new p5.Vector(3, 1),
  ],
};

export const LightweightSpaceship: Stamp = {
  rule: GOL,
  positions: [
    new p5.Vector(0, 1),
    new p5.Vector(0, 2),
    new p5.Vector(1, 0),
    new p5.Vector(2, 0),
    new p5.Vector(3, 0),
    new p5.Vector(3, 1),
    new p5.Vector(3, 2),
    new p5.Vector(2, 3),
  ],
};

export const Tumbler: Stamp = {
  rule: GOL,
  positions: [
    new p5.Vector(0, 0),
    new p5.Vector(0, 1),
    new p5.Vector(1, 0),
    new p5.Vector(1, 1),
    new p5.Vector(0, 3),
    new p5.Vector(0, 4),
    new p5.Vector(1, 3),
    new p5.Vector(1, 4),
    new p5.Vector(2, 2),
    new p5.Vector(3, 0),
    new p5.Vector(3, 1),
    new p5.Vector(4, 0),
    new p5.Vector(4, 1),
    new p5.Vector(3, 3),
    new p5.Vector(3, 4),
    new p5.Vector(4, 3),
    new p5.Vector(4, 4),
  ],
};

export const GosperGliderGun: Stamp = {
  rule: GOL,
  positions: [
    new p5.Vector(0, 4),
    new p5.Vector(0, 5),
    new p5.Vector(1, 4),
    new p5.Vector(1, 5),
    new p5.Vector(10, 4),
    new p5.Vector(10, 5),
    new p5.Vector(10, 6),
    new p5.Vector(11, 3),
    new p5.Vector(11, 7),
    new p5.Vector(12, 2),
    new p5.Vector(12, 8),
    new p5.Vector(13, 2),
    new p5.Vector(13, 8),
    new p5.Vector(14, 5),
    new p5.Vector(15, 3),
    new p5.Vector(15, 7),
    new p5.Vector(16, 4),
    new p5.Vector(16, 5),
    new p5.Vector(16, 6),
    new p5.Vector(17, 5),
    new p5.Vector(20, 2),
    new p5.Vector(20, 3),
    new p5.Vector(20, 4),
    new p5.Vector(21, 2),
    new p5.Vector(21, 3),
    new p5.Vector(21, 4),
    new p5.Vector(22, 1),
    new p5.Vector(22, 5),
    new p5.Vector(24, 0),
    new p5.Vector(24, 1),
    new p5.Vector(24, 5),
    new p5.Vector(24, 6),
    new p5.Vector(34, 2),
    new p5.Vector(34, 3),
    new p5.Vector(35, 2),
    new p5.Vector(35, 3),
  ],
};

export const LaserGun: Stamp = {
  rule: Star,
  positions: [
    new p5.Vector(0, 0),
    new p5.Vector(-2, 4),
    new p5.Vector(-2, 3),
    new p5.Vector(-2, 2),
    new p5.Vector(-2, 1),
    new p5.Vector(-2, 0),
    new p5.Vector(-2, -1),
    new p5.Vector(-2, -2),
    new p5.Vector(-2, -3),
    new p5.Vector(-2, -4),
    new p5.Vector(-1, 3),
    new p5.Vector(-1, -3),
    new p5.Vector(0, 2),
    new p5.Vector(0, 0),
    new p5.Vector(0, -2),
    new p5.Vector(1, 1),
    new p5.Vector(1, -1),
    new p5.Vector(2, 0),
  ],
};

export default { Glider, GosperGliderGun };
