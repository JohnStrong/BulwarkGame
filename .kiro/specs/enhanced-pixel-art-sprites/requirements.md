# Requirements Document

## Introduction

This feature enhances the visual quality of the existing procedurally generated pixel art sprites in BasicTowerDefense. The current sprites are 64×32 isometric diamonds generated via Node.js scripts using raw pixel buffers and the `sharp` library. The goal is to introduce JS graphics libraries (such as PixiJS for runtime rendering or enhanced Canvas-based generation techniques) to produce higher-fidelity pixel art with richer detail, shading, animation frames, and visual effects — while maintaining the established isometric 2.5D aesthetic and game performance.

## Glossary

- **Sprite_Generator**: The Node.js build-time scripts (`js/level-generators/`) that procedurally create PNG sprite assets from pixel buffer data using the `sharp` library.
- **Sprite_Renderer**: The browser-side `SpriteManager` module (`js/game-logic/sprites.js`) that loads and draws sprite images onto the HTML5 Canvas at runtime.
- **Tile**: A 64×32 pixel isometric diamond that represents one map cell in the game grid.
- **Sprite_Atlas**: A single image containing multiple sprite frames packed together, used to reduce draw calls and improve rendering performance.
- **Palette**: A constrained set of colors (8–16) used to maintain pixel art coherence across all sprites.
- **Dithering**: A technique that simulates color gradients using patterns of discrete palette colors, preserving the pixel art aesthetic.
- **Sub_Pixel_Rendering**: Drawing at fractional pixel positions, which causes blur and breaks the crisp pixel art look.
- **Sprite_Enhancement_Pipeline**: The upgraded build-time process that generates higher-quality sprites using advanced rendering techniques (layered shading, noise textures, outline effects, dithering).
- **Runtime_Renderer**: The browser-side rendering system that draws sprites to the game canvas each frame, using PixiJS for sprite management and animation.
- **Animation_Frame**: A single image in a sequence that, when played in order, creates the illusion of movement for a sprite.
- **PixiJS**: A fast 2D WebGL/Canvas rendering engine for the web, used as the primary runtime rendering engine for sprite drawing, animation management, and hardware-accelerated rendering with automatic Canvas fallback.
- **Enemy_Palette**: A distinct color palette (darker tones with red accents) used for enemy unit sprites to visually differentiate them from player units.
- **Damaged_Variant**: An alternate version of a castle sprite showing structural damage (cracks, missing blocks, rubble) to indicate reduced health.

## Requirements

### Requirement 1: Enhanced Terrain Sprite Generation

**User Story:** As a player, I want terrain tiles (grass, road, water, trees, rocks) to have richer visual detail and depth, so that the game world feels more immersive and polished.

#### Acceptance Criteria

1. WHEN the Sprite_Generator runs, THE Sprite_Generator SHALL produce terrain sprites with layered shading consisting of a lit top face, a darker side face using a distinct lower-luminance Palette color, and a 1-pixel shadow edge along the bottom-right perimeter for each Tile.
2. WHEN the Sprite_Generator produces grass sprites, THE Sprite_Generator SHALL apply simplex noise texture variation such that no two adjacent grass Tiles share identical pixel patterns, using at least 3 distinct Palette colors to represent ground detail variation.
3. WHEN the Sprite_Generator produces water sprites, THE Sprite_Generator SHALL generate at least 3 and no more than 8 Animation_Frames where each frame differs from the previous frame by at least 10% of non-transparent pixels having changed color values, to produce visible highlight shifting.
4. WHEN the Sprite_Generator produces tree sprites, THE Sprite_Generator SHALL render at least 2 overlapping canopy layers, each containing an inner shadow zone, a mid-tone fill zone, and a highlight rim of at least 1 pixel width to create depth.
5. WHEN the Sprite_Generator produces a terrain Tile that is adjacent to a Tile of a different terrain type, THE Sprite_Generator SHALL apply ordered Dithering within a 4-pixel border region on the transition edge to blend the two terrain Palette colors without introducing colors outside the defined Palette.
6. THE Sprite_Generator SHALL produce all terrain sprites at the existing 64×32 pixel Tile dimensions to maintain compatibility with the current level loader and renderer.

### Requirement 2: Enhanced Castle Structure Sprite Generation

**User Story:** As a player, I want castle structures (walls, towers, keep, gatehouse) to look more detailed and imposing, so that the defensive structures feel substantial and worth protecting.

#### Acceptance Criteria

1. WHEN the Sprite_Generator produces castle wall sprites, THE Sprite_Generator SHALL render a stone block pattern consisting of at least 3 horizontal courses of blocks within the 64×32 tile, with 1-pixel mortar lines between courses, and at least 2 pixels of color variation per block face to convey surface weathering.
2. WHEN the Sprite_Generator produces tower sprites, THE Sprite_Generator SHALL render crenellation detail on the top edge consisting of at least 3 alternating merlon (raised, minimum 3×3 pixels) and crenel (gap, minimum 2 pixels wide) shapes.
3. WHEN the Sprite_Generator produces keep sprites, THE Sprite_Generator SHALL render at least 1 window slit (minimum 1×3 pixels dark rectangle) per keep tile, a flag element of at least 3×5 pixels on the center tile, and layered stone texture using distinct highlight color on the top-facing face and shadow color on the side-facing face.
4. THE Sprite_Generator SHALL apply a 1-pixel dark outline using the existing BORDER_COLOR value on all outer-perimeter pixels of every castle sprite (wall, tower, keep, gatehouse) that border a transparent pixel.
5. THE Sprite_Generator SHALL use the existing CASTLE_COLORS Palette as the base, extending it by no more than 4 additional accent colors for weathering and highlight effects.
6. IF a castle sprite's generated pixel data contains no transparent pixels within the tile diamond area, THEN THE Sprite_Generator SHALL still produce a valid 64×32 PNG file with no rendering errors.

### Requirement 3: Enhanced Unit Sprite Generation

**User Story:** As a player, I want army unit sprites to be more visually distinct and detailed, so that I can quickly identify unit types on the battlefield without relying on the HUD.

#### Acceptance Criteria

1. WHEN the Sprite_Generator produces unit sprites, THE Sprite_Generator SHALL render each unit type with a unique silhouette shape such that no two unit types share the same outline profile when reduced to a 1-bit (black/white) mask at native 32×32 resolution, enabling differentiation without color reliance.
2. WHEN the Sprite_Generator produces unit sprites, THE Sprite_Generator SHALL render a weapon or held-item element specific to the unit type (sword for knight, bow for archer, spear for spearman, crossbow for crossbowman, hammer for engineer, pike for heavy infantry, javelin for skirmisher, club for militia, ramrod for artillery) occupying a minimum area of 4×4 pixels at native resolution.
3. WHEN the Sprite_Generator produces unit sprites, THE Sprite_Generator SHALL apply directional lighting with a lighter value on the upper-left body edge and a darker value on the lower-right body edge, where the highlight pixels are at least 20% brighter and shadow pixels are at least 20% darker than the base body color.
4. THE Sprite_Generator SHALL maintain fully transparent (alpha = 0) backgrounds on all unit sprites so they composite correctly over terrain tiles without visible bounding-box artifacts.
5. THE Sprite_Generator SHALL produce unit sprites whose silhouette and weapon element remain distinguishable (unique 1-bit outline and weapon element of at least 2×2 pixels) when the sprite is rendered at 16×16 pixels (50% of native 32×32 resolution).
6. WHEN the Sprite_Generator produces unit sprites, THE Sprite_Generator SHALL render each sprite at a native resolution of 32×32 pixels, matching the isometric tile dimensions used by the game renderer.

### Requirement 4: Sprite Atlas Generation and Packing

**User Story:** As a developer, I want all enhanced sprites packed into a Sprite_Atlas with metadata, so that the game can load sprites efficiently in a single network request.

#### Acceptance Criteria

1. WHEN the Sprite_Generator completes all sprite generation, THE Sprite_Generator SHALL pack all generated sprites into a single Sprite_Atlas PNG image with no overlapping regions and a minimum 1-pixel padding between adjacent sprite frames to prevent texture bleeding.
2. WHEN the Sprite_Generator produces a Sprite_Atlas, THE Sprite_Generator SHALL output a companion JSON metadata file containing the name, x, y, width, and height of each sprite frame within the atlas.
3. THE Sprite_Atlas SHALL maintain power-of-two dimensions (e.g., 512×512, 1024×512) to ensure compatibility with WebGL texture requirements.
4. IF the total packed sprite area exceeds the maximum atlas dimension of 2048 pixels in either axis, THEN THE Sprite_Generator SHALL split output into multiple atlas files numbered sequentially (e.g., atlas-0.png, atlas-1.png) and produce a single unified JSON metadata file that includes an atlas index field for each sprite entry.

### Requirement 5: Runtime Rendering Integration

**User Story:** As a developer, I want the enhanced sprites to integrate with the existing game rendering pipeline, so that visual improvements appear without breaking current game functionality.

#### Acceptance Criteria

1. THE Sprite_Renderer SHALL load sprites from the Sprite_Atlas using the JSON metadata file, falling back to individual PNG files if the atlas image fails to load, the JSON metadata file fails to load, or the JSON metadata file fails to parse.
2. WHEN the Sprite_Renderer draws a sprite, THE Sprite_Renderer SHALL align all draw positions to integer pixel coordinates (using Math.floor or equivalent truncation) to prevent Sub_Pixel_Rendering blur.
3. WHEN the Sprite_Renderer draws animated sprites (water, flags), THE Sprite_Renderer SHALL cycle through Animation_Frames at a configurable rate with a default of 500 milliseconds per frame and a valid range of 100 to 2000 milliseconds per frame, independent of the game's frame rate.
4. THE Sprite_Renderer SHALL maintain the existing `SpriteManager.draw(ctx, name, x, y, width, height)` API signature, including optional width and height parameters, so that calling code in `game-iso.js` and `iso-renderer.js` requires no changes.
5. IF PixiJS fails to initialize its WebGL renderer within 5 seconds, THEN THE Runtime_Renderer SHALL fall back to the PixiJS CanvasRenderer, and if that also fails, SHALL fall back to direct Canvas 2D rendering using the existing SpriteManager implementation, rendering the same sprite source images at the same pixel dimensions as the PixiJS path would.

### Requirement 6: Graphics Library Integration

**User Story:** As a developer, I want to use appropriate JS graphics libraries for sprite generation and rendering, so that I can achieve higher visual quality without building everything from scratch.

#### Acceptance Criteria

1. THE Sprite_Enhancement_Pipeline SHALL use the `simplex-noise` library (MIT license) for procedural texture generation during build-time sprite creation.
2. THE Sprite_Enhancement_Pipeline SHALL use the `sharp` library for final PNG encoding and Sprite_Atlas composition, integrating as a Node.js dependency invoked by the existing `npm run generate:sprites` build script.
3. THE Runtime_Renderer SHALL use PixiJS as the primary runtime rendering library for sprite drawing, animation frame management, and canvas operations.
4. THE Runtime_Renderer SHALL initialize PixiJS with the existing HTML5 Canvas element (using the `view` option in the Application constructor) to avoid DOM restructuring.
5. THE Sprite_Enhancement_Pipeline and THE Runtime_Renderer SHALL use only libraries with MIT, Apache-2.0, or ISC licenses to maintain project license compatibility.
6. WHEN the Runtime_Renderer starts, THE Runtime_Renderer SHALL use the PixiJS Spritesheet class to parse the Sprite_Atlas BaseTexture and JSON metadata within 5 seconds of initialization.
7. IF PixiJS fails to parse the Sprite_Atlas or JSON metadata at startup, THEN THE Runtime_Renderer SHALL fall back to loading individual PNG sprite files using the existing SpriteManager.loadAll() mechanism.
8. THE Sprite_Enhancement_Pipeline SHALL declare all added library dependencies with pinned versions in the project's package.json to ensure reproducible builds.

### Requirement 7: Performance Constraints

**User Story:** As a player, I want the game to maintain smooth performance after sprite enhancements, so that visual improvements do not degrade the gameplay experience.

#### Acceptance Criteria

1. WHILE the game renders a full 64×64 tile map with all sprites visible, THE Runtime_Renderer SHALL maintain a minimum frame rate (no single frame longer than 33ms) of at least 30 frames per second on a device with integrated graphics equivalent to Intel UHD 620 or later with 4GB available system RAM.
2. THE Sprite_Atlas SHALL not exceed 4MB in total file size to keep initial load times under 3 seconds on a 10 Mbps connection.
3. WHEN the Sprite_Generator runs during build time, THE Sprite_Generator SHALL complete all sprite generation in under 30 seconds on a machine with Node.js v16 or later, a 4-core CPU, and 8GB RAM.
4. THE Runtime_Renderer SHALL batch sprite draw calls using the Sprite_Atlas to issue no more than 10 draw calls per visible tile layer (ground, structure, unit, overlay).
5. WHILE animated sprites are active, THE Runtime_Renderer SHALL update Animation_Frames using a single shared timer rather than per-sprite timers so that all animated sprites of the same type advance frames in unison.
6. WHILE the game is running with the full Sprite_Atlas loaded, THE Runtime_Renderer SHALL consume no more than 64MB of GPU texture memory for all loaded sprite atlas textures.

### Requirement 8: Enemy Unit Sprite Generation

**User Story:** As a player, I want visually distinct enemy unit sprites, so that I can immediately distinguish enemy forces from my own defenders on the battlefield.

#### Acceptance Criteria

1. WHEN the Sprite_Generator produces enemy sprites, THE Sprite_Generator SHALL generate enemy variants for each unit type (enemy knight, enemy archer, enemy spearman, enemy militia, enemy siege) using the Enemy_Palette that shares no more than 2 colors with the player unit Palette.
2. WHEN the Sprite_Generator produces enemy sprites, THE Sprite_Generator SHALL differentiate enemy sprites from player sprites through a combination of color palette shift (darker, red-accented tones) and at least one silhouette modifier per unit type chosen from: different helmet shape, banner element, or shield emblem.
3. WHEN the Sprite_Generator produces enemy sprites, THE Sprite_Generator SHALL maintain the same 64×32 Tile dimensions and transparent background as player unit sprites.
4. THE Sprite_Generator SHALL produce exactly 5 enemy unit types: enemy knight, enemy archer, enemy spearman, enemy militia, and enemy siege unit.
5. THE Sprite_Generator SHALL include all enemy sprites in the Sprite_Atlas and JSON metadata alongside player sprites, using names prefixed by `enemy-` (e.g., `enemy-knight`, `enemy-archer`) in the metadata entries.
6. WHEN the Sprite_Renderer loads the Sprite_Atlas, THE Sprite_Renderer SHALL register enemy sprites with names prefixed by `enemy-` (e.g., `enemy-knight`, `enemy-archer`) to distinguish them from player unit sprites in the sprite registry.
7. THE Sprite_Generator SHALL produce enemy unit sprites that remain legible (identifiable silhouette and distinguishable from player units) when rendered at 50% of native resolution.

### Requirement 9: Damaged Castle Sprite Variants

**User Story:** As a player, I want to see visible structural damage on castle sprites when they are hit, so that I can assess the state of my defenses at a glance without checking health bars.

#### Acceptance Criteria

1. WHEN the Sprite_Generator produces castle structure sprites, THE Sprite_Generator SHALL generate exactly one damaged variant for each of the following castle sprites: castle-wall, castle-tower, castle-keep-tl, castle-keep-bl, castle-keep-br, castle-keep-center, castle-gatehouse, castle-bailey-1, castle-bailey-2, and castle-bailey-3.
2. THE Sprite_Generator SHALL render each damaged variant so that at least 15% of the stone block area visible in the undamaged sprite is replaced by cracks, missing blocks (transparent or rubble-filled gaps), or rubble debris pixels, ensuring the damage is distinguishable from the undamaged version without magnification at the game's default zoom level.
3. THE Sprite_Generator SHALL produce damaged sprites at the same 64×32 Tile dimensions as the undamaged originals to allow direct substitution during rendering.
4. THE Sprite_Generator SHALL render damaged variants using only colors from the existing CASTLE_COLORS Palette plus the accent colors permitted by Requirement 2, criterion 5.
5. THE Sprite_Generator SHALL include all damaged castle sprites in the Sprite_Atlas with names suffixed by `-damaged` (e.g., `castle-wall-damaged`, `castle-tower-damaged`, `castle-keep-tl-damaged`).
6. WHEN the Sprite_Renderer loads the Sprite_Atlas, THE Sprite_Renderer SHALL register all 10 damaged castle sprites and make them available through the existing `SpriteManager.draw()` API using the `-damaged` suffix naming convention.
7. THE Sprite_Renderer SHALL render at least one damaged castle sprite on the game map during startup as a visual integration test to confirm the damaged sprites load and display correctly from the atlas without rendering errors.

### Requirement 10: Palette and Art Style Consistency

**User Story:** As a player, I want all enhanced sprites to maintain a cohesive medieval pixel art style, so that the game world looks unified rather than a mix of different art styles.

#### Acceptance Criteria

1. THE Sprite_Generator SHALL define a primary Palette of no more than 16 colors shared across all terrain, castle, and unit sprites, where category-specific extensions (CASTLE_COLORS accent colors, Enemy_Palette) are permitted as additional colors beyond this shared base.
2. THE Sprite_Generator SHALL apply palette quantization as a final step to map any computed intermediate colors to the nearest defined Palette color, such that every non-transparent pixel in the final output matches a color in the defined Palette exactly (zero color distance).
3. THE Sprite_Generator SHALL maintain the existing BR→TL (bottom-right to top-left) isometric viewpoint orientation for all generated sprites.
4. WHEN the Sprite_Generator applies shading, THE Sprite_Generator SHALL use a consistent light source direction (upper-left) across all sprite categories including terrain, castle, unit, enemy, and damaged variant sprites.
5. THE Sprite_Generator SHALL produce sprites where every pixel has an alpha value of either 0 (fully transparent) or 255 (fully opaque), with no intermediate alpha values, to preserve crisp pixel edges and prevent anti-aliasing on sprite outlines.
