# Game Logic Tests

Unit and integration tests for the runtime game modules under `js/game-logic/`. These tests use the Node.js built-in test runner (`node:test`) and validate game logic, rendering, input handling, HUD, sprite management, and level loading without requiring a browser or a live canvas.

## Running

```bash
# Run all game-logic tests
node --test tests/game-logic/**/*.spec.js

# Run a single test file
node --test tests/game-logic/sprites.spec.js

# Run lib module tests only
node --test tests/game-logic/lib/*.spec.js
```

## Test Structure

```
tests/game-logic/
├── README.md                                  # This file
│
├── animation-controller.spec.js               # AnimationController frame cycling and timers
│
├── game-iso-clicks.spec.js                    # game-iso.js click/right-click extracted logic
├── game-iso-dom-mock.spec.js                  # game-iso.js with minimal DOM mock
├── game-iso-hud-close.spec.js                 # HUD close/dismiss interactions
├── game-iso-orchestrator.spec.js              # game-iso.js orchestration helpers
├── game-iso.spec.js                           # game-iso.js core logic (extracted helpers)
│
├── game.spec.js                               # game.js (legacy 2D renderer) core logic
│
├── level-loader.spec.js                       # LevelLoader.parseLevelText — all tile chars
├── level-loader-async.spec.js                 # LevelLoader.loadLevelList() with fetch mock
├── level-loader-branches.spec.js              # parseLevelText branch coverage
├── level-loader-errors.spec.js                # Error paths and malformed input
├── level-loader-navigation.spec.js            # getDefaultLevel / level navigation helpers
├── level-loader-tilehash-bias.spec.js         # tileHash bias documentation and assertions
├── level-loader-tilehash-fix.spec.js          # tileHash determinism regression guard
│
├── pixi-renderer.spec.js                      # PixiJS renderer fallback chain and draw-call budget
│
├── sprites.spec.js                            # SpriteManager core API (hardcoded replica)
├── sprites-animated-frame.spec.js             # Animated sprite frame resolution via AnimationController
├── sprites-canvas.spec.js                     # SpriteManager.draw() canvas pixel output
├── sprites-dom-mock.spec.js                   # SpriteManager.loadAll() with loadImage mock
├── sprites-dom-mock-extended.spec.js          # SpriteManager real-module load + spriteList completeness
├── sprites-fallback.spec.js                   # Atlas load failure → individual PNG fallback
├── sprites-overlay.spec.js                    # SpriteManager.spriteList — tree overlay sprite names
│
├── unit-manager.spec.js                       # UnitManager core: parseCSV, placeUnit, canPlaceOn
├── unit-manager-custom-filename.spec.js       # loadResources() with custom filename argument
├── unit-manager-errors.spec.js                # loadResources() error paths and malformed CSV
├── unit-manager-fallback.spec.js              # loadResources() fetch failure → empty units
├── unit-manager-reset.spec.js                 # UnitManager.reset() clears placed units
│
├── utils.spec.js                              # Shared utility helpers
│
└── lib/
    ├── hud.spec.js                            # HUD module API surface
    ├── hud-actions.spec.js                    # HUD button/action interactions
    ├── hud-boundary.spec.js                   # HUD boundary and layout edge cases
    ├── hud-edge-cases.spec.js                 # HUD null/empty state handling
    ├── hud-render.spec.js                     # HUD panel render output
    ├── hud-render-methods.spec.js             # Individual HUD render method assertions
    ├── hud-sheen-border.spec.js               # drawSheenBorder gradient rendering
    ├── iso-camera.spec.js                     # IsoCamera init, scroll, zoom
    ├── iso-camera-apply-transform.spec.js     # applyTransform canvas context calls
    ├── iso-camera-bl-tr.spec.js               # BL→TR viewpoint coordinate math
    ├── iso-camera-bl-tr-extended.spec.js      # BL→TR extended edge cases
    ├── iso-camera-edge-cases.spec.js          # Camera boundary and overflow conditions
    ├── iso-camera-transform.spec.js           # gridToScreen / screenToGrid round-trips
    ├── iso-camera-viewpoints.spec.js          # toggleViewpoint and viewpoint-specific math
    ├── iso-input.spec.js                      # IsoInput key state and callback wiring
    ├── iso-input-events.spec.js               # DOM event listener integration (JSDOM-style mock)
    ├── iso-renderer.spec.js                   # IsoRenderer API surface
    ├── iso-renderer-canvas-mock.spec.js       # drawTerrain / drawUnits with mock canvas
    └── iso-renderer-render.spec.js            # Two-pass overlay rendering assertions
```

## Key Patterns

### Global stubs for browser APIs

`sprites.js`, `game-iso.js`, and related modules reference browser globals (`document`, `window`, `PIXI`, `AnimationController`, etc.) that don't exist in Node.js. Tests stub these at the top of each file before requiring the module:

```js
global.TILE_SIZE = 32;
global.AnimationController = {
    getCurrentFrame() { return 0; },
    registerAnimatedType() {},
    reset() {},
};
global.document = {
    createElement: (_tag) => ({
        getContext: () => ({ fillRect() {}, fillText() {} }),
    }),
};
global.loadImage = async (src) => ({ src });
```

### Loading the real module vs. a replica

Some test files use a **hardcoded replica** of the module under test (e.g. `sprites.spec.js`) to isolate specific logic. Others load the **real production module** via `require()` to assert the actual file matches expectations:

```js
// Real module — reflects production state
const SPRITES_PATH = path.resolve(__dirname, '../../js/game-logic/sprites.js');
function loadFreshSpriteManager() {
    delete require.cache[SPRITES_PATH];
    return require(SPRITES_PATH);
}
```

Use the real-module pattern when the test's purpose is to guard against regressions in the production file (e.g. `sprites-overlay.spec.js`, `sprites-dom-mock-extended.spec.js`).

### Cache busting between tests

Because `sprites.js` and similar modules hold module-level state, tests that load the real module use `beforeEach`/`afterEach` to bust the require cache:

```js
beforeEach(() => { SpriteManager = loadFreshSpriteManager(); });
afterEach(() => { delete require.cache[SPRITES_PATH]; });
```

### Mocking `loadImage` for `loadAll()`

`SpriteManager.loadAll()` calls a global `loadImage` function for each sprite. Tests intercept this to record which paths were requested without touching the filesystem:

```js
const loadedNames = [];
global.loadImage = async (src) => {
    loadedNames.push(src);
    return { src };
};
await SpriteManager.loadAll();
assert.ok(loadedNames.includes('assets/sprites/tree-oak-overlay-1.png'));
```

### Canvas mock for renderer tests

`IsoRenderer` and `HUD` tests pass a mock canvas context that records draw calls:

```js
const calls = [];
const mockCtx = {
    drawImage: (...args) => calls.push({ method: 'drawImage', args }),
    fillRect: (...args) => calls.push({ method: 'fillRect', args }),
    // ...
};
```

---

## Module Coverage Summary

| Module | Primary test file(s) |
|--------|----------------------|
| `sprites.js` | `sprites.spec.js`, `sprites-dom-mock.spec.js`, `sprites-dom-mock-extended.spec.js`, `sprites-animated-frame.spec.js`, `sprites-canvas.spec.js`, `sprites-fallback.spec.js`, `sprites-overlay.spec.js` |
| `animation-controller.js` | `animation-controller.spec.js` |
| `pixi-renderer.js` | `pixi-renderer.spec.js` |
| `level-loader.js` | `level-loader.spec.js`, `level-loader-async.spec.js`, `level-loader-branches.spec.js`, `level-loader-errors.spec.js`, `level-loader-navigation.spec.js`, `level-loader-tilehash-bias.spec.js`, `level-loader-tilehash-fix.spec.js` |
| `unit-manager.js` | `unit-manager.spec.js`, `unit-manager-custom-filename.spec.js`, `unit-manager-errors.spec.js`, `unit-manager-fallback.spec.js`, `unit-manager-reset.spec.js` |
| `game-iso.js` | `game-iso.spec.js`, `game-iso-clicks.spec.js`, `game-iso-dom-mock.spec.js`, `game-iso-hud-close.spec.js`, `game-iso-orchestrator.spec.js` |
| `game.js` | `game.spec.js` |
| `lib/iso-camera.js` | `lib/iso-camera*.spec.js` (6 files) |
| `lib/iso-input.js` | `lib/iso-input.spec.js`, `lib/iso-input-events.spec.js` |
| `lib/iso-renderer.js` | `lib/iso-renderer*.spec.js` (3 files) |
| `lib/hud.js` | `lib/hud*.spec.js` (6 files) |

---

## Tree Overlay Sprite Tests (`sprites-overlay.spec.js`)

Added as part of the **tree-overlay-system** spec (task 2.2). This file loads the real `sprites.js` module and asserts:

- All seven overlay sprite names are present in `SpriteManager.spriteList`:
  `tree-oak-overlay-1/2/3`, `tree-pine-overlay-1/2`, `tree-shrub-overlay-1/2`
- Exactly 7 overlay entries exist (no extras, no duplicates)
- Legacy `tree-1` through `tree-7` are still present (backward compatibility)
- Overlay names appear after `tree-7` in the list (ordering convention)
- No duplicate entries exist anywhere in `spriteList`
- `loadAll()` attempts to load each overlay sprite PNG from `assets/sprites/`

This test guards against regressions when `spriteList` is modified and ensures the overlay sprites are always loadable at runtime.

---

## Relationship to Property Tests

These unit tests complement the property-based tests in `property-tests/`. The division:

- **`tests/game-logic/`** — Specific examples, edge cases, API contract validation, regression guards
- **`property-tests/`** — Universal invariants validated across randomized inputs via fast-check (e.g. pixel alignment, draw-call batching bounds, animation frame rate independence)

Both suites should pass before merging changes to game-logic code.
