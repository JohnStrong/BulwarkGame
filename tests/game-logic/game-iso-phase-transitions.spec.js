/**
 * Tests for PhaseTransitions in js/game-logic/game-iso.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game-iso-phase-transitions.spec.js
 *
 * PhaseTransitions are pure GameState → GameState functions — no DOM or Canvas
 * required. This file uses a self-contained replica of the three primitives
 * (update, makeInitialState, PhaseTransitions) extracted from game-iso.js.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Replica of game-iso.js primitives (DOM-free) ────────────────────────────

function update(state, patch) {
    return Object.freeze(Object.assign({}, state, patch));
}

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

const PhaseTransitions = {
    toBriefing(state) {
        if (state.phase !== 'loading') return state;
        return update(state, { phase: 'briefing', briefingOpen: false });
    },
    toPlacement(state, nowMs) {
        if (state.phase !== 'briefing') return state;
        return update(state, {
            phase:            'placement',
            placementStartMs: nowMs,
            placementDone:    false,
        });
    },
    toActive(state) {
        if (state.phase !== 'placement' || state.placementDone) return state;
        return update(state, { phase: 'active', placementDone: true });
    },
    toggleFurtherReading(state) {
        if (state.phase !== 'briefing') return state;
        return update(state, { briefingOpen: !state.briefingOpen });
    },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PhaseTransitions.toBriefing', () => {
    it('transitions loading → briefing', () => {
        const s0 = makeInitialState([]);
        const s1 = PhaseTransitions.toBriefing(s0);
        assert.equal(s1.phase, 'briefing');
    });

    it('sets briefingOpen to false on transition', () => {
        const s0 = makeInitialState([]);
        const s1 = PhaseTransitions.toBriefing(s0);
        assert.equal(s1.briefingOpen, false);
    });

    it('is a no-op when phase is already briefing (guard)', () => {
        const s0 = makeInitialState([]);
        const s1 = PhaseTransitions.toBriefing(s0);
        const s2 = PhaseTransitions.toBriefing(s1);
        assert.strictEqual(s2, s1); // same object reference — no-op
    });

    it('is a no-op when phase is placement (guard)', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        const result = PhaseTransitions.toBriefing(sPlacement);
        assert.strictEqual(result, sPlacement);
    });

    it('is a no-op when phase is active (guard)', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        const sActive = PhaseTransitions.toActive(sPlacement);
        const result = PhaseTransitions.toBriefing(sActive);
        assert.strictEqual(result, sActive);
    });

    it('preserves all other state fields', () => {
        const s0 = makeInitialState([{ name: 'archer' }]);
        const s1 = PhaseTransitions.toBriefing(s0);
        assert.equal(s1.turnCounter, 0);
        assert.equal(s1.hudOpen, false);
        assert.equal(s1.placementStartMs, null);
        assert.strictEqual(s1.unitDefs, s0.unitDefs);
    });

    it('returns a frozen object', () => {
        const s0 = makeInitialState([]);
        const s1 = PhaseTransitions.toBriefing(s0);
        assert.ok(Object.isFrozen(s1));
    });
});

describe('PhaseTransitions.toPlacement', () => {
    it('transitions briefing → placement', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 5000);
        assert.equal(sPlacement.phase, 'placement');
    });

    it('records placementStartMs from nowMs argument', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 42000);
        assert.equal(sPlacement.placementStartMs, 42000);
    });

    it('sets placementDone to false on entry', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        assert.equal(sPlacement.placementDone, false);
    });

    it('is a no-op when phase is loading (guard)', () => {
        const s0 = makeInitialState([]);
        const result = PhaseTransitions.toPlacement(s0, 1000);
        assert.strictEqual(result, s0);
    });

    it('is a no-op when phase is placement (guard)', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        const result = PhaseTransitions.toPlacement(sPlacement, 9999);
        assert.strictEqual(result, sPlacement);
    });

    it('is a no-op when phase is active (guard)', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        const sActive = PhaseTransitions.toActive(sPlacement);
        const result = PhaseTransitions.toPlacement(sActive, 9999);
        assert.strictEqual(result, sActive);
    });

    it('returns a frozen object', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        assert.ok(Object.isFrozen(sPlacement));
    });
});

describe('PhaseTransitions.toActive', () => {
    it('transitions placement → active', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        const sActive = PhaseTransitions.toActive(sPlacement);
        assert.equal(sActive.phase, 'active');
    });

    it('sets placementDone to true', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        const sActive = PhaseTransitions.toActive(sPlacement);
        assert.equal(sActive.placementDone, true);
    });

    it('is idempotent — repeated calls return the same state unchanged', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        const sActive1 = PhaseTransitions.toActive(sPlacement);
        const sActive2 = PhaseTransitions.toActive(sActive1);
        assert.strictEqual(sActive2, sActive1); // same reference — no-op on repeat
    });

    it('is a no-op when phase is loading (guard)', () => {
        const s0 = makeInitialState([]);
        const result = PhaseTransitions.toActive(s0);
        assert.strictEqual(result, s0);
    });

    it('is a no-op when phase is briefing (guard)', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const result = PhaseTransitions.toActive(sBriefing);
        assert.strictEqual(result, sBriefing);
    });

    it('is a no-op when placementDone is already true (idempotency guard)', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        // Force placementDone=true without going through toActive
        const sDone = update(sPlacement, { placementDone: true });
        const result = PhaseTransitions.toActive(sDone);
        assert.strictEqual(result, sDone);
    });

    it('returns a frozen object', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        const sActive = PhaseTransitions.toActive(sPlacement);
        assert.ok(Object.isFrozen(sActive));
    });
});

describe('PhaseTransitions.toggleFurtherReading', () => {
    it('flips briefingOpen from false to true', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0); // briefingOpen = false
        const s1 = PhaseTransitions.toggleFurtherReading(sBriefing);
        assert.equal(s1.briefingOpen, true);
    });

    it('flips briefingOpen from true back to false', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const s1 = PhaseTransitions.toggleFurtherReading(sBriefing); // true
        const s2 = PhaseTransitions.toggleFurtherReading(s1);        // false
        assert.equal(s2.briefingOpen, false);
    });

    it('is a no-op when phase is loading (guard)', () => {
        const s0 = makeInitialState([]);
        const result = PhaseTransitions.toggleFurtherReading(s0);
        assert.strictEqual(result, s0);
    });

    it('is a no-op when phase is placement (guard)', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        const result = PhaseTransitions.toggleFurtherReading(sPlacement);
        assert.strictEqual(result, sPlacement);
    });

    it('is a no-op when phase is active (guard)', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const sPlacement = PhaseTransitions.toPlacement(sBriefing, 1000);
        const sActive = PhaseTransitions.toActive(sPlacement);
        const result = PhaseTransitions.toggleFurtherReading(sActive);
        assert.strictEqual(result, sActive);
    });

    it('preserves all other state fields when toggling', () => {
        const s0 = makeInitialState([{ name: 'archer' }]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const s1 = PhaseTransitions.toggleFurtherReading(sBriefing);
        assert.equal(s1.phase, 'briefing');
        assert.equal(s1.turnCounter, 0);
        assert.strictEqual(s1.unitDefs, s0.unitDefs);
    });

    it('returns a frozen object', () => {
        const s0 = makeInitialState([]);
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const s1 = PhaseTransitions.toggleFurtherReading(sBriefing);
        assert.ok(Object.isFrozen(s1));
    });
});

describe('PhaseTransitions — full forward sequence', () => {
    it('traverses the full loading → briefing → placement → active sequence', () => {
        const s0 = makeInitialState([]);
        assert.equal(s0.phase, 'loading');

        const s1 = PhaseTransitions.toBriefing(s0);
        assert.equal(s1.phase, 'briefing');

        const s2 = PhaseTransitions.toPlacement(s1, 1000);
        assert.equal(s2.phase, 'placement');
        assert.equal(s2.placementStartMs, 1000);
        assert.equal(s2.placementDone, false);

        const s3 = PhaseTransitions.toActive(s2);
        assert.equal(s3.phase, 'active');
        assert.equal(s3.placementDone, true);
    });

    it('no backward transition is possible', () => {
        const s0 = makeInitialState([]);
        const s1 = PhaseTransitions.toBriefing(s0);
        const s2 = PhaseTransitions.toPlacement(s1, 1000);
        const s3 = PhaseTransitions.toActive(s2);

        // Attempting to go backwards returns the state unchanged
        assert.strictEqual(PhaseTransitions.toBriefing(s3), s3);
        assert.strictEqual(PhaseTransitions.toPlacement(s3, 9999), s3);
    });
});
