# Level & Sprite Generators Documentation

Node.js scripts in `js/level-generators/` that produce sprites and level files.

## File Overview

| File | Purpose | Output |
|------|---------|--------|
| `generate-smooth-sprites.js` | All 17 hex-shaped sprites | `assets/sprites/*.png` |
| `generate-tutorial-level.js` | Tutorial level (level1) | `levels/level1.txt` |
| `generate-random-level.js` | Seeded random levels | `levels/candidates/*.txt` |
| `render-level-preview.js` | Renders level to PNG | `docs/level1-preview.png` |

---

## generate-smooth-sprites.js

Generates all game sprites as 32×32 hex-shaped PNGs.

### Architecture

1. Define color palette
2. Define drawing helpers (fill, dirt texture, cobblestones, grass edges)
3. Define tree generators (oak, pine, shrub)
4. Generate each sprite buffer
5. Apply `drawHexBorder()` to every sprite (clips to hex, adds border)
6. Write PNGs via sharp

### Hex Border (`drawHexBorder`)

Applied to every sprite after content is drawn:
- Computes a pointy-top hexagon polygon (6 vertices)
- Pixels outside the hex → transparent (alpha=0)
- Pixels on the outermost 0.2px edge → dark grey at low opacity
- Pixels inside → untouched (terrain content)

Uses `pointInHex()` (ray-casting point-in-polygon) and `shrinkHex()` (scales polygon inward) to determine border vs interior.

### Color Palette

```js
GRASS       = [95, 180, 72]     // bright green
DIRT        = [210, 165, 110]   // warm sandy road
WATER       = [45, 120, 210]    // vivid blue
TREE_MID    = [48, 130, 42]     // canopy green
BRIDGE_ROAD = [140, 138, 128]   // cobblestone
```

### Tree Types

| Function | Shape | Variants |
|----------|-------|----------|
| `genTree(v)` | Round oak canopy | 3 (tree-1/2/3) |
| `genPine(v)` | Triangular conifer | 2 (tree-4/5) |
| `genShrub(v)` | Wide elliptical bush | 2 (tree-6/7) |

---

## generate-tutorial-level.js

Produces `levels/level1.txt` — a hand-crafted tutorial map (50×30 hex grid).

### Features
- Coastline (left edge)
- River through center with bridge crossings
- Road from top winding down with branch
- Mixed forest (oaks left, pines right, shrubs scattered)
- Open meadow for castle placement

---

## generate-random-level.js

Seeded procedural level generator.

### Usage
```bash
node js/level-generators/generate-random-level.js [seed]
```

### Algorithm
1. Derive biome weights from seed (forest density, water width, road count)
2. Draw coastline with noise-based jagged edge
3. Carve roads via biased random walk (down then right)
4. Place trees using 2D value noise for natural clusters
5. Scatter flowers and rocks
6. Write to `levels/candidates/{timestamp}_seed-{seed}.txt`

---

## render-level-preview.js

Renders any level file to a PNG image using the actual game sprites.

```bash
node js/level-generators/render-level-preview.js [level-file] [output-file]
```

Uses the same `charToSprite` mapping and `hexToPixel` positioning as the game, producing a pixel-accurate preview without running a browser.

---

## Developer Workflow

```bash
# Regenerate all sprites (after palette/shape changes)
npm run generate:sprites

# Regenerate tutorial level
npm run generate:level

# Generate random level candidates
npm run generate:random
node js/level-generators/generate-random-level.js 42

# Render preview image
npm run generate:preview

# Review candidates, promote to game:
cp levels/candidates/2026-05-19_seed-42.txt levels/level2.txt
# Add 'level2.txt' to levels/manifest.txt
```
