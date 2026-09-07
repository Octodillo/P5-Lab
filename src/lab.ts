import p5 from "p5";
import { EventEmitter } from "events";
import {
  button,
  type ControlDesc,
  Controls,
  numberInput,
  radio,
  type RadioDesc,
  row,
  setControlErrorHandler,
  stat,
} from "./controls.ts";
import { describe, Reporter } from "./report.ts";

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
  public readonly report = new Reporter({
    // The fatal panel covers the viewport, not the canvas holder — that one is
    // emptied on every teardown, and the panel has to outlive it.
    overlayMount: this.containers.sketch.parentElement ?? this.containers.sketch,
    onReload: () => void this.reload(),
  });
  turboUpdatesPerFrame = 10;

  /** The entry path of the sketch being loaded — used to label its reports. */
  private currentEntry: string | undefined;

  /**
   * Bumped on every load. A slow import that resolves after the user has moved
   * on belongs to a sketch nobody is looking at, so its failures are logged
   * rather than thrown over whatever is on screen now.
   */
  private loadToken = 0;

  /**
   * How many times `receive()` has been called. A sketch whose `setup()` throws
   * clears `this.sketch` just like one that never registered at all, so the
   * "did the module hand us anything?" check counts registrations instead of
   * comparing references — otherwise a failed setup gets reported twice, and
   * the vaguer message wins.
   */
  private receipts = 0;

  constructor() {
    Object.assign(globalThis, { Lab: this });
    this.controls.render(Controller);

    this.controls.subscribe("step", () => this.step());
    this.controls.subscribe("reload", () => this.reload());

    globalThis.addEventListener("popstate", () => {
      const id = this.resolveRoute();
      if (id !== undefined && id !== this.currentId) this.load(id);
    });

    this.watchForEscapes();

    setControlErrorHandler((name, cause) =>
      this.report.error("A control didn't take", {
        hint: `Changing "${name}" didn't finish. The sketch is still running.`,
        cause,
        source: `${this.currentEntry ?? "sketch"} — control: ${name}`,
      })
    );
  }

  /**
   * Last line of defence. Anything a sketch throws from a callback we don't
   * own — a timer, an event listener, a settled promise — lands here instead
   * of dying silently in the console.
   */
  private watchForEscapes() {
    globalThis.addEventListener("error", (event) => {
      // Failed <img>/<audio> loads surface here too, but carry no error value.
      if (!event.error && !event.message) return;
      this.report.error("Something went wrong in the background", {
        hint: "The sketch is still running, but part of it didn't finish.",
        cause: event.error ?? event.message,
        source: this.currentEntry,
      });
    });

    globalThis.addEventListener("unhandledrejection", (event) => {
      this.report.error("An async task failed", {
        hint: "Something the sketch was waiting on didn't come back.",
        cause: event.reason,
        source: this.currentEntry,
      });
    });
  }

  /** Advance one frame, reporting a throw rather than losing it to the click handler. */
  private step() {
    if (!this.sketch) return;
    this.report.guard("Couldn't step the sketch", {
      hint: "That single frame didn't finish. The sketch is otherwise untouched.",
      source: `${this.currentEntry ?? "sketch"} — update()`,
    }, () => this.sketch?.update());
  }

  private resolveRoute(): string | undefined {
    if (!this.catalog) return undefined;
    const path = location.pathname.slice(1); // strip leading /
    if (path in this.catalog.sketches) return path;
    return undefined;
  }

  /** Check the index radio matching the active sketch (without firing load). */
  private syncIndexSelection(id: string) {
    const inputs = this.containers.index.querySelectorAll<HTMLInputElement>(
      'input[name="radio-sketch"]',
    );
    inputs.forEach((input) => {
      input.checked = input.value === id;
    });
  }

  load(id: string) {
    if (!this.catalog) return;
    const meta = this.catalog.sketches[id];
    if (!meta) {
      this.report.warn("No sketch by that name", {
        hint: `Nothing in the catalog is called "${id}". Pick one from the list on the left.`,
        detail: `Known ids: ${Object.keys(this.catalog.sketches).join(", ")}`,
        source: "sketches.json",
      });
      return;
    }

    this.currentId = id;
    this.syncIndexSelection(id);
    const target = `/${id}`;
    if (location.pathname !== target) {
      history.pushState({ sketchId: id }, "", target);
    }

    return this.request(meta);
  }

  async request(meta: SketchMeta) {
    const token = ++this.loadToken;
    this.currentEntry = meta.entry;
    // A fresh attempt supersedes whatever the last one was complaining about.
    this.report.clear();

    const url = `/_/sketch/${meta.entry}?t=${Date.now()}`;
    const before = this.receipts;

    try {
      const module = await import(url);
      if (token !== this.loadToken) return module;

      // A sketch registers itself by calling `receive()` at module scope. If
      // the module evaluated without doing so, that call is missing — a blank
      // canvas with no error is the worst way to find that out.
      if (this.receipts === before) {
        // Nothing took over, so the previous sketch is still running behind
        // the panel we're about to raise. Unload it first — `remove()` clears
        // the overlay, so it has to happen before the report, not after.
        this.remove();
        this.report.fatal("This sketch never started", {
          hint: "The file loaded, but it didn't hand a sketch back to the lab.",
          detail:
            `${meta.entry} finished evaluating without calling receive().\n\nAdd this at the bottom of the module:\n\n    receive(YourSketchClass);`,
          source: meta.entry,
        });
      }
      return module;
    } catch (cause) {
      if (token !== this.loadToken) {
        console.warn(`Superseded load of ${meta.entry} failed.`, cause);
        return;
      }
      await this.reportLoadFailure(meta, url, cause);
      return;
    }
  }

  /**
   * Say *why* the import failed.
   *
   * A dynamic import rejects with the same opaque "failed to fetch dynamically
   * imported module" whether the server is down, the path is wrong, or the
   * TypeScript doesn't compile. Re-fetching the URL tells the three apart, and
   * the dev server puts the compiler's diagnostic in the body of its 500.
   */
  private async reportLoadFailure(meta: SketchMeta, url: string, cause: unknown) {
    const trace = describe(cause);
    // The user has already moved on in the sidebar; leaving the old sketch
    // animating behind the panel would misrepresent what's loaded. Unloading
    // also clears any overlay, so it must precede every report below.
    this.remove();

    let response: Response | undefined;
    try {
      response = await fetch(url, { cache: "no-store" });
    } catch {
      this.report.fatal("Can't reach the dev server", {
        hint:
          "The page is up but the server that builds sketches isn't answering. Start it, then reload.",
        detail: `Fetching ${url} failed outright.\n\n${trace}`,
        source: meta.entry,
        actions: [{ label: "Reload page", run: () => location.reload(), primary: true }],
      });
      return;
    }

    if (response.status === 404) {
      this.report.fatal("That sketch file is missing", {
        hint: "The catalog points at a file that isn't on disk.",
        detail:
          `HTTP 404 for src/sketch/${meta.entry}\n\nCheck the "entry" for this sketch in static/sketches.json.`,
        source: meta.entry,
      });
      return;
    }

    if (!response.ok) {
      const diagnostic = (await response.text().catch(() => "")).trim();
      this.report.fatal("This sketch didn't compile", {
        hint: "TypeScript couldn't build the file. The compiler's message is below.",
        detail: diagnostic || `HTTP ${response.status} for src/sketch/${meta.entry}\n\n${trace}`,
        source: meta.entry,
      });
      return;
    }

    // The file served fine, so it threw while evaluating: a bad top-level
    // statement, or a module it imports that blew up.
    this.report.fatal("This sketch crashed while loading", {
      hint: "The file ran, but something threw before the sketch could start.",
      detail: trace,
      source: meta.entry,
    });
  }

  /** This session's reports, newest last. Handy from the console: `Lab.reports`. */
  get reports() {
    return this.report.history;
  }

  /** Re-import the active sketch module and restart it from scratch. */
  reload() {
    if (this.currentId === undefined) return;
    return this.load(this.currentId);
  }

  receive(Factory: SketchFactory) {
    this.receipts++;
    this.remove();

    const entry = this.currentEntry ?? "sketch";

    new p5((p5) => {
      // The sketch this p5 instance owns. `this.sketch` must not be used
      // inside these callbacks: `p5.remove()` does not cancel an already
      // queued animation frame, so a torn-down instance can tick once more
      // after the next sketch has been installed — and would then drive the
      // *new* sketch. Capturing the instance keeps each loop to its own.
      let own: Sketch | undefined;

      // A throwing draw loop throws sixty times a second. Once one frame
      // fails, stop this instance rather than let it grind out the same
      // stack trace until the tab is closed.
      let halted = false;
      const halt = (title: string, phase: string, cause: unknown) => {
        halted = true;
        try {
          p5.noLoop();
        } catch { /* the instance may already be half gone; the flag is enough */ }

        this.report.fatal(title, {
          hint: "It's been stopped so it doesn't keep failing. Your controls are still there.",
          cause,
          source: `${entry} — ${phase} (frame ${p5.frameCount})`,
        });
      };

      p5.setup = () => {
        try {
          const width = this.containers.sketch.clientWidth;
          const height = this.containers.sketch.clientHeight;
          p5.createCanvas(width, height);

          own = new Factory(p5, this);
          this.sketch = own;
          own.controls.render(own.schema);
          own.setup?.();
        } catch (cause) {
          halted = true;
          // Half-built is worse than absent: drop the reference so no later
          // frame, resize or step can reach a sketch that never finished.
          if (this.sketch === own) this.sketch = undefined;

          // It may still have got far enough to attach a resize observer and
          // mouse handlers before it fell over, and those outlive the failure.
          try {
            own?.remove();
          } catch {
            try {
              p5.noLoop();
            } catch { /* nothing left to stop */ }
          }
          own = undefined;

          this.report.fatal("This sketch couldn't start", {
            hint: "It failed while setting itself up, so there's nothing to show yet.",
            cause,
            source: `${entry} — setup()`,
          });
        }
      };

      p5.draw = () => {
        // Stale frame from a removed instance, or one we've already stopped.
        if (halted || !own || own !== this.sketch) return;

        const mode = this.controls.values.updateMode;
        try {
          if (mode === "play") {
            own.update();
          } else if (mode === "turbo") {
            for (let i = 0; i < this.turboUpdatesPerFrame; i++) own.update();
          }
        } catch (cause) {
          halt("This sketch stopped running", "update()", cause);
          return;
        }

        try {
          if (!own.redraw()) return;

          // Wrap in push/pop to hopefully prevent intermittent flickering
          p5.push();
          own.draw();
          p5.pop();
        } catch (cause) {
          halt("This sketch stopped drawing", "draw()", cause);
        }
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

    // A sketch that fails on the way out has still been unloaded, and the next
    // one is about to start — worth knowing about, not worth blocking on.
    try {
      previous?.remove?.();
    } catch (cause) {
      this.report.warn("The last sketch didn't shut down cleanly", {
        hint: "It's been unloaded anyway. Watch for leftover listeners or timers.",
        cause,
        source: "remove()",
      });
    }

    this.report.clearFatal();
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
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText} for /sketches.json`);
        return r.json();
      })
      .then((catalog: SketchCatalog) => {
        this.catalog = catalog;
        this.index.render(
          catalog.sidebar.map((id) =>
            radio("sketch", id, catalog.sketches[id].name, id === this.currentId)
          ),
        );
        this.index.subscribe("sketch", (id) => load(id), false);
      })
      // Without a catalog there is no sidebar and no way to pick anything, so
      // this is the one failure that takes the whole page down with it.
      .catch((cause) => {
        this.containers.index.innerHTML = "";
        this.report.fatal("The sketch list didn't load", {
          hint: "The lab can't find its catalog, so there's nothing to choose from.",
          cause,
          source: "static/sketches.json",
          actions: [{ label: "Try again", run: () => location.reload(), primary: true }],
        });
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
    // The observer calls back outside any frame we wrap, so guard it here or a
    // throw in a sketch's custom `resize()` vanishes into the browser.
    this.resizeObserver = new ResizeObserver(() =>
      lab.report.guard("Couldn't resize the sketch", {
        hint: "The canvas kept its previous size.",
        source: "resize()",
      }, () => this.resize())
    );
    this.resizeObserver.observe(this.lab.containers.sketch);
  }

  /**
   * Raise something the person watching should know about.
   *
   * Use `report.warn` for recoverable oddities a sketch can carry on through —
   * a file that wouldn't parse, a parameter clamped to something sane — and
   * `report.fatal` when the sketch genuinely cannot continue. Both land in the
   * console with a full stack regardless of what the UI shows.
   */
  protected get report() {
    return this.lab.report;
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
