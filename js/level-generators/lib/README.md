# Level Generator Library Modules

Shared modules used by all sprite generator scripts in `js/level-generators/`.
Each module is self-contained and imported by the generators rather than defining
their own constants or utilities inline.

## Table of Contents

- [sprite-constants.js](#sprite-constantsjs)
- [palette.js](#palettejs)
- [noise-texture.js](#noise-texturejs)
- [shading.js](#shadingjs)
- [dithering.js](#ditheringjs)
- [palette-quantizer.js](#palette-quantizerjs)
- [animation-frames.js](#animation-framesjs)
- [atlas-packer.js](#atlas-packerjs)
- [fill-patterns.js](#fill-patternsjs)
- [pixel-utils.js](#pixel-utilsjs)
- [unit-body.js](#unit-bodyjs)
- [weapons.js](#weaponsjs)

---

## sprite-constants.js

Single source of truth for every constant shared across sprite generators.

### Tile dimensions

| Constant     | Value | Description                              |
|--------------|-------|------------------------------------------|
| `TILE_WIDTH` | 64    | Width of every sprite tile in pixels     |
| `TILE_HEIGHT`| 32    | Height of every sprite tile in pixels    |
| `OUTPUT_DIR` | —     | Absolute path to `assets/sprites/`       |

### Color palettes

| Export          | Description                                                        |
|-----------------|--------------------------------------------------------------------|
| `TERRAIN_COLORS`| Grass, road, water, bridge, and tree canopy RGB triples            |
| `CASTLE_COLORS` | Stone wall, tower, wood, iron, and straw RGB triples               |
| `UNIT_PALETTES` | Per-unit-type `{ body, cape, accent, skin }` RGB triples           |
| `BORDER_COLOR`  | Dark outline color `[25, 25, 22]` used on all sprite outer edges   |

### Sprite name registries

These objects map camelCase keys to the canonical PNG filename stem (without
`.png`). The level loader uses these names to map level-text characters to
sprites at runtime.

| Export                | Contents                                                                 |
|-----------------------|--------------------------------------------------------------------------|
| `TERRAIN_SPRITES`     | Grass, flowers, road, water, bridge, `tree-1`–`tree-7`, rock            |
| `CASTLE_SPRITES`      | Bridge, tower, keep sections, gatehouse, wall, bailey variants           |
| `UNIT_SPRITES`        | All 9 player unit types                                                  |
| `TREE_OVERLAY_SPRITES`| 7 transparent-background tree overlay sprites (see below)               |

#### TREE_OVERLAY_SPRITES

Added as part of the **tree-overlay-system** feature. These sprites are drawn
as a second layer on top of a grass ground tile, giving trees visual height and
depth. Each sprite is **64×48 px** with `alpha=0` outside the trunk and canopy
shape.

| Key                | Sprite name            | Level char | Variants |
|--------------------|------------------------|------------|----------|
| `treeOakOverlay1`  | `tree-oak-overlay-1`   | `O`        | 1 of 3   |
| `treeOakOverlay2`  | `tree-oak-overlay-2`   | `O`        | 2 of 3   |
| `treeOakOverlay3`  | `tree-oak-overlay-3`   | `O`        | 3 of 3   |
| `treePineOverlay1` | `tree-pine-overlay-1`  | `P`        | 1 of 2   |
| `treePineOverlay2` | `tree-pine-overlay-2`  | `P`        | 2 of 2   |
| `treeShrubOverlay1`| `tree-shrub-overlay-1` | `S`        | 1 of 2   |
| `treeShrubOverlay2`| `tree-shrub-overlay-2` | `S`        | 2 of 2   |

The existing `tree-1` through `tree-7` entries in `TERRAIN_SPRITES` are
retained for backward compatibility.

---

## palette.js

Runtime palette helpers used by generators and property tests.

**Exports**

- `PRIMARY_PALETTE` — 16-color array of `[r, g, b]` triples covering all
  terrain and unit hues
- `ENEMY_PALETTE` — 8-color array sharing at most 2 colors with the player
  unit palette
- `getPaletteForCategory(category)` — returns the combined palette array for
  `'terrain'`, `'castle'`, `'unit'`, or `'enemy'`
- `ANIMATION_CONFIG` — frame counts and intervals for `water` and `flag`
  animated sprite types

---

## noise-texture.js

Deterministic noise for terrain variation.

**Exports**

- `terrainNoise(x, y, scale, seed)` — wraps `simplex-noise`; returns a value
  in `[-1, 1]`. Same seed always produces the same output, enabling
  reproducible sprite generation and property tests.

---

## shading.js

Pixel-level lighting effects applied to sprite buffers in place.

**Exports**

| Function | Description |
|----------|-------------|
| `applyDirectionalShading(buf, w, h, highlightPct, shadowPct)` | Upper-left highlight / lower-right shadow |
| `applyFaceShading(buf, w, h, topColor, sideColor)` | Isometric top-face vs. side-face lighting |
| `applyShadowEdge(buf, w, h)` | 1-pixel bottom-right drop shadow |

---

## dithering.js

Ordered dithering for palette-compliant terrain transition edges.

**Exports**

- `applyOrderedDithering(buf, w, h, colorA, colorB, borderWidth, edge)` —
  applies a 4×4 Bayer matrix dither in the `borderWidth`-pixel border region
  on the specified `edge`. Output uses only `colorA` and `colorB` (no
  intermediate blended colors).

---

## palette-quantizer.js

Snaps every non-transparent pixel to the nearest palette color.

**Exports**

- `quantizeToPalette(buf, palette)` — modifies `buf` in place using Euclidean
  RGB distance. Skips pixels with `alpha === 0`. Throws
  `Error('Quantization failed')` with pixel coordinates and color details if
  any non-transparent pixel remains off-palette after the pass.

---

## animation-frames.js

Generates multi-frame animation sequences for atlas packing.

**Exports**

| Function | Description |
|----------|-------------|
| `generateWaterFrames(frameCount, seed)` | 3–8 frames; each consecutive pair differs in ≥10% of non-transparent pixels |
| `generateFlagFrames(frameCount, seed)` | Castle flag waving animation frames |

---

## atlas-packer.js

Bin-packs sprite buffers into power-of-two atlas images.

**Exports**

- `packAtlas(sprites)` — accepts an array of `{ name, buffer, width, height }`
  objects. Returns `{ images, metadata }` where:
  - `images` — array of atlas PNG buffers (one per atlas file, max 2048×2048)
  - `metadata` — JSON-serializable object with `frames` (name → `{ x, y, w, h,
    atlasIndex }`) and `animations` (sprite type → frame name array)

  Throws `Error('Invalid sprite name')` on empty or duplicate names.  
  Throws `Error('Atlas metadata serialization failed')` on JSON failure.  
  Sprites are separated by 1-pixel padding. Atlas dimensions are always a
  power of two (256, 512, 1024, or 2048).

---

## fill-patterns.js

Reusable pixel-fill helpers for drawing repeated patterns (stone courses,
mortar lines, hatching, etc.) into sprite buffers.

---

## pixel-utils.js

Low-level buffer utilities shared across generators (pixel get/set, alpha
compositing, buffer cloning, etc.).

---

## unit-body.js

Draws the base humanoid silhouette (torso, legs, head) into a 32×32 buffer
using a given `UNIT_PALETTES` entry. Used by `generate-unit-sprites.js` and
`generate-enemy-sprites.js`.

---

## weapons.js

Draws weapon/held-item elements (sword, bow, spear, crossbow, hammer, pike,
javelin, club, ramrod) into a sprite buffer. Each weapon occupies a minimum
4×4 pixel area. Used by `generate-unit-sprites.js`.
