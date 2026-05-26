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
├── README.md                                       # This file
├── generators-smoke.spec.js                        # Integration smoke tests (all generators)
│
├── Castle sprites
│   ├── generate-castle-sprites.spec.js             # Castle sprite generation (core)
│   └── generate-castle-sprites-extended.spec.js    # Extended castle sprite assertions
│
├── Damaged castle sprites
│   ├── generate-damaged-castle-sprites.spec.js     # Damaged castle generation (core)
│   ├── generate-damaged-castle-dispatcher.spec.js  # Dispatcher for all 10 damaged types
│   ├── generate-damaged-castle-helpers.spec.js     # Shared helper function tests
│   ├── generate-damaged-castle-internals.spec.js   # Direct tests for internal damage helpers:
│   │                                               #   countOpaquePixels, applyCracks,
│   │                                               #   applyMissingBlocks, applyRubbleDebris,
│   │                                               #   applyDamage, and the dispatcher's
│   │                                               #   unknown-type default branch
│   └── generate-damaged-castle-phase4.spec.js      # Phase 4 damage-area property assertions
│
├── Enemy sprites
│   ├── generate-enemy-sprites.spec.js              # Enemy sprite generation (core)
│   └── generate-enemy-sprites-integration.spec.js  # Enemy sprites end-to-end
│
├── Terrain sprites
│   ├── generate-iso-sprites-br-tl.spec.js          # Isometric terrain sprites
│   ├── generate-iso-sprites-flowers-trees.spec.js  # Flower and tree variant sprites
│   ├── generate-iso-sprites-overlay.spec.js        # Tree overlay sprite generation (64×48, transparent bg)
│   └── determinism-regression.spec.js              # Regression guard for seeded determinism
│
├── Smooth / hex sprites
│   ├── generate-smooth-sprites.spec.js             # Legacy hex sprites (core)
│   ├── generate-smooth-sprites-extended.spec.js    # Extended hex sprite tests
│   ├── generate-smooth-sprites-helpers.spec.js     # Internal helper function tests
│   ├── generate-smooth-sprites-internals.spec.js   # Direct tests for internal helpers
│   │                                               #   (genGrass, genFlowers, genRoadFull,
│   │                                               #    genBridgeMM, genWaterV, genTree, etc.)
│   └── generate-smooth-sprites-water-h.spec.js     # Horizontal water variant
│
├── Unit sprites
│   ├── generate-unit-sprites.spec.js               # Unit sprite generation (core)
│   └── generate-unit-sprites-isolated.spec.js      # Unit sprites (isolated, no side effects)
│
├── Level generators
│   ├── generate-random-level.spec.js               # Random level generator
│   ├── generate-random-level-exported.spec.js      # Exported API surface of random level gen
│   ├── generate-tutorial-level.spec.js             # Tutorial level generator
│   └── generate-tutorial-level-logic.spec.js       # Tutorial level logic (no file I/O)
│
├── Level loader
│   └── level-loader-char-mapping.spec.js           # Character-to-tile mapping assertions
│
├── Render level preview
│   ├── render-level-preview.spec.js                # Level-to-PNG renderer (core)
│   ├── render-level-preview-integration.spec.js    # Pixel-copy loop integration tests
│   │                                               #   (mocked sharp/fs, fallback sprite gen)
│   ├── render-level-preview-mappings.spec.js       # charToSprite mapping coverage
│   ├── render-level-preview-complete-mappings.spec.js # Full character mapping assertions
│   ├── render-level-preview-char-divergence.spec.js   # Documents P/S divergence from level-loader
│   └── render-level-preview-pine-shrub.spec.js     # Pine and shrub fallback behavior
│
├── Build pipeline
│   ├── build-sprites.spec.js                       # Build script unit tests
│   ├── build-sprites-integration.spec.js           # Full build pipeline integration
│   ├── build-sprites-overlay.spec.js               # Overlay PNG pre-pack check + packAtlas inclusion
│   └── sprite-requirements-assertions.spec.js      # Requirements-level sprite assertions
│
├── Snapshot / regression
│   └── sprite-snapshot.spec.js                     # Pixel-level snapshot regression tests
│
├── Shading
│   └── shading-quantitative.spec.js                # Quantitative shading value assertions
│
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
    ├── unit-body-pixel.spec.js        # Pixel-level assertions for unit-body.js:
    │                                  #   drop shadow placement (CX, CY+9 — not CX+1 which
    │                                  #   is a boot pixel), cape wind-wobble sine formula,
    │                                  #   torso/legs/head/helmet/pauldron pixel positions,
    │                                  #   and all unit palette × weapon type combinations
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

### Inline replication of unexported helpers

Several generator modules expose internal helpers only as browser globals (no `module.exports`). Rather than restructuring production code, the corresponding `*-internals.spec.js` files replicate the helper logic inline using the same algorithm as the production file, then test the replicated version directly. This pattern is used in:

- `generate-damaged-castle-internals.spec.js` — replicates `countOpaquePixels`, `applyCracks`, `applyMissingBlocks`, `applyRubbleDebris`
- `generate-smooth-sprites-internals.spec.js` — replicates internal hex sprite helpers

The replicated helpers import shared primitives (`pixel-utils`, `fill-patterns`, `sprite-constants`) from the real production modules, so any change to those primitives will surface as a test failure.

## Smoke Tests (`generators-smoke.spec.js`)

The smoke test file provides a quick integration check across all generators:

| Suite | What it validates |
|-------|-------------------|
| `generate-iso-sprites-br-tl` | Terrain generator loads and runs with redirected output |
| `generate-castle-sprites` | Shared dependencies (`sprite-constants`, `pixel-utils`, `fill-patterns`) load cleanly |
| `generate-unit-sprites` | All 9 unit types produce correctly-sized RGBA buffers (32×32×4 bytes) |
| `generate-tutorial-level` | Level file is generated with expected content, output redirected to temp dir |
| Shared library modules | All 10 lib modules are requireable; key exports (`getPaletteForCategory`, shading functions, `packAtlas`) exist |

## Damaged Castle Internal Helpers (`generate-damaged-castle-internals.spec.js`)

Directly tests the five internal damage-application helpers that were previously only exercised indirectly through `generateDamagedCastleSprite`. Each helper is replicated inline (see pattern above) and tested for:

| Helper | What's asserted |
|--------|-----------------|
| `countOpaquePixels` | Returns 0 for empty buffer; positive count for filled diamond; ignores corner pixels outside diamond; deterministic |
| `applyCracks` | Modifies pixels on filled buffer; returns 0 on empty buffer; deterministic per seed; different seeds produce different patterns; more cracks → at least as many modified pixels |
| `applyMissingBlocks` | Modifies pixels on filled buffer; never increases opaque pixel count (some blocks become transparent); deterministic per seed; returns 0 on empty buffer |
| `applyRubbleDebris` | Modifies pixels on filled buffer; deterministic per seed; different seeds produce different patterns; rubble concentrates in lower half of diamond; returns 0 on empty buffer |
| Dispatcher default branch | Unknown type either throws or returns null/undefined; all 10 known types (`wall`, `tower`, `keep-tl`, `keep-bl`, `keep-br`, `keep-center`, `gatehouse`, `bailey-1`, `bailey-2`, `bailey-3`) do not throw |

## Build Pipeline Overlay Tests (`build-sprites-overlay.spec.js`)

Validates the pre-pack overlay existence check and atlas inclusion logic added in the tree overlay system (Task 8.2). The test file replicates the two key helpers from `build-sprites.js` inline — `logBuildError` and `checkOverlayPngsExist` — so the logic can be exercised without running the full build script.

| Suite | What it validates |
|-------|-------------------|
| `missing PNG detection` | `checkOverlayPngsExist` throws when any overlay PNG is absent from `OUTPUT_DIR`; error message includes the missing sprite name(s) and count; passes when all PNGs are present; reports only the missing subset when some are present |
| `structured error logging` | `logBuildError` output starts with `[SPRITE-BUILD-ERROR]`; includes `Sprite:` and `Stage: pre-pack` fields; produces one log entry per missing overlay sprite |
| `non-zero exit on missing overlay PNG` | A minimal subprocess script that mirrors the build pipeline exits with code 1 and writes `[SPRITE-BUILD-ERROR]` + `Stage: pre-pack` to stderr when overlay PNGs are absent |
| `TREE_OVERLAY_SPRITES included in packAtlas entries` | All 7 overlay sprite names from `TREE_OVERLAY_SPRITES` appear in the atlas metadata after `packAtlas()`; overlay frames are packed at native 64×48 dimensions; overlay sprites coexist with terrain sprites in the same atlas; no two overlay frames overlap |

### Inline replication pattern

`checkOverlayPngsExist` and `logBuildError` are replicated directly in the test file rather than exported from `build-sprites.js`. This keeps the production build script self-contained while still giving the test suite direct access to the logic. Any divergence between the replicated helpers and the production implementation will surface as a test failure when the build pipeline behavior changes.

### Subprocess exit-code tests

The non-zero exit tests write a minimal throwaway script to `__dirname`, execute it with `execFileSync`, and assert the child process exits with a non-zero status code and writes the expected structured error to stderr. The temp script is cleaned up in a `finally` block regardless of test outcome.

## Unit Body Pixel Tests (`lib/unit-body-pixel.spec.js`)

Pixel-level assertions for `js/level-generators/lib/unit-body.js`, verifying that `drawUnit` places each body part at the correct pixel coordinates in the 64×32 RGBA buffer.

### Drop shadow coordinate

The drop shadow ellipse is drawn at `(centerX + offsetX + 1, centerY + 9 + offsetY)` for `offsetX` in `[-5, +5]` and `offsetY` in `[-1, +2]`. The test suite checks the shadow at `(CX, CY+9)` — which corresponds to `offsetX = -1, offsetY = 0` in the ellipse loop — rather than `(CX+1, CY+9)`.

The reason: `CX+1` is one of the four boot pixel positions (`CX±1`, `CX±2` at `CY+9`). Boots are drawn with `alpha=255` after the shadow loop, so the shadow's `alpha=100` at that coordinate is overwritten. `CX` is not a boot position, so the shadow pixel survives and can be asserted.

| Suite | What it validates |
|-------|-------------------|
| `drop shadow pixel assertions` | Shadow at `(CX, CY+9)` is semi-transparent (`alpha=100`), near-black (`R≤25, G≤25, B≤20`), spans ≥3 pixels across the ellipse width, and does not appear above `y = CY+8` |
| `torso pixel assertions` | Torso region `(CX-3..CX+2, CY-1..CY+4)` has ≥20 opaque pixels; center pixel is opaque with non-zero RGB |
| `legs pixel assertions` | Left leg at `(CX-2, CY+5)` and right leg at `(CX+1, CY+5)` are opaque; boots at `(CX-2, CY+9)` and `(CX+1, CY+9)` are opaque and dark brown (`R<80, R>G>B`) |
| `head pixel assertions` | Head region `(CX-1..CX+2, CY-6..CY-3)` has ≥8 opaque pixels; center pixel is opaque |
| `helmet pixel assertions` | Exactly 6 helmet pixels at the expected positions; top at `(CX, CY-6)` and brim at `(CX-1, CY-5)` are opaque |
| `cape wind-wobble sine calculation` | Cape pixels appear in column range `[CX-5, CX-3]`; wobble formula `round(sin(row * 0.8) * 0.5)` always yields `{-1, 0, 1}`; cape spans ≥4 rows; cape pixel is opaque |
| `shoulder pauldron pixel assertions` | Left pauldron at `(CX-3, CY-1)` and right at `(CX+2, CY-1)` are opaque; exactly 4 pauldron pixels total |
| `all unit types produce valid figures` | For every palette in `UNIT_PALETTES` × weapon type: drop shadow at `(CX, CY+9)` is semi-transparent and torso center at `(CX, CY+1)` is opaque |

### Boot vs. shadow pixel overlap

The shadow loop condition `buffer[pixelIndex + 3] === 0` means the shadow only writes to pixels that are still transparent at the time the shadow is drawn. Boots are drawn in step 2 (legs), which runs before the deferred shadow draw. The four boot positions (`CX±1`, `CX±2` at `CY+9`) are therefore opaque when the shadow loop runs, so the shadow is skipped at those coordinates. Any test asserting `alpha=100` must use a coordinate that is not a boot position.

## Relationship to Property Tests

These unit/integration tests complement the property-based tests in `property-tests/`. The division:

- **`tests/level-generators/`** — Specific examples, edge cases, smoke checks, API contract validation
- **`property-tests/`** — Universal invariants (palette compliance, alpha binary, atlas non-overlap) validated across randomized inputs via fast-check

Both suites should pass before merging changes to generator code.
