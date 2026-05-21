# Game Logic

All browser-side code that runs the game lives here. These files are loaded by `index.html` as plain `<script>` tags (no bundler).

## File Overview

| File | What it does |
|------|-------------|
| `utils.js` | Shared constants and helper functions |
| `sprites.js` | Loads PNG sprite images into memory |
| `level-loader.js` | Reads level text files and turns them into tile data |
| `unit-manager.js` | Manages army units — stats, placement, removal |
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
