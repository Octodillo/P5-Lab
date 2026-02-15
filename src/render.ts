import { request, SketchMeta } from "./lab.ts";

export const getElementByIdOrError = (id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`No ${id}!?`);
  return element;
};

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

  item.onclick = () => request(meta);
  return item;
}
