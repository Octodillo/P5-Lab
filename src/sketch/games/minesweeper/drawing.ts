import { p5 } from "../../../../types/p5-global.d.ts";

export const revealedCellBG = (p: p5) => {
  p.fill(200);
  p.stroke(160);
  p.strokeWeight(0.02);
  p.rect(0, 0, 1, 1);
};

export const hiddenCellBG = (p: p5) => {
  p.fill(170);
  p.stroke(120);
  p.strokeWeight(0.02);
  // raised 3D-ish button look
  p.rect(0, 0, 1, 1);
  p.stroke(220);
  p.line(0, 0, 1, 0); // top highlight
  p.line(0, 0, 0, 1); // left highlight
  p.stroke(100);
  p.line(1, 0, 1, 1); // right shadow
  p.line(0, 1, 1, 1); // bottom shadow
};

export const mine = (p: p5) => {
  revealedCellBG(p);
  // draw mine: black circle with spokes
  p.fill(0);
  p.noStroke();
  p.ellipse(0.5, 0.5, 0.5, 0.5);
  p.stroke(0);
  p.strokeWeight(0.06);
  for (let a = 0; a < p.TAU; a += p.TAU / 8) {
    p.line(0.5, 0.5, 0.5 + p.cos(a) * 0.38, 0.5 + p.sin(a) * 0.38);
  }
  // glint
  p.fill(255);
  p.noStroke();
  p.ellipse(0.4, 0.4, 0.12, 0.12);
};

export const guide = (p: p5, adjacent: number) => {
  revealedCellBG(p);

  // draw guide number
  const colors = [
    "#000000", // unused
    "#0000FF", // 1 blue
    "#008000", // 2 green
    "#FF0000", // 3 red
    "#000080", // 4 navy
    "#800000", // 5 maroon
    "#008080", // 6 teal
    "#000000", // 7 black
    "#808080", // 8 gray
  ];
  p.fill(p.color(colors[adjacent] ?? "#FF0000"));
  p.noStroke();
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(0.6);

  const display = adjacent < 0 || adjacent > 8 ? "!" : adjacent === 0 ? "" : `${adjacent}`;

  p.text(display, 0.5, 0.5);
};

export const flag = (p: p5) => {
  hiddenCellBG(p);
  p.stroke(0);
  p.strokeWeight(0.04);
  p.line(0.35, 0.2, 0.35, 0.8);
  p.noStroke();
  p.fill("#CC0000");
  p.triangle(0.35, 0.2, 0.35, 0.5, 0.7, 0.35);
  p.fill(0);
  p.rect(0.25, 0.75, 0.3, 0.06);
};

export const questionMark = (p: p5) => {
  hiddenCellBG(p);
  p.fill(0);
  p.noStroke();
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(0.65);
  p.text("?", 0.5, 0.5);
};
