// import p5 from "p5";

export interface Rule {
  readonly name: string;
  readonly color: {
    hex: string;
    invert?: boolean;
    nudge?: number;
  };
  readonly born: number[];
  readonly live: number[];
  readonly decay?: number;
}

export const GOL: Rule = {
  name: "Conway's Game of Life",
  color: { hex: "#00e000" },
  born: [3],
  live: [2, 3],
};

export const Star: Rule = {
  name: "Star Wars",
  color: {
    hex: "#00f",
    invert: true,
    nudge: 0.05,
  },
  born: [2, 7, 8],
  live: [3, 4, 5, 6],
  decay: 4,
};

export const Gnarl: Rule = {
  name: "Gnarl",
  color: { hex: "#f00" },
  born: [1],
  live: [1],
  // decay: 3,
};

export default { GOL, Star, Gnarl } as const;
