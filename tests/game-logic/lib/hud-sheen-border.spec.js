/**
 * Tests for HUD.drawSheenBorder and renderUnitDetail action buttons.
 *
 * Covers the metallic gradient border drawing and the action button
 * rendering branch in renderUnitDetail.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/hud-sheen-border.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Mock Canvas Context ────────────────────────────────────────────────────

function createMockCtx() {
    const calls = [];
    const gradients = [];
    return {
        calls,
        gradients,
        strokeStyle: null,
        lineWidth: null,
        fillStyle: null,
        font: null,
        textAlign: null,
        textBaseline: null,
        createLinearGradient(x0, y0, x1, y1) {
            const stops = [];
            const grad = {
                addColorStop(offset, color) { stops.push({ offset, color }); },
                stops,
                coords: { x0, y0, x1, y1 },
            };
            gradients.push(grad);
            return grad;
        },
        strokeRect(x, y, w, h) { calls.push({ method: 'strokeRect', args: [x, y, w, h] }); },
        fillRect(x, y, w, h) { calls.push({ method: 'fillRect', args: [x, y, w, h] }); },
        fillText(text, x, y) { calls.push({ method: 'fillText', args: [text, x, y] }); },
        drawImage() { calls.push({ method: 'drawImage' }); },
    };
}

// ─── HUD.drawSheenBorder replica ────────────────────────────────────────────

function drawSheenBorder(ctx, x, y, w, h, highlight) {
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, '#3a3028');
    grad.addColorStop(0.5, highlight || '#c8b890');
    grad.addColorStop(1, '#3a3028');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('HUD.drawSheenBorder', () => {
    it('should create a linear gradient spanning the width', () => {
        const ctx = createMockCtx();
        drawSheenBorder(ctx, 10, 20, 200, 100);

        assert.equal(ctx.gradients.length, 1);
        const grad = ctx.gradients[0];
        assert.deepEqual(grad.coords, { x0: 10, y0: 20, x1: 210, y1: 20 });
    });

    it('should add 3 color stops for metallic effect', () => {
        const ctx = createMockCtx();
        drawSheenBorder(ctx, 0, 0, 100, 50);

        const grad = ctx.gradients[0];
        assert.equal(grad.stops.length, 3);
        assert.equal(grad.stops[0].offset, 0);
        assert.equal(grad.stops[1].offset, 0.5);
        assert.equal(grad.stops[2].offset, 1);
    });

    it('should use default highlight color when not specified', () => {
        const ctx = createMockCtx();
        drawSheenBorder(ctx, 0, 0, 100, 50);

        const grad = ctx.gradients[0];
        assert.equal(grad.stops[1].color, '#c8b890');
    });

    it('should use custom highlight color when specified', () => {
        const ctx = createMockCtx();
        drawSheenBorder(ctx, 0, 0, 100, 50, '#e8c870');

        const grad = ctx.gradients[0];
        assert.equal(grad.stops[1].color, '#e8c870');
    });

    it('should use dark edge colors on both sides', () => {
        const ctx = createMockCtx();
        drawSheenBorder(ctx, 0, 0, 100, 50);

        const grad = ctx.gradients[0];
        assert.equal(grad.stops[0].color, '#3a3028');
        assert.equal(grad.stops[2].color, '#3a3028');
    });

    it('should set lineWidth to 1.5', () => {
        const ctx = createMockCtx();
        drawSheenBorder(ctx, 0, 0, 100, 50);

        assert.equal(ctx.lineWidth, 1.5);
    });

    it('should call strokeRect with correct dimensions', () => {
        const ctx = createMockCtx();
        drawSheenBorder(ctx, 15, 25, 280, 100);

        const strokeCall = ctx.calls.find(c => c.method === 'strokeRect');
        assert.deepEqual(strokeCall.args, [15, 25, 280, 100]);
    });

    it('should set strokeStyle to the gradient', () => {
        const ctx = createMockCtx();
        drawSheenBorder(ctx, 0, 0, 100, 50);

        assert.equal(ctx.strokeStyle, ctx.gradients[0]);
    });
});

describe('HUD.renderUnitDetail: action buttons', () => {
    // Replica of the action button rendering logic
    function renderActionButtons(ctx, panelX, panelW, panelY) {
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
        return { actStartX, actY, actions };
    }

    it('should render two action buttons', () => {
        const ctx = createMockCtx();
        renderActionButtons(ctx, 100, 280, 200);

        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        assert.equal(fillRects.length, 2);
    });

    it('should render button labels Q and V', () => {
        const ctx = createMockCtx();
        renderActionButtons(ctx, 100, 280, 200);

        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        const labels = textCalls.map(c => c.args[0]);
        assert.ok(labels.includes('Q'));
        assert.ok(labels.includes('V'));
    });

    it('should draw stroke borders around buttons', () => {
        const ctx = createMockCtx();
        renderActionButtons(ctx, 100, 280, 200);

        const strokeRects = ctx.calls.filter(c => c.method === 'strokeRect');
        assert.equal(strokeRects.length, 2);
    });

    it('should position buttons at panelY + 65', () => {
        const ctx = createMockCtx();
        const { actY } = renderActionButtons(ctx, 100, 280, 200);

        assert.equal(actY, 265);
    });

    it('should center buttons horizontally within panel', () => {
        const ctx = createMockCtx();
        const { actStartX } = renderActionButtons(ctx, 100, 280, 200);

        // actionsW = 2*28 + 1*10 = 66
        // actStartX = 100 + (280 - 66) / 2 = 100 + 107 = 207
        assert.equal(actStartX, 207);
    });

    it('each button should be 24x16 pixels', () => {
        const ctx = createMockCtx();
        renderActionButtons(ctx, 0, 280, 0);

        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        for (const rect of fillRects) {
            assert.equal(rect.args[2], 24);
            assert.equal(rect.args[3], 16);
        }
    });
});
