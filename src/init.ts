import { SketchIndex } from "./common.ts";
import { getElementByIdOrError, loadSketch, sketchSelectButton } from "./render.ts";

const sketches = getElementByIdOrError("sketches-container");
fetch("/sketches")
  .then(r => r.json())
  .then((index: SketchIndex) => index.map(sketchSelectButton).forEach(butt => sketches.appendChild(butt)));

loadSketch({
  name: "Hello",
  entry: "hello.ts",
});
