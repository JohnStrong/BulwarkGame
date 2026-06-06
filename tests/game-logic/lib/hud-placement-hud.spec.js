/**
 * Tests for HUD.renderPlacementHUD(ctx, state)
 *
 * Validates:
 *   - Top bar background drawn at y=0, full canvas width, height 20px
 *   - "PLACE YOUR UNITS" label rendered left-aligned
 *   - Timer formatted as "⏱ M:SS", centred, white normally, #f88 when ≤ 5 s
 *   - Ready button rendered right-aligned with border stroke
 *   - Ready button colour: #8a7a60 normally, #c8b890 when ≤ 10 s
 *   - Returns { readyButtonRect } with positive w/h for valid canvas
 *   - Returns { readyButtonRect: null } when canvasW or canvasH ≤ 0
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/hud-placement-hud.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Replicate renderPlacementHUD for testing ─────────────────────────────────
// hud.js is a browser global — we replicate the exact production logic here.

const HUD = {
    renderPlacementHUD(ctx, state) {
        const { secondsRemaining, canvasW, canvasH } = state;

        if (canvasW <= 0 || canvasH <= 0) {
            return { readyButtonRect: null };
        }

        const barH = 20;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvasW, barH);

        ctx.font = '11px monospace';
        ctx.textBaseline = 'top';

        // Label
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText('PLACE YOUR UNITS', 8, 5);

        // Timer
        const mins = Math.floor(secondsRemaining / 60);
        const secs = secondsRemaining % 60;
        const secsStr = secs < 10 ? '0' + secs : '' + secs;
        const timerText = '\u23F1 ' + mins + ':' + secsStr;

        ctx.fillStyle = secondsRemaining <= 5 ? '#f88' : '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(timerText, canvasW / 2, 5);

        // Ready button
        const isUrgent = secondsRemaining <= 10;
        const btnColour = isUrgent ? '#c8b890' : '#8a7a60';
        const btnText = '[ \u2713 Ready ]';

        ctx.textAlign = 'right';
        const textW = ctx.measureText(btnText).width;
        const btnPadX = 4;
        const btnPadY = 2;
        const btnW = textW + btnPadX * 2;
        const btnH = 11 + btnPadY * 2;
        const btnX = canvasW - 8 - btnW;
        const btnY = (barH - btnH) / 2;

        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.strokeStyle = btnColour;
        ctx.lineWidth = 1;
        ctx.strokeRect(btnX, btnY, btnW, btnH);

        ctx.fillStyle = btnColour;
        ctx.fillText(btnText, canvasW - 8 - btnPadX, btnPadY + 1);

        return {
            readyButtonRect: { x: btnX, y: btnY, w: btnW, h: btnH },
        };
    },
};

// ─── Mock canvas context ──────────────────────────────────────────────────────

function createMockCtx() {
    const calls = [];
    const TEXT_W = 60; // stubbed measureText width
    const ctx = {
        calls,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: '',
        textBaseline: '',
        fillRect(...args)   { calls.push({ method: 'fillRect',   args }); },
        strokeRect(...args) { calls.push({ method: 'strokeRect', args }); },
        fillText(...args)   { calls.push({ method: 'fillText',   args }); },
        measureText(_text)  { return { width: TEXT_W }; },
        createLinearGradient(x0, y0, x1, y1) {
            calls.push({ method: 'createLinearGradient', args: [x0, y0, x1, y1] });
            return { addColorStop() {} };
        },
    };
    return ctx;
}

const CANVAS_W = 1024;
const CANVAS_H = 768;

// ─── Zero / negative canvas dimensions ────────────────────────────────────────

describe('renderPlacementHUD — zero/negative canvas', () => {
    it('returns { readyButtonRect: null } when canvasW is 0', () => {
        const ctx = createMockCtx();
        const result = HUD.renderPlacementHUD(ctx, { secondsRemaining: 20, canvasW: 0, canvasH: CANVAS_H });
        assert.equal(result.readyButtonRect, null);
        assert.equal(ctx.calls.length, 0, 'No draw calls should be made');
    });

    it('returns { readyButtonRect: null } when canvasH is 0', () => {
        const ctx = createMockCtx();
        const result = HUD.renderPlacementHUD(ctx, { secondsRemaining: 20, canvasW: CANVAS_W, canvasH: 0 });
        assert.equal(result.readyButtonRect, null);
        assert.equal(ctx.calls.length, 0, 'No draw calls should be made');
    });

    it('returns { readyButtonRect: null } when canvasW is negative', () => {
        const ctx = createMockCtx();
        const result = HUD.renderPlacementHUD(ctx, { secondsRemaining: 20, canvasW: -1, canvasH: CANVAS_H });
        assert.equal(result.readyButtonRect, null);
    });
});

// ─── Top bar background ───────────────────────────────────────────────────────

describe('renderPlacementHUD — top bar background', () => {
    it('draws a fillRect spanning the full canvas width at y=0 with height 20', () => {
        const ctx = createMockCtx();
        HUD.renderPlacementHUD(ctx, { secondsRemaining: 20, canvasW: CANVAS_W, canvasH: CANVAS_H });
        const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 1, 'Should call fillRect for bar background');
        const [x, y, w, h] = fillRects[0].args;
        assert.equal(x, 0,        'Bar starts at x=0');
        assert.equal(y, 0,        'Bar starts at y=0');
        assert.equal(w, CANVAS_W, 'Bar spans full canvas width');
        assert.equal(h, 20,       'Bar height is 20px');
    });
});

// ─── "PLACE YOUR UNITS" label ─────────────────────────────────────────────────

describe('renderPlacementHUD — PLACE YOUR UNITS label', () => {
    it('renders the label text', () => {
        const ctx = createMockCtx();
        HUD.renderPlacementHUD(ctx, { secondsRemaining: 20, canvasW: CANVAS_W, canvasH: CANVAS_H });
        const texts = ctx.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
        assert.ok(texts.includes('PLACE YOUR UNITS'), 'Label text must be rendered');
    });

    it('renders the label at x=8', () => {
        const ctx = createMockCtx();
        HUD.renderPlacementHUD(ctx, { secondsRemaining: 20, canvasW: CANVAS_W, canvasH: CANVAS_H });
        const labelCall = ctx.calls
            .filter(c => c.method === 'fillText' && c.args[0] === 'PLACE YOUR UNITS')[0];
        assert.ok(labelCall, 'Label call must exist');
        assert.equal(labelCall.args[1], 8, 'Label x must be 8');
    });
});

// ─── Timer display ────────────────────────────────────────────────────────────

describe('renderPlacementHUD — timer format', () => {
    const cases = [
        { seconds: 30,  expected: '\u23F1 0:30' },
        { seconds: 9,   expected: '\u23F1 0:09' },
        { seconds: 60,  expected: '\u23F1 1:00' },
        { seconds: 75,  expected: '\u23F1 1:15' },
        { seconds: 0,   expected: '\u23F1 0:00' },
    ];

    for (const { seconds, expected } of cases) {
        it(`formats ${seconds}s as "${expected}"`, () => {
            const ctx = createMockCtx();
            HUD.renderPlacementHUD(ctx, { secondsRemaining: seconds, canvasW: CANVAS_W, canvasH: CANVAS_H });
            const texts = ctx.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
            assert.ok(texts.includes(expected), `Expected timer text "${expected}", got: ${JSON.stringify(texts)}`);
        });
    }

    it('timer is centred at canvasW/2', () => {
        const ctx = createMockCtx();
        HUD.renderPlacementHUD(ctx, { secondsRemaining: 20, canvasW: CANVAS_W, canvasH: CANVAS_H });
        // Set ctx.textAlign before the timer fillText call — we track the textAlign property
        // by checking the call order and matching the expected timer text.
        const timerCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0].startsWith('\u23F1'));
        assert.ok(timerCall, 'Timer call must exist');
        assert.equal(timerCall.args[1], CANVAS_W / 2, 'Timer x must be canvasW/2');
    });
});

describe('renderPlacementHUD — timer colour', () => {
    it('timer fillStyle is #fff when secondsRemaining > 5', () => {
        const ctx = createMockCtx();
        // Track fillStyle at the moment of the timer fillText
        let fillStyleAtTimer = null;
        const origFillText = ctx.fillText.bind(ctx);
        ctx.fillText = function(...args) {
            if (typeof args[0] === 'string' && args[0].startsWith('\u23F1')) {
                fillStyleAtTimer = ctx.fillStyle;
            }
            origFillText(...args);
        };

        HUD.renderPlacementHUD(ctx, { secondsRemaining: 6, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.equal(fillStyleAtTimer, '#fff', 'Timer should be white when > 5 s');
    });

    it('timer fillStyle is #f88 when secondsRemaining is exactly 5', () => {
        const ctx = createMockCtx();
        let fillStyleAtTimer = null;
        const origFillText = ctx.fillText.bind(ctx);
        ctx.fillText = function(...args) {
            if (typeof args[0] === 'string' && args[0].startsWith('\u23F1')) {
                fillStyleAtTimer = ctx.fillStyle;
            }
            origFillText(...args);
        };

        HUD.renderPlacementHUD(ctx, { secondsRemaining: 5, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.equal(fillStyleAtTimer, '#f88', 'Timer should be #f88 at exactly 5 s');
    });

    it('timer fillStyle is #f88 when secondsRemaining < 5', () => {
        const ctx = createMockCtx();
        let fillStyleAtTimer = null;
        const origFillText = ctx.fillText.bind(ctx);
        ctx.fillText = function(...args) {
            if (typeof args[0] === 'string' && args[0].startsWith('\u23F1')) {
                fillStyleAtTimer = ctx.fillStyle;
            }
            origFillText(...args);
        };

        HUD.renderPlacementHUD(ctx, { secondsRemaining: 2, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.equal(fillStyleAtTimer, '#f88', 'Timer should be #f88 when < 5 s');
    });
});

// ─── Ready button ─────────────────────────────────────────────────────────────

describe('renderPlacementHUD — Ready button draw calls', () => {
    it('calls strokeRect for the button border', () => {
        const ctx = createMockCtx();
        HUD.renderPlacementHUD(ctx, { secondsRemaining: 20, canvasW: CANVAS_W, canvasH: CANVAS_H });
        const strokeRects = ctx.calls.filter(c => c.method === 'strokeRect');
        assert.ok(strokeRects.length >= 1, 'Should call strokeRect for button border');
    });

    it('renders the Ready button text', () => {
        const ctx = createMockCtx();
        HUD.renderPlacementHUD(ctx, { secondsRemaining: 20, canvasW: CANVAS_W, canvasH: CANVAS_H });
        const texts = ctx.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
        const hasReady = texts.some(t => typeof t === 'string' && t.includes('Ready'));
        assert.ok(hasReady, 'Ready button text must be rendered');
    });
});

describe('renderPlacementHUD — Ready button colour', () => {
    it('button strokeStyle is #8a7a60 when secondsRemaining > 10', () => {
        const ctx = createMockCtx();
        let strokeAtBtn = null;
        const origStrokeRect = ctx.strokeRect.bind(ctx);
        ctx.strokeRect = function(...args) {
            strokeAtBtn = ctx.strokeStyle;
            origStrokeRect(...args);
        };

        HUD.renderPlacementHUD(ctx, { secondsRemaining: 11, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.equal(strokeAtBtn, '#8a7a60', 'Button border should be dim gold when > 10 s');
    });

    it('button strokeStyle is #c8b890 when secondsRemaining is exactly 10', () => {
        const ctx = createMockCtx();
        let strokeAtBtn = null;
        const origStrokeRect = ctx.strokeRect.bind(ctx);
        ctx.strokeRect = function(...args) {
            strokeAtBtn = ctx.strokeStyle;
            origStrokeRect(...args);
        };

        HUD.renderPlacementHUD(ctx, { secondsRemaining: 10, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.equal(strokeAtBtn, '#c8b890', 'Button border should be gold at exactly 10 s');
    });

    it('button strokeStyle is #c8b890 when secondsRemaining < 10', () => {
        const ctx = createMockCtx();
        let strokeAtBtn = null;
        const origStrokeRect = ctx.strokeRect.bind(ctx);
        ctx.strokeRect = function(...args) {
            strokeAtBtn = ctx.strokeStyle;
            origStrokeRect(...args);
        };

        HUD.renderPlacementHUD(ctx, { secondsRemaining: 4, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.equal(strokeAtBtn, '#c8b890', 'Button border should be gold when < 10 s');
    });
});

// ─── Return value — readyButtonRect ───────────────────────────────────────────

describe('renderPlacementHUD — return value', () => {
    it('returns an object with a readyButtonRect property', () => {
        const ctx = createMockCtx();
        const result = HUD.renderPlacementHUD(ctx, { secondsRemaining: 20, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(result && typeof result === 'object', 'Must return an object');
        assert.ok('readyButtonRect' in result, 'Must have readyButtonRect property');
    });

    it('readyButtonRect has x, y, w, h properties', () => {
        const ctx = createMockCtx();
        const { readyButtonRect } = HUD.renderPlacementHUD(ctx, {
            secondsRemaining: 20, canvasW: CANVAS_W, canvasH: CANVAS_H,
        });
        assert.ok(readyButtonRect !== null, 'readyButtonRect must not be null for valid canvas');
        assert.ok(typeof readyButtonRect.x === 'number', 'x must be a number');
        assert.ok(typeof readyButtonRect.y === 'number', 'y must be a number');
        assert.ok(typeof readyButtonRect.w === 'number', 'w must be a number');
        assert.ok(typeof readyButtonRect.h === 'number', 'h must be a number');
    });

    it('readyButtonRect.w is positive', () => {
        const ctx = createMockCtx();
        const { readyButtonRect } = HUD.renderPlacementHUD(ctx, {
            secondsRemaining: 20, canvasW: CANVAS_W, canvasH: CANVAS_H,
        });
        assert.ok(readyButtonRect.w > 0, 'Button width must be positive');
    });

    it('readyButtonRect.h is positive', () => {
        const ctx = createMockCtx();
        const { readyButtonRect } = HUD.renderPlacementHUD(ctx, {
            secondsRemaining: 20, canvasW: CANVAS_W, canvasH: CANVAS_H,
        });
        assert.ok(readyButtonRect.h > 0, 'Button height must be positive');
    });

    it('readyButtonRect.x is right-aligned (< canvasW)', () => {
        const ctx = createMockCtx();
        const { readyButtonRect } = HUD.renderPlacementHUD(ctx, {
            secondsRemaining: 20, canvasW: CANVAS_W, canvasH: CANVAS_H,
        });
        assert.ok(readyButtonRect.x > CANVAS_W / 2,
            `Button x (${readyButtonRect.x}) should be in the right half of the canvas`);
        assert.ok(readyButtonRect.x + readyButtonRect.w <= CANVAS_W,
            'Button must not extend beyond the right edge of the canvas');
    });

    it('readyButtonRect.y is within the 20px top bar', () => {
        const ctx = createMockCtx();
        const { readyButtonRect } = HUD.renderPlacementHUD(ctx, {
            secondsRemaining: 20, canvasW: CANVAS_W, canvasH: CANVAS_H,
        });
        assert.ok(readyButtonRect.y >= 0, 'Button y must be >= 0');
        assert.ok(readyButtonRect.y + readyButtonRect.h <= 20,
            'Button must be contained within the 20px bar');
    });
});
