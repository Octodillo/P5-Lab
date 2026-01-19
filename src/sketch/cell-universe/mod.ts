import { initSketch } from "../../sketch.ts";
import { GOL } from "./cell.ts";
import Universe from "./universe.ts";
import { GOL as Conway } from "../life-v1/rules.ts";

// native and embeddable dimensionalities

initSketch([], ({ p5: sketch, controls }) => {
  const Life = new Universe(2);
  const gol = new GOL(Life, [0, 0], Conway); // automatically add to Life
});
