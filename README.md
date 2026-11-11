# P5 Lab

A browser playground for [p5.js](https://p5js.org) sketches written in TypeScript, and the small
framework that runs them. The framework is the main piece of work here; most of the sketches are
toys that exercise it.

**Status:** work in progress. It runs locally and is not hosted anywhere yet.

## What the framework does

- **Declarative, typed controls.** A sketch describes its control panel as a schema. The lab builds
  the panel from it, and the sketch reads values with their types inferred from the schema.
- **Sketch lifecycle.** Sketches are loaded by dynamic import, each at its own URL. Switching
  sketches tears the old one down cleanly before the new one starts.
- **Playback controls.** Every sketch gets pause, play, turbo, single-step and reload, plus a target
  frame rate.
- **Error reporting.** Problems in a sketch show up in the page as a plain-language message, with
  the stack and source one click away, instead of failing silently.
- **No build step.** A small Deno server transpiles TypeScript on request and serves everything else
  as static files.

## A sketch, briefly

```ts
import { checkbox, slider } from "../controls.ts";
import { receive, Sketch } from "../lab.ts";

const Controller = [slider("size", 20, 200, 80, 1), checkbox("outline", "Outline", true)] as const;

class Example extends Sketch<typeof Controller> {
  readonly schema = Controller;

  update() {}

  draw() {
    const { size, outline } = this.controls.values; // typed from the schema
    // ...draw with this.p5
  }
}

receive(Example);
```

`src/sketch/demo.ts` shows every control type.

## Sketches

| Sketch                  | State                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Controls Demo           | Working; shows the controls API                                                                                 |
| Game of Life            | Working; supports several rule sets                                                                             |
| Euclidean Constructions | Working; compass-and-straightedge constructions, a port of my [CASC](https://github.com/Octodillo/CASC) library |
| Minesweeper             | Working                                                                                                         |
| Error Reporting         | Working; triggers each warning and error path on purpose                                                        |
| Boids, Boids v2         | Placeholders                                                                                                    |
| Sorting Visualizer      | Scaffold only                                                                                                   |
| CHIP-8 Emulator         | In progress                                                                                                     |

## Running it

You need [Deno](https://deno.com).

```sh
deno task dev
```

Then open <http://localhost:8000>.

## Adding a sketch

1. Create a file under `src/sketch/`.
2. Define a control schema with the factories in `src/controls.ts`.
3. Extend `Sketch<typeof Controller>` and implement `update()` and `draw()` (and `setup()` if
   needed).
4. Call `receive(YourClass)` at the bottom of the file.
5. Add an entry to `static/sketches.json`.

## Layout

- `server.ts`: the dev server.
- `src/lab.ts`: the lab itself and the `Sketch` base class.
- `src/controls.ts`: the controls schema and panel.
- `src/report.ts`: error reporting.
- `src/common.ts`, `src/decision.ts`: shared utilities.
- `src/sketch/`: the sketches.
- `static/`: the page, styles, icons and the sketch catalog.
