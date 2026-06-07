/**
 * Tests for HUD.renderActiveTurnHUD(ctx, state)
 *
 * Validates:
 *   - Returns { endTurnButtonRect: null } when turnPhase !== 'player'
 *   - Returns a non-null rect when turnPhase === 'player'
 *   - Does not throw for enemy or resolve mode
 *   - Top bar background always drawn at y=0, full canvas width, height 20
 *   - Player mode: centred timer, right-aligned button, timer colours, button colours
 *   - Enemy mode: centred "Enemy turn — watching N units move" in #bbb
 *   - Resolve mode: three-part text (prefix #aaa, timer #f8c870, suffix #aaa)
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/hud-active-turn-hud.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Stub performance.now() ───────────────────────────────────────────────────
// renderActiveTurnHUD calls performance.now() internally. We shim it here so
// tests can inject a deterministic "now" value.
const globalAny = global;
let _stubNowMs = 0;
globalAny.performance = { now: () => _stubNowMs };

// ─── Replicate renderActiveTurnHUD for testing ────────────────────────────────
// hud.js is a browser global — we replicate the exact production logic here.

const HUD = {
    renderActiveTurnHUD(ctx, state) {
        const {
            turnPhase,
            turnTimerStartMs,
            turnDurationMs,
            enemyUnitQueue,
            resolveTimerStartMs,
            resolveDurationMs,
            canvasW,
            levelLabel,
        } = state;

        const barH = 20;

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvasW, barH);

        ctx.font = '11px monospace';
        ctx.textBaseline = 'top';

        // Left: level label (always shown)
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(levelLabel, 8, 5);

        if (turnPhase === 'player') {
            // Compute seconds remaining
            const nowMs = performance.now();
            const elapsed = (turnTimerStartMs !== null) ? (nowMs - turnTimerStartMs) : 0;
            const secsLeft = Math.max(0, Math.floor((turnDurationMs - elapsed) / 1000));
            const mins = Math.floor(secsLeft / 60);
            const secs = secsLeft % 60;
            const secsStr = secs < 10 ? '0' + secs : '' + secs;
            const timerText = '\u23F1 ' + mins + ':' + secsStr;

            ctx.fillStyle = secsLeft <= 5 ? '#f88' : '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(timerText, canvasW / 2, 5);

            const isUrgent = secsLeft <= 10;
            const btnColour = isUrgent ? '#c8b890' : '#8a7a60';
            const btnText = '[ \u23CE End Turn ]';

            ctx.textAlign = 'right';
            const textW = ctx.measureText(btnText).width;
            const btnPadX = 4;
            const btnPadY = 2;
            const btnW = textW + btnPadX * 2;
            const btnH = 11 + btnPadY * 2;
            const btnX = canvasW - 8 - btnW;
            const btnY = (barH - btnH) / 2;

            ctx.strokeStyle = btnColour;
            ctx.lineWidth = 1;
            ctx.strokeRect(btnX, btnY, btnW, btnH);

            ctx.fillStyle = btnColour;
            ctx.fillText(btnText, canvasW - 8 - btnPadX, btnPadY + 1);

            return {
                endTurnButtonRect: { x: btnX, y: btnY, w: btnW, h: btnH },
            };

        } else if (turnPhase === 'enemy') {
            const n = Array.isArray(enemyUnitQueue) ? enemyUnitQueue.length : 0;
            const enemyText = 'Enemy turn \u2014 watching ' + n + ' units move';

            ctx.fillStyle = '#bbb';
            ctx.textAlign = 'center';
            ctx.fillText(enemyText, canvasW / 2, 5);

            return { endTurnButtonRect: null };

        } else {
            // Resolve mode
            const nowMs = performance.now();
            const resolveElapsed = (resolveTimerStartMs !== null) ? (nowMs - resolveTimerStartMs) : 0;
            const resolveSecsLeft = Math.max(0, Math.ceil((resolveDurationMs - resolveElapsed) / 1000));
            const resMins = Math.floor(resolveSecsLeft / 60);
            const resSecs = resolveSecsLeft % 60;
            const resSecsStr = resSecs < 10 ? '0' + resSecs : '' + resSecs;
            const timerSegment = '\u23F1 ' + resMins + ':' + resSecsStr;

            const prefixText = 'Resolving\u2026 ';
            const suffixText = ' \u2014 Get ready for your next turn';

            ctx.font = '11px monospace';
            const prefixW = ctx.measureText(prefixText).width;
            const timerW  = ctx.measureText(timerSegment).width;
            const suffixW = ctx.measureText(suffixText).width;
            const totalW  = prefixW + timerW + suffixW;
            const startX  = Math.round((canvasW - totalW) / 2);

            ctx.textAlign = 'left';

            ctx.fillStyle = '#aaa';
            ctx.fillText(prefixText, startX, 5);

            ctx.fillStyle = '#f8c870';
            ctx.fillText(timerSegment, startX + prefixW, 5);

            ctx.fillStyle = '#aaa';
            ctx.fillText(suffixText, startX + prefixW + timerW, 5);

            return { endTurnButtonRect: null };
        }
    },
};

// ─── Mock canvas context ──────────────────────────────────────────────────────

function createMockCtx() {
    const calls = [];
    const TEXT_W = 60; // stubbed measureText width — same for all segments
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

// ─── Shared test state ────────────────────────────────────────────────────────

const CANVAS_W    = 1024;
const TURN_DUR    = 45_000;
const RESOLVE_DUR = 10_000;

/** Build a minimal state object for player-turn mode. */
function playerState(overrides = {}) {
    return {
        turnPhase:           'player',
        turnTimerStartMs:    1000,
        turnDurationMs:      TURN_DUR,
        enemyUnitQueue:      [],
        resolveTimerStartMs: null,
        resolveDurationMs:   RESOLVE_DUR,
        canvasW:             CANVAS_W,
        levelLabel:          'Level 1',
        ...overrides,
    };
}

/** Build a minimal state object for enemy-turn mode. */
function enemyState(queue = ['u1', 'u2', 'u3']) {
    return {
        turnPhase:           'enemy',
        turnTimerStartMs:    null,
        turnDurationMs:      TURN_DUR,
        enemyUnitQueue:      queue,
        resolveTimerStartMs: null,
        resolveDurationMs:   RESOLVE_DUR,
        canvasW:             CANVAS_W,
        levelLabel:          'Level 1',
    };
}

/** Build a minimal state object for resolve mode. */
function resolveState(resolveTimerStartMs = 5000, nowMs = 8000) {
    _stubNowMs = nowMs;
    return {
        turnPhase:           'resolve',
        turnTimerStartMs:    null,
        turnDurationMs:      TURN_DUR,
        enemyUnitQueue:      [],
        resolveTimerStartMs,
        resolveDurationMs:   RESOLVE_DUR,
        canvasW:             CANVAS_W,
        levelLabel:          'Level 1',
    };
}

// ─── Return value: endTurnButtonRect ─────────────────────────────────────────

describe('renderActiveTurnHUD — return value: endTurnButtonRect', () => {
    it('returns a non-null endTurnButtonRect when turnPhase === "player"', () => {
        _stubNowMs = 2000; // 1 s elapsed from turnTimerStartMs=1000
        const ctx = createMockCtx();
        const result = HUD.renderActiveTurnHUD(ctx, playerState());
        assert.ok(result && typeof result === 'object', 'Must return an object');
        assert.ok(result.endTurnButtonRect !== null, 'endTurnButtonRect must be non-null in player mode');
    });

    it('endTurnButtonRect has x, y, w, h properties in player mode', () => {
        _stubNowMs = 2000;
        const ctx = createMockCtx();
        const { endTurnButtonRect } = HUD.renderActiveTurnHUD(ctx, playerState());
        assert.ok(typeof endTurnButtonRect.x === 'number', 'x must be a number');
        assert.ok(typeof endTurnButtonRect.y === 'number', 'y must be a number');
        assert.ok(typeof endTurnButtonRect.w === 'number', 'w must be a number');
        assert.ok(typeof endTurnButtonRect.h === 'number', 'h must be a number');
    });

    it('endTurnButtonRect.w is positive in player mode', () => {
        _stubNowMs = 2000;
        const ctx = createMockCtx();
        const { endTurnButtonRect } = HUD.renderActiveTurnHUD(ctx, playerState());
        assert.ok(endTurnButtonRect.w > 0, 'Button width must be positive');
    });

    it('endTurnButtonRect.h is positive in player mode', () => {
        _stubNowMs = 2000;
        const ctx = createMockCtx();
        const { endTurnButtonRect } = HUD.renderActiveTurnHUD(ctx, playerState());
        assert.ok(endTurnButtonRect.h > 0, 'Button height must be positive');
    });

    it('endTurnButtonRect is within the 20px top bar vertically', () => {
        _stubNowMs = 2000;
        const ctx = createMockCtx();
        const { endTurnButtonRect } = HUD.renderActiveTurnHUD(ctx, playerState());
        assert.ok(endTurnButtonRect.y >= 0, 'Button y must be >= 0');
        assert.ok(endTurnButtonRect.y + endTurnButtonRect.h <= 20,
            'Button must be contained within the 20px bar');
    });

    it('endTurnButtonRect is right-aligned (x in right half of canvas)', () => {
        _stubNowMs = 2000;
        const ctx = createMockCtx();
        const { endTurnButtonRect } = HUD.renderActiveTurnHUD(ctx, playerState());
        assert.ok(endTurnButtonRect.x > CANVAS_W / 2,
            `Button x (${endTurnButtonRect.x}) should be in the right half of the canvas`);
        assert.ok(endTurnButtonRect.x + endTurnButtonRect.w <= CANVAS_W,
            'Button must not extend beyond the right edge');
    });

    it('returns { endTurnButtonRect: null } when turnPhase === "enemy"', () => {
        const ctx = createMockCtx();
        const result = HUD.renderActiveTurnHUD(ctx, enemyState());
        assert.ok(result && typeof result === 'object', 'Must return an object');
        assert.equal(result.endTurnButtonRect, null,
            'endTurnButtonRect must be null in enemy mode');
    });

    it('returns { endTurnButtonRect: null } when turnPhase === "resolve"', () => {
        const ctx = createMockCtx();
        const result = HUD.renderActiveTurnHUD(ctx, resolveState());
        assert.ok(result && typeof result === 'object', 'Must return an object');
        assert.equal(result.endTurnButtonRect, null,
            'endTurnButtonRect must be null in resolve mode');
    });
});

// ─── Top bar background ───────────────────────────────────────────────────────

describe('renderActiveTurnHUD — top bar background', () => {
    for (const phase of ['player', 'enemy', 'resolve']) {
        it(`draws full-width 20px bar at y=0 in ${phase} mode`, () => {
            _stubNowMs = 2000;
            const stateMap = {
                player:  playerState(),
                enemy:   enemyState(),
                resolve: resolveState(),
            };
            const ctx = createMockCtx();
            HUD.renderActiveTurnHUD(ctx, stateMap[phase]);
            const fillRects = ctx.calls.filter(c => c.method === 'fillRect');
            assert.ok(fillRects.length >= 1, 'Must call fillRect for bar background');
            const [x, y, w, h] = fillRects[0].args;
            assert.equal(x, 0,        'Bar starts at x=0');
            assert.equal(y, 0,        'Bar starts at y=0');
            assert.equal(w, CANVAS_W, 'Bar spans full canvas width');
            assert.equal(h, 20,       'Bar height is 20px');
        });
    }
});

// ─── Level label ─────────────────────────────────────────────────────────────

describe('renderActiveTurnHUD — level label', () => {
    it('renders the level label at x=8 in player mode', () => {
        _stubNowMs = 2000;
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, playerState({ levelLabel: 'Forest Map' }));
        const labelCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0] === 'Forest Map');
        assert.ok(labelCall, 'Level label must be rendered');
        assert.equal(labelCall.args[1], 8, 'Label x must be 8');
    });

    it('renders the level label in enemy mode', () => {
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, { ...enemyState(), levelLabel: 'My Level' });
        const texts = ctx.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
        assert.ok(texts.includes('My Level'), 'Level label must be rendered in enemy mode');
    });
});

// ─── Player mode: timer ───────────────────────────────────────────────────────

describe('renderActiveTurnHUD — player mode timer format', () => {
    // nowMs - turnTimerStartMs = elapsed; secsLeft = floor((turnDurationMs - elapsed) / 1000)
    const cases = [
        { elapsed: 0,      expected: '\u23F1 0:45' },  // 45s remaining
        { elapsed: 5_000,  expected: '\u23F1 0:40' },  // 40s remaining
        { elapsed: 36_000, expected: '\u23F1 0:09' },  // 9s remaining (padded)
        { elapsed: 45_000, expected: '\u23F1 0:00' },  // expired → 0
        { elapsed: 60_000, expected: '\u23F1 0:00' },  // overrun → clamped to 0
    ];

    for (const { elapsed, expected } of cases) {
        it(`formats correctly when elapsed=${elapsed}ms (expected "${expected}")`, () => {
            _stubNowMs = 1000 + elapsed; // turnTimerStartMs = 1000
            const ctx = createMockCtx();
            HUD.renderActiveTurnHUD(ctx, playerState({ turnTimerStartMs: 1000 }));
            const texts = ctx.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
            assert.ok(texts.includes(expected),
                `Expected timer text "${expected}", got: ${JSON.stringify(texts)}`);
        });
    }

    it('timer is centred at canvasW/2', () => {
        _stubNowMs = 2000;
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, playerState());
        const timerCall = ctx.calls.find(c => c.method === 'fillText' && c.args[0].startsWith('\u23F1'));
        assert.ok(timerCall, 'Timer fillText call must exist');
        assert.equal(timerCall.args[1], CANVAS_W / 2, 'Timer x must be canvasW/2');
    });
});

describe('renderActiveTurnHUD — player mode timer colour', () => {
    it('timer fillStyle is #fff when secsLeft > 5', () => {
        // elapsed = 0 → secsLeft = 45
        _stubNowMs = 1000;
        const ctx = createMockCtx();
        let fillStyleAtTimer = null;
        const origFillText = ctx.fillText.bind(ctx);
        ctx.fillText = function(...args) {
            if (typeof args[0] === 'string' && args[0].startsWith('\u23F1')) {
                fillStyleAtTimer = ctx.fillStyle;
            }
            origFillText(...args);
        };
        HUD.renderActiveTurnHUD(ctx, playerState({ turnTimerStartMs: 1000 }));
        assert.equal(fillStyleAtTimer, '#fff', 'Timer should be white when secsLeft > 5');
    });

    it('timer fillStyle is #f88 when secsLeft is exactly 5', () => {
        // elapsed = turnDurationMs - 5000 = 40000
        _stubNowMs = 1000 + 40_000;
        const ctx = createMockCtx();
        let fillStyleAtTimer = null;
        const origFillText = ctx.fillText.bind(ctx);
        ctx.fillText = function(...args) {
            if (typeof args[0] === 'string' && args[0].startsWith('\u23F1')) {
                fillStyleAtTimer = ctx.fillStyle;
            }
            origFillText(...args);
        };
        HUD.renderActiveTurnHUD(ctx, playerState({ turnTimerStartMs: 1000 }));
        assert.equal(fillStyleAtTimer, '#f88', 'Timer should be #f88 at exactly 5s remaining');
    });

    it('timer fillStyle is #f88 when secsLeft < 5', () => {
        // elapsed = turnDurationMs - 3000 = 42000 → secsLeft = 3
        _stubNowMs = 1000 + 42_000;
        const ctx = createMockCtx();
        let fillStyleAtTimer = null;
        const origFillText = ctx.fillText.bind(ctx);
        ctx.fillText = function(...args) {
            if (typeof args[0] === 'string' && args[0].startsWith('\u23F1')) {
                fillStyleAtTimer = ctx.fillStyle;
            }
            origFillText(...args);
        };
        HUD.renderActiveTurnHUD(ctx, playerState({ turnTimerStartMs: 1000 }));
        assert.equal(fillStyleAtTimer, '#f88', 'Timer should be #f88 when secsLeft < 5');
    });
});

// ─── Player mode: End Turn button ─────────────────────────────────────────────

describe('renderActiveTurnHUD — player mode End Turn button', () => {
    it('calls strokeRect for the button border', () => {
        _stubNowMs = 2000;
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, playerState());
        const strokeRects = ctx.calls.filter(c => c.method === 'strokeRect');
        assert.ok(strokeRects.length >= 1, 'Should call strokeRect for button border');
    });

    it('renders "End Turn" text in the button', () => {
        _stubNowMs = 2000;
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, playerState());
        const texts = ctx.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
        assert.ok(texts.some(t => typeof t === 'string' && t.includes('End Turn')),
            'End Turn button text must be rendered');
    });

    it('button strokeStyle is #8a7a60 when secsLeft > 10', () => {
        // elapsed = 0 → secsLeft = 45 (> 10)
        _stubNowMs = 1000;
        const ctx = createMockCtx();
        let strokeAtBtn = null;
        const origStrokeRect = ctx.strokeRect.bind(ctx);
        ctx.strokeRect = function(...args) {
            strokeAtBtn = ctx.strokeStyle;
            origStrokeRect(...args);
        };
        HUD.renderActiveTurnHUD(ctx, playerState({ turnTimerStartMs: 1000 }));
        assert.equal(strokeAtBtn, '#8a7a60', 'Button border should be dim gold when secsLeft > 10');
    });

    it('button strokeStyle is #c8b890 when secsLeft is exactly 10', () => {
        // elapsed = turnDurationMs - 10000 = 35000 → secsLeft = 10
        _stubNowMs = 1000 + 35_000;
        const ctx = createMockCtx();
        let strokeAtBtn = null;
        const origStrokeRect = ctx.strokeRect.bind(ctx);
        ctx.strokeRect = function(...args) {
            strokeAtBtn = ctx.strokeStyle;
            origStrokeRect(...args);
        };
        HUD.renderActiveTurnHUD(ctx, playerState({ turnTimerStartMs: 1000 }));
        assert.equal(strokeAtBtn, '#c8b890', 'Button border should be gold at exactly 10s remaining');
    });

    it('button strokeStyle is #c8b890 when secsLeft < 10', () => {
        // elapsed = turnDurationMs - 4000 = 41000 → secsLeft = 4
        _stubNowMs = 1000 + 41_000;
        const ctx = createMockCtx();
        let strokeAtBtn = null;
        const origStrokeRect = ctx.strokeRect.bind(ctx);
        ctx.strokeRect = function(...args) {
            strokeAtBtn = ctx.strokeStyle;
            origStrokeRect(...args);
        };
        HUD.renderActiveTurnHUD(ctx, playerState({ turnTimerStartMs: 1000 }));
        assert.equal(strokeAtBtn, '#c8b890', 'Button border should be gold when secsLeft < 10');
    });

    it('does NOT call strokeRect in enemy mode', () => {
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, enemyState());
        const strokeRects = ctx.calls.filter(c => c.method === 'strokeRect');
        assert.equal(strokeRects.length, 0, 'No strokeRect should be called in enemy mode');
    });

    it('does NOT call strokeRect in resolve mode', () => {
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, resolveState());
        const strokeRects = ctx.calls.filter(c => c.method === 'strokeRect');
        assert.equal(strokeRects.length, 0, 'No strokeRect should be called in resolve mode');
    });
});

// ─── Enemy mode ───────────────────────────────────────────────────────────────

describe('renderActiveTurnHUD — enemy mode', () => {
    it('does not throw', () => {
        const ctx = createMockCtx();
        assert.doesNotThrow(() => HUD.renderActiveTurnHUD(ctx, enemyState()));
    });

    it('renders the enemy turn text centred at canvasW/2', () => {
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, enemyState(['a', 'b', 'c']));
        const enemyCall = ctx.calls.find(c =>
            c.method === 'fillText' && typeof c.args[0] === 'string' && c.args[0].includes('Enemy turn'));
        assert.ok(enemyCall, 'Enemy turn text must be rendered');
        assert.equal(enemyCall.args[1], CANVAS_W / 2, 'Enemy text x must be canvasW/2');
    });

    it('includes the unit count in the enemy text', () => {
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, enemyState(['u1', 'u2', 'u3', 'u4']));
        const texts = ctx.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
        const enemyText = texts.find(t => t.includes('Enemy turn'));
        assert.ok(enemyText, 'Enemy text must be rendered');
        assert.ok(enemyText.includes('4'), 'Enemy text must include queue count (4)');
    });

    it('uses #bbb fillStyle for the enemy text', () => {
        const ctx = createMockCtx();
        let fillStyleAtEnemy = null;
        const origFillText = ctx.fillText.bind(ctx);
        ctx.fillText = function(...args) {
            if (typeof args[0] === 'string' && args[0].includes('Enemy turn')) {
                fillStyleAtEnemy = ctx.fillStyle;
            }
            origFillText(...args);
        };
        HUD.renderActiveTurnHUD(ctx, enemyState());
        assert.equal(fillStyleAtEnemy, '#bbb', 'Enemy text colour must be #bbb');
    });

    it('shows 0 units when queue is empty', () => {
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, enemyState([]));
        const texts = ctx.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
        const enemyText = texts.find(t => t.includes('Enemy turn'));
        assert.ok(enemyText, 'Enemy text must be rendered even with empty queue');
        assert.ok(enemyText.includes('0'), 'Enemy text must include 0 when queue is empty');
    });
});

// ─── Resolve mode ─────────────────────────────────────────────────────────────

describe('renderActiveTurnHUD — resolve mode', () => {
    it('does not throw', () => {
        const ctx = createMockCtx();
        assert.doesNotThrow(() => HUD.renderActiveTurnHUD(ctx, resolveState()));
    });

    it('renders three fillText calls for the resolve message segments', () => {
        // nowMs=5000, resolveTimerStartMs=1000 → resolveElapsed=4000
        // resolveSecsLeft = ceil((10000-4000)/1000) = ceil(6) = 6
        _stubNowMs = 5000;
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, {
            turnPhase:           'resolve',
            turnTimerStartMs:    null,
            turnDurationMs:      TURN_DUR,
            enemyUnitQueue:      [],
            resolveTimerStartMs: 1000,
            resolveDurationMs:   RESOLVE_DUR,
            canvasW:             CANVAS_W,
            levelLabel:          'Level 1',
        });
        // Expected 4 fillText calls: levelLabel + prefix + timer + suffix
        const textCalls = ctx.calls.filter(c => c.method === 'fillText');
        assert.ok(textCalls.length >= 4,
            `Expected at least 4 fillText calls, got ${textCalls.length}`);
    });

    it('renders "Resolving…" prefix text', () => {
        _stubNowMs = 5000;
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, {
            turnPhase:           'resolve',
            turnTimerStartMs:    null,
            turnDurationMs:      TURN_DUR,
            enemyUnitQueue:      [],
            resolveTimerStartMs: 1000,
            resolveDurationMs:   RESOLVE_DUR,
            canvasW:             CANVAS_W,
            levelLabel:          'Level 1',
        });
        const texts = ctx.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
        assert.ok(texts.some(t => t.includes('Resolving')), 'Must render "Resolving…" prefix');
    });

    it('renders the resolve timer segment starting with ⏱', () => {
        _stubNowMs = 5000;
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, {
            turnPhase:           'resolve',
            turnTimerStartMs:    null,
            turnDurationMs:      TURN_DUR,
            enemyUnitQueue:      [],
            resolveTimerStartMs: 1000,
            resolveDurationMs:   RESOLVE_DUR,
            canvasW:             CANVAS_W,
            levelLabel:          'Level 1',
        });
        const texts = ctx.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
        assert.ok(texts.some(t => typeof t === 'string' && t.startsWith('\u23F1')),
            'Must render a timer segment starting with ⏱');
    });

    it('renders "Get ready for your next turn" suffix', () => {
        _stubNowMs = 5000;
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, {
            turnPhase:           'resolve',
            turnTimerStartMs:    null,
            turnDurationMs:      TURN_DUR,
            enemyUnitQueue:      [],
            resolveTimerStartMs: 1000,
            resolveDurationMs:   RESOLVE_DUR,
            canvasW:             CANVAS_W,
            levelLabel:          'Level 1',
        });
        const texts = ctx.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
        assert.ok(texts.some(t => t.includes('Get ready')),
            'Must render "Get ready for your next turn" suffix');
    });

    it('renders the timer segment in #f8c870 (warm gold)', () => {
        _stubNowMs = 5000;
        const ctx = createMockCtx();
        let fillStyleAtTimer = null;
        const origFillText = ctx.fillText.bind(ctx);
        ctx.fillText = function(...args) {
            if (typeof args[0] === 'string' && args[0].startsWith('\u23F1')) {
                fillStyleAtTimer = ctx.fillStyle;
            }
            origFillText(...args);
        };
        HUD.renderActiveTurnHUD(ctx, {
            turnPhase:           'resolve',
            turnTimerStartMs:    null,
            turnDurationMs:      TURN_DUR,
            enemyUnitQueue:      [],
            resolveTimerStartMs: 1000,
            resolveDurationMs:   RESOLVE_DUR,
            canvasW:             CANVAS_W,
            levelLabel:          'Level 1',
        });
        assert.equal(fillStyleAtTimer, '#f8c870', 'Resolve timer segment must be #f8c870');
    });

    it('uses #aaa for prefix and suffix in resolve mode', () => {
        _stubNowMs = 5000;
        const ctx = createMockCtx();
        const fillStylesAtText = [];
        const origFillText = ctx.fillText.bind(ctx);
        ctx.fillText = function(...args) {
            if (typeof args[0] === 'string' &&
                (args[0].includes('Resolving') || args[0].includes('Get ready'))) {
                fillStylesAtText.push(ctx.fillStyle);
            }
            origFillText(...args);
        };
        HUD.renderActiveTurnHUD(ctx, {
            turnPhase:           'resolve',
            turnTimerStartMs:    null,
            turnDurationMs:      TURN_DUR,
            enemyUnitQueue:      [],
            resolveTimerStartMs: 1000,
            resolveDurationMs:   RESOLVE_DUR,
            canvasW:             CANVAS_W,
            levelLabel:          'Level 1',
        });
        assert.ok(fillStylesAtText.length >= 2, 'Should capture fillStyle for both prefix and suffix');
        for (const colour of fillStylesAtText) {
            assert.equal(colour, '#aaa', 'Prefix and suffix must be #aaa');
        }
    });

    it('resolve timer shows 0:00 when timer has expired', () => {
        // resolveTimerStartMs = 0, nowMs = resolveDurationMs + 5000 (well past end)
        _stubNowMs = RESOLVE_DUR + 5000;
        const ctx = createMockCtx();
        HUD.renderActiveTurnHUD(ctx, {
            turnPhase:           'resolve',
            turnTimerStartMs:    null,
            turnDurationMs:      TURN_DUR,
            enemyUnitQueue:      [],
            resolveTimerStartMs: 0,
            resolveDurationMs:   RESOLVE_DUR,
            canvasW:             CANVAS_W,
            levelLabel:          'Level 1',
        });
        const texts = ctx.calls.filter(c => c.method === 'fillText').map(c => c.args[0]);
        const timerText = texts.find(t => typeof t === 'string' && t.startsWith('\u23F1'));
        assert.ok(timerText, 'Timer segment must exist');
        assert.ok(timerText.includes('0:00'), `Timer must show 0:00 when expired, got "${timerText}"`);
    });

    it('resolve timer handles null resolveTimerStartMs gracefully', () => {
        _stubNowMs = 5000;
        const ctx = createMockCtx();
        // resolveTimerStartMs=null → resolveElapsed=0 → resolveSecsLeft = ceil(10000/1000) = 10
        assert.doesNotThrow(() => HUD.renderActiveTurnHUD(ctx, {
            turnPhase:           'resolve',
            turnTimerStartMs:    null,
            turnDurationMs:      TURN_DUR,
            enemyUnitQueue:      [],
            resolveTimerStartMs: null,
            resolveDurationMs:   RESOLVE_DUR,
            canvasW:             CANVAS_W,
            levelLabel:          'Level 1',
        }));
    });
});
