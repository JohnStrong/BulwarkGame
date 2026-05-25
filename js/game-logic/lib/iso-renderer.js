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

            // Overlay pass — draw tree overlay at native dimensions, offset upward
            if (tile.overlay) {
                const tileCenterX = x;
                const tileTopY = y - camera.tileH / 2;
                const overlayX = tileCenterX - OVERLAY_WIDTH / 2;
                const overlayY = tileTopY - (OVERLAY_HEIGHT - camera.tileH) + TREE_OVERLAY_OFFSET_Y;
                SpriteManager.draw(ctx, tile.overlay, overlayX, overlayY, OVERLAY_WIDTH, OVERLAY_HEIGHT);
            }

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
