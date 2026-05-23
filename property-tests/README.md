# Property-Based Tests

Property-based tests validate universal correctness invariants across the entire enhanced sprite pipeline. They use [fast-check](https://github.com/dubzzz/fast-check) to generate hundreds of random inputs and assert that every output satisfies a formal property — not just a handful of hand-picked examples.

Run with:

```bash
npm run test:properties
# or a single file:
node --test property-tests/pixel-alignment.property.js
```

---

## Properties Index

| File | Property | Requirement(s) | What it checks |
|------|----------|----------------|----------------|
| `palette-compliance.property.js` | P2: Palette Quantization Exactness | 10.2, 10.5 | Every non-transparent pixel in a quantized buffer exactly matches a palette entry (zero Euclidean distance) |
| `alpha-binary.property.js` | P3: Binary Alpha Invariant | 10.5 | All pixels are either fully opaque (α = 255) or fully transparent (α = 0) — no partial alpha |
| `water-frames.property.js` | P5: Water Animation Frame Difference | 1.3 | Each consecutive water frame pair differs in at least 10% of non-transparent pixels |
| `flag-frames.property.js` | P5 (flag variant) | 1.3 | Each consecutive flag frame pair differs in at least 10% of non-transparent pixels |
| `atlas-packing.property.js` | P10: Atlas Non-Overlapping Packing | 4.1 | No two sprite frames share any pixel coordinate in the packed atlas |
| `atlas-metadata.property.js` | P11: Atlas Metadata Completeness | 4.2 | Every packed sprite has a metadata entry with `name`, `x`, `y`, `width`, `height` fields of the correct types |
| `atlas-dimensions.property.js` | P12: Atlas Power-of-Two Dimensions | 4.3 | All atlas images use power-of-two dimensions (256, 512, 1024, or 2048) and every frame fits within bounds |
| `pixel-alignment.property.js` | P13: Integer Pixel Alignment | 5.2 | `drawSprite` floors any fractional x/y input to an integer before passing it to the underlying renderer — prevents sub-pixel blur on pixel art |
| `animation-timing.property.js` | P14: Animation Frame Rate Independence | 5.3, 7.5 | Frames advance at the configured interval regardless of render rate; all sprites of the same type share the same frame index at any instant; out-of-range intervals are clamped, not rejected |
| `enemy-palette.property.js` | P15: Enemy Palette Separation | 8.1, 8.2 | Enemy palette shares no more than 2 colors with the player unit palette |
| `enemy-silhouette.property.js` | P16: Enemy Silhouette Differentiation | 8.1, 8.2 | Each enemy unit type has a visually distinct silhouette from every other type |
| `damaged-area.property.js` | P17: Damaged Sprite Minimum Damage Area | 9.2 | Each damaged castle variant replaces at least 15% of the stone block area with cracks, missing blocks, or rubble |
| `draw-call-batching.property.js` | P18: Draw Call Batching Bound | 7.4 | `trackDrawCall` returns `false` once the 10-call budget is exceeded for a layer; each layer is tracked independently; `resetDrawCallCounters` resets all layers to zero |
| `dithering-palette.property.js` | P19: Terrain Transition Dithering Palette Compliance | 1.5 | Dithered transition edges use only palette colors — no intermediate computed colors |
| `sprite-dimensions.property.js` | P1: Sprite Dimension Invariant | 1.1 | All terrain sprites are 64×32 px; all unit sprites are 32×32 px |
| `grass-uniqueness.property.js` | P4: Grass Noise Uniqueness | 1.2 | Grass tiles generated with different seeds produce distinct pixel patterns |
| `directional-lighting.property.js` | P6: Directional Lighting Consistency | 1.1, 1.6 | Upper-left highlight pixels are ≥20% brighter than the base; lower-right shadow pixels are ≥20% darker |
| `castle-border.property.js` | P7: Castle Outline Border | 2.4 | Every outer-perimeter pixel of a castle sprite that borders a transparent pixel is set to `BORDER_COLOR` |
| `silhouette-uniqueness.property.js` | P8: Unit Silhouette Uniqueness | 3.1, 3.2 | Each player unit type has a distinct silhouette from every other type |
| `weapon-area.property.js` | P9: Unit Weapon Minimum Area | 3.5 | Each unit sprite contains a weapon/held-item element of at least 4×4 pixels |
| `tilehash-bias.property.js` | — | — | Documents the known tileHash bias (output stuck in [0, ~0.5)) so the limitation is visible in the test suite |

---

## How the Tests Work

Each test file:

1. **Defines a property** — a boolean predicate that must hold for all valid inputs.
2. **Uses `fc.property` or `fc.asyncProperty`** to generate random inputs via fast-check arbitraries.
3. **Asserts the predicate** using Node.js built-in `assert` — no extra assertion library needed.
4. **Runs 100 times by default** (`numRuns: 100`); async tests that involve real timers use fewer runs.

### Module isolation

Tests that exercise `pixi-renderer.js` or `animation-controller.js` load a **fresh module instance** per property run by deleting the entry from `require.cache` before each `require()`. This prevents state leakage between runs without needing a full process restart.

```js
function freshPixiRenderer() {
    const modulePath = require.resolve('../js/game-logic/pixi-renderer');
    delete require.cache[modulePath];
    return require('../js/game-logic/pixi-renderer');
}
```

The `_reset()` export on `pixi-renderer` provides an additional in-process reset that clears renderer type, texture map, atlas flag, and draw-call counters — used alongside cache-busting for belt-and-suspenders isolation.

### Shared setup

`setup.property.js` contains shared helpers and arbitraries imported by multiple test files (e.g., palette arbitraries, buffer generators).

---

## Adding a New Property Test

1. Create `property-tests/<descriptive-name>.property.js`.
2. Add the JSDoc header with the property number, description, and requirement references.
3. Export nothing — the file is run directly by `node --test`.
4. Add an entry to the table above.
5. Verify it runs: `node --test property-tests/<descriptive-name>.property.js`
