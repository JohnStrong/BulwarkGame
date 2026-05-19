# Medieval Tower Defense

> ⚠️ **WORK IN PROGRESS** — Game mechanics, win/fail states, and AI are not yet implemented. Currently the map rendering and level generation systems are functional.

![Level 1 Preview](docs/level1-preview.png)

A turn-based medieval tower defense game with procedurally generated pixel art sprites, built with vanilla JS and HTML5 Canvas. Defend your castle from invading forces by strategically placing defenses and managing resources.

## The Game

Enemies enter from the top of the map and march along dirt roads toward your stronghold. The terrain features:

- **Dirt roads** — enemy paths (where to place defenses)
- **River** — natural barrier flowing through the center of the map
- **Stone bridge** — chokepoint where the road crosses the river
- **Forest** — provides cover, blocks line of sight, can be set ablaze
- **Open grassland** — good for tower/defense placement

The game is turn-based with two phases per turn:
1. **Setup phase** — move a pawn/resource, place defenses
2. **Action phase** — attack, perform actions on adjacent tiles

Win/fail conditions: TBC

## Project Structure

```
BasicTowerDefense/
├── index.html                  # Game entry point
├── package.json                # Node.js config
├── docs/
│   ├── game-logic.md           # Game code documentation
│   ├── generators.md           # Generator code documentation
│   └── level1-preview.png      # Rendered map preview
├── levels/
│   ├── manifest.txt            # Level load order
│   ├── level1.txt              # Tutorial level
│   └── candidates/             # Random generator output
├── assets/
│   └── sprites/                # 32x32 hex-shaped PNG sprites (17 files)
└── js/
    ├── game-logic/             # Browser-side game code
    │   ├── utils.js            # Hex geometry, constants, loaders
    │   ├── sprites.js          # Sprite loading and rendering
    │   ├── level-loader.js     # Text file → hex grid parser
    │   └── game.js             # Main game loop and renderer
    └── level-generators/       # Node.js generation scripts
        ├── generate-smooth-sprites.js  # All 17 hex sprites
        ├── generate-tutorial-level.js  # Tutorial level
        ├── generate-random-level.js    # Seeded random levels
        └── render-level-preview.js     # Level → PNG renderer
```

## Developer Guide

### Prerequisites

- Node.js (v16+)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/JohnStrong/BasicGenAITowerDefense.git
cd BasicGenAITowerDefense

# Install dependencies, generate all sprites + level, then start the server
npm run init
npm start
```

Open `http://localhost:8000` in your browser.

`npm run init` only needs to be run once (or whenever you want to regenerate sprites from scratch). After that, just use `npm start` to launch the game.

### NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run init` | Full setup: install deps, generate sprites + level |
| `npm start` | Start local server on port 8000 |
| `npm run generate` | Regenerate all sprites and level map |
| `npm run generate:sprites` | Regenerate only sprite PNGs |
| `npm run generate:level` | Regenerate tutorial level (level1.txt) |
| `npm run generate:random` | Generate a random level to candidates/ |
| `npm run generate:preview` | Render level1 to docs/level1-preview.png |
| `npm run serve` | Start server (alias for start) |

### Generating Random Levels

```bash
# Random seed (uses timestamp)
npm run generate:random

# Specific seed for reproducible maps
node js/level-generators/generate-random-level.js 42
node js/level-generators/generate-random-level.js 999
```

Output goes to `levels/candidates/`. Review the files, then promote to the game:
```bash
cp levels/candidates/2026-05-19_seed-42.txt levels/level2.txt
# Add 'level2.txt' to levels/manifest.txt
```

### Level File Format

Levels are plain text files where each character represents a hex cell. The hex grid uses pointy-top orientation with odd rows offset right (beehive pattern). See `levels/level1.txt` for a commented example.

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

### Architecture Documentation

- **[docs/game-logic.md](docs/game-logic.md)** — How the browser-side game code works (sprites, level loader, renderer)
- **[docs/generators.md](docs/generators.md)** — How the Node.js sprite and level generators work (algorithms, seeded random, noise)
