# p5.js TypeScript Playground - Copilot Instructions

## Architecture Overview

Deno-based p5.js playground with live reload. Server transpiles TypeScript on-the-fly.

**Data flow:** `server.ts` → `/api/src/{sketch}/mod.ts` (transpiled) → Browser → `SketchController`

**Key files:**

- `sketches/lib.ts` - Core framework: `SketchController`, `ControlsBuilder`, `P5MouseEvents`, `GlobalControls`
- `sketches/common.ts` - Re-exports from `lib.ts` + shared utilities (`TupleMap`, `Tuple<T,N>`, `number2`)
- `static/index.js` - SPA that loads sketches dynamically
- Sketch-local `lib.ts` files (e.g., `euclidean-construction/lib.ts`) - For bespoke systems/engines

## Creating a New Sketch

1. Create folder: `sketches/{name}/mod.ts`
2. Server auto-discovers folders containing `mod.ts`

```typescript
import { SketchController } from "../common.ts";

new SketchController((p, controls) => {
  // 1. State variables
  let speed = 50;

  // 2. Build controls (fluent API) - runs before setup
  controls.section("Settings").slider("Speed", 0, 100, speed, 1, v => {
    speed = v;
  });

  // 3. Draw loop (canvas auto-created by SketchController)
  p.draw = () => {
    p.background(0);
  };
}).init();
```

**Note:** Override `p.setup` only when you need custom canvas setup (e.g., `p.colorMode`). The `SketchController` handles canvas creation and resize automatically.

## Controls API (Fluent Builder Pattern)

Controls are built using chainable methods. See `sketches/demo-controls/mod.ts` for comprehensive examples.

```typescript
// Section → row → controls → endRow → back to section
controls
  .section("Animation")
  .row("Playback")
  .button("Play", () => {})
  .button("Pause", () => {})
  .endRow()
  .slider("Speed", 0, 1, 0.5, 0.1, v => (speed = v))
  .checkbox("Loop", "Enable loop", true, v => (loop = v))
  .stat("FPS", ""); // Updateable text display

// Access controls later:
controls.get("Animation").get<SliderControl>("Speed").setValue(0.8);
```

**Available controls:** `button`, `slider`, `checkbox`, `select`, `numberInput`, `textInput`, `radio`, `radioGroup` (deprecated), `stat`, `highlight`, `divider`

## Mouse Events

Use `P5MouseEvents` wrapper for typed event handling:

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

## Development Commands

```bash
deno task dev    # Run with --allow-write (for development)
deno task serve  # Run read-only mode
```

Server runs at `http://localhost:8000` with WebSocket live reload.

## TypeScript Conventions

- Imports use URL specifiers: `import p5 from "p5"` maps to esm.sh
- Canvas auto-resizes via `ResizeObserver` in `SketchController`
- Type definitions in `types/p5-global.d.ts` and `static/types.ts`
- Use `number2` type alias for 2D coordinates: `type number2 = [number, number]`

## Sketch Examples by Complexity

- **Simple:** `sketches/demo-controls/mod.ts` - Controls showcase, no setup override
- **Intermediate:** `sketches/life-v2/mod.ts` - Grid interaction, interval simulation, mouse drawing
- **Complex:** `sketches/euclidean-construction/mod.ts` - Custom lib.ts for geometric engine
