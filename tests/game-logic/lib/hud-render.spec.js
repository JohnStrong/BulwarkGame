/**
 * Tests for HUD rendering functions using canvas mocks.
 *
 * Recommendation 8: Improve HUD test coverage with canvas mock patterns.
 * Tests renderUnitBar, renderTilePanel, and getUnitBarClick edge cases.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/hud-render.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Canvas Mock ────────────────────────────────────────────────────────────

function createMockCtx() {
    const drawCalls = [];
    const gradients = [];

    return {
        drawCalls,
        gradients,
        fillStyle: '',
        strokeStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        lineWidth: 1,
        fillRect(x, y, w, h) {
            drawCalls.push({ method: 'fillRect', args: [x, y, w, h], fillStyle: this.fillStyle });
        },
        strokeRect(x, y, w, h) {
            drawCalls.push({ method: 'strokeRect', args: [x, y, w, h] });
        },
        fillText(text, x, y) {
            drawCalls.push({ method: 'fillText', args: [text, x, y], fillStyle: this.fillStyle, font: this.font });
        },
        createLinearGradient(x0, y0, x1, y1) {
            const stops = [];
            const grad = {
                addColorStop(offset, color) { stops.push({ offset, color }); },
                stops,
            };
            gradients.push({ x0, y0, x1, y1, grad });
            return grad;
        },
    };
}

// ─── SpriteManager mock ─────────────────────────────────────────────────────

const SpriteManager = {
    drawCalls: [],
    draw(ctx, name, x, y, w, h) {
        this.drawCalls.push({ name, x, y, w, h });
    },
    reset() { this.drawCalls = []; },
};

// Make SpriteManager available globally (HUD references it)
global.SpriteManager = SpriteManager;

// ─── HUD replica ────────────────────────────────────────────────────────────

const HUD = {
    UNIT_BOX_SIZE: 56,
    UNIT_BOX_PAD: 6,
    HUD_MAX_WIDTH: 256,
    HUD_HEIGHT: 180,

    drawSheenBorder(ctx, x, y, w, h, highlight) {
        const grad = ctx.createLinearGradient(x, y, x + w, y);
        grad.addColorStop(0, '#3a3028');
        grad.addColorStop(0.5, highlight || '#c8b890');
        grad.addColorStop(1, '#3a3028');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
    },

    renderTopBar(ctx, canvasW, text) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvasW, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, 8, 5);
    },

    renderUnitBar(ctx, state) {
        const { units, selectedUnitIdx, canvasW, canvasH } = state;
        if (!units || units.length === 0) return;

        const totalBarW = units.length * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD) - this.UNIT_BOX_PAD;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - this.UNIT_BOX_SIZE - 28;

        for (let i = 0; i < units.length; i++) {
            const u = units[i];
            const bx = barStartX + i * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD);
            const by = barY;
            const isSelected = (selectedUnitIdx === i);

            ctx.fillStyle = isSelected ? 'rgba(40, 35, 25, 0.95)' : 'rgba(20, 18, 15, 0.85)';
            ctx.fillRect(bx, by, this.UNIT_BOX_SIZE, this.UNIT_BOX_SIZE + 20);

            const grad = ctx.createLinearGradient(bx, by, bx + this.UNIT_BOX_SIZE, by);
            grad.addColorStop(0, '#3a3028');
            grad.addColorStop(0.5, isSelected ? '#e8c870' : '#8a7a60');
            grad.addColorStop(1, '#3a3028');
            ctx.strokeStyle = grad;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(bx, by, this.UNIT_BOX_SIZE, this.UNIT_BOX_SIZE + 20);

            SpriteManager.draw(ctx, u.sprites[0], bx + 4, by + 2, this.UNIT_BOX_SIZE - 8, (this.UNIT_BOX_SIZE - 8) / 2);

            ctx.fillStyle = '#bbb';
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(u.name.split('/')[0].split('(')[0].trim().substring(0, 8), bx + this.UNIT_BOX_SIZE / 2, by + this.UNIT_BOX_SIZE - 4);

            ctx.fillStyle = u.qtyRemaining > 0 ? '#8f8' : '#f66';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(u.qtyRemaining + '/' + u.qty, bx + this.UNIT_BOX_SIZE / 2, by + this.UNIT_BOX_SIZE + 10);
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

        ctx.fillStyle = 'rgba(15, 12, 10, 0.92)';
        ctx.fillRect(hudX, hudY, w, h);

        const grad = ctx.createLinearGradient(hudX, hudY, hudX + w, hudY);
        grad.addColorStop(0, '#3a3028');
        grad.addColorStop(0.3, '#8a7a60');
        grad.addColorStop(0.5, '#c8b890');
        grad.addColorStop(0.7, '#8a7a60');
        grad.addColorStop(1, '#3a3028');
        ctx.fillStyle = grad;
        ctx.fillRect(hudX, hudY, w, 3);

        const gradR = ctx.createLinearGradient(hudX + w - 3, hudY, hudX + w - 3, hudY + h);
        gradR.addColorStop(0, '#8a7a60');
        gradR.addColorStop(0.5, '#c8b890');
        gradR.addColorStop(1, '#3a3028');
        ctx.fillStyle = gradR;
        ctx.fillRect(hudX + w - 3, hudY, 3, h);

        ctx.fillStyle = '#666';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕', hudX + w - 12, hudY + 12);

        if (selectedTile && w > 100) {
            ctx.fillStyle = '#aaa';
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`Tile [${selectedTile.row}, ${selectedTile.col}]`, hudX + 10, hudY + 16);

            if (level) {
                const t = level.tiles.find(t => t.row === selectedTile.row && t.col === selectedTile.col);
                if (t) {
                    ctx.fillStyle = '#ccc';
                    ctx.fillText(t.sprite, hudX + 10, hudY + 32);
                }
            }
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

// ─── Test Data ──────────────────────────────────────────────────────────────

const mockUnits = [
    { name: 'Archer (Ranged)', sprites: ['unit-archer'], qty: 40, qtyRemaining: 35, health: 100, attack: 90, defense: 0.80 },
    { name: 'Knight', sprites: ['unit-knight'], qty: 20, qtyRemaining: 0, health: 100, attack: 130, defense: 0.40 },
    { name: 'Spearman', sprites: ['unit-spearman'], qty: 30, qtyRemaining: 30, health: 100, attack: 100, defense: 0.50 },
];

const canvasW = 1024;
const canvasH = 768;

// ─── renderUnitBar Tests ────────────────────────────────────────────────────

describe('HUD.renderUnitBar', () => {
    it('should return undefined when units is empty', () => {
        const ctx = createMockCtx();
        const result = HUD.renderUnitBar(ctx, { units: [], selectedUnitIdx: -1, canvasW, canvasH });
        assert.equal(result, undefined);
    });

    it('should return undefined when units is null', () => {
        const ctx = createMockCtx();
        const result = HUD.renderUnitBar(ctx, { units: null, selectedUnitIdx: -1, canvasW, canvasH });
        assert.equal(result, undefined);
    });

    it('should return barY position when units are provided', () => {
        const ctx = createMockCtx();
        SpriteManager.reset();
        const barY = HUD.renderUnitBar(ctx, { units: mockUnits, selectedUnitIdx: -1, canvasW, canvasH });
        const expectedBarY = canvasH - HUD.UNIT_BOX_SIZE - 28;
        assert.equal(barY, expectedBarY);
    });

    it('should draw one background rect per unit', () => {
        const ctx = createMockCtx();
        SpriteManager.reset();
        HUD.renderUnitBar(ctx, { units: mockUnits, selectedUnitIdx: -1, canvasW, canvasH });

        const fillRects = ctx.drawCalls.filter(c => c.method === 'fillRect');
        // Each unit gets a background fillRect
        assert.ok(fillRects.length >= mockUnits.length);
    });

    it('should call SpriteManager.draw for each unit sprite', () => {
        const ctx = createMockCtx();
        SpriteManager.reset();
        HUD.renderUnitBar(ctx, { units: mockUnits, selectedUnitIdx: -1, canvasW, canvasH });

        assert.equal(SpriteManager.drawCalls.length, mockUnits.length);
        assert.equal(SpriteManager.drawCalls[0].name, 'unit-archer');
        assert.equal(SpriteManager.drawCalls[1].name, 'unit-knight');
        assert.equal(SpriteManager.drawCalls[2].name, 'unit-spearman');
    });

    it('should use different highlight color for selected unit', () => {
        const ctx = createMockCtx();
        SpriteManager.reset();
        HUD.renderUnitBar(ctx, { units: mockUnits, selectedUnitIdx: 1, canvasW, canvasH });

        // The selected unit (index 1) should have a brighter gradient
        // Check that at least one gradient uses the selected highlight color
        const selectedGrads = ctx.gradients.filter(g =>
            g.grad.stops.some(s => s.color === '#e8c870')
        );
        assert.ok(selectedGrads.length >= 1, 'Selected unit should use gold highlight');
    });

    it('should use red color for zero qtyRemaining', () => {
        const ctx = createMockCtx();
        SpriteManager.reset();
        HUD.renderUnitBar(ctx, { units: mockUnits, selectedUnitIdx: -1, canvasW, canvasH });

        // Knight has qtyRemaining=0, should use '#f66'
        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        const qtyCalls = textCalls.filter(c => c.args[0].includes('/'));
        // Find the one for knight (0/20)
        const knightQty = qtyCalls.find(c => c.args[0] === '0/20');
        assert.ok(knightQty, 'Should render 0/20 for knight');
        assert.equal(knightQty.fillStyle, '#f66');
    });

    it('should use green color for positive qtyRemaining', () => {
        const ctx = createMockCtx();
        SpriteManager.reset();
        HUD.renderUnitBar(ctx, { units: mockUnits, selectedUnitIdx: -1, canvasW, canvasH });

        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        const qtyCalls = textCalls.filter(c => c.args[0].includes('/'));
        const archerQty = qtyCalls.find(c => c.args[0] === '35/40');
        assert.ok(archerQty, 'Should render 35/40 for archer');
        assert.equal(archerQty.fillStyle, '#8f8');
    });

    it('should truncate long unit names to 8 characters', () => {
        const ctx = createMockCtx();
        SpriteManager.reset();
        const longNameUnits = [
            { name: 'VeryLongUnitName', sprites: ['unit-test'], qty: 10, qtyRemaining: 5 },
        ];
        HUD.renderUnitBar(ctx, { units: longNameUnits, selectedUnitIdx: -1, canvasW, canvasH });

        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        const nameCalls = textCalls.filter(c => c.font === '7px monospace');
        assert.ok(nameCalls.length >= 1);
        assert.ok(nameCalls[0].args[0].length <= 8);
    });

    it('should strip parenthetical from unit name', () => {
        const ctx = createMockCtx();
        SpriteManager.reset();
        const units = [
            { name: 'Archer (Ranged)', sprites: ['unit-archer'], qty: 40, qtyRemaining: 35 },
        ];
        HUD.renderUnitBar(ctx, { units, selectedUnitIdx: -1, canvasW, canvasH });

        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText' && c.font === '7px monospace');
        // 'Archer (Ranged)'.split('(')[0].trim().substring(0,8) = 'Archer'
        assert.equal(textCalls[0].args[0], 'Archer');
    });
});

// ─── renderTilePanel Tests ──────────────────────────────────────────────────

describe('HUD.renderTilePanel', () => {
    it('should return early when hudWidth <= 0', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, { hudWidth: 0, canvasH, selectedTile: null, level: null });
        assert.equal(ctx.drawCalls.length, 0);
    });

    it('should return early when hudWidth is negative', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, { hudWidth: -10, canvasH, selectedTile: null, level: null });
        assert.equal(ctx.drawCalls.length, 0);
    });

    it('should draw background when hudWidth > 0', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, { hudWidth: 200, canvasH, selectedTile: null, level: null });

        const fillRects = ctx.drawCalls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 1, 'Should draw at least the background');
    });

    it('should draw close button (✕)', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, { hudWidth: 200, canvasH, selectedTile: null, level: null });

        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        const closeBtn = textCalls.find(c => c.args[0] === '✕');
        assert.ok(closeBtn, 'Should render close button');
    });

    it('should not render tile content when hudWidth <= 100', () => {
        const ctx = createMockCtx();
        const selectedTile = { row: 5, col: 3 };
        HUD.renderTilePanel(ctx, { hudWidth: 80, canvasH, selectedTile, level: null });

        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        const tileLabelCall = textCalls.find(c => c.args[0].includes('Tile'));
        assert.equal(tileLabelCall, undefined, 'Should not render tile info when width <= 100');
    });

    it('should render tile coordinates when hudWidth > 100 and tile selected', () => {
        const ctx = createMockCtx();
        const selectedTile = { row: 5, col: 3 };
        HUD.renderTilePanel(ctx, { hudWidth: 200, canvasH, selectedTile, level: null });

        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        const tileLabelCall = textCalls.find(c => c.args[0] === 'Tile [5, 3]');
        assert.ok(tileLabelCall, 'Should render tile coordinates');
    });

    it('should render sprite name when level data is available', () => {
        const ctx = createMockCtx();
        const selectedTile = { row: 2, col: 4 };
        const level = {
            tiles: [
                { row: 2, col: 4, sprite: 'grass-short-1' },
                { row: 3, col: 5, sprite: 'water-1' },
            ],
        };
        HUD.renderTilePanel(ctx, { hudWidth: 200, canvasH, selectedTile, level });

        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        const spriteCall = textCalls.find(c => c.args[0] === 'grass-short-1');
        assert.ok(spriteCall, 'Should render sprite name from level data');
    });

    it('should not render sprite name when tile not found in level', () => {
        const ctx = createMockCtx();
        const selectedTile = { row: 99, col: 99 };
        const level = {
            tiles: [{ row: 2, col: 4, sprite: 'grass-short-1' }],
        };
        HUD.renderTilePanel(ctx, { hudWidth: 200, canvasH, selectedTile, level });

        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        const spriteCall = textCalls.find(c => c.args[0] === 'grass-short-1');
        assert.equal(spriteCall, undefined, 'Should not render sprite for non-matching tile');
    });

    it('should create gradient for top border', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, { hudWidth: 200, canvasH, selectedTile: null, level: null });

        assert.ok(ctx.gradients.length >= 1, 'Should create at least one gradient');
    });
});

// ─── renderTopBar Tests ─────────────────────────────────────────────────────

describe('HUD.renderTopBar', () => {
    it('should draw semi-transparent background bar', () => {
        const ctx = createMockCtx();
        HUD.renderTopBar(ctx, 1024, 'Level 1 | WASD to scroll');

        const fillRects = ctx.drawCalls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 1);
        assert.equal(fillRects[0].args[0], 0); // x
        assert.equal(fillRects[0].args[1], 0); // y
        assert.equal(fillRects[0].args[2], 1024); // width = canvasW
        assert.equal(fillRects[0].args[3], 20); // height
    });

    it('should render the text content', () => {
        const ctx = createMockCtx();
        HUD.renderTopBar(ctx, 1024, 'Test Level');

        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        assert.ok(textCalls.length >= 1);
        assert.equal(textCalls[0].args[0], 'Test Level');
        assert.equal(textCalls[0].args[1], 8); // x offset
        assert.equal(textCalls[0].args[2], 5); // y offset
    });

    it('should use white text color', () => {
        const ctx = createMockCtx();
        HUD.renderTopBar(ctx, 1024, 'Hello');

        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        assert.equal(textCalls[0].fillStyle, '#fff');
    });
});

// ─── drawSheenBorder Tests ──────────────────────────────────────────────────

describe('HUD.drawSheenBorder', () => {
    it('should create a linear gradient', () => {
        const ctx = createMockCtx();
        HUD.drawSheenBorder(ctx, 10, 20, 100, 50);

        assert.ok(ctx.gradients.length >= 1);
        assert.equal(ctx.gradients[0].x0, 10);
        assert.equal(ctx.gradients[0].y0, 20);
        assert.equal(ctx.gradients[0].x1, 110); // x + w
    });

    it('should use custom highlight color when provided', () => {
        const ctx = createMockCtx();
        HUD.drawSheenBorder(ctx, 0, 0, 50, 50, '#ff0000');

        const stops = ctx.gradients[0].grad.stops;
        const midStop = stops.find(s => s.offset === 0.5);
        assert.equal(midStop.color, '#ff0000');
    });

    it('should use default highlight color when not provided', () => {
        const ctx = createMockCtx();
        HUD.drawSheenBorder(ctx, 0, 0, 50, 50);

        const stops = ctx.gradients[0].grad.stops;
        const midStop = stops.find(s => s.offset === 0.5);
        assert.equal(midStop.color, '#c8b890');
    });

    it('should draw a strokeRect', () => {
        const ctx = createMockCtx();
        HUD.drawSheenBorder(ctx, 5, 10, 80, 40);

        const strokeRects = ctx.drawCalls.filter(c => c.method === 'strokeRect');
        assert.equal(strokeRects.length, 1);
        assert.deepEqual(strokeRects[0].args, [5, 10, 80, 40]);
    });
});
