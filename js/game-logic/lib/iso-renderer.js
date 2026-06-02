/**
 * Isometric Renderer — draws terrain tiles and units to canvas.
 *
 * Reusable renderer. Takes a camera, sprite manager, and tile/unit data.
 * Handles: terrain drawing, hover/select effects, unit overlay.
 *
 * Usage:
 *   IsoRenderer.drawTerrain(ctx, camera, tiles, state);
 *   IsoRenderer.drawUnits(ctx, camera, units);
 */

/** Pixels to shift the overlay sprite upward relative to the tile top-left corner.
 *  Starting value of 0; visual tuning can adjust it without changing the formula. */
const TREE_OVERLAY_OFFSET_Y = 0;

/** Native overlay sprite dimensions (must match the generator output). */
const OVERLAY_WIDTH = 64;
const OVERLAY_HEIGHT = 48;

// ─── Castle Overlay Height Constants ────────────────────────────────────────
/** Overlay canvas height for wall structure type (px). 64 px above ground = 2 tile heights. */
const WALL_OVERLAY_HEIGHT    = 96;
/** Overlay canvas height for bridge structure types (px). Low parapets. */
const BRIDGE_OVERLAY_HEIGHT  = 48;
/** Overlay canvas height for tower and keep structure types (px). 96 px above ground. */
const TOWER_OVERLAY_HEIGHT   = 128;
const KEEP_OVERLAY_HEIGHT    = 128;
/** Overlay canvas height for the gatehouse structure type (px). 112 px above ground. */
const GATEHOUSE_OVERLAY_HEIGHT = 144;

// ─── Castle Overlay Y-Offset Constants ──────────────────────────────────────
/** Pixels to shift each structure category's overlay upward.
 *  All start at 0 (matching TREE_OVERLAY_OFFSET_Y); tunable post-implementation. */
const WALL_OVERLAY_OFFSET_Y      = 0;
const BRIDGE_OVERLAY_OFFSET_Y    = 0;
const TOWER_OVERLAY_OFFSET_Y     = 0;
const KEEP_OVERLAY_OFFSET_Y      = 0;
const GATEHOUSE_OVERLAY_OFFSET_Y = 0;

// ─── Castle Overlay X-Offset Constants ──────────────────────────────────────
/** Horizontal pixel shift for each structure category's overlay.
 *  Positive = shift right, negative = shift left.
 *  Used to align overlays with the correct isometric face of the ground tile. */
const WALL_OVERLAY_OFFSET_X      = 0;
const TOWER_OVERLAY_OFFSET_X     = 0;
const KEEP_OVERLAY_OFFSET_X      = 0;
const GATEHOUSE_OVERLAY_OFFSET_X = 0;

/**
 * Maps every castle overlay sprite name to its { height, offsetY, offsetX } constants.
 * Damaged variants are listed explicitly to avoid runtime string manipulation.
 * Bridge overlays are omitted — bridge tiles render ground-only (no overlay).
 */
const CASTLE_OVERLAY_CATEGORY_MAP = {
    'castle-wall-overlay':                { height: WALL_OVERLAY_HEIGHT,      offsetY: WALL_OVERLAY_OFFSET_Y,      offsetX: WALL_OVERLAY_OFFSET_X },
    'castle-wall-damaged-overlay':        { height: WALL_OVERLAY_HEIGHT,      offsetY: WALL_OVERLAY_OFFSET_Y,      offsetX: WALL_OVERLAY_OFFSET_X },
    'castle-tower-overlay':               { height: TOWER_OVERLAY_HEIGHT,     offsetY: TOWER_OVERLAY_OFFSET_Y,     offsetX: TOWER_OVERLAY_OFFSET_X },
    'castle-tower-damaged-overlay':       { height: TOWER_OVERLAY_HEIGHT,     offsetY: TOWER_OVERLAY_OFFSET_Y,     offsetX: TOWER_OVERLAY_OFFSET_X },
    'castle-keep-tl-overlay':             { height: KEEP_OVERLAY_HEIGHT,      offsetY: KEEP_OVERLAY_OFFSET_Y,      offsetX: KEEP_OVERLAY_OFFSET_X },
    'castle-keep-tl-damaged-overlay':     { height: KEEP_OVERLAY_HEIGHT,      offsetY: KEEP_OVERLAY_OFFSET_Y,      offsetX: KEEP_OVERLAY_OFFSET_X },
    'castle-keep-bl-overlay':             { height: KEEP_OVERLAY_HEIGHT,      offsetY: KEEP_OVERLAY_OFFSET_Y,      offsetX: KEEP_OVERLAY_OFFSET_X },
    'castle-keep-bl-damaged-overlay':     { height: KEEP_OVERLAY_HEIGHT,      offsetY: KEEP_OVERLAY_OFFSET_Y,      offsetX: KEEP_OVERLAY_OFFSET_X },
    'castle-keep-br-overlay':             { height: KEEP_OVERLAY_HEIGHT,      offsetY: KEEP_OVERLAY_OFFSET_Y,      offsetX: KEEP_OVERLAY_OFFSET_X },
    'castle-keep-br-damaged-overlay':     { height: KEEP_OVERLAY_HEIGHT,      offsetY: KEEP_OVERLAY_OFFSET_Y,      offsetX: KEEP_OVERLAY_OFFSET_X },
    'castle-keep-center-overlay':         { height: KEEP_OVERLAY_HEIGHT,      offsetY: KEEP_OVERLAY_OFFSET_Y,      offsetX: KEEP_OVERLAY_OFFSET_X },
    'castle-keep-center-damaged-overlay': { height: KEEP_OVERLAY_HEIGHT,      offsetY: KEEP_OVERLAY_OFFSET_Y,      offsetX: KEEP_OVERLAY_OFFSET_X },
    'castle-gatehouse-overlay':           { height: GATEHOUSE_OVERLAY_HEIGHT, offsetY: GATEHOUSE_OVERLAY_OFFSET_Y, offsetX: GATEHOUSE_OVERLAY_OFFSET_X },
    'castle-gatehouse-damaged-overlay':   { height: GATEHOUSE_OVERLAY_HEIGHT, offsetY: GATEHOUSE_OVERLAY_OFFSET_Y, offsetX: GATEHOUSE_OVERLAY_OFFSET_X },
    // Isometric wall face overlay — single sprite used by all castle structure tiles at runtime
    'castle-iso-wall-overlay':            { height: WALL_OVERLAY_HEIGHT,      offsetY: WALL_OVERLAY_OFFSET_Y,      offsetX: WALL_OVERLAY_OFFSET_X },
    'castle-iso-wall-damaged-overlay':    { height: WALL_OVERLAY_HEIGHT,      offsetY: WALL_OVERLAY_OFFSET_Y,      offsetX: WALL_OVERLAY_OFFSET_X },
};

/**
 * Resolves the overlay draw parameters for a tile and returns a zero-argument draw
 * closure, or null if the tile has no overlay.
 *
 * Works in both the browser (globals) and Node.js (required by overlay-utils.js and tests).
 * Allowlisted prefixes: 'tree-', 'castle-', 'bridge-'
 *
 * @param {object} tile    - The tile object ({ overlay?, sprite, ... })
 * @param {object} ctx     - Canvas 2D rendering context
 * @param {number} x       - Tile center screen X
 * @param {number} y       - Tile center screen Y
 * @param {object} camera  - Camera state ({ tileW, tileH })
 * @returns {function|null}
 */
function resolveOverlayDraw(tile, ctx, x, y, camera) {
    if (!tile.overlay) {
        return null;
    }

    const overlayName = tile.overlay;

    if (overlayName.startsWith('tree-')) {
        return () => {
            const overlayX = x - OVERLAY_WIDTH / 2;
            const overlayY = (y - camera.tileH / 2) - (OVERLAY_HEIGHT - camera.tileH) + TREE_OVERLAY_OFFSET_Y;
            SpriteManager.draw(ctx, overlayName, overlayX, overlayY, OVERLAY_WIDTH, OVERLAY_HEIGHT);
        };
    }

    if (overlayName.startsWith('castle-') || overlayName.startsWith('bridge-')) {
        const category = CASTLE_OVERLAY_CATEGORY_MAP[overlayName];
        if (!category) {
            console.error(`[IsoRenderer] Overlay sprite "${overlayName}" is not registered in CASTLE_OVERLAY_CATEGORY_MAP.`);
            throw new Error(`Unregistered castle overlay sprite: ${overlayName}`);
        }
        const { height: overlayHeight, offsetY: overlayOffsetY, offsetX: overlayOffsetX = 0 } = category;
        return () => {
            const overlayX = x - OVERLAY_WIDTH / 2 + overlayOffsetX;
            const overlayY = (y - camera.tileH / 2) - (overlayHeight - camera.tileH) + overlayOffsetY;
            SpriteManager.draw(ctx, overlayName, overlayX, overlayY, OVERLAY_WIDTH, overlayHeight);
        };
    }

    console.error(`[IsoRenderer] Overlay "${overlayName}" on sprite "${tile.sprite}" is not allowed.`);
    throw new Error(`Overlay not allowed on sprite: ${tile.sprite} (overlay: ${overlayName})`);
}

const IsoRenderer = {
    /**
     * Draw all terrain tiles with hover/select effects.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera — IsoCamera instance
     * @param {Array} tiles — level.tiles array
     * @param {Object} state — { hoveredTile, selectedTile, selectedLift }
     */
    drawTerrain(ctx, camera, tiles, state) {
        for (const tile of tiles) {
            if (tile.covered) continue;
            let { x, y } = camera.gridToScreen(tile.row, tile.col);

            const isSelected = state.selectedTile &&
                tile.row === state.selectedTile.row && tile.col === state.selectedTile.col;
            if (isSelected) y -= state.selectedLift;

            // Ground pass — always draw tile.sprite at standard tile dimensions
            SpriteManager.draw(ctx, tile.sprite, x - camera.tileW/2, y - camera.tileH/2, camera.tileW, camera.tileH);

            // Overlay pass — delegate to resolveOverlayDraw (overlay-utils.js)
            const drawOverlay = resolveOverlayDraw(tile, ctx, x, y, camera);
            if (drawOverlay) drawOverlay();

            // Hover/select diamond outlines drawn after both sprite draw calls
            const isHovered = state.hoveredTile &&
                tile.row === state.hoveredTile.row && tile.col === state.hoveredTile.col;
            if (isHovered && !isSelected) {
                this.drawDiamondOutline(ctx, x, y, camera.tileW, camera.tileH, 'rgba(255, 220, 80, 0.6)', 1.5);
            }

            // Selected highlight + glow
            if (isSelected) {
                this.drawDiamondOutline(ctx, x, y, camera.tileW, camera.tileH, 'rgba(255, 255, 120, 0.9)', 2);
                this.drawDiamondOutline(ctx, x, y, camera.tileW, camera.tileH, 'rgba(255, 255, 180, 0.3)', 4);
            }
        }
    },

    /**
     * Draw placed units on top of terrain.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera — IsoCamera instance
     * @param {Array} units — UnitManager.getPlacedUnits()
     */
    drawUnits(ctx, camera, units) {
        for (const unit of units) {
            const { x, y } = camera.gridToScreen(unit.row, unit.col);
            const uw = camera.tileW * 0.75;
            const uh = camera.tileH * 0.75;
            SpriteManager.draw(ctx, unit.sprite, x - uw/2, y - uh/2 - 4, uw, uh);
        }
    },

    /**
     * Draw a diamond-shaped outline at a position.
     */
    drawDiamondOutline(ctx, x, y, w, h, color, lineWidth) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(x, y - h/2);
        ctx.lineTo(x + w/2, y);
        ctx.lineTo(x, y + h/2);
        ctx.lineTo(x - w/2, y);
        ctx.closePath();
        ctx.stroke();
    }
};

// Export constants and map for use by overlay-utils.js (Node.js require) and tests.
// In the browser environment, these are also available as module-level variables.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        OVERLAY_WIDTH,
        OVERLAY_HEIGHT,
        TREE_OVERLAY_OFFSET_Y,
        WALL_OVERLAY_HEIGHT,
        BRIDGE_OVERLAY_HEIGHT,
        TOWER_OVERLAY_HEIGHT,
        KEEP_OVERLAY_HEIGHT,
        GATEHOUSE_OVERLAY_HEIGHT,
        WALL_OVERLAY_OFFSET_Y,
        TOWER_OVERLAY_OFFSET_Y,
        KEEP_OVERLAY_OFFSET_Y,
        GATEHOUSE_OVERLAY_OFFSET_Y,
        WALL_OVERLAY_OFFSET_X,
        TOWER_OVERLAY_OFFSET_X,
        KEEP_OVERLAY_OFFSET_X,
        GATEHOUSE_OVERLAY_OFFSET_X,
        CASTLE_OVERLAY_CATEGORY_MAP,
        IsoRenderer,
    };
}
