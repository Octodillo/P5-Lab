import { loadSketch, SketchIndex } from "./sketch.ts";
import { getElementByIdOrError, sketchSelectButton } from "./render.ts";

const sketches = getElementByIdOrError("sketches-container");
fetch("/sketches.json")
  .then(r => r.json())
  .then((index: SketchIndex) => index.map(sketchSelectButton).forEach(butt => sketches.appendChild(butt)));

loadSketch({
  name: "Hello",
  entry: "hello.ts",
});
