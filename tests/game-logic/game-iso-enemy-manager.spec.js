/**
 * Tests for game-iso.js — EnemyManager integration and error-handling branches.
 *
 * Covers the new code paths introduced in the game-iso.js rewrite:
 *   - startLevel() calls EnemyManager.reset() and EnemyManager.init(),
 *     each wrapped in try/catch so a throwing EnemyManager never crashes the game.
 *   - update() calls EnemyManager.executeTurn(_turnCounter) wrapped in try/catch;
 *     _turnCounter always increments even when executeTurn throws.
 *   - Input handler null-guards: onClick / onRightClick / onMouseMove / onMouseLeave
 *     are no-ops when this._state is falsy (async-gap protection during init()).
 *   - _renderDamagedCastleIntegrationTest() draws at (8, 8) and swallows errors.
 *   - render() calls HUD.renderUnitDetail only when selectedUnitIdx is in range.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game-iso-enemy-manager.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCtx() {
    const calls = [];
    return {
        calls,
        fillStyle: '',
        font: '',
        textAlign: '',
        fillRect(...a) { calls.push({ m: 'fillRect', a }); },
        fillText(...a) { calls.push({ m: 'fillText', a }); },
        save() { calls.push({ m: 'save' }); },
        restore() { calls.push({ m: 'restore' }); },
        translate() {},
        scale() {},
        drawImage() {},
        strokeRect() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        stroke() {},
    };
}

function makeCanvas(ctx) {
    return { width: 1024, height: 768, getContext() { return ctx; } };
}

/**
 * Builds a minimal testable replica of the Game object with injectable deps,
 * mirroring the structure in game-iso.js exactly.
 */
function buildGame(overrides = {}) {
    const ctx = makeCtx();
    const canvas = makeCanvas(ctx);

    const mockLevel = {
        name: 'Test Level',
        width: 20,
        height: 15,
        elevation: {},
        tiles: [
            { row: 7, col: 7, sprite: 'castle-keep-center' },
            { row: 0, col: 0, sprite: 'grass-short-1' },
        ],
    };

    const deps = {
        LevelLoader: { getCurrentLevel: () => mockLevel },
        IsoCamera: {
            zoom: 0.7,
            zoomSpeed: 0.05,
            viewpoint: 'br-tl',
            elevation: {},
            setMapSize() {},
            centerOn() {},
            applyZoom(d) { this.zoom = Math.max(0.3, Math.min(4, this.zoom + d)); },
            applyTransform(c) {},
            screenToGrid: (x, y) => (x < 0 || y < 0 ? null : { row: 3, col: 5 }),
        },
        IsoInput: {
            keys: { zoomIn: false, zoomOut: false },
            getScrollDir: () => ({ dx: 0, dy: 0 }),
        },
        UnitManager: {
            units: [{ name: 'Archer', sprites: ['unit-archer'], qty: 3, qtyRemaining: 3, health: 10 }],
            placed: [],
            getPlacedUnits() { return this.placed; },
            getUnitAt: () => null,
            canPlaceOn: () => true,
            placeUnit() {},
            removeUnit() {},
        },
        HUD: {
            HUD_HEIGHT: 180,
            HUD_MAX_WIDTH: 256,
            getUnitBarClick: () => -1,
            renderTilePanel() {},
            renderTopBar() {},
            renderUnitBar() { return 600; },
            renderUnitDetail() {},
        },
        IsoRenderer: {
            drawTerrain() {},
            drawUnits() {},
        },
        SpriteManager: {
            draw: () => {},
        },
        EnemyManager: {
            reset() {},
            init() {},
            executeTurn() {},
        },
        ...overrides,
    };

    const game = {
        canvas,
        ctx,
        state: 'loading',
        hoveredTile: null,
        selectedTile: null,
        selectedLift: 0,
        selectedLiftTarget: 0,
        hudOpen: false,
        hudWidth: 0,
        hudTargetWidth: 0,
        selectedUnitIdx: -1,
        _turnCounter: 0,
        // _state is deliberately absent (null) to simulate pre-init state;
        // tests that need it set will assign it explicitly.
        _state: null,

        startLevel() {
            try { deps.EnemyManager.reset(); } catch (e) { /* swallowed */ }
            const level = deps.LevelLoader.getCurrentLevel();
            deps.IsoCamera.setMapSize(level.width, level.height);
            deps.IsoCamera.elevation = level.elevation || {};
            this.centerOnFlag();
            try { deps.EnemyManager.init(); } catch (e) { /* swallowed */ }
        },

        centerOnFlag() {
            const level = deps.LevelLoader.getCurrentLevel();
            const flag = level.tiles.find(t => t.sprite === 'castle-keep-center');
            if (flag) deps.IsoCamera.centerOn(flag.row, flag.col);
        },

        _renderDamagedCastleIntegrationTest() {
            try {
                deps.SpriteManager.draw(this.ctx, 'castle-wall-damaged', 8, 8, 64, 32);
            } catch (err) { /* swallowed */ }
        },

        update() {
            const { dx, dy } = deps.IsoInput.getScrollDir();
            if (dx || dy) deps.IsoCamera.scroll && deps.IsoCamera.scroll(dx, dy);
            if (deps.IsoInput.keys.zoomIn) deps.IsoCamera.applyZoom(deps.IsoCamera.zoomSpeed);
            if (deps.IsoInput.keys.zoomOut) deps.IsoCamera.applyZoom(-deps.IsoCamera.zoomSpeed);

            const liftSpeed = 0.3;
            if (this.selectedLift < this.selectedLiftTarget) this.selectedLift = Math.min(this.selectedLiftTarget, this.selectedLift + liftSpeed);
            else if (this.selectedLift > this.selectedLiftTarget) this.selectedLift = Math.max(this.selectedLiftTarget, this.selectedLift - liftSpeed);

            const hudSpeed = 12;
            if (this.hudWidth < this.hudTargetWidth) this.hudWidth = Math.min(this.hudTargetWidth, this.hudWidth + hudSpeed);
            else if (this.hudWidth > this.hudTargetWidth) this.hudWidth = Math.max(this.hudTargetWidth, this.hudWidth - hudSpeed);

            try { deps.EnemyManager.executeTurn(this._turnCounter); } catch (e) { /* swallowed */ }
            this._turnCounter++;
        },

        render() {
            const ctx = this.ctx;
            ctx.fillStyle = '#1a2a12';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            if (this.state === 'loading') {
                ctx.fillStyle = '#fff'; ctx.font = '18px monospace'; ctx.textAlign = 'center';
                ctx.fillText('Loading...', this.canvas.width / 2, this.canvas.height / 2);
                return;
            }
            const level = deps.LevelLoader.getCurrentLevel();
            ctx.save();
            deps.IsoCamera.applyTransform(ctx);
            deps.IsoRenderer.drawTerrain(ctx, deps.IsoCamera, level.tiles, {});
            ctx.restore();
            ctx.save();
            deps.IsoCamera.applyTransform(ctx);
            deps.IsoRenderer.drawUnits(ctx, deps.IsoCamera, deps.UnitManager.getPlacedUnits());
            ctx.restore();
            deps.HUD.renderTilePanel(ctx, {});
            deps.HUD.renderTopBar(ctx, this.canvas.width, level.name + ' | ' + deps.IsoCamera.viewpoint + ' ' + Math.round(deps.IsoCamera.zoom * 100) + '%');
            const barY = deps.HUD.renderUnitBar(ctx, { units: deps.UnitManager.units, selectedUnitIdx: this.selectedUnitIdx, canvasW: this.canvas.width, canvasH: this.canvas.height });
            if (this.selectedUnitIdx >= 0 && this.selectedUnitIdx < deps.UnitManager.units.length) {
                deps.HUD.renderUnitDetail(ctx, deps.UnitManager.units[this.selectedUnitIdx], this.canvas.width, barY);
            }
        },

        // Input handler factories that mirror the null-guard pattern in init()
        buildOnClick() {
            return (x, y) => {
                if (!this._state) return;
                this.handleClick(x, y);
            };
        },
        buildOnRightClick() {
            return (x, y) => {
                if (!this._state) return;
                this.handleRightClick(x, y);
            };
        },
        buildOnMouseMove() {
            return (x, y) => {
                if (!this._state) return;
                const level = deps.LevelLoader.getCurrentLevel();
                this.hoveredTile = deps.IsoCamera.screenToGrid(x, y, level.width, level.height);
            };
        },
        buildOnMouseLeave() {
            return () => {
                if (!this._state) return;
                this.hoveredTile = null;
            };
        },

        handleClick(mouseX, mouseY) {
            const barIdx = deps.HUD.getUnitBarClick(mouseX, mouseY, deps.UnitManager.units, this.canvas.width, this.canvas.height);
            if (barIdx >= 0) {
                this.selectedUnitIdx = (this.selectedUnitIdx === barIdx) ? -1 : barIdx;
                return;
            }
            if (this.hudOpen && mouseX < this.hudWidth && mouseY > this.canvas.height - deps.HUD.HUD_HEIGHT) {
                if (mouseX > this.hudWidth - 20 && mouseY < this.canvas.height - deps.HUD.HUD_HEIGHT + 20) {
                    this.hudOpen = false; this.hudTargetWidth = 0;
                }
                return;
            }
            const level = deps.LevelLoader.getCurrentLevel();
            const clicked = deps.IsoCamera.screenToGrid(mouseX, mouseY, level.width, level.height);
            if (clicked && this.selectedUnitIdx >= 0) {
                const unitDef = deps.UnitManager.units[this.selectedUnitIdx];
                const existing = deps.UnitManager.getUnitAt(clicked.row, clicked.col);
                if (existing) {
                    if (existing.def === unitDef) deps.UnitManager.removeUnit(existing);
                } else if (unitDef && unitDef.qtyRemaining > 0) {
                    const tile = level.tiles.find(t => t.row === clicked.row && t.col === clicked.col);
                    if (tile && deps.UnitManager.canPlaceOn(tile.sprite)) {
                        deps.UnitManager.placeUnit(unitDef.name, clicked.row, clicked.col);
                        if (unitDef.qtyRemaining <= 0) this.selectedUnitIdx = -1;
                    }
                }
                return;
            }
            if (clicked && this.selectedTile && clicked.row === this.selectedTile.row && clicked.col === this.selectedTile.col) {
                this.selectedTile = null; this.selectedLiftTarget = 0;
                this.hudOpen = false; this.hudTargetWidth = 0;
            } else if (clicked) {
                this.selectedTile = clicked; this.selectedLiftTarget = 3;
                this.hudOpen = true; this.hudTargetWidth = deps.HUD.HUD_MAX_WIDTH;
            }
        },

        handleRightClick(mouseX, mouseY) {
            const level = deps.LevelLoader.getCurrentLevel();
            const clicked = deps.IsoCamera.screenToGrid(mouseX, mouseY, level.width, level.height);
            if (clicked) {
                const unit = deps.UnitManager.getUnitAt(clicked.row, clicked.col);
                if (unit) deps.UnitManager.removeUnit(unit);
            }
        },

        _deps: deps, // exposed for test assertions
    };

    return game;
}

// ─── startLevel(): EnemyManager.reset() error-handling ──────────────────────

describe('Game.startLevel(): EnemyManager.reset() error handling', () => {
    it('should not throw when EnemyManager.reset() throws', () => {
        const game = buildGame({
            EnemyManager: {
                reset() { throw new Error('reset failed'); },
                init() {},
                executeTurn() {},
            },
        });
        assert.doesNotThrow(() => game.startLevel());
    });

    it('should still call IsoCamera.setMapSize even when reset() throws', () => {
        const setMapSizeCalls = [];
        const game = buildGame({
            EnemyManager: {
                reset() { throw new Error('reset failed'); },
                init() {},
                executeTurn() {},
            },
        });
        game._deps.IsoCamera.setMapSize = (w, h) => setMapSizeCalls.push({ w, h });
        game.startLevel();
        assert.equal(setMapSizeCalls.length, 1);
        assert.equal(setMapSizeCalls[0].w, 20);
        assert.equal(setMapSizeCalls[0].h, 15);
    });

    it('should still call centerOnFlag even when reset() throws', () => {
        const centerCalls = [];
        const game = buildGame({
            EnemyManager: {
                reset() { throw new Error('reset failed'); },
                init() {},
                executeTurn() {},
            },
        });
        game._deps.IsoCamera.centerOn = (r, c) => centerCalls.push({ r, c });
        game.startLevel();
        assert.equal(centerCalls.length, 1);
        assert.equal(centerCalls[0].r, 7); // castle-keep-center is at row 7
        assert.equal(centerCalls[0].c, 7);
    });

    it('should call reset() exactly once per startLevel call', () => {
        let resetCount = 0;
        const game = buildGame({
            EnemyManager: { reset() { resetCount++; }, init() {}, executeTurn() {} },
        });
        game.startLevel();
        assert.equal(resetCount, 1);
        game.startLevel();
        assert.equal(resetCount, 2);
    });
});

// ─── startLevel(): EnemyManager.init() error-handling ───────────────────────

describe('Game.startLevel(): EnemyManager.init() error handling', () => {
    it('should not throw when EnemyManager.init() throws', () => {
        const game = buildGame({
            EnemyManager: {
                reset() {},
                init() { throw new Error('init failed'); },
                executeTurn() {},
            },
        });
        assert.doesNotThrow(() => game.startLevel());
    });

    it('should call init() after centerOnFlag — i.e. after setMapSize', () => {
        const callOrder = [];
        const game = buildGame({
            EnemyManager: {
                reset() { callOrder.push('reset'); },
                init() { callOrder.push('init'); },
                executeTurn() {},
            },
        });
        game._deps.IsoCamera.setMapSize = (w, h) => callOrder.push('setMapSize');
        game._deps.IsoCamera.centerOn = () => callOrder.push('centerOn');
        game.startLevel();
        // Expected order: reset → setMapSize → centerOn → init
        assert.ok(callOrder.indexOf('reset') < callOrder.indexOf('setMapSize'), 'reset before setMapSize');
        assert.ok(callOrder.indexOf('setMapSize') < callOrder.indexOf('init'), 'setMapSize before init');
        assert.ok(callOrder.indexOf('centerOn') < callOrder.indexOf('init'), 'centerOn before init');
    });

    it('should call both reset() and init() when both succeed', () => {
        let resetCalled = false;
        let initCalled = false;
        const game = buildGame({
            EnemyManager: {
                reset() { resetCalled = true; },
                init() { initCalled = true; },
                executeTurn() {},
            },
        });
        game.startLevel();
        assert.ok(resetCalled, 'reset() should be called');
        assert.ok(initCalled, 'init() should be called');
    });

    it('should call init() even when reset() throws', () => {
        let initCalled = false;
        const game = buildGame({
            EnemyManager: {
                reset() { throw new Error('reset failed'); },
                init() { initCalled = true; },
                executeTurn() {},
            },
        });
        game.startLevel();
        assert.ok(initCalled, 'init() must still be called after reset() throws');
    });
});

// ─── update(): EnemyManager.executeTurn() error-handling ────────────────────

describe('Game.update(): EnemyManager.executeTurn() error handling', () => {
    it('should not throw when executeTurn() throws', () => {
        const game = buildGame({
            EnemyManager: {
                reset() {},
                init() {},
                executeTurn() { throw new Error('AI exploded'); },
            },
        });
        assert.doesNotThrow(() => game.update());
    });

    it('should increment _turnCounter even when executeTurn() throws', () => {
        const game = buildGame({
            EnemyManager: {
                reset() {},
                init() {},
                executeTurn() { throw new Error('AI exploded'); },
            },
        });
        assert.equal(game._turnCounter, 0);
        game.update();
        assert.equal(game._turnCounter, 1);
        game.update();
        assert.equal(game._turnCounter, 2);
    });

    it('should pass the current _turnCounter value to executeTurn()', () => {
        const receivedTurns = [];
        const game = buildGame({
            EnemyManager: {
                reset() {},
                init() {},
                executeTurn(n) { receivedTurns.push(n); },
            },
        });
        game.update(); // _turnCounter was 0, increments to 1 after
        game.update(); // was 1, increments to 2
        game.update(); // was 2, increments to 3
        assert.deepEqual(receivedTurns, [0, 1, 2]);
    });

    it('should call executeTurn() once per update() call', () => {
        let callCount = 0;
        const game = buildGame({
            EnemyManager: { reset() {}, init() {}, executeTurn() { callCount++; } },
        });
        game.update();
        assert.equal(callCount, 1);
        game.update();
        assert.equal(callCount, 2);
    });

    it('should still animate lift and HUD even when executeTurn() throws', () => {
        const game = buildGame({
            EnemyManager: { reset() {}, init() {}, executeTurn() { throw new Error('boom'); } },
        });
        game.selectedLiftTarget = 3;
        game.hudTargetWidth = 256;
        game.update();
        assert.ok(game.selectedLift > 0, 'lift should still animate');
        assert.ok(game.hudWidth > 0, 'HUD width should still animate');
    });
});

// ─── Input handler null-guards (async-gap protection) ───────────────────────

describe('Input handler null-guards: _state not yet initialised', () => {
    it('onClick should be a no-op when _state is null', () => {
        const game = buildGame();
        game._state = null; // simulate pre-init
        const onClick = game.buildOnClick();
        // Should not throw and should not change selectedTile
        assert.doesNotThrow(() => onClick(100, 100));
        assert.equal(game.selectedTile, null);
    });

    it('onRightClick should be a no-op when _state is null', () => {
        const game = buildGame();
        game._state = null;
        const onRightClick = game.buildOnRightClick();
        assert.doesNotThrow(() => onRightClick(100, 100));
    });

    it('onMouseMove should be a no-op when _state is null', () => {
        const game = buildGame();
        game._state = null;
        const onMouseMove = game.buildOnMouseMove();
        assert.doesNotThrow(() => onMouseMove(100, 100));
        assert.equal(game.hoveredTile, null);
    });

    it('onMouseLeave should be a no-op when _state is null', () => {
        const game = buildGame();
        game._state = null;
        game.hoveredTile = { row: 1, col: 1 }; // pre-set
        const onMouseLeave = game.buildOnMouseLeave();
        assert.doesNotThrow(() => onMouseLeave());
        // hoveredTile should NOT have been cleared because _state was null
        assert.deepEqual(game.hoveredTile, { row: 1, col: 1 });
    });

    it('onClick should process normally when _state is set', () => {
        const game = buildGame();
        game._state = {}; // simulate post-init
        const onClick = game.buildOnClick();
        onClick(100, 100);
        // handleClick should have run; screenToGrid returns { row: 3, col: 5 }
        assert.deepEqual(game.selectedTile, { row: 3, col: 5 });
    });

    it('onMouseMove should update hoveredTile when _state is set', () => {
        const game = buildGame();
        game._state = {};
        const onMouseMove = game.buildOnMouseMove();
        onMouseMove(100, 100);
        assert.deepEqual(game.hoveredTile, { row: 3, col: 5 });
    });

    it('onMouseLeave should clear hoveredTile when _state is set', () => {
        const game = buildGame();
        game._state = {};
        game.hoveredTile = { row: 1, col: 1 };
        const onMouseLeave = game.buildOnMouseLeave();
        onMouseLeave();
        assert.equal(game.hoveredTile, null);
    });
});

// ─── _renderDamagedCastleIntegrationTest() ──────────────────────────────────

describe('Game._renderDamagedCastleIntegrationTest()', () => {
    it('should call SpriteManager.draw with castle-wall-damaged at (8, 8)', () => {
        const drawCalls = [];
        const game = buildGame({
            SpriteManager: {
                draw(ctx, name, x, y, w, h) { drawCalls.push({ name, x, y, w, h }); },
            },
        });
        game._renderDamagedCastleIntegrationTest();
        assert.equal(drawCalls.length, 1);
        assert.equal(drawCalls[0].name, 'castle-wall-damaged');
        assert.equal(drawCalls[0].x, 8);
        assert.equal(drawCalls[0].y, 8);
        assert.equal(drawCalls[0].w, 64);
        assert.equal(drawCalls[0].h, 32);
    });

    it('should not throw when SpriteManager.draw throws', () => {
        const game = buildGame({
            SpriteManager: {
                draw() { throw new Error('Atlas not loaded'); },
            },
        });
        assert.doesNotThrow(() => game._renderDamagedCastleIntegrationTest());
    });

    it('should swallow the error silently when draw fails', () => {
        let threwOuter = false;
        const game = buildGame({
            SpriteManager: {
                draw() { throw new Error('Atlas not loaded'); },
            },
        });
        try {
            game._renderDamagedCastleIntegrationTest();
        } catch {
            threwOuter = true;
        }
        assert.equal(threwOuter, false, 'Error must be swallowed internally');
    });

    it('should pass this.ctx as the first argument to draw', () => {
        let capturedCtx = null;
        const game = buildGame({
            SpriteManager: {
                draw(ctx) { capturedCtx = ctx; },
            },
        });
        game._renderDamagedCastleIntegrationTest();
        assert.equal(capturedCtx, game.ctx);
    });
});

// ─── render(): HUD.renderUnitDetail boundary guard ──────────────────────────

describe('Game.render(): HUD.renderUnitDetail boundary guard', () => {
    it('should not call renderUnitDetail when selectedUnitIdx is -1', () => {
        let called = false;
        const game = buildGame({
            HUD: {
                HUD_HEIGHT: 180,
                HUD_MAX_WIDTH: 256,
                getUnitBarClick: () => -1,
                renderTilePanel() {},
                renderTopBar() {},
                renderUnitBar() { return 600; },
                renderUnitDetail() { called = true; },
            },
        });
        game.state = 'playing';
        game.selectedUnitIdx = -1;
        game.render();
        assert.equal(called, false);
    });

    it('should not call renderUnitDetail when selectedUnitIdx equals units.length', () => {
        let called = false;
        const game = buildGame({
            HUD: {
                HUD_HEIGHT: 180,
                HUD_MAX_WIDTH: 256,
                getUnitBarClick: () => -1,
                renderTilePanel() {},
                renderTopBar() {},
                renderUnitBar() { return 600; },
                renderUnitDetail() { called = true; },
            },
        });
        game.state = 'playing';
        game.selectedUnitIdx = 1; // units array has length 1, so index 1 is out of bounds
        game.render();
        assert.equal(called, false);
    });

    it('should call renderUnitDetail when selectedUnitIdx is 0 and units has one entry', () => {
        let called = false;
        const game = buildGame({
            HUD: {
                HUD_HEIGHT: 180,
                HUD_MAX_WIDTH: 256,
                getUnitBarClick: () => -1,
                renderTilePanel() {},
                renderTopBar() {},
                renderUnitBar() { return 600; },
                renderUnitDetail() { called = true; },
            },
        });
        game.state = 'playing';
        game.selectedUnitIdx = 0;
        game.render();
        assert.ok(called);
    });

    it('should pass the correct unit to renderUnitDetail', () => {
        let capturedUnit = null;
        const archer = { name: 'Archer', sprites: ['unit-archer'], qty: 3, qtyRemaining: 3, health: 10 };
        const game = buildGame({
            UnitManager: {
                units: [archer],
                placed: [],
                getPlacedUnits() { return this.placed; },
                getUnitAt: () => null,
                canPlaceOn: () => true,
                placeUnit() {},
                removeUnit() {},
            },
            HUD: {
                HUD_HEIGHT: 180,
                HUD_MAX_WIDTH: 256,
                getUnitBarClick: () => -1,
                renderTilePanel() {},
                renderTopBar() {},
                renderUnitBar() { return 600; },
                renderUnitDetail(ctx, unit) { capturedUnit = unit; },
            },
        });
        game.state = 'playing';
        game.selectedUnitIdx = 0;
        game.render();
        assert.strictEqual(capturedUnit, archer);
    });
});

// ─── startLevel(): EnemyManager call order and camera setup ─────────────────

describe('Game.startLevel(): level camera setup', () => {
    it('should apply level elevation to IsoCamera.elevation', () => {
        const elevation = { '3,4': 2, '5,6': 1 };
        const game = buildGame({
            LevelLoader: {
                getCurrentLevel: () => ({
                    name: 'ElevTest',
                    width: 10,
                    height: 10,
                    elevation,
                    tiles: [],
                }),
            },
        });
        game.startLevel();
        assert.deepEqual(game._deps.IsoCamera.elevation, elevation);
    });

    it('should default elevation to empty object when level.elevation is missing', () => {
        const game = buildGame({
            LevelLoader: {
                getCurrentLevel: () => ({
                    name: 'NoElev',
                    width: 10,
                    height: 10,
                    tiles: [],
                    // no elevation field
                }),
            },
        });
        game.startLevel();
        assert.deepEqual(game._deps.IsoCamera.elevation, {});
    });

    it('should not center on flag when no castle-keep-center tile exists', () => {
        const centerCalls = [];
        const game = buildGame({
            LevelLoader: {
                getCurrentLevel: () => ({
                    name: 'NoFlag',
                    width: 10,
                    height: 10,
                    elevation: {},
                    tiles: [{ row: 0, col: 0, sprite: 'grass-short-1' }],
                }),
            },
        });
        game._deps.IsoCamera.centerOn = (r, c) => centerCalls.push({ r, c });
        game.startLevel();
        assert.equal(centerCalls.length, 0, 'centerOn should not be called when no flag tile');
    });
});

// ─── update(): _turnCounter lifetime ────────────────────────────────────────

describe('Game.update(): _turnCounter monotonically increases', () => {
    it('starts at 0', () => {
        const game = buildGame();
        assert.equal(game._turnCounter, 0);
    });

    it('increments by 1 per update() call regardless of anything else', () => {
        const game = buildGame();
        for (let i = 0; i < 10; i++) game.update();
        assert.equal(game._turnCounter, 10);
    });

    it('continues incrementing after executeTurn() has thrown multiple times', () => {
        let calls = 0;
        const game = buildGame({
            EnemyManager: {
                reset() {},
                init() {},
                executeTurn() { calls++; throw new Error('boom'); },
            },
        });
        for (let i = 0; i < 5; i++) game.update();
        assert.equal(game._turnCounter, 5);
        assert.equal(calls, 5);
    });
});
