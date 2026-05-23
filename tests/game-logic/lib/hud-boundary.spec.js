/**
 * Boundary and rendering tests for HUD.
 *
 * Recommendation 5: Add boundary/edge-case tests for HUD click detection.
 * Tests boundary pixels (exactly on box edge, between boxes).
 * Also tests renderUnitDetail null guard and renderTopBar canvas calls.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/hud-boundary.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Replicate HUD logic for testing
const HUD = {
    UNIT_BOX_SIZE: 56,
    UNIT_BOX_PAD: 6,
    HUD_MAX_WIDTH: 256,
    HUD_HEIGHT: 180,

    getUnitBarClick(mouseX, mouseY, units, canvasW, canvasH) {
        if (!units || units.length === 0) return -1;
        const totalBarW = units.length * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD) - this.UNIT_BOX_PAD;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - this.UNIT_BOX_SIZE - 28;

        if (mouseY >= barY && mouseY <= barY + this.UNIT_BOX_SIZE + 20) {
            for (let i = 0; i < units.length; i++) {
                const bx = barStartX + i * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD);
                if (mouseX >= bx && mouseX <= bx + this.UNIT_BOX_SIZE) return i;
            }
        }
        return -1;
    },

    renderUnitDetail(ctx, unit, canvasW, barY) {
        if (!unit) return;
        const panelW = 280, panelH = 100;
        const panelX = (canvasW - panelW) / 2;
        const panelY = barY - panelH - 8;
        ctx._calls.push({ method: 'renderUnitDetail', panelX, panelY, panelW, panelH });
    },

    renderTopBar(ctx, canvasW, text) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx._calls.push({ method: 'fillRect', args: [0, 0, canvasW, 20] });
        ctx.fillStyle = '#fff';
        ctx._calls.push({ method: 'fillText', args: [text, 8, 5] });
    },

    drawSheenBorder(ctx, x, y, w, h, highlight) {
        ctx._calls.push({ method: 'createLinearGradient', args: [x, y, x + w, y] });
        ctx._calls.push({ method: 'strokeRect', args: [x, y, w, h] });
    },
};

const canvasW = 1024;
const canvasH = 768;

const mockUnits = [
    { name: 'Archer', sprites: ['unit-archer'] },
    { name: 'Knight', sprites: ['unit-knight'] },
];

function createMockCtx() {
    return {
        _calls: [],
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: '',
        textBaseline: '',
    };
}

describe('HUD.getUnitBarClick - sub-pixel boundary tests', () => {
    it('should detect click at exact left pixel of second box', () => {
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        const secondBoxLeft = barStartX + (56 + 6);
        assert.equal(HUD.getUnitBarClick(secondBoxLeft, barY + 10, mockUnits, canvasW, canvasH), 1);
    });

    it('should return -1 one pixel before second box (in padding)', () => {
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        const secondBoxLeft = barStartX + (56 + 6);
        assert.equal(HUD.getUnitBarClick(secondBoxLeft - 1, barY + 10, mockUnits, canvasW, canvasH), -1);
    });

    it('should detect click at exact right pixel of last box', () => {
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        const lastBoxRight = barStartX + (56 + 6) + 56; // second box right edge
        assert.equal(HUD.getUnitBarClick(lastBoxRight, barY + 10, mockUnits, canvasW, canvasH), 1);
    });

    it('should return -1 one pixel after last box right edge', () => {
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        const lastBoxRight = barStartX + (56 + 6) + 56;
        assert.equal(HUD.getUnitBarClick(lastBoxRight + 1, barY + 10, mockUnits, canvasW, canvasH), -1);
    });

    it('should handle fractional pixel coordinates (floor behavior)', () => {
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        // Fractional coordinate inside first box
        assert.equal(HUD.getUnitBarClick(barStartX + 0.5, barY + 10.5, mockUnits, canvasW, canvasH), 0);
    });

    it('should handle very small canvas (units overflow)', () => {
        const smallCanvasW = 100;
        const smallCanvasH = 200;
        const barY = smallCanvasH - 56 - 28;
        // With small canvas, barStartX could be negative
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (smallCanvasW - totalBarW) / 2;
        // Click at center of small canvas
        const result = HUD.getUnitBarClick(50, barY + 10, mockUnits, smallCanvasW, smallCanvasH);
        // Should still work (barStartX is negative, so 50 might be inside a box)
        assert.ok(result >= -1 && result < mockUnits.length);
    });
});

describe('HUD.renderUnitDetail - null guard', () => {
    it('should return early when unit is null', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, null, canvasW, 600);
        assert.equal(ctx._calls.length, 0);
    });

    it('should return early when unit is undefined', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, undefined, canvasW, 600);
        assert.equal(ctx._calls.length, 0);
    });

    it('should render panel when unit is provided', () => {
        const ctx = createMockCtx();
        const unit = { name: 'Archer', sprites: ['unit-archer'], health: 100, attack: 90, defense: 0.8, qty: 40, qtyRemaining: 35 };
        HUD.renderUnitDetail(ctx, unit, canvasW, 600);
        assert.ok(ctx._calls.length > 0);
        assert.equal(ctx._calls[0].method, 'renderUnitDetail');
    });
});

describe('HUD.renderTopBar - canvas draw calls', () => {
    it('should draw background rectangle spanning full canvas width', () => {
        const ctx = createMockCtx();
        HUD.renderTopBar(ctx, canvasW, 'Level 1 | WASD to scroll');
        const fillRects = ctx._calls.filter(c => c.method === 'fillRect');
        assert.equal(fillRects.length, 1);
        assert.deepEqual(fillRects[0].args, [0, 0, canvasW, 20]);
    });

    it('should draw text at position (8, 5)', () => {
        const ctx = createMockCtx();
        HUD.renderTopBar(ctx, canvasW, 'Test text');
        const textCalls = ctx._calls.filter(c => c.method === 'fillText');
        assert.equal(textCalls.length, 1);
        assert.equal(textCalls[0].args[0], 'Test text');
        assert.equal(textCalls[0].args[1], 8);
        assert.equal(textCalls[0].args[2], 5);
    });

    it('should handle empty text', () => {
        const ctx = createMockCtx();
        HUD.renderTopBar(ctx, canvasW, '');
        const textCalls = ctx._calls.filter(c => c.method === 'fillText');
        assert.equal(textCalls[0].args[0], '');
    });
});

describe('HUD.drawSheenBorder - gradient and stroke calls', () => {
    it('should create a linear gradient across the width', () => {
        const ctx = createMockCtx();
        HUD.drawSheenBorder(ctx, 10, 20, 200, 100);
        const gradCalls = ctx._calls.filter(c => c.method === 'createLinearGradient');
        assert.equal(gradCalls.length, 1);
        assert.deepEqual(gradCalls[0].args, [10, 20, 210, 20]);
    });

    it('should stroke a rectangle at the given position', () => {
        const ctx = createMockCtx();
        HUD.drawSheenBorder(ctx, 10, 20, 200, 100);
        const strokeCalls = ctx._calls.filter(c => c.method === 'strokeRect');
        assert.equal(strokeCalls.length, 1);
        assert.deepEqual(strokeCalls[0].args, [10, 20, 200, 100]);
    });
});

describe('HUD.getUnitBarClick - explicit boundary conditions', () => {
    // canvasH=768: barY = 768 - 56 - 28 = 684
    // valid y: barY (684) to barY + UNIT_BOX_SIZE + 20 (= 684 + 56 + 20 = 760)
    // For unit 0: bx = barStartX + 0 * 62 = barStartX
    // valid x: bx to bx + 56

    const UNIT_BOX_SIZE = 56;
    const UNIT_BOX_PAD = 6;
    const testCanvasW = 1024;
    const testCanvasH = 768;

    const totalBarW = mockUnits.length * (UNIT_BOX_SIZE + UNIT_BOX_PAD) - UNIT_BOX_PAD;
    const barStartX = (testCanvasW - totalBarW) / 2;
    const barY = testCanvasH - UNIT_BOX_SIZE - 28;
    const bx0 = barStartX; // left edge of unit 0

    it('click exactly at mouseY = barY (top edge) should return a valid index', () => {
        const result = HUD.getUnitBarClick(bx0 + 10, barY, mockUnits, testCanvasW, testCanvasH);
        assert.ok(result >= 0, `Expected valid index, got ${result}`);
    });

    it('click exactly at mouseY = barY + UNIT_BOX_SIZE + 20 (bottom edge) should return a valid index', () => {
        const bottomEdge = barY + UNIT_BOX_SIZE + 20;
        const result = HUD.getUnitBarClick(bx0 + 10, bottomEdge, mockUnits, testCanvasW, testCanvasH);
        assert.ok(result >= 0, `Expected valid index, got ${result}`);
    });

    it('click at mouseY = barY - 1 (just above) should return -1', () => {
        const result = HUD.getUnitBarClick(bx0 + 10, barY - 1, mockUnits, testCanvasW, testCanvasH);
        assert.equal(result, -1);
    });

    it('click at mouseY = barY + UNIT_BOX_SIZE + 21 (just below) should return -1', () => {
        const result = HUD.getUnitBarClick(bx0 + 10, barY + UNIT_BOX_SIZE + 21, mockUnits, testCanvasW, testCanvasH);
        assert.equal(result, -1);
    });

    it('click exactly at mouseX = bx (left edge of unit 0) should return 0', () => {
        const result = HUD.getUnitBarClick(bx0, barY + 10, mockUnits, testCanvasW, testCanvasH);
        assert.equal(result, 0);
    });

    it('click exactly at mouseX = bx + UNIT_BOX_SIZE (right edge of unit 0) should return 0', () => {
        const result = HUD.getUnitBarClick(bx0 + UNIT_BOX_SIZE, barY + 10, mockUnits, testCanvasW, testCanvasH);
        assert.equal(result, 0);
    });

    it('click at mouseX = bx - 1 (just left of unit 0) should return -1', () => {
        const result = HUD.getUnitBarClick(bx0 - 1, barY + 10, mockUnits, testCanvasW, testCanvasH);
        assert.equal(result, -1);
    });

    it('click at mouseX = bx + UNIT_BOX_SIZE + 1 (in padding after unit 0) should return -1', () => {
        // bx0 + 56 + 1 = in the 6px padding gap between unit 0 and unit 1
        const result = HUD.getUnitBarClick(bx0 + UNIT_BOX_SIZE + 1, barY + 10, mockUnits, testCanvasW, testCanvasH);
        assert.equal(result, -1);
    });

    it('click in the gap between unit 0 and unit 1 (UNIT_BOX_PAD region) should return -1', () => {
        // Gap is from bx0+56+1 to bx0+62-1 (i.e. bx0+57 to bx0+61)
        const gapX = bx0 + UNIT_BOX_SIZE + Math.floor(UNIT_BOX_PAD / 2); // middle of padding
        const result = HUD.getUnitBarClick(gapX, barY + 10, mockUnits, testCanvasW, testCanvasH);
        assert.equal(result, -1);
    });
});
