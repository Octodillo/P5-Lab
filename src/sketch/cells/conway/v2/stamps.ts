import { number2 } from "../../../../common.ts";
import { GOL, Rule, Star } from "../rules.ts";

export interface Stamp {
  name: string;
  rule: Rule;
  positions: number2[];
}

export const GosperGliderGun: Stamp = {
  name: "Gosper Glider Gun",
  rule: GOL,
  positions: [
    [0, 4],
    [0, 5],
    [1, 4],
    [1, 5],
    [10, 4],
    [10, 5],
    [10, 6],
    [11, 3],
    [11, 7],
    [12, 2],
    [12, 8],
    [13, 2],
    [13, 8],
    [14, 5],
    [15, 3],
    [15, 7],
    [16, 4],
    [16, 5],
    [16, 6],
    [17, 5],
    [20, 2],
    [20, 3],
    [20, 4],
    [21, 2],
    [21, 3],
    [21, 4],
    [22, 1],
    [22, 5],
    [24, 0],
    [24, 1],
    [24, 5],
    [24, 6],
    [34, 2],
    [34, 3],
    [35, 2],
    [35, 3],
  ],
};

export const Glider: Stamp = {
  name: "Glider",
  rule: GOL,
  positions: [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [1, 2],
  ],
};

export const SmallExploder: Stamp = {
  name: "Small exploder",
  rule: GOL,
  positions: [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 0],
    [2, 2],
    [3, 1],
  ],
};

export const LightweightSpaceship: Stamp = {
  name: "Lightweight spaceship",
  rule: GOL,
  positions: [
    [0, 1],
    [0, 2],
    [1, 0],
    [2, 0],
    [3, 0],
    [3, 1],
    [3, 2],
    [2, 3],
  ],
};

export const Tumbler: Stamp = {
  name: "Tumbler",
  rule: GOL,
  positions: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [0, 3],
    [0, 4],
    [1, 3],
    [1, 4],
    [2, 2],
    [3, 0],
    [3, 1],
    [4, 0],
    [4, 1],
    [3, 3],
    [3, 4],
    [4, 3],
    [4, 4],
  ],
};

export const LaserGun: Stamp = {
  name: "Laser gun",
  rule: Star,
  positions: [
    [0, 0],
    [-2, 4],
    [-2, 3],
    [-2, 2],
    [-2, 1],
    [-2, 0],
    [-2, -1],
    [-2, -2],
    [-2, -3],
    [-2, -4],
    [-1, 3],
    [-1, -3],
    [0, 2],
    [0, 0],
    [0, -2],
    [1, 1],
    [1, -1],
    [2, 0],
  ],
};

export default { Glider, SmallExploder, LightweightSpaceship, Tumbler, GosperGliderGun, LaserGun } as const;
