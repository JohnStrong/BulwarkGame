'use strict';

/**
 * Overlay draw utilities — resolves the correct draw function for a tile's overlay sprite.
 *
 * Owns the overlay allowlist (tree-, castle-, bridge-) and returns a partially-applied
 * zero-argument draw closure for the tile, keeping IsoRenderer.drawTerrain clean.
 *
 * Imports:
 *   - OVERLAY_WIDTH, OVERLAY_HEIGHT, TREE_OVERLAY_OFFSET_Y  from ./iso-renderer.js
 *   - CASTLE_OVERLAY_CATEGORY_MAP                            from ./iso-renderer.js  (added in task 10.1)
 *   - SpriteManager                                          from ../sprites.js
 */

const {
    OVERLAY_WIDTH,
    OVERLAY_HEIGHT,
    TREE_OVERLAY_OFFSET_Y,
    CASTLE_OVERLAY_CATEGORY_MAP,
} = require('./iso-renderer.js');

const SpriteManager = require('../sprites.js');

/**
 * Resolves the overlay draw parameters for a tile and returns a partially-applied
 * draw function, or null if the tile has no overlay.
 *
 * Allowlisted overlay prefixes: 'tree-', 'castle-', 'bridge-'
 *
 * @param {object} tile    - The tile object ({ overlay?, sprite, ... })
 * @param {object} ctx     - Canvas 2D rendering context
 * @param {number} x       - Tile center screen X
 * @param {number} y       - Tile center screen Y
 * @param {object} camera  - Camera state ({ tileW, tileH })
 * @returns {function|null} A zero-argument function that calls SpriteManager.draw
 *                          with the correct overlay parameters, or null if no overlay.
 * @throws {Error} If tile.overlay is set but the sprite name is not allowlisted, or if
 *                 a castle-/bridge- name is not registered in CASTLE_OVERLAY_CATEGORY_MAP.
 */
function resolveOverlayDraw(tile, ctx, x, y, camera) {
    if (!tile.overlay) {
        return null; // no overlay — caller passes through
    }

    const overlayName = tile.overlay;

    if (overlayName.startsWith('tree-')) {
        // Tree overlay — fixed 64×48, TREE_OVERLAY_OFFSET_Y
        return () => {
            const overlayX = x - OVERLAY_WIDTH / 2;
            const overlayY = (y - camera.tileH / 2) - (OVERLAY_HEIGHT - camera.tileH) + TREE_OVERLAY_OFFSET_Y;
            SpriteManager.draw(ctx, overlayName, overlayX, overlayY, OVERLAY_WIDTH, OVERLAY_HEIGHT);
        };
    }

    if (overlayName.startsWith('castle-') || overlayName.startsWith('bridge-')) {
        // Castle / bridge overlay — variable height from CASTLE_OVERLAY_CATEGORY_MAP
        const category = CASTLE_OVERLAY_CATEGORY_MAP[overlayName];
        if (!category) {
            // Sprite name matches the castle/bridge prefix but is not in the map —
            // this is a configuration error, not a runtime tile error.
            console.error(`[overlay-utils] Overlay sprite "${overlayName}" is not registered in CASTLE_OVERLAY_CATEGORY_MAP.`);
            throw new Error(`Unregistered castle overlay sprite: ${overlayName}`);
        }
        const { height: overlayHeight, offsetY: overlayOffsetY, offsetX: overlayOffsetX = 0 } = category;
        return () => {
            const overlayX = x - OVERLAY_WIDTH / 2 + overlayOffsetX;
            const overlayY = (y - camera.tileH / 2) - (overlayHeight - camera.tileH) + overlayOffsetY;
            SpriteManager.draw(ctx, overlayName, overlayX, overlayY, OVERLAY_WIDTH, overlayHeight);
        };
    }

    // Overlay is set but the sprite name is not on the allowlist — hard error
    console.error(`[overlay-utils] Overlay "${overlayName}" on sprite "${tile.sprite}" is not allowed. Only tree- and castle-/bridge- overlays are supported.`);
    throw new Error(`Overlay not allowed on sprite: ${tile.sprite} (overlay: ${overlayName})`);
}

module.exports = { resolveOverlayDraw };
