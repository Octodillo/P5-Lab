# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A p5.js sketch playground built with Deno and TypeScript. Sketches are loaded dynamically in the browser, transpiled on-the-fly by a Deno dev server. The UI is a three-column layout: sketch list, controls panel, and canvas viewport.

## Commands

```sh
deno task dev     # Start dev server with live reload + file watcher (port 8000)
deno task serve   # Start server without file watching
deno fmt          # Format (2-space indent, 100 char lines, semicolons)
deno lint         # Lint with recommended rules
deno check src/   # Type-check (uses dom + deno.ns libs)
```

There are no test commands configured. Some sketches have ad-hoc test files (e.g. `src/sketch/cells/conway/v2/test.ts`).

## Architecture

### Dev Server (`server.ts`)

Routes:
- `/` → `static/index.html`
- `/src/**/*.ts` → on-the-fly TypeScript transpilation via `@deno/emit`
- `/ws` → WebSocket for live reload (watches filesystem, sends reload on file changes)
- Everything else → static file serving from `static/`

Import maps are duplicated in three places that must stay in sync: `deno.json` (for type-checking), `server.ts` (for transpilation), and `static/index.html` (browser importmap). Currently maps `p5` and `events`.

### Sketch System

Entry point: `src/init.ts` → creates `P5Lab` instance.

**`P5Lab`** (`src/lab.ts`): Orchestrator. Fetches `sketches.json` for the sidebar, dynamically imports sketch modules via `/src/sketch/{entry}`, and manages the p5 lifecycle (setup/draw loop). Exposes global controls (play/pause/turbo/step/FPS).

**`Sketch`** (`src/lab.ts`): Abstract base class all sketches extend. Key contract:
- `schema`: readonly array of control descriptors (defines the controls panel)
- `update()`: called per-frame in play mode, or N times per frame in turbo mode
- `draw()`: called every frame after update
- `setup()`: optional, called once after canvas creation
- Constructor receives `p5` instance and `P5Lab` reference

**Sketch lifecycle**: `P5Lab.request(meta)` → dynamic import → module calls `receive(SketchClass)` → `P5Lab.receive()` tears down old sketch, creates new p5 instance, instantiates sketch, renders its controls.

### Controls System (`src/controls.ts`)

Declarative, type-safe UI controls. Sketches define a `Controller` schema as a const array of descriptors, then access values via `this.controls.values.{name}` with full type inference.

Available descriptors: `section`, `row`, `divider`, `tabs`, `radio`, `checkbox`, `slider`, `select`, `stat`, `button`, `textInput`, `numberInput`.

Controls support `subscribe(name, callback)` for reactive updates and `set(name, value)` for programmatic changes.

### Adding a New Sketch

1. Create a file under `src/sketch/` (can be nested)
2. Define a `Controller` schema array using control descriptor factories
3. Extend `Sketch<typeof Controller>`, set `schema = Controller`
4. Implement `update()` and `draw()` (optionally `setup()`)
5. Call `receive(YourClass)` at module scope
6. Add an entry to `static/sketches.json` with `entry` pointing to the file relative to `src/sketch/`

### Utilities

- **`src/common.ts`**: `Pool<T>` (managed collection with resize), `TupleMap`/`TupleSet` (N-dimensional coordinate maps/sets), `Map2`/`Set2` (optimized 2D variants), `zip`, `cross`, `shuffle`
- **`src/decision.ts`**: Lazy evaluation combinators (`decide`, `condition`, `chance`, `choose`, `weighted`, `cycle`, `cases`, `range`, `fallback`, `proxy`) for composable randomized/conditional logic
- **`src/render.ts`**: DOM helpers for the sketch sidebar
- **`src/lab.ts`**: Also exports `LabMouse` (EventEmitter wrapper around p5 mouse events)
