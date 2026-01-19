import p5 from "p5";
import { EventEmitter } from "events";
import { ControlDesc, Controls, ControlsRenderer } from "./controls.ts";
import { getElementByIdOrError } from "./render.ts";

export interface SketchMeta {
  name: string;
  entry: string;
  icon?: string;
  description?: string;
  feature?: boolean;
}

interface SketchInstance {
  p5: p5;
  mouse: P5MouseEvents;
  controls: Controls;
  // events
}

export interface SketchPlatform {
  sketch?: SketchInstance;
  meta?: SketchMeta;
  containers: {
    sketch: HTMLElement;
    controls: HTMLElement;
    globals: HTMLElement;
  };
  controls: Controls;
}

export const Platform: SketchPlatform = {
  containers: {
    sketch: getElementByIdOrError("sketch-container"),
    controls: getElementByIdOrError("controls-container"),
    globals: getElementByIdOrError("global-controls-container"),
  } as const,
  controls: {} as Controls,
};

export type SketchIndex = SketchMeta[];

new ResizeObserver(() => {
  const width = Platform.containers.sketch.clientWidth;
  const height = Platform.containers.sketch.clientHeight;
  if (width > 0 && height > 0) Platform.sketch?.p5.resizeCanvas(width, height);
}).observe(Platform.containers.sketch);

export const initSketch = (controls: ControlDesc[], fn: (platform: SketchInstance) => void) =>
  new p5(p5 => {
    Platform.sketch?.p5.remove();

    Platform.sketch = {
      p5,
      controls: new ControlsRenderer().render(controls, Platform.containers.controls),
      mouse: new P5MouseEvents(p5),
    };

    p5.setup = () => p5.createCanvas(p5.windowWidth, p5.windowHeight);

    fn(Platform.sketch);

    const setup = p5.setup;
    p5.setup = () => {
      p5.createCanvas(p5.windowWidth, p5.windowHeight);
      setup();
    };
  }, Platform.containers.sketch);

export function loadSketch(meta: SketchMeta) {
  Platform.sketch?.p5.remove();
  Platform.meta = meta;
  Platform.containers.sketch.innerHTML = "";
  Platform.containers.controls.innerHTML = "<div class='loading'>Loading controls...</div>";

  const cacheBuster = Date.now();
  import(`/src/sketch/${meta.entry}?t=${cacheBuster}`);
}

export class P5MouseEvents extends EventEmitter<{
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
