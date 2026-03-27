import p5 from "p5";
import { EventEmitter } from "events";
import { button, type ControlDesc, Controls, numberInput, radio, row, stat } from "./controls.ts";
import { getElementByIdOrError, sketchSelectButton } from "./render.ts";

const Controller = [
  row([
    radio("updateMode", "pause", "Pause"),
    radio("updateMode", "play", "Play", true),
    radio("updateMode", "turbo", "Turbo"),
  ]),
  row([button("reload", "Reload"), button("step", "Step")]),
  numberInput("targetFPS", 60, "60", "Target FPS"),
  stat("currentFPS", "-", "Current FPS"),
];

export class P5Lab {
  private sketch: Sketch | undefined;
  public readonly index: SketchIndex = [];
  public readonly containers = {
    sketch: getElementByIdOrError("sketch-container"),
    index: getElementByIdOrError("sketches-container"),
    controls: getElementByIdOrError("controls-container"),
    globals: getElementByIdOrError("global-controls-container"),
  } as const;
  public readonly controls = new Controls<typeof Controller>(this.containers.globals);
  turboUpdatesPerFrame = 10;

  constructor() {
    Object.assign(globalThis, { Lab: this });
    this.controls.render(Controller);

    this.controls.subscribe("step", () => this.sketch?.update());
  }

  request(meta: SketchMeta) {
    const cacheBuster = Date.now();
    return import(`/src/sketch/${meta.entry}?t=${cacheBuster}`);
  }

  receive(Factory: SketchFactory) {
    this.remove();

    new p5(p5 => {
      p5.setup = () => {
        const width = this.containers.sketch.clientWidth;
        const height = this.containers.sketch.clientHeight;
        p5.createCanvas(width, height);

        this.sketch = new Factory(p5, this);
        this.sketch.controls.render(this.sketch.schema);
        this.sketch.setup?.();
      };

      p5.draw = () => {
        const mode = this.controls.values.updateMode;
        if (mode === "play") {
          this.sketch!.update();
        } else if (mode === "turbo") {
          for (let i = 0; i < this.turboUpdatesPerFrame; i++) this.sketch!.update();
        }

        // Wrap in push/pop to hopefully prevent intermittent flickering
        p5.push();
        this.sketch!.draw();
        p5.pop();
      };
    }, this.containers.sketch);
  }

  remove() {
    this.sketch?.remove?.();
    this.sketch = undefined;
    this.containers.sketch.innerHTML = "";
    this.containers.controls.innerHTML = "";
  }

  init = () =>
    Promise.allSettled([
      this.request({
        name: "Hello",
        entry: "hello.ts",
      }),
      this.refreshIndex(),
    ]);

  refreshIndex = () =>
    fetch("/sketches.json")
      .then(r => r.json())
      .then((index: SketchIndex) => {
        this.containers.index.innerHTML = "";
        index.map(sketchSelectButton).forEach(butt => this.containers.index.appendChild(butt));
      });
}

export abstract class Sketch<S extends readonly ControlDesc[] = readonly ControlDesc[]> {
  abstract readonly schema: S;
  public readonly controls: Controls<S>;

  private resizeObserver: ResizeObserver;

  constructor(
    protected p5: p5,
    protected lab: P5Lab,
  ) {
    this.controls = new Controls<S>(lab.containers.controls);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.lab.containers.sketch);
  }

  setup?(): void;
  abstract update(): void;
  abstract draw(): void;

  remove() {
    this.resizeObserver.disconnect();
    this.p5.remove();
  }

  resize() {
    const width = this.lab.containers.sketch.clientWidth;
    const height = this.lab.containers.sketch.clientHeight;
    if (width > 0 && height > 0) this.p5.resizeCanvas(width, height);
  }
}
export interface SketchMeta {
  name: string;
  entry: string;
  icon?: string;
  description?: string;
  feature?: boolean;
}

export type SketchIndex = SketchMeta[];

export class LabMouse extends EventEmitter<{
  clicked: [event: MouseEvent];
  dragged: [event: MouseEvent];
  moved: [event: MouseEvent];
  pressed: [event: MouseEvent];
  released: [event: MouseEvent];
  wheel: [event: WheelEvent];
}> {
  constructor(private sketch: p5) {
    super();
    sketch.mouseClicked = (event: MouseEvent) => this.emit("clicked", event);
    sketch.mouseDragged = (event: MouseEvent) => this.emit("dragged", event);
    sketch.mouseMoved = (event: MouseEvent) => this.emit("moved", event);
    sketch.mousePressed = (event: MouseEvent) => this.emit("pressed", event);
    sketch.mouseReleased = (event: MouseEvent) => this.emit("released", event);
    sketch.mouseWheel = (event: WheelEvent) => this.emit("wheel", event);
  }

  get button() {
    return this.sketch.mouseButton;
  }

  get x() {
    return this.sketch.mouseX;
  }
  get y() {
    return this.sketch.mouseY;
  }
  get winX() {
    return this.sketch.winMouseX;
  }
  get winY() {
    return this.sketch.winMouseY;
  }
  get pwinX() {
    return this.sketch.pwinMouseX;
  }
  get pwinY() {
    return this.sketch.pwinMouseY;
  }
}

type SketchFactory = new (p5: p5, lab: P5Lab) => Sketch;

export const request = (meta: SketchMeta) => ((globalThis as any).Lab as P5Lab).request(meta);
export const receive = (sketch: SketchFactory) => ((globalThis as any).Lab as P5Lab).receive(sketch);
