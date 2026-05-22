# Level & Sprite Generators

Node.js scripts that produce the game's PNG sprites and level text files. Run these at build time — they write output to `assets/sprites/` and `levels/`.

## Table of Contents

- [File Overview](#file-overview)
- [generate-iso-sprites-br-tl.js](#generate-iso-sprites-br-tljs)
- [generate-castle-sprites.js](#generate-castle-spritesjs)
- [generate-unit-sprites.js](#generate-unit-spritesjs)
- [generate-tutorial-level.js](#generate-tutorial-leveljs)
- [generate-random-level.js](#generate-random-leveljs)
- [render-level-preview.js](#render-level-previewjs)
- [lib/noise-texture.js — Procedural Noise](#libnoise-texturejs--procedural-noise)
- [lib/shading.js — Directional Lighting](#libshadingjs--directional-lighting)
- [lib/dithering.js — Ordered Dithering](#libditheringjs--ordered-dithering)
- [lib/palette-quantizer.js — Palette Enforcement](#libpalette-quantizerjs--palette-enforcement)
- [lib/atlas-packer.js — Sprite Atlas Generation](#libatlas-packerjs--sprite-atlas-generation)
- [lib/animation-frames.js — Animation Generation](#libanimation-framesjs--animation-generation)
- [lib/palette.js — Enhanced Palette System](#libpalettejs--enhanced-palette-system)
- [NPM Scripts](#npm-scripts)

---

## File Overview

| File | What it does |
|------|-------------|
| `generate-iso-sprites-br-tl.js` | Generates all terrain sprites (grass, road, water, trees, rock) with enhanced pipeline (noise, shading, dithering, quantization) |
| `generate-castle-sprites.js` | Generates castle structure sprites (walls, tower, keep, bailey) with enhanced pipeline (stone courses, crenellations, shading, quantization) |
| `generate-unit-sprites.js` | Generates army unit sprites (knight, archer, spearman, etc.) |
| `generate-tutorial-level.js` | Generates the tutorial level map (level1.txt) |
| `generate-random-level.js` | Generates random levels from a seed (Needs work) |
| `generate-smooth-sprites.js` | Legacy hex sprites (kept for top-down view) |
| `render-level-preview.js` | Renders a level to a PNG image for documentation |

### Shared library (`lib/`)

| File | What it exports |
|------|----------------|
| `lib/sprite-constants.js` | Single source of truth: tile dimensions, output path, all color palettes (terrain, castle, unit), sprite name registries |
| `lib/pixel-utils.js` | Core drawing primitives: `createBuffer()`, `setPixel()`, `isInsideDiamond()`, `seededRandom()`, `resetSeed()`, `drawEdgeBorder()` |
| `lib/fill-patterns.js` | Shared diamond fill operations: `fillDiamond()`, `fillDiamondWithSpeckle()`, `drawStoneBlocks()` |
| `lib/weapons.js` | `drawWeapon()` dispatcher + individual weapon drawing functions (sword, bow, etc.) |
| `lib/unit-body.js` | `drawUnit()` — draws the full humanoid figure (body layers + weapon) |
| `lib/palette.js` | Enhanced palette system: `PRIMARY_PALETTE` (16 colors), `ENEMY_PALETTE` (8 colors), `CASTLE_ACCENT_COLORS` (4 colors), `BORDER_COLOR`, `ANIMATION_CONFIG`, `getPaletteForCategory()` |
| `lib/noise-texture.js` | Simplex noise wrapper: `terrainNoise(x, y, scale, seed)` for deterministic terrain variation |
| `lib/shading.js` | Directional lighting: `applyDirectionalShading()`, `applyFaceShading()`, `applyShadowEdge()` — upper-left light source |
| `lib/dithering.js` | Ordered dithering: `applyOrderedDithering()` using 4×4 Bayer matrix for terrain transition edges |
| `lib/palette-quantizer.js` | Final-pass palette enforcement: `quantizeToPalette(buffer, palette)` — Euclidean RGB nearest-color mapping |
| `lib/atlas-packer.js` | Sprite atlas bin-packing: `packAtlas(sprites)` — power-of-two output with JSON metadata |
| `lib/animation-frames.js` | Multi-frame generation: `generateWaterFrames()`, `generateFlagFrames()` for animated sprites |

To add a new sprite, change a texture tone, or rename a sprite file — edit `lib/sprite-constants.js`.
All generators import their colors and names from there.

For the enhanced sprite pipeline's palette quantization and color enforcement, use `lib/palette.js`.

---

## generate-iso-sprites-br-tl.js

Generates 17 terrain sprites as 64×32 flat isometric diamonds. Viewpoint: bottom-right → top-left.

```bash
node js/level-generators/generate-iso-sprites-br-tl.js
```

### What it produces

| Sprite | Description |
|--------|-------------|
| `grass-short-1/2` | Green meadow with simplex noise texture (3 palette colors) |
| `grass-flowers-1/2` | Noise-textured meadow with cross-shaped flower clusters |
| `road-full` | Sandy dirt road with crack details and left-edge dithering |
| `water-1/2/3` | Blue water with ripple highlights and right-edge dithering |
| `bridge-mm` | Grey cobblestone with offset block pattern |
| `tree-1` through `tree-7` | Trees with 2 overlapping canopy layers (inner shadow + highlight rim) |
| `rock` | Grey stone on noise-textured grass base |

All terrain sprites receive face shading (lit top, darker side), a 1-pixel shadow edge (bottom-right), and a final palette quantization pass.

### How sprites are built (enhanced pipeline)

Each sprite starts as an empty 64×32 buffer. The generator applies a multi-stage pipeline:

1. **Base fill** — Fills pixels inside the diamond shape using simplex noise to select from 3+ palette colors (`GRASS_COLORS` array), creating natural variation per seed
2. **Detail pass** — Draws sprite-specific elements (cracks, ripples, flower clusters, canopy layers, bark)
3. **Face shading** — `applyFaceShading()` applies isometric lighting: lit top face (brighter palette color), darker side face
4. **Shadow edge** — `applyShadowEdge()` adds a 1-pixel dark shadow along the bottom-right perimeter
5. **Ordered dithering** — `applyOrderedDithering()` blends two palette colors in a 4-pixel border strip on transition edges (bottom, left, or right depending on sprite type)
6. **Edge border** — `drawEdgeBorder()` draws a thin dark border on outermost diamond pixels
7. **Palette quantization** — `quantizeToPalette()` maps every non-transparent pixel to the nearest color in the terrain palette (final pass, guarantees palette compliance)
8. **PNG export** — Writes as PNG via `sharp`

### Key functions

- `generateGrass(variant, noiseGen)` — noise-driven grass with 3 palette colors + full shading pipeline
- `generateTree(variant, noiseGen)` — grass base → ground shadow → bark trunk → 2 overlapping canopy layers (inner shadow + outer highlight rim)
- `generateFlowers(variant, noiseGen)` — noise grass base + cross-shaped flower clusters in palette colors
- `generateRoad()` / `generateWater(variant)` / `generateBridge()` — each applies the full shading + quantization pipeline
- `createTerrainNoiseGenerator(seed)` — creates a deterministic noise function from `lib/noise-texture.js`
- `getPaletteForCategory('terrain')` — returns the 16-color primary palette for quantization
- `isInsideDiamond(x, y)` — returns true if pixel is inside the diamond: `|x-32|/32 + |y-16|/16 <= 1`

---

## generate-castle-sprites.js

Generates 13 castle structure sprites (64×32 diamonds, same format as terrain). Enhanced with the full sprite pipeline: stone block patterns, crenellation detail, keep details (window slits, flag), 1-pixel dark outline, face shading, shadow edge, and palette quantization.

```bash
node js/level-generators/generate-castle-sprites.js
```

### What it produces

| Sprite | Description |
|--------|-------------|
| `castle-bridge-start/mid/gate` | Wooden drawbridge planks with face shading |
| `castle-tower` | Round stone tower with 4 alternating merlon/crenel crenellations |
| `castle-keep-tl/bl/br` | Keep quadrant tiles (enhanced stone blocks + window slits) |
| `castle-keep-center` | Keep center with layered stone, flag pole, and 7×5 waving red+gold flag |
| `castle-gatehouse` | Enhanced stone courses with dark archway and iron portcullis grate |
| `castle-wall` | Full stone curtain wall with 6+ horizontal courses and staggered masonry |
| `castle-bailey-1/2/3` | Dirt+hay floor (3 density variants) with face shading |

### Enhanced sprite pipeline (applied to all castle sprites)

Every castle sprite now passes through the same multi-stage pipeline as terrain sprites:

1. **Base fill / detail** — Sprite-specific geometry (stone blocks, planks, tower circle, etc.)
2. **Face shading** — `applyFaceShading()` applies isometric lighting (lit top face, darker side face)
3. **Shadow edge** — `applyShadowEdge()` adds a 1-pixel dark shadow along the bottom-right perimeter
4. **Edge border** — `drawEdgeBorder()` draws a 1-pixel dark outline (BORDER_COLOR) on all outer-perimeter pixels bordering transparent pixels
5. **Palette quantization** — `quantizeToPalette(buffer, CASTLE_PALETTE)` maps every non-transparent pixel to the nearest color in the castle palette (PRIMARY_PALETTE + CASTLE_ACCENT_COLORS = 20 colors)

### Key functions

- `drawEnhancedStoneBlocks(buffer, stoneColor, stoneLightColor, mortarColor, seed)` — fills diamond with enhanced masonry: 6+ horizontal courses (5px course height = 4 stone + 1 mortar), staggered block offsets on alternating rows, 2+ pixels of per-block color variation. Replaces the old `drawStoneBlocks` from `lib/fill-patterns.js` for castle sprites.
- `generateTower()` — concentric stone circle + 4 merlon/crenel crenellation shapes (3×3 raised blocks with 2px gaps)
- `generateKeepTopLeft/BottomLeft/BottomRight()` — enhanced stone blocks + 1×3 dark window slit rectangles + full shading pipeline
- `generateKeepCenter()` — enhanced stone base + flag pole + 7×5 waving red flag with gold trim edges (exceeds 3×5 minimum)
- `generateGatehouse()` — enhanced stone courses + dark archway + vertical iron bars (3px spacing) + horizontal crossbars
- `generateWall()` — enhanced stone block pattern with full shading pipeline
- `generateBailey1/2/3()` — dirt base with increasing straw density + face shading + quantization

---

## generate-unit-sprites.js

Generates 9 army unit sprites (64×32, transparent background — units overlay terrain).

```bash
node js/level-generators/generate-unit-sprites.js
```

### What it produces

| Sprite | Unit | Visual |
|--------|------|--------|
| `unit-knight` | Men-at-arms | Silver armor, blue cape, sword |
| `unit-heavy-infantry` | Heavy infantry | Chainmail, shield with boss |
| `unit-spearman` | Spearman | Leather, long spear |
| `unit-archer` | Archer | Green tunic, bow + arrow |
| `unit-crossbowman` | Crossbowman | Brown tunic, crossbow |
| `unit-skirmisher` | Skirmisher | Light leather, javelin |
| `unit-engineer` | Engineer | Brown apron, hammer |
| `unit-militia` | Militia | Simple clothes, club |
| `unit-artillery` | Artillery crew | Dark clothes, cannon |

### Code structure

The unit sprite generator is split across the `lib/` folder:

```
generate-unit-sprites.js          ← orchestrator (iterates units, writes PNGs)
  └── lib/
      ├── sprite-constants.js     ← UNIT_PALETTES, UNIT_SPRITES, TILE_WIDTH/HEIGHT, OUTPUT_DIR
      ├── pixel-utils.js          ← createBuffer(), setPixel(), seededRandom(), isInsideDiamond()
      ├── fill-patterns.js        ← fillDiamond(), fillDiamondWithSpeckle(), drawStoneBlocks()
      ├── unit-body.js            ← drawUnit() — assembles the full figure
      └── weapons.js              ← drawWeapon() — weapon-specific pixel art
```

### How units are drawn

Each unit figure is ~10×16px centered on the 64×32 canvas. The `drawUnit(buffer, palette, weaponType, seedValue)` function in `lib/unit-body.js` draws layer by layer, bottom to top.

#### Glossary of terms used in the code

| Term | Meaning |
|------|---------|
| `centerX` | Horizontal midpoint of the tile. Always `32` (half of 64px width). All figure parts are offset from this anchor. |
| `centerY` | Vertical anchor for the figure. Always `14` (slightly above tile center, so the figure sits naturally on the diamond). |
| `buffer` | Pixel buffer — a flat `Buffer` of length `64 × 32 × 4` bytes (RGBA per pixel). Every drawing call writes into this. |
| `setPixel(buffer, x, y, red, green, blue)` | Writes one opaque pixel at (x, y) with the given RGB color (alpha is always 255). |
| `noise` | A small random offset (typically ±7 to ±15) added per-pixel to break up flat color. |
| `seededRandom()` | Returns a deterministic float 0–1. Same seed = same sprite every time. |
| `resetSeed(value)` | Sets the PRNG state so subsequent `seededRandom()` calls are reproducible. |
| `palette` | Object with 4 color arrays: `body`, `cape`, `accent`, `skin`. Each is `[red, green, blue]`. |
| `palette.skin` | An `[red, green, blue]` array holding the unit's flesh tone (used for the head). E.g. knight's skin is `[210, 175, 140]`. |
| `lightingShift` | Directional brightness shift. Negative = darker (shadow side), positive = lit side. Simulates BR→TL light. |
| `offsetX` / `offsetY` | Loop offsets relative to `centerX` or `centerY`. |
| `isInsideDiamond(x, y)` | Returns true if pixel is inside the isometric diamond: `\|x-32\|/32 + \|y-16\|/16 ≤ 1`. |

---

#### 1. Drop shadow

<table><tr><td width="50%">

```js
// Semi-transparent dark ellipse below the figure
for (let offsetX = -5; offsetX <= 5; offsetX++)
  for (let offsetY = -1; offsetY <= 2; offsetY++)
    if ((offsetX*offsetX)/25 + (offsetY*offsetY)/4 < 1) {
      const pixelIndex = ((centerY+9+offsetY)*TILE_WIDTH
                        + (centerX+offsetX+1))*4;
      buffer[pixelIndex]=20; buffer[pixelIndex+1]=20;
      buffer[pixelIndex+2]=15; buffer[pixelIndex+3]=100;
    }
// centerX=32, centerY=14 → ellipse center is at (33, 23)
```

</td><td width="50%">

Draws a soft oval shadow beneath the figure's feet. The ellipse equation `(offsetX²/25 + offsetY²/4 < 1)` makes it 5px wide × 2px tall. Alpha is set to 100 (semi-transparent) so terrain shows through. Offset by `(centerX+1, centerY+9)` to sit just below the boots and slightly right, matching the BR→TL light direction.

</td></tr></table>

---

#### 2. Legs

<table><tr><td width="50%">

```js
// Two columns of pixels, 5px tall each
for (let row = 0; row < 5; row++) {
  const noise = (seededRandom() - 0.5) * 12;
  // Left leg
  setPixel(buffer, centerX-2, centerY+5+row,
    palette.body[0]-20+noise, ...);
  setPixel(buffer, centerX-1, centerY+5+row,
    palette.body[0]-15+noise, ...);
  // Right leg
  setPixel(buffer, centerX+1, centerY+5+row,
    palette.body[0]-20+noise, ...);
  setPixel(buffer, centerX+2, centerY+5+row,
    palette.body[0]-15+noise, ...);
}
// Boots: dark brown at bottom of each leg
setPixel(buffer, centerX-2, centerY+9, 50, 35, 20);
setPixel(buffer, centerX+1, centerY+9, 50, 35, 20);
// centerX=32 → left leg cols 30–31, right leg cols 33–34
// centerY=14 → legs span rows 19–23, boots at row 23
```

</td><td width="50%">

Two 2-pixel-wide columns, each 5px tall, drawn below the torso. The body color is darkened by 20 to look like trousers in shadow. Each pixel gets noise so the legs aren't flat. A single dark-brown pixel at the bottom of each column represents boots. The 1px gap between the legs (at `centerX`) gives the impression of two separate limbs.

</td></tr></table>

---

#### 3. Body / torso

<table><tr><td width="50%">

```js
// 6px wide × 6px tall rectangle
for (let row = 0; row < 6; row++)
  for (let col = -3; col <= 2; col++) {
    const noise = (seededRandom() - 0.5) * 15;
    const lightingShift = col < 0 ? -10 : 5;
    setPixel(buffer, centerX+col, centerY-1+row,
       palette.body[0]+noise+lightingShift,
       palette.body[1]+noise+lightingShift,
       palette.body[2]+noise+lightingShift);
  }
// centerX=32, centerY=14 → rectangle spans x:29–34, y:13–18
// lightingShift: left half (col<0) is 10 darker,
//               right half is 5 lighter
```

</td><td width="50%">

The main mass of the figure. A 6×6 pixel block centered on `centerX`. The `lightingShift` variable simulates directional lighting: pixels on the left (`col < 0`) are darkened by 10 because the light comes from the bottom-right. Pixels on the right get +5 brightness. Per-pixel noise of ±15 adds cloth/armor texture so it doesn't look like a flat rectangle.

</td></tr></table>

---

#### 4. Cape / cloak

<table><tr><td width="50%">

```js
// 2px wide, 6px tall, offset to the back-left
for (let row = 0; row < 6; row++) {
  const noise = (seededRandom() - 0.5) * 10;
  const windWobble = Math.round(
    Math.sin(row * 0.8) * 0.5);
  setPixel(buffer, centerX-4+windWobble, centerY+row,
     palette.cape[0]+noise, ...);
  setPixel(buffer, centerX-3+windWobble, centerY+1+row,
     palette.cape[0]+noise-5, ...);
}
// centerX=32 → cape at columns 28–29 (with ±0.5px wave)
// centerY=14 → cape spans rows 14–19
```

</td><td width="50%">

A narrow strip drawn behind and to the left of the body, representing a cloak flowing in the wind. The `sin(row * 0.8) * 0.5` gives a subtle horizontal wobble (0 or 1 pixel) per row so it looks like fabric rather than a straight line. The second column is drawn 1 row lower and 5 units darker, adding depth. Visible from the BR→TL viewpoint as the figure's back.

</td></tr></table>

---

#### 5. Shoulders / pauldrons

<table><tr><td width="50%">

```js
// 4 pixels at top corners of the body
setPixel(buffer, centerX-3, centerY-1, ...palette.accent);
setPixel(buffer, centerX+2, centerY-1, ...palette.accent);
setPixel(buffer, centerX-3, centerY,   ...palette.accent);
setPixel(buffer, centerX+2, centerY,   ...palette.accent);
// centerX=32, centerY=14
//   → pixels at (29,13), (34,13), (29,14), (34,14)
```

</td><td width="50%">

Four accent-colored pixels placed at the outer top corners of the torso. They sit at the widest points of the body rectangle, one row above and one row at the top. Uses the unit's accent color (gold for knight, silver for spearman, etc.) to suggest armor plating or epaulettes. Small detail but makes the silhouette wider at the shoulders.

</td></tr></table>

---

#### 6. Head

<table><tr><td width="50%">

```js
// 4×4 block with vertical shading
for (let row = -2; row <= 1; row++)
  for (let col = -1; col <= 2; col++) {
    const noise = (seededRandom() - 0.5) * 8;
    const verticalShading = (row < 0) ? 5 : -5;
    setPixel(buffer, centerX+col, centerY-4+row,
       palette.skin[0]+noise+verticalShading,
       palette.skin[1]+noise+verticalShading,
       palette.skin[2]+noise+verticalShading);
  }
// centerX=32, centerY=14 → head spans x:31–34, y:8–11
// Top half (row<0) is lighter, bottom half is darker
```

</td><td width="50%">

A 4×4 pixel block drawn above the torso. Uses the unit's skin color with subtle noise (±8). Vertical shading: the top two rows are 5 units brighter (light hitting the crown) and the bottom two rows are 5 units darker (chin/jaw in shadow). This tiny gradient makes the head read as a rounded form rather than a flat square.

</td></tr></table>

---

#### 7. Helmet / hat

<table><tr><td width="50%">

```js
// 6 pixels forming a cap shape above the head
setPixel(buffer, centerX,   centerY-6, ...palette.accent);
setPixel(buffer, centerX+1, centerY-6, ...palette.accent);
setPixel(buffer, centerX-1, centerY-5, ...palette.accent);
setPixel(buffer, centerX,   centerY-5, ...palette.accent);
setPixel(buffer, centerX+1, centerY-5, ...palette.accent);
setPixel(buffer, centerX+2, centerY-5, ...palette.accent);
// centerX=32, centerY=14 → helmet at y:8–9
// Row centerY-6: 2px wide (top of helmet)
// Row centerY-5: 4px wide (brim)
```

</td><td width="50%">

Six accent-colored pixels arranged in a tapered shape: 2px on top, 4px on the row below. Sits directly above the head block, adding 2px of height to the figure's silhouette. The accent color (gold, green, brown, etc.) makes each unit type instantly recognizable from above. The wider bottom row suggests a helmet brim or hat edge.

</td></tr></table>

---

#### 8. Weapon

Each weapon type has its own drawing function in `lib/weapons.js`. The dispatcher `drawWeapon(buffer, centerX, centerY, weaponType, palette)` is called last so weapons appear on top of all body parts.

<table><tr><td width="50%">

```js
// Sword example (from lib/weapons.js)
function drawSword(buffer, centerX, centerY) {
  // 8px vertical silver blade
  for (let row = 0; row < 8; row++) {
    setPixel(buffer, centerX+4, centerY-3-row,
      190, 190, 195);  // lit edge
    setPixel(buffer, centerX+5, centerY-3-row,
      170, 170, 175);  // shadow edge
  }
  // Gold crossguard
  setPixel(buffer, centerX+3, centerY-3, 200,170,50);
  setPixel(buffer, centerX+6, centerY-3, 200,170,50);
  // Brown grip
  setPixel(buffer, centerX+4, centerY+1, 80,55,30);
  setPixel(buffer, centerX+5, centerY+1, 80,55,30);
}
// centerX=32 → blade at columns 36–37, rows 3–10
```

</td><td width="50%">

The sword is a 2px-wide, 8px-tall vertical blade drawn to the right of the figure (`centerX+4`). Two silver tones (190 and 170) give it a lit/shadow edge. A gold crossguard (2 pixels) sits at the blade base, and a brown grip below. Each weapon follows the same pattern: positioned to the right or left of the body, using simple geometric shapes and 2–3 colors.

</td></tr></table>

**All weapon types at a glance:**

| Weapon | Position | Visual description |
|--------|----------|-------------------|
| `sword` | `centerX+4`, vertical | 8px silver blade, gold crossguard, brown grip |
| `spear` | `centerX+3`, vertical | 14px brown shaft, silver spearhead at top |
| `bow` | `centerX-5`, curved | 9px arc via `sin()`, bowstring line, nocked arrow pointing right |
| `crossbow` | `centerX±4`, horizontal | 8px bar at `centerY+1`, vertical stock, bolt in center |
| `javelin` | `centerX+4`, vertical | 7px shaft, silver tip (2px) |
| `hammer` | `centerX+4`, vertical | 6px brown handle, 3×3 grey hammerhead at top |
| `shield` | `centerX-5`, vertical | 3×6px rectangle, accent color fill, gold boss dot center |
| `cannon` | centered, horizontal | 8px barrel at `centerY+7`, wheels at sides |
| `club` | `centerX+3`, vertical | 6px brown stick, wider top (2px) |

### Color palettes per unit

Each unit has 4 colors that define its look (defined in `lib/sprite-constants.js` under `UNIT_PALETTES`):

| Unit | Body | Cape | Accent | Skin |
|------|------|------|--------|------|
| Knight | Silver (180,180,190) | Blue (40,60,140) | Gold (200,170,50) | Warm (210,175,140) |
| Heavy Infantry | Grey (140,140,145) | Red-brown (100,50,50) | Tan (160,155,140) | Warm (200,165,130) |
| Spearman | Brown (130,100,60) | Dark brown (90,75,50) | Silver (170,170,170) | Warm (195,160,125) |
| Archer | Green (60,110,50) | Dark green (45,90,40) | Brown (140,100,50) | Warm (205,170,135) |
| Crossbowman | Brown (100,75,45) | Dark brown (80,60,35) | Grey (130,130,130) | Warm (200,165,130) |
| Skirmisher | Tan (150,130,90) | Khaki (120,105,70) | Dark (100,90,70) | Warm (210,175,140) |
| Engineer | Brown (110,80,50) | Dark brown (85,65,40) | Tan (160,140,100) | Warm (195,160,125) |
| Militia | Grey-brown (130,120,100) | Dull (110,100,80) | Dark (90,85,75) | Warm (205,170,135) |
| Artillery | Near-black (60,55,50) | Charcoal (45,42,38) | Tan (140,130,110) | Warm (200,165,130) |

### Transparent background

Unlike terrain sprites, units have NO grass base and NO diamond border. The buffer starts fully transparent (alpha=0 everywhere). Only the pixels that make up the figure get alpha=255. This means units overlay terrain tiles cleanly when drawn on top.

---

## generate-tutorial-level.js

Generates `levels/level1.txt` — the hand-crafted tutorial map.

```bash
node js/level-generators/generate-tutorial-level.js
```

Builds a 50×30+ character grid with coastline, river, bridges, roads, forest clusters, castle, and flower meadows. Uses imperative placement (not random).

---

## generate-random-level.js

Generates random levels using a seed for reproducibility.

```bash
node js/level-generators/generate-random-level.js [seed]
# No seed = uses timestamp
```

### How it works

1. Derives biome weights from the seed (forest density, water width, road count)
2. Draws coastline (left edge, jagged via noise)
3. Carves roads (random walk downward, then turns right)
4. Places forest clusters (same tree type per cluster, elliptical shape, different quadrants)
5. Scatters shrubs along river banks
6. Adds flower patches and rocks
7. Writes to `levels/candidates/{timestamp}_seed-{seed}.txt`

### Promoting a candidate to the game

```bash
cp levels/candidates/2026-05-20_seed-42.txt levels/level2.txt
# Then add 'level2.txt' to levels/manifest.txt
```

---

## render-level-preview.js

Renders any level file to a PNG image using the actual game sprites.

```bash
node js/level-generators/render-level-preview.js [level-file] [output-file]
# Default: levels/level1.txt → docs/level1-preview.png
```

Uses the same character→sprite mapping as the game's level loader, drawing each tile at its grid position. Useful for documentation screenshots without running a browser.

---

## lib/noise-texture.js — Procedural Noise

Wraps `simplex-noise` to provide deterministic terrain-specific noise generation. Used to add natural variation to grass, water, and other terrain sprites so that no two seeded sprites are identical.

### Exports

| Export | Signature | Description |
|--------|-----------|-------------|
| `terrainNoise` | `(x, y, scale, seed) → number` | Returns coherent noise value in range [-1, 1] for the given pixel coordinate |
| `createTerrainNoiseGenerator` | `(seed) → function` | Creates a reusable noise function `(x, y, scale) → number` bound to a specific seed |

The `scale` parameter controls noise frequency (lower = smoother, larger features). Same `seed` always produces the same output, enabling reproducible sprite generation. The terrain sprite generator uses `createTerrainNoiseGenerator` to create per-category noise functions (grass seed 42, tree seed 84, rock seed 126).

---

## lib/shading.js — Directional Lighting

Provides layered shading utilities applied consistently across all sprite categories. The light source is always upper-left.

### Exports

| Export | Signature | Description |
|--------|-----------|-------------|
| `applyDirectionalShading` | `(buffer, width, height, highlightPercent, shadowPercent)` | Brightens upper-left edges, darkens lower-right edges |
| `applyFaceShading` | `(buffer, width, height, topColor, sideColor)` | Applies isometric face lighting (lit top, darker side) |
| `applyShadowEdge` | `(buffer, width, height)` | Adds 1-pixel dark shadow on bottom-right perimeter |

All functions modify the buffer in place and skip fully transparent pixels.

---

## lib/dithering.js — Ordered Dithering

Implements 4×4 Bayer matrix ordered dithering for terrain transition edges. Blends two palette colors within a configurable border region without introducing any intermediate computed colors — the output contains only the two specified palette colors.

### Exports

| Export | Signature | Description |
|--------|-----------|-------------|
| `applyOrderedDithering` | `(buffer, width, height, colorA, colorB, borderWidth, edge)` | Applies dithering in a border strip along the specified edge |
| `BAYER_4X4` | `number[][]` | The 4×4 threshold matrix (values 0–15) |

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `buffer` | `Buffer` | — | RGBA pixel buffer (modified in place) |
| `width` | `number` | — | Buffer width in pixels |
| `height` | `number` | — | Buffer height in pixels |
| `colorA` | `number[]` | — | First terrain palette color `[r, g, b]` (this tile's color) |
| `colorB` | `number[]` | — | Second terrain palette color `[r, g, b]` (neighboring tile's color) |
| `borderWidth` | `number` | `4` | Width of the dithering region in pixels |
| `edge` | `string` | — | Which edge to dither: `'top'`, `'bottom'`, `'left'`, or `'right'` |

### How it works

1. For each pixel in the border strip, calculate its depth into the region (0 = at edge, `borderWidth-1` = deepest)
2. Convert depth to a blend ratio scaled to the Bayer threshold range [0, 15]
3. Compare against the Bayer matrix value at `(x % 4, y % 4)`
4. Set pixel to `colorA` if the Bayer value is below the threshold, otherwise `colorB`

Transparent pixels (alpha === 0) are always skipped. The result is a visually smooth gradient using only two discrete colors.

---

## lib/palette-quantizer.js — Palette Enforcement

Final-pass module that maps every non-transparent pixel to the nearest color in a defined palette. Applied as the last step in every sprite generator to guarantee pixel-perfect palette adherence.

### Exports

| Export | Signature | Description |
|--------|-----------|-------------|
| `quantizeToPalette` | `(buffer, palette) → Buffer` | Maps all opaque pixels to nearest palette color (in place) |

Uses Euclidean distance in RGB space. Throws `Error('Quantization failed')` with pixel coordinates and color details if post-quantization validation finds any out-of-palette pixels.

---

## lib/atlas-packer.js — Sprite Atlas Generation

### What is a Sprite Atlas?

A sprite atlas (also called a texture atlas or sprite sheet) is a single large image that contains many smaller sprites packed together, accompanied by a JSON metadata file that describes where each sprite lives within that image.

**Why not just load individual PNGs?**

Every separate image file means a separate HTTP request and a separate GPU texture upload. For a game with 30+ sprites (terrain, castle, units, animation frames), that's 30+ network round-trips and 30+ texture binds per frame. An atlas solves this by combining everything into one (or a few) images:

| Approach | HTTP Requests | GPU Texture Binds | Memory Waste |
|----------|--------------|-------------------|--------------|
| Individual PNGs (30 sprites) | 30 | 30 per frame | High (each PNG padded to its own allocation) |
| Single atlas | 1 | 1 per frame | Low (tightly packed, one allocation) |

**The tradeoff:** You need metadata to know where each sprite is, and the atlas dimensions must be power-of-two (256, 512, 1024, 2048) because GPUs are optimized for these sizes.

### How it works in this project

The `packAtlas(sprites)` function takes an array of sprite objects and returns packed atlas buffer(s) plus JSON metadata:

```
Input:                                Output:
┌──────────────┐                      ┌─────────────────────────────┐
│ grass-short-1│ 64×32                │ ┌────┬────┬────┬────┐       │
│ grass-short-2│ 64×32                │ │grs1│grs2│road│rock│       │ atlas-0.png
│ road-full    │ 64×32    packAtlas() │ ├────┼────┼────┼────┤       │ (512×512)
│ rock         │ 64×32   ──────────►  │ │wtr1│wtr2│wtr3│brg │       │
│ water-1      │ 64×32                │ ├────┼────┴────┴────┤       │
│ water-2      │ 64×32                │ │tree│               │       │
│ water-3      │ 64×32                │ └────┴───────────────┘       │
│ bridge-mm    │ 64×32                └─────────────────────────────┘
│ tree-1       │ 64×32                         +
└──────────────┘                      atlas-0.json (metadata)
```

### The packing algorithm (shelf-based bin packing)

The packer uses a **shelf algorithm** — think of it like packing books onto shelves:

1. **Sort sprites by height** (tallest first) for better space utilization
2. **Place sprites left-to-right** on the current shelf
3. When a sprite doesn't fit horizontally, **open a new shelf** below
4. Each shelf's height equals the tallest sprite placed on it
5. **1-pixel padding** between all sprites prevents texture bleeding (adjacent pixel colors leaking during GPU sampling)

```
Shelf 0 (height: 32px)
┌─────────┬─────────┬─────────┬─────────┬─ ─ ─ ─ ─┐
│ grass-1 │ grass-2 │  road   │  rock   │  (empty) │
│  64×32  │  64×32  │  64×32  │  64×32  │          │
└─────────┴─────────┴─────────┴─────────┴─ ─ ─ ─ ─┘
           ↑ 1px padding between each sprite

Shelf 1 (height: 32px)
┌─────────┬─────────┬─────────┬─────────┐
│ water-1 │ water-2 │ water-3 │ bridge  │
│  64×32  │  64×32  │  64×32  │  64×32  │
└─────────┴─────────┴─────────┴─────────┘
```

### Multi-frame animation handling

Sprites with multiple animation frames (like water with 3–8 frames) are expanded into individual frame entries before packing:

```
Input: { name: "water-1", frames: 3, buffer: <all 3 frames stacked vertically> }

Expanded to:
  water-1-frame-0  (64×32)
  water-1-frame-1  (64×32)
  water-1-frame-2  (64×32)
```

The metadata's `animations` section groups these back together so the runtime knows which frames belong to which sprite:

```json
"animations": {
  "water-1": ["water-1-frame-0", "water-1-frame-1", "water-1-frame-2"]
}
```

### Auto-splitting

If all sprites can't fit within a single 2048×2048 atlas (the GPU maximum this project targets), the packer automatically creates multiple atlas files:

- `atlas-0.png` — first batch of sprites
- `atlas-1.png` — overflow sprites
- Each frame's metadata includes an `atlasIndex` field so the runtime knows which image to sample from

### JSON metadata format

The output metadata looks like this:

```json
{
  "meta": {
    "version": "1.0",
    "image": "atlas-0.png",
    "size": { "w": 512, "h": 512 },
    "format": "RGBA8888"
  },
  "frames": {
    "grass-short-1": {
      "frame": { "x": 0, "y": 0, "w": 64, "h": 32 },
      "sourceSize": { "w": 64, "h": 32 },
      "atlasIndex": 0
    },
    "grass-short-2": {
      "frame": { "x": 65, "y": 0, "w": 64, "h": 32 },
      "sourceSize": { "w": 64, "h": 32 },
      "atlasIndex": 0
    },
    "water-1-frame-0": {
      "frame": { "x": 0, "y": 33, "w": 64, "h": 32 },
      "sourceSize": { "w": 64, "h": 32 },
      "atlasIndex": 0
    }
  },
  "animations": {
    "water-1": ["water-1-frame-0", "water-1-frame-1", "water-1-frame-2"]
  }
}
```

To render `grass-short-1` at runtime, the game reads the metadata, then draws a 64×32 rectangle from position (0, 0) of `atlas-0.png` onto the canvas. No separate file load needed.

### Runtime usage (conceptual)

```js
// Load once at startup
const atlasImage = await loadImage('assets/atlas-0.png');
const metadata = await loadJSON('assets/atlas-0.json');

// Draw a specific sprite
function drawSprite(ctx, spriteName, destX, destY) {
  const frame = metadata.frames[spriteName].frame;
  ctx.drawImage(
    atlasImage,
    frame.x, frame.y, frame.w, frame.h,  // source rectangle in atlas
    destX, destY, frame.w, frame.h        // destination on canvas
  );
}

drawSprite(ctx, 'grass-short-1', 100, 50);
drawSprite(ctx, 'castle-tower', 200, 80);
```

### Exports

| Export | Signature | Description |
|--------|-----------|-------------|
| `packAtlas` | `(sprites) → {atlases, metadata}` | Packs sprite frames into atlas(es) with 1px padding |

### Constraints enforced

- **Power-of-two dimensions** — atlas width and height are always 256, 512, 1024, or 2048
- **1-pixel padding** — prevents texture bleeding between adjacent sprites during GPU sampling
- **No overlapping** — the shelf algorithm guarantees no two frames share any pixel region
- **Unique names** — throws if any sprite has an empty or duplicate name
- **Max 2048px** — auto-splits into multiple atlases if content exceeds this limit
- **Deterministic** — same input sprites always produce the same atlas layout

---

## lib/animation-frames.js — Animation Generation

Generates multi-frame animation sequences for water tiles and castle flags.

### Exports

| Export | Signature | Description |
|--------|-----------|-------------|
| `generateWaterFrames` | `(frameCount, seed) → Buffer[]` | Produces 3–8 water animation frames |
| `generateFlagFrames` | `(frameCount, seed) → Buffer[]` | Produces flag waving animation frames |

Each consecutive frame pair differs in at least 10% of non-transparent pixels, ensuring visible animation. Output is deterministic for the same seed.

---

## NPM Scripts

| Command | What it runs |
|---------|-------------|
| `npm run generate:sprites` | `generate-iso-sprites-br-tl.js` + `generate-castle-sprites.js` |
| `npm run generate:level` | `generate-tutorial-level.js` |
| `npm run generate:random` | `generate-random-level.js` |
| `npm run generate:preview` | `render-level-preview.js` |
| `npm run generate` | All sprites + level |
| `npm run test:properties` | Runs property-based tests from `property-tests/` |

---

## lib/palette.js — Enhanced Palette System

Defines the constrained color palettes for the enhanced sprite pipeline. Used by the palette quantizer as the target color set for final-pass enforcement, ensuring every non-transparent pixel in generated sprites matches a defined palette color exactly.

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `PRIMARY_PALETTE` | `number[][]` (16 colors) | Shared base palette for terrain, castle, and unit sprites |
| `ENEMY_PALETTE` | `number[][]` (8 colors) | Distinct enemy palette (shares ≤2 colors with primary) |
| `CASTLE_ACCENT_COLORS` | `number[][]` (4 colors) | Weathering/highlight accents extending castle palette |
| `BORDER_COLOR` | `number[]` | Dark outline color `[25, 25, 22]` (matches PRIMARY_PALETTE[10]) |
| `ANIMATION_CONFIG` | `object` | Frame counts and timing for water and flag animations |
| `getPaletteForCategory(category)` | `function` | Returns the combined palette for a sprite category |

### getPaletteForCategory(category)

Returns the appropriate palette array for a given sprite category:

| Category | Returns |
|----------|---------|
| `'terrain'` | `PRIMARY_PALETTE` (16 colors) |
| `'unit'` | `PRIMARY_PALETTE` (16 colors) |
| `'castle'` | `PRIMARY_PALETTE` + `CASTLE_ACCENT_COLORS` (20 colors) |
| `'enemy'` | `ENEMY_PALETTE` (8 colors) |

Throws `Error` for unknown categories.

### ANIMATION_CONFIG

```javascript
{
  water: { frameCount: 4, intervalMs: 500, minFrames: 3, maxFrames: 8 },
  flag:  { frameCount: 3, intervalMs: 600, minFrames: 2, maxFrames: 6 },
}
```

### Relationship to sprite-constants.js

`lib/sprite-constants.js` remains the source of truth for tile dimensions, output paths, and per-unit color palettes (UNIT_PALETTES). `lib/palette.js` is the new source of truth for the enhanced pipeline's global palette constraints and quantization targets. The two modules serve different purposes:

- **sprite-constants.js** — "What colors does each specific unit/tile use?" (per-sprite palettes)
- **palette.js** — "What colors are allowed in the final output?" (global palette enforcement)
