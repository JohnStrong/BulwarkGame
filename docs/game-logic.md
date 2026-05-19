# Game Logic Documentation

How the browser-side game code works. All game logic lives in `js/game-logic/`.

## File Overview

| File | Purpose |
|------|---------|
| `utils.js` | Constants, hex geometry, utility functions |
| `sprites.js` | Loads sprite images, draws them to canvas |
| `level-loader.js` | Parses `.txt` level files into hex tile data |
| `game.js` | Main game loop, canvas setup, rendering |

---

## utils.js

### Constants

```js
TILE_SIZE = 32        // Sprite image size (32x32 px)
HEX_WIDTH = 32        // Hex tile width
HEX_HEIGHT = 28       // Hex tile height (32 × √3/2)
HEX_ROW_HEIGHT = 21   // Vertical step between rows (75% of height, rows overlap)
HEX_COL_OFFSET = 16   // Odd rows shift right by half width
```

### `hexToPixel(row, col)` → {x, y}

Converts hex grid coordinates to pixel position:
```js
x = col * HEX_WIDTH + (row % 2 === 1 ? HEX_COL_OFFSET : 0)
y = row * HEX_ROW_HEIGHT
```

Odd rows (1, 3, 5...) are offset 16px to the right, creating the beehive pattern.

### `loadImage(src)` / `loadTextFile(src)`

Promise-based loaders for images and text files.

---

## sprites.js — SpriteManager

### Sprite List (17 sprites)

| Category | Sprites |
|----------|---------|
| Grass | `grass-short-1/2`, `grass-flowers-1/2` |
| Road | `road-full` |
| Water | `water-1/2/3` |
| Bridge | `bridge-mm` |
| Trees | `tree-1/2/3` (oak), `tree-4/5` (pine), `tree-6/7` (shrub) |
| Decoration | `rock` |

All sprites are 32×32 PNG with:
- Hexagonal shape (transparent outside the hex boundary)
- Thin 0.2px dark border along hex edges
- Terrain fill inside

### `draw(ctx, name, x, y, width, height)`

Draws a sprite at pixel position. Since sprites have built-in hex shape and transparency, no clipping is needed — they naturally interlock when placed at hex grid positions.

---

## level-loader.js — LevelLoader

### Hex Grid Positioning

Each character in the level file maps to a hex cell. Position is calculated via `hexToPixel(row, col)`:
- Even rows: tiles at x = col × 32
- Odd rows: tiles at x = col × 32 + 16 (shifted right)
- All rows: y = row × 21

### Tile Character Mapping

```
.  → grass (2 variants)
,  → flowers (2 variants)
O  → oak tree (3 variants)
P  → pine tree (2 variants)
S  → shrub (2 variants)
R  → rock

D, L, r, U, u  → road (all render as road-full)
~, w, ), (      → water (all render as water variants)
{, ^, }, [, =, ], <, _, >  → bridge (all render as bridge-mm)
```

All border/transition characters map to their base tile — the hex shape handles visual separation between terrain types.

### Canvas Dimensions

```js
pixelWidth = (cols + 1) * HEX_WIDTH
pixelHeight = rows * HEX_ROW_HEIGHT + HEX_HEIGHT
```

Extra space accounts for odd-row offset and bottom hex overhang.

---

## game.js — Game

### Render Loop

```
init()
  → load sprites
  → load levels from manifest
  → resize canvas to level pixel dimensions
  → start render loop

render()
  → fill background (#2a3a1a dark green)
  → for each tile: draw sprite at (tile.x, tile.y)
  → draw HUD overlay
```

No hex clipping or grid overlay needed — sprites have built-in hex shape with transparent corners. The dark background shows through gaps between hexes.

---

## How Hex Tiles Fit Together

```
Row 0:  [hex][hex][hex][hex]...
Row 1:    [hex][hex][hex][hex]...    ← shifted right 16px
Row 2:  [hex][hex][hex][hex]...
Row 3:    [hex][hex][hex][hex]...    ← shifted right 16px
```

Each hex overlaps vertically with the row above/below by 25% (7px). The transparent corners of each sprite allow the row below to show through, creating the interlocking beehive pattern.
