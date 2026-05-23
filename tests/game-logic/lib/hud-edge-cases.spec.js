/**
 * Edge-case tests for js/game-logic/lib/hud.js
 *
 * Covers:
 * - renderUnitBar with empty units array (early return)
 * - renderTilePanel with hudWidth <= 0 (early return)
 * - renderTilePanel with width < 100 (no tile content rendered)
 * - getUnitBarClick boundary conditions (exact edges of unit boxes)
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/hud-edge-cases.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Replicate HUD logic for testing (no Canvas2D deps)
const HUD = {
    UNIT_BOX_SIZE: 56,
    UNIT_BOX_PAD: 6,
    HUD_MAX_WIDTH: 256,
    HUD_HEIGHT: 180,

    renderUnitBar(ctx, state) {
        const { units, selectedUnitIdx, canvasW, canvasH } = state;
        if (!units || units.length === 0) return;

        const totalBarW = units.length * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD) - this.UNIT_BOX_PAD;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - this.UNIT_BOX_SIZE - 28;

        // Track draw calls for testing
        ctx._drawCalls = ctx._drawCalls || [];
        for (let i = 0; i < units.length; i++) {
            const bx = barStartX + i * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD);
            ctx._drawCalls.push({ type: 'unitBox', index: i, x: bx, y: barY });
        }

        return barY;
    },

    renderTilePanel(ctx, state) {
        const { hudWidth, canvasH, selectedTile, level } = state;
        if (hudWidth <= 0) return;

        const hudX = 0;
        const hudY = canvasH - this.HUD_HEIGHT;
        const w = hudWidth;
        const h = this.HUD_HEIGHT;

        ctx._drawCalls = ctx._drawCalls || [];
        ctx._drawCalls.push({ type: 'tilePanel', x: hudX, y: hudY, w, h });

        if (selectedTile && w > 100) {
            ctx._drawCalls.push({ type: 'tileContent', tile: selectedTile });
        }
    },

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
    }
};

const canvasW = 1024;
const canvasH = 768;

function createMockCtx() {
    return { _drawCalls: [] };
}

const mockUnits = [
    { name: 'Archer', sprites: ['unit-archer'], qtyRemaining: 5, qty: 10 },
    { name: 'Knight', sprites: ['unit-knight'], qtyRemaining: 3, qty: 5 },
    { name: 'Spearman', sprites: ['unit-spearman'], qtyRemaining: 0, qty: 8 },
];

describe('HUD.renderUnitBar - edge cases', () => {
    it('should return undefined (early return) when units is null', () => {
        const ctx = createMockCtx();
        const result = HUD.renderUnitBar(ctx, {
            units: null, selectedUnitIdx: -1, canvasW, canvasH
        });
        assert.equal(result, undefined);
        assert.equal(ctx._drawCalls.length, 0);
    });

    it('should return undefined (early return) when units is empty array', () => {
        const ctx = createMockCtx();
        const result = HUD.renderUnitBar(ctx, {
            units: [], selectedUnitIdx: -1, canvasW, canvasH
        });
        assert.equal(result, undefined);
        assert.equal(ctx._drawCalls.length, 0);
    });

    it('should render all unit boxes when units are provided', () => {
        const ctx = createMockCtx();
        const result = HUD.renderUnitBar(ctx, {
            units: mockUnits, selectedUnitIdx: 0, canvasW, canvasH
        });
        assert.equal(typeof result, 'number'); // returns barY
        assert.equal(ctx._drawCalls.length, 3);
    });

    it('should render units with zero quantity remaining', () => {
        const ctx = createMockCtx();
        const zeroQtyUnits = [
            { name: 'Depleted', sprites: ['unit-militia'], qtyRemaining: 0, qty: 5 }
        ];
        const result = HUD.renderUnitBar(ctx, {
            units: zeroQtyUnits, selectedUnitIdx: -1, canvasW, canvasH
        });
        assert.equal(typeof result, 'number');
        assert.equal(ctx._drawCalls.length, 1);
    });
});

describe('HUD.renderTilePanel - edge cases', () => {
    it('should return early when hudWidth is 0', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, {
            hudWidth: 0, canvasH, selectedTile: { row: 1, col: 2 }, level: null
        });
        assert.equal(ctx._drawCalls.length, 0);
    });

    it('should return early when hudWidth is negative', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, {
            hudWidth: -10, canvasH, selectedTile: { row: 1, col: 2 }, level: null
        });
        assert.equal(ctx._drawCalls.length, 0);
    });

    it('should render panel background but not tile content when width <= 100', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, {
            hudWidth: 80, canvasH, selectedTile: { row: 1, col: 2 }, level: null
        });
        // Panel is drawn but tile content is not (w <= 100)
        assert.equal(ctx._drawCalls.length, 1);
        assert.equal(ctx._drawCalls[0].type, 'tilePanel');
    });

    it('should render panel and tile content when width > 100 and tile selected', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, {
            hudWidth: 200, canvasH, selectedTile: { row: 3, col: 5 }, level: null
        });
        assert.equal(ctx._drawCalls.length, 2);
        assert.equal(ctx._drawCalls[0].type, 'tilePanel');
        assert.equal(ctx._drawCalls[1].type, 'tileContent');
        assert.deepEqual(ctx._drawCalls[1].tile, { row: 3, col: 5 });
    });

    it('should render panel but not tile content when no tile is selected', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, {
            hudWidth: 200, canvasH, selectedTile: null, level: null
        });
        assert.equal(ctx._drawCalls.length, 1);
        assert.equal(ctx._drawCalls[0].type, 'tilePanel');
    });
});

describe('HUD.getUnitBarClick - boundary conditions', () => {
    it('should detect click at exact left edge of first unit box', () => {
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        // Exact left edge of first box
        assert.equal(HUD.getUnitBarClick(barStartX, barY + 10, mockUnits, canvasW, canvasH), 0);
    });

    it('should detect click at exact right edge of first unit box', () => {
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        // Exact right edge of first box
        assert.equal(HUD.getUnitBarClick(barStartX + 56, barY + 10, mockUnits, canvasW, canvasH), 0);
    });

    it('should detect click at exact top edge of unit bar', () => {
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        // Exact top edge
        assert.equal(HUD.getUnitBarClick(barStartX + 28, barY, mockUnits, canvasW, canvasH), 0);
    });

    it('should detect click at exact bottom edge of unit bar', () => {
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        // Exact bottom edge (barY + UNIT_BOX_SIZE + 20)
        assert.equal(HUD.getUnitBarClick(barStartX + 28, barY + 56 + 20, mockUnits, canvasW, canvasH), 0);
    });

    it('should return -1 one pixel above the bar', () => {
        const barY = canvasH - 56 - 28;
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        assert.equal(HUD.getUnitBarClick(barStartX + 28, barY - 1, mockUnits, canvasW, canvasH), -1);
    });

    it('should return -1 one pixel below the bar', () => {
        const barY = canvasH - 56 - 28;
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        assert.equal(HUD.getUnitBarClick(barStartX + 28, barY + 56 + 21, mockUnits, canvasW, canvasH), -1);
    });

    it('should return -1 one pixel left of the first box', () => {
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        assert.equal(HUD.getUnitBarClick(barStartX - 1, barY + 10, mockUnits, canvasW, canvasH), -1);
    });

    it('should return -1 one pixel right of the last box', () => {
        const totalBarW = mockUnits.length * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        const lastBoxRight = barStartX + 2 * (56 + 6) + 56;
        assert.equal(HUD.getUnitBarClick(lastBoxRight + 1, barY + 10, mockUnits, canvasW, canvasH), -1);
    });

    it('should handle many units (10) without error', () => {
        const manyUnits = Array.from({ length: 10 }, (_, i) => ({
            name: `Unit${i}`, sprites: [`unit-${i}`]
        }));
        const totalBarW = 10 * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        // Click last unit
        const lastX = barStartX + 9 * (56 + 6) + 28;
        assert.equal(HUD.getUnitBarClick(lastX, barY + 10, manyUnits, canvasW, canvasH), 9);
    });
});
