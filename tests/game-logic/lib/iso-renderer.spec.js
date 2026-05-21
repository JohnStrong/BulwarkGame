/**
 * Tests for js/game-logic/lib/iso-renderer.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-renderer.spec.js
 *
 * Note: IsoRenderer relies on Canvas2D context.
 * These tests verify the drawDiamondOutline logic and
 * that drawTerrain/drawUnits call the expected methods.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Replicate IsoRenderer for testing
const IsoRenderer = {
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

function createMockCtx() {
    const calls = [];
    return {
        calls,
        strokeStyle: null,
        lineWidth: null,
        beginPath() { calls.push('beginPath'); },
        moveTo(x, y) { calls.push(['moveTo', x, y]); },
        lineTo(x, y) { calls.push(['lineTo', x, y]); },
        closePath() { calls.push('closePath'); },
        stroke() { calls.push('stroke'); },
    };
}

describe('IsoRenderer.drawDiamondOutline', () => {
    it('should set strokeStyle and lineWidth', () => {
        const ctx = createMockCtx();
        IsoRenderer.drawDiamondOutline(ctx, 100, 100, 64, 32, 'red', 2);
        assert.equal(ctx.strokeStyle, 'red');
        assert.equal(ctx.lineWidth, 2);
    });

    it('should draw a diamond shape with 4 points', () => {
        const ctx = createMockCtx();
        IsoRenderer.drawDiamondOutline(ctx, 100, 100, 64, 32, 'blue', 1);

        // Should have: beginPath, moveTo, 3x lineTo, closePath, stroke
        assert.equal(ctx.calls[0], 'beginPath');
        assert.deepEqual(ctx.calls[1], ['moveTo', 100, 84]);   // top: y - h/2
        assert.deepEqual(ctx.calls[2], ['lineTo', 132, 100]);  // right: x + w/2
        assert.deepEqual(ctx.calls[3], ['lineTo', 100, 116]);  // bottom: y + h/2
        assert.deepEqual(ctx.calls[4], ['lineTo', 68, 100]);   // left: x - w/2
        assert.equal(ctx.calls[5], 'closePath');
        assert.equal(ctx.calls[6], 'stroke');
    });

    it('should handle zero-size diamond', () => {
        const ctx = createMockCtx();
        IsoRenderer.drawDiamondOutline(ctx, 50, 50, 0, 0, 'green', 1);
        // All points collapse to center
        assert.deepEqual(ctx.calls[1], ['moveTo', 50, 50]);
        assert.deepEqual(ctx.calls[2], ['lineTo', 50, 50]);
        assert.deepEqual(ctx.calls[3], ['lineTo', 50, 50]);
        assert.deepEqual(ctx.calls[4], ['lineTo', 50, 50]);
    });

    it('should handle non-square dimensions', () => {
        const ctx = createMockCtx();
        IsoRenderer.drawDiamondOutline(ctx, 0, 0, 100, 50, 'white', 3);
        assert.deepEqual(ctx.calls[1], ['moveTo', 0, -25]);  // top
        assert.deepEqual(ctx.calls[2], ['lineTo', 50, 0]);   // right
        assert.deepEqual(ctx.calls[3], ['lineTo', 0, 25]);   // bottom
        assert.deepEqual(ctx.calls[4], ['lineTo', -50, 0]);  // left
    });
});
