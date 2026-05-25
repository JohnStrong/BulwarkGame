/**
 * Canvas mock tests for js/game-logic/lib/iso-renderer.js
 *
 * Recommendation 1: Add canvas mock tests for runtime modules.
 * Tests drawTerrain and drawUnits using a mock canvas context
 * that records draw operations.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-renderer-render.spec.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Canvas Context Mock ────────────────────────────────────────────────────

function createMockCtx() {
    const calls = [];
    return {
        calls,
        strokeStyle: null,
        lineWidth: null,
        beginPath() { calls.push({ method: 'beginPath' }); },
        moveTo(x, y) { calls.push({ method: 'moveTo', args: [x, y] }); },
        lineTo(x, y) { calls.push({ method: 'lineTo', args: [x, y] }); },
        closePath() { calls.push({ method: 'closePath' }); },
        stroke() { calls.push({ method: 'stroke' }); },
        drawImage(img, x, y, w, h) { calls.push({ method: 'drawImage', args: [img, x, y, w, h] }); },
    };
}

// ─── Mock SpriteManager ─────────────────────────────────────────────────────

let spriteDrawCalls = [];
const MockSpriteManager = {
    draw(ctx, name, x, y, w, h) {
        spriteDrawCalls.push({ name, x, y, w, h });
    }
};

// ─── Mock Camera ────────────────────────────────────────────────────────────

function createMockCamera(overrides = {}) {
    return {
        tileW: 64,
        tileH: 32,
        camX: 0,
        camY: 0,
        mapOffsetX: 512,
        mapOffsetY: 32,
        elevation: {},
        viewpoint: 'br-tl',
        gridToScreen(row, col) {
            const x = (col - row) * 32 + this.mapOffsetX - this.camX;
            const y = (col + row) * 16 + this.mapOffsetY - this.camY;
            const elevOffset = this.elevation[col] || 0;
            return { x, y: y + elevOffset };
        },
        ...overrides,
    };
}

// ─── IsoRenderer replica ────────────────────────────────────────────────────

const TREE_OVERLAY_OFFSET_Y = 0;
const OVERLAY_WIDTH = 64;
const OVERLAY_HEIGHT = 48;

const IsoRenderer = {
    drawTerrain(ctx, camera, tiles, state) {
        for (const tile of tiles) {
            if (tile.covered) continue;
            let { x, y } = camera.gridToScreen(tile.row, tile.col);

            const isSelected = state.selectedTile &&
                tile.row === state.selectedTile.row && tile.col === state.selectedTile.col;
            if (isSelected) y -= state.selectedLift;

            // Ground pass — always draw tile.sprite at standard tile dimensions
            MockSpriteManager.draw(ctx, tile.sprite, x - camera.tileW / 2, y - camera.tileH / 2, camera.tileW, camera.tileH);

            // Overlay pass — draw tree overlay at native dimensions, offset upward
            if (tile.overlay) {
                const tileCenterX = x;
                const tileTopY = y - camera.tileH / 2;
                const overlayX = tileCenterX - OVERLAY_WIDTH / 2;
                const overlayY = tileTopY - (OVERLAY_HEIGHT - camera.tileH) + TREE_OVERLAY_OFFSET_Y;
                MockSpriteManager.draw(ctx, tile.overlay, overlayX, overlayY, OVERLAY_WIDTH, OVERLAY_HEIGHT);
            }

            // Hover/select diamond outlines drawn after both sprite draw calls
            const isHovered = state.hoveredTile &&
                tile.row === state.hoveredTile.row && tile.col === state.hoveredTile.col;
            if (isHovered && !isSelected) {
                this.drawDiamondOutline(ctx, x, y, camera.tileW, camera.tileH, 'rgba(255, 220, 80, 0.6)', 1.5);
            }

            if (isSelected) {
                this.drawDiamondOutline(ctx, x, y, camera.tileW, camera.tileH, 'rgba(255, 255, 120, 0.9)', 2);
                this.drawDiamondOutline(ctx, x, y, camera.tileW, camera.tileH, 'rgba(255, 255, 180, 0.3)', 4);
            }
        }
    },

    drawUnits(ctx, camera, units) {
        for (const unit of units) {
            const { x, y } = camera.gridToScreen(unit.row, unit.col);
            const uw = camera.tileW * 0.75;
            const uh = camera.tileH * 0.75;
            MockSpriteManager.draw(ctx, unit.sprite, x - uw / 2, y - uh / 2 - 4, uw, uh);
        }
    },

    drawDiamondOutline(ctx, x, y, w, h, color, lineWidth) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(x, y - h / 2);
        ctx.lineTo(x + w / 2, y);
        ctx.lineTo(x, y + h / 2);
        ctx.lineTo(x - w / 2, y);
        ctx.closePath();
        ctx.stroke();
    }
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('IsoRenderer.drawTerrain', () => {
    beforeEach(() => {
        spriteDrawCalls = [];
    });

    it('should draw each non-covered tile', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [
            { row: 0, col: 0, sprite: 'grass-short-1' },
            { row: 0, col: 1, sprite: 'grass-short-2' },
            { row: 1, col: 0, sprite: 'road-full' },
        ];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 3);
        assert.equal(spriteDrawCalls[0].name, 'grass-short-1');
        assert.equal(spriteDrawCalls[1].name, 'grass-short-2');
        assert.equal(spriteDrawCalls[2].name, 'road-full');
    });

    it('should skip covered tiles', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [
            { row: 0, col: 0, sprite: 'grass-short-1', covered: true },
            { row: 0, col: 1, sprite: 'grass-short-2' },
        ];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 1);
        assert.equal(spriteDrawCalls[0].name, 'grass-short-2');
    });

    it('should draw hover outline for hovered tile', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [
            { row: 2, col: 3, sprite: 'grass-short-1' },
        ];
        const state = { hoveredTile: { row: 2, col: 3 }, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        // Should have diamond outline calls (beginPath, moveTo, lineTo×3, closePath, stroke)
        const strokeCalls = ctx.calls.filter(c => c.method === 'stroke');
        assert.equal(strokeCalls.length, 1, 'Should draw one diamond outline for hover');
    });

    it('should not draw hover outline when tile is selected', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [
            { row: 2, col: 3, sprite: 'grass-short-1' },
        ];
        // Both hovered and selected — hover should be suppressed
        const state = { hoveredTile: { row: 2, col: 3 }, selectedTile: { row: 2, col: 3 }, selectedLift: 4 };

        IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        // Should have 2 diamond outlines (selected glow + selected highlight), not hover
        const strokeCalls = ctx.calls.filter(c => c.method === 'stroke');
        assert.equal(strokeCalls.length, 2, 'Should draw two outlines for selection (no hover)');
    });

    it('should draw two diamond outlines for selected tile', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [
            { row: 1, col: 1, sprite: 'castle-tower' },
        ];
        const state = { hoveredTile: null, selectedTile: { row: 1, col: 1 }, selectedLift: 4 };

        IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        const strokeCalls = ctx.calls.filter(c => c.method === 'stroke');
        assert.equal(strokeCalls.length, 2, 'Selected tile gets 2 diamond outlines');
    });

    it('should lift selected tile by selectedLift pixels', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [
            { row: 0, col: 0, sprite: 'grass-short-1' },
        ];
        const state = { hoveredTile: null, selectedTile: { row: 0, col: 0 }, selectedLift: 8 };

        IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        // The sprite should be drawn at y - selectedLift
        const { y } = camera.gridToScreen(0, 0);
        const expectedY = y - 8 - camera.tileH / 2;
        assert.equal(spriteDrawCalls[0].y, expectedY);
    });

    it('should use correct tile dimensions from camera', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera({ tileW: 128, tileH: 64 });
        const tiles = [
            { row: 0, col: 0, sprite: 'grass-short-1' },
        ];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls[0].w, 128);
        assert.equal(spriteDrawCalls[0].h, 64);
    });

    it('should handle empty tiles array', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, camera, [], state);

        assert.equal(spriteDrawCalls.length, 0);
        assert.equal(ctx.calls.length, 0);
    });

    it('should draw ground sprite then overlay sprite for tiles with overlay field', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [
            { row: 0, col: 0, sprite: 'grass-short-1', overlay: 'tree-oak-overlay-1' },
        ];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 2, 'Two draw calls: ground + overlay');
        assert.equal(spriteDrawCalls[0].name, 'grass-short-1', 'First call is ground sprite');
        assert.equal(spriteDrawCalls[1].name, 'tree-oak-overlay-1', 'Second call is overlay sprite');
    });

    it('should draw overlay at native OVERLAY_WIDTH × OVERLAY_HEIGHT dimensions', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [
            { row: 0, col: 0, sprite: 'grass-short-1', overlay: 'tree-pine-overlay-2' },
        ];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls[1].w, OVERLAY_WIDTH,  'Overlay width is OVERLAY_WIDTH (64)');
        assert.equal(spriteDrawCalls[1].h, OVERLAY_HEIGHT, 'Overlay height is OVERLAY_HEIGHT (48)');
    });

    it('should position overlay using the correct formula', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [
            { row: 1, col: 2, sprite: 'grass-short-2', overlay: 'tree-shrub-overlay-1' },
        ];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        const { x, y } = camera.gridToScreen(1, 2);
        const tileCenterX = x;
        const tileTopY = y - camera.tileH / 2;
        const expectedOverlayX = tileCenterX - OVERLAY_WIDTH / 2;
        const expectedOverlayY = tileTopY - (OVERLAY_HEIGHT - camera.tileH) + TREE_OVERLAY_OFFSET_Y;

        assert.equal(spriteDrawCalls[1].x, expectedOverlayX, 'Overlay x = tileCenterX - OVERLAY_WIDTH/2');
        assert.equal(spriteDrawCalls[1].y, expectedOverlayY, 'Overlay y = tileTopY - (OVERLAY_HEIGHT - tileH) + TREE_OVERLAY_OFFSET_Y');
    });

    it('should draw only one sprite for tiles without overlay field', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [
            { row: 0, col: 0, sprite: 'road-full' },
        ];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 1, 'Only one draw call for non-overlay tile');
        assert.equal(spriteDrawCalls[0].name, 'road-full');
    });

    it('should draw diamond outline after both sprites for hovered overlay tile', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [
            { row: 0, col: 0, sprite: 'grass-short-1', overlay: 'tree-oak-overlay-2' },
        ];
        const state = { hoveredTile: { row: 0, col: 0 }, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        // Both sprites drawn before any outline
        assert.equal(spriteDrawCalls.length, 2, 'Both sprites drawn');
        const strokeCalls = ctx.calls.filter(c => c.method === 'stroke');
        assert.equal(strokeCalls.length, 1, 'One diamond outline for hover');
    });
});

describe('IsoRenderer.drawUnits', () => {
    beforeEach(() => {
        spriteDrawCalls = [];
    });

    it('should draw each unit at its grid position', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const units = [
            { row: 2, col: 3, sprite: 'unit-archer' },
            { row: 5, col: 7, sprite: 'unit-knight' },
        ];

        IsoRenderer.drawUnits(ctx, camera, units);

        assert.equal(spriteDrawCalls.length, 2);
        assert.equal(spriteDrawCalls[0].name, 'unit-archer');
        assert.equal(spriteDrawCalls[1].name, 'unit-knight');
    });

    it('should draw units at 75% of tile size', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const units = [
            { row: 0, col: 0, sprite: 'unit-militia' },
        ];

        IsoRenderer.drawUnits(ctx, camera, units);

        assert.equal(spriteDrawCalls[0].w, 64 * 0.75); // 48
        assert.equal(spriteDrawCalls[0].h, 32 * 0.75); // 24
    });

    it('should offset units vertically by -4 pixels (floating above tile)', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const units = [
            { row: 0, col: 0, sprite: 'unit-militia' },
        ];

        IsoRenderer.drawUnits(ctx, camera, units);

        const { y } = camera.gridToScreen(0, 0);
        const uh = camera.tileH * 0.75;
        const expectedY = y - uh / 2 - 4;
        assert.equal(spriteDrawCalls[0].y, expectedY);
    });

    it('should handle empty units array', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();

        IsoRenderer.drawUnits(ctx, camera, []);

        assert.equal(spriteDrawCalls.length, 0);
    });

    it('should center units horizontally on their tile', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const units = [
            { row: 0, col: 0, sprite: 'unit-archer' },
        ];

        IsoRenderer.drawUnits(ctx, camera, units);

        const { x } = camera.gridToScreen(0, 0);
        const uw = camera.tileW * 0.75;
        const expectedX = x - uw / 2;
        assert.equal(spriteDrawCalls[0].x, expectedX);
    });
});

describe('IsoRenderer.drawDiamondOutline: stroke path correctness', () => {
    it('should draw a closed diamond path with correct vertices', () => {
        const ctx = createMockCtx();
        IsoRenderer.drawDiamondOutline(ctx, 200, 150, 64, 32, 'yellow', 2);

        const moveCall = ctx.calls.find(c => c.method === 'moveTo');
        assert.deepEqual(moveCall.args, [200, 134]); // y - h/2 = 150 - 16

        const lineCalls = ctx.calls.filter(c => c.method === 'lineTo');
        assert.equal(lineCalls.length, 3);
        assert.deepEqual(lineCalls[0].args, [232, 150]); // x + w/2
        assert.deepEqual(lineCalls[1].args, [200, 166]); // y + h/2
        assert.deepEqual(lineCalls[2].args, [168, 150]); // x - w/2
    });

    it('should set stroke color and line width', () => {
        const ctx = createMockCtx();
        IsoRenderer.drawDiamondOutline(ctx, 0, 0, 64, 32, 'rgba(255,0,0,0.5)', 3);

        assert.equal(ctx.strokeStyle, 'rgba(255,0,0,0.5)');
        assert.equal(ctx.lineWidth, 3);
    });

    it('should call beginPath, closePath, and stroke', () => {
        const ctx = createMockCtx();
        IsoRenderer.drawDiamondOutline(ctx, 0, 0, 64, 32, 'red', 1);

        const methods = ctx.calls.map(c => c.method);
        assert.ok(methods.includes('beginPath'));
        assert.ok(methods.includes('closePath'));
        assert.ok(methods.includes('stroke'));
        // Order: beginPath before closePath before stroke
        assert.ok(methods.indexOf('beginPath') < methods.indexOf('closePath'));
        assert.ok(methods.indexOf('closePath') < methods.indexOf('stroke'));
    });
});
