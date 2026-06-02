# Implementation Plan: Castle Structure Overlays

## Overview

Extend the existing tree overlay pipeline to support 2.5D rendering for castle and bridge structures. The work flows through five areas: sprite constants (new `CASTLE_OVERLAY_SPRITES` registry), sprite generator (new `generateCastleOverlay` function and helpers), a standalone generator script, a new `overlay-utils.js` utility module that owns the overlay allowlist, level loader (11 castle/bridge switch cases gain an `overlay` field; existing b/m/g bug fixed), and the renderer (`drawTerrain` delegates to `resolveOverlayDraw` with per-structure height/offset constants). All 18 overlay sprites (11 undamaged + 7 damaged) are wired into the build pipeline. Property-based tests are grouped at the end as their own tasks once all implementation is complete.

## Tasks

- [x] 1. Add `CASTLE_OVERLAY_SPRITES` registry to sprite constants
  - Add a `CASTLE_OVERLAY_SPRITES` export to `js/level-generators/lib/sprite-constants.js` with all 18 canonical overlay sprite names (see design.md §2 for the full key→value table)
  - Retain all existing `CASTLE_SPRITES` and `TERRAIN_SPRITES` entries unchanged
  - Export `CASTLE_OVERLAY_SPRITES` alongside the existing exports
  - _Requirements: 2.1, 7.2, 8.1_

- [x] 2. Register overlay sprites in SpriteManager
  - [x] 2.1 Append the 18 castle overlay sprite names to `SpriteManager.spriteList` in `js/game-logic/sprites.js`
    - Add them in a clearly commented block after the existing damaged castle entries (walls/bridges 64×48, towers/keeps 64×64, gatehouse 64×80)
    - Retain all existing flat castle sprite names in the list
    - _Requirements: 2.2, 7.3, 8.2_

  - [x] 2.2 Write unit tests for SpriteManager castle overlay registration
    - Depends on: task 2.1
    - Assert `SpriteManager.spriteList` contains all 18 castle overlay sprite names
    - Assert all existing flat castle sprite names are still present
    - _Requirements: 2.2, 7.3, 8.2_

- [x] 3. Add generator buffer helpers to sprite generator
  - [x] 3.1 Add `createCastleOverlayBuffer(width, height)` and `setCastleOverlayPixel(buffer, width, x, y, r, g, b)` helpers to `js/level-generators/generate-iso-sprites-br-tl.js`
    - `createCastleOverlayBuffer` returns a `width×height×4` byte buffer initialized to all zeros (fully transparent)
    - `setCastleOverlayPixel` writes one fully opaque pixel; silently ignores out-of-bounds coordinates
    - _Requirements: 1.2, 1.8_

  - [x] 3.2 Write unit tests for generator buffer helpers
    - Depends on: task 3.1
    - Assert `createCastleOverlayBuffer(64, 48)` returns a buffer of length `64×48×4` filled with zeros
    - Assert `setCastleOverlayPixel` writes the correct RGBA bytes at the given (x, y) position
    - Assert `setCastleOverlayPixel` silently ignores coordinates outside the canvas bounds
    - _Requirements: 1.2, 1.8_

- [x] 4. Implement `generateCastleOverlay` sprite generator
  - [x] 4.1 Implement `generateCastleOverlay(structureType, damaged)` in `js/level-generators/generate-iso-sprites-br-tl.js`
    - Depends on: task 3.1
    - Allocate a buffer via `createCastleOverlayBuffer` at the correct canvas height for the structure category (wall/bridge: 48 px, tower/keep: 64 px, gatehouse: 80 px)
    - Draw only the structure's vertical body (walls, battlements, arch, portcullis, planks) using `CASTLE_COLORS` palette values; leave all ground-diamond pixels at alpha=0
    - Apply `quantizeToPalette` with `getPaletteForCategory('castle')` as the final pass
    - Damaged variants use increased `CASTLE_COLORS.wallDark`/`towerDark` coverage and reduced highlight pixels
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 7.1_

  - [x] 4.2 Write unit tests for generator buffer dimensions and variant distinctness
    - Depends on: task 4.1
    - Assert each generated buffer has the correct byte length for its canvas dimensions (wall/bridge: 64×48×4, tower/keep: 64×64×4, gatehouse: 64×80×4)
    - Assert undamaged and damaged variants of the same structure type are not byte-for-byte identical
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 5. Create `generate-castle-overlay-sprites.js` generator script
  - Depends on: task 4.1
  - Create `js/level-generators/generate-castle-overlay-sprites.js` as a standalone script
  - Call `generateCastleOverlay(structureType, damaged)` for each of the 18 sprites and write PNGs to `OUTPUT_DIR`
  - Follow the same pattern as the existing generator scripts in that directory
  - _Requirements: 1.9, 9.1_

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create `overlay-utils.js` utility module
  - [x] 7.1 Create `js/game-logic/lib/overlay-utils.js` with `resolveOverlayDraw(tile, ctx, x, y, camera)`
    - Depends on: task 1 (for `CASTLE_OVERLAY_SPRITES` names), task 4.1 (for `CASTLE_OVERLAY_CATEGORY_MAP` shape)
    - Return `null` if `!tile.overlay` (no overlay — caller passes through)
    - For `tree-*` overlays: return a zero-arg draw closure using `OVERLAY_HEIGHT=48` and `TREE_OVERLAY_OFFSET_Y`
    - For `castle-*` / `bridge-*` overlays: look up `{ height, offsetY }` from `CASTLE_OVERLAY_CATEGORY_MAP`; return a zero-arg draw closure using the per-structure constants; throw `Error` (after `console.error`) if the name matches the prefix but is not in the map
    - For any other overlay name not on the allowlist: `console.error` and throw `Error`
    - Export `{ resolveOverlayDraw }`
    - _Requirements: 4.3, 4.4, 5.1, 5.2, 5.3, 5.5, 6.1, 6.2_

  - [x] 7.2 Write unit tests for `resolveOverlayDraw`
    - Depends on: task 7.1
    - Assert returns `null` for a tile with no `overlay` field
    - Assert returns a function for a tile with a valid `tree-*` overlay name
    - Assert returns a function for a tile with a valid `castle-*` overlay name registered in `CASTLE_OVERLAY_CATEGORY_MAP`
    - Assert throws for an overlay name not on the allowlist (not `tree-`, `castle-`, or `bridge-`)
    - Assert throws for a `castle-*` name that matches the prefix but is not registered in `CASTLE_OVERLAY_CATEGORY_MAP`
    - _Requirements: 4.3, 4.4, 5.1, 5.2, 5.3_

- [x] 8. Update level loader for castle and bridge tile objects
  - [x] 8.1 Update the 11 castle/bridge switch cases in `LevelLoader.parseLevelText` in `js/game-logic/level-loader.js`
    - `=` → `{ sprite: 'bridge-mm', overlay: 'bridge-mm-overlay' }`
    - `b` → `{ sprite: 'castle-bridge-start', overlay: 'castle-bridge-start-overlay' }` (fixes existing bug: was mapping to `castle-bridge-mid`)
    - `m` → `{ sprite: 'castle-bridge-mid', overlay: 'castle-bridge-mid-overlay' }` (fixes existing bug)
    - `g` → `{ sprite: 'castle-bridge-gate', overlay: 'castle-bridge-gate-overlay' }` (fixes existing bug)
    - `T` → `{ sprite: 'castle-tower', overlay: 'castle-tower-overlay' }`
    - `K` → `{ sprite: 'castle-keep-tl', overlay: 'castle-keep-tl-overlay' }`
    - `j` → `{ sprite: 'castle-keep-bl', overlay: 'castle-keep-bl-overlay' }`
    - `J` → `{ sprite: 'castle-keep-br', overlay: 'castle-keep-br-overlay' }`
    - `F` → `{ sprite: 'castle-keep-center', overlay: 'castle-keep-center-overlay' }`
    - `G` → `{ sprite: 'castle-gatehouse', overlay: 'castle-gatehouse-overlay' }`
    - `W` → `{ sprite: 'castle-wall', overlay: 'castle-wall-overlay' }`
    - Update `C` (bailey) case to explicitly omit the `overlay` field (not present, not `undefined`, not `null`)
    - Do not modify `tileHash` or any other switch cases
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 8.5_

  - [x] 8.2 Write unit tests for level loader castle tile changes
    - Depends on: task 8.1
    - Assert each of the 11 castle/bridge characters produces a tile with the correct `sprite` and `overlay` values
    - Assert `b`, `m`, `g` now map to their correct distinct sprites (not all `castle-bridge-mid`)
    - Assert `C` produces a tile with no `overlay` field (field must be absent, not `undefined` or `null`)
    - Assert `tileHash` returns the same values as before for fixed inputs
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Update IsoRenderer with castle overlay constants and `CASTLE_OVERLAY_CATEGORY_MAP`
  - [x] 10.1 Add 5 height constants, 5 offset constants, and `CASTLE_OVERLAY_CATEGORY_MAP` to `js/game-logic/lib/iso-renderer.js`
    - `WALL_OVERLAY_HEIGHT = 48`, `BRIDGE_OVERLAY_HEIGHT = 48`, `TOWER_OVERLAY_HEIGHT = 64`, `KEEP_OVERLAY_HEIGHT = 64`, `GATEHOUSE_OVERLAY_HEIGHT = 80`
    - `WALL_OVERLAY_OFFSET_Y = 0`, `BRIDGE_OVERLAY_OFFSET_Y = 0`, `TOWER_OVERLAY_OFFSET_Y = 0`, `KEEP_OVERLAY_OFFSET_Y = 0`, `GATEHOUSE_OVERLAY_OFFSET_Y = 0`
    - Add `CASTLE_OVERLAY_CATEGORY_MAP` mapping all 18 castle/bridge overlay sprite names to their `{ height, offsetY }` constants (see design.md §5 for the full map)
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 10.2 Update `IsoRenderer.drawTerrain` to call `resolveOverlayDraw` from `overlay-utils.js`
    - Depends on: tasks 10.1 and 7.1
    - Import `resolveOverlayDraw` from `js/game-logic/lib/overlay-utils.js`
    - Replace the existing inline overlay draw block with:
      ```js
      const drawOverlay = resolveOverlayDraw(tile, ctx, x, y, camera);
      if (drawOverlay) drawOverlay();
      ```
    - Draw hover/select diamond outlines after both sprite draw calls (unchanged behavior)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 8.4_

  - [x] 10.3 Write unit tests for IsoRenderer castle overlay rendering
    - Depends on: tasks 10.1 and 10.2
    - Assert all 5 height constants and 5 offset constants are defined and are numbers
    - Assert `CASTLE_OVERLAY_CATEGORY_MAP` contains entries for all 18 castle/bridge overlay sprite names
    - Assert tiles without `overlay` produce exactly one `SpriteManager.draw` call
    - Assert tiles with a castle `overlay` produce exactly two `SpriteManager.draw` calls in the correct order
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 11. Integrate castle overlay sprites into the build pipeline
  - [x] 11.1 Update `js/level-generators/build-sprites.js` to include the castle overlay generator and sprites
    - Depends on: tasks 1 and 5
    - Add `generate-castle-overlay-sprites.js` to `GENERATOR_SCRIPTS` after `generate-damaged-castle-sprites.js`
    - Import `CASTLE_OVERLAY_SPRITES` from `sprite-constants.js` and derive `CASTLE_OVERLAY_SPRITE_NAMES = Object.values(CASTLE_OVERLAY_SPRITES)`
    - Add a guard: if `CASTLE_OVERLAY_SPRITES` is undefined or has zero entries, log to stderr and exit non-zero before generating or packing any sprites
    - Collect the 18 castle overlay sprite buffers in the sprite-collection step after the damaged castle sprites block
    - Add a pre-pack existence check: for each name in `CASTLE_OVERLAY_SPRITE_NAMES`, verify the PNG exists in `OUTPUT_DIR`; if any are missing, log each missing file name to stderr and throw (exit non-zero)
    - _Requirements: 2.3, 2.4, 2.5, 9.1, 9.2, 9.3, 9.4_

  - [x] 11.2 Write unit tests for build pipeline castle overlay integration
    - Depends on: task 11.1
    - Assert the build pipeline exits non-zero and logs a structured error when a castle overlay PNG is missing
    - Assert the build pipeline exits non-zero and logs an error when `CASTLE_OVERLAY_SPRITES` is undefined or empty
    - Assert `CASTLE_OVERLAY_SPRITE_NAMES` values are included in the sprite entries passed to `packAtlas()`
    - _Requirements: 2.3, 2.4, 2.5, 9.3_

- [x] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Property tests — sprite generator invariants
  - Depends on: tasks 4.1 and 5 (all 18 overlay buffers must be generatable)
  - [x] 13.1 Write property test for transparent background invariant
    - **Property 1: Transparent background invariant**
    - For each of the 18 generated castle overlay buffers, use fast-check to generate random (x, y) coordinates within the canvas bounds; for any coordinate outside the drawn structure's vertical body (alpha=0 in the reference buffer), assert alpha=0
    - Tag: `// Feature: castle-structure-overlays, Property 1: Transparent background invariant`
    - File: `property-tests/castle-overlay-transparent.property.js`
    - _Requirements: 10.1_

  - [x] 13.2 Write property test for palette fidelity of overlay pixels
    - **Property 2: Palette fidelity of overlay pixels**
    - For each generated castle overlay buffer, use fast-check to generate random pixel indices; for any pixel with alpha > 0, assert its RGB values are within ±15 per channel of at least one color in `getPaletteForCategory('castle')` (i.e. `PRIMARY_PALETTE + CASTLE_ACCENT_COLORS`, which includes `BORDER_COLOR`)
    - Tag: `// Feature: castle-structure-overlays, Property 2: Palette fidelity of overlay pixels`
    - File: `property-tests/castle-overlay-palette.property.js`
    - _Requirements: 10.2_

- [x] 14. Property tests — level loader invariants
  - Depends on: task 8.1 (all 11 castle/bridge cases updated)
  - [x] 14.1 Write property test for castle tile ground+overlay fields
    - **Property 3: Castle tile produces ground and overlay fields**
    - Use fast-check to generate arbitrary non-negative integer (row, col) pairs; for each castle/bridge character (`=`, `b`, `m`, `g`, `T`, `K`, `j`, `J`, `F`, `G`, `W`), parse a minimal level string and assert the resulting tile has `sprite` ∈ `Object.values(CASTLE_SPRITES)` and `overlay` ∈ `Object.values(CASTLE_OVERLAY_SPRITES)`
    - Tag: `// Feature: castle-structure-overlays, Property 3: Castle tile produces ground and overlay fields`
    - File: `property-tests/castle-overlay-level-loader.property.js`
    - _Requirements: 10.3_

  - [x] 14.2 Write property test for non-overlay tile has no overlay field
    - **Property 4: Non-overlay tile has no overlay field**
    - Use fast-check to generate arbitrary non-negative integer (row, col) pairs and arbitrary non-overlay characters (`.`, `,`, `R`, `D`, `~`, `C`); assert the resulting tile does NOT have an `overlay` field (not present, not `undefined`, not `null`, not empty string)
    - Note: `O`, `P`, `S` are NOT in this set — they produce tree overlays via the existing tree-overlay-system
    - Tag: `// Feature: castle-structure-overlays, Property 4: Non-overlay tile has no overlay field`
    - File: `property-tests/castle-overlay-level-loader.property.js` (same file as 14.1)
    - _Requirements: 10.4_

- [x] 15. Property tests — renderer invariants
  - Depends on: tasks 10.1 and 10.2 (constants, map, and drawTerrain update all complete)
  - [x] 15.1 Write property test for overlay draw sequence invariant
    - **Property 5: Overlay draw sequence invariant**
    - Use fast-check to generate arbitrary tile objects with a castle `overlay` field and arbitrary camera configurations with `tileW`/`tileH` in [1, 256]; mock `SpriteManager.draw` and assert the first call uses `tile.sprite` and the second call uses `tile.overlay`
    - Tag: `// Feature: castle-structure-overlays, Property 5: Overlay draw sequence invariant`
    - File: `property-tests/castle-overlay-renderer.property.js`
    - _Requirements: 10.5_

  - [x] 15.2 Write property test for overlay dimensions invariant
    - **Property 6: Overlay dimensions invariant**
    - Use fast-check to generate arbitrary tile objects covering all 18 castle overlay sprite names and arbitrary camera configurations; mock `SpriteManager.draw` and assert the overlay draw call passes `OVERLAY_WIDTH` (64) and the correct per-structure height constant (48, 64, or 80) — not `camera.tileW` or `camera.tileH`
    - Tag: `// Feature: castle-structure-overlays, Property 6: Overlay dimensions invariant`
    - File: `property-tests/castle-overlay-renderer.property.js` (same file as 15.1)
    - _Requirements: 10.6_

  - [x] 15.3 Write property test for overlay positioning formula invariant
    - **Property 7: Overlay positioning formula invariant**
    - Use fast-check to generate arbitrary tile screen positions and camera `tileW`/`tileH` values in [1, 256]; mock `SpriteManager.draw` and assert the overlay draw call uses X = `tileCenterX - 32` and Y = `tileTopY - (overlayHeight - camera.tileH) + overlayOffsetY` where `tileTopY = y - camera.tileH / 2` and `overlayHeight`/`overlayOffsetY` come from `CASTLE_OVERLAY_CATEGORY_MAP`
    - Tag: `// Feature: castle-structure-overlays, Property 7: Overlay positioning formula invariant`
    - File: `property-tests/castle-overlay-renderer.property.js` (same file as 15.1)
    - _Requirements: 10.7_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Property tests live in `property-tests/*.property.js` and are run via `npm run test:properties`
- Unit tests live in `tests/` and are run via `npm test`
- The `tileHash` function must not be modified — its known bias is documented and intentional
- The level loader uses browser globals — castle overlay sprite name values must be inlined or accessed via a pattern compatible with the browser environment (same constraint as the tree overlay system)
- `overlay-utils.js` imports `CASTLE_OVERLAY_CATEGORY_MAP` from `iso-renderer.js`; if a circular dependency arises, extract the map to a shared constants file
- All `*_OVERLAY_OFFSET_Y` constants start at 0 and are tunable post-implementation for visual alignment without changing the formula
- The bailey tile (`C`) explicitly omits the `overlay` field — it is a ground-level surface with no vertical structure
- `O`, `P`, `S` (tree characters) are handled by the existing tree-overlay-system and are NOT modified by this spec

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "5"] },
    { "id": 4, "tasks": ["7.1", "8.1"] },
    { "id": 5, "tasks": ["7.2", "8.2", "10.1"] },
    { "id": 6, "tasks": ["10.2", "10.3"] },
    { "id": 7, "tasks": ["11.1"] },
    { "id": 8, "tasks": ["11.2"] },
    { "id": 9, "tasks": ["13.1", "13.2", "14.1", "14.2"] },
    { "id": 10, "tasks": ["15.1", "15.2", "15.3"] }
  ]
}
```
