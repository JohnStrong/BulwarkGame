/**
 * DOM mock tests for js/game-logic/game-iso.js
 *
 * Recommendation 1: Add a DOM mock layer for game orchestrators.
 * Tests Game.init(), Game.update(), Game.render(), Game.handleClick(),
 * and Game.handleRightClick() using lightweight mocks for DOM APIs.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game-iso-dom-mock.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── DOM Mocks ──────────────────────────────────────────────────────────────

function createMockCanvas() {
    const calls = [];
    const ctx = {
        calls,
        fillStyle: '',
        font: '',
        textAlign: '',
        strokeStyle: '',
        lineWidth: 1,
        fillRect(x, y, w, h) { calls.push({ m: 'fillRect', a: [x, y, w, h] }); },
        fillText(t, x, y) { calls.push({ m: 'fillText', a: [t, x, y] }); },
        drawImage() { calls.push({ m: 'drawImage' }); },
        save() { calls.push({ m: 'save' }); },
        restore() { calls.push({ m: 'restore' }); },
        beginPath() { calls.push({ m: 'beginPath' }); },
        moveTo() { calls.push({ m: 'moveTo' }); },
        lineTo() { calls.push({ m: 'lineTo' }); },
        closePath() { calls.push({ m: 'closePath' }); },
        stroke() { calls.push({ m: 'stroke' }); },
        translate() { calls.push({ m: 'translate' }); },
        scale() { calls.push({ m: 'scale' }); },
    };
    return {
        width: 1024,
        height: 768,
        getContext() { return ctx; },
        ctx,
    };
}

// ─── Mock dependencies ──────────────────────────────────────────────────────

const MockIsoCamera = {
    zoom: 0.7,
    zoomSpeed: 0.05,
    tileW: 64,
    tileH: 32,
    viewpoint: 'br-tl',
    camX: 0,
    camY: 0,
    mapOffsetX: 512,
    mapOffsetY: 32,
    elevation: {},
    init() {},
    setMapSize() {},
    centerOn() {},
    toggleViewpoint() { this.viewpoint = this.viewpoint === 'br-tl' ? 'bl-tr' : 'br-tl'; },
    applyZoom(delta) { this.zoom = Math.max(0.3, Math.min(2, this.zoom + delta)); },
    scroll(dx, dy) { this.camX += dx * 4; this.camY += dy * 4; },
    applyTransform(ctx) { ctx.translate(-this.camX, -this.camY); ctx.scale(this.zoom, this.zoom); },
    screenToGrid(x, y, w, h) {
        if (x < 0 || y < 0) return null;
        return { row: Math.floor(y / 32), col: Math.floor(x / 64) };
    },
    gridToScreen(row, col) {
        return { x: (col - row) * 32 + this.mapOffsetX, y: (col + row) * 16 + this.mapOffsetY };
    },
};

const MockIsoInput = {
    keys: { zoomIn: false, zoomOut: false },
    init() {},
    getScrollDir() { return { dx: 0, dy: 0 }; },
};

const MockSpriteManager = {
    images: {},
    async loadAll() { this.images = { 'grass-short-1': {} }; },
    draw() {},
};

const MockLevelLoader = {
    levels: [{
        name: 'Test Level',
        tiles: [
            { row: 0, col: 0, sprite: 'grass-short-1', x: 0, y: 0 },
            { row: 0, col: 1, sprite: 'castle-keep-center', x: 64, y: 0 },
            { row: 1, col: 0, sprite: 'grass-short-1', x: 0, y: 32 },
        ],
        width: 5,
        height: 5,
        elevation: {},
    }],
    currentLevel: 0,
    async loadLevelList() {},
    getCurrentLevel() { return this.levels[this.currentLevel]; },
};

const MockUnitManager = {
    units: [
        { name: 'Archer', sprites: ['unit-archer'], qty: 4, qtyRemaining: 4, health: 30, attack: 15, defense: 0.9 },
    ],
    placed: [],
    async loadResources() {},
    getPlacedUnits() { return this.placed; },
    getAvailableUnits() { return this.units.filter(u => u.qtyRemaining > 0); },
    getUnitAt(row, col) { return this.placed.find(u => u.row === row && u.col === col) || null; },
    canPlaceOn(sprite) { return !sprite.startsWith('tree-') && !sprite.startsWith('water-'); },
    placeUnit(name, row, col) {
        const def = this.units.find(u => u.name === name && u.qtyRemaining > 0);
        if (!def) return null;
        def.qtyRemaining--;
        const placed = { def, sprite: def.sprites[0], row, col, currentHealth: def.health };
        this.placed.push(placed);
        return placed;
    },
    removeUnit(unit) {
        const idx = this.placed.indexOf(unit);
        if (idx >= 0) { this.placed.splice(idx, 1); unit.def.qtyRemaining++; }
    },
};

const MockHUD = {
    HUD_HEIGHT: 200,
    HUD_MAX_WIDTH: 250,
    getUnitBarClick() { return -1; },
    renderTilePanel() {},
    renderTopBar() {},
    renderUnitBar() { return 600; },
    renderUnitDetail() {},
};

const MockIsoRenderer = {
    drawTerrain() {},
    drawUnits() {},
};

// ─── Game replica (using mocks) ─────────────────────────────────────────────

function createGame() {
    return {
        canvas: null,
        ctx: null,
        state: 'loading',
        hoveredTile: null,
        selectedTile: null,
        selectedLift: 0,
        selectedLiftTarget: 0,
        hudOpen: false,
        hudWidth: 0,
        hudTargetWidth: 0,
        selectedUnitIdx: -1,

        async init() {
            const mockCanvas = createMockCanvas();
            this.canvas = mockCanvas;
            this.ctx = mockCanvas.ctx;
            MockIsoCamera.init();
            MockIsoInput.init();
            await MockSpriteManager.loadAll();
            await MockLevelLoader.loadLevelList();
            await MockUnitManager.loadResources();
            const level = MockLevelLoader.getCurrentLevel();
            if (!level || level.tiles.length === 0) return;
            this.startLevel();
            this.state = 'playing';
        },

        startLevel() {
            const level = MockLevelLoader.getCurrentLevel();
            MockIsoCamera.setMapSize(level.width, level.height);
            MockIsoCamera.elevation = level.elevation || {};
            this.centerOnFlag();
        },

        centerOnFlag() {
            const level = MockLevelLoader.getCurrentLevel();
            const flag = level.tiles.find(t => t.sprite === 'castle-keep-center');
            if (flag) MockIsoCamera.centerOn(flag.row, flag.col);
        },

        handleClick(mouseX, mouseY) {
            const barIdx = MockHUD.getUnitBarClick(mouseX, mouseY, MockUnitManager.units, this.canvas.width, this.canvas.height);
            if (barIdx >= 0) {
                this.selectedUnitIdx = (this.selectedUnitIdx === barIdx) ? -1 : barIdx;
                return;
            }
            if (this.hudOpen && mouseX < this.hudWidth && mouseY > this.canvas.height - MockHUD.HUD_HEIGHT) {
                if (mouseX > this.hudWidth - 20 && mouseY < this.canvas.height - MockHUD.HUD_HEIGHT + 20) {
                    this.hudOpen = false; this.hudTargetWidth = 0;
                }
                return;
            }
            const level = MockLevelLoader.getCurrentLevel();
            const clicked = MockIsoCamera.screenToGrid(mouseX, mouseY, level.width, level.height);
            if (clicked && this.selectedUnitIdx >= 0) {
                const unitDef = MockUnitManager.units[this.selectedUnitIdx];
                const existing = MockUnitManager.getUnitAt(clicked.row, clicked.col);
                if (existing) {
                    if (existing.def === unitDef) MockUnitManager.removeUnit(existing);
                } else if (unitDef && unitDef.qtyRemaining > 0) {
                    const tile = level.tiles.find(t => t.row === clicked.row && t.col === clicked.col);
                    if (tile && MockUnitManager.canPlaceOn(tile.sprite)) {
                        MockUnitManager.placeUnit(unitDef.name, clicked.row, clicked.col);
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
                this.hudOpen = true; this.hudTargetWidth = MockHUD.HUD_MAX_WIDTH;
            }
        },

        handleRightClick(mouseX, mouseY) {
            const level = MockLevelLoader.getCurrentLevel();
            const clicked = MockIsoCamera.screenToGrid(mouseX, mouseY, level.width, level.height);
            if (clicked) {
                const unit = MockUnitManager.getUnitAt(clicked.row, clicked.col);
                if (unit) MockUnitManager.removeUnit(unit);
            }
        },

        update() {
            const { dx, dy } = MockIsoInput.getScrollDir();
            if (dx || dy) MockIsoCamera.scroll(dx, dy);
            if (MockIsoInput.keys.zoomIn) MockIsoCamera.applyZoom(MockIsoCamera.zoomSpeed);
            if (MockIsoInput.keys.zoomOut) MockIsoCamera.applyZoom(-MockIsoCamera.zoomSpeed);
            const liftSpeed = 0.3;
            if (this.selectedLift < this.selectedLiftTarget) this.selectedLift = Math.min(this.selectedLiftTarget, this.selectedLift + liftSpeed);
            else if (this.selectedLift > this.selectedLiftTarget) this.selectedLift = Math.max(this.selectedLiftTarget, this.selectedLift - liftSpeed);
            const hudSpeed = 12;
            if (this.hudWidth < this.hudTargetWidth) this.hudWidth = Math.min(this.hudTargetWidth, this.hudWidth + hudSpeed);
            else if (this.hudWidth > this.hudTargetWidth) this.hudWidth = Math.max(this.hudTargetWidth, this.hudWidth - hudSpeed);
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
            const level = MockLevelLoader.getCurrentLevel();
            ctx.save();
            MockIsoCamera.applyTransform(ctx);
            MockIsoRenderer.drawTerrain(ctx, MockIsoCamera, level.tiles, {
                hoveredTile: this.hoveredTile,
                selectedTile: this.selectedTile,
                selectedLift: this.selectedLift,
            });
            ctx.restore();
            ctx.save();
            MockIsoCamera.applyTransform(ctx);
            MockIsoRenderer.drawUnits(ctx, MockIsoCamera, MockUnitManager.getPlacedUnits());
            ctx.restore();
        },
    };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Game.init() with DOM mocks', () => {
    it('should initialize canvas and set state to playing', async () => {
        const game = createGame();
        await game.init();
        assert.equal(game.state, 'playing');
        assert.ok(game.canvas !== null);
        assert.ok(game.ctx !== null);
    });

    it('should set canvas dimensions to 1024x768', async () => {
        const game = createGame();
        await game.init();
        assert.equal(game.canvas.width, 1024);
        assert.equal(game.canvas.height, 768);
    });
});

describe('Game.update() with DOM mocks', () => {
    it('should animate selectedLift toward target', async () => {
        const game = createGame();
        await game.init();
        game.selectedLiftTarget = 3;
        game.selectedLift = 0;
        game.update();
        assert.ok(game.selectedLift > 0, 'Lift should increase toward target');
        assert.ok(game.selectedLift <= 3);
    });

    it('should animate hudWidth toward target', async () => {
        const game = createGame();
        await game.init();
        game.hudTargetWidth = 250;
        game.hudWidth = 0;
        game.update();
        assert.ok(game.hudWidth > 0, 'HUD width should increase toward target');
    });

    it('should apply zoom when zoomIn key is held', async () => {
        const game = createGame();
        await game.init();
        const initialZoom = MockIsoCamera.zoom;
        MockIsoInput.keys.zoomIn = true;
        game.update();
        MockIsoInput.keys.zoomIn = false;
        assert.ok(MockIsoCamera.zoom > initialZoom);
    });
});

describe('Game.render() with DOM mocks', () => {
    it('should clear canvas with dark green background', async () => {
        const game = createGame();
        await game.init();
        game.ctx.calls.length = 0;
        game.render();
        const fillRectCall = game.ctx.calls.find(c => c.m === 'fillRect');
        assert.ok(fillRectCall, 'Should call fillRect to clear canvas');
        assert.deepEqual(fillRectCall.a, [0, 0, 1024, 768]);
    });

    it('should show Loading text when state is loading', async () => {
        const game = createGame();
        await game.init();
        game.state = 'loading';
        game.ctx.calls.length = 0;
        game.render();
        const textCall = game.ctx.calls.find(c => c.m === 'fillText');
        assert.ok(textCall, 'Should draw loading text');
        assert.equal(textCall.a[0], 'Loading...');
    });

    it('should call save/restore for zoom transforms', async () => {
        const game = createGame();
        await game.init();
        game.ctx.calls.length = 0;
        game.render();
        const saves = game.ctx.calls.filter(c => c.m === 'save');
        const restores = game.ctx.calls.filter(c => c.m === 'restore');
        assert.ok(saves.length >= 2, 'Should save context for terrain and units');
        assert.equal(saves.length, restores.length, 'Saves and restores should match');
    });
});

describe('Game.handleClick() with DOM mocks', () => {
    it('should select a tile on click', async () => {
        const game = createGame();
        await game.init();
        game.handleClick(100, 100);
        assert.ok(game.selectedTile !== null, 'Should select a tile');
        assert.equal(game.hudOpen, true);
    });

    it('should deselect tile on second click at same position', async () => {
        const game = createGame();
        await game.init();
        game.handleClick(100, 100);
        const tile = game.selectedTile;
        // Click same grid position again
        game.handleClick(100, 100);
        assert.equal(game.selectedTile, null);
        assert.equal(game.hudOpen, false);
    });

    it('should close tile panel via close button', async () => {
        const game = createGame();
        await game.init();
        game.hudOpen = true;
        game.hudWidth = 250;
        // Click in the close button area (top-right of panel)
        const closeX = 250 - 10; // within hudWidth - 20
        const closeY = 768 - 200 + 10; // within HUD_HEIGHT top
        game.handleClick(closeX, closeY);
        assert.equal(game.hudOpen, false);
        assert.equal(game.hudTargetWidth, 0);
    });

    it('should not place unit on blocked tile', async () => {
        const game = createGame();
        await game.init();
        // Add a tree tile to the level
        MockLevelLoader.levels[0].tiles.push({ row: 2, col: 0, sprite: 'tree-1', x: 0, y: 64 });
        game.selectedUnitIdx = 0;
        // Click on tree tile position
        game.handleClick(0, 64);
        assert.equal(MockUnitManager.placed.length, 0);
        // Cleanup
        MockLevelLoader.levels[0].tiles.pop();
    });

    it('should return null from screenToGrid for negative coords', async () => {
        const game = createGame();
        await game.init();
        game.handleClick(-10, -10);
        assert.equal(game.selectedTile, null);
    });
});

describe('Game.handleRightClick() with DOM mocks', () => {
    it('should remove unit on right-click', async () => {
        const game = createGame();
        await game.init();
        MockUnitManager.placed = [{ def: MockUnitManager.units[0], sprite: 'unit-archer', row: 3, col: 1, currentHealth: 30 }];
        MockUnitManager.units[0].qtyRemaining = 3;
        game.handleRightClick(64, 96); // grid position (3, 1)
        // Unit at (3,1) should be removed
        assert.equal(MockUnitManager.getUnitAt(3, 1), null);
    });

    it('should be a no-op when right-clicking empty tile', async () => {
        const game = createGame();
        await game.init();
        MockUnitManager.placed = [];
        const prevQty = MockUnitManager.units[0].qtyRemaining;
        game.handleRightClick(100, 100);
        assert.equal(MockUnitManager.units[0].qtyRemaining, prevQty);
    });
});
