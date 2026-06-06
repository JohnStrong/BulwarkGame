# Game Logic Library Modules

Reusable modules extracted from the isometric game engine. Each module is self-contained and can be used in other similar games.

## Table of Contents

- [Files](#files)
- [iso-camera.js — IsoCamera](#iso-camerajs--isocamera)
- [iso-input.js — IsoInput](#iso-inputjs--isoinput)
- [iso-renderer.js — IsoRenderer](#iso-rendererjs--isorenderer)
- [overlay-utils.js — resolveOverlayDraw](#overlay-utilsjs--resolveoverlaydraw)
- [hud.js — HUD](#hudjs--hud)
- [Usage in a New Game](#usage-in-a-new-game)
- [State Monad (GameState)](#state-monad-gamestate)

---

## Files

| Module | Purpose |
|--------|---------|
| `iso-camera.js` | Camera system: scroll, zoom, viewpoint rotation, iso projection math |
| `iso-input.js` | Input handling: keyboard, mouse, wheel events with callbacks |
| `iso-renderer.js` | Tile and unit rendering with hover/select effects; exports overlay constants and map |
| `overlay-utils.js` | Overlay allowlist + draw closure resolver; keeps `drawTerrain` clean |
| `hud.js` | All HUD panels: top bar, unit bar, detail panel, tile info |

## iso-camera.js — IsoCamera

Manages the isometric camera state and coordinate transformations.

**Key methods:**
- `init(canvas, config)` — set up with canvas and tile dimensions
- `setMapSize(w, h)` — calculate map offset from grid dimensions
- `centerOn(row, col)` — center camera on a grid position
- `gridToScreen(row, col)` — convert grid → screen pixels
- `screenToGrid(screenX, screenY, levelW, levelH)` — convert screen → grid
- `scroll(dx, dy)` — apply scroll movement
- `applyZoom(delta)` — adjust zoom level
- `applyTransform(ctx)` — apply zoom to canvas context
- `toggleViewpoint()` — flip between BR→TL and BL→TR

## iso-input.js — IsoInput

Decoupled input system. Tracks key state and fires callbacks.

**Callbacks:**
- `onMouseMove(x, y)` — mouse moved over canvas
- `onClick(x, y)` — left click
- `onRightClick(x, y)` — right click
- `onZoom(direction)` — mouse wheel (+1 or -1)
- `onViewpointToggle()` — spacebar pressed
- `onMouseLeave()` — mouse left canvas

**State:**
- `keys` — { up, down, left, right, zoomIn, zoomOut } booleans
- `getScrollDir()` — returns { dx, dy } from held keys

## iso-renderer.js — IsoRenderer

Draws terrain and units with visual effects. Implements two-pass rendering for tiles that carry an `overlay` field: the ground sprite is drawn at standard tile dimensions first, then the overlay sprite is drawn on top using per-structure height constants.

**Methods:**
- `drawTerrain(ctx, camera, tiles, state)` — draw all tiles with hover/select, two-pass for overlay tiles
- `drawUnits(ctx, camera, units)` — draw placed units on top of terrain
- `drawDiamondOutline(ctx, x, y, w, h, color, lineWidth)` — utility

**Exported constants (available via `require`):**

| Constant | Value | Notes |
|----------|-------|-------|
| `OVERLAY_WIDTH` | 64 | Native overlay sprite width (all types) |
| `OVERLAY_HEIGHT` | 48 | Native tree overlay sprite height |
| `TREE_OVERLAY_OFFSET_Y` | 0 | Y-shift for tree overlays (tunable) |
| `WALL_OVERLAY_HEIGHT` | 48 | Canvas height for wall overlay sprites |
| `BRIDGE_OVERLAY_HEIGHT` | 48 | Defined but unused at runtime — bridge tiles render ground-only |
| `TOWER_OVERLAY_HEIGHT` | 64 | Canvas height for tower overlay sprites |
| `KEEP_OVERLAY_HEIGHT` | 64 | Canvas height for keep overlay sprites |
| `GATEHOUSE_OVERLAY_HEIGHT` | 80 | Canvas height for gatehouse overlay sprites |
| `WALL_OVERLAY_OFFSET_Y` | 0 | Y-shift for wall overlays (tunable) |
| `TOWER_OVERLAY_OFFSET_Y` | 0 | Y-shift for tower overlays (tunable) |
| `KEEP_OVERLAY_OFFSET_Y` | 0 | Y-shift for keep overlays (tunable) |
| `GATEHOUSE_OVERLAY_OFFSET_Y` | 0 | Y-shift for gatehouse overlays (tunable) |
| `WALL_OVERLAY_OFFSET_X` | 0 | X-shift for wall overlays (tunable) |
| `TOWER_OVERLAY_OFFSET_X` | 0 | X-shift for tower overlays (tunable) |
| `KEEP_OVERLAY_OFFSET_X` | 0 | X-shift for keep overlays (tunable) |
| `GATEHOUSE_OVERLAY_OFFSET_X` | 0 | X-shift for gatehouse overlays (tunable) |
| `CASTLE_OVERLAY_CATEGORY_MAP` | Object | Maps 14 castle overlay sprite names → `{ height, offsetY, offsetX }` |

**`CASTLE_OVERLAY_CATEGORY_MAP`** covers the 14 castle structure overlay sprites (walls, towers, keeps, and gatehouse — undamaged and damaged variants). Bridge tiles (`=`, `b`, `m`, `g`) render ground-only and are **not** in this map; their corresponding `-overlay` sprite names are not carried on tile objects at runtime.

**Overlay positioning formula** (applies to both tree and castle overlays):
```
overlayX = tileCenterX - OVERLAY_WIDTH / 2 + offsetX
overlayY = (y - camera.tileH / 2) - (overlayHeight - camera.tileH) + offsetY
```

## overlay-utils.js — resolveOverlayDraw

Owns the overlay allowlist and returns a zero-argument draw closure for a given tile. Keeping this logic out of `drawTerrain` means `IsoRenderer` stays clean and the system is easy to extend.

**Exports:**
- `resolveOverlayDraw(tile, ctx, x, y, camera)` — returns a `() => void` draw function or `null`

**Allowlisted overlay prefixes:** `tree-`, `castle-`, `bridge-`

**Behaviour by overlay name:**

| Prefix | Resolution |
|--------|-----------|
| `tree-` | Fixed 64×48 draw using `OVERLAY_HEIGHT` and `TREE_OVERLAY_OFFSET_Y` |
| `castle-` / `bridge-` | Looks up `{ height, offsetY, offsetX }` in `CASTLE_OVERLAY_CATEGORY_MAP`; throws if not registered |
| anything else | Logs error and throws — no silent fallbacks |

> **Note:** Even though `bridge-` is in the allowlist (for extensibility), bridge tile characters (`=`, `b`, `m`, `g`) currently carry no `overlay` field, so the bridge prefix path is not exercised at runtime.

## hud.js — HUD

All UI panels rendered on top of the game world.

**Methods:**
- `renderTopBar(ctx, canvasW, text)` — level info bar
- `renderUnitBar(ctx, state)` — bottom unit selection bar
- `renderUnitDetail(ctx, unit, canvasW, barY)` — stats panel
- `renderTilePanel(ctx, state)` — tile info slide-in
- `getUnitBarClick(mouseX, mouseY, units, canvasW, canvasH)` — hit test
- `drawSheenBorder(ctx, x, y, w, h, highlight)` — metallic gradient border

## Usage in a New Game

These modules are generic enough to reuse:

```js
// 1. Include the scripts
// 2. Initialize
IsoCamera.init(canvas, { tileW: 64, tileH: 32, zoom: 0.7 });
IsoInput.init(canvas, {
    onMouseMove: (x, y) => { /* hover logic */ },
    onClick: (x, y) => { /* click logic */ },
    onViewpointToggle: () => IsoCamera.toggleViewpoint(),
    onZoom: (dir) => IsoCamera.applyZoom(dir * 0.1),
});

// 3. In your game loop
function render() {
    ctx.save();
    IsoCamera.applyTransform(ctx);
    IsoRenderer.drawTerrain(ctx, IsoCamera, myTiles, myState);
    IsoRenderer.drawUnits(ctx, IsoCamera, myUnits);
    ctx.restore();
    HUD.renderTopBar(ctx, canvas.width, 'My Game');
}
```

Replace `SpriteManager`, `LevelLoader`, and `UnitManager` with your own equivalents.

---

## State Monad (GameState)

`GameState` is the single source of truth for all mutable game data. It is a plain, frozen JavaScript object. Nothing mutates it in place — every operation is a pure function `GameState → GameState`. The game loop reads the current state, computes a new state by composing transitions, and writes the new value back as the next frame's input.

### `update` — the primitive

All state transitions are expressed through one helper:

```js
/**
 * Produce a new GameState by shallow-merging `patch` over `state`.
 * The result is frozen. The input state is untouched.
 *
 * @param {GameState}         state
 * @param {Partial<GameState>} patch
 * @returns {GameState}
 */
function update(state, patch) {
    return Object.freeze(Object.assign({}, state, patch));
}

// Usage — transition to the briefing phase:
const s1 = update(s0, { phase: 'briefing' });
```

Arrays inside the state (e.g. `placedUnits`, `unitDefs`) are replaced atomically — spread a new array into the patch rather than mutating the existing one.

### Transition guard pattern

Every transition function checks a precondition before doing any work. If the guard fails it returns the original `state` object unchanged, making all transitions safe to call speculatively:

```js
toBriefing(state) {
    if (state.phase !== 'loading') return state; // guard — wrong phase, no-op
    return update(state, { phase: 'briefing', briefingOpen: false });
},
```

This means callers never need to check phase themselves before invoking a transition. The transition either applies and returns a new state, or silently passes through and returns the same reference. Idempotency follows automatically: calling `toActive` a second time is a no-op because the guard `state.phase !== 'placement'` fires on the first re-entry.

### Tick pipeline

`TickTransitions.tick` composes all per-frame sub-transitions using `Array.reduce`. Each step receives the output of the previous one:

```js
tick(state, deps) {
    return [
        s => _animateLift(s),
        s => _checkPlacementTimer(s, deps.nowMs),
        s => _checkAllPlaced(s),
        s => _advanceTurnCounter(s),
        // add new per-frame behaviour here — no existing code changes
    ].reduce((s, fn) => fn(s), state);
},
```

Adding a new per-frame behaviour is a one-line addition to the array. Because every function is a pure `GameState → GameState`, order of composition is the only thing to reason about.

### Concurrency safety

JavaScript is single-threaded. The `requestAnimationFrame` loop runs atomically — the browser will not interrupt it mid-frame to run another event handler. Classic race conditions (two threads writing the same field simultaneously) do not apply here.

Two narrower risks do exist in single-threaded canvas games:

- **Shallow-merge erasure** — if two separate patches are applied to the same base state rather than chained, the second patch silently overwrites fields set by the first. The pipeline pattern above prevents this: each step chains from the previous step's output, never from the original `state`.
- **Render/state write-back timing** — `_render()` returns bounding rects that must be stored back into `GameState` before the next frame's click handler reads them. This is handled explicitly by `applyRenderRects(state, rectPatch)`, which is called by `Game.loop()` after `_render` returns, before the next `requestAnimationFrame` fires.

### Synchrony rule

`_render()` and every HUD render function it calls **must be fully synchronous** — no `await`, no returned `Promise`. Marking any of these functions `async` would break the rect write-back safety guarantee: an async render would return a `Promise` immediately, `applyRenderRects` would run before the canvas draw calls complete, and the stored rects would be stale or null when the next click handler fires.

### State vs. side effects

Not everything belongs in `GameState`. The table below shows the split:

| In `GameState` | Side effects (outside state) |
|---|---|
| `phase`, `placementStartMs`, `placementDone` | `IsoCamera` scroll, zoom, and GL/canvas transform |
| `placedUnits`, `unitDefs` (with qty tracking) | `EnemyManager.executeTurn()` / `spawnWave()` |
| `hoveredTile`, `selectedTile`, `selectedLift` | Canvas draw calls (`ctx.fillRect`, `ctx.drawImage`, etc.) |
| `hudOpen`, `hudWidth`, `selectedUnitIdx` | DOM event wiring (`addEventListener` in `IsoInput`) |
| `briefingOpen` (FurtherReadingPanel toggle) | `SpriteManager` atlas and texture cache |
| `lastBriefingRects`, `lastPlacementRects` | `LevelLoader` file I/O and tile array construction |
| `turnCounter` | `UnitManager` CSV parsing at init time |

The guiding principle: if the value must survive a frame boundary and be read by a transition or hit-test, it lives in `GameState`. If it is an external resource with its own lifecycle (WebGL context, DOM nodes, network I/O), it stays imperative and is touched only from `Game.loop()` or `Game.init()`.
