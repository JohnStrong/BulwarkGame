/**
 * Tests for HUD render methods (Recommendation 4).
 *
 * Verifies that renderTopBar, renderUnitBar, renderUnitDetail, and renderTilePanel
 * call the expected canvas context methods with correct arguments, using a mock
 * context that records all draw calls.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/hud-render-methods.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Replicate HUD logic for testing ─────────────────────────────────────────
// HUD is a browser global (no module.exports), so we replicate the relevant
// methods here, matching the production implementation exactly.

const UNIT_BOX_SIZE = 64;
const UNIT_BAR_PADDING = 10;

const HUD = {
    renderTopBar(ctx, canvasW, text) {
        const barH = 36;
        ctx.fillStyle = 'rgba(20,15,10,0.82)';
        ctx.fillRect(0, 0, canvasW, barH);
        ctx.strokeStyle = 'rgba(180,140,60,0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(0, 0, canvasW, barH);
        ctx.fillStyle = '#e8d8a0';
        ctx.font = 'bold 15px serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, canvasW / 2, 23);
    },

    renderUnitBar(ctx, state) {
        const units = state.units || [];
        const canvasW = state.canvasW || 800;
        const canvasH = state.canvasH || 600;
        const barH = UNIT_BOX_SIZE + UNIT_BAR_PADDING * 2 + 20;
        const barY = canvasH - barH;

        ctx.fillStyle = 'rgba(20,15,10,0.85)';
        ctx.fillRect(0, barY, canvasW, barH);
        ctx.strokeStyle = 'rgba(180,140,60,0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, barY, canvasW, barH);

        const totalW = units.length * (UNIT_BOX_SIZE + UNIT_BAR_PADDING) + UNIT_BAR_PADDING;
        const startX = (canvasW - totalW) / 2;

        units.forEach((unit, i) => {
            const x = startX + i * (UNIT_BOX_SIZE + UNIT_BAR_PADDING) + UNIT_BAR_PADDING;
            const y = barY + UNIT_BAR_PADDING + 10;
            ctx.fillStyle = 'rgba(60,50,35,0.9)';
            ctx.fillRect(x, y, UNIT_BOX_SIZE, UNIT_BOX_SIZE);
            ctx.fillStyle = '#c8b870';
            ctx.font = '11px serif';
            ctx.textAlign = 'center';
            ctx.fillText(unit.name || '', x + UNIT_BOX_SIZE / 2, barY + barH - 4);
        });
    },

    renderUnitDetail(ctx, unit, canvasW, barY) {
        if (!unit) return;
        const panelW = 200;
        const panelH = 120;
        const panelX = canvasW - panelW - 10;
        const panelY = barY - panelH - 10;

        ctx.fillStyle = 'rgba(20,15,10,0.9)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = 'rgba(180,140,60,0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.fillStyle = '#e8d8a0';
        ctx.font = 'bold 13px serif';
        ctx.textAlign = 'left';
        ctx.fillText(unit.name || 'Unknown', panelX + 10, panelY + 20);

        ctx.font = '11px serif';
        ctx.fillStyle = '#c0b080';
        ctx.fillText(`HP: ${unit.health || 0}`, panelX + 10, panelY + 40);
        ctx.fillText(`ATK: ${unit.attack || 0}`, panelX + 10, panelY + 56);
        ctx.fillText(`DEF: ${unit.defense || 0}`, panelX + 10, panelY + 72);
        ctx.fillText(`QTY: ${unit.qtyRemaining || 0}`, panelX + 10, panelY + 88);
    },

    renderTilePanel(ctx, state) {
        if (!state.selectedTile) return;
        const tile = state.selectedTile;
        const panelW = 180;
        const panelH = 80;
        const panelX = 10;
        const panelY = 46;

        ctx.fillStyle = 'rgba(20,15,10,0.88)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = 'rgba(180,140,60,0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.fillStyle = '#e8d8a0';
        ctx.font = 'bold 12px serif';
        ctx.textAlign = 'left';
        ctx.fillText(tile.sprite || 'unknown', panelX + 8, panelY + 20);

        ctx.font = '11px serif';
        ctx.fillStyle = '#c0b080';
        ctx.fillText(`Row: ${tile.row}, Col: ${tile.col}`, panelX + 8, panelY + 38);
    },

    drawSheenBorder(ctx, x, y, w, h, highlight) {
        const grad = ctx.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, highlight ? 'rgba(255,220,100,0.9)' : 'rgba(180,140,60,0.8)');
        grad.addColorStop(0.5, 'rgba(120,90,30,0.6)');
        grad.addColorStop(1, highlight ? 'rgba(255,220,100,0.9)' : 'rgba(180,140,60,0.8)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
    },

    getUnitBarClick(mouseX, mouseY, units, canvasW, canvasH) {
        const barH = UNIT_BOX_SIZE + UNIT_BAR_PADDING * 2 + 20;
        const barY = canvasH - barH;
        if (mouseY < barY || mouseY > barY + UNIT_BOX_SIZE + 20) return null;
        const totalW = units.length * (UNIT_BOX_SIZE + UNIT_BAR_PADDING) + UNIT_BAR_PADDING;
        const startX = (canvasW - totalW) / 2;
        for (let i = 0; i < units.length; i++) {
            const x = startX + i * (UNIT_BOX_SIZE + UNIT_BAR_PADDING) + UNIT_BAR_PADDING;
            if (mouseX >= x && mouseX <= x + UNIT_BOX_SIZE) return units[i];
        }
        return null;
    },
};

// ─── Mock canvas context ──────────────────────────────────────────────────────

function createMockCtx() {
    const calls = [];
    const ctx = {
        calls,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: '',
        fillRect(...args) { calls.push({ method: 'fillRect', args }); },
        strokeRect(...args) { calls.push({ method: 'strokeRect', args }); },
        fillText(...args) { calls.push({ method: 'fillText', args }); },
        strokeText(...args) { calls.push({ method: 'strokeText', args }); },
        createLinearGradient(x0, y0, x1, y1) {
            calls.push({ method: 'createLinearGradient', args: [x0, y0, x1, y1] });
            return {
                addColorStop(offset, color) {
                    calls.push({ method: 'addColorStop', args: [offset, color] });
                },
            };
        },
    };
    return ctx;
}

// ─── renderTopBar ─────────────────────────────────────────────────────────────

describe('HUD.renderTopBar', () => {
    it('should call fillRect to draw the background bar', () => {
        const ctx = createMockCtx();
        HUD.renderTopBar(ctx, 800, 'Level 1');
        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 1, 'Should call fillRect at least once');
        // First fillRect should span the full canvas width
        assert.equal(fillRects[0].args[0], 0, 'Bar should start at x=0');
        assert.equal(fillRects[0].args[1], 0, 'Bar should start at y=0');
        assert.equal(fillRects[0].args[2], 800, 'Bar should span full canvas width');
    });

    it('should call strokeRect to draw the border', () => {
        const ctx = createMockCtx();
        HUD.renderTopBar(ctx, 800, 'Level 1');
        const strokeRects = ctx.calls.filter(c => c.method === 'strokeRect');
        assert.ok(strokeRects.length >= 1, 'Should call strokeRect for border');
    });

    it('should call fillText with the provided text', () => {
        const ctx = createMockCtx();
        HUD.renderTopBar(ctx, 800, 'My Level');
        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        assert.ok(textCalls.length >= 1, 'Should call fillText');
        assert.equal(textCalls[0].args[0], 'My Level', 'fillText should use the provided text');
    });

    it('should center the text horizontally (x = canvasW / 2)', () => {
        const ctx = createMockCtx();
        HUD.renderTopBar(ctx, 1000, 'Test');
        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        assert.equal(textCalls[0].args[1], 500, 'Text should be centered at canvasW/2');
    });

    it('should work with different canvas widths', () => {
        const ctx = createMockCtx();
        HUD.renderTopBar(ctx, 1280, 'Wide Screen');
        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        assert.equal(fillRects[0].args[2], 1280);
    });
});

// ─── renderUnitBar ────────────────────────────────────────────────────────────

describe('HUD.renderUnitBar', () => {
    const state = {
        units: [
            { name: 'Archer', qtyRemaining: 3 },
            { name: 'Knight', qtyRemaining: 1 },
        ],
        canvasW: 800,
        canvasH: 600,
    };

    it('should call fillRect to draw the bar background', () => {
        const ctx = createMockCtx();
        HUD.renderUnitBar(ctx, state);
        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 1, 'Should call fillRect for bar background');
        // Background should span full canvas width
        assert.equal(fillRects[0].args[2], 800, 'Bar should span full canvas width');
    });

    it('should call fillRect once per unit for the unit box', () => {
        const ctx = createMockCtx();
        HUD.renderUnitBar(ctx, state);
        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        // 1 background + 2 unit boxes = 3 fillRect calls
        assert.ok(fillRects.length >= 3, 'Should draw background + one box per unit');
    });

    it('should call fillText once per unit for the unit name', () => {
        const ctx = createMockCtx();
        HUD.renderUnitBar(ctx, state);
        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        assert.ok(textCalls.length >= 2, 'Should call fillText for each unit name');
        const texts = textCalls.map(c => c.args[0]);
        assert.ok(texts.includes('Archer'), 'Should render Archer name');
        assert.ok(texts.includes('Knight'), 'Should render Knight name');
    });

    it('should call strokeRect for the bar border', () => {
        const ctx = createMockCtx();
        HUD.renderUnitBar(ctx, state);
        const strokeRects = ctx.calls.filter(c => c.method === 'strokeRect');
        assert.ok(strokeRects.length >= 1, 'Should call strokeRect for border');
    });

    it('should handle empty units array without throwing', () => {
        const ctx = createMockCtx();
        assert.doesNotThrow(() => {
            HUD.renderUnitBar(ctx, { units: [], canvasW: 800, canvasH: 600 });
        });
    });

    it('should position bar at the bottom of the canvas', () => {
        const ctx = createMockCtx();
        HUD.renderUnitBar(ctx, state);
        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        const barY = fillRects[0].args[1];
        // Bar should be in the lower half of the canvas (canvasH - barH = 600 - 104 = 496)
        assert.ok(barY > 400, `Bar Y (${barY}) should be near bottom of 600px canvas`);
    });
});

// ─── renderUnitDetail ─────────────────────────────────────────────────────────

describe('HUD.renderUnitDetail', () => {
    const unit = {
        name: 'Archer',
        health: 30,
        attack: 15,
        defense: 0.9,
        qtyRemaining: 3,
    };

    it('should call fillRect to draw the panel background', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, unit, 800, 500);
        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 1, 'Should call fillRect for panel background');
    });

    it('should call fillText with the unit name', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, unit, 800, 500);
        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => c.args[0]);
        assert.ok(texts.some(t => t.includes('Archer')), 'Should render unit name');
    });

    it('should call fillText with HP stat', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, unit, 800, 500);
        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => String(c.args[0]));
        assert.ok(texts.some(t => t.includes('HP')), 'Should render HP stat');
    });

    it('should call fillText with ATK stat', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, unit, 800, 500);
        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => String(c.args[0]));
        assert.ok(texts.some(t => t.includes('ATK')), 'Should render ATK stat');
    });

    it('should call fillText with DEF stat', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, unit, 800, 500);
        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => String(c.args[0]));
        assert.ok(texts.some(t => t.includes('DEF')), 'Should render DEF stat');
    });

    it('should call strokeRect for the panel border', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, unit, 800, 500);
        const strokeRects = ctx.calls.filter(c => c.method === 'strokeRect');
        assert.ok(strokeRects.length >= 1, 'Should call strokeRect for panel border');
    });

    it('should do nothing when unit is null', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, null, 800, 500);
        assert.equal(ctx.calls.length, 0, 'Should make no draw calls for null unit');
    });

    it('should position panel near the right edge of the canvas', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, unit, 800, 500);
        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        const panelX = fillRects[0].args[0];
        // Panel should be near the right (canvasW - panelW - 10 = 800 - 200 - 10 = 590)
        assert.ok(panelX > 500, `Panel X (${panelX}) should be near right edge`);
    });
});

// ─── renderTilePanel ──────────────────────────────────────────────────────────

describe('HUD.renderTilePanel', () => {
    const stateWithTile = {
        selectedTile: { sprite: 'grass-short-1', row: 5, col: 7 },
    };

    it('should call fillRect to draw the panel background', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, stateWithTile);
        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 1, 'Should call fillRect for panel background');
    });

    it('should call fillText with the sprite name', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, stateWithTile);
        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => String(c.args[0]));
        assert.ok(texts.some(t => t.includes('grass-short-1')), 'Should render sprite name');
    });

    it('should call fillText with row and col info', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, stateWithTile);
        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => String(c.args[0]));
        assert.ok(texts.some(t => t.includes('5') && t.includes('7')),
            'Should render row and col values');
    });

    it('should call strokeRect for the panel border', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, stateWithTile);
        const strokeRects = ctx.calls.filter(c => c.method === 'strokeRect');
        assert.ok(strokeRects.length >= 1, 'Should call strokeRect for border');
    });

    it('should do nothing when selectedTile is null', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, { selectedTile: null });
        assert.equal(ctx.calls.length, 0, 'Should make no draw calls when no tile selected');
    });

    it('should do nothing when selectedTile is undefined', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, {});
        assert.equal(ctx.calls.length, 0, 'Should make no draw calls when state has no selectedTile');
    });

    it('should position panel near the top-left', () => {
        const ctx = createMockCtx();
        HUD.renderTilePanel(ctx, stateWithTile);
        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        const panelX = fillRects[0].args[0];
        const panelY = fillRects[0].args[1];
        assert.ok(panelX < 50, `Panel X (${panelX}) should be near left edge`);
        assert.ok(panelY < 100, `Panel Y (${panelY}) should be near top`);
    });
});

// ─── drawSheenBorder ─────────────────────────────────────────────────────────

describe('HUD.drawSheenBorder', () => {
    it('should call createLinearGradient', () => {
        const ctx = createMockCtx();
        HUD.drawSheenBorder(ctx, 10, 20, 100, 50, false);
        const gradCalls = ctx.calls.filter(c => c.method === 'createLinearGradient');
        assert.ok(gradCalls.length >= 1, 'Should call createLinearGradient');
    });

    it('should call strokeRect with the provided dimensions', () => {
        const ctx = createMockCtx();
        HUD.drawSheenBorder(ctx, 10, 20, 100, 50, false);
        const strokeRects = ctx.calls.filter(c => c.method === 'strokeRect');
        assert.ok(strokeRects.length >= 1, 'Should call strokeRect');
        assert.equal(strokeRects[0].args[0], 10, 'x should match');
        assert.equal(strokeRects[0].args[1], 20, 'y should match');
        assert.equal(strokeRects[0].args[2], 100, 'width should match');
        assert.equal(strokeRects[0].args[3], 50, 'height should match');
    });

    it('should add color stops to the gradient', () => {
        const ctx = createMockCtx();
        HUD.drawSheenBorder(ctx, 0, 0, 50, 50, false);
        const stopCalls = ctx.calls.filter(c => c.method === 'addColorStop');
        assert.ok(stopCalls.length >= 2, 'Should add at least 2 color stops');
    });

    it('should not throw for highlight=true', () => {
        const ctx = createMockCtx();
        assert.doesNotThrow(() => {
            HUD.drawSheenBorder(ctx, 0, 0, 50, 50, true);
        });
    });
});
