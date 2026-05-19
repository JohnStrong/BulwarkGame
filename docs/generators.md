# Level & Sprite Generators Documentation

This document explains the Node.js generator scripts in `js/level-generators/`. These run at build time to produce the PNG sprites and level text files.

## File Overview

| File | Purpose | Output |
|------|---------|--------|
| `generate-smooth-sprites.js` | Generates all 34 game sprites | `assets/sprites/*.png` |
| `generate-tutorial-level.js` | Generates the tutorial level | `levels/level1.txt` |
| `generate-random-level.js` | Generates random levels from a seed | `levels/candidates/*.txt` |

---

## generate-smooth-sprites.js

Generates all terrain, road, water, tree, and bridge sprites as 32x32 PNG files using the `sharp` library.

### Architecture

```
1. Define color palettes (constants)
2. Define helper functions (pixel drawing, patterns)
3. Define generator functions (one per sprite type)
4. Main: call all generators, write PNGs via sharp
```

### Color Palette

```js
GRASS       = [88, 168, 60]     // bright green meadow
DIRT        = [200, 160, 100]   // warm straw/sandy road
STONE       = [128, 128, 125]   // grey cobblestone
WATER       = [100, 190, 195]   // teal river
TREE_MID    = [50, 125, 50]     // dark green canopy
BRIDGE_WALL = [145, 140, 130]   // darker parapet stone
BRIDGE_ROAD = [180, 175, 160]   // lighter bridge surface
```

### Core Helper Functions

#### `px(buf, x, y, r, g, b)`
Sets a single pixel in the raw RGBA buffer. Clamps values to 0-255.

#### `fill(buf, color, noise, seed)`
Fills the entire 32x32 buffer with a base color + per-pixel noise for texture.

#### `drawDirt(buf, x1, y1, x2, y2, seed)`
Fills a region with dirt texture:
1. Base fill with warm brown + noise
2. Random-walk dark "cracks" (3-8px lines wandering in random directions)
3. Scattered lighter patches

#### `drawCobblestones(buf, x1, y1, x2, y2, seed)`
Fills a region with cobblestone pattern:
1. Fill with dark mortar color (gaps between stones)
2. Draw individual stones as rounded rectangles (skip corner pixels)
3. Stones are offset per row (brick-like pattern)
4. Random size variation (4-6px per stone)

#### `drawGrassEdgeVertical(buf, edgeX, side, seed)`
Draws jagged grass pixels along a vertical edge (where grass meets road):
- For each row, picks a random "jag" depth (0-2px)
- Draws grass-colored pixels poking into the road area

#### `drawBridgeWall(buf, x1, y1, x2, y2, seed)`
Draws the bridge parapet wall (heavier, darker stones):
- Mortar base fill
- Larger stone blocks (6-8px) with offset rows

#### `drawBridgeRoad(buf, x1, y1, x2, y2, seed)`
Draws the bridge road surface (lighter, flatter cobblestone):
- Lighter mortar base
- Smaller, flatter stones (4-6px)

### Sprite Generator Functions

Each `gen*()` function creates a 32x32 buffer and composes the sprite:

| Function | Algorithm |
|----------|-----------|
| `genGrass(v)` | Fill green + scatter darker specks |
| `genFlowers(v)` | Fill green + random colored dots |
| `genRoadFull()` | Full dirt texture |
| `genRoadEdgeLeft()` | Left half grass, right half dirt, jagged edge between |
| `genRoadCorner(n)` | One quadrant grass, rest dirt |
| `genWaterV(v)` | Fill teal + vertical light streaks (flow markers) |
| `genWaterH(v)` | Fill teal + horizontal light streaks |
| `genWaterEdgeRight()` | Left=water, right=grass, wavy boundary |
| `genTree(v)` | Grass bg + shadow ellipse + circular canopy (dark edge, light center) |
| `genBridgeTM()` | Narrow wall (8px) at top + road surface below |
| `genBridgeMM()` | Full cobblestone road surface |
| `genBridgeBM()` | Road surface above + narrow wall (8px) at bottom |
| `genBridgeML()` | Left half dirt + right half cobblestone |

### Seeded Random

```js
let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }
```

Linear congruential generator. Each sprite function calls `resetSeed(uniqueValue)` before drawing so sprites are reproducible regardless of generation order.

---

## generate-tutorial-level.js

Generates `levels/level1.txt` — a hand-crafted tutorial map.

### Algorithm

Uses a 50×30 character grid, built imperatively:

```
1. Initialize 50x30 grid with '.' (grass)
2. Draw coastline (left edge): alternating ~~) and ~~~) for jagged shore
3. Draw river (vertical, center): ( + ~~~ + ) with wobble, skip bridge rows
4. Draw main road (vertical): Lr tiles from top to row 12, DD at junctions
5. Draw horizontal roads (rows 13-16, 24-27): UUUU / DDDD / uuuu
6. Place bridge tiles where road crosses river: {^^^} / [===] / <___>
7. Place forest (manual coordinates): O tiles in clusters with gaps
8. Place flowers: ,, in small patches
9. Place rocks: R scattered
10. Pad all rows to equal width
11. Write to levels/level1.txt
```

### Key Design Decisions

- **Road junctions**: Where vertical meets horizontal, use `DD` (full road) on the row above/below to avoid grass gaps at the connection point
- **Bridge placement**: Replaces the river tiles on the 3 road rows (top parapet, road surface, bottom parapet)
- **Forest variation**: Trees placed with gaps (`.` between `O`) to avoid uniform grid appearance
- **River banks**: `(` on left bank (grass→water), `)` on right bank (water→grass)

---

## generate-random-level.js

Generates random levels using a seed for reproducibility.

### Usage

```bash
node js/level-generators/generate-random-level.js [seed]
# If no seed provided, uses Date.now()
```

### Algorithm

```
1. Parse seed from CLI args (or use timestamp)
2. Derive biome weights from seed:
   - forestWeight (0.1 - 0.7): tree density
   - waterWidth (2-5): coastline width
   - roadCount (1-2): number of roads
   - hasBranch (60% chance): whether road splits
3. Generate map:
   a. Fill with grass
   b. Draw coastline (left edge, jagged via noise)
   c. Carve roads (random walk down + turn right)
   d. Place trees (2D value noise for natural clusters)
   e. Scatter flowers and rocks
4. Write to levels/candidates/{timestamp}_seed-{seed}.txt
```

### Road Carving Algorithm

```
carveRoad(startCol, startRow):
  turnRow = random row between 30%-60% of height

  Phase 1 - Go down:
    while row < turnRow:
      place LDDr at current position
      row++
      occasionally wobble col left/right (15% chance)

  Phase 2 - Turn right:
    horizEnd = random column toward right edge
    place 3 rows: UUUU / DDDD / uuuu from col to horizEnd
```

### 2D Value Noise (for tree placement)

```js
function smoothNoise(x, y, scale) {
    // Scale down coordinates
    // Get 4 corner hash values
    // Bilinear interpolation between them
    // Returns 0.0 - 1.0
}
```

Trees are placed where `smoothNoise(row, col, 4) > threshold`. The threshold is derived from `forestWeight`. This creates natural-looking clusters rather than uniform random scatter.

### Branch Road

If `hasBranch` is true:
1. Pick a random column along the main horizontal road
2. Draw a vertical segment going down from that point
3. At a random row, turn right with another horizontal stretch

### Output Format

```
; Generated level - seed: 42
; Biome: Open Plains, Narrow Coast
; Roads: 2 + branch
name=Open Plains (42)
~~)........UUUU.......
~~)........LDDr.......
...
```

Written to `levels/candidates/` with timestamp + seed in filename for easy identification.

---

## Developer Workflow

```bash
# Regenerate all sprites (after modifying generate-smooth-sprites.js)
npm run generate:sprites

# Regenerate tutorial level
npm run generate:level

# Generate random level candidates for review
npm run generate:random           # random seed
node js/level-generators/generate-random-level.js 42    # specific seed
node js/level-generators/generate-random-level.js 999   # try different seeds

# Review candidates, then promote:
cp levels/candidates/2026-05-19_seed-42.txt levels/level2.txt
# Add 'level2.txt' to levels/manifest.txt
```
