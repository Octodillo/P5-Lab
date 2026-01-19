import { SketchMeta } from "./common.ts";

export const getElementByIdOrError = (id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`No ${id}!?`);
  return element;
};

export async function loadSketch(meta: SketchMeta) {
  const sketch = getElementByIdOrError("sketch-container");
  const controls = getElementByIdOrError("controls-container");
  const globalControls = getElementByIdOrError("global-controls-container");

  sketch.innerHTML = "";
  controls.innerHTML = "<div class='loading'>Loading controls...</div>";

  const cacheBuster = Date.now();
  await import(`/src/sketch/${meta.entry}?t=${cacheBuster}`);
}

export function sketchSelectButton(meta: SketchMeta) {
  const item = document.createElement("div");
  item.className = "sketch-item";

  const icon = document.createElement("img");
  icon.className = "sketch-icon";
  icon.src = meta.icon ?? "/icons/default.svg";
  item.appendChild(icon);

  const label = document.createElement("span");
  label.className = "sketch-label";
  label.textContent = meta.name;
  item.appendChild(label);

  item.onclick = () => loadSketch(meta);
  return item;
}
