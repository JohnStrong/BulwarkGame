# Game Logic

All browser-side code that runs the game lives here. These files are loaded by `index.html` as plain `<script>` tags (no bundler).

## Table of Contents

- [File Overview](#file-overview)
- [utils.js](#utilsjs)
- [sprites.js — SpriteManager](#spritesjs--spritemanager)
- [level-loader.js — LevelLoader](#level-loaderjs--levelloader)
- [unit-manager.js — UnitManager](#unit-managerjs--unitmanager)
- [animation-controller.js — AnimationController](#animation-controllerjs--animationcontroller)
- [pixi-renderer.js — PixiRenderer](#pixi-rendererjs--pixirenderer)
- [game-iso.js — Game (Main Orchestrator)](#game-isojs--game-main-orchestrator)
- [lib/ — Reusable Modules](#lib--reusable-modules)

---

## File Overview

| File | What it does |
|------|-------------|
| `utils.js` | Shared constants and helper functions |
| `sprites.js` | Loads PNG sprite images into memory |
| `level-loader.js` | Reads level text files and turns them into tile data |
| `unit-manager.js` | Manages army units — stats, placement, removal |
| `animation-controller.js` | Shared frame-cycling timers for animated sprite types |
| `pixi-renderer.js` | PixiJS-backed renderer with WebGL/Canvas fallback chain |
| `game-iso.js` | The main game — ties everything together |
| `lib/` | Reusable modules (camera, input, renderer, HUD) |

---

## utils.js

Defines constants used everywhere and two helper functions.

```js
TILE_SIZE       // 32 (base reference)
HEX_WIDTH       // 32 (for top-down hex view)
HEX_HEIGHT      // 28
HEX_ROW_HEIGHT  // 21
HEX_COL_OFFSET  // 16

loadImage(src)      // Loads a PNG, returns a Promise
loadTextFile(src)   // Fetches a text file, returns a Promise
hexToPixel(row, col) // Converts grid position to pixel (hex view only)
```

---

## sprites.js — SpriteManager

Loads all game sprites at startup. Each sprite is a 64×32 isometric diamond PNG.

```js
// On startup:
await SpriteManager.loadAll();

// During rendering:
SpriteManager.draw(ctx, 'grass-short-1', x, y, 64, 32);
```

If a sprite file is missing, it creates a grey placeholder with the name printed on it so the game still runs.

---

## level-loader.js — LevelLoader

Reads the level manifest, loads each `.txt` level file, and optionally loads a matching `.elevation.txt` file.

```js
// On startup:
await LevelLoader.loadLevelList();

// Get current level data:
const level = LevelLoader.getCurrentLevel();
// level.tiles = [{ row, col, x, y, sprite }, ...]
// level.width, level.height
// level.elevation = { colNumber: pixelOffset }
```

Each character in the text file becomes one tile. The loader maps characters to sprite names (e.g., `.` → `grass-short-1`, `~` → `water-1`).

### Known limitation: tileHash bias

The `tileHash(row, col)` function is used to pick which variant of a tile to show (e.g., `grass-short-1` vs `grass-short-2`, or `water-1` vs `water-2` vs `water-3`). Due to integer overflow in its multiplication steps, the hash output is stuck in the range [0, ~0.5) — it never reaches values above 0.5.

In practice this means:
- **Grass** always renders as `grass-short-1` (the `> 0.5` check for variant 2 never fires)
- **Flowers** always render as `grass-flowers-1`
- **Water** only shows variants 1 and 2 (variant 3 requires `hash ≥ 0.67`, which is unreachable)
- **Oak trees** only show variants 1 and 2 out of 3
- **Pine/shrub** only show one variant each

The game still works fine — you just see fewer visual variants than the code intends. Fixing the hash would change the appearance of every existing level, so it's left as-is for now.

---

## unit-manager.js — UnitManager

Handles the player's army. Loads unit definitions from a CSV file, tracks quantities, and manages placement on the map.

### Loading units

```js
await UnitManager.loadResources('levels/default.resources.txt');
// Parses: Unit,StartQty,Health,Attack,DefenseModifier
```

### Checking what's available

```js
const available = UnitManager.getAvailableUnits();
// Returns units that still have qtyRemaining > 0
```

### Placing a unit on the map

```js
const placed = UnitManager.placeUnit("Archer/Crossbowman", row, col);
// placed = { def, sprite, row, col, currentHealth }
// Decrements qtyRemaining automatically
```

### Checking if a tile is occupied

```js
const unit = UnitManager.getUnitAt(row, col);
// Returns the unit object or null
```

### Checking if terrain allows placement

```js
UnitManager.canPlaceOn('grass-short-1')  // true
UnitManager.canPlaceOn('tree-1')         // false (blocked)
UnitManager.canPlaceOn('castle-wall')    // false (blocked)
```

### Removing a unit

```js
UnitManager.removeUnit(unit);
// Removes from map AND restores qtyRemaining
```

---

## animation-controller.js — AnimationController

Manages frame cycling for animated sprite types (water tiles, castle flags, etc.). All sprites of the same type share a **single shared timer** — they advance frames in unison rather than each running their own clock.

The module is an IIFE that exposes a plain object, so it works both as a browser global and as a CommonJS module in tests.

### Registering an animated type

```js
// Register water with 4 frames cycling every 600ms
AnimationController.registerAnimatedType('water', 4, 600);

// Register flag with 3 frames at the default 500ms interval
AnimationController.registerAnimatedType('flag', 3);
```

The `intervalMs` argument is clamped to `[100, 2000]`. Registering a type that already exists stops the old timer and starts a fresh one.

### Reading the current frame

```js
// Called each render frame to pick the right atlas frame name
const frame = AnimationController.getCurrentFrame('water');
// → 0, 1, 2, or 3 (cycles automatically)
```

Returns `0` for any type that has not been registered.

### Constants

```js
AnimationController.MIN_INTERVAL_MS   // 100
AnimationController.MAX_INTERVAL_MS   // 2000
AnimationController.DEFAULT_INTERVAL_MS // 500
```

### Cleanup

```js
// Stop all timers and clear the registry (useful in tests or on game teardown)
AnimationController.reset();

// Check whether a type is registered
AnimationController.isRegistered('water'); // true / false
```

### Design notes

- One `setInterval` per sprite type, not per sprite instance — keeps timer count O(types) rather than O(sprites).
- Frame index wraps with `% frameCount`, so adding or removing frames mid-game is safe as long as `registerAnimatedType` is called again.
- `frameCount` is clamped to a minimum of 1 to prevent division-by-zero in the modulo.

---

## pixi-renderer.js — PixiRenderer

PixiJS-backed renderer that sits between `SpriteManager` and the canvas. Provides a WebGL → CanvasRenderer → Canvas 2D fallback chain so the game runs on hardware that doesn't support WebGL.

### Renderer initialisation

```js
// Attach to the existing game canvas; tries WebGL first (5 s timeout)
const renderer = await initPixiRenderer(canvas);
// renderer.rendererType → 'webgl' | 'canvas-renderer' | 'canvas2d'
```

**Fallback chain (Req 5.5):**
1. PixiJS WebGL — hardware-accelerated, 5 s init timeout
2. PixiJS CanvasRenderer — software canvas via PixiJS
3. Canvas 2D — delegates directly to `SpriteManager` (no PixiJS)

PixiJS is always attached to the *existing* `<canvas>` element via the `view` option, so the DOM is not modified.

### Atlas loading

```js
await loadSpriteAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');
// Falls back to SpriteManager.loadAll() if atlas or JSON fails to load
```

The atlas JSON and image must both parse within 5 seconds. On any failure the module silently falls back to individual PNG loading via the existing `SpriteManager.loadAll()`.

### Drawing sprites

```js
// Draw a sprite at (x, y) on the given tile layer
drawSprite(ctx, 'grass-short-1', x, y, 64, 32, 'ground');
```

**Integer pixel alignment (Req 5.2, Property 13):** `x` and `y` are always floored to integers with `Math.floor` before being passed to the underlying renderer. This prevents sub-pixel blur on pixel art sprites regardless of whether the input is already an integer or a floating-point value.

When PixiJS is active and the atlas is loaded, the sprite is drawn via a `PIXI.Sprite`. Otherwise the call is delegated to `SpriteManager.draw()`.

### Draw-call budgeting (Req 7.4, Property 18)

Each tile layer (`ground`, `structure`, `unit`, `overlay`) has a budget of **10 draw calls per frame**. Calls beyond the budget are silently dropped.

```js
resetDrawCallCounters();          // call once per frame before drawing
trackDrawCall('ground');          // returns true if within budget, false if exceeded
getDrawCallCount('ground');       // current count for diagnostics
MAX_DRAW_CALLS_PER_LAYER;         // 10
```

Counters are independent per layer — exceeding the budget on `unit` does not affect `ground`.

### Testing interface

The module exports a `_reset()` function for test isolation. It clears all internal state (renderer type, textures, atlas flag, draw-call counters) so each property-test run starts from a clean slate without module cache tricks.

```js
const { drawSprite, _reset } = require('./pixi-renderer');
_reset(); // force canvas2d mode, clear all state
```

### Module exports (Node.js / CommonJS)

| Export | Type | Description |
|--------|------|-------------|
| `initPixiRenderer(canvas, timeout?)` | `async fn` | Initialise renderer with fallback chain |
| `loadSpriteAtlas(imgPath, jsonPath)` | `async fn` | Load atlas; falls back to individual PNGs |
| `drawSprite(ctx, name, x, y, w?, h?, layer?)` | `fn` | Draw one sprite, floors coords to integers |
| `resetDrawCallCounters()` | `fn` | Reset per-layer counters (call each frame) |
| `trackDrawCall(layer)` | `fn` | Increment counter; returns false if over budget |
| `getDrawCallCount(layer)` | `fn` | Read current counter for a layer |
| `MAX_DRAW_CALLS_PER_LAYER` | `number` | `10` |
| `_reset()` | `fn` | Full state reset for test isolation |

---

## game-iso.js — Game (Main Orchestrator)

The entry point. Initializes everything, runs the game loop, and handles player interactions. It delegates heavy lifting to the `lib/` modules.

### Startup flow

```
Game.init()
  → set canvas size (1024×768)
  → IsoCamera.init()
  → IsoInput.init() with callbacks
  → SpriteManager.loadAll()
  → LevelLoader.loadLevelList()
  → UnitManager.loadResources()
  → Game.startLevel()
  → Game.loop()
```

### Game loop (runs every frame ~60fps)

```
Game.loop()
  → Game.update()    // process input, animate
  → Game.render()    // draw everything
```

### Update step

- Reads held keys from `IsoInput` → scrolls camera
- Reads zoom keys → adjusts zoom
- Animates tile lift (smooth 0→3px when selected)
- Animates HUD panel width (smooth slide-in/out)

### Render step

1. Clear canvas (dark green background)
2. Apply camera zoom transform
3. Draw terrain tiles via `IsoRenderer.drawTerrain()`
4. Draw placed units via `IsoRenderer.drawUnits()`
5. Restore zoom transform
6. Draw HUD panels (not affected by zoom):
   - Tile info panel (bottom-left)
   - Top info bar
   - Unit bar (bottom-center)
   - Unit detail panel (above bar, if unit selected)

### Click handling

When the player clicks:
1. **Unit bar?** → select/deselect that unit type
2. **Tile panel close button?** → close the panel
3. **Map tile + unit selected?** → place unit (or remove if same type already there)
4. **Map tile + no unit selected?** → select/deselect tile (shows info panel)

### Right-click

Removes any unit on the clicked tile (restores quantity).

---

## lib/ — Reusable Modules

See `lib/README.md` for full documentation. Quick summary:

| Module | Responsibility |
|--------|---------------|
| `iso-camera.js` | Projection math, scroll, zoom, viewpoint |
| `iso-input.js` | Event listeners, key state |
| `iso-renderer.js` | Drawing tiles and units with effects |
| `hud.js` | All UI panels and hit testing |

These are generic enough to reuse in any isometric tile game.
