# Implementation Plan: Tree Overlay System

## Overview

Implement two-pass tree rendering by separating the grass base and tree canopy into independent layers. The work flows through four areas: sprite generation (new transparent-background overlay sprites), sprite constants (new registry), level loader (O/P/S tiles gain an `overlay` field), and the renderer (`drawTerrain` draws ground then overlay). Existing `tree-1` through `tree-7` sprites and all other tile types are untouched.

## Tasks

- [x] 1. Add `TREE_OVERLAY_SPRITES` registry to sprite constants
  - Add a `TREE_OVERLAY_SPRITES` export to `js/level-generators/lib/sprite-constants.js` with the seven canonical overlay sprite names: `tree-oak-overlay-1`, `tree-oak-overlay-2`, `tree-oak-overlay-3`, `tree-pine-overlay-1`, `tree-pine-overlay-2`, `tree-shrub-overlay-1`, `tree-shrub-overlay-2`
  - Retain all existing `TERRAIN_SPRITES` entries unchanged
  - Export `TREE_OVERLAY_SPRITES` alongside the existing exports
  - _Requirements: 2.1, 6.1_

- [x] 2. Register overlay sprites in SpriteManager
  - [x] 2.1 Append the seven overlay sprite names to `SpriteManager.spriteList` in `js/game-logic/sprites.js`
    - Add them in a clearly commented block after the existing tree entries
    - Retain `tree-1` through `tree-7` in the list
    - _Requirements: 2.2, 6.2_

  - [ ]* 2.2 Write unit tests for SpriteManager overlay registration
    - Assert `SpriteManager.spriteList` contains all seven overlay names
    - Assert `tree-1` through `tree-7` are still present
    - _Requirements: 2.2, 6.2_

- [x] 3. Implement tree overlay sprite generator
  - [x] 3.1 Add `OVERLAY_WIDTH` and `OVERLAY_HEIGHT` constants and `createOverlayBuffer()` helper to `js/level-generators/generate-iso-sprites-br-tl.js`
    - `OVERLAY_WIDTH = 64`, `OVERLAY_HEIGHT = 48`
    - `createOverlayBuffer()` allocates a `64×48×4` byte buffer initialized to all zeros (fully transparent)
    - _Requirements: 1.3_

  - [x] 3.2 Implement `generateTreeOverlay(variant, treeType, noiseGen)` function
    - Start from an all-transparent buffer (alpha=0 everywhere)
    - Draw trunk and canopy pixels with alpha=255 using the same palette colors and layered-canopy technique as `generateTree`
    - Differentiate canopy shapes: oak (rounded ellipse, canopy radius 11–13 px), pine (pointed/conical stacked rings, radius 8–10 px), shrub (low wide flat ellipse, radius 6–8 px)
    - Apply palette quantization as the final pass
    - _Requirements: 1.2, 1.4, 1.5_

  - [x] 3.3 Wire overlay generation into `generateAll()` in `generate-iso-sprites-br-tl.js`
    - Add entries for all seven overlay sprites using `generateTreeOverlay` with the appropriate variant and treeType arguments
    - Write each as a 64×48 PNG to `OUTPUT_DIR`
    - _Requirements: 1.1, 1.3_

  - [x] 3.4 Write property test for transparent background invariant
    - **Property 1: Transparent background invariant**
    - For each of the 7 generated overlay buffers, use fast-check to generate random (x, y) coordinates within the 64×48 canvas; for any coordinate outside the drawn tree region (alpha=0 in the reference buffer), assert alpha=0
    - Tag: `// Feature: tree-overlay-system, Property 1: Transparent background invariant`
    - File: `property-tests/tree-overlay-transparent.property.js`
    - **Validates: Requirements 1.2**

  - [x] 3.5 Write property test for palette fidelity of overlay pixels
    - **Property 2: Palette fidelity of overlay pixels**
    - For each generated overlay buffer, use fast-check to generate random pixel indices; for any pixel with alpha=255, assert its RGB values are within ±15 per channel of at least one color in `PRIMARY_PALETTE`
    - Tag: `// Feature: tree-overlay-system, Property 2: Palette fidelity of overlay pixels`
    - File: `property-tests/tree-overlay-palette.property.js`
    - **Validates: Requirements 1.4**

  - [x] 3.6 Write unit tests for overlay sprite generator
    - Assert generated overlay buffers have dimensions 64×48
    - Assert oak, pine, and shrub buffers are not byte-for-byte identical
    - _Requirements: 1.1, 1.3, 1.5_

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Update level loader for O/P/S tile objects
  - [ ] 5.1 Update the `O`, `P`, and `S` switch cases in `LevelLoader.parseLevelText` in `js/game-logic/level-loader.js`
    - Import `TREE_OVERLAY_SPRITES` from `sprite-constants.js` (or inline the values if the browser environment prevents the import)
    - `O` → `{ sprite: 'grass-short-1' or 'grass-short-2', overlay: one of treeOakOverlay1/2/3 }` selected by `tileHash`
    - `P` → `{ sprite: 'grass-short-1' or 'grass-short-2', overlay: one of treePineOverlay1/2 }` selected by `tileHash`
    - `S` → `{ sprite: 'grass-short-1' or 'grass-short-2', overlay: one of treeShrubOverlay1/2 }` selected by `tileHash`
    - Do not modify `tileHash` or any other switch cases
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.2 Write property test for tree tile ground+overlay fields
    - **Property 3: Tree tile produces ground and overlay fields**
    - Use fast-check to generate arbitrary (row, col) integer pairs; for each tree character (O, P, S), parse a minimal level string and assert the resulting tile has `sprite` ∈ `{grass-short-1, grass-short-2}` and `overlay` ∈ `Object.values(TREE_OVERLAY_SPRITES)`
    - Tag: `// Feature: tree-overlay-system, Property 3: Tree tile produces ground and overlay fields`
    - File: `property-tests/tree-overlay-level-loader.property.js`
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 5.3 Write property test for non-tree tile has no overlay field
    - **Property 4: Non-tree tile has no overlay field**
    - Use fast-check to generate arbitrary (row, col) pairs and arbitrary non-tree characters (`.`, `,`, `R`, `D`, `~`, `=`, castle chars); assert the resulting tile has no `overlay` property
    - Tag: `// Feature: tree-overlay-system, Property 4: Non-tree tile has no overlay field`
    - File: `property-tests/tree-overlay-level-loader.property.js` (same file as 5.2)
    - **Validates: Requirements 3.4, 6.4**

  - [ ]* 5.4 Write unit tests for level loader tree tile changes
    - Assert O, P, S tiles each have a `sprite` starting with `grass-short-` and an `overlay` matching the expected overlay name pattern
    - Assert all other tile characters produce tiles with no `overlay` field
    - Assert `tileHash` returns the same values as before for fixed inputs
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 6. Implement two-pass rendering in IsoRenderer
  - [ ] 6.1 Add `TREE_OVERLAY_OFFSET_Y`, `OVERLAY_WIDTH`, and `OVERLAY_HEIGHT` constants at the top of `js/game-logic/lib/iso-renderer.js`
    - `TREE_OVERLAY_OFFSET_Y = 0`, `OVERLAY_WIDTH = 64`, `OVERLAY_HEIGHT = 48`
    - _Requirements: 5.1_

  - [ ] 6.2 Update `IsoRenderer.drawTerrain` to perform two-pass rendering
    - Always draw `tile.sprite` at standard tile dimensions (`camera.tileW × camera.tileH`) as the ground pass
    - When `tile.overlay` is present, draw the overlay sprite at native dimensions (`OVERLAY_WIDTH × OVERLAY_HEIGHT`) using the positioning formula: `overlayX = tileCenterX - OVERLAY_WIDTH / 2`, `overlayY = tileTopY - (OVERLAY_HEIGHT - camera.tileH) + TREE_OVERLAY_OFFSET_Y`
    - Draw hover/select diamond outlines after both sprite draw calls
    - When `tile.overlay` is absent, use the existing single-sprite code path unchanged
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 6.4_

  - [ ]* 6.3 Write property test for overlay draw sequence and dimensions
    - **Property 5: Overlay draw sequence and dimensions**
    - Use fast-check to generate arbitrary tile objects with an `overlay` field and arbitrary camera configurations; mock `SpriteManager.draw` and assert: (a) the first call uses `tile.sprite`, (b) the second call uses `tile.overlay` with `OVERLAY_WIDTH × OVERLAY_HEIGHT` dimensions
    - Tag: `// Feature: tree-overlay-system, Property 5: Overlay draw sequence and dimensions`
    - File: `property-tests/tree-overlay-renderer.property.js`
    - **Validates: Requirements 4.1, 4.2, 4.5**

  - [ ]* 6.4 Write property test for diamond outline drawn after both sprites
    - **Property 6: Diamond outline drawn after both sprites**
    - Use fast-check to generate arbitrary selected/hovered tiles with overlays; mock `SpriteManager.draw` and `IsoRenderer.drawDiamondOutline`; assert `drawDiamondOutline` is called only after both `draw` calls
    - Tag: `// Feature: tree-overlay-system, Property 6: Diamond outline drawn after both sprites`
    - File: `property-tests/tree-overlay-renderer.property.js` (same file as 6.3)
    - **Validates: Requirements 4.4**

  - [ ]* 6.5 Write property test for overlay positioning formula
    - **Property 7: Overlay positioning formula**
    - Use fast-check to generate arbitrary tile screen positions and camera `tileW`/`tileH` values; assert the x and y arguments passed to `SpriteManager.draw` for the overlay match: `x = tileCenterX - OVERLAY_WIDTH / 2`, `y = tileTopY - (OVERLAY_HEIGHT - camera.tileH) + TREE_OVERLAY_OFFSET_Y`
    - Tag: `// Feature: tree-overlay-system, Property 7: Overlay positioning formula`
    - File: `property-tests/tree-overlay-renderer.property.js` (same file as 6.3)
    - **Validates: Requirements 5.2, 5.3**

  - [ ]* 6.6 Write unit tests for IsoRenderer two-pass rendering
    - Assert `TREE_OVERLAY_OFFSET_Y` is defined and is a number
    - Assert tiles without `overlay` produce exactly one `SpriteManager.draw` call
    - Assert tiles with `overlay` produce exactly two `SpriteManager.draw` calls in the correct order
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1_

- [ ] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Integrate overlay sprites into the build pipeline
  - [ ] 8.1 Add the overlay generator script to `GENERATOR_SCRIPTS` in `js/level-generators/build-sprites.js`
    - Insert `'generate-iso-sprites-br-tl.js'` invocation already covers overlay generation since `generateAll()` is updated in task 3.3; confirm no separate script entry is needed, or add one if the overlay generator is extracted to its own file
    - Import `TREE_OVERLAY_SPRITES` from `sprite-constants.js` and add the seven overlay sprite names to the sprite entries collection after terrain sprites
    - Add a pre-pack existence check that verifies all seven overlay PNGs are present in `OUTPUT_DIR` before calling `packAtlas()`; log a structured diagnostic and throw if any are missing
    - _Requirements: 1.6, 2.3, 2.4, 7.1, 7.2, 7.3_

  - [ ]* 8.2 Write unit tests for build pipeline overlay integration
    - Assert the build pipeline exits non-zero and logs a structured error when an overlay PNG is missing
    - Assert `TREE_OVERLAY_SPRITES` values are included in the sprite entries passed to `packAtlas()`
    - _Requirements: 2.3, 2.4, 7.3_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests live in `property-tests/*.property.js` and are run via `npm run test:properties`
- Unit tests live in `tests/` and are run via `npm test`
- The `tileHash` function must not be modified — its known bias is documented and intentional
- `TREE_OVERLAY_OFFSET_Y = 0` is the starting value; visual tuning can adjust it without changing the formula
- The level loader currently uses browser globals (`hexToPixel`, `HEX_WIDTH`, etc.) — the O/P/S cases must follow the same pattern rather than using Node.js `require` for `TREE_OVERLAY_SPRITES`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2"] },
    { "id": 3, "tasks": ["3.3"] },
    { "id": 4, "tasks": ["3.4", "3.5", "3.6", "5.1", "6.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "6.2"] },
    { "id": 6, "tasks": ["6.3", "6.4", "6.5", "6.6"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["8.2"] }
  ]
}
```
