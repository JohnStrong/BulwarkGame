// Feature: player-turn-timer
/**
 * Property tests for player-turn-timer transitions.
 *
 * Tests four invariants across the full numeric range using fast-check:
 *   - Property 1: Player timer expiry (Req 10.5)
 *   - Property 2: Player timer continuity (Req 10.6)
 *   - Property 3: Resolve expiry (Req 10.7)
 *   - Property 4: Enemy queue drain (Req 10.8)
 *
 * All transitions are pure GameState → GameState functions. No DOM or canvas
 * required — these are self-contained replicas extracted from game-iso.js.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

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
 * Replica of TickTransitions._checkTurnTimer from game-iso.js.
 *
 * Guards: no-op unless phase==='active' && turnPhase==='player'.
 * Arms the timer when turnTimerStartMs is null.
 * Transitions to 'enemy' when elapsed >= turnDurationMs.
 */
function _checkTurnTimer(state, nowMs) {
    if (state.phase !== 'active' || state.turnPhase !== 'player') return state;
    if (state.turnTimerStartMs === null) {
        return update(state, { turnTimerStartMs: nowMs });
    }
    const elapsed = nowMs - state.turnTimerStartMs;
    if (elapsed < state.turnDurationMs) return state;
    return update(state, { turnPhase: 'enemy', turnTimerStartMs: null });
}

/**
 * Replica of TickTransitions._checkResolveTimer from game-iso.js.
 *
 * Guards: no-op unless phase==='active' && turnPhase==='resolve'.
 * Arms the timer when resolveTimerStartMs is null.
 * Transitions to 'player' and increments turnCounter when elapsed >= resolveDurationMs.
 */
function _checkResolveTimer(state, nowMs) {
    if (state.phase !== 'active' || state.turnPhase !== 'resolve') return state;
    if (state.resolveTimerStartMs === null) {
        return update(state, { resolveTimerStartMs: nowMs });
    }
    const elapsed = nowMs - state.resolveTimerStartMs;
    if (elapsed < state.resolveDurationMs) return state;
    return update(state, {
        turnPhase:           'player',
        turnTimerStartMs:    nowMs,
        resolveTimerStartMs: null,
        turnCounter:         state.turnCounter + 1,
    });
}

/**
 * Replica of TickTransitions._checkEnemyStep from game-iso.js.
 *
 * Guards: no-op unless phase==='active' && turnPhase==='enemy'.
 * Arms the step timer when unitStepStartMs is null.
 * When queue is empty, transitions to 'resolve'.
 * When elapsed >= unitStepIntervalMs, dequeues one unit.
 */
function _checkEnemyStep(state, nowMs) {
    if (state.phase !== 'active' || state.turnPhase !== 'enemy') return state;
    if (state.enemyUnitQueue.length === 0) {
        return update(state, {
            turnPhase:           'resolve',
            resolveTimerStartMs: nowMs,
            unitStepStartMs:     null,
        });
    }
    if (state.unitStepStartMs === null) {
        return update(state, { unitStepStartMs: nowMs });
    }
    const elapsed = nowMs - state.unitStepStartMs;
    if (elapsed < state.unitStepIntervalMs) return state;
    const [movedId, ...remaining] = state.enemyUnitQueue;
    return update(state, {
        enemyUnitQueue:  Object.freeze(remaining),
        unitStepStartMs: nowMs,
        pendingMoveId:   movedId,
    });
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * A timestamp in a realistic game session range: 0..2^31 ms (~24 days uptime).
 */
const timestampArb = fc.integer({ min: 0, max: 2 ** 31 });

/**
 * A non-negative extra offset (elapsed past the deadline).
 * Range: 0..2^30 to stay within safe integer territory when added to a timestamp.
 */
const extraArb = fc.integer({ min: 0, max: 2 ** 30 });

/**
 * A positive deficit (time remaining before deadline). Bounded by turnDurationMs
 * so that nowMs = startMs + duration - deficit always stays >= startMs.
 */
const deficitArb = fc.integer({ min: 1, max: 45_000 });

/**
 * Generate a list of 0–10 non-empty string unit IDs.
 */
const unitIdsArb = fc.array(
    fc.string({ minLength: 1, maxLength: 12 }),
    { minLength: 0, maxLength: 10 }
);

// ─── Property 1: Player timer expiry invariant ────────────────────────────────

/**
 * **Property 1: Player timer expiry invariant**
 *
 * For any `turnTimerStartMs` and `nowMs >= turnTimerStartMs + turnDurationMs`,
 * `_checkTurnTimer` SHALL produce `turnPhase === 'enemy'`.
 *
 * **Validates: Requirements 10.5**
 */
describe('Property 1: Player timer expiry invariant (Req 10.5)', () => {
    it('turnPhase becomes "enemy" whenever nowMs >= startMs + turnDurationMs', () => {
        fc.assert(
            fc.property(timestampArb, extraArb, (startMs, extra) => {
                const state = update(makeInitialState(), {
                    phase:            'active',
                    turnPhase:        'player',
                    turnTimerStartMs: startMs,
                    turnDurationMs:   45_000,
                });

                // nowMs is at or past the deadline
                const nowMs = startMs + 45_000 + extra;
                const result = _checkTurnTimer(state, nowMs);

                assert.strictEqual(
                    result.turnPhase,
                    'enemy',
                    `Expected turnPhase 'enemy' when elapsed=${nowMs - startMs} >= duration=45000`
                );
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 2: Player timer continuity invariant ───────────────────────────

/**
 * **Property 2: Player timer continuity invariant**
 *
 * For any `nowMs < turnTimerStartMs + turnDurationMs`, `_checkTurnTimer` SHALL
 * leave `turnPhase === 'player'` and `turnTimerStartMs` unchanged.
 *
 * **Validates: Requirements 10.6**
 */
describe('Property 2: Player timer continuity invariant (Req 10.6)', () => {
    it('turnPhase stays "player" and turnTimerStartMs unchanged when nowMs < deadline', () => {
        fc.assert(
            fc.property(timestampArb, deficitArb, (startMs, deficit) => {
                const state = update(makeInitialState(), {
                    phase:            'active',
                    turnPhase:        'player',
                    turnTimerStartMs: startMs,
                    turnDurationMs:   45_000,
                });

                // nowMs is strictly before the deadline
                const nowMs = startMs + 45_000 - deficit;

                // Ensure nowMs is non-negative (could underflow if startMs is very small)
                fc.pre(nowMs >= 0);

                const result = _checkTurnTimer(state, nowMs);

                assert.strictEqual(
                    result.turnPhase,
                    'player',
                    `Expected turnPhase 'player' when elapsed=${nowMs - startMs} < duration=45000`
                );
                assert.strictEqual(
                    result.turnTimerStartMs,
                    startMs,
                    'turnTimerStartMs must remain unchanged when timer has not expired'
                );
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 3: Resolve expiry invariant ────────────────────────────────────

/**
 * **Property 3: Resolve expiry invariant**
 *
 * For any `resolveTimerStartMs` and `nowMs >= resolveTimerStartMs + resolveDurationMs`,
 * `_checkResolveTimer` SHALL produce `turnPhase === 'player'`.
 *
 * **Validates: Requirements 10.7**
 */
describe('Property 3: Resolve expiry invariant (Req 10.7)', () => {
    it('turnPhase becomes "player" whenever nowMs >= resolveStart + resolveDurationMs', () => {
        fc.assert(
            fc.property(timestampArb, extraArb, (resolveStart, extra) => {
                const state = update(makeInitialState(), {
                    phase:               'active',
                    turnPhase:           'resolve',
                    resolveTimerStartMs: resolveStart,
                    resolveDurationMs:   10_000,
                });

                // nowMs is at or past the resolve deadline
                const nowMs = resolveStart + 10_000 + extra;
                const result = _checkResolveTimer(state, nowMs);

                assert.strictEqual(
                    result.turnPhase,
                    'player',
                    `Expected turnPhase 'player' when resolveElapsed=${nowMs - resolveStart} >= resolveDurationMs=10000`
                );
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 4: Enemy queue drain invariant ─────────────────────────────────

/**
 * **Property 4: Enemy queue drain invariant**
 *
 * After N `_checkEnemyStep` calls each with `elapsed >= unitStepIntervalMs`,
 * `enemyUnitQueue.length` SHALL have decreased by N (or reached 0, whichever
 * comes first).
 *
 * **Validates: Requirements 10.8**
 */
describe('Property 4: Enemy queue drain invariant (Req 10.8)', () => {
    it('queue shrinks by N after N steps each with elapsed >= unitStepIntervalMs', () => {
        fc.assert(
            fc.property(
                unitIdsArb,
                fc.integer({ min: 1, max: 10 }),
                (unitIds, stepCount) => {
                    // Only run when there is at least one unit to drain
                    fc.pre(unitIds.length > 0);

                    const interval = 1_000;
                    let state = update(makeInitialState(), {
                        phase:              'active',
                        turnPhase:          'enemy',
                        enemyUnitQueue:     Object.freeze([...unitIds]),
                        unitStepStartMs:    0,
                        unitStepIntervalMs: interval,
                    });

                    const initialLength = state.enemyUnitQueue.length;
                    let actualSteps = 0;

                    for (let i = 0; i < stepCount; i++) {
                        if (state.turnPhase !== 'enemy') break;
                        if (state.enemyUnitQueue.length === 0) break;

                        // Advance clock past the step interval
                        const nowMs = (state.unitStepStartMs ?? 0) + interval;
                        const before = state.enemyUnitQueue.length;
                        state = _checkEnemyStep(state, nowMs);
                        // Clear the pending move so the next call isn't confused
                        if (state.pendingMoveId !== null) {
                            state = update(state, { pendingMoveId: null });
                        }
                        const after = state.enemyUnitQueue.length;

                        // Each step must drain exactly one entry
                        if (after < before) {
                            actualSteps++;
                        }
                    }

                    const expectedSteps = Math.min(stepCount, initialLength);
                    const expectedFinalLength = initialLength - expectedSteps;

                    // The queue must have shrunk by the expected amount
                    const finalLength = state.turnPhase === 'resolve'
                        ? 0
                        : state.enemyUnitQueue.length;

                    assert.strictEqual(
                        actualSteps,
                        expectedSteps,
                        `Expected ${expectedSteps} dequeue steps for queue of ${initialLength} with ${stepCount} calls, got ${actualSteps}`
                    );

                    assert.ok(
                        finalLength === expectedFinalLength ||
                        (state.turnPhase === 'resolve' && initialLength <= stepCount),
                        `Expected queue length ${expectedFinalLength} (or 0 in resolve), got ${finalLength} (turnPhase=${state.turnPhase})`
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});
