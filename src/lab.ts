import p5 from "p5";
import { EventEmitter } from "events";
import { Controls } from "./controls.ts";
import { getElementByIdOrError, sketchSelectButton } from "./render.ts";

export class P5Lab {
  private sketch: _Sketch | undefined;
  private p5: p5 | undefined;
  public readonly index: SketchIndex = [];
  public readonly containers = {
    sketch: getElementByIdOrError("sketch-container"),
    index: getElementByIdOrError("sketches-container"),
    controls: getElementByIdOrError("controls-container"),
    globals: getElementByIdOrError("global-controls-container"),
  } as const;
  public readonly controls = new Controls(this.containers.globals);

  constructor() {
    Object.assign(globalThis, { Lab: this });
  }

  request(meta: SketchMeta) {
    const cacheBuster = Date.now();
    return import(`/src/sketch/${meta.entry}?t=${cacheBuster}`);
  }

  receive(sketch: _Sketch) {
    this.remove();
    this.p5 = new p5(p => {
      // TODO
    }, this.containers.sketch);
  }

  remove() {
    this.sketch?.remove?.(this.p5!);
    this.sketch = undefined;
    this.containers.sketch.innerHTML = "";
    this.containers.controls.innerHTML = "";
  }

  init = () => Promise.allSettled([this.hello(), this.refreshIndex()]);

  hello = () =>
    this.request({
      name: "Hello",
      entry: "hello.ts",
    });

  refreshIndex = () =>
    fetch("/sketches.json")
      .then(r => r.json())
      .then((index: SketchIndex) => {
        this.containers.controls.innerHTML = "";
        index.map(sketchSelectButton).forEach(butt => this.containers.index.appendChild(butt));
      });
}

export interface _Sketch<Config = unknown> {
  config: Config;
  setup?(p5: p5): void;
  draw(p5: p5): void;
  remove?(p5: p5): void;
}

// export abstract class Sketch<Config = unknown> {
//   abstract meta: SketchMeta;

//   public readonly mouse: LabMouse;

//   setup() {
//     this.lab.receive(this);
//     this.p5.createCanvas(this.lab.containers.sketch.clientWidth, this.lab.containers.sketch.clientHeight);
//     this.lab.containers.sketch.addEventListener("resize", () => this.resize());
//   }

//   abstract draw(): void;

//   abstract remove(): void;

//   constructor(
//     protected lab: P5Lab,

//     /** Configuration for the sketch, responded to instantly */
//     public config: Config,
//   ) {
//     this.lab.receive(this);

//     this.p5 = new p5(p5 => {
//       p5.setup = () => this.setup();
//       p5.draw = () => this.draw();
//     }, this.lab.containers.sketch);
//     this.mouse = new LabMouse(this.p5);
//   }

//   protected resize() {
//     const width = this.lab.containers.sketch.clientWidth;
//     const height = this.lab.containers.sketch.clientHeight;
//     if (width > 0 && height > 0) this.p5.resizeCanvas(width, height);
//   }
// }

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

type SketchFactory = (p5: p5, lab: P5Lab) => void;

export const request = (meta: SketchMeta) => ((globalThis as any).Lab as P5Lab).request(meta);
export const receive = (sketch: _Sketch) => ((globalThis as any).Lab as P5Lab).receive(sketch);
