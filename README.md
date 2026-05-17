# Medieval Tower Defense

A turn-based medieval tower defense game built with vanilla JavaScript and HTML5 Canvas. Defend your castle from invading forces by strategically placing defenses and managing resources.

## The Game

You are the lord of a medieval castle. Enemies approach from the river to the east, marching along the road toward your stronghold. Your castle features:

- A **Keep** (the main fortified tower)
- **Curtain walls** with corner towers
- A **Gatehouse** with portcullis
- A **Moat** surrounding the castle
- A **Bailey** (courtyard) for troop staging
- **Village huts** housing your peasants
- **Oak forests** providing resources and cover

The game is turn-based with two phases per turn:
1. **Setup phase** — move a pawn/resource, place defenses
2. **Action phase** — attack, perform actions on adjacent tiles

Win/fail conditions: TBC

## Project Structure

```
BasicTowerDefense/
├── index.html                  # Game entry point
├── package.json                # Node.js config (for sprite generation)
├── levels/
│   ├── manifest.txt            # Level load order
│   └── level1.txt              # Level 1 map (text-based tile grid)
├── assets/
│   └── sprites/                # 32x32 and 64x64 PNG sprite images
├── js/
│   ├── game-logic/             # Browser-side game code
│   │   ├── utils.js            # Constants and utility functions
│   │   ├── sprites.js          # Sprite loading and rendering
│   │   ├── level-loader.js     # Text file level parser
│   │   └── game.js             # Main game loop and renderer
│   └── level-generators/       # Node.js sprite/level generation scripts
│       ├── generate-level1.js          # Level 1 map generator
│       ├── generate-grass-sprites.js   # Grass tile sprites
│       ├── generate-border-sprites.js  # Map border sprites
│       ├── generate-water-sprites.js   # Water and coastline sprites
│       ├── generate-oak-sprites.js     # Oak tree sprites (2x2)
│       ├── generate-castle-sprites.js  # Wall, tower, gatehouse sprites
│       ├── generate-large-sprites.js   # Keep (4x4) sprite
│       ├── generate-road-sprite.js     # Dirt road sprite
│       └── generate-structure-sprites.js # Hut and bailey sprites
└── README.md
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
| `npm run generate:level` | Regenerate only level1.txt |
| `npm run serve` | Start server (alias for start) |

### Regenerating Sprites

All sprites are procedurally generated. To regenerate everything:

```bash
npm run generate
```

Or run individual generators:

```bash
node js/level-generators/generate-grass-sprites.js
node js/level-generators/generate-border-sprites.js
node js/level-generators/generate-water-sprites.js
node js/level-generators/generate-oak-sprites.js
node js/level-generators/generate-castle-sprites.js
node js/level-generators/generate-large-sprites.js
node js/level-generators/generate-road-sprite.js
node js/level-generators/generate-structure-sprites.js
node js/level-generators/generate-level1.js
```

### Level File Format

Levels are plain text files where each character represents a tile. The map uses a 2x2 logical grid (each game element occupies 2x2 characters). See `js/game-logic/level-loader.js` for the full tile legend.

Key tile characters:
| Char | Element | Size |
|------|---------|------|
| `.`  | Grass | 1x1 |
| `,`  | Flowers | 1x1 |
| `#`  | Border | 1x1 |
| `~`  | Water | 1x1 |
| `P/p` | Oak tree | 2x2 |
| `D/d` | Road | 2x2 |
| `H/h` | Hut | 2x2 |
| `G/g` | Gatehouse | 2x2 |
| `K/k` | Keep | 4x4 |
| `W`  | Wall (horizontal) | 1x1 |
| `\|` | Wall (vertical) | 1x1 |
| `T`  | Tower | 1x1 |
| `C`  | Bailey | 1x1 |
