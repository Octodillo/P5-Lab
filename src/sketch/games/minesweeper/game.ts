import p5 from "https://esm.sh/@types/p5@1.7.7/index.js";
import { flag, guide, hiddenCellBG, mine, questionMark } from "./drawing.ts";
import { Map2, shuffle } from "../../../common.ts";

export type CellState = "Blank" | "Flag" | "Question" | "Revealed";

export class Cell {
  adjacentMines = 0;

  constructor(
    public mine = false,
    public state: CellState = "Blank",
  ) {}

  draw(p: p5) {
    switch (this.state) {
      case "Revealed":
        if (this.mine) mine(p);
        else guide(p, this.adjacentMines);
        return;
      case "Flag":
        flag(p);
        return;
      case "Question":
        questionMark(p);
        return;
      case "Blank":
        hiddenCellBG(p);
        return;
      default:
        console.log(`Unknown cell state: ${this.state satisfies never}`);
    }
  }
}

export type GameState = "Empty" | "Fresh" | "Partial" | "Win" | "Lose";

export default class Minesweeper {
  state: GameState = "Empty";
  cells = new Map2<Cell>();
  width = 0;
  height = 0;
  density = 0;

  draw(p: p5) {
    const cellSize = Math.min(p.width / this.width, p.height / this.height);
    p.scale(cellSize);

    this.cells.forEach((cell, [x, y]) => {
      p.push();
      p.translate(x, y);
      cell.draw(p);
      p.pop();
    });
  }

  generate(width: number, height: number, density: number) {
    this.width = width;
    this.height = height;
    this.density = density;

    const cellCount = width * height;
    const cells = Array.from({ length: cellCount }, _ => new Cell(false, "Revealed"));

    const mineCount = Math.ceil(cellCount * this.density);
    cells.slice(0, mineCount).forEach(cell => (cell.mine = true));

    shuffle(cells);

    this.cells.clear();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) this.cells.set([x, y], cells[y * width + x]);

    this.cells.forEach((cell, [x, y]) => {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const neighbor = this.cells.get([x + dx, y + dy]);
          if (neighbor?.mine) count++;
        }

      cell.adjacentMines = count;

      this.state = "Fresh";
    });
  }
}
