# Implementation Plan: Enhanced Pixel Art Sprites

## Overview

This plan implements the enhanced pixel art sprite pipeline for BasicTowerDefense in two phases: build-time sprite generation modules (noise, shading, dithering, palette quantization, atlas packing, animation frames, enemy sprites, damaged castle sprites) and runtime rendering integration (PixiJS renderer with fallback chain, animation controller, SpriteManager modifications). Each task builds incrementally on the previous, wiring everything together at the end.

## Tasks

- [x] 1. Set up project dependencies and shared constants
  - [x] 1.1 Add new dependencies to package.json and set up test framework
    - Add `simplex-noise`, `fast-check`, and `pixi.js` to package.json with pinned versions
    - Add a `test:properties` script for running property-based tests from `property-tests/`
    - Create `property-tests/` directory structure at project root
    - Ensure unit tests continue to live in `tests/` mirroring source structure
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.8_

  - [x] 1.2 Define primary palette, enemy palette, and sprite constants
    - Create `js/level-generators/lib/palette.js` with PRIMARY_PALETTE (16 colors), ENEMY_PALETTE (8 colors), CASTLE_COLORS extensions (max 4 accent colors), and BORDER_COLOR
    - Export `getPaletteForCategory(category)` function returning combined palette arrays
    - Define ANIMATION_CONFIG for water and flag frame counts/intervals
    - _Requirements: 10.1, 8.1, 2.5, 10.4_

- [x] 2. Implement core build-time library modules
  - [x] 2.1 Implement noise-texture module
    - Create `js/level-generators/lib/noise-texture.js`
    - Implement `terrainNoise(x, y, scale, seed)` wrapping simplex-noise
    - Ensure deterministic output for same seed values
    - _Requirements: 1.2, 6.1_

  - [x] 2.2 Implement shading module
    - Create `js/level-generators/lib/shading.js`
    - Implement `applyDirectionalShading(buffer, width, height, highlightPercent, shadowPercent)` with upper-left light source
    - Implement `applyFaceShading(buffer, width, height, topColor, sideColor)` for isometric face lighting
    - Implement `applyShadowEdge(buffer, width, height)` for 1-pixel bottom-right shadow
    - _Requirements: 1.1, 3.3, 10.4_

  - [x] 2.3 Implement dithering module
    - Create `js/level-generators/lib/dithering.js`
    - Implement `applyOrderedDithering(buffer, width, height, colorA, colorB, borderWidth, edge)` using 4×4 Bayer matrix
    - Ensure output uses only palette colors (no intermediate computed colors)
    - _Requirements: 1.5_

  - [x] 2.4 Implement palette-quantizer module
    - Create `js/level-generators/lib/palette-quantizer.js`
    - Implement `quantizeToPalette(buffer, palette)` using Euclidean RGB distance, modifying buffer in place
    - Skip fully transparent pixels (alpha === 0)
    - Ensure zero color distance for all non-transparent pixels post-quantization
    - Throw `Error('Quantization failed')` with pixel coordinates and color details if post-quantization validation finds out-of-palette pixels
    - _Requirements: 10.2, 10.5_

  - [x] 2.5 Write property tests for palette quantizer
    - Write to `property-tests/palette-compliance.property.js`
    - Write to `property-tests/alpha-binary.property.js`
    - **Property 2: Palette Quantization Exactness**
    - **Property 3: Binary Alpha Invariant**
    - **Validates: Requirements 10.2, 10.5**

  - [x] 2.6 Implement animation-frames module
    - Create `js/level-generators/lib/animation-frames.js`
    - Implement `generateWaterFrames(frameCount, seed)` producing 3–8 frames
    - Each consecutive frame pair must differ in at least 10% of non-transparent pixels
    - Implement `generateFlagFrames(frameCount, seed)` for castle flag animations
    - _Requirements: 1.3, 5.3_

  - [x] 2.7 Write property tests for animation frames
    - Write to `property-tests/water-frames.property.js`
    - **Property 5: Water Animation Frame Difference**
    - **Validates: Requirements 1.3**

  - [x] 2.8 Implement atlas-packer module
    - Create `js/level-generators/lib/atlas-packer.js`
    - Implement `packAtlas(sprites)` using bin-packing with 1-pixel padding between frames
    - Output power-of-two dimensions (256, 512, 1024, 2048)
    - Auto-split into multiple atlas files if exceeding 2048px in either axis
    - Generate JSON metadata with frame name, x, y, width, height, atlasIndex fields
    - Include `animations` section mapping sprite types to frame name arrays
    - Throw `Error('Invalid sprite name')` if any sprite has empty or duplicate name; log full sprite list
    - Throw `Error('Atlas metadata serialization failed')` on JSON serialization failure
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.9 Write property tests for atlas packer
    - Write to `property-tests/atlas-packing.property.js`
    - Write to `property-tests/atlas-metadata.property.js`
    - Write to `property-tests/atlas-dimensions.property.js`
    - **Property 10: Atlas Non-Overlapping Packing**
    - **Property 11: Atlas Metadata Completeness**
    - **Property 12: Atlas Power-of-Two Dimensions**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement enhanced terrain sprite generation
  - [x] 4.1 Enhance terrain sprite generators with shading and noise
    - Modify `js/level-generators/generate-iso-sprites-br-tl.js` to use noise-texture for grass variation
    - Apply `applyFaceShading` for lit top face and darker side face on all terrain tiles
    - Apply `applyShadowEdge` for 1-pixel bottom-right shadow
    - Use at least 3 distinct palette colors for grass ground detail
    - Render tree sprites with 2+ overlapping canopy layers (inner shadow, mid-tone fill, highlight rim)
    - Apply ordered dithering on terrain transition edges (4-pixel border region)
    - Run `quantizeToPalette` as final pass on all terrain buffers
    - Maintain 64×32 pixel tile dimensions
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 10.2, 10.3_

  - [x] 4.2 Write property tests for terrain sprites
    - Write to `property-tests/sprite-dimensions.property.js`
    - Write to `property-tests/grass-uniqueness.property.js`
    - Write to `property-tests/directional-lighting.property.js`
    - Write to `property-tests/dithering-palette.property.js`
    - **Property 1: Sprite Dimension Invariant** (terrain category)
    - **Property 4: Grass Noise Uniqueness**
    - **Property 6: Directional Lighting Consistency** (terrain)
    - **Property 19: Terrain Transition Dithering Palette Compliance**
    - **Validates: Requirements 1.1, 1.2, 1.5, 1.6**

- [x] 5. Implement enhanced castle sprite generation
  - [x] 5.1 Enhance castle sprite generator with detail and outlines
    - Modify `js/level-generators/generate-castle-sprites.js` to render stone block patterns (3+ horizontal courses, 1-pixel mortar lines, 2+ pixels color variation per block)
    - Add crenellation detail on tower tops (3+ alternating merlon/crenel shapes)
    - Add keep details: window slits (1×3 dark rectangles), flag element (3×5 pixels), layered stone texture
    - Apply 1-pixel dark outline (BORDER_COLOR) on all outer-perimeter pixels bordering transparent pixels
    - Use CASTLE_COLORS palette + max 4 accent colors
    - Run `quantizeToPalette` as final pass
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 5.2 Write property tests for castle sprites
    - Write to `property-tests/castle-border.property.js`
    - **Property 7: Castle Outline Border**
    - **Validates: Requirements 2.4**

- [x] 6. Implement enhanced unit sprite generation
  - [x] 6.1 Enhance unit sprite generator with silhouettes and weapons
    - Modify `js/level-generators/generate-unit-sprites.js` to produce unique silhouette shapes per unit type
    - Render weapon/held-item elements (min 4×4 pixels) specific to each unit type (sword, bow, spear, crossbow, hammer, pike, javelin, club, ramrod)
    - Apply directional lighting (upper-left highlight ≥20% brighter, lower-right shadow ≥20% darker)
    - Maintain transparent backgrounds (alpha = 0) and 32×32 native resolution
    - Ensure silhouettes remain distinguishable at 16×16 (50% scale)
    - Run `quantizeToPalette` as final pass
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 6.2 Write property tests for unit sprites
    - Write to `property-tests/silhouette-uniqueness.property.js`
    - Write to `property-tests/weapon-area.property.js`
    - **Property 8: Unit Silhouette Uniqueness**
    - **Property 9: Unit Weapon Minimum Area**
    - **Validates: Requirements 3.1, 3.2, 3.5**

- [ ] 7. Implement enemy sprite generation
  - [ ] 7.1 Create enemy sprite generator
    - Create `js/level-generators/generate-enemy-sprites.js`
    - Generate exactly 5 enemy unit types: enemy-knight, enemy-archer, enemy-spearman, enemy-militia, enemy-siege
    - Use ENEMY_PALETTE sharing no more than 2 colors with player unit palette
    - Apply at least one silhouette modifier per type (different helmet, banner, or shield emblem)
    - Maintain 64×32 tile dimensions and transparent backgrounds
    - Ensure legibility at 50% native resolution
    - Run `quantizeToPalette` with enemy palette as final pass
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7_

  - [ ] 7.2 Write property tests for enemy sprites
    - Write to `property-tests/enemy-palette.property.js`
    - Write to `property-tests/enemy-silhouette.property.js`
    - **Property 15: Enemy Palette Separation**
    - **Property 16: Enemy Silhouette Differentiation**
    - **Validates: Requirements 8.1, 8.2**

- [ ] 8. Implement damaged castle sprite generation
  - [ ] 8.1 Create damaged castle sprite generator
    - Create `js/level-generators/generate-damaged-castle-sprites.js`
    - Generate exactly 10 damaged variants: castle-wall-damaged, castle-tower-damaged, castle-keep-tl-damaged, castle-keep-bl-damaged, castle-keep-br-damaged, castle-keep-center-damaged, castle-gatehouse-damaged, castle-bailey-1-damaged, castle-bailey-2-damaged, castle-bailey-3-damaged
    - Replace at least 15% of stone block area with cracks, missing blocks, or rubble debris
    - Maintain 64×32 tile dimensions
    - Use only CASTLE_COLORS palette + permitted accent colors
    - Run `quantizeToPalette` as final pass
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 8.2 Write property tests for damaged castle sprites
    - Write to `property-tests/damaged-area.property.js`
    - **Property 17: Damaged Sprite Minimum Damage Area**
    - **Validates: Requirements 9.2**

- [ ] 9. Checkpoint - Ensure all build-time tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Wire atlas generation into build pipeline
  - [ ] 10.1 Integrate atlas packing into sprite generation script
    - Update `npm run generate:sprites` script to call all generators then pack results into atlas
    - Add `generate-enemy-sprites.js` and `generate-damaged-castle-sprites.js` to the build script chain
    - Collect all generated sprite buffers and pass to `packAtlas()`
    - Output `assets/sprites/atlas-0.png` (and additional atlas files if needed) + `assets/sprites/atlas.json`
    - Include enemy sprites with `enemy-` prefix and damaged sprites with `-damaged` suffix in metadata
    - Include animation frame sequences in the `animations` section of atlas.json
    - Verify atlas file size stays under 4MB
    - Ensure all generator errors throw and propagate non-zero exit codes to fail the build
    - Log structured diagnostics (`[SPRITE-BUILD-ERROR] module: message`) to stderr on failure
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.2, 8.5, 9.5_

- [ ] 11. Implement runtime rendering modules
  - [ ] 11.1 Implement animation-controller module
    - Create `js/game-logic/animation-controller.js`
    - Implement `registerAnimatedType(spriteType, frameCount, intervalMs)` with interval clamped to [100, 2000]
    - Implement `getCurrentFrame(spriteType)` returning shared frame index for all sprites of same type
    - Use a single shared timer per sprite type (not per-sprite timers)
    - Default interval: 500ms
    - _Requirements: 5.3, 7.5_

  - [ ]* 11.2 Write property tests for animation controller
    - Write to `property-tests/animation-timing.property.js`
    - **Property 14: Animation Frame Rate Independence**
    - **Validates: Requirements 5.3, 7.5**

  - [ ] 11.3 Implement pixi-renderer module
    - Create `js/game-logic/pixi-renderer.js`
    - Implement `initPixiRenderer(canvas, timeout)` with fallback chain: WebGL (5s timeout) → CanvasRenderer → Canvas 2D
    - Implement `loadSpriteAtlas(atlasImagePath, atlasJsonPath)` using PixiJS Spritesheet class
    - Parse atlas within 5 seconds of initialization
    - Fall back to individual PNG loading on atlas/JSON failure
    - Initialize PixiJS with existing HTML5 Canvas element (using `view` option)
    - Batch sprite draw calls (max 10 draw calls per tile layer)
    - _Requirements: 5.5, 6.3, 6.4, 6.6, 6.7, 7.4_

  - [ ]* 11.4 Write property tests for pixi-renderer
    - Write to `property-tests/pixel-alignment.property.js`
    - Write to `property-tests/draw-call-batching.property.js`
    - **Property 13: Integer Pixel Alignment**
    - **Property 18: Draw Call Batching Bound**
    - **Validates: Requirements 5.2, 7.4**

- [ ] 12. Modify SpriteManager for atlas and PixiJS integration
  - [ ] 12.1 Extend SpriteManager with atlas loading and PixiJS delegation
    - Modify `js/game-logic/sprites.js` to add `SpriteManager.loadAtlas(atlasPath, jsonPath)` method
    - Add `SpriteManager.usePixiRenderer(pixiRenderer)` method
    - Modify `draw(ctx, name, x, y, width, height)` to floor x,y to integers (prevent sub-pixel blur)
    - Delegate to PixiJS renderer if available, else use Canvas 2D
    - Handle animated sprites via animation-controller (resolve current frame from atlas)
    - Implement fallback: atlas load failure → individual PNG loading via existing `loadAll()`
    - Register enemy sprites with `enemy-` prefix and damaged sprites with `-damaged` suffix
    - Preserve existing API signature (no changes to calling code in game-iso.js, iso-renderer.js)
    - _Requirements: 5.1, 5.2, 5.4, 8.6, 9.6_

  - [ ]* 12.2 Write unit tests for SpriteManager integration
    - Write to `tests/game-logic/sprites.spec.js` (extend existing file)
    - Test backward compatibility of `draw()` API signature
    - Test integer pixel alignment (Math.floor on fractional inputs)
    - Test fallback from atlas to individual PNGs on load failure
    - Test enemy sprite registration with `enemy-` prefix
    - Test damaged sprite registration with `-damaged` suffix
    - _Requirements: 5.1, 5.2, 5.4, 8.6, 9.6_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Integration wiring and visual verification
  - [ ] 14.1 Wire PixiJS initialization into game startup
    - Modify game initialization in `index.html` or entry point to call `initPixiRenderer(canvas)` on load
    - Call `loadSpriteAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json')` after PixiJS init
    - Call `SpriteManager.usePixiRenderer(pixiRenderer)` to activate PixiJS path
    - Register animated sprite types (water, flag) with animation-controller
    - Render at least one damaged castle sprite on startup as visual integration test
    - _Requirements: 5.5, 6.4, 6.6, 9.7_

  - [ ]* 14.2 Integration tests (TBD — deferred to future iteration)
    - Test full sprite generation completes in <30 seconds
    - Test atlas file size under 4MB
    - Test PixiJS WebGL → CanvasRenderer → Canvas 2D fallback chain
    - Test PixiJS Spritesheet parses atlas within 5 seconds
    - Test damaged sprite renders on startup without errors
    - _Requirements: 7.2, 7.3, 5.5, 6.6, 9.7_

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The build-time modules (tasks 1–10) can be developed and tested independently before runtime integration (tasks 11–14)
- All sprite generation is deterministic (seeded PRNG) enabling reproducible property tests
- The existing `SpriteManager.draw()` API is preserved — no changes needed in game-iso.js or iso-renderer.js

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.6", "2.8"] },
    { "id": 2, "tasks": ["2.5", "2.7", "2.9"] },
    { "id": 3, "tasks": ["4.1", "5.1", "6.1"] },
    { "id": 4, "tasks": ["4.2", "5.2", "6.2", "7.1", "8.1"] },
    { "id": 5, "tasks": ["7.2", "8.2", "10.1"] },
    { "id": 6, "tasks": ["11.1", "11.3"] },
    { "id": 7, "tasks": ["11.2", "11.4", "12.1"] },
    { "id": 8, "tasks": ["12.2", "14.1"] },
    { "id": 9, "tasks": ["14.2"] }
  ]
}
```
