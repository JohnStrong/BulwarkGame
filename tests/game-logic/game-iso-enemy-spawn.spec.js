/**
 * Tests for enemy wave spawn logic in game-iso.js.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game-iso-enemy-spawn.spec.js
 *
 * What is tested
 * ──────────────
 * The spawn mechanism is driven by Game._waveSpawned — a plain boolean on the
 * Game object, NOT part of GameState. It is set to false by _setupLevel() and
 * flipped to true the first time the active-phase block in loop() fires.
 *
 * This is tested in pure Node (no DOM, no canvas, no requestAnimationFrame) by:
 *   1. Replicating the primitives (update, makeInitialState, PhaseTransitions,
 *      TickTransitions) exactly as they appear in game-iso.js.
 *   2. Building a minimal Game-like object that holds _state and _waveSpawned,
 *      with a simulateLoop() method that runs the same spawn logic as loop().
 *   3. Injecting a stub EnemyManager so we can count spawnWave calls without
 *      touching the real AI system.
 *
 * Root cause regression
 * ─────────────────────
 * The original bug: loop() called TickTransitions.tick() BEFORE the spawn
 * check, so _advanceTurnCounter bumped turnCounter from 0 → 1 before the
 * `turnCounter === 0` guard was evaluated — spawn never fired.
 *
 * The fix: use _waveSpawned (not turnCounter) so the spawn fires exactly once
 * on the first active frame regardless of what turnCounter is.
 *
 * These tests verify both the correct behaviour AND the failure scenario
 * (turnCounter-based guard) to prevent regression.
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Replicated primitives (DOM-free, identical to game-iso.js) ──────────────

function update(state, patch) {
    return Object.freeze(Object.assign({}, state, patch));
}

function makeInitialState() {
    return Object.freeze({
        phase:             'loading',
        placementStartMs:  null,
        placementDone:     false,
        briefingOpen:      false,
        unitDefs:          Object.freeze([]),
        placedUnits:       Object.freeze([]),
        hoveredTile:       null,
        selectedTile:      null,
        selectedLift:      0,
        selectedLiftTarget: 0,
        selectedUnitIdx:   -1,
        hudOpen:           false,
        hudWidth:          0,
        hudTargetWidth:    0,
        turnCounter:       0,
        lastBriefingRects: null,
        lastPlacementRects: null,
    });
}

const PLACEMENT_DURATION_MS = 30_000;

const PhaseTransitions = {
    toBriefing(state) {
        if (state.phase !== 'loading') return state;
        return update(state, { phase: 'briefing', briefingOpen: false });
    },
    toPlacement(state, nowMs) {
        if (state.phase !== 'briefing') return state;
        return update(state, { phase: 'placement', placementStartMs: nowMs, placementDone: false });
    },
    toActive(state) {
        if (state.phase !== 'placement' || state.placementDone) return state;
        return update(state, { phase: 'active', placementDone: true });
    },
};

const TickTransitions = {
    tick(state, deps) {
        return [
            s => TickTransitions._checkPlacementTimer(s, deps.nowMs),
            s => TickTransitions._advanceTurnCounter(s),
        ].reduce((s, fn) => fn(s), state);
    },
    _checkPlacementTimer(state, nowMs) {
        if (state.phase !== 'placement' || state.placementDone) return state;
        if (nowMs - state.placementStartMs >= PLACEMENT_DURATION_MS) {
            return PhaseTransitions.toActive(state);
        }
        return state;
    },
    _advanceTurnCounter(state) {
        if (state.phase !== 'active') return state;
        return update(state, { turnCounter: state.turnCounter + 1 });
    },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a stub EnemyManager that records calls to spawnWave and executeTurn.
 */
function makeStubEnemyManager() {
    return {
        spawnWaveCalls: [],
        executeTurnCalls: [],
        spawnWave(waveConfig, tiles) {
            this.spawnWaveCalls.push({ waveConfig, tiles });
        },
        executeTurn(turnCounter, placedUnits) {
            this.executeTurnCalls.push({ turnCounter, placedUnits });
        },
        getEnemyUnits() { return []; },
    };
}

/** Default wave config used by the production spawn call. */
const WAVE_CONFIG = {
    units: [
        { type: 'Infantry',    count: 4 },
        { type: 'Archer',      count: 2 },
        { type: 'Cavalry',     count: 1 },
        { type: 'SiegeEngine', count: 1 },
    ],
};

/** Minimal tile array — just enough for spawnWave to receive something. */
const STUB_TILES = [{ row: 0, col: 0, sprite: 'grass', char: '.' }];

/**
 * Build a minimal Game-like object that replicates the spawn logic from loop().
 *
 * simulateLoop(nowMs) runs one iteration of the spawn + executeTurn logic,
 * identical to the production loop() minus DOM/canvas concerns.
 */
function makeGameSim(stubEM) {
    return {
        _state:       null,
        _waveSpawned: false,

        setupLevel() {
            // Mirrors _setupLevel() — resets spawn flag
            this._waveSpawned = false;
        },

        /**
         * Simulate one loop() frame.
         * Mirrors the production sequence:
         *   1. tick (advances turnCounter if active)
         *   2. spawn check (_waveSpawned flag, NOT turnCounter)
         *   3. executeTurn
         */
        simulateLoop(nowMs = 0) {
            // Step 1 — tick (same as production: runs BEFORE spawn check)
            this._state = TickTransitions.tick(this._state, { nowMs });

            // Step 2 + 3 — enemy phase block
            if (this._state.phase === 'active') {
                if (!this._waveSpawned) {
                    this._waveSpawned = true;
                    stubEM.spawnWave(WAVE_CONFIG, STUB_TILES);
                }
                stubEM.executeTurn(this._state.turnCounter, this._state.placedUnits);
            }
        },

        /** Convenience: transition directly to active via full phase chain. */
        transitionToActive(nowMs = 0) {
            let s = makeInitialState();
            s = PhaseTransitions.toBriefing(s);
            s = PhaseTransitions.toPlacement(s, nowMs);
            s = PhaseTransitions.toActive(s);
            this._state = s;
        },
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('enemy wave spawn — _waveSpawned flag', () => {
    let em, game;

    beforeEach(() => {
        em   = makeStubEnemyManager();
        game = makeGameSim(em);
    });

    it('spawnWave is NOT called before active phase', () => {
        game._state = makeInitialState();
        game._state = PhaseTransitions.toBriefing(game._state);
        game.simulateLoop(0);  // briefing phase
        assert.equal(em.spawnWaveCalls.length, 0, 'no spawn during briefing');
    });

    it('spawnWave is NOT called during placement phase', () => {
        game._state = makeInitialState();
        game._state = PhaseTransitions.toBriefing(game._state);
        game._state = PhaseTransitions.toPlacement(game._state, 0);
        game.simulateLoop(1000);  // placement phase, timer not expired
        assert.equal(em.spawnWaveCalls.length, 0, 'no spawn during placement');
    });

    it('spawnWave fires on the FIRST active-phase frame', () => {
        game.transitionToActive();
        game.simulateLoop(0);
        assert.equal(em.spawnWaveCalls.length, 1, 'spawn called exactly once on first active frame');
    });

    it('spawnWave fires exactly once — not again on subsequent frames', () => {
        game.transitionToActive();
        game.simulateLoop(0);
        game.simulateLoop(16);
        game.simulateLoop(32);
        game.simulateLoop(48);
        assert.equal(em.spawnWaveCalls.length, 1, 'spawn called exactly once across multiple frames');
    });

    it('spawnWave fires even when turnCounter is already > 0 on first active frame', () => {
        // This is the original regression: tick() increments turnCounter BEFORE
        // the spawn check. Verify the _waveSpawned flag handles this correctly.
        game.transitionToActive();
        // Manually set turnCounter to a high value to simulate the original bug scenario
        game._state = update(game._state, { turnCounter: 42 });
        game.simulateLoop(0);
        assert.equal(
            em.spawnWaveCalls.length, 1,
            'spawn fires regardless of turnCounter value — flag is independent of counter'
        );
    });

    it('after simulateLoop, _waveSpawned is true', () => {
        game.transitionToActive();
        game.simulateLoop(0);
        assert.equal(game._waveSpawned, true);
    });

    it('setupLevel() resets _waveSpawned to false', () => {
        game.transitionToActive();
        game.simulateLoop(0);
        assert.equal(game._waveSpawned, true);

        // Level restart
        game.setupLevel();
        assert.equal(game._waveSpawned, false, '_waveSpawned reset to false by setupLevel');
    });

    it('after level restart, spawnWave fires again on the next active frame', () => {
        game.transitionToActive();
        game.simulateLoop(0);
        assert.equal(em.spawnWaveCalls.length, 1);

        // Restart level and enter active again
        game.setupLevel();
        game.transitionToActive();
        game.simulateLoop(0);
        assert.equal(em.spawnWaveCalls.length, 2, 'spawn fires again after level restart');
    });
});

describe('enemy wave spawn — wave config and tiles passed to spawnWave', () => {
    let em, game;

    beforeEach(() => {
        em   = makeStubEnemyManager();
        game = makeGameSim(em);
        game.transitionToActive();
        game.simulateLoop(0);
    });

    it('spawnWave receives a waveConfig with a units array', () => {
        const { waveConfig } = em.spawnWaveCalls[0];
        assert.ok(Array.isArray(waveConfig.units), 'waveConfig.units is an array');
    });

    it('wave includes Infantry units', () => {
        const { waveConfig } = em.spawnWaveCalls[0];
        const infantry = waveConfig.units.find(u => u.type === 'Infantry');
        assert.ok(infantry, 'Infantry present in wave config');
        assert.ok(infantry.count > 0, 'Infantry count is positive');
    });

    it('wave includes Archer units', () => {
        const { waveConfig } = em.spawnWaveCalls[0];
        assert.ok(waveConfig.units.find(u => u.type === 'Archer'), 'Archer present');
    });

    it('wave includes Cavalry units', () => {
        const { waveConfig } = em.spawnWaveCalls[0];
        assert.ok(waveConfig.units.find(u => u.type === 'Cavalry'), 'Cavalry present');
    });

    it('wave includes SiegeEngine units', () => {
        const { waveConfig } = em.spawnWaveCalls[0];
        assert.ok(waveConfig.units.find(u => u.type === 'SiegeEngine'), 'SiegeEngine present');
    });

    it('spawnWave receives a tiles argument', () => {
        const { tiles } = em.spawnWaveCalls[0];
        assert.ok(tiles !== undefined && tiles !== null, 'tiles argument passed to spawnWave');
    });
});

describe('enemy wave spawn — executeTurn gating', () => {
    let em, game;

    beforeEach(() => {
        em   = makeStubEnemyManager();
        game = makeGameSim(em);
    });

    it('executeTurn is NOT called during briefing phase', () => {
        game._state = makeInitialState();
        game._state = PhaseTransitions.toBriefing(game._state);
        game.simulateLoop(0);
        assert.equal(em.executeTurnCalls.length, 0);
    });

    it('executeTurn is NOT called during placement phase', () => {
        game._state = makeInitialState();
        game._state = PhaseTransitions.toBriefing(game._state);
        game._state = PhaseTransitions.toPlacement(game._state, 0);
        game.simulateLoop(1000);
        assert.equal(em.executeTurnCalls.length, 0);
    });

    it('executeTurn IS called on first active frame (same frame as spawn)', () => {
        game.transitionToActive();
        game.simulateLoop(0);
        assert.equal(em.executeTurnCalls.length, 1);
    });

    it('executeTurn is called every active frame', () => {
        game.transitionToActive();
        game.simulateLoop(0);
        game.simulateLoop(16);
        game.simulateLoop(32);
        assert.equal(em.executeTurnCalls.length, 3, 'executeTurn called once per active frame');
    });

    it('executeTurn receives an incrementing turnCounter', () => {
        game.transitionToActive();
        game.simulateLoop(0);   // tick → turnCounter becomes 1, executeTurn(1)
        game.simulateLoop(16);  // tick → turnCounter becomes 2, executeTurn(2)
        game.simulateLoop(32);  // tick → turnCounter becomes 3, executeTurn(3)

        const counters = em.executeTurnCalls.map(c => c.turnCounter);
        assert.deepEqual(counters, [1, 2, 3], 'turnCounter increments each frame via tick()');
    });

    it('executeTurn receives placedUnits from state', () => {
        game.transitionToActive();
        game.simulateLoop(0);
        const { placedUnits } = em.executeTurnCalls[0];
        assert.ok(Array.isArray(placedUnits), 'placedUnits is an array');
    });
});

describe('enemy wave spawn — turnCounter ordering regression', () => {
    it('tick() runs BEFORE the spawn check — turnCounter is 1 on first active frame', () => {
        // This documents the ordering that caused the original bug.
        // tick() increments turnCounter from 0 to 1 before the spawn check runs.
        // The _waveSpawned flag is immune to this; a turnCounter===0 check would not be.
        const em   = makeStubEnemyManager();
        const game = makeGameSim(em);

        game.transitionToActive();
        // At this point turnCounter === 0
        assert.equal(game._state.turnCounter, 0, 'turnCounter starts at 0');

        game.simulateLoop(0);
        // After one loop: tick ran first → turnCounter === 1
        assert.equal(game._state.turnCounter, 1, 'tick() incremented turnCounter to 1 before spawn check');

        // But spawn still fired because we use _waveSpawned, not turnCounter
        assert.equal(em.spawnWaveCalls.length, 1, 'spawn fired despite turnCounter being 1');
    });

    it('a turnCounter===0 guard would have FAILED — regression proof', () => {
        // Simulate the old broken guard to prove it would miss the spawn.
        const em   = makeStubEnemyManager();
        const game = makeGameSim(em);
        game.transitionToActive();

        // Simulate the OLD broken loop logic using turnCounter===0
        game._state = TickTransitions.tick(game._state, { nowMs: 0 }); // tick runs first
        if (game._state.phase === 'active' && game._state.turnCounter === 0) {
            em.spawnWave(WAVE_CONFIG, STUB_TILES); // this line never executes
        }

        assert.equal(
            em.spawnWaveCalls.length, 0,
            'turnCounter===0 guard fails because tick already incremented it to 1'
        );
    });
});
