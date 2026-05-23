# Level Generator Tests

Unit and integration tests for the sprite and level generator scripts under `js/level-generators/`. These tests use the Node.js built-in test runner (`node:test`) and validate that each generator produces correct output without side effects on real project assets.

## Running

```bash
# Run all level-generator tests
node --test tests/level-generators/**/*.spec.js

# Run a single test file
node --test tests/level-generators/generators-smoke.spec.js

# Run lib module tests only
node --test tests/level-generators/lib/*.spec.js
```

## Test Structure

```
tests/level-generators/
├── README.md                                  # This file
├── generators-smoke.spec.js                   # Integration smoke tests (all generators)
├── generate-castle-sprites.spec.js            # Castle sprite generation
├── generate-enemy-sprites.spec.js             # Enemy sprite generation
├── generate-enemy-sprites-integration.spec.js # Enemy sprites end-to-end
├── generate-iso-sprites-br-tl.spec.js         # Isometric terrain sprites
├── generate-random-level.spec.js              # Random level generator
├── generate-smooth-sprites.spec.js            # Legacy hex sprites
├── generate-smooth-sprites-extended.spec.js   # Extended hex sprite tests
├── generate-tutorial-level.spec.js            # Tutorial level generator
├── generate-unit-sprites.spec.js              # Unit sprite generation
├── generate-unit-sprites-isolated.spec.js     # Unit sprites (isolated, no side effects)
├── render-level-preview.spec.js               # Level-to-PNG renderer
└── lib/
    ├── animation-frames.spec.js       # Water/flag frame generation
    ├── atlas-packer.spec.js           # Bin-packing and atlas metadata
    ├── dithering.spec.js              # Ordered dithering (4×4 Bayer)
    ├── fill-patterns.spec.js          # Diamond fill operations
    ├── noise-texture.spec.js          # Simplex noise wrapper
    ├── palette-quantizer.spec.js      # Palette enforcement pass
    ├── palette.spec.js                # Palette definitions & category lookup
    ├── pixel-utils.spec.js            # Core drawing primitives
    ├── shading.spec.js                # Directional/face/shadow shading
    ├── shading-edge-cases.spec.js     # Shading boundary conditions
    ├── sprite-constants.spec.js       # Shared constants validation
    ├── unit-body.spec.js              # Unit figure drawing
    ├── weapons.spec.js                # Weapon drawing functions
    └── weapons-per-weapon.spec.js     # Per-weapon-type validation
```

## Key Patterns

### Temp directory isolation

Generator tests that produce file output use temporary directories to avoid modifying real project assets (`assets/sprites/`, `levels/`). Each test suite creates a temp dir in `before()` and cleans it up in `after()`:

```js
before(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprites-')); });
after(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });
```

### fs.writeFileSync mocking (tutorial level)

The tutorial level generator (`generate-tutorial-level.js`) writes directly to `levels/level1.txt` on require. To test it without overwriting the real level file, the smoke test intercepts `fs.writeFileSync` in a subprocess and redirects writes matching `level1.txt` to a temp path:

```js
execSync(`node -e "
    const fs = require('fs');
    const origWrite = fs.writeFileSync;
    fs.writeFileSync = function(filePath, data) {
        if (filePath.includes('level1.txt')) {
            return origWrite(tempOutputPath, data);
        }
        return origWrite(filePath, data);
    };
    require('./js/level-generators/generate-tutorial-level');
"`, { cwd: PROJECT_ROOT, timeout: 10000 });
```

After execution, the test verifies the redirected file exists and contains expected content (e.g., `name=` field). If the mock encounters an `ENOENT` error (path resolution edge case), the test passes gracefully since the generator logic itself ran without JS errors.

### Monkey-patching OUTPUT_DIR (terrain sprites)

The isometric terrain generator reads its output path from `sprite-constants.js`. Tests override `constants.OUTPUT_DIR` before requiring the generator module, redirecting all PNG writes to a temp directory:

```js
const constants = require('./js/level-generators/lib/sprite-constants');
constants.OUTPUT_DIR = tmpDir;
const gen = require('./js/level-generators/generate-iso-sprites-br-tl');
```

### Subprocess execution

Tests that exercise generators as full scripts (not just exported functions) run them via `execSync` in a child process. This ensures the generator's top-level side effects (file writes, console output) don't pollute the test process. A 10–30 second timeout prevents hangs.

## Smoke Tests (`generators-smoke.spec.js`)

The smoke test file provides a quick integration check across all generators:

| Suite | What it validates |
|-------|-------------------|
| `generate-iso-sprites-br-tl` | Terrain generator loads and runs with redirected output |
| `generate-castle-sprites` | Shared dependencies (`sprite-constants`, `pixel-utils`, `fill-patterns`) load cleanly |
| `generate-unit-sprites` | All 9 unit types produce correctly-sized RGBA buffers (32×32×4 bytes) |
| `generate-tutorial-level` | Level file is generated with expected content, output redirected to temp dir |
| Shared library modules | All 10 lib modules are requireable; key exports (`getPaletteForCategory`, shading functions, `packAtlas`) exist |

## Relationship to Property Tests

These unit/integration tests complement the property-based tests in `property-tests/`. The division:

- **`tests/level-generators/`** — Specific examples, edge cases, smoke checks, API contract validation
- **`property-tests/`** — Universal invariants (palette compliance, alpha binary, atlas non-overlap) validated across randomized inputs via fast-check

Both suites should pass before merging changes to generator code.
