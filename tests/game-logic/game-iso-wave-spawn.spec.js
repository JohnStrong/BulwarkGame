/**
 * Tests for the _waveSpawned one-shot flag introduced in game-iso.js.
 *
 * The flag ensures EnemyManager.spawnWave() is called exactly once on the
 * first update() tick, no matter how many update() calls follow. A page
 * reload resets the flag via init() (tested here by resetting directly).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game-iso-wave-spawn.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Minimal Game replica ────────────────────────────────────────────────────
// Mirrors only the update() logic relevant to _waveSpawned and _turnCounter.

function createGame({ enemyManager, levelLoader } = {}) {
    const defaultTiles = [
        { row: 0, col: 0, sprite: 'grass-short-1' },
        { row: 5, col: 5, sprite: 'castle-keep-center' },
    ];

    const defaultEnemyManager = {
        spawnWaveCalls: [],
        executeTurnCalls: [],
        spawnWave(waveDef, tiles) {
            this.spawnWaveCalls.push({ waveDef, tiles });
        },
        executeTurn(counter) {
            this.executeTurnCalls.push(counter);
        },
        getEnemyUnits() { return []; },
        reset() {},
        init() {},
    };

    const em = enemyManager || defaultEnemyManager;
    const ll = levelLoader || { getCurrentLevel() { return { tiles: defaultTiles }; } };

    const game = {
        _waveSpawned: false,
        _turnCounter: 0,

        // Injected deps
        _enemyManager: em,
        _levelLoader: ll,

        update() {
            // Mirrors the Enemy Phase block from game-iso.js update()
            if (!this._waveSpawned) {
                this._waveSpawned = true;
                try {
                    const level = this._levelLoader.getCurrentLevel();
                    this._enemyManager.spawnWave({
                        units: [
                            { type: 'Infantry',    count: 4 },
                            { type: 'Archer',      count: 2 },
                            { type: 'Cavalry',     count: 1 },
                            { type: 'SiegeEngine', count: 1 },
                        ],
                    }, level.tiles);
                } catch (e) {
                    // swallowed — mirrors game-iso.js behaviour
                }
            }
            try {
                this._enemyManager.executeTurn(this._turnCounter);
            } catch (e) {
                // swallowed — mirrors game-iso.js behaviour
            }
            this._turnCounter++;
        },
    };

    return { game, em };
}

// ─── _waveSpawned initial state ───────────────────────────────────────────────

describe('Game._waveSpawned - initial state', () => {
    it('should be false before any update() call', () => {
        const { game } = createGame();
        assert.equal(game._waveSpawned, false);
    });

    it('_turnCounter should be 0 before any update() call', () => {
        const { game } = createGame();
        assert.equal(game._turnCounter, 0);
    });
});

// ─── First update() — wave spawning ──────────────────────────────────────────

describe('Game.update() - first call spawns wave', () => {
    it('should set _waveSpawned to true after first update()', () => {
        const { game } = createGame();
        game.update();
        assert.equal(game._waveSpawned, true);
    });

    it('should call spawnWave exactly once on the first update()', () => {
        const { game, em } = createGame();
        game.update();
        assert.equal(em.spawnWaveCalls.length, 1);
    });

    it('should pass correct unit composition to spawnWave', () => {
        const { game, em } = createGame();
        game.update();
        const waveDef = em.spawnWaveCalls[0].waveDef;
        assert.equal(waveDef.units.length, 4);
        assert.deepEqual(waveDef.units[0], { type: 'Infantry',    count: 4 });
        assert.deepEqual(waveDef.units[1], { type: 'Archer',      count: 2 });
        assert.deepEqual(waveDef.units[2], { type: 'Cavalry',     count: 1 });
        assert.deepEqual(waveDef.units[3], { type: 'SiegeEngine', count: 1 });
    });

    it('should pass current level tiles to spawnWave', () => {
        const customTiles = [{ row: 1, col: 2, sprite: 'road-full' }];
        const { game, em } = createGame({
            levelLoader: { getCurrentLevel() { return { tiles: customTiles }; } },
        });
        game.update();
        assert.equal(em.spawnWaveCalls[0].tiles, customTiles);
    });

    it('should increment _turnCounter after first update()', () => {
        const { game } = createGame();
        game.update();
        assert.equal(game._turnCounter, 1);
    });

    it('should call executeTurn(0) on the first update()', () => {
        const { game, em } = createGame();
        game.update();
        assert.equal(em.executeTurnCalls.length, 1);
        assert.equal(em.executeTurnCalls[0], 0);
    });
});

// ─── Subsequent update() calls — no re-spawn ─────────────────────────────────

describe('Game.update() - subsequent calls do NOT re-spawn', () => {
    it('should NOT call spawnWave on the second update()', () => {
        const { game, em } = createGame();
        game.update(); // first — spawns
        game.update(); // second — must not spawn again
        assert.equal(em.spawnWaveCalls.length, 1);
    });

    it('should NOT call spawnWave after many update() calls', () => {
        const { game, em } = createGame();
        for (let i = 0; i < 100; i++) game.update();
        assert.equal(em.spawnWaveCalls.length, 1);
    });

    it('should keep _waveSpawned true across multiple updates', () => {
        const { game } = createGame();
        for (let i = 0; i < 10; i++) game.update();
        assert.equal(game._waveSpawned, true);
    });

    it('should increment _turnCounter once per update()', () => {
        const { game } = createGame();
        for (let i = 0; i < 5; i++) game.update();
        assert.equal(game._turnCounter, 5);
    });

    it('should call executeTurn with increasing counter values', () => {
        const { game, em } = createGame();
        for (let i = 0; i < 4; i++) game.update();
        assert.deepEqual(em.executeTurnCalls, [0, 1, 2, 3]);
    });
});

// ─── Page reload (flag reset) ─────────────────────────────────────────────────

describe('Game._waveSpawned - reset simulates page reload', () => {
    it('should re-spawn wave after flag is reset to false', () => {
        const { game, em } = createGame();
        game.update();                     // first run: spawns once
        assert.equal(em.spawnWaveCalls.length, 1);

        game._waveSpawned = false;         // simulate page reload / init()
        game._turnCounter = 0;
        game.update();                     // second run after reset: spawns again
        assert.equal(em.spawnWaveCalls.length, 2);
    });

    it('should start turn counter from 0 again after reset', () => {
        const { game, em } = createGame();
        for (let i = 0; i < 3; i++) game.update();
        assert.equal(game._turnCounter, 3);

        game._waveSpawned = false;
        game._turnCounter = 0;
        game.update();
        assert.equal(game._turnCounter, 1);
        assert.equal(em.executeTurnCalls[em.executeTurnCalls.length - 1], 0);
    });
});

// ─── Error resilience ─────────────────────────────────────────────────────────

describe('Game.update() - graceful error handling', () => {
    it('should set _waveSpawned even when spawnWave throws', () => {
        const throwingEm = {
            spawnWaveCalls: [],
            executeTurnCalls: [],
            spawnWave() { throw new Error('spawnWave failed'); },
            executeTurn(n) { this.executeTurnCalls.push(n); },
        };
        const { game } = createGame({ enemyManager: throwingEm });

        assert.doesNotThrow(() => game.update());
        assert.equal(game._waveSpawned, true);
    });

    it('should NOT call spawnWave again on next tick after a throwing spawnWave', () => {
        let calls = 0;
        const throwingEm = {
            spawnWave() { calls++; throw new Error('fail'); },
            executeTurn() {},
        };
        const { game } = createGame({ enemyManager: throwingEm });

        game.update();
        game.update();
        game.update();
        assert.equal(calls, 1); // still only called once
    });

    it('should still increment _turnCounter when spawnWave throws', () => {
        const throwingEm = {
            spawnWave() { throw new Error('fail'); },
            executeTurn() {},
        };
        const { game } = createGame({ enemyManager: throwingEm });
        game.update();
        assert.equal(game._turnCounter, 1);
    });

    it('should not throw when executeTurn throws', () => {
        const throwingEm = {
            spawnWaveCalls: [],
            spawnWave(w, t) { this.spawnWaveCalls.push(w); },
            executeTurn() { throw new Error('executeTurn failed'); },
        };
        const { game } = createGame({ enemyManager: throwingEm });

        assert.doesNotThrow(() => game.update());
    });

    it('should still increment _turnCounter when executeTurn throws', () => {
        const throwingEm = {
            spawnWave() {},
            executeTurn() { throw new Error('fail'); },
        };
        const { game } = createGame({ enemyManager: throwingEm });
        game.update();
        assert.equal(game._turnCounter, 1);
    });

    it('should not throw when levelLoader.getCurrentLevel returns no tiles', () => {
        const { game } = createGame({
            levelLoader: { getCurrentLevel() { return { tiles: [] }; } },
        });
        assert.doesNotThrow(() => game.update());
    });
});

// ─── _waveSpawned is independent of _turnCounter ─────────────────────────────

describe('Game._waveSpawned - independence from _turnCounter', () => {
    it('should still not re-spawn even if _turnCounter is reset without resetting flag', () => {
        const { game, em } = createGame();
        game.update();
        assert.equal(em.spawnWaveCalls.length, 1);

        game._turnCounter = 0; // reset turn counter only — NOT the flag
        game.update();
        // Flag is still true, so no second spawn
        assert.equal(em.spawnWaveCalls.length, 1);
    });

    it('_turnCounter at time of first executeTurn is always 0 on a fresh game', () => {
        const { game, em } = createGame();
        game.update();
        assert.equal(em.executeTurnCalls[0], 0);
    });
});
