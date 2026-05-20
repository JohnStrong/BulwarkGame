# Game Logic Documentation

Browser-side game code in `js/game-logic/`.

## Files

| File | Purpose |
|------|---------|
| `utils.js` | Constants, hex/iso geometry, loaders |
| `sprites.js` | Loads 64x32 diamond PNGs, draws to canvas |
| `level-loader.js` | Parses `.txt` levels + `.elevation.txt` into tile arrays |
| `game.js` | Top-down hex renderer (alternative view) |
| `game-iso.js` | **Isometric 2.5D renderer (default)** |

## utils.js

```js
TILE_SIZE = 32          // Base tile reference
HEX_WIDTH = 32          // Hex mode dimensions
HEX_HEIGHT = 28
HEX_ROW_HEIGHT = 21
HEX_COL_OFFSET = 16
hexToPixel(row, col)    // Hex grid → pixel position
```

## sprites.js

Loads all sprites from `assets/sprites/`. Sprites are 64×32 flat isometric diamonds with transparent outside and thin dark border. The `draw()` method renders at any size.

## level-loader.js

### Parsing Flow
1. Load `levels/manifest.txt` → list of level filenames
2. For each level: parse `.txt` + try loading `.elevation.txt`
3. Each tile stores: `{ row, col, x, y, sprite }`

### Elevation
Parsed from `levelN.elevation.txt`:
```
range:offset    (e.g., "10-19:2" = columns 10-19 step down 2px)
```
Stored as `level.elevation = { colNumber: pixelOffset }`

### Tile Mapping
Single `switch` statement: character → sprite name. Variants selected via deterministic `tileHash(row, col)`.

## game-iso.js — Isometric Renderer (Default)

### Projection Math
```js
screenX = (col - row) × (tileW/2) + mapOffsetX - camX
screenY = (col + row) × (tileH/2) + mapOffsetY - camY + elevation[col]
```

### Camera
- `camX`, `camY`: scroll position (WASD/arrows)
- `zoom`: 0.3 (full map) to 4.0 (close-up), via +/-/mousewheel
- Starts centered on the keep flag (`F` tile)

### Elevation Staircase
Per-column Y offset from `.elevation.txt`. Positive = lower, negative = higher.

### Render Loop
```
update() → scroll + zoom input
render() → clear → apply zoom transform → draw tiles back-to-front → HUD
```

Sprites drawn directly (no clipping needed — they're already diamond-shaped with transparency).

## game.js — Top-Down Hex Renderer

Alternative view at `index-topdown.html`. Uses `hexToPixel()` for positioning. Sprites are hex-clipped. No camera/zoom — full map visible.
