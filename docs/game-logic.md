# Game Logic Documentation

This document explains how the browser-side game code works. All game logic lives in `js/game-logic/`.

## File Overview

| File | Purpose |
|------|---------|
| `utils.js` | Constants and utility functions |
| `sprites.js` | Loads sprite images, draws them to canvas |
| `level-loader.js` | Parses `.txt` level files into renderable tile data |
| `game.js` | Main game loop, canvas setup, rendering |

---

## utils.js

Defines shared constants and helper functions used across all game files.

```js
const TILE_SIZE = 32;  // Every tile is 32x32 pixels
```

### `loadImage(src)` → Promise<Image>
Loads a PNG image from a URL. Returns a promise that resolves with the `Image` object.

### `loadTextFile(src)` → Promise<string>
Fetches a text file via HTTP. Used to load level `.txt` files and the manifest.

---

## sprites.js — SpriteManager

Manages loading and drawing of all game sprites.

### Data

```js
SpriteManager.images = {}       // name → Image/Canvas object
SpriteManager.spriteList = [...]  // array of sprite names to load
```

### Flow

1. **`loadAll()`** — Called once at startup. Iterates `spriteList`, calls `loadImage()` for each. If a sprite fails to load, creates a colored fallback rectangle with the sprite name.

2. **`draw(ctx, name, x, y, width, height)`** — Draws a named sprite onto the canvas at pixel position (x, y). If width/height are provided, scales the sprite (used for multi-tile sprites).

3. **`createFallback(name)`** — Creates a 32x32 canvas with grey background and white text showing the sprite name. Used when a PNG fails to load so the game still runs.

### Sprite Categories

| Category | Sprites | Count |
|----------|---------|-------|
| Grass | `grass-short-1/2`, `grass-flowers-1/2` | 4 |
| Road | `road-full`, `road-edge-*`, `road-corner-*` | 9 |
| Water | `water-1/2/3`, `water-h-1/2/3`, `water-land-left/right` | 8 |
| Trees | `tree-1/2/3` | 3 |
| Decorations | `rock` | 1 |
| Bridge | `bridge-tl/tm/tr/ml/mm/mr/bl/bm/br` | 9 |

---

## level-loader.js — LevelLoader

Parses text-based level files into arrays of tile objects the renderer can draw.

### Data Structure

```js
LevelLoader.levels = []        // array of parsed level objects
LevelLoader.currentLevel = 0   // index into levels[]
```

Each parsed level object:
```js
{
  name: "Level Name",
  tiles: [{ x, y, sprite, width?, height?, covered? }, ...],
  walls: [{ x, y, width, height }, ...],
  width: 50,   // columns in the map
  height: 30   // rows in the map
}
```

### Loading Flow

```
loadLevelList()
  ├── fetch('levels/manifest.txt')
  ├── parse manifest → list of filenames
  └── for each filename:
        ├── fetch('levels/{filename}')
        └── parseLevelText(content) → level object
```

### `parseLevelText(text)` — The Core Parser

This is the main algorithm. It processes a level file line by line:

**Step 1: Separate metadata from map data**
```
for each line:
  if starts with ';' and no map lines yet → skip (comment)
  if starts with 'name=' → extract level name
  otherwise → add to mapLines[]
```

**Step 2: Calculate dimensions**
```
level.width = max length of all mapLines
level.height = number of mapLines
```

**Step 3: Convert characters to tiles (nested loop)**
```
for each row in mapLines:
  for each col in row:
    char = mapLines[row][col]
    x = col * 32    // pixel position
    y = row * 32
    hash = tileHash(row, col)  // deterministic random for variant selection

    switch(char):
      case '.': → grass sprite (variant picked by hash)
      case ',': → flower sprite
      case 'O': → tree sprite (3 variants)
      case 'R': → rock sprite
      case 'D': → road-full
      case 'L': → road-edge-left
      ... (all road edges/corners)
      case '~': → water vertical (3 variants)
      case 'w': → water horizontal (3 variants)
      case ')': → water-land-right
      case '(': → water-land-left
      case '{','^','}','[','=',']','<','_','>': → bridge tiles
      default:  → grass fallback
```

**Key design decisions:**
- Each character maps to exactly one sprite
- Variant selection uses `tileHash(row, col)` — a deterministic hash so the same tile always gets the same variant (no flickering)
- Multi-tile sprites (keep, portcullis) use a "covered" flag on continuation tiles so the renderer skips them

### `tileHash(row, col)` — Deterministic Variant Selection

```js
tileHash(row, col) {
    let h = (row * 7919 + col * 104729 + 31) & 0xFFFFFFFF;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = (h >> 16) ^ h;
    return (h >>> 0) / 0xFFFFFFFF;  // returns 0.0 - 1.0
}
```

This is a hash function that takes a tile's grid position and returns a float between 0 and 1. Used to pick which variant of a sprite to show (e.g., `hash > 0.5 ? variant2 : variant1`). Because it's deterministic, the same position always gets the same variant.

### Level Progression

```js
getCurrentLevel()  → returns levels[currentLevel]
nextLevel()        → increments currentLevel, returns false if wrapped
resetLevel()       → placeholder for future game state reset
```

---

## game.js — Game

The main entry point and render loop.

### Initialization Flow

```
window.onload → Game.init()
  ├── get canvas + context
  ├── SpriteManager.loadAll()     // load all PNGs
  ├── LevelLoader.loadLevelList() // load manifest + level files
  ├── startLevel()                // resize canvas to level size
  ├── state = 'playing'
  └── loop()                      // start render loop
```

### `startLevel()`

Resizes the HTML canvas to match the level dimensions:
```js
canvas.width = level.width * TILE_SIZE   // e.g., 50 * 32 = 1600px
canvas.height = level.height * TILE_SIZE // e.g., 30 * 32 = 960px
```

### `loop()` — Render Loop

```
loop()
  ├── render()
  └── requestAnimationFrame(loop)  // ~60fps
```

### `render()`

```
render()
  ├── clear canvas
  ├── if loading: show "Loading..." text
  ├── for each tile in level.tiles:
  │     if tile.covered: skip
  │     draw sprite at (tile.x, tile.y) with tile.width/height
  └── draw HUD (level name overlay)
```

The renderer is simple: iterate all tiles in order and draw their sprites. Tiles are stored in row-major order (top-left to bottom-right) so they naturally layer correctly.

---

## How It All Connects

```
index.html
  └── loads 4 scripts in order:
        utils.js      (constants)
        sprites.js    (SpriteManager)
        level-loader.js (LevelLoader)
        game.js       (Game — calls init on window.load)

Game.init()
  → SpriteManager.loadAll()  → fetches 34 PNGs
  → LevelLoader.loadLevelList() → fetches manifest → fetches level1.txt
  → Game.loop() → renders tiles to canvas every frame
```
