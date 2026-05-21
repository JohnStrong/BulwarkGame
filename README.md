# Medieval Tower Defense

> ⚠️ **WORK IN PROGRESS** — Game mechanics, win/fail states, and AI are not yet implemented. Currently the isometric map rendering, level generation, and camera systems are functional.

![Level 1 Preview](docs/snapshots/iso-viewpoint-map-level-units-hud-v-01.png)

A turn-based medieval tower defense game rendered in isometric 2.5D with procedurally generated pixel art sprites. Built with vanilla JS and HTML5 Canvas. Defend your castle from invading forces by strategically placing defenses and managing resources.

## The Game

Enemies enter from the top of the map and march along dirt roads toward your stronghold. The terrain features:

- **Dirt roads** — enemy paths (where to place defenses)
- **River** — natural barrier flowing through the center
- **Stone bridge** — chokepoint where the road crosses the river
- **Forest** — provides cover, blocks line of sight, can be set ablaze
- **Open grassland** — good for tower/defense placement
- **Castle** — walls, towers, gatehouse, keep with flag (protect this!)

The game is turn-based with two phases per turn:
1. **Setup phase** — move a pawn/resource, place defenses
2. **Action phase** — attack, perform actions on adjacent tiles

Win/fail conditions: TBC


### Controls (Isometric View)

| Key | Action |
|-----|--------|
| WASD / Arrow keys | Scroll camera |
| + / = | Zoom in |
| - | Zoom out |
| Mouse wheel | Zoom in/out |
| Spacebar | Rotate viewpoint (BR→TL ↔ BL→TR), re-centers on keep |
| Mouse hover (map) | Highlights tile with gold border |
| Left click (map) | Select tile (lifts slightly), click again to deselect |
| Left click (unit bar) | Select unit type, shows detail panel with stats |
| Q | Attack action (when unit selected) |
| V | Defend action (when unit selected) |

### HUD Layout

- **Top bar**: Level name, controls hint, viewpoint, zoom %
- **Bottom center**: Unit bar — shows all available unit types with sprite, name, and remaining count. Click to select.
- **Detail panel** (above unit bar): Appears when a unit type is selected. Shows sprite, name, HP, ATK, Armour %, available count, and action buttons (Q/V).
- **Bottom-left panel**: Tile info — appears when a map tile is clicked. Shows tile coordinates and type. Closeable with ✕.

## Your Army

You command a medieval garrison defending the keep. Each unit type has distinct strengths — deploy them wisely based on terrain and enemy approach.

---

### ⚔️ Archer / Crossbowman
![unit-archer](assets/sprites/unit-archer.png) ![unit-crossbowman](assets/sprites/unit-crossbowman.png)

| Stat | Value |
|------|-------|
| Available | 40 |
| Health | 100 |
| Attack | 90 |
| Defense | 0.80 (20% damage reduction) |

The backbone of castle defense. Archers rain arrows from walls and elevated positions, exploiting height advantage. Crossbowmen trade fire rate for armor-piercing bolts. Place them on walls, towers, or behind cover for maximum effectiveness. Vulnerable in melee.

---

### 🛡️ Spearman / Heavy Infantry
![unit-spearman](assets/sprites/unit-spearman.png) ![unit-heavy-infantry](assets/sprites/unit-heavy-infantry.png)

| Stat | Value |
|------|-------|
| Available | 30 |
| Health | 100 |
| Attack | 100 |
| Defense | 0.50 (50% damage reduction) |

The shield wall. Spearmen hold chokepoints — gates, bridges, breaches — where their long reach stops enemies cold. Heavy infantry with shields absorb charges and protect archers behind them. Essential at every entry point the enemy might exploit.

---

### 👑 Men-at-Arms (Knight)
![unit-knight](assets/sprites/unit-knight.png)

| Stat | Value |
|------|-------|
| Available | 20 |
| Health | 100 |
| Attack | 130 |
| Defense | 0.40 (60% damage reduction) |

Your elite shock troops. Heavily armored knights deal devastating damage and shrug off most attacks. Use them to plug breaches, lead counter-attacks, or crush enemy siege crews. Expensive and few — deploy them where the battle is fiercest.

---

### 🔧 Engineer / Siege Crew
![unit-engineer](assets/sprites/unit-engineer.png)

| Stat | Value |
|------|-------|
| Available | 5 |
| Health | 100 |
| Attack | 50 |
| Defense | 0.85 (15% damage reduction) |

Builders and operators. Engineers repair damaged walls, operate ballistae and mangonels, pour boiling pitch, and maintain defenses. Weak in combat but invaluable for keeping your castle standing. Protect them at all costs.

---

### 🏚️ Militia / Watchmen
![unit-militia](assets/sprites/unit-militia.png)

| Stat | Value |
|------|-------|
| Available | 5 |
| Health | 100 |
| Attack | 60 |
| Defense | 0.90 (10% damage reduction) |

Local levies armed with whatever's at hand. Militia patrol quiet sections, serve as early warning, and provide manpower reserves. They won't hold against a determined assault, but they buy time for your real soldiers to respond.

---

## Project Structure

```
BasicTowerDefense/
├── index.html                  # Game entry (isometric 2.5D)
├── index-topdown.html          # Alternative top-down hex view
├── package.json
├── docs/
│   ├── game-logic.md           # Game code documentation
│   └── generators.md           # Generator code documentation
├── levels/
│   ├── manifest.txt            # Level load order
│   ├── level1.txt              # Tutorial level
│   ├── level1.elevation.txt    # Elevation map (step heights per column)
│   └── candidates/             # Random generator output
├── assets/
│   └── sprites/                # 64x32 isometric diamond PNGs
├── tests/
│   ├── game-logic/             # Unit tests for browser game logic
│   └── level-generators/
│       ├── *.spec.js           # Unit tests for each generator script
│       └── lib/
│           ├── palette.spec.js         # Palette definitions & category lookup
│           ├── fill-patterns.spec.js   # Diamond fill operations
│           ├── pixel-utils.spec.js     # Core drawing primitives
│           ├── sprite-constants.spec.js# Shared constants
│           ├── unit-body.spec.js       # Unit figure drawing
│           └── weapons.spec.js         # Weapon drawing functions
├── property-tests/             # Property-based tests (fast-check)
└── js/
    ├── game-logic/
    │   ├── utils.js            # Hex/iso geometry, constants, loaders
    │   ├── sprites.js          # Sprite loading and rendering
    │   ├── level-loader.js     # Text file → tile grid parser + elevation
    │   ├── game.js             # Top-down hex renderer
    │   └── game-iso.js         # Isometric 2.5D renderer (default)
    └── level-generators/
        ├── generate-iso-sprites-br-tl.js  # Terrain sprites (BR→TL viewpoint)
        ├── generate-castle-sprites.js     # Castle structure sprites
        ├── generate-unit-sprites.js       # Army unit sprites
        ├── generate-smooth-sprites.js     # Legacy hex sprites (kept for top-down)
        ├── generate-tutorial-level.js     # Tutorial level generator
        ├── generate-random-level.js       # Seeded random level generator
        ├── render-level-preview.js        # Level → PNG renderer
        └── lib/
            ├── sprite-constants.js  # Tile dims, output path, color palettes, sprite names
            ├── pixel-utils.js       # createBuffer, setPixel, isInsideDiamond, seededRandom
            ├── fill-patterns.js     # fillDiamond, fillDiamondWithSpeckle, drawStoneBlocks
            ├── palette.js           # Enhanced palette definitions & category lookup
            ├── unit-body.js         # drawUnit — full humanoid figure assembly
            └── weapons.js           # drawWeapon dispatcher + weapon functions
```

## Visual Style

The game uses a classic isometric (2.5D) perspective — flat diamond tiles viewed from the bottom-right looking toward the top-left. Each tile is a 64×32px diamond with terrain texture, thin border, and transparent outside. The map supports elevation via a linked `.elevation.txt` file, creating subtle terraced steps across the landscape.

Two viewpoints are available:
- **Isometric** (`index.html`) — default, with camera scroll (WASD/arrows) and zoom (+/-/mousewheel)
- **Top-down hex** (`index-topdown.html`) — flat hexagonal grid view

### Enhanced Sprite Pipeline

The sprite generation system is being upgraded with a layered pixel art pipeline that adds:

- **Palette enforcement** — A strict 16-color primary palette shared across terrain, castle, and unit sprites, with a separate 8-color enemy palette (max 2 shared colors). Castle sprites get up to 4 additional accent colors. All sprites pass through a final quantization step guaranteeing pixel-perfect palette adherence.
- **Procedural noise** — Simplex noise for terrain variation (grass, water) ensuring no two seeded sprites are identical.
- **Directional shading** — Upper-left light source applied consistently across all sprite categories.
- **Ordered dithering** — 4×4 Bayer matrix dithering on terrain transition edges using only palette colors.
- **Animation frames** — Multi-frame sequences for water (3–8 frames) and castle flags.
- **Sprite atlas** — All sprites packed into power-of-two atlas PNGs with JSON metadata for efficient runtime loading.
- **Enemy sprites** — 5 distinct enemy unit types with visual differentiation from player units.
- **Damaged castle variants** — 10 damaged versions of castle structures showing cracks and rubble.

The palette definitions live in `js/level-generators/lib/palette.js` and export:
- `PRIMARY_PALETTE` (16 colors) — terrain, castle, and unit sprites
- `ENEMY_PALETTE` (8 colors) — enemy units, visually distinct from player palette
- `CASTLE_ACCENT_COLORS` (4 colors) — weathering and highlight effects for castle sprites
- `BORDER_COLOR` — dark outline for sprite edges
- `ANIMATION_CONFIG` — frame counts and timing for water and flag animations
- `getPaletteForCategory(category)` — returns the combined palette for a sprite category

## Developer Guide

### Prerequisites

- Node.js (v16+)

### Quick Start

```bash
git clone https://github.com/JohnStrong/BasicGenAITowerDefense.git
cd BasicGenAITowerDefense

npm run init
npm start
```

Open `http://localhost:8000` in your browser.

### NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run init` | Install deps, generate sprites + level |
| `npm start` | Start local server on port 8000 |
| `npm run generate` | Regenerate all sprites and level |
| `npm run generate:sprites` | Regenerate sprite PNGs |
| `npm run generate:level` | Regenerate tutorial level |
| `npm run generate:random` | Generate random level to candidates/ |
| `npm run generate:preview` | Render level to PNG |
| `npm test` | Run all unit tests (node:test) |
| `npm run test:properties` | Run property-based tests (fast-check) |

### Testing

Tests use the Node.js built-in test runner (`node:test`). Unit tests mirror the source structure under `tests/`. Property-based tests (using [fast-check](https://github.com/dubzzz/fast-check)) live in `property-tests/` and validate universal correctness properties across all generated sprites.

```bash
# Run all unit tests
npm test

# Run property-based tests
npm run test:properties

# Run a single test file
node --test tests/level-generators/lib/palette.spec.js
```

Key test areas:
- **Palette compliance** — verifies color counts, channel ranges, enemy/player palette separation, and category lookup behavior
- **Sprite dimensions** — ensures all generated sprites match expected sizes (64×32 terrain/castle, 32×32 units)
- **Alpha invariant** — confirms all pixels are fully opaque or fully transparent (no partial alpha)
- **Animation frames** — validates frame counts and inter-frame pixel differences

### Level File Format

Levels are plain text files where each character represents an isometric tile.

| Char | Element |
|------|---------|
| `.` | Grass |
| `,` | Flowers |
| `O` | Oak tree |
| `P` | Pine tree |
| `S` | Shrub |
| `R` | Rock |
| `D` | Road (dirt) |
| `~` | Water |
| `=` | Bridge (cobblestone) |
| `b` | Castle bridge start (road→wood) |
| `m` | Castle bridge mid (wood planks) |
| `g` | Castle bridge gate (wood→stone) |
| `T` | Tower (round stone) |
| `K/j/J` | Keep (TL/BL/BR tiles) |
| `F` | Keep center (flag — protect this!) |
| `G` | Gatehouse (portcullis) |
| `W` | Wall (full stone) |
| `C` | Bailey (dirt+hay floor, 3 variants) |

### Elevation Files

Each level can have a `.elevation.txt` file (e.g., `level1.elevation.txt`) that defines per-column height offsets for the isometric staircase effect:

```
; Positive = step down, Negative = step up
0-9:0
10-19:2
20-29:4
30-39:2
40-49:0
50-59:-2
```

### Architecture Documentation

- **[js/game-logic/README.md](js/game-logic/README.md)** — How the browser game code works: sprites, level loader, unit manager, game loop, and how they connect
- **[js/game-logic/lib/README.md](js/game-logic/lib/README.md)** — Reusable engine modules: isometric camera, input handling, renderer, and HUD system
- **[docs/game-loop-living-doc.md](docs/game-loop-living-doc.md)** — Game design document: turn phases, unit stats, combat rules, and implementation status
- **[js/level-generators/README.md](js/level-generators/README.md)** — How the Node.js sprite and level generators work: algorithms, palettes, seeded random
