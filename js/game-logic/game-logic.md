# Game Logic Documentation

Browser-side game code in `js/game-logic/`.

## Files

| File | Purpose |
|------|---------|
| `utils.js` | Constants, hex/iso geometry, loaders |
| `sprites.js` | Loads 64x32 isometric diamond PNGs |
| `level-loader.js` | Parses `.txt` levels + `.elevation.txt` into tile arrays |
| `game.js` | Top-down hex renderer (alternative view via `index-topdown.html`) |
| `game-iso.js` | **Isometric 2.5D renderer (default, `index.html`)** |

---

## utils.js

### Constants
```js
TILE_SIZE = 32          // Base reference (used by top-down view)
HEX_WIDTH = 32          // Hex mode tile width
HEX_HEIGHT = 28         // Hex mode tile height
HEX_ROW_HEIGHT = 21     // Vertical step between hex rows
HEX_COL_OFFSET = 16     // Odd-row horizontal offset
```

### Functions
- `hexToPixel(row, col)` — converts grid position to pixel coords (hex view)
- `loadImage(src)` — returns Promise<Image>
- `loadTextFile(src)` — returns Promise<string>

---

## sprites.js — SpriteManager

Loads all game sprites from `assets/sprites/`. Each sprite is a 64×32px flat isometric diamond PNG with transparent outside and thin dark border.

### Key Methods
- `loadAll()` — loads all sprites in `spriteList`, creates fallback rectangles for missing ones
- `draw(ctx, name, x, y, width, height)` — draws a named sprite at position

---

## level-loader.js — LevelLoader

### Loading Flow
1. Reads `levels/manifest.txt` → list of level filenames
2. For each level file: parses the `.txt` map + tries loading matching `.elevation.txt`
3. Each tile stored as: `{ row, col, x, y, sprite }`

### Tile Character Mapping
Single `switch` on each character → sprite name. Multi-variant tiles (grass, water, trees) use `tileHash(row, col)` for deterministic variant selection.

### Elevation Parsing
From `levelN.elevation.txt`:
```
0-9:0        ← columns 0-9 are flat
10-19:2      ← columns 10-19 step down 2px
50-59:-2     ← columns 50-59 step UP 2px (higher ground)
```
Stored as `level.elevation = { colNumber: pixelOffset }`

---

## game-iso.js — Isometric 2.5D Renderer (Default)

This is the main game renderer loaded by `index.html`.

### Isometric Projection

Converts grid (row, col) to screen (x, y):
```js
// BR→TL viewpoint (default):
x = (col - row) × (tileW/2) + mapOffsetX - camX
y = (col + row) × (tileH/2) + mapOffsetY - camY + elevation[col]

// BL→TR viewpoint (inverted):
x = (row - col) × (tileW/2) + mapOffsetX - camX
y = (col + row) × (tileH/2) + mapOffsetY - camY + elevation[col]
```

### Camera System

| Property | Description |
|----------|-------------|
| `camX`, `camY` | Scroll position in world pixels |
| `zoom` | Scale factor (0.3 = zoomed out, 4.0 = zoomed in) |
| `scrollSpeed` | Base scroll rate (adjusted by zoom) |

Camera starts centered on the keep flag tile (`F`). Zoom defaults to 70%.

### Viewpoint Rotation

Two orientations toggled by **spacebar**:
- `br-tl` (default): player views from bottom-right toward top-left
- `bl-tr` (inverted): player views from bottom-left toward top-right (map mirrors horizontally)

On rotation, camera re-centers on the keep flag using the new projection math.

### Tile Interaction

#### Hover
- `mousemove` → `screenToGrid(mouseX, mouseY)` converts screen coords to grid position
- Uses inverse isometric math (undoes zoom transform, then solves for row/col)
- Hovered tile gets a warm gold diamond border (`rgba(255, 220, 80, 0.6)`)

#### Selection
- **Left click** on a tile → selects it
- Selected tile:
  - Smoothly lifts 3px upward (animated at 0.3px/frame)
  - Gets bright yellow border + glow effect
- **Click same tile** again → deselects (tile lowers back smoothly)
- **Click different tile** → switches selection

#### Inverse Projection (`screenToGrid`)
```js
// Undo zoom: transform screen coords back to world space
worldX = (screenX - canvasCenter) / zoom + canvasCenter + camX - mapOffsetX
worldY = (screenY - canvasCenter) / zoom + canvasCenter + camY - mapOffsetY

// Solve for grid coords (inverse of iso projection):
col = round((worldX/halfW + worldY/halfH) / 2)
row = round((worldY/halfH - worldX/halfW) / 2)
```

### HUD Panel (Bottom-Left)

A slide-in info panel that shows details about the selected tile.

| Property | Description |
|----------|-------------|
| `hudOpen` | Whether panel is visible |
| `hudWidth` | Current animated width (0 → 256) |
| `HUD_MAX_WIDTH` | 256px (1/4 of canvas) |
| `HUD_HEIGHT` | 180px |

**Behavior:**
- Opens automatically when a tile is selected (slides in at 12px/frame)
- Closes when clicking the ✕ button or deselecting a tile
- Re-opens when selecting a new tile
- Clicks inside the HUD don't pass through to the map

**Visual:**
- Dark semi-transparent background (`rgba(15, 12, 10, 0.92)`)
- Metallic gold/bronze gradient border on top and right edges (sword sheen)
- Shows tile coordinates and sprite name (placeholder for future content)

### Elevation Staircase

Per-column Y offset from the `.elevation.txt` file. Applied in `gridToIso()`:
- Positive values = tile renders lower (valley/depression)
- Negative values = tile renders higher (hill/elevation)

Creates subtle terraced steps across the landscape.

### Render Loop

```
loop() → update() + render() at ~60fps

update():
  - Process WASD/arrow scroll input
  - Process +/- zoom input
  - Animate selectedLift (smooth tile raise/lower)
  - Animate hudWidth (smooth panel slide)

render():
  - Clear canvas (dark green background)
  - Apply zoom transform (scale from canvas center)
  - Draw all tiles back-to-front with hover/select effects
  - Restore zoom transform
  - Draw HUD panel (fixed to viewport, not affected by zoom)
  - Draw top info bar
```

### Tile Drawing Order

Tiles are stored in row-major order from the level loader. Since isometric projection naturally places earlier rows behind later rows, this gives correct depth (painter's algorithm) without sorting.

---

## game.js — Top-Down Hex Renderer (Alternative)

Available at `index-topdown.html`. Uses `hexToPixel()` for flat hex grid positioning. No camera/zoom — renders full map. Sprites are hex-clipped. Kept for potential future viewpoint switching during gameplay.


---

## unit-manager.js — UnitManager

Manages army unit definitions, stats, and placement on the map.

### Loading

```js
await UnitManager.loadResources('levels/default.resources.txt');
```

Parses CSV format:
```
Unit,StartQty,Health,Attack,DefenseModifier
Archer/Crossbowman,40,100,90,0.80
```

### Unit Definition Object

```js
{
    name: "Archer/Crossbowman",
    sprites: ['unit-archer', 'unit-crossbowman'],
    qty: 40,
    qtyRemaining: 40,
    health: 100,
    attack: 90,
    defense: 0.80   // 0.80 = takes 80% damage (20% reduction)
}
```

### Name → Sprite Mapping

| CSV Name | Sprites |
|----------|---------|
| Archer/Crossbowman | `unit-archer`, `unit-crossbowman` |
| Spearman/Heavy infantry | `unit-spearman`, `unit-heavy-infantry` |
| Men-at-arms (heavy trooper) | `unit-knight` |
| Engineer/Siege crew | `unit-engineer` |
| Militia/Watchmen | `unit-militia` |

### Placement

```js
const placed = UnitManager.placeUnit("Archer/Crossbowman", row, col);
// Returns: { def, sprite, row, col, currentHealth }
```

Decrements `qtyRemaining`, picks a random sprite variant from the unit's sprite list.

### Rendering

Placed units render AFTER terrain (on top), offset 4px up so figures stand on the tile. Transparent-background sprites overlay terrain cleanly.

### API

| Method | Description |
|--------|-------------|
| `loadResources(file)` | Parse CSV into `units[]` |
| `getAvailableUnits()` | Units with remaining qty > 0 |
| `placeUnit(name, row, col)` | Place unit, return placed object |
| `getPlacedUnits()` | All placed units (for render loop) |
| `removeUnit(unit)` | Remove from map |
| `reset()` | Clear placements, restore all quantities |


---

## HUD System

The game has multiple HUD elements rendered on top of the map (not affected by zoom/scroll).

### Top Info Bar
- Fixed at top of canvas (20px tall)
- Shows: level name, controls hint, current viewpoint, zoom %

### Unit Bar (Bottom Center)
- Shows all unit types from `default.resources.txt`
- Each unit in a 56×76px box with:
  - Metallic gradient border (gold when selected)
  - Unit sprite (scaled)
  - Name (truncated, 8 chars)
  - Quantity remaining (green) / total (red if 0)
- Click a box to select that unit type
- Click again to deselect

### Unit Detail Panel (Above Unit Bar)
- Appears when a unit type is selected from the bar
- 280×100px centered panel with:
  - Larger sprite on left
  - Full name, HP, ATK, Armour % on right
  - Available count
  - Action buttons: Q (Attack), V (Defend)
- Metallic gradient border

### Tile Info Panel (Bottom-Left)
- Appears when a map tile is clicked
- 256×180px slide-in panel with:
  - Tile coordinates [row, col]
  - Sprite/terrain type name
  - Closeable with ✕ button
- Metallic gradient border (top + right edges)
- Auto-opens on tile select, closes on deselect or ✕

### Visual Style
- All HUD panels use dark semi-transparent backgrounds (`rgba(15, 12, 10, 0.92)`)
- Borders use a metallic gold/bronze gradient ("sword sheen"):
  ```
  #3a3028 → #8a7a60 → #c8b890 → #8a7a60 → #3a3028
  ```
- Text: monospace font, white/grey hierarchy

---

## Controls Summary

| Input | Context | Action |
|-------|---------|--------|
| WASD / Arrows | Map | Scroll camera |
| +/- / Wheel | Map | Zoom in/out |
| Spacebar | Map | Toggle viewpoint (BR↔BL), re-center on keep |
| Mouse hover | Map | Highlight tile (gold border) |
| Left click | Map tile | Select/deselect tile (lift animation + info panel) |
| Left click | Unit bar | Select/deselect unit type (detail panel) |
| Q | Unit selected | Attack action (TBC) |
| V | Unit selected | Defend action (TBC) |
| ✕ button | Tile panel | Close tile info panel |
