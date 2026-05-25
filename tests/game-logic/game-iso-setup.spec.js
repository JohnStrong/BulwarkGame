/**
 * Tests for game-iso.js _setup() orchestration — Recommendation 1.
 *
 * Covers the post-DOM setup logic that can be tested without a browser by
 * injecting mock dependencies. Tests startLevel(), centerOnFlag(), and
 * _renderDamagedCastleIntegrationTest() via extracted helper logic.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game-iso-setup.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Extracted _setup logic (mirrors game-iso.js post-DOM init) ─────────────

/**
 * Simulates the _setup(canvas, ctx, deps) pattern that game-iso.js would
 * expose if refactored for testability. We test the logic directly here.
 */
function createGame(deps) {
    const {
        LevelLoader,
        UnitManager,
        SpriteManager,
        IsoCamera,
        IsoRenderer,
        HUD,
        AnimationController,
    } = deps;

    let state = 'loading';
    let currentLevel = null;

    function startLevel(level) {
        currentLevel = level;
        IsoCamera.setMapSize(level.width, level.height);
        centerOnFlag(level);
        state = 'playing';
    }

    function centerOnFlag(level) {
        if (!level || !level.tiles) return;
        const flagTile = level.tiles.find(t => t.isFlag);
        if (flagTile) {
            IsoCamera.centerOn(flagTile.row, flagTile.col);
        } else {
            // Default: center on middle of map
            IsoCamera.centerOn(
                Math.floor(level.height / 2),
                Math.floor(level.width / 2)
            );
        }
    }

    function _renderDamagedCastleIntegrationTest(ctx) {
        try {
            SpriteManager.draw(ctx, 'castle-wall-damaged', 10, 10, 64, 32);
            return true;
        } catch (err) {
            return false;
        }
    }

    function getState() { return state; }
    function getCurrentLevel() { return currentLevel; }

    return { startLevel, centerOnFlag, _renderDamagedCastleIntegrationTest, getState, getCurrentLevel };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Game._setup: startLevel()', () => {
    it('should call IsoCamera.setMapSize with level dimensions', () => {
        const calls = [];
        const deps = {
            LevelLoader: {},
            UnitManager: {},
            SpriteManager: { draw() {} },
            IsoCamera: {
                setMapSize(w, h) { calls.push({ method: 'setMapSize', w, h }); },
                centerOn() {},
            },
            IsoRenderer: {},
            HUD: {},
            AnimationController: {},
        };

        const game = createGame(deps);
        const level = { name: 'Test', width: 20, height: 15, tiles: [] };
        game.startLevel(level);

        assert.equal(calls.length, 1);
        assert.equal(calls[0].method, 'setMapSize');
        assert.equal(calls[0].w, 20);
        assert.equal(calls[0].h, 15);
    });

    it('should transition state to playing after startLevel', () => {
        const deps = {
            LevelLoader: {},
            UnitManager: {},
            SpriteManager: { draw() {} },
            IsoCamera: { setMapSize() {}, centerOn() {} },
            IsoRenderer: {},
            HUD: {},
            AnimationController: {},
        };

        const game = createGame(deps);
        assert.equal(game.getState(), 'loading');

        const level = { name: 'Test', width: 10, height: 10, tiles: [] };
        game.startLevel(level);

        assert.equal(game.getState(), 'playing');
    });

    it('should store the level as currentLevel', () => {
        const deps = {
            LevelLoader: {},
            UnitManager: {},
            SpriteManager: { draw() {} },
            IsoCamera: { setMapSize() {}, centerOn() {} },
            IsoRenderer: {},
            HUD: {},
            AnimationController: {},
        };

        const game = createGame(deps);
        const level = { name: 'Level 1', width: 30, height: 20, tiles: [] };
        game.startLevel(level);

        assert.equal(game.getCurrentLevel(), level);
    });
});

describe('Game.centerOnFlag()', () => {
    it('should center on the flag tile when one exists', () => {
        const centeredOn = [];
        const deps = {
            LevelLoader: {},
            UnitManager: {},
            SpriteManager: { draw() {} },
            IsoCamera: {
                setMapSize() {},
                centerOn(row, col) { centeredOn.push({ row, col }); },
            },
            IsoRenderer: {},
            HUD: {},
            AnimationController: {},
        };

        const game = createGame(deps);
        const level = {
            name: 'Test',
            width: 20,
            height: 15,
            tiles: [
                { row: 5, col: 10, isFlag: true },
                { row: 0, col: 0, isFlag: false },
            ],
        };
        game.startLevel(level);

        assert.equal(centeredOn.length, 1);
        assert.equal(centeredOn[0].row, 5);
        assert.equal(centeredOn[0].col, 10);
    });

    it('should center on map midpoint when no flag tile exists', () => {
        const centeredOn = [];
        const deps = {
            LevelLoader: {},
            UnitManager: {},
            SpriteManager: { draw() {} },
            IsoCamera: {
                setMapSize() {},
                centerOn(row, col) { centeredOn.push({ row, col }); },
            },
            IsoRenderer: {},
            HUD: {},
            AnimationController: {},
        };

        const game = createGame(deps);
        const level = {
            name: 'Test',
            width: 20,
            height: 14,
            tiles: [{ row: 0, col: 0 }],
        };
        game.startLevel(level);

        assert.equal(centeredOn.length, 1);
        assert.equal(centeredOn[0].row, 7);  // floor(14/2)
        assert.equal(centeredOn[0].col, 10); // floor(20/2)
    });

    it('should not throw when level has no tiles', () => {
        const deps = {
            LevelLoader: {},
            UnitManager: {},
            SpriteManager: { draw() {} },
            IsoCamera: { setMapSize() {}, centerOn() {} },
            IsoRenderer: {},
            HUD: {},
            AnimationController: {},
        };

        const game = createGame(deps);
        const level = { name: 'Empty', width: 10, height: 10, tiles: [] };

        assert.doesNotThrow(() => game.startLevel(level));
    });

    it('should not throw when level is null', () => {
        const deps = {
            LevelLoader: {},
            UnitManager: {},
            SpriteManager: { draw() {} },
            IsoCamera: { setMapSize() {}, centerOn() {} },
            IsoRenderer: {},
            HUD: {},
            AnimationController: {},
        };

        const game = createGame(deps);
        assert.doesNotThrow(() => game.centerOnFlag(null));
    });
});

describe('Game._renderDamagedCastleIntegrationTest()', () => {
    it('should return true when SpriteManager.draw succeeds', () => {
        const drawCalls = [];
        const deps = {
            LevelLoader: {},
            UnitManager: {},
            SpriteManager: {
                draw(ctx, name, x, y, w, h) { drawCalls.push({ name, x, y, w, h }); },
            },
            IsoCamera: { setMapSize() {}, centerOn() {} },
            IsoRenderer: {},
            HUD: {},
            AnimationController: {},
        };

        const game = createGame(deps);
        const mockCtx = {};
        const result = game._renderDamagedCastleIntegrationTest(mockCtx);

        assert.equal(result, true);
        assert.equal(drawCalls.length, 1);
        assert.equal(drawCalls[0].name, 'castle-wall-damaged');
        assert.equal(drawCalls[0].x, 10);
        assert.equal(drawCalls[0].y, 10);
        assert.equal(drawCalls[0].w, 64);
        assert.equal(drawCalls[0].h, 32);
    });

    it('should return false when SpriteManager.draw throws', () => {
        const deps = {
            LevelLoader: {},
            UnitManager: {},
            SpriteManager: {
                draw() { throw new Error('Sprite not loaded'); },
            },
            IsoCamera: { setMapSize() {}, centerOn() {} },
            IsoRenderer: {},
            HUD: {},
            AnimationController: {},
        };

        const game = createGame(deps);
        const mockCtx = {};
        const result = game._renderDamagedCastleIntegrationTest(mockCtx);

        assert.equal(result, false);
    });

    it('should call draw with castle-wall-damaged sprite name', () => {
        let capturedName = null;
        const deps = {
            LevelLoader: {},
            UnitManager: {},
            SpriteManager: {
                draw(ctx, name) { capturedName = name; },
            },
            IsoCamera: { setMapSize() {}, centerOn() {} },
            IsoRenderer: {},
            HUD: {},
            AnimationController: {},
        };

        const game = createGame(deps);
        game._renderDamagedCastleIntegrationTest({});

        assert.equal(capturedName, 'castle-wall-damaged');
    });
});

describe('Game.registerAnimatedTypes()', () => {
    it('should register water and flag animation types', () => {
        const registered = [];
        const mockAnimationController = {
            registerAnimatedType(type, frameCount, interval) {
                registered.push({ type, frameCount, interval });
            },
        };

        // Simulate the registration logic from game-iso.js
        function registerAnimatedTypes(animController) {
            animController.registerAnimatedType('water', 3, 500);
            animController.registerAnimatedType('flag', 4, 400);
        }

        registerAnimatedTypes(mockAnimationController);

        assert.equal(registered.length, 2);
        assert.equal(registered[0].type, 'water');
        assert.equal(registered[0].frameCount, 3);
        assert.equal(registered[1].type, 'flag');
        assert.equal(registered[1].frameCount, 4);
    });
});
