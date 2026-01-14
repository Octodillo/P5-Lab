# p5.js TypeScript Playground - Copilot Instructions

## Architecture Overview

Deno-based p5.js playground with live reload. Server transpiles TypeScript on-the-fly.

**Data flow:** `server.ts` → `/api/src/{sketch}/mod.ts` (transpiled) → Browser → `SketchController`

**Key files:**

- `sketches/lib.ts` - Core framework: `SketchController`, `P5MouseEvents`
- `sketches/controls.ts` - Declarative control descriptors and `Controls` class
- `sketches/common.ts` - Re-exports + utilities (`Map2`, `Set2`, `TupleMap`, `number2`)
- `static/index.js` - SPA that loads sketches dynamically

## Creating a New Sketch

1. Create folder: `sketches/{name}/mod.ts`
2. Server auto-discovers folders containing `mod.ts`

### Declarative API (Preferred)

```typescript
import { SketchController } from "../common.ts";
import { section, slider, button, row, checkbox } from "../controls.ts";

new SketchController(
  [
    section("Settings", [
      slider("speed", 0, 100, 50, 1),
      row([button("reset", "Reset"), checkbox("loop", "Loop", true)]),
    ]),
  ],
  (p, controls) => {
    let speed = 50;
    let loop = true;

    // Subscribe to control changes (called immediately with initial value)
    controls.subscribe<number>("speed", v => (speed = v));
    controls.subscribe<boolean>("loop", v => (loop = v));
    controls.subscribe("reset", () => {
      /* button click */
    });

    p.draw = () => {
      p.background(0);
    };
  }
).init();
```

**Note:** Override `p.setup` only for custom canvas setup (e.g., `p.colorMode`). `SketchController` handles canvas creation and resize.

## Controls API

### Descriptor Functions (from `controls.ts`)

```typescript
section(label, controls[])     // Container section
row(inputs[])                  // Horizontal layout
slider(name, min, max, value, step)
button(name, label?)
checkbox(name, label, checked?)
radio<T>(name, value, label, selected?)
select(name, options[], selected?)
option(label, value)
stat(name, value?)             // Read-only display
textInput(name, value?, placeholder?)
numberInput(name, value?, placeholder?)
tabs(controlName, { panelName: controls[] })  // Conditional panels
divider()
```

### Controls Instance Methods

```typescript
controls.subscribe<T>(name, callback); // React to changes (returns unsubscribe fn)
controls.get<T>(name); // Get current value
controls.set(name, value); // Programmatically update
controls.about<Desc>(name); // Get descriptor metadata (min/max/options)
```

### Example: Programmatic Control

```typescript
// Randomize within slider bounds
const size = controls.about<SliderDesc>("size")!;
controls.set("size", p.random(size.min, size.max));
```

### Example: Conditional Panels with `tabs()`

Use `tabs()` to show different controls based on another control's value:

```typescript
section("Tool", [
  row([
    radio("tool", "draw", "Draw", true),
    radio("tool", "erase", "Erase"),
    radio("tool", "select", "Select"),
  ]),
  tabs("tool", {
    draw: [slider("brushSize", 1, 50, 10, 1), select("color", [...])],
    erase: [slider("eraserSize", 5, 100, 20, 1)],
    select: [checkbox("multiSelect", "Multi-select", false)],
  }),
]),
```

The `tabs()` control watches the named control (`"tool"`) and shows only the matching panel.

## Mouse Events

```typescript
const mouse = new P5MouseEvents(p);
mouse.on("pressed", event => {
  /* event.button: 0=left, 2=right */
});
mouse.on("dragged", () => {
  /* mouse.x, mouse.y */
});
mouse.on("wheel", event => {
  /* event.deltaY */
});
```

## Coordinate Utilities

```typescript
import { number2, Map2, Set2, TupleMap } from "../common.ts";

const cells = new Map2<Cell>(); // Optimized 2D map: [x, y] → Item
cells.set([0, 0], cell);
cells.get([0, 0]);

const visited = new Set2(); // Optimized 2D set: [x, y] existence
visited.add([1, 2]);

const grid = new TupleMap<Item, 3>(); // N-dimensional: [x, y, z] → Item
```

## Development Commands

```bash
deno task dev    # Run with --allow-write (development)
deno task serve  # Run read-only mode
```

Server runs at `http://localhost:8000` with WebSocket live reload.

## TypeScript Conventions

- Imports: `import p5 from "p5"` maps to esm.sh via deno.json
- Canvas auto-resizes via `ResizeObserver` in `SketchController`
- Use `number2` for 2D coordinates: `type number2 = [number, number]`

## Sketch Examples by Complexity

- **Minimal:** `sketches/hello.ts` - Declarative controls, particles, no setup override
- **Intermediate:** `sketches/demo-controls-v2/mod.ts` - Full declarative API showcase
- **Complex:** `sketches/life-v2/mod.ts` - Simulation with `Map2`/`Set2`, tabs, model separation
- **Custom Engine:** `sketches/euclidean-construction/lib.ts` - Sketch-local geometry library
