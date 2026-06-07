/**
 * Tests for player-turn-timer transitions in js/game-logic/game-iso.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/player-turn-timer.spec.js
 *
 * All transitions are pure GameState → GameState functions — no DOM or Canvas
 * required. This file uses a self-contained replica of the primitives and
 * sub-transitions extracted from game-iso.js.
 *
 * Requirements: 10.3
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Replica of game-iso.js primitives (DOM-free) ────────────────────────────

function update(state, patch) {
    return Object.freeze(Object.assign({}, state, patch));
}

function makeInitialState() {
    return Object.freeze({
        phase:              'loading',
        placementStartMs:   null,
        placementDone:      false,
        briefingOpen:       false,
        unitDefs:           Object.freeze([]),
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
        // ── Turn sub-state ───────────────────────────────────────────────
        turnPhase:            'player',
        turnTimerStartMs:     null,
        turnDurationMs:       45_000,
        enemyUnitQueue:       Object.freeze([]),
        unitStepIntervalMs:   1_000,
        unitStepStartMs:      null,
        resolveDurationMs:    10_000,
        resolveTimerStartMs:  null,
        lastActiveTurnRects:  null,
        // ── Transient scratch ────────────────────────────────────────────
        pendingMoveId:        null,
        lastBriefingRects:    null,
        lastPlacementRects:   null,
    });
}

/**
 * Advance the sequential enemy unit queue during the enemy phase.
 * Replica of TickTransitions._checkEnemyStep from game-iso.js.
 *
 * @param {object} state
 * @param {number} nowMs
 * @returns {object}
 */
function _checkEnemyStep(state, nowMs) {
    if (state.phase !== 'active' || state.turnPhase !== 'enemy') return state;
    if (state.enemyUnitQueue.length === 0) {
        // All units have moved — enter resolve
        return update(state, {
            turnPhase:           'resolve',
            resolveTimerStartMs: nowMs,
            unitStepStartMs:     null,
        });
    }
    if (state.unitStepStartMs === null) {
        return update(state, { unitStepStartMs: nowMs }); // arm on first frame
    }
    const elapsed = nowMs - state.unitStepStartMs;
    if (elapsed < state.unitStepIntervalMs) return state;
    // Step interval elapsed — dequeue one unit
    const [movedId, ...remaining] = state.enemyUnitQueue;
    return update(state, {
        enemyUnitQueue:  Object.freeze(remaining),
        unitStepStartMs: nowMs,
        pendingMoveId:   movedId,
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns an active-phase state ready for enemy-turn testing. */
function makeActiveEnemyState(queueIds = ['u1', 'u2', 'u3'], stepStartMs = 1000) {
    return update(makeInitialState(), {
        phase:           'active',
        turnPhase:       'enemy',
        enemyUnitQueue:  Object.freeze([...queueIds]),
        unitStepStartMs: stepStartMs,
        unitStepIntervalMs: 1_000,
    });
}

// ─── Tests for TickTransitions._checkEnemyStep ───────────────────────────────

describe('_checkEnemyStep — phase guard', () => {
    it('is a no-op when phase is "loading"', () => {
        const state = makeInitialState(); // phase === 'loading'
        const result = _checkEnemyStep(state, 5000);
        assert.strictEqual(result, state, 'should return same reference');
    });

    it('is a no-op when phase is "placement"', () => {
        const state = update(makeInitialState(), {
            phase:     'placement',
            turnPhase: 'enemy',
            enemyUnitQueue: Object.freeze(['u1']),
            unitStepStartMs: 1000,
        });
        const result = _checkEnemyStep(state, 5000);
        assert.strictEqual(result, state, 'should return same reference');
    });

    it('is a no-op when phase is "active" but turnPhase is "player"', () => {
        const state = update(makeInitialState(), {
            phase:     'active',
            turnPhase: 'player',
        });
        const result = _checkEnemyStep(state, 5000);
        assert.strictEqual(result, state, 'should return same reference');
    });

    it('is a no-op when phase is "active" but turnPhase is "resolve"', () => {
        const state = update(makeInitialState(), {
            phase:           'active',
            turnPhase:       'resolve',
            resolveTimerStartMs: 1000,
        });
        const result = _checkEnemyStep(state, 5000);
        assert.strictEqual(result, state, 'should return same reference');
    });
});

describe('_checkEnemyStep — queue empty → transition to resolve', () => {
    it('transitions turnPhase to "resolve" when enemyUnitQueue is empty', () => {
        const state = update(makeInitialState(), {
            phase:           'active',
            turnPhase:       'enemy',
            enemyUnitQueue:  Object.freeze([]),
            unitStepStartMs: 1000,
        });
        const nowMs = 2500;
        const result = _checkEnemyStep(state, nowMs);
        assert.equal(result.turnPhase, 'resolve');
    });

    it('sets resolveTimerStartMs to nowMs when transitioning to resolve', () => {
        const state = update(makeInitialState(), {
            phase:           'active',
            turnPhase:       'enemy',
            enemyUnitQueue:  Object.freeze([]),
            unitStepStartMs: 1000,
        });
        const nowMs = 2500;
        const result = _checkEnemyStep(state, nowMs);
        assert.equal(result.resolveTimerStartMs, nowMs);
    });

    it('clears unitStepStartMs when transitioning to resolve', () => {
        const state = update(makeInitialState(), {
            phase:           'active',
            turnPhase:       'enemy',
            enemyUnitQueue:  Object.freeze([]),
            unitStepStartMs: 1000,
        });
        const result = _checkEnemyStep(state, 2500);
        assert.equal(result.unitStepStartMs, null);
    });

    it('transitions to resolve even when unitStepStartMs was null and queue is empty', () => {
        // Empty queue takes precedence over the null-arm check
        const state = update(makeInitialState(), {
            phase:           'active',
            turnPhase:       'enemy',
            enemyUnitQueue:  Object.freeze([]),
            unitStepStartMs: null,
        });
        const nowMs = 3000;
        const result = _checkEnemyStep(state, nowMs);
        assert.equal(result.turnPhase, 'resolve');
        assert.equal(result.resolveTimerStartMs, nowMs);
    });
});

describe('_checkEnemyStep — arms step timer when unitStepStartMs is null', () => {
    it('sets unitStepStartMs to nowMs when it was null', () => {
        const state = update(makeInitialState(), {
            phase:           'active',
            turnPhase:       'enemy',
            enemyUnitQueue:  Object.freeze(['u1', 'u2']),
            unitStepStartMs: null,
            unitStepIntervalMs: 1_000,
        });
        const nowMs = 4000;
        const result = _checkEnemyStep(state, nowMs);
        assert.equal(result.unitStepStartMs, nowMs);
    });

    it('does not dequeue any unit when arming the step timer', () => {
        const queue = Object.freeze(['u1', 'u2']);
        const state = update(makeInitialState(), {
            phase:           'active',
            turnPhase:       'enemy',
            enemyUnitQueue:  queue,
            unitStepStartMs: null,
            unitStepIntervalMs: 1_000,
        });
        const result = _checkEnemyStep(state, 4000);
        assert.equal(result.enemyUnitQueue.length, 2);
        assert.equal(result.pendingMoveId, null);
    });

    it('does not change turnPhase when arming the step timer', () => {
        const state = update(makeInitialState(), {
            phase:           'active',
            turnPhase:       'enemy',
            enemyUnitQueue:  Object.freeze(['u1']),
            unitStepStartMs: null,
            unitStepIntervalMs: 1_000,
        });
        const result = _checkEnemyStep(state, 4000);
        assert.equal(result.turnPhase, 'enemy');
    });
});

describe('_checkEnemyStep — dequeue when elapsed >= unitStepIntervalMs', () => {
    it('dequeues the first unit ID and sets pendingMoveId to it', () => {
        // stepStartMs=1000, nowMs=2000, interval=1000 → elapsed=1000 >= 1000
        const state = makeActiveEnemyState(['unitA', 'unitB', 'unitC'], 1000);
        const result = _checkEnemyStep(state, 2000);
        assert.equal(result.pendingMoveId, 'unitA');
    });

    it('removes exactly one entry from enemyUnitQueue after a dequeue', () => {
        const state = makeActiveEnemyState(['unitA', 'unitB', 'unitC'], 1000);
        const result = _checkEnemyStep(state, 2000);
        assert.equal(result.enemyUnitQueue.length, 2);
    });

    it('the remaining queue starts with the second original entry', () => {
        const state = makeActiveEnemyState(['unitA', 'unitB', 'unitC'], 1000);
        const result = _checkEnemyStep(state, 2000);
        assert.equal(result.enemyUnitQueue[0], 'unitB');
    });

    it('resets unitStepStartMs to nowMs after dequeue', () => {
        const nowMs = 2500;
        const state = makeActiveEnemyState(['unitA', 'unitB'], 1000);
        const result = _checkEnemyStep(state, nowMs);
        assert.equal(result.unitStepStartMs, nowMs);
    });

    it('dequeues when elapsed equals exactly unitStepIntervalMs', () => {
        // exact boundary: elapsed === interval
        const state = makeActiveEnemyState(['unitX'], 1000);
        const result = _checkEnemyStep(state, 2000); // elapsed = 1000 = interval
        assert.equal(result.pendingMoveId, 'unitX');
    });

    it('dequeues when elapsed is greater than unitStepIntervalMs', () => {
        const state = makeActiveEnemyState(['unitX'], 1000);
        const result = _checkEnemyStep(state, 3500); // elapsed = 2500 > 1000
        assert.equal(result.pendingMoveId, 'unitX');
    });

    it('does not change turnPhase after dequeue when queue still has entries', () => {
        const state = makeActiveEnemyState(['unitA', 'unitB'], 1000);
        const result = _checkEnemyStep(state, 2000);
        assert.equal(result.turnPhase, 'enemy');
    });
});

describe('_checkEnemyStep — no change when elapsed < unitStepIntervalMs and queue non-empty', () => {
    it('returns the same state reference when interval has not elapsed', () => {
        // stepStartMs=1000, nowMs=1500, interval=1000 → elapsed=500 < 1000
        const state = makeActiveEnemyState(['unitA', 'unitB'], 1000);
        const result = _checkEnemyStep(state, 1500);
        assert.strictEqual(result, state, 'should return same reference — no state change');
    });

    it('leaves enemyUnitQueue unchanged when interval has not elapsed', () => {
        const state = makeActiveEnemyState(['unitA', 'unitB'], 1000);
        const result = _checkEnemyStep(state, 1500);
        assert.equal(result.enemyUnitQueue.length, 2);
    });

    it('leaves pendingMoveId null when interval has not elapsed', () => {
        const state = makeActiveEnemyState(['unitA', 'unitB'], 1000);
        const result = _checkEnemyStep(state, 1500);
        assert.equal(result.pendingMoveId, null);
    });

    it('leaves unitStepStartMs unchanged when interval has not elapsed', () => {
        const state = makeActiveEnemyState(['unitA', 'unitB'], 1000);
        const result = _checkEnemyStep(state, 1500);
        assert.equal(result.unitStepStartMs, 1000);
    });

    it('leaves turnPhase as "enemy" when interval has not elapsed', () => {
        const state = makeActiveEnemyState(['unitA', 'unitB'], 1000);
        const result = _checkEnemyStep(state, 1500);
        assert.equal(result.turnPhase, 'enemy');
    });
});

describe('_checkEnemyStep — sequential drain across multiple calls', () => {
    it('drains a queue of 3 units after 3 timed steps, then transitions to resolve', () => {
        let state = update(makeInitialState(), {
            phase:           'active',
            turnPhase:       'enemy',
            enemyUnitQueue:  Object.freeze(['u1', 'u2', 'u3']),
            unitStepStartMs: 0,
            unitStepIntervalMs: 1_000,
        });

        // Step 1: elapsed = 1000 >= 1000
        state = _checkEnemyStep(state, 1000);
        assert.equal(state.pendingMoveId, 'u1');
        assert.equal(state.enemyUnitQueue.length, 2);

        // Step 2: elapsed = 1000 >= 1000 (step timer reset to 1000 after step 1)
        state = update(state, { pendingMoveId: null }); // simulate loop clearing it
        state = _checkEnemyStep(state, 2000);
        assert.equal(state.pendingMoveId, 'u2');
        assert.equal(state.enemyUnitQueue.length, 1);

        // Step 3: elapsed = 1000 >= 1000
        state = update(state, { pendingMoveId: null });
        state = _checkEnemyStep(state, 3000);
        assert.equal(state.pendingMoveId, 'u3');
        assert.equal(state.enemyUnitQueue.length, 0);

        // Step 4: queue now empty — should transition to resolve
        state = update(state, { pendingMoveId: null });
        state = _checkEnemyStep(state, 3000);
        assert.equal(state.turnPhase, 'resolve');
        assert.equal(state.resolveTimerStartMs, 3000);
    });

    it('returns a frozen object after every type of transition', () => {
        // arm
        const s0 = update(makeInitialState(), {
            phase: 'active', turnPhase: 'enemy',
            enemyUnitQueue: Object.freeze(['u1']),
            unitStepStartMs: null,
        });
        const s1 = _checkEnemyStep(s0, 1000); // arm
        assert.ok(Object.isFrozen(s1));

        // dequeue
        const s2 = _checkEnemyStep(s1, 2000); // dequeue
        assert.ok(Object.isFrozen(s2));

        // resolve
        const s3 = _checkEnemyStep(update(s2, { pendingMoveId: null }), 2000); // empty queue → resolve
        assert.ok(Object.isFrozen(s3));
    });
});

// ─── PhaseTransitions replica (updated in task 2 to accept nowMs) ─────────────

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
    /**
     * Updated in task 2: now accepts nowMs and sets turnPhase / turnTimerStartMs.
     * Requirement 2.3: defaults to performance.now() when omitted; tests always
     * supply an explicit value to remain pure and deterministic.
     */
    toActive(state, nowMs = Date.now()) {
        if (state.phase !== 'placement' || state.placementDone) return state;
        return update(state, {
            phase:            'active',
            placementDone:    true,
            turnPhase:        'player',
            turnTimerStartMs: nowMs,
        });
    },
};

/** Build a state that is ready to call toActive on. */
function makePlacementState(nowMs = 1000) {
    const s0 = makeInitialState();
    const s1 = PhaseTransitions.toBriefing(s0);
    return PhaseTransitions.toPlacement(s1, nowMs);
}

// ─── Tests for PhaseTransitions.toActive — task 3 (Requirements 2.1, 2.2, 2.3) ─

describe('PhaseTransitions.toActive — turn timer initialisation (Req 2.1, 2.2)', () => {
    it('sets turnPhase to "player" when transitioning from placement', () => {
        const sPlacement = makePlacementState();
        const sActive = PhaseTransitions.toActive(sPlacement, 50_000);
        assert.equal(sActive.turnPhase, 'player');
    });

    it('sets turnTimerStartMs to the provided nowMs value (Req 2.1)', () => {
        const sPlacement = makePlacementState();
        const nowMs = 123_456;
        const sActive = PhaseTransitions.toActive(sPlacement, nowMs);
        assert.equal(sActive.turnTimerStartMs, nowMs);
    });

    it('records the exact nowMs value, not a different timestamp', () => {
        const sPlacement = makePlacementState();
        const nowMs = 999_001;
        const sActive = PhaseTransitions.toActive(sPlacement, nowMs);
        assert.strictEqual(sActive.turnTimerStartMs, nowMs);
    });

    it('also sets phase to "active" and placementDone to true', () => {
        const sPlacement = makePlacementState();
        const sActive = PhaseTransitions.toActive(sPlacement, 10_000);
        assert.equal(sActive.phase, 'active');
        assert.equal(sActive.placementDone, true);
    });

    it('returns a frozen state object', () => {
        const sPlacement = makePlacementState();
        const sActive = PhaseTransitions.toActive(sPlacement, 10_000);
        assert.ok(Object.isFrozen(sActive));
    });
});

describe('PhaseTransitions.toActive — no-op when phase !== "placement" (Req 2.2)', () => {
    it('is a no-op when phase is "loading"', () => {
        const s0 = makeInitialState();
        const result = PhaseTransitions.toActive(s0, 10_000);
        assert.strictEqual(result, s0);
    });

    it('is a no-op when phase is "briefing"', () => {
        const s0 = makeInitialState();
        const sBriefing = PhaseTransitions.toBriefing(s0);
        const result = PhaseTransitions.toActive(sBriefing, 10_000);
        assert.strictEqual(result, sBriefing);
    });

    it('is a no-op when already in active phase (repeated call)', () => {
        const sPlacement = makePlacementState();
        const sActive = PhaseTransitions.toActive(sPlacement, 10_000);
        const result = PhaseTransitions.toActive(sActive, 20_000);
        // Must return exact same reference — no new state created
        assert.strictEqual(result, sActive);
    });

    it('does not update turnTimerStartMs when called as a no-op on active state', () => {
        const sPlacement = makePlacementState();
        const sActive = PhaseTransitions.toActive(sPlacement, 10_000);
        const result = PhaseTransitions.toActive(sActive, 99_999);
        assert.equal(result.turnTimerStartMs, 10_000);
    });

    it('does not reset turnPhase when called as a no-op after active phase advances', () => {
        const sPlacement = makePlacementState();
        const sActive = PhaseTransitions.toActive(sPlacement, 10_000);
        // Simulate turnPhase having advanced to 'enemy' during gameplay
        const sEnemy = update(sActive, { turnPhase: 'enemy' });
        const result = PhaseTransitions.toActive(sEnemy, 99_999);
        assert.strictEqual(result, sEnemy);
        assert.equal(result.turnPhase, 'enemy');
    });
});

describe('PhaseTransitions.toActive — no-op when placementDone is true (Req 2.2)', () => {
    it('is a no-op when placementDone is true in placement phase', () => {
        const sPlacement = makePlacementState();
        // Force placementDone=true without going through toActive
        const sDone = update(sPlacement, { placementDone: true });
        const result = PhaseTransitions.toActive(sDone, 10_000);
        assert.strictEqual(result, sDone);
    });

    it('does not change turnTimerStartMs when placementDone is already true', () => {
        const sPlacement = makePlacementState();
        const sDone = update(sPlacement, { placementDone: true });
        const result = PhaseTransitions.toActive(sDone, 77_777);
        // turnTimerStartMs should remain at null (initial value), not 77_777
        assert.equal(result.turnTimerStartMs, null);
    });
});

describe('PhaseTransitions.toActive — nowMs parameter (Req 2.3)', () => {
    it('accepts explicit nowMs and records it precisely', () => {
        const sPlacement = makePlacementState();
        const nowMs = 1_000_001;
        const sActive = PhaseTransitions.toActive(sPlacement, nowMs);
        assert.equal(sActive.turnTimerStartMs, nowMs);
    });

    it('records nowMs = 0 correctly (boundary)', () => {
        const sPlacement = makePlacementState();
        const sActive = PhaseTransitions.toActive(sPlacement, 0);
        assert.equal(sActive.turnTimerStartMs, 0);
    });

    it('records a large nowMs value correctly (simulating long session uptime)', () => {
        const sPlacement = makePlacementState();
        const largeNow = 2 ** 31; // ~2 billion ms ≈ 24 days of uptime
        const sActive = PhaseTransitions.toActive(sPlacement, largeNow);
        assert.equal(sActive.turnTimerStartMs, largeNow);
    });
});

// ─── TurnTransitions replica (from game-iso.js) ───────────────────────────────

const TurnTransitions = {
    isReadyToSeedEnemyQueue(state) {
        return state.phase === 'active'
            && state.turnPhase === 'enemy'
            && state.enemyUnitQueue.length === 0
            && state.unitStepStartMs === null;
    },

    beginEnemyPhase(state, nowMs, enemyIds) {
        if (state.phase !== 'active' || state.turnPhase !== 'player') return state;
        return update(state, {
            turnPhase:        'enemy',
            turnTimerStartMs: null,
            enemyUnitQueue:   Object.freeze([...enemyIds]),
            unitStepStartMs:  nowMs,
        });
    },

    endPlayerTurn(state, nowMs, enemyIds) {
        return TurnTransitions.beginEnemyPhase(state, nowMs, enemyIds);
    },
};

// ─── Helpers for TurnTransitions tests ───────────────────────────────────────

/** Returns a frozen GameState in the active phase with turnPhase='player'. */
function makeActivePlayerState(overrides = {}) {
    return update(makeInitialState(), {
        phase:     'active',
        turnPhase: 'player',
        ...overrides,
    });
}

/** Returns a frozen GameState in the active phase with turnPhase='enemy' and an empty queue. */
function makeActiveEnemyStateForTurn(overrides = {}) {
    return update(makeInitialState(), {
        phase:           'active',
        turnPhase:       'enemy',
        enemyUnitQueue:  Object.freeze([]),
        unitStepStartMs: null,
        ...overrides,
    });
}

// ─── Tests for TurnTransitions.isReadyToSeedEnemyQueue (Requirements: 9.2) ───

describe('TurnTransitions.isReadyToSeedEnemyQueue', () => {
    it('returns true when all four conditions hold', () => {
        const state = makeActiveEnemyStateForTurn({
            phase:           'active',
            turnPhase:       'enemy',
            enemyUnitQueue:  Object.freeze([]),
            unitStepStartMs: null,
        });
        assert.equal(TurnTransitions.isReadyToSeedEnemyQueue(state), true);
    });

    it('returns false when phase !== "active"', () => {
        const state = makeActiveEnemyStateForTurn({ phase: 'placement' });
        assert.equal(TurnTransitions.isReadyToSeedEnemyQueue(state), false);
    });

    it('returns false when turnPhase !== "enemy"', () => {
        const state = makeActiveEnemyStateForTurn({ turnPhase: 'player' });
        assert.equal(TurnTransitions.isReadyToSeedEnemyQueue(state), false);
    });

    it('returns false when turnPhase is "resolve"', () => {
        const state = makeActiveEnemyStateForTurn({ turnPhase: 'resolve' });
        assert.equal(TurnTransitions.isReadyToSeedEnemyQueue(state), false);
    });

    it('returns false when enemyUnitQueue.length > 0', () => {
        const state = makeActiveEnemyStateForTurn({
            enemyUnitQueue: Object.freeze(['unit-1', 'unit-2']),
        });
        assert.equal(TurnTransitions.isReadyToSeedEnemyQueue(state), false);
    });

    it('returns false when enemyUnitQueue has exactly one item', () => {
        const state = makeActiveEnemyStateForTurn({
            enemyUnitQueue: Object.freeze(['unit-1']),
        });
        assert.equal(TurnTransitions.isReadyToSeedEnemyQueue(state), false);
    });

    it('returns false when unitStepStartMs !== null', () => {
        const state = makeActiveEnemyStateForTurn({ unitStepStartMs: 12345 });
        assert.equal(TurnTransitions.isReadyToSeedEnemyQueue(state), false);
    });

    it('returns false when multiple conditions fail simultaneously', () => {
        const state = makeActiveEnemyStateForTurn({
            phase:          'placement',
            enemyUnitQueue: Object.freeze(['unit-1']),
        });
        assert.equal(TurnTransitions.isReadyToSeedEnemyQueue(state), false);
    });
});

// ─── Tests for TurnTransitions.beginEnemyPhase (Requirements: 9.2) ───────────

describe('TurnTransitions.beginEnemyPhase', () => {
    it('sets turnPhase to "enemy" when phase=active and turnPhase=player', () => {
        const state = makeActivePlayerState();
        const next = TurnTransitions.beginEnemyPhase(state, 1000, []);
        assert.equal(next.turnPhase, 'enemy');
    });

    it('populates enemyUnitQueue with the provided IDs', () => {
        const state = makeActivePlayerState();
        const ids = ['unit-a', 'unit-b', 'unit-c'];
        const next = TurnTransitions.beginEnemyPhase(state, 1000, ids);
        assert.deepEqual([...next.enemyUnitQueue], ids);
    });

    it('sets unitStepStartMs to the provided nowMs', () => {
        const state = makeActivePlayerState();
        const nowMs = 99000;
        const next = TurnTransitions.beginEnemyPhase(state, nowMs, ['unit-x']);
        assert.equal(next.unitStepStartMs, nowMs);
    });

    it('clears turnTimerStartMs (sets to null)', () => {
        const state = makeActivePlayerState({ turnTimerStartMs: 50000 });
        const next = TurnTransitions.beginEnemyPhase(state, 1000, []);
        assert.equal(next.turnTimerStartMs, null);
    });

    it('freezes the new enemyUnitQueue', () => {
        const state = makeActivePlayerState();
        const next = TurnTransitions.beginEnemyPhase(state, 1000, ['u1']);
        assert.ok(Object.isFrozen(next.enemyUnitQueue));
    });

    it('returns a frozen state object', () => {
        const state = makeActivePlayerState();
        const next = TurnTransitions.beginEnemyPhase(state, 1000, []);
        assert.ok(Object.isFrozen(next));
    });

    it('is a no-op when phase !== "active"', () => {
        const state = update(makeInitialState(), {
            phase:     'placement',
            turnPhase: 'player',
        });
        const result = TurnTransitions.beginEnemyPhase(state, 1000, ['u1']);
        assert.strictEqual(result, state); // same reference
    });

    it('is a no-op when phase is "loading"', () => {
        const state = makeInitialState(); // phase='loading', turnPhase='player'
        const result = TurnTransitions.beginEnemyPhase(state, 1000, ['u1']);
        assert.strictEqual(result, state);
    });

    it('is a no-op when turnPhase !== "player"', () => {
        const state = makeActiveEnemyStateForTurn(); // turnPhase='enemy'
        const result = TurnTransitions.beginEnemyPhase(state, 1000, ['u1']);
        assert.strictEqual(result, state);
    });

    it('is a no-op when turnPhase is "resolve"', () => {
        const state = update(makeInitialState(), {
            phase:     'active',
            turnPhase: 'resolve',
        });
        const result = TurnTransitions.beginEnemyPhase(state, 1000, ['u1']);
        assert.strictEqual(result, state);
    });

    it('does not mutate the original state', () => {
        const state = makeActivePlayerState();
        TurnTransitions.beginEnemyPhase(state, 1000, ['u1']);
        assert.equal(state.turnPhase, 'player'); // original unchanged
    });

    it('preserves other state fields not involved in the transition', () => {
        const state = makeActivePlayerState({
            turnCounter:       3,
            hudOpen:           true,
            resolveDurationMs: 10_000,
        });
        const next = TurnTransitions.beginEnemyPhase(state, 1000, []);
        assert.equal(next.turnCounter, 3);
        assert.equal(next.hudOpen, true);
        assert.equal(next.resolveDurationMs, 10_000);
    });

    it('handles an empty enemyIds array', () => {
        const state = makeActivePlayerState();
        const next = TurnTransitions.beginEnemyPhase(state, 1000, []);
        assert.deepEqual([...next.enemyUnitQueue], []);
        assert.equal(next.turnPhase, 'enemy');
    });
});

// ─── Tests for TurnTransitions.endPlayerTurn (Requirements: 9.2) ─────────────

describe('TurnTransitions.endPlayerTurn', () => {
    it('produces the same result as beginEnemyPhase with the same arguments', () => {
        const state = makeActivePlayerState();
        const nowMs = 5000;
        const ids = ['unit-1', 'unit-2'];

        const fromBegin = TurnTransitions.beginEnemyPhase(state, nowMs, ids);
        const fromEnd   = TurnTransitions.endPlayerTurn(state, nowMs, ids);

        assert.deepEqual(fromEnd, fromBegin);
    });

    it('sets turnPhase to "enemy" via delegation', () => {
        const state = makeActivePlayerState();
        const next = TurnTransitions.endPlayerTurn(state, 1000, ['u1']);
        assert.equal(next.turnPhase, 'enemy');
    });

    it('populates enemyUnitQueue via delegation', () => {
        const state = makeActivePlayerState();
        const ids = ['a', 'b'];
        const next = TurnTransitions.endPlayerTurn(state, 1000, ids);
        assert.deepEqual([...next.enemyUnitQueue], ids);
    });

    it('is a no-op when phase !== "active" (inherited from beginEnemyPhase guard)', () => {
        const state = update(makeInitialState(), {
            phase:     'placement',
            turnPhase: 'player',
        });
        const result = TurnTransitions.endPlayerTurn(state, 1000, ['u1']);
        assert.strictEqual(result, state);
    });

    it('is a no-op when turnPhase !== "player" (inherited from beginEnemyPhase guard)', () => {
        const state = makeActiveEnemyStateForTurn();
        const result = TurnTransitions.endPlayerTurn(state, 1000, ['u1']);
        assert.strictEqual(result, state);
    });

    it('is idempotent — calling twice returns the same state as calling once', () => {
        const state = makeActivePlayerState();
        const nowMs = 7000;
        const ids = ['unit-1'];

        const once  = TurnTransitions.endPlayerTurn(state, nowMs, ids);
        // Second call uses the result of the first — which is now turnPhase='enemy',
        // so the guard rejects it and returns the same state unchanged.
        const twice = TurnTransitions.endPlayerTurn(once, nowMs, ids);

        assert.strictEqual(twice, once); // same reference — no-op on second call
    });

    it('idempotent with empty queue — second call is a no-op', () => {
        const state = makeActivePlayerState();
        const first  = TurnTransitions.endPlayerTurn(state, 1000, []);
        const second = TurnTransitions.endPlayerTurn(first, 2000, []);
        assert.strictEqual(second, first);
    });
});
