import { button, divider, row, section, stat } from "../../controls.ts";
import { receive, Sketch } from "../../lab.ts";

/**
 * Every way a sketch can fail, on a button.
 *
 * The reporting paths are the ones you least want to discover are broken, and
 * most of them only fire when something else has already gone wrong. This
 * sketch triggers each one deliberately so the toasts, the counter, the fatal
 * panel and the console mirror can all be looked at on purpose.
 *
 * The "fatal" buttons really do stop this sketch — that's the behaviour under
 * test. Hit Reload in the panel (or the global Reload) to get it back.
 */

const Controller = [
  section("Non-fatal — a toast, sketch keeps running", [
    button("warn", "Warning"),
    button("err", "Error (with stack)"),
    button("repeat", "Repeat 120× (dedupe)"),
    row([button("badControl", "Throwing control"), button("plainThrow", "Throw a string")]),
  ]),
  divider(),
  section("Escaped — caught by the global net", [
    row([button("timerThrow", "Throw in a timer"), button("rejectThrow", "Reject a promise")]),
  ]),
  divider(),
  section("Fatal — replaces the sketch", [
    button("failUpdate", "Throw in update()"),
    button("failDraw", "Throw in draw()"),
  ]),
  divider(),
  section("State", [
    stat("reports", "0", "Reports this session"),
    stat("status", "running", "Sketch"),
  ]),
];

/** A few frames deep, so the stack in the toast has something to show. */
const explode = (message: string): never => {
  const inner = () => {
    throw new TypeError(message, { cause: new RangeError("the underlying cause") });
  };
  const middle = () => inner();
  return middle();
};

class ReportLab extends Sketch<typeof Controller> {
  readonly schema = Controller;

  private failIn: "update" | "draw" | undefined;
  private repeatsLeft = 0;
  private t = 0;

  override setup(): void {
    this.controls.subscribe("warn", () =>
      this.report.warn("Nothing to draw yet", {
        hint: "The pattern needs at least one seed point. Click the canvas to add one.",
        source: "report-lab/sketch.ts",
      }));

    this.controls.subscribe("err", () =>
      this.report.error("Couldn't parse that file", {
        hint: "The sketch carried on with the previous data.",
        cause: new SyntaxError("Unexpected token < in JSON at position 0"),
        source: "report-lab/sketch.ts — loadPalette()",
      }));

    // Fires the same report every frame for two seconds: the toast should
    // count up in place rather than stacking 120 of them down the screen.
    this.controls.subscribe("repeat", () => (this.repeatsLeft = 120));

    this.controls.subscribe("badControl", () => explode("this control handler is broken"));

    this.controls.subscribe("plainThrow", () => {
      // Not every throw is an Error; the reporter has to cope with bare values.
      throw "just a string, no stack anywhere";
    });

    this.controls.subscribe(
      "timerThrow",
      () => setTimeout(() => explode("thrown from a timer nobody is watching"), 0),
    );

    this.controls.subscribe("rejectThrow", () => {
      void Promise.reject(new Error("a fetch that never came back"));
    });

    this.controls.subscribe("failUpdate", () => (this.failIn = "update"));
    this.controls.subscribe("failDraw", () => (this.failIn = "draw"));
  }

  update(): void {
    this.t += 0.02;

    if (this.repeatsLeft > 0) {
      this.repeatsLeft--;
      this.report.error("A cell fell off the grid", {
        hint: "It was skipped. This one repeats, so watch the count instead of the pile.",
        cause: new RangeError("index -1 is out of bounds"),
        source: "report-lab/sketch.ts — step()",
      });
    }

    this.controls.set("reports", String(this.lab.reports.length));

    if (this.failIn === "update") {
      this.controls.set("status", "stopped in update()");
      explode("update() hit something it couldn't handle");
    }
  }

  draw(): void {
    const { p5 } = this;
    p5.background("#0a0a0a");

    if (this.failIn === "draw") {
      this.controls.set("status", "stopped in draw()");
      explode("draw() hit something it couldn't handle");
    }

    // Something calm to watch, so it's obvious when it stops.
    p5.noFill();
    p5.strokeWeight(1.5);
    const rings = 5;
    for (let i = 0; i < rings; i++) {
      const phase = this.t + (i * Math.PI) / rings;
      const radius = 40 + i * 26 + Math.sin(phase) * 10;
      p5.stroke(129, 140, 248, 200 - i * 30);
      p5.circle(p5.width / 2, p5.height / 2, radius * 2);
    }

    p5.noStroke();
    p5.fill("#71717a");
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textSize(12);
    p5.text("Use the controls to break this on purpose.", p5.width / 2, p5.height - 28);
  }
}

receive(ReportLab);
