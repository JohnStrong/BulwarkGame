/**
 * Tests for HUD render functions using a lightweight canvas mock.
 *
 * Recommendation 5: Test HUD draw call sequences using a mock canvas
 * context that records operations instead of rendering.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/hud-render.spec.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Canvas Context Mock ────────────────────────────────────────────────────
// Records all draw calls for assertion without actual rendering.

function createMockContext() {
    const calls = [];

    const mockGradient = {
        addColorStop(offset, color) {
            calls.push({ method: 'addColorStop', args: [offset, color] });
        }
    };

    return {
        calls,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: 'left',
        textBaseline: 'alphabetic',

        fillRect(x, y, w, h) {
            calls.push({ method: 'fillRect', args: [x, y, w, h] });
        },
        strokeRect(x, y, w, h) {
            calls.push({ method: 'strokeRect', args: [x, y, w, h] });
        },
        fillText(text, x, y) {
            calls.push({ method: 'fillText', args: [text, x, y] });
        },
        createLinearGradient(x1, y1, x2, y2) {
            calls.push({ method: 'createLinearGradient', args: [x1, y1, x2, y2] });
            return mockGradient;
        },
        translate(x, y) {
            calls.push({ method: 'translate', args: [x, y] });
        },
        scale(x, y) {
            calls.push({ method: 'scale', args: [x, y] });
        },
    };
}

// ─── Mock SpriteManager ─────────────────────────────────────────────────────

const mockSpriteManager = {
    drawCalls: [],
    draw(ctx, name, x, y, w, h) {
        mockSpriteManager.drawCalls.push({ name, x, y, w, h });
    },
    reset() {
        mockSpriteManager.drawCalls = [];
    }
};

// ─── HUD re-implementation for testing ──────────────────────────────────────
// Replicate HUD render functions with SpriteManager injected

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

    renderUnitBar(ctx, state, SpriteManager) {
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

    renderUnitDetail(ctx, unit, canvasW, barY, SpriteManager) {
        if (!unit) return;

        const panelW = 280, panelH = 100;
        const panelX = (canvasW - panelW) / 2;
        const panelY = barY - panelH - 8;

        ctx.fillStyle = 'rgba(15, 12, 10, 0.92)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        this.drawSheenBorder(ctx, panelX, panelY, panelW, panelH);

        SpriteManager.draw(ctx, unit.sprites[0], panelX + 8, panelY + 10, 64, 32);

        ctx.fillStyle = '#ddd';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const sx = panelX + 80;
        ctx.fillText(unit.name, sx, panelY + 18);
        ctx.fillStyle = '#aaa';
        ctx.fillText(`HP: ${unit.health}  ATK: ${unit.attack}  Armour: ${Math.round((1 - unit.defense) * 100)}%`, sx, panelY + 34);
        ctx.fillText(`Available: ${unit.qtyRemaining} / ${unit.qty}`, sx, panelY + 50);
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
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('HUD.drawSheenBorder', () => {
    it('should create a gradient and stroke a rectangle', () => {
        const ctx = createMockContext();
        HUD.drawSheenBorder(ctx, 10, 20, 100, 50);

        const gradCall = ctx.calls.find(c => c.method === 'createLinearGradient');
        assert.ok(gradCall, 'Should create a linear gradient');
        assert.deepEqual(gradCall.args, [10, 20, 110, 20]);

        const strokeCall = ctx.calls.find(c => c.method === 'strokeRect');
        assert.ok(strokeCall, 'Should stroke a rectangle');
        assert.deepEqual(strokeCall.args, [10, 20, 100, 50]);
    });

    it('should use custom highlight color when provided', () => {
        const ctx = createMockContext();
        HUD.drawSheenBorder(ctx, 0, 0, 50, 50, '#ff0000');

        const colorStops = ctx.calls.filter(c => c.method === 'addColorStop');
        const midStop = colorStops.find(c => c.args[0] === 0.5);
        assert.ok(midStop, 'Should have a mid color stop');
        assert.equal(midStop.args[1], '#ff0000');
    });

    it('should use default highlight when none provided', () => {
        const ctx = createMockContext();
        HUD.drawSheenBorder(ctx, 0, 0, 50, 50);

        const colorStops = ctx.calls.filter(c => c.method === 'addColorStop');
        const midStop = colorStops.find(c => c.args[0] === 0.5);
        assert.equal(midStop.args[1], '#c8b890');
    });
});

describe('HUD.renderTopBar', () => {
    it('should draw a background rectangle spanning canvas width', () => {
        const ctx = createMockContext();
        HUD.renderTopBar(ctx, 1024, 'Level 1 | WASD to scroll');

        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 1);
        assert.deepEqual(fillRects[0].args, [0, 0, 1024, 20]);
    });

    it('should render the text string', () => {
        const ctx = createMockContext();
        HUD.renderTopBar(ctx, 800, 'Test Level');

        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        assert.ok(textCalls.length >= 1);
        assert.equal(textCalls[0].args[0], 'Test Level');
        assert.equal(textCalls[0].args[1], 8); // x position
        assert.equal(textCalls[0].args[2], 5); // y position
    });
});

describe('HUD.renderUnitBar', () => {
    const mockUnits = [
        { name: 'Archer (Ranged)', sprites: ['unit-archer'], qtyRemaining: 35, qty: 40 },
        { name: 'Knight', sprites: ['unit-knight'], qtyRemaining: 15, qty: 20 },
        { name: 'Spearman', sprites: ['unit-spearman'], qtyRemaining: 0, qty: 30 },
    ];

    beforeEach(() => {
        mockSpriteManager.reset();
    });

    it('should not render when units is empty', () => {
        const ctx = createMockContext();
        const result = HUD.renderUnitBar(ctx, {
            units: [], selectedUnitIdx: -1, canvasW: 1024, canvasH: 768
        }, mockSpriteManager);
        assert.equal(result, undefined);
        assert.equal(ctx.calls.length, 0);
    });

    it('should draw one box per unit', () => {
        const ctx = createMockContext();
        HUD.renderUnitBar(ctx, {
            units: mockUnits, selectedUnitIdx: 0, canvasW: 1024, canvasH: 768
        }, mockSpriteManager);

        // Each unit gets a fillRect for background
        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 3, `Should have at least 3 fillRects, got ${fillRects.length}`);
    });

    it('should call SpriteManager.draw for each unit sprite', () => {
        const ctx = createMockContext();
        HUD.renderUnitBar(ctx, {
            units: mockUnits, selectedUnitIdx: -1, canvasW: 1024, canvasH: 768
        }, mockSpriteManager);

        assert.equal(mockSpriteManager.drawCalls.length, 3);
        assert.equal(mockSpriteManager.drawCalls[0].name, 'unit-archer');
        assert.equal(mockSpriteManager.drawCalls[1].name, 'unit-knight');
        assert.equal(mockSpriteManager.drawCalls[2].name, 'unit-spearman');
    });

    it('should render unit names (truncated to 8 chars)', () => {
        const ctx = createMockContext();
        HUD.renderUnitBar(ctx, {
            units: mockUnits, selectedUnitIdx: -1, canvasW: 1024, canvasH: 768
        }, mockSpriteManager);

        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        // Should include truncated names
        const nameTexts = textCalls.map(c => c.args[0]);
        assert.ok(nameTexts.includes('Archer'), 'Should render Archer name');
        assert.ok(nameTexts.includes('Knight'), 'Should render Knight name');
    });

    it('should render quantity for each unit', () => {
        const ctx = createMockContext();
        HUD.renderUnitBar(ctx, {
            units: mockUnits, selectedUnitIdx: -1, canvasW: 1024, canvasH: 768
        }, mockSpriteManager);

        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const qtyTexts = textCalls.map(c => c.args[0]);
        assert.ok(qtyTexts.includes('35/40'), 'Should render archer qty');
        assert.ok(qtyTexts.includes('15/20'), 'Should render knight qty');
        assert.ok(qtyTexts.includes('0/30'), 'Should render spearman qty');
    });

    it('should return barY position', () => {
        const ctx = createMockContext();
        const barY = HUD.renderUnitBar(ctx, {
            units: mockUnits, selectedUnitIdx: 0, canvasW: 1024, canvasH: 768
        }, mockSpriteManager);

        const expectedBarY = 768 - 56 - 28; // canvasH - UNIT_BOX_SIZE - 28
        assert.equal(barY, expectedBarY);
    });
});

describe('HUD.renderUnitDetail', () => {
    const mockUnit = {
        name: 'Knight',
        sprites: ['unit-knight'],
        health: 100,
        attack: 130,
        defense: 0.40,
        qtyRemaining: 15,
        qty: 20,
    };

    beforeEach(() => {
        mockSpriteManager.reset();
    });

    it('should not render when unit is null', () => {
        const ctx = createMockContext();
        HUD.renderUnitDetail(ctx, null, 1024, 684, mockSpriteManager);
        assert.equal(ctx.calls.length, 0);
    });

    it('should draw panel background', () => {
        const ctx = createMockContext();
        HUD.renderUnitDetail(ctx, mockUnit, 1024, 684, mockSpriteManager);

        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 1, 'Should draw panel background');
        // Panel is 280×100
        const panelRect = fillRects[0];
        assert.equal(panelRect.args[2], 280);
        assert.equal(panelRect.args[3], 100);
    });

    it('should call SpriteManager.draw for unit sprite', () => {
        const ctx = createMockContext();
        HUD.renderUnitDetail(ctx, mockUnit, 1024, 684, mockSpriteManager);

        assert.equal(mockSpriteManager.drawCalls.length, 1);
        assert.equal(mockSpriteManager.drawCalls[0].name, 'unit-knight');
        assert.equal(mockSpriteManager.drawCalls[0].w, 64);
        assert.equal(mockSpriteManager.drawCalls[0].h, 32);
    });

    it('should render unit name and stats', () => {
        const ctx = createMockContext();
        HUD.renderUnitDetail(ctx, mockUnit, 1024, 684, mockSpriteManager);

        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => c.args[0]);
        assert.ok(texts.includes('Knight'), 'Should render unit name');
        assert.ok(texts.some(t => t.includes('HP: 100')), 'Should render HP');
        assert.ok(texts.some(t => t.includes('ATK: 130')), 'Should render ATK');
        assert.ok(texts.some(t => t.includes('Armour: 60%')), 'Should render armor %');
        assert.ok(texts.some(t => t.includes('Available: 15 / 20')), 'Should render availability');
    });

    it('should draw sheen border around panel', () => {
        const ctx = createMockContext();
        HUD.renderUnitDetail(ctx, mockUnit, 1024, 684, mockSpriteManager);

        const strokeRects = ctx.calls.filter(c => c.method === 'strokeRect');
        assert.ok(strokeRects.length >= 1, 'Should stroke panel border');
    });
});

describe('HUD.renderTilePanel', () => {
    it('should not render when hudWidth is 0', () => {
        const ctx = createMockContext();
        HUD.renderTilePanel(ctx, { hudWidth: 0, canvasH: 768, selectedTile: null, level: null });
        assert.equal(ctx.calls.length, 0);
    });

    it('should draw panel background when hudWidth > 0', () => {
        const ctx = createMockContext();
        HUD.renderTilePanel(ctx, {
            hudWidth: 200, canvasH: 768, selectedTile: { row: 5, col: 10 }, level: null
        });

        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 1, 'Should draw panel background');
    });

    it('should render tile coordinates when tile is selected', () => {
        const ctx = createMockContext();
        HUD.renderTilePanel(ctx, {
            hudWidth: 200, canvasH: 768, selectedTile: { row: 5, col: 10 }, level: null
        });

        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => c.args[0]);
        assert.ok(texts.includes('Tile [5, 10]'), 'Should render tile coordinates');
    });

    it('should render close button', () => {
        const ctx = createMockContext();
        HUD.renderTilePanel(ctx, {
            hudWidth: 200, canvasH: 768, selectedTile: { row: 0, col: 0 }, level: null
        });

        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => c.args[0]);
        assert.ok(texts.includes('✕'), 'Should render close button');
    });

    it('should render sprite name when level data is available', () => {
        const ctx = createMockContext();
        const mockLevel = {
            tiles: [
                { row: 3, col: 7, sprite: 'grass-short-1' },
                { row: 5, col: 10, sprite: 'road-full' },
            ]
        };
        HUD.renderTilePanel(ctx, {
            hudWidth: 200, canvasH: 768, selectedTile: { row: 5, col: 10 }, level: mockLevel
        });

        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => c.args[0]);
        assert.ok(texts.includes('road-full'), 'Should render sprite name from level');
    });

    it('should not render tile info when hudWidth <= 100', () => {
        const ctx = createMockContext();
        HUD.renderTilePanel(ctx, {
            hudWidth: 80, canvasH: 768, selectedTile: { row: 5, col: 10 }, level: null
        });

        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const tileTexts = textCalls.filter(c => c.args[0].includes('Tile'));
        // Close button is still rendered, but tile info is not
        assert.equal(tileTexts.length, 0, 'Should not render tile info when narrow');
    });
});
