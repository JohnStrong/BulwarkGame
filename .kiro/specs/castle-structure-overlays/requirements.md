# Requirements Document

## Introduction

The castle-structure-overlays feature extends the existing tree overlay system to support 2.5D overlay rendering for castle and bridge structures. Currently, all castle and bridge sprites bake the ground surface and the structure into a single 64×32 isometric diamond tile. This feature introduces transparent-background overlay sprites for each structure type — bridge, castle walls, castle keeps, drawbridge segments, battlements, and castle door towers (gatehouse) — so that structures appear to stand up from the ground tile beneath them, matching the visual depth already achieved by tree overlays and unit sprites.

The feature follows the same four-area pipeline as the tree overlay system:

1. **Sprite generator** — new functions producing transparent-background castle structure overlay sprites
2. **Sprite constants** — new `CASTLE_OVERLAY_SPRITES` registry
3. **Level loader** — castle and bridge tile objects gain an `overlay` field alongside the existing `sprite` field
4. **Renderer** — `IsoRenderer.drawTerrain` already supports the `tile.overlay` field; this feature adds per-structure-type overlay height constants to handle taller structures (keeps, towers) correctly

Existing flat castle sprites (`castle-wall.png`, `castle-tower.png`, etc.) are kept for backward compatibility. Damaged variants of each structure are also given overlay sprites so that the 2.5D appearance is preserved when structures take damage.

## Glossary

- **Tile**: A single cell in the isometric hex grid, described by `{ row, col, x, y, sprite, overlay? }`.
- **Ground_Sprite**: The 64×32 flat isometric diamond sprite drawn at the tile's base position (e.g. `castle-bailey-1`).
- **Overlay_Sprite**: A transparent-background sprite drawn on top of the ground sprite, offset upward so the structure appears to stand on the tile.
- **Castle_Overlay_Generator**: New functions inside `generate-iso-sprites-br-tl.js` that produce castle structure overlay sprites with alpha=0 outside the structure shape.
- **Level_Loader**: `js/game-logic/level-loader.js` — parses level `.txt` files and produces tile objects.
- **IsoRenderer**: `js/game-logic/lib/iso-renderer.js` — draws terrain tiles and units to the canvas.
- **SpriteManager**: `js/game-logic/sprites.js` — loads and draws sprite images; owns `spriteList`.
- **Sprite_Constants**: `js/level-generators/lib/sprite-constants.js` — canonical sprite name registry.
- **Build_Pipeline**: `js/level-generators/build-sprites.js` — orchestrates all sprite generators and packs the atlas.
- **Atlas**: The packed sprite sheet (`assets/sprites/atlas-0.png` + `atlas.json`) consumed at runtime.
- **Bridge**: Level character `=` — cobblestone bridge surface over water.
- **Castle_Bridge_Start**: Level character `b` — road-to-drawbridge transition segment.
- **Castle_Bridge_Mid**: Level character `m` — wooden plank drawbridge segment over moat.
- **Castle_Bridge_Gate**: Level character `g` — drawbridge segment meeting the gatehouse stone.
- **Tower**: Level character `T` — round stone castle tower.
- **Keep_TopLeft**: Level character `K` — top-left quadrant of the castle keep.
- **Keep_BotLeft**: Level character `j` — bottom-left quadrant of the castle keep.
- **Keep_BotRight**: Level character `J` — bottom-right quadrant of the castle keep.
- **Keep_Center**: Level character `F` — center (flag) quadrant of the castle keep.
- **Gatehouse**: Level character `G` — castle door tower / portcullis gatehouse.
- **Wall**: Level character `W` — full stone castle wall segment.
- **Bailey**: Level character `C` — castle bailey (dirt and hay floor, 3 variants); ground-level tile, no overlay.
- **Overlay_Height**: The pixel height of an overlay sprite canvas; varies by structure type to accommodate taller structures.
- **Overlay_Offset_Y**: A named per-structure-type constant (in pixels) used to shift the overlay sprite upward so the structure base aligns with the ground tile surface.
- **Damaged_Variant**: A degraded version of a structure sprite (e.g. `castle-tower-damaged`) used when the structure has taken damage.

---

## Requirements

### Requirement 1: Castle Structure Overlay Sprite Generation

**User Story:** As a developer, I want transparent-background overlay sprites generated for each castle and bridge structure type, so that structures can be rendered as a separate layer on top of their ground tiles.

#### Acceptance Criteria

1. THE Castle_Overlay_Generator SHALL produce overlay sprites for each of the following structure types and their damaged variants, for a total of 18 sprites (7 damaged + 11 undamaged); bridge types (bridge-mm, castle-bridge-start, castle-bridge-mid, castle-bridge-gate) have NO damaged variants:
   - `castle-wall-overlay` and `castle-wall-damaged-overlay`
   - `castle-tower-overlay` and `castle-tower-damaged-overlay`
   - `castle-keep-tl-overlay` and `castle-keep-tl-damaged-overlay`
   - `castle-keep-bl-overlay` and `castle-keep-bl-damaged-overlay`
   - `castle-keep-br-overlay` and `castle-keep-br-damaged-overlay`
   - `castle-keep-center-overlay` and `castle-keep-center-damaged-overlay`
   - `castle-gatehouse-overlay` and `castle-gatehouse-damaged-overlay`
   - `castle-bridge-start-overlay`
   - `castle-bridge-mid-overlay`
   - `castle-bridge-gate-overlay`
   - `bridge-mm-overlay`
2. WHEN a castle structure overlay sprite is generated, THE Castle_Overlay_Generator SHALL set alpha=0 for every pixel not belonging to the structure's vertical body (walls, battlements, arch, portcullis, planks); the isometric ground diamond surface pixels SHALL be excluded from the overlay (alpha=0).
3. WHEN a wall overlay sprite is generated, THE Castle_Overlay_Generator SHALL produce a canvas that is 64 pixels wide and 48 pixels tall.
4. WHEN a tower overlay sprite is generated, THE Castle_Overlay_Generator SHALL produce a canvas that is 64 pixels wide and 64 pixels tall, to accommodate the tower's greater height.
5. WHEN a keep overlay sprite is generated, THE Castle_Overlay_Generator SHALL produce a canvas that is 64 pixels wide and 64 pixels tall, to accommodate the keep's greater height.
6. WHEN a gatehouse overlay sprite is generated, THE Castle_Overlay_Generator SHALL produce a canvas that is 64 pixels wide and 80 pixels tall, to accommodate the gatehouse's arch and portcullis height.
7. WHEN a bridge overlay sprite is generated (bridge-mm, castle-bridge-start, castle-bridge-mid, castle-bridge-gate), THE Castle_Overlay_Generator SHALL produce a canvas that is 64 pixels wide and 48 pixels tall.
8. WHEN a castle structure overlay sprite is generated, THE Castle_Overlay_Generator SHALL draw the structure using the same palette colors defined in `CASTLE_COLORS` in `sprite-constants.js`; the ground-surface diamond pixels SHALL be omitted (alpha=0), and only the structure's vertical elements SHALL be drawn with alpha=255 using CASTLE_COLORS values.
9. WHEN the sprite build pipeline runs, THE Build_Pipeline SHALL invoke the Castle_Overlay_Generator and include all castle structure overlay sprites in the atlas.

### Requirement 2: Sprite Name Registration

**User Story:** As a developer, I want the new castle overlay sprite names registered in the sprite constants and SpriteManager, so that the runtime can load and draw them.

#### Acceptance Criteria

1. THE Sprite_Constants SHALL define a `CASTLE_OVERLAY_SPRITES` registry object containing the canonical names for all 21 castle structure overlay sprites listed in Requirement 1.1.
2. THE SpriteManager.spriteList SHALL include all castle structure overlay sprite names so they are loaded during `loadAll()` and packed into the atlas.
3. WHEN the atlas is built, THE Build_Pipeline SHALL read the overlay sprite names from `CASTLE_OVERLAY_SPRITES` and include them in the sprite entries passed to `packAtlas()`.
4. IF a castle overlay sprite PNG is missing at atlas-pack time, THEN THE Build_Pipeline SHALL write to stderr a diagnostic message that identifies the missing PNG file name AND exit with a non-zero code; both the stderr message and the non-zero exit are required, and the requirement is violated if either is absent.
5. IF `CASTLE_OVERLAY_SPRITES` is undefined or has zero entries at build time, THEN THE Build_Pipeline SHALL log an error to stderr and exit with a non-zero code before attempting to generate or pack any sprites.

### Requirement 3: Level Loader Tile Data

**User Story:** As a developer, I want castle and bridge tiles produced by the level loader to carry both a ground sprite and an overlay sprite name, so that the renderer knows what to draw for each layer.

#### Acceptance Criteria

1. WHEN the Level_Loader parses a `=` character, THE Level_Loader SHALL produce a tile with `sprite` set to `bridge-mm` and `overlay` set to `bridge-mm-overlay`.
2. WHEN the Level_Loader parses a `b` character, THE Level_Loader SHALL produce a tile with `sprite` set to `castle-bridge-start` and `overlay` set to `castle-bridge-start-overlay`.
3. WHEN the Level_Loader parses an `m` character, THE Level_Loader SHALL produce a tile with `sprite` set to `castle-bridge-mid` and `overlay` set to `castle-bridge-mid-overlay`.
4. WHEN the Level_Loader parses a `g` character, THE Level_Loader SHALL produce a tile with `sprite` set to `castle-bridge-gate` and `overlay` set to `castle-bridge-gate-overlay`.
5. WHEN the Level_Loader parses a `T` character, THE Level_Loader SHALL produce a tile with `sprite` set to `castle-tower` and `overlay` set to `castle-tower-overlay`.
6. WHEN the Level_Loader parses a `K` character, THE Level_Loader SHALL produce a tile with `sprite` set to `castle-keep-tl` and `overlay` set to `castle-keep-tl-overlay`.
7. WHEN the Level_Loader parses a `j` character, THE Level_Loader SHALL produce a tile with `sprite` set to `castle-keep-bl` and `overlay` set to `castle-keep-bl-overlay`.
8. WHEN the Level_Loader parses a `J` character, THE Level_Loader SHALL produce a tile with `sprite` set to `castle-keep-br` and `overlay` set to `castle-keep-br-overlay`.
9. WHEN the Level_Loader parses an `F` character, THE Level_Loader SHALL produce a tile with `sprite` set to `castle-keep-center` and `overlay` set to `castle-keep-center-overlay`.
10. WHEN the Level_Loader parses a `G` character, THE Level_Loader SHALL produce a tile with `sprite` set to `castle-gatehouse` and `overlay` set to `castle-gatehouse-overlay`.
11. WHEN the Level_Loader parses a `W` character, THE Level_Loader SHALL produce a tile with `sprite` set to `castle-wall` and `overlay` set to `castle-wall-overlay`.
12. WHEN the Level_Loader parses a `C` character, THE Level_Loader SHALL produce a tile with `sprite` set to `castle-bailey-1`, `castle-bailey-2`, or `castle-bailey-3` (variant is selected as `castle-bailey-${Math.floor(tileHash(row, col) * 3) + 1}`) and the `overlay` field SHALL be absent from the tile object (not present as undefined, null, or empty string), because bailey tiles are ground-level surfaces with no vertical structure.
13. THE Level_Loader SHALL preserve the existing `tileHash` function without modification so that tile variant selection remains deterministic.

### Requirement 4: Per-Structure Overlay Height Constants

**User Story:** As a developer, I want named overlay height and offset constants for each structure category, so that taller structures (keeps, towers, gatehouse) are positioned correctly without magic numbers.

#### Acceptance Criteria

1. THE IsoRenderer SHALL define named overlay height constants for each structure category:
   - `WALL_OVERLAY_HEIGHT = 48`
   - `TOWER_OVERLAY_HEIGHT = 64`
   - `KEEP_OVERLAY_HEIGHT = 64`
   - `GATEHOUSE_OVERLAY_HEIGHT = 80`
   - `BRIDGE_OVERLAY_HEIGHT = 48`
2. THE IsoRenderer SHALL define named overlay Y-offset constants for each structure category:
   - `WALL_OVERLAY_OFFSET_Y = 0`
   - `TOWER_OVERLAY_OFFSET_Y = 0`
   - `KEEP_OVERLAY_OFFSET_Y = 0`
   - `GATEHOUSE_OVERLAY_OFFSET_Y = 0`
   - `BRIDGE_OVERLAY_OFFSET_Y = 0`
   (matching the existing `TREE_OVERLAY_OFFSET_Y = 0` pattern; values are tunable post-implementation)
3. WHEN the IsoRenderer draws a castle structure overlay, THE IsoRenderer SHALL look up the overlay height and offset for the tile's overlay sprite name using the following mapping, rather than using the tree overlay constants `OVERLAY_HEIGHT` and `TREE_OVERLAY_OFFSET_Y`:
   - `castle-wall-overlay` / `castle-wall-damaged-overlay` → `WALL_OVERLAY_HEIGHT` and `WALL_OVERLAY_OFFSET_Y`
   - `castle-tower-overlay` / `castle-tower-damaged-overlay` → `TOWER_OVERLAY_HEIGHT` and `TOWER_OVERLAY_OFFSET_Y`
   - `castle-keep-tl-overlay` / `castle-keep-tl-damaged-overlay` / `castle-keep-bl-overlay` / `castle-keep-bl-damaged-overlay` / `castle-keep-br-overlay` / `castle-keep-br-damaged-overlay` / `castle-keep-center-overlay` / `castle-keep-center-damaged-overlay` → `KEEP_OVERLAY_HEIGHT` and `KEEP_OVERLAY_OFFSET_Y`
   - `castle-gatehouse-overlay` / `castle-gatehouse-damaged-overlay` → `GATEHOUSE_OVERLAY_HEIGHT` and `GATEHOUSE_OVERLAY_OFFSET_Y`
   - `bridge-mm-overlay` / `castle-bridge-start-overlay` / `castle-bridge-mid-overlay` / `castle-bridge-gate-overlay` → `BRIDGE_OVERLAY_HEIGHT` and `BRIDGE_OVERLAY_OFFSET_Y`
4. IF the tile's overlay sprite name does not match any known structure category, THEN THE IsoRenderer SHALL fall back to `WALL_OVERLAY_HEIGHT` and `WALL_OVERLAY_OFFSET_Y` and SHALL log a console warning identifying the unrecognized sprite name.

### Requirement 5: Two-Layer Rendering for Castle Structures

**User Story:** As a player, I want castle structures to display a ground layer with the structure standing on top of it, so that the castle looks visually richer and structures have proper 2.5D depth.

#### Acceptance Criteria

1. WHEN IsoRenderer.drawTerrain iterates a tile that has an `overlay` field, THE IsoRenderer SHALL call SpriteManager.draw for `tile.sprite` at `(x - camera.tileW/2, y - camera.tileH/2)` with dimensions `camera.tileW × camera.tileH` before any overlay draw call for that tile.
2. WHEN IsoRenderer.drawTerrain iterates a tile that has an `overlay` field, THE IsoRenderer SHALL then call SpriteManager.draw for `tile.overlay` at the position computed by the formula in Requirement 6, using the per-structure overlay height and offset constants.
3. WHEN IsoRenderer.drawTerrain iterates a tile that has no `overlay` field, THE IsoRenderer SHALL call SpriteManager.draw exactly once for that tile (for `tile.sprite` at `camera.tileW × camera.tileH`), and SHALL NOT call SpriteManager.draw for any overlay sprite.
4. WHEN a tile with an `overlay` field is selected or hovered, THE IsoRenderer SHALL draw the diamond outline after both the ground sprite draw call and the overlay sprite draw call. WHEN a tile without an `overlay` field is selected or hovered, THE IsoRenderer SHALL draw the diamond outline after the ground sprite draw call.
5. WHEN IsoRenderer draws a castle overlay sprite, THE IsoRenderer SHALL pass the overlay sprite's native width (64) and the per-structure overlay height constant as the width and height arguments to SpriteManager.draw, rather than `camera.tileW` and `camera.tileH`.

### Requirement 6: Overlay Vertical Positioning Formula

**User Story:** As a developer, I want the overlay sprite's vertical position computed from a consistent formula using named constants, so that structure bases align with the ground tile surface across all structure types and zoom levels.

#### Acceptance Criteria

1. WHEN any overlay sprite is drawn, THE IsoRenderer SHALL compute the draw Y position as `tileTopY - (overlayHeight - camera.tileH) + overlayOffsetY`, where `overlayHeight` and `overlayOffsetY` are the per-structure constants for that overlay sprite, and where `tileTopY = y - camera.tileH / 2` is the screen Y coordinate of the topmost pixel of the ground diamond.
2. WHEN any overlay sprite is drawn, THE IsoRenderer SHALL center it horizontally: draw X = `tileCenterX - OVERLAY_WIDTH / 2`, where `OVERLAY_WIDTH = 64` for all structure types, and where `tileCenterX = x` is the screen X coordinate of the horizontal center of the ground diamond.
3. THE named `*_OVERLAY_OFFSET_Y` constants SHALL be set such that the bottom edge of the overlay sprite aligns with the bottom edge of the ground diamond at default zoom (camera.tileH = 32). The alignment invariant is: `overlayOffsetY = 0` satisfies this when the overlay sprite's bottom row represents the structure's base.

### Requirement 7: Damaged Variant Support

**User Story:** As a developer, I want damaged variants of castle structures to also have overlay sprites, so that the 2.5D appearance is preserved when structures take damage.

#### Acceptance Criteria

1. THE Castle_Overlay_Generator SHALL produce damaged overlay sprites for: `castle-wall-damaged-overlay`, `castle-tower-damaged-overlay`, `castle-keep-tl-damaged-overlay`, `castle-keep-bl-damaged-overlay`, `castle-keep-br-damaged-overlay`, `castle-keep-center-damaged-overlay`, and `castle-gatehouse-damaged-overlay`.
2. THE Sprite_Constants SHALL include `castle-wall-damaged-overlay`, `castle-tower-damaged-overlay`, `castle-keep-tl-damaged-overlay`, `castle-keep-bl-damaged-overlay`, `castle-keep-br-damaged-overlay`, `castle-keep-center-damaged-overlay`, and `castle-gatehouse-damaged-overlay` in `CASTLE_OVERLAY_SPRITES`.
3. THE SpriteManager.spriteList SHALL include `castle-wall-damaged-overlay`, `castle-tower-damaged-overlay`, `castle-keep-tl-damaged-overlay`, `castle-keep-bl-damaged-overlay`, `castle-keep-br-damaged-overlay`, `castle-keep-center-damaged-overlay`, and `castle-gatehouse-damaged-overlay`.
4. WHEN IsoRenderer draws a tile whose `overlay` field ends with `-damaged-overlay`, THE IsoRenderer SHALL strip the `-damaged` infix from the sprite name to determine the structure category (e.g. `castle-tower-damaged-overlay` → tower category) and apply the same overlay height and offset constants as the undamaged variant.

### Requirement 8: Backward Compatibility

**User Story:** As a developer, I want the existing flat castle sprites and all other tile types to remain functional, so that no existing level data or rendering behavior is broken by this change.

#### Acceptance Criteria

1. THE Sprite_Constants SHALL retain all existing entries in `CASTLE_SPRITES` for the flat (non-overlay) castle sprite names.
2. THE SpriteManager.spriteList SHALL retain all existing flat castle sprite names.
3. WHEN the Build_Pipeline runs, THE Build_Pipeline SHALL include all existing flat castle sprite names in the atlas, verifiable by their presence in `atlas.json` frames after the build.
4. IF a tile object has no `overlay` field, or has an `overlay` field that is empty or null, THEN THE IsoRenderer SHALL draw only `tile.sprite` at the standard tile dimensions (`camera.tileW × camera.tileH`) and SHALL NOT draw any overlay.
5. WHEN the Level_Loader parses any of the characters `.`, `,`, `O`, `P`, `S`, `R`, `D`, `~`, `C`, THE Level_Loader SHALL produce a tile object that does NOT have an `overlay` field.

### Requirement 9: Atlas Build Integration

**User Story:** As a developer, I want the build pipeline to automatically include all new castle overlay sprites in the atlas, so that no manual steps are needed after running the build.

#### Acceptance Criteria

1. WHEN the Build_Pipeline runs, THE Build_Pipeline SHALL execute the Castle_Overlay_Generator as part of the existing generator sequence before the atlas-packing step.
2. THE Build_Pipeline SHALL read overlay sprite names from `CASTLE_OVERLAY_SPRITES` in `sprite-constants.js` and add them to the sprite entries array alongside terrain, castle, unit, enemy, and tree overlay sprites.
3. WHEN the atlas is packed, THE Build_Pipeline SHALL verify that all castle overlay sprite PNGs exist in `OUTPUT_DIR` before calling `packAtlas()`; IF any castle overlay PNG is missing, THEN THE Build_Pipeline SHALL write to stderr a message identifying each missing PNG file name and exit with a non-zero code; the build SHALL fail regardless of whether the atlas packs successfully.
4. WHEN the Build_Pipeline completes atlas packing, THE Build_Pipeline SHALL check the atlas file size. IF the atlas file size is ≥ 4 MB, THEN THE Build_Pipeline SHALL write to stderr a message stating the actual file size and the 4 MB limit, and SHALL exit with a non-zero code.

### Requirement 10: Correctness Properties

**User Story:** As a developer, I want property-based tests covering the castle overlay system, so that structural invariants are verified across all valid inputs rather than only spot-checked examples.

#### Acceptance Criteria

1. THE castle overlay sprite buffers SHALL have alpha=0 for every pixel not belonging to the structure's vertical body (transparent background invariant).
2. THE castle overlay sprite buffers SHALL have every opaque pixel (alpha=255) with RGB values within ±15 per channel of at least one color in `getPaletteForCategory('castle')` (i.e. `PRIMARY_PALETTE + CASTLE_ACCENT_COLORS`, which includes `BORDER_COLOR`). Pixels with alpha 1–254 SHALL also satisfy this palette constraint (palette fidelity invariant).
3. WHEN the Level_Loader parses any castle or bridge tile character (`=`, `b`, `m`, `g`, `T`, `K`, `j`, `J`, `F`, `G`, `W`) at any non-negative integer (row, col) position, THE Level_Loader SHALL produce a tile with `sprite` ∈ `Object.values(CASTLE_SPRITES)` and `overlay` ∈ `Object.values(CASTLE_OVERLAY_SPRITES)`.
4. WHEN the Level_Loader parses any non-overlay character (`.`, `,`, `R`, `D`, `~`, `C`, `O`, `P`, `S`) at any non-negative integer (row, col) position, THE Level_Loader SHALL produce a tile object that does NOT have an `overlay` field.
5. WHEN IsoRenderer.drawTerrain processes a tile with an `overlay` field and any camera configuration with `tileW` and `tileH` in the range [1, 256] px, THE IsoRenderer SHALL call SpriteManager.draw for `tile.sprite` before calling SpriteManager.draw for `tile.overlay` (overlay draw sequence invariant).
6. WHEN IsoRenderer.drawTerrain processes a tile with an `overlay` field, THE IsoRenderer SHALL pass the native overlay width (64) and the per-structure overlay height constant as dimensions to the overlay SpriteManager.draw call, not `camera.tileW × camera.tileH` (overlay dimensions invariant).
7. WHEN IsoRenderer.drawTerrain processes a tile with an `overlay` field and any camera configuration with `tileW` and `tileH` in the range [1, 256] px, THE IsoRenderer SHALL draw the overlay sprite at X = `tileCenterX - 32` and Y = `tileTopY - (overlayHeight - camera.tileH) + overlayOffsetY` using the per-structure constants (overlay positioning formula invariant).
