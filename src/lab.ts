import p5 from "p5";
import { EventEmitter } from "events";
import { button, type ControlDesc, Controls, numberInput, radio, type RadioDesc, row, stat } from "./controls.ts";

export const getElementByIdOrError = (id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`No ${id}!?`);
  return element;
};

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
  private catalog: SketchCatalog | undefined;
  private currentId: string | undefined;
  public readonly containers = {
    sketch: getElementByIdOrError("sketch-container"),
    index: getElementByIdOrError("sketches-container"),
    controls: getElementByIdOrError("controls-container"),
    globals: getElementByIdOrError("global-controls-container"),
  } as const;
  public readonly index = new Controls<[RadioDesc<"sketch", string>]>(this.containers.index);
  public readonly controls = new Controls<typeof Controller>(this.containers.globals);
  turboUpdatesPerFrame = 10;

  constructor() {
    Object.assign(globalThis, { Lab: this });
    this.controls.render(Controller);

    this.controls.subscribe("step", () => this.sketch?.update());
    this.controls.subscribe("reload", () => this.reload());

    globalThis.addEventListener("popstate", () => {
      const id = this.resolveRoute();
      if (id !== undefined && id !== this.currentId) this.load(id);
    });
  }

  private resolveRoute(): string | undefined {
    if (!this.catalog) return undefined;
    const path = location.pathname.slice(1); // strip leading /
    if (path in this.catalog.sketches) return path;
    return undefined;
  }

  /** Check the index radio matching the active sketch (without firing load). */
  private syncIndexSelection(id: string) {
    const inputs = this.containers.index.querySelectorAll<HTMLInputElement>('input[name="radio-sketch"]');
    inputs.forEach(input => {
      input.checked = input.value === id;
    });
  }

  load(id: string) {
    if (!this.catalog) return;
    const meta = this.catalog.sketches[id];
    if (!meta) return;

    this.currentId = id;
    this.syncIndexSelection(id);
    const target = `/${id}`;
    if (location.pathname !== target) {
      history.pushState({ sketchId: id }, "", target);
    }

    return this.request(meta);
  }

  request(meta: SketchMeta) {
    const cacheBuster = Date.now();
    return import(`/_/sketch/${meta.entry}?t=${cacheBuster}`);
  }

  /** Re-import the active sketch module and restart it from scratch. */
  reload() {
    if (this.currentId === undefined) return;
    return this.load(this.currentId);
  }

  receive(Factory: SketchFactory) {
    this.remove();

    new p5(p5 => {
      // The sketch this p5 instance owns. `this.sketch` must not be used
      // inside these callbacks: `p5.remove()` does not cancel an already
      // queued animation frame, so a torn-down instance can tick once more
      // after the next sketch has been installed — and would then drive the
      // *new* sketch. Capturing the instance keeps each loop to its own.
      let own: Sketch | undefined;

      p5.setup = () => {
        const width = this.containers.sketch.clientWidth;
        const height = this.containers.sketch.clientHeight;
        p5.createCanvas(width, height);

        own = new Factory(p5, this);
        this.sketch = own;
        own.controls.render(own.schema);
        own.setup?.();
      };

      p5.draw = () => {
        // Stale frame from a removed instance — drop it.
        if (!own || own !== this.sketch) return;

        const mode = this.controls.values.updateMode;
        if (mode === "play") {
          own.update();
        } else if (mode === "turbo") {
          for (let i = 0; i < this.turboUpdatesPerFrame; i++) own.update();
        }

        if (!own.redraw()) return;

        // Wrap in push/pop to hopefully prevent intermittent flickering
        p5.push();
        own.draw();
        p5.pop();
      };
    }, this.containers.sketch);
  }

  remove() {
    const previous = this.sketch;
    // Clear the reference first: `draw` bails when its instance is no longer
    // the active one, so a queued frame cannot tick during teardown. Doing it
    // before `remove()` also means a throwing sketch still gets unloaded
    // rather than being left running over a detached canvas.
    this.sketch = undefined;

    try {
      previous?.remove?.();
    } catch (error) {
      console.error("Sketch teardown failed; unloading anyway.", error);
    }

    this.containers.sketch.innerHTML = "";
    this.containers.controls.innerHTML = "";
  }

  init = () =>
    this.refreshIndex().then(() => {
      const routeId = this.resolveRoute();
      return this.load(routeId ?? "");
    });

  refreshIndex = () =>
    fetch("/sketches.json")
      .then(r => r.json())
      .then((catalog: SketchCatalog) => {
        this.catalog = catalog;
        this.index.render(
          catalog.sidebar.map(id => radio("sketch", id, catalog.sketches[id].name, id === this.currentId)),
        );
        this.index.subscribe("sketch", id => load(id), false);
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

  /**
   * Mouse events as an emitter, so several behaviors can listen at once —
   * p5's `mousePressed`/`mouseDragged`/etc. are single assignable slots, and
   * the last writer silently wins. Constructed on first access; disposed with
   * the p5 instance in `remove()`.
   */
  private _mouse?: LabMouse;
  protected get mouse(): LabMouse {
    return (this._mouse ??= new LabMouse(this.p5));
  }

  setup?(): void;
  abstract update(): void;
  abstract draw(): void;

  remove() {
    this.resizeObserver.disconnect();
    this._mouse?.dispose();
    this._mouse = undefined;
    this.p5.remove();
  }

  redraw() {
    return true;
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
  warning?: string;
}

export interface SketchCatalog {
  sketches: Record<string, SketchMeta>;
  sidebar: string[];
}

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

  /**
   * Drop the listeners *and* the handler slots claimed on the p5 instance.
   * Clearing only the listeners would leave those closures in place, and each
   * one captures this emitter — keeping the whole sketch reachable after it
   * should have been torn down.
   */
  dispose() {
    // this.removeAllListeners();
    const noop = () => {};
    this.sketch.mouseClicked = noop;
    this.sketch.mouseDragged = noop;
    this.sketch.mouseMoved = noop;
    this.sketch.mousePressed = noop;
    this.sketch.mouseReleased = noop;
    this.sketch.mouseWheel = noop;
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

// deno-lint-ignore no-explicit-any
const lab = () => (globalThis as any).Lab as P5Lab;

export const load = (id: string) => lab().load(id);
export const request = (meta: SketchMeta) => lab().request(meta);
export const receive = (sketch: SketchFactory) => lab().receive(sketch);
