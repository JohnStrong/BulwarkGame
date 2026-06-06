/**
 * Tests for the GameState primitives introduced in game-iso.js (Task 1).
 *
 * Covers: makeInitialState, update, PLACEMENT_DURATION_MS,
 *         _hitTest, _canPlaceOn, _getUnitBarClick.
 *
 * All functions are pure and DOM-free — replicated here verbatim from
 * game-iso.js so this suite runs in plain Node without a browser.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game-iso-state-primitives.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Replicas of game-iso.js primitives (no DOM required) ────────────────────

const PLACEMENT_DURATION_MS = 30_000;

function makeInitialState(unitDefs) {
    return Object.freeze({
        phase:              'loading',
        placementStartMs:   null,
        placementDone:      false,
        briefingOpen:       false,

        unitDefs:           Object.freeze((unitDefs || []).map(d => Object.freeze({ ...d }))),
        placedUnits:        Object.freeze([]),

        hoveredTile:        null,
        selectedTile:       null,
        selectedLift:       0,
        selectedLiftTarget: 0,

        selectedUnitIdx:    -1,
        hudOpen:            false,
        hudWidth:           0,
        hudTargetWidth:     0,

        turnCounter:        0,

        lastBriefingRects:  null,
        lastPlacementRects: null,
    });
}

function update(state, patch) {
    return Object.freeze(Object.assign({}, state, patch));
}

function _hitTest(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w &&
           y >= rect.y && y <= rect.y + rect.h;
}

function _canPlaceOn(sprite) {
    const blocked = ['tree-', 'water-', 'castle-wall', 'castle-keep-', 'castle-gatehouse', 'rock'];
    return !blocked.some(prefix => sprite.startsWith(prefix));
}

// HUD constants replicated from hud.js (used by _getUnitBarClick)
const UNIT_BOX_SIZE = 56;
const UNIT_BOX_PAD  = 8;

function _getUnitBarClick(mouseX, mouseY, unitDefs, canvasW, canvasH) {
    if (!unitDefs || unitDefs.length === 0) return -1;
    const BOX = UNIT_BOX_SIZE, PAD = UNIT_BOX_PAD;
    const totalBarW = unitDefs.length * (BOX + PAD) - PAD;
    const barStartX = (canvasW - totalBarW) / 2;
    const barY = canvasH - BOX - 28;
    if (mouseY < barY || mouseY > barY + BOX + 20) return -1;
    for (let i = 0; i < unitDefs.length; i++) {
        const bx = barStartX + i * (BOX + PAD);
        if (mouseX >= bx && mouseX <= bx + BOX) return i;
    }
    return -1;
}

// ─── PLACEMENT_DURATION_MS ────────────────────────────────────────────────────

describe('PLACEMENT_DURATION_MS', () => {
    it('equals 30 000 ms (30 seconds)', () => {
        assert.equal(PLACEMENT_DURATION_MS, 30_000);
    });

    it('is a number', () => {
        assert.equal(typeof PLACEMENT_DURATION_MS, 'number');
    });
});

// ─── makeInitialState ─────────────────────────────────────────────────────────

describe('makeInitialState', () => {
    it('sets phase to loading', () => {
        const s = makeInitialState([]);
        assert.equal(s.phase, 'loading');
    });

    it('sets placementStartMs to null', () => {
        assert.equal(makeInitialState([]).placementStartMs, null);
    });

    it('sets placementDone to false', () => {
        assert.equal(makeInitialState([]).placementDone, false);
    });

    it('sets briefingOpen to false', () => {
        assert.equal(makeInitialState([]).briefingOpen, false);
    });

    it('freezes the returned object', () => {
        assert.ok(Object.isFrozen(makeInitialState([])));
    });

    it('copies unitDefs into a frozen array', () => {
        const defs = [{ name: 'Archer', qty: 3 }];
        const s = makeInitialState(defs);
        assert.equal(s.unitDefs.length, 1);
        assert.equal(s.unitDefs[0].name, 'Archer');
        assert.ok(Object.isFrozen(s.unitDefs));
    });

    it('does not share the same array reference as the input', () => {
        const defs = [{ name: 'Archer' }];
        const s = makeInitialState(defs);
        assert.notStrictEqual(s.unitDefs, defs);
    });

    it('freezes each individual unitDef object', () => {
        const s = makeInitialState([{ name: 'Knight', qty: 2 }]);
        assert.ok(Object.isFrozen(s.unitDefs[0]));
    });

    it('starts with an empty frozen placedUnits array', () => {
        const s = makeInitialState([]);
        assert.equal(s.placedUnits.length, 0);
        assert.ok(Object.isFrozen(s.placedUnits));
    });

    it('sets numeric tile-interaction fields to sensible defaults', () => {
        const s = makeInitialState([]);
        assert.equal(s.selectedLift, 0);
        assert.equal(s.selectedLiftTarget, 0);
    });

    it('sets hoveredTile and selectedTile to null', () => {
        const s = makeInitialState([]);
        assert.equal(s.hoveredTile, null);
        assert.equal(s.selectedTile, null);
    });

    it('sets HUD chrome defaults', () => {
        const s = makeInitialState([]);
        assert.equal(s.selectedUnitIdx, -1);
        assert.equal(s.hudOpen, false);
        assert.equal(s.hudWidth, 0);
        assert.equal(s.hudTargetWidth, 0);
    });

    it('sets turnCounter to 0', () => {
        assert.equal(makeInitialState([]).turnCounter, 0);
    });

    it('sets rect caches to null', () => {
        const s = makeInitialState([]);
        assert.equal(s.lastBriefingRects, null);
        assert.equal(s.lastPlacementRects, null);
    });

    it('handles null input gracefully (treats as empty array)', () => {
        assert.doesNotThrow(() => makeInitialState(null));
        assert.equal(makeInitialState(null).unitDefs.length, 0);
    });

    it('handles undefined input gracefully', () => {
        assert.doesNotThrow(() => makeInitialState(undefined));
        assert.equal(makeInitialState(undefined).unitDefs.length, 0);
    });

    it('handles multiple unitDefs', () => {
        const defs = [
            { name: 'Archer', qty: 3 },
            { name: 'Knight', qty: 2 },
            { name: 'Mage',   qty: 1 },
        ];
        const s = makeInitialState(defs);
        assert.equal(s.unitDefs.length, 3);
        assert.equal(s.unitDefs[2].name, 'Mage');
    });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('update', () => {
    it('merges a single-field patch', () => {
        const s = makeInitialState([]);
        const s2 = update(s, { phase: 'briefing' });
        assert.equal(s2.phase, 'briefing');
    });

    it('leaves all other fields unchanged', () => {
        const s = makeInitialState([{ name: 'Archer' }]);
        const s2 = update(s, { phase: 'briefing' });
        assert.equal(s2.turnCounter, 0);
        assert.equal(s2.hudOpen, false);
        assert.strictEqual(s2.unitDefs, s.unitDefs);
    });

    it('does not mutate the input state', () => {
        const s = makeInitialState([]);
        update(s, { phase: 'briefing' });
        assert.equal(s.phase, 'loading'); // original untouched
    });

    it('returns a frozen object', () => {
        const s = makeInitialState([]);
        assert.ok(Object.isFrozen(update(s, { turnCounter: 1 })));
    });

    it('patch fields overwrite matching state fields', () => {
        const s = update(makeInitialState([]), { hudWidth: 100 });
        const s2 = update(s, { hudWidth: 200 });
        assert.equal(s2.hudWidth, 200);
    });

    it('patch with multiple fields applies all of them', () => {
        const s = makeInitialState([]);
        const s2 = update(s, { phase: 'placement', placementStartMs: 5000, placementDone: false });
        assert.equal(s2.phase, 'placement');
        assert.equal(s2.placementStartMs, 5000);
        assert.equal(s2.placementDone, false);
    });

    it('empty patch returns a new frozen object identical in value', () => {
        const s = makeInitialState([]);
        const s2 = update(s, {});
        // Different object reference but same shape
        assert.notStrictEqual(s2, s);
        assert.equal(s2.phase, s.phase);
        assert.ok(Object.isFrozen(s2));
    });

    it('can store null values via patch', () => {
        const s = update(makeInitialState([]), { hoveredTile: { row: 1, col: 2 } });
        const s2 = update(s, { hoveredTile: null });
        assert.equal(s2.hoveredTile, null);
    });

    it('chained updates accumulate correctly', () => {
        const s = makeInitialState([]);
        const s2 = update(s, { phase: 'briefing' });
        const s3 = update(s2, { briefingOpen: true });
        const s4 = update(s3, { turnCounter: 7 });
        assert.equal(s4.phase, 'briefing');
        assert.equal(s4.briefingOpen, true);
        assert.equal(s4.turnCounter, 7);
    });
});

// ─── _hitTest ────────────────────────────────────────────────────────────────

describe('_hitTest', () => {
    const rect = { x: 100, y: 200, w: 80, h: 40 };

    it('returns true for a point at the top-left corner (inclusive)', () => {
        assert.ok(_hitTest(100, 200, rect));
    });

    it('returns true for a point at the bottom-right corner (inclusive)', () => {
        assert.ok(_hitTest(180, 240, rect));
    });

    it('returns true for a point strictly inside the rect', () => {
        assert.ok(_hitTest(140, 220, rect));
    });

    it('returns false when x is one pixel to the left', () => {
        assert.ok(!_hitTest(99, 220, rect));
    });

    it('returns false when x is one pixel to the right', () => {
        assert.ok(!_hitTest(181, 220, rect));
    });

    it('returns false when y is one pixel above', () => {
        assert.ok(!_hitTest(140, 199, rect));
    });

    it('returns false when y is one pixel below', () => {
        assert.ok(!_hitTest(140, 241, rect));
    });

    it('returns false for origin (0,0) when rect is not at origin', () => {
        assert.ok(!_hitTest(0, 0, rect));
    });

    it('returns true for a point at rect midpoint', () => {
        assert.ok(_hitTest(rect.x + rect.w / 2, rect.y + rect.h / 2, rect));
    });

    it('handles a zero-width rect — only its left edge matches', () => {
        const zeroW = { x: 50, y: 50, w: 0, h: 20 };
        assert.ok(_hitTest(50, 60, zeroW));
        assert.ok(!_hitTest(51, 60, zeroW));
    });

    it('handles a zero-height rect — only its top edge matches', () => {
        const zeroH = { x: 50, y: 50, w: 20, h: 0 };
        assert.ok(_hitTest(60, 50, zeroH));
        assert.ok(!_hitTest(60, 51, zeroH));
    });

    it('handles fractional coordinates inside the rect', () => {
        assert.ok(_hitTest(100.5, 200.5, rect));
    });

    it('handles fractional coordinates outside the rect', () => {
        assert.ok(!_hitTest(99.9, 220, rect));
    });

    it('handles a rect at the origin', () => {
        const origin = { x: 0, y: 0, w: 10, h: 10 };
        assert.ok(_hitTest(0, 0, origin));
        assert.ok(_hitTest(5, 5, origin));
        assert.ok(!_hitTest(-1, 5, origin));
        assert.ok(!_hitTest(11, 5, origin));
    });
});

// ─── _canPlaceOn ─────────────────────────────────────────────────────────────

describe('_canPlaceOn — allowed tiles', () => {
    it('allows grass-short-1', () => assert.ok(_canPlaceOn('grass-short-1')));
    it('allows grass-short-2', () => assert.ok(_canPlaceOn('grass-short-2')));
    it('allows grass-flowers-1', () => assert.ok(_canPlaceOn('grass-flowers-1')));
    it('allows road-full', () => assert.ok(_canPlaceOn('road-full')));
    it('allows bridge-mm', () => assert.ok(_canPlaceOn('bridge-mm')));
    it('allows castle-bailey-1', () => assert.ok(_canPlaceOn('castle-bailey-1')));
    it('allows castle-bailey-2', () => assert.ok(_canPlaceOn('castle-bailey-2')));
    it('allows castle-bailey-3', () => assert.ok(_canPlaceOn('castle-bailey-3')));
    it('allows castle-tower (not a blocked prefix)', () => assert.ok(_canPlaceOn('castle-tower')));
    it('allows dirt-1', () => assert.ok(_canPlaceOn('dirt-1')));
    it('allows sand-1', () => assert.ok(_canPlaceOn('sand-1')));
});

describe('_canPlaceOn — blocked tiles', () => {
    it('blocks tree-1', () => assert.ok(!_canPlaceOn('tree-1')));
    it('blocks tree-2', () => assert.ok(!_canPlaceOn('tree-2')));
    it('blocks tree-oak', () => assert.ok(!_canPlaceOn('tree-oak')));
    it('blocks tree-pine', () => assert.ok(!_canPlaceOn('tree-pine')));
    it('blocks water-1', () => assert.ok(!_canPlaceOn('water-1')));
    it('blocks water-2', () => assert.ok(!_canPlaceOn('water-2')));
    it('blocks castle-wall (exact prefix match)', () => assert.ok(!_canPlaceOn('castle-wall')));
    it('blocks castle-wall-damaged', () => assert.ok(!_canPlaceOn('castle-wall-damaged')));
    it('blocks castle-keep-tl', () => assert.ok(!_canPlaceOn('castle-keep-tl')));
    it('blocks castle-keep-center', () => assert.ok(!_canPlaceOn('castle-keep-center')));
    it('blocks castle-keep-bl', () => assert.ok(!_canPlaceOn('castle-keep-bl')));
    it('blocks castle-gatehouse', () => assert.ok(!_canPlaceOn('castle-gatehouse')));
    it('blocks castle-gatehouse-damaged', () => assert.ok(!_canPlaceOn('castle-gatehouse-damaged')));
    it('blocks rock (exact prefix match)', () => assert.ok(!_canPlaceOn('rock')));
    it('blocks rock-1', () => assert.ok(!_canPlaceOn('rock-1')));
    it('blocks rock-large', () => assert.ok(!_canPlaceOn('rock-large')));
});

describe('_canPlaceOn — edge cases', () => {
    it('empty string does not match any blocked prefix — allowed', () => {
        assert.ok(_canPlaceOn(''));
    });

    it('prefix substring in middle of name is not blocked (startsWith only)', () => {
        // "my-tree-sprite" does not start with "tree-"
        assert.ok(_canPlaceOn('my-tree-sprite'));
    });

    it('castle-keep without trailing dash is not blocked', () => {
        // The blocked prefix is "castle-keep-" (with dash), so "castle-keep" alone passes
        assert.ok(_canPlaceOn('castle-keep'));
    });

    it('castle-gatehouse-tower (starts with castle-gatehouse) is blocked', () => {
        assert.ok(!_canPlaceOn('castle-gatehouse-tower'));
    });
});

// ─── _getUnitBarClick ─────────────────────────────────────────────────────────

describe('_getUnitBarClick — empty / missing unitDefs', () => {
    it('returns -1 for empty unitDefs array', () => {
        assert.equal(_getUnitBarClick(500, 700, [], 1024, 768), -1);
    });

    it('returns -1 for null unitDefs', () => {
        assert.equal(_getUnitBarClick(500, 700, null, 1024, 768), -1);
    });

    it('returns -1 for undefined unitDefs', () => {
        assert.equal(_getUnitBarClick(500, 700, undefined, 1024, 768), -1);
    });
});

describe('_getUnitBarClick — geometry calculations', () => {
    // Constants: BOX=56, PAD=8
    // 1 unit: totalBarW = 56, barStartX = (canvasW - 56) / 2
    // With canvasW=1024, canvasH=768:
    //   totalBarW = 56
    //   barStartX = (1024 - 56) / 2 = 484
    //   barY      = 768 - 56 - 28 = 684
    //   barEndY   = 684 + 56 + 20 = 760
    //   slot 0 x: [484, 540]

    const units1 = [{ name: 'Archer' }];
    const W = 1024, H = 768;

    it('hits slot 0 for a single-unit bar at the slot centre', () => {
        const barStartX = (W - 56) / 2; // 484
        const barY      = H - 56 - 28;  // 684
        const cx = barStartX + 56 / 2;  // 512
        const cy = barY + 56 / 2;       // 712
        assert.equal(_getUnitBarClick(cx, cy, units1, W, H), 0);
    });

    it('hits slot 0 at the left edge of the slot', () => {
        const barStartX = (W - 56) / 2;
        const barY      = H - 56 - 28;
        assert.equal(_getUnitBarClick(barStartX, barY + 1, units1, W, H), 0);
    });

    it('hits slot 0 at the right edge of the slot', () => {
        const barStartX = (W - 56) / 2;
        const barY      = H - 56 - 28;
        assert.equal(_getUnitBarClick(barStartX + 56, barY + 1, units1, W, H), 0);
    });

    it('misses when mouseY is above the bar', () => {
        const barY = H - 56 - 28;
        assert.equal(_getUnitBarClick(512, barY - 1, units1, W, H), -1);
    });

    it('misses when mouseY is below the bar bottom (barY + BOX + 20)', () => {
        const barY    = H - 56 - 28;
        const barEndY = barY + 56 + 20;
        assert.equal(_getUnitBarClick(512, barEndY + 1, units1, W, H), -1);
    });

    it('misses when mouseX is to the left of slot 0', () => {
        const barStartX = (W - 56) / 2;
        const barY      = H - 56 - 28;
        assert.equal(_getUnitBarClick(barStartX - 1, barY + 28, units1, W, H), -1);
    });

    it('misses when mouseX is between slots (in the padding gap)', () => {
        // 2-unit bar: totalBarW = 2*64 - 8 = 120, barStartX = (1024-120)/2 = 452
        // slot 0: [452, 508], gap: (508, 516), slot 1: [516, 572]
        const units2 = [{ name: 'A' }, { name: 'B' }];
        const BOX = 56, PAD = 8;
        const totalBarW = 2 * (BOX + PAD) - PAD; // 120
        const barStartX = (W - totalBarW) / 2;   // 452
        const barY      = H - BOX - 28;
        const gapX      = barStartX + BOX + PAD / 2; // midpoint of 8-px gap
        assert.equal(_getUnitBarClick(gapX, barY + 28, units2, W, H), -1);
    });
});

describe('_getUnitBarClick — multi-slot selection', () => {
    const W = 1024, H = 768;
    const BOX = 56, PAD = 8;

    function slotX(numUnits, slotIdx) {
        const totalBarW = numUnits * (BOX + PAD) - PAD;
        const barStartX = (W - totalBarW) / 2;
        return barStartX + slotIdx * (BOX + PAD);
    }

    it('returns correct index for the last slot in a 3-unit bar', () => {
        const units3 = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
        const barY   = H - BOX - 28;
        const cx     = slotX(3, 2) + BOX / 2; // centre of slot 2
        assert.equal(_getUnitBarClick(cx, barY + BOX / 2, units3, W, H), 2);
    });

    it('returns 0 for the first slot in a 4-unit bar', () => {
        const units4 = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];
        const barY   = H - BOX - 28;
        const cx     = slotX(4, 0) + BOX / 2;
        assert.equal(_getUnitBarClick(cx, barY + BOX / 2, units4, W, H), 0);
    });

    it('returns 1 for the second slot in a 2-unit bar', () => {
        const units2 = [{ name: 'A' }, { name: 'B' }];
        const barY   = H - BOX - 28;
        const cx     = slotX(2, 1) + BOX / 2;
        assert.equal(_getUnitBarClick(cx, barY + BOX / 2, units2, W, H), 1);
    });
});

describe('_getUnitBarClick — different canvas sizes', () => {
    it('works correctly on a smaller 800×600 canvas with 2 units', () => {
        const W = 800, H = 600;
        const BOX = 56, PAD = 8;
        const units2 = [{ name: 'A' }, { name: 'B' }];
        const totalBarW = 2 * (BOX + PAD) - PAD;
        const barStartX = (W - totalBarW) / 2;
        const barY      = H - BOX - 28;

        // Click centre of slot 1
        const cx = barStartX + (BOX + PAD) + BOX / 2;
        const cy = barY + BOX / 2;
        assert.equal(_getUnitBarClick(cx, cy, units2, W, H), 1);
    });
});
