/**
 * Canvas mock tests for IsoRenderer.drawTerrain, drawUnits, drawDiamondOutline.
 *
 * Recommendation 1: Add canvas-mock tests for IsoRenderer.drawTerrain and drawUnits.
 *
 * IsoRenderer has no module.exports (browser global), so the implementation is
 * replicated inline here — same pattern as hud-render.spec.js.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-renderer-canvas-mock.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Canvas Context Mock ─────────────────────────────────────────────────────

function createMockCtx() {
    const calls = [];
    return {
        calls,
        strokeStyle: null,
        lineWidth: null,
        beginPath()      { calls.push({ method: 'beginPath' }); },
        moveTo(x, y)     { calls.push({ method: 'moveTo',    args: [x, y] }); },
        lineTo(x, y)     { calls.push({ method: 'lineTo',    args: [x, y] }); },
        closePath()      { calls.push({ method: 'closePath' }); },
        stroke()         { calls.push({ method: 'stroke' }); },
    };
}

// ─── Mock SpriteManager ──────────────────────────────────────────────────────

let spriteDrawCalls = [];
const MockSpriteManager = {
    draw(ctx, name, x, y, w, h) {
        spriteDrawCalls.push({ name, x, y, w, h });
    },
};

// ─── Mock Camera ─────────────────────────────────────────────────────────────
// Simple camera: gridToScreen(row, col) => { x: col * 64, y: row * 32 }

const mockCamera = {
    tileW: 64,
    tileH: 32,
    gridToScreen(row, col) {
        return { x: col * 64, y: row * 32 };
    },
};

// ─── IsoRenderer replica ─────────────────────────────────────────────────────
// Replicated inline because the source file has no module.exports.
// SpriteManager calls are routed to MockSpriteManager so tests can inspect them.

const TREE_OVERLAY_OFFSET_Y = 0;
const OVERLAY_WIDTH = 64;
const OVERLAY_HEIGHT = 48;

const IsoRenderer = {
    drawTerrain(ctx, camera, tiles, state) {
        for (const tile of tiles) {
            if (tile.covered) continue;
            let { x, y } = camera.gridToScreen(tile.row, tile.col);

            const isSelected = state.selectedTile &&
                tile.row === state.selectedTile.row &&
                tile.col === state.selectedTile.col;
            if (isSelected) y -= state.selectedLift;

            // Ground pass — always draw tile.sprite at standard tile dimensions
            MockSpriteManager.draw(
                ctx, tile.sprite,
                x - camera.tileW / 2,
                y - camera.tileH / 2,
                camera.tileW,
                camera.tileH,
            );

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
                tile.row === state.hoveredTile.row &&
                tile.col === state.hoveredTile.col;
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
    },
};

// ─── Tests: drawTerrain ───────────────────────────────────────────────────────

describe('IsoRenderer.drawTerrain (canvas mock)', () => {
    beforeEach(() => { spriteDrawCalls = []; });

    it('calls SpriteManager.draw once per non-covered tile', () => {
        const ctx = createMockCtx();
        const tiles = [
            { row: 0, col: 0, sprite: 'grass-short-1' },
            { row: 0, col: 1, sprite: 'grass-short-2' },
            { row: 1, col: 0, sprite: 'road-full' },
        ];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, mockCamera, tiles, state);

        assert.equal(spriteDrawCalls.length, 3);
        assert.equal(spriteDrawCalls[0].name, 'grass-short-1');
        assert.equal(spriteDrawCalls[1].name, 'grass-short-2');
        assert.equal(spriteDrawCalls[2].name, 'road-full');
    });

    it('skips tiles where tile.covered === true', () => {
        const ctx = createMockCtx();
        const tiles = [
            { row: 0, col: 0, sprite: 'grass-short-1', covered: true },
            { row: 0, col: 1, sprite: 'grass-short-2', covered: true },
            { row: 1, col: 0, sprite: 'road-full' },
        ];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, mockCamera, tiles, state);

        assert.equal(spriteDrawCalls.length, 1);
        assert.equal(spriteDrawCalls[0].name, 'road-full');
    });

    it('applies selectedLift offset to y for the selected tile', () => {
        const ctx = createMockCtx();
        const tiles = [{ row: 2, col: 3, sprite: 'castle-tower' }];
        const state = { hoveredTile: null, selectedTile: { row: 2, col: 3 }, selectedLift: 8 };

        IsoRenderer.drawTerrain(ctx, mockCamera, tiles, state);

        // gridToScreen(2,3) => { x: 192, y: 64 }
        // y after lift: 64 - 8 = 56
        // sprite y: 56 - tileH/2 = 56 - 16 = 40
        const { y: rawY } = mockCamera.gridToScreen(2, 3);
        const expectedY = rawY - 8 - mockCamera.tileH / 2;
        assert.equal(spriteDrawCalls[0].y, expectedY);
    });

    it('calls drawDiamondOutline once for a hovered (non-selected) tile', () => {
        const ctx = createMockCtx();
        const tiles = [{ row: 1, col: 2, sprite: 'grass-short-1' }];
        const state = { hoveredTile: { row: 1, col: 2 }, selectedTile: null, selectedLift: 0 };

        IsoRenderer.drawTerrain(ctx, mockCamera, tiles, state);

        const strokeCalls = ctx.calls.filter(c => c.method === 'stroke');
        assert.equal(strokeCalls.length, 1, 'one diamond outline for hover');
    });

    it('calls drawDiamondOutline twice for a selected tile (yellow + glow), not hover', () => {
        const ctx = createMockCtx();
        // tile is both hovered and selected — hover outline must be suppressed
        const tiles = [{ row: 1, col: 2, sprite: 'grass-short-1' }];
        const state = {
            hoveredTile: { row: 1, col: 2 },
            selectedTile: { row: 1, col: 2 },
            selectedLift: 4,
        };

        IsoRenderer.drawTerrain(ctx, mockCamera, tiles, state);

        const strokeCalls = ctx.calls.filter(c => c.method === 'stroke');
        assert.equal(strokeCalls.length, 2, 'two diamond outlines for selected tile (no hover)');
    });
});

// ─── Tests: drawUnits ────────────────────────────────────────────────────────

describe('IsoRenderer.drawUnits (canvas mock)', () => {
    beforeEach(() => { spriteDrawCalls = []; });

    it('calls SpriteManager.draw once per unit with tileW * 0.75 width', () => {
        const ctx = createMockCtx();
        const units = [
            { row: 0, col: 0, sprite: 'unit-archer' },
            { row: 1, col: 2, sprite: 'unit-knight' },
        ];

        IsoRenderer.drawUnits(ctx, mockCamera, units);

        assert.equal(spriteDrawCalls.length, 2);
        assert.equal(spriteDrawCalls[0].name, 'unit-archer');
        assert.equal(spriteDrawCalls[1].name, 'unit-knight');
        // width must be tileW * 0.75
        assert.equal(spriteDrawCalls[0].w, mockCamera.tileW * 0.75);
        assert.equal(spriteDrawCalls[1].w, mockCamera.tileW * 0.75);
    });

    it('draws units at tileH * 0.75 height', () => {
        const ctx = createMockCtx();
        const units = [{ row: 0, col: 0, sprite: 'unit-militia' }];

        IsoRenderer.drawUnits(ctx, mockCamera, units);

        assert.equal(spriteDrawCalls[0].h, mockCamera.tileH * 0.75);
    });

    it('handles an empty units array without errors', () => {
        const ctx = createMockCtx();
        IsoRenderer.drawUnits(ctx, mockCamera, []);
        assert.equal(spriteDrawCalls.length, 0);
    });
});

// ─── Tests: drawDiamondOutline ────────────────────────────────────────────────

describe('IsoRenderer.drawDiamondOutline (canvas mock)', () => {
    it('calls ctx.beginPath, ctx.moveTo, ctx.lineTo (3×), ctx.closePath, ctx.stroke', () => {
        const ctx = createMockCtx();
        IsoRenderer.drawDiamondOutline(ctx, 100, 80, 64, 32, 'yellow', 2);

        const methods = ctx.calls.map(c => c.method);
        assert.ok(methods.includes('beginPath'),  'must call beginPath');
        assert.ok(methods.includes('moveTo'),     'must call moveTo');
        assert.ok(methods.includes('closePath'),  'must call closePath');
        assert.ok(methods.includes('stroke'),     'must call stroke');

        const lineToCalls = ctx.calls.filter(c => c.method === 'lineTo');
        assert.equal(lineToCalls.length, 3, 'must call lineTo exactly 3 times');
    });

    it('draws correct diamond vertices for given x, y, w, h', () => {
        const ctx = createMockCtx();
        // x=200, y=150, w=64, h=32
        IsoRenderer.drawDiamondOutline(ctx, 200, 150, 64, 32, 'red', 1);

        const moveCall = ctx.calls.find(c => c.method === 'moveTo');
        assert.deepEqual(moveCall.args, [200, 134]); // y - h/2 = 150 - 16

        const lineCalls = ctx.calls.filter(c => c.method === 'lineTo');
        assert.deepEqual(lineCalls[0].args, [232, 150]); // x + w/2
        assert.deepEqual(lineCalls[1].args, [200, 166]); // y + h/2
        assert.deepEqual(lineCalls[2].args, [168, 150]); // x - w/2
    });

    it('sets strokeStyle and lineWidth on ctx', () => {
        const ctx = createMockCtx();
        IsoRenderer.drawDiamondOutline(ctx, 0, 0, 64, 32, 'rgba(255,0,0,0.5)', 3);

        assert.equal(ctx.strokeStyle, 'rgba(255,0,0,0.5)');
        assert.equal(ctx.lineWidth, 3);
    });

    it('calls methods in correct order: beginPath → moveTo → lineTo×3 → closePath → stroke', () => {
        const ctx = createMockCtx();
        IsoRenderer.drawDiamondOutline(ctx, 0, 0, 64, 32, 'blue', 1);

        const methods = ctx.calls.map(c => c.method);
        assert.equal(methods[0], 'beginPath');
        assert.equal(methods[1], 'moveTo');
        assert.equal(methods[2], 'lineTo');
        assert.equal(methods[3], 'lineTo');
        assert.equal(methods[4], 'lineTo');
        assert.equal(methods[5], 'closePath');
        assert.equal(methods[6], 'stroke');
    });
});
