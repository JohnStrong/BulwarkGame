# Level & Sprite Generators Documentation

Node.js scripts in `js/level-generators/`.

## Files

| File | Purpose | Output |
|------|---------|--------|
| `generate-iso-sprites-br-tl.js` | Terrain sprites (isometric, BR→TL viewpoint) | `assets/sprites/*.png` (64×32) |
| `generate-castle-sprites.js` | Castle structure sprites (isometric) | `assets/sprites/castle-*.png` (64×32) |
| `generate-smooth-sprites.js` | Legacy hex sprites (for top-down view) | `assets/sprites/*.png` (32×32) |
| `generate-tutorial-level.js` | Tutorial level map | `levels/level1.txt` |
| `generate-random-level.js` | Seeded random levels | `levels/candidates/*.txt` |
| `render-level-preview.js` | Renders level to PNG | configurable output |

## Isometric Sprite Generation (`generate-iso-sprites-br-tl.js`)

### Viewpoint
Bottom-right → top-left. Player looks from lower-right corner toward upper-left.

### Format
64×32px flat diamond. Transparent outside, thin dark border on edges.

### Diamond Shape
```js
inDiamond(x, y) = (|x-32|/32 + |y-16|/16) <= 1
```

### Terrain Types
- **Grass**: green fill + darker specks + dithering
- **Flowers**: grass base + colored petal clusters (pink/yellow/white/purple)
- **Road**: sandy orange + dark crack lines
- **Water**: blue + lighter horizontal ripple streaks
- **Bridge**: grey cobblestone pattern
- **Trees**: grass base + shadow + brown bark trunk (visible BR side) + round canopy on top
- **Rock**: grass base + grey oval

### Tree Depth (BR→TL viewpoint)
Trees show bark/trunk on the bottom-right side (facing the viewer):
1. Ground shadow cast to the right
2. Brown bark trunk (2-tone for depth) below-right of canopy
3. Canopy drawn on top, partially overlapping trunk

## Castle Sprites (`generate-castle-sprites.js`)

Same 64×32 diamond format. Uses warmer sandy stone palette distinct from bridge cobblestone.

| Sprite | Description |
|--------|-------------|
| `castle-bridge-start` | Road→wood plank transition |
| `castle-bridge-mid` | Full wood planks |
| `castle-bridge-gate` | Wood→stone wall |
| `castle-tower` | Circular stone tower from above |
| `castle-keep-tl/bl/br` | Keep quadrant tiles (stone blocks) |
| `castle-keep-center` | Keep center with red+gold flag |
| `castle-gatehouse` | Stone arch with iron portcullis |
| `castle-wall` | Full stone curtain wall |
| `castle-bailey-1/2/3` | Dirt+hay floor (3 density variants) |

## Random Level Generator (`generate-random-level.js`)

```bash
node js/level-generators/generate-random-level.js [seed]
```

### Seed-Derived Parameters
- `forestWeight` (10-70%): tree cluster density
- `waterWidth` (2-5): coastline width
- `roadCount` (1-2): main paths
- `hasBranch` (60%): alternate enemy route

### Algorithm
1. Coastline (left edge, jagged via noise)
2. Road carving (random walk down → turn right)
3. Forest clusters (same tree type per cluster, elliptical, different quadrants)
4. Shrubs along river banks
5. Flower/rock scatter

### Elevation
Each level can have a `.elevation.txt` file defining per-column height steps for the isometric staircase effect.

## Developer Workflow

```bash
# Generate isometric sprites
node js/level-generators/generate-iso-sprites-br-tl.js
node js/level-generators/generate-castle-sprites.js

# Generate level
npm run generate:level

# Generate random candidates
npm run generate:random
node js/level-generators/generate-random-level.js 42

# Promote candidate to game
cp levels/candidates/2026-05-20_seed-42.txt levels/level2.txt
# Add to levels/manifest.txt
```
