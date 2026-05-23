/**
 * Tests for HUD action button rendering and hit detection (Recommendation 9).
 *
 * Verifies that renderUnitDetail() draws Q/Attack and V/Defend buttons
 * and that getUnitBarClick() correctly identifies unit bar clicks.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/hud-actions.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Mock Canvas Context ────────────────────────────────────────────────────

function createMockCtx() {
    const calls = [];
    return {
        calls,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: '',
        textBaseline: '',
        fillRect(x, y, w, h) { calls.push({ method: 'fillRect', args: [x, y, w, h] }); },
        strokeRect(x, y, w, h) { calls.push({ method: 'strokeRect', args: [x, y, w, h] }); },
        fillText(text, x, y) { calls.push({ method: 'fillText', args: [text, x, y] }); },
        createLinearGradient(x0, y0, x1, y1) {
            return {
                addColorStop() {},
            };
        },
        save() { calls.push({ method: 'save' }); },
        restore() { calls.push({ method: 'restore' }); },
    };
}

// ─── Mock SpriteManager ─────────────────────────────────────────────────────

global.SpriteManager = {
    draw() {},
};

// ─── Replicate HUD for testing ──────────────────────────────────────────────

const HUD = {
    UNIT_BOX_SIZE: 56,
    UNIT_BOX_PAD: 6,
    HUD_MAX_WIDTH: 256,
    HUD_HEIGHT: 180,

    drawSheenBorder(ctx, x, y, w, h, highlight) {
        const grad = ctx.createLinearGradient(x, y, x + w, y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
    },

    renderUnitDetail(ctx, unit, canvasW, barY) {
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

        // Action buttons
        const actions = [['Q', 'Attack'], ['V', 'Defend']];
        const actionsW = actions.length * 28 + (actions.length - 1) * 10;
        const actStartX = panelX + (panelW - actionsW) / 2;
        const actY = panelY + 65;

        for (let a = 0; a < actions.length; a++) {
            const ax = actStartX + a * 38;
            ctx.fillStyle = 'rgba(60, 55, 45, 0.9)';
            ctx.fillRect(ax, actY, 24, 16);
            ctx.strokeStyle = '#8a7a60';
            ctx.lineWidth = 1;
            ctx.strokeRect(ax, actY, 24, 16);
            ctx.fillStyle = '#eee';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(actions[a][0], ax + 12, actY + 8);
        }
        ctx.fillStyle = '#888';
        ctx.font = '7px monospace';
        ctx.textBaseline = 'top';
        for (let a = 0; a < actions.length; a++) {
            ctx.fillText(actions[a][1], actStartX + a * 38 + 12, actY + 18);
        }
    },

    renderUnitBar(ctx, state) {
        const { units, selectedUnitIdx, canvasW, canvasH } = state;
        if (!units || units.length === 0) return;

        const totalBarW = units.length * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD) - this.UNIT_BOX_PAD;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - this.UNIT_BOX_SIZE - 28;
        return barY;
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
    },
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('HUD: renderUnitDetail action buttons', () => {
    const mockUnit = {
        name: 'Knight',
        sprites: ['unit-knight'],
        health: 100,
        attack: 130,
        defense: 0.40,
        qty: 20,
        qtyRemaining: 15,
    };

    it('should render Q and V button labels', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, mockUnit, 800, 500);

        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const buttonLabels = textCalls.map(c => c.args[0]);

        assert.ok(buttonLabels.includes('Q'), 'Should render Q button label');
        assert.ok(buttonLabels.includes('V'), 'Should render V button label');
    });

    it('should render Attack and Defend action names', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, mockUnit, 800, 500);

        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => c.args[0]);

        assert.ok(texts.includes('Attack'), 'Should render Attack label');
        assert.ok(texts.includes('Defend'), 'Should render Defend label');
    });

    it('should render two button backgrounds (fillRect for action buttons)', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, mockUnit, 800, 500);

        // Action buttons are 24×16 fillRects
        const buttonRects = ctx.calls.filter(
            c => c.method === 'fillRect' && c.args[2] === 24 && c.args[3] === 16
        );
        assert.equal(buttonRects.length, 2, 'Should render 2 action button backgrounds');
    });

    it('should render two button borders (strokeRect for action buttons)', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, mockUnit, 800, 500);

        // Action buttons are 24×16 strokeRects
        const buttonBorders = ctx.calls.filter(
            c => c.method === 'strokeRect' && c.args[2] === 24 && c.args[3] === 16
        );
        assert.equal(buttonBorders.length, 2, 'Should render 2 action button borders');
    });

    it('should render unit stats text', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, mockUnit, 800, 500);

        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const texts = textCalls.map(c => c.args[0]);

        assert.ok(texts.some(t => t.includes('Knight')), 'Should render unit name');
        assert.ok(texts.some(t => t.includes('HP: 100')), 'Should render HP');
        assert.ok(texts.some(t => t.includes('ATK: 130')), 'Should render ATK');
        assert.ok(texts.some(t => t.includes('Armour: 60%')), 'Should render Armour');
        assert.ok(texts.some(t => t.includes('Available: 15 / 20')), 'Should render availability');
    });

    it('should not render anything when unit is null', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, null, 800, 500);
        assert.equal(ctx.calls.length, 0, 'Should not render when unit is null');
    });

    it('should not render anything when unit is undefined', () => {
        const ctx = createMockCtx();
        HUD.renderUnitDetail(ctx, undefined, 800, 500);
        assert.equal(ctx.calls.length, 0, 'Should not render when unit is undefined');
    });
});

describe('HUD: getUnitBarClick hit detection', () => {
    const units = [
        { name: 'Knight', sprites: ['unit-knight'] },
        { name: 'Archer', sprites: ['unit-archer'] },
        { name: 'Spearman', sprites: ['unit-spearman'] },
    ];
    const canvasW = 800;
    const canvasH = 600;

    it('should return -1 for empty units array', () => {
        assert.equal(HUD.getUnitBarClick(400, 500, [], canvasW, canvasH), -1);
    });

    it('should return -1 for null units', () => {
        assert.equal(HUD.getUnitBarClick(400, 500, null, canvasW, canvasH), -1);
    });

    it('should return -1 for click above the unit bar', () => {
        assert.equal(HUD.getUnitBarClick(400, 100, units, canvasW, canvasH), -1);
    });

    it('should return -1 for click below the unit bar', () => {
        assert.equal(HUD.getUnitBarClick(400, canvasH, units, canvasW, canvasH), -1);
    });

    it('should return correct index for click on first unit', () => {
        const totalBarW = units.length * (HUD.UNIT_BOX_SIZE + HUD.UNIT_BOX_PAD) - HUD.UNIT_BOX_PAD;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - HUD.UNIT_BOX_SIZE - 28;

        // Click in the middle of the first unit box
        const clickX = barStartX + HUD.UNIT_BOX_SIZE / 2;
        const clickY = barY + 10;

        assert.equal(HUD.getUnitBarClick(clickX, clickY, units, canvasW, canvasH), 0);
    });

    it('should return correct index for click on second unit', () => {
        const totalBarW = units.length * (HUD.UNIT_BOX_SIZE + HUD.UNIT_BOX_PAD) - HUD.UNIT_BOX_PAD;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - HUD.UNIT_BOX_SIZE - 28;

        const clickX = barStartX + (HUD.UNIT_BOX_SIZE + HUD.UNIT_BOX_PAD) + HUD.UNIT_BOX_SIZE / 2;
        const clickY = barY + 10;

        assert.equal(HUD.getUnitBarClick(clickX, clickY, units, canvasW, canvasH), 1);
    });

    it('should return correct index for click on third unit', () => {
        const totalBarW = units.length * (HUD.UNIT_BOX_SIZE + HUD.UNIT_BOX_PAD) - HUD.UNIT_BOX_PAD;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - HUD.UNIT_BOX_SIZE - 28;

        const clickX = barStartX + 2 * (HUD.UNIT_BOX_SIZE + HUD.UNIT_BOX_PAD) + HUD.UNIT_BOX_SIZE / 2;
        const clickY = barY + 10;

        assert.equal(HUD.getUnitBarClick(clickX, clickY, units, canvasW, canvasH), 2);
    });

    it('should return -1 for click in the gap between units', () => {
        const totalBarW = units.length * (HUD.UNIT_BOX_SIZE + HUD.UNIT_BOX_PAD) - HUD.UNIT_BOX_PAD;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - HUD.UNIT_BOX_SIZE - 28;

        // Click in the padding gap between first and second unit
        const clickX = barStartX + HUD.UNIT_BOX_SIZE + HUD.UNIT_BOX_PAD / 2;
        const clickY = barY + 10;

        assert.equal(HUD.getUnitBarClick(clickX, clickY, units, canvasW, canvasH), -1);
    });

    it('should return -1 for click to the left of the bar', () => {
        const totalBarW = units.length * (HUD.UNIT_BOX_SIZE + HUD.UNIT_BOX_PAD) - HUD.UNIT_BOX_PAD;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - HUD.UNIT_BOX_SIZE - 28;

        assert.equal(HUD.getUnitBarClick(barStartX - 10, barY + 10, units, canvasW, canvasH), -1);
    });

    it('should return -1 for click to the right of the bar', () => {
        const totalBarW = units.length * (HUD.UNIT_BOX_SIZE + HUD.UNIT_BOX_PAD) - HUD.UNIT_BOX_PAD;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - HUD.UNIT_BOX_SIZE - 28;

        const rightEdge = barStartX + totalBarW;
        assert.equal(HUD.getUnitBarClick(rightEdge + 10, barY + 10, units, canvasW, canvasH), -1);
    });
});
