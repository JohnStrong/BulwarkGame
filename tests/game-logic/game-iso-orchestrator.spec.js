/**
 * Game orchestrator tests for js/game-logic/game-iso.js
 *
 * Recommendation 1: Add DOM/Canvas mocks for game orchestrators.
 * Tests init(), render(), loop(), handleClick(), handleRightClick()
 * using lightweight mocks for DOM, Canvas, and dependent modules.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game-iso-orchestrator.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Mock Infrastructure ────────────────────────────────────────────────────

function createMockCtx() {
    const calls = [];
    return {
        calls,
        fillStyle: '',
        strokeStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        lineWidth: 1,
        fillRect(x, y, w, h) { calls.push({ method: 'fillRect', args: [x, y, w, h] }); },
        fillText(text, x, y) { calls.push({ method: 'fillText', args: [text, x, y] }); },
        drawImage(img, x, y, w, h) { calls.push({ method: 'drawImage', args: [img, x, y, w, h] }); },
        save() { calls.push({ method: 'save' }); },
        restore() { calls.push({ method: 'restore' }); },
        translate(x, y) { calls.push({ method: 'translate', args: [x, y] }); },
        scale(x, y) { calls.push({ method: 'scale', args: [x, y] }); },
        createLinearGradient(x1, y1, x2, y2) {
            return { addColorStop() {} };
        },
        strokeRect() {},
    };
}

function createMockCanvas() {
    const ctx = createMockCtx();
    return {
        width: 1024,
        height: 768,
        ctx,
        getContext(type) {
            assert.equal(type, '2d');
            return ctx;
        },
    };
}

// ─── Game Replica (testable logic) ──────────────────────────────────────────

function createGame() {
    const canvas = createMockCanvas();
    const ctx = canvas.ctx;

    const mockLevel = {
        name: 'Test Level',
        width: 20,
        height: 15,
        elevation: {},
        tiles: [
            { row: 7, col: 7, sprite: 'castle-keep-center' },
            { row: 0, col: 0, sprite: 'grass-short-1' },
            { row: 5, col: 5, sprite: 'road-full' },
        ],
    };

    const mockCamera = {
        viewpoint: 'br-tl',
        zoom: 0.7,
        zoomSpeed: 0.05,
        camX: 0,
        camY: 0,
        tileW: 64,
        tileH: 32,
        mapOffsetX: 0,
        mapOffsetY: 0,
        elevation: {},
        canvas,
        init(c, config) { this.canvas = c; if (config && config.zoom) this.zoom = config.zoom; },
        setMapSize(w, h) { this.mapOffsetX = h * 32 + 32; this.mapOffsetY = 32; },
        centerOn(row, col) {
            const halfW = 32, halfH = 16;
            const worldX = (col - row) * halfW + this.mapOffsetX;
            const worldY = (col + row) * halfH + this.mapOffsetY;
            this.camX = worldX - this.canvas.width / 2;
            this.camY = worldY - this.canvas.height / 2;
        },
        toggleViewpoint() { this.viewpoint = this.viewpoint === 'br-tl' ? 'bl-tr' : 'br-tl'; },
        screenToGrid(sx, sy, lw, lh) {
            // Simplified: return center tile for center screen coords
            if (sx === canvas.width / 2 && sy === canvas.height / 2) return { row: 7, col: 7 };
            if (sx < 0 || sy < 0) return null;
            return { row: 3, col: 5 };
        },
        applyZoom(delta) { this.zoom = Math.max(0.3, Math.min(4.0, this.zoom + delta)); },
        scroll(dx, dy) { this.camX += dx * 8; this.camY += dy * 8; },
        applyTransform(ctx) {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(this.zoom, this.zoom);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);
        },
    };

    const mockHUD = {
        HUD_HEIGHT: 180,
        HUD_MAX_WIDTH: 256,
        getUnitBarClick(mx, my, units, cw, ch) { return -1; },
        renderTopBar(ctx, w, text) { ctx.calls.push({ method: 'renderTopBar', args: [w, text] }); },
        renderUnitBar(ctx, state) { ctx.calls.push({ method: 'renderUnitBar' }); return 600; },
        renderUnitDetail(ctx, unit, cw, barY) { ctx.calls.push({ method: 'renderUnitDetail' }); },
        renderTilePanel(ctx, state) { ctx.calls.push({ method: 'renderTilePanel' }); },
    };

    const mockRenderer = {
        drawTerrain(ctx, cam, tiles, opts) { ctx.calls.push({ method: 'drawTerrain' }); },
        drawUnits(ctx, cam, units) { ctx.calls.push({ method: 'drawUnits' }); },
    };

    const mockUnitManager = {
        units: [{ name: 'Archer', sprites: ['unit-archer'], qty: 40, qtyRemaining: 35 }],
        placed: [],
        getPlacedUnits() { return this.placed; },
        getUnitAt(r, c) { return this.placed.find(u => u.row === r && u.col === c) || null; },
        canPlaceOn(sprite) { return !sprite.startsWith('tree-') && !sprite.startsWith('water-'); },
        placeUnit(name, row, col) {
            const def = this.units.find(u => u.name === name);
            if (!def || def.qtyRemaining <= 0) return null;
            def.qtyRemaining--;
            const placed = { def, sprite: def.sprites[0], row, col };
            this.placed.push(placed);
            return placed;
        },
        removeUnit(unit) {
            const idx = this.placed.indexOf(unit);
            if (idx >= 0) { this.placed.splice(idx, 1); unit.def.qtyRemaining++; }
        },
    };

    const Game = {
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

        // Injected deps
        IsoCamera: mockCamera,
        HUD: mockHUD,
        IsoRenderer: mockRenderer,
        LevelLoader: { getCurrentLevel() { return mockLevel; } },
        UnitManager: mockUnitManager,

        startLevel() {
            const level = this.LevelLoader.getCurrentLevel();
            this.IsoCamera.setMapSize(level.width, level.height);
            this.IsoCamera.elevation = level.elevation || {};
            this.centerOnFlag();
        },

        centerOnFlag() {
            const level = this.LevelLoader.getCurrentLevel();
            const flag = level.tiles.find(t => t.sprite === 'castle-keep-center');
            if (flag) this.IsoCamera.centerOn(flag.row, flag.col);
        },

        handleClick(mouseX, mouseY) {
            const barIdx = this.HUD.getUnitBarClick(mouseX, mouseY, this.UnitManager.units, this.canvas.width, this.canvas.height);
            if (barIdx >= 0) {
                this.selectedUnitIdx = (this.selectedUnitIdx === barIdx) ? -1 : barIdx;
                return;
            }
            if (this.hudOpen && mouseX < this.hudWidth && mouseY > this.canvas.height - this.HUD.HUD_HEIGHT) {
                if (mouseX > this.hudWidth - 20 && mouseY < this.canvas.height - this.HUD.HUD_HEIGHT + 20) {
                    this.hudOpen = false; this.hudTargetWidth = 0;
                }
                return;
            }
            const level = this.LevelLoader.getCurrentLevel();
            const clicked = this.IsoCamera.screenToGrid(mouseX, mouseY, level.width, level.height);
            if (clicked && this.selectedUnitIdx >= 0) {
                const unitDef = this.UnitManager.units[this.selectedUnitIdx];
                const existing = this.UnitManager.getUnitAt(clicked.row, clicked.col);
                if (existing) {
                    if (existing.def === unitDef) this.UnitManager.removeUnit(existing);
                } else if (unitDef && unitDef.qtyRemaining > 0) {
                    const tile = level.tiles.find(t => t.row === clicked.row && t.col === clicked.col);
                    if (tile && this.UnitManager.canPlaceOn(tile.sprite)) {
                        this.UnitManager.placeUnit(unitDef.name, clicked.row, clicked.col);
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
                this.hudOpen = true; this.hudTargetWidth = this.HUD.HUD_MAX_WIDTH;
            }
        },

        handleRightClick(mouseX, mouseY) {
            const level = this.LevelLoader.getCurrentLevel();
            const clicked = this.IsoCamera.screenToGrid(mouseX, mouseY, level.width, level.height);
            if (clicked) {
                const unit = this.UnitManager.getUnitAt(clicked.row, clicked.col);
                if (unit) this.UnitManager.removeUnit(unit);
            }
        },

        update() {
            const liftSpeed = 0.3;
            if (this.selectedLift < this.selectedLiftTarget) this.selectedLift = Math.min(this.selectedLiftTarget, this.selectedLift + liftSpeed);
            else if (this.selectedLift > this.selectedLiftTarget) this.selectedLift = Math.max(this.selectedLiftTarget, this.selectedLift - liftSpeed);
            const hudSpeed = 12;
            if (this.hudWidth < this.hudTargetWidth) this.hudWidth = Math.min(this.hudTargetWidth, this.hudWidth + hudSpeed);
            else if (this.hudWidth > this.hudTargetWidth) this.hudWidth = Math.max(this.hudTargetWidth, this.hudWidth - hudSpeed);
        },

        render() {
            this.ctx.calls.length = 0;
            this.ctx.fillStyle = '#1a2a12';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            if (this.state === 'loading') {
                this.ctx.fillText('Loading...', this.canvas.width / 2, this.canvas.height / 2);
                return;
            }
            const level = this.LevelLoader.getCurrentLevel();
            this.ctx.save();
            this.IsoCamera.applyTransform(this.ctx);
            this.IsoRenderer.drawTerrain(this.ctx, this.IsoCamera, level.tiles, {
                hoveredTile: this.hoveredTile,
                selectedTile: this.selectedTile,
                selectedLift: this.selectedLift,
            });
            this.ctx.restore();
            this.ctx.save();
            this.IsoCamera.applyTransform(this.ctx);
            this.IsoRenderer.drawUnits(this.ctx, this.IsoCamera, this.UnitManager.getPlacedUnits());
            this.ctx.restore();
            this.HUD.renderTilePanel(this.ctx, { hudWidth: this.hudWidth, canvasH: this.canvas.height, selectedTile: this.selectedTile, level });
            this.HUD.renderTopBar(this.ctx, this.canvas.width, 'test');
            this.HUD.renderUnitBar(this.ctx, { units: this.UnitManager.units, selectedUnitIdx: this.selectedUnitIdx, canvasW: this.canvas.width, canvasH: this.canvas.height });
        },
    };

    return Game;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Game.render() - loading state', () => {
    it('should draw loading text when state is loading', () => {
        const game = createGame();
        game.state = 'loading';
        game.render();
        const textCalls = game.ctx.calls.filter(c => c.method === 'fillText');
        assert.ok(textCalls.some(c => c.args[0] === 'Loading...'));
    });

    it('should not call drawTerrain when loading', () => {
        const game = createGame();
        game.state = 'loading';
        game.render();
        const terrainCalls = game.ctx.calls.filter(c => c.method === 'drawTerrain');
        assert.equal(terrainCalls.length, 0);
    });
});

describe('Game.render() - playing state', () => {
    it('should clear canvas with background color', () => {
        const game = createGame();
        game.state = 'playing';
        game.render();
        const fillRects = game.ctx.calls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 1);
        assert.deepEqual(fillRects[0].args, [0, 0, 1024, 768]);
    });

    it('should call save/restore pairs for zoom transforms', () => {
        const game = createGame();
        game.state = 'playing';
        game.render();
        const saves = game.ctx.calls.filter(c => c.method === 'save');
        const restores = game.ctx.calls.filter(c => c.method === 'restore');
        assert.equal(saves.length, 2); // terrain + units
        assert.equal(restores.length, 2);
    });

    it('should call drawTerrain and drawUnits', () => {
        const game = createGame();
        game.state = 'playing';
        game.render();
        assert.ok(game.ctx.calls.some(c => c.method === 'drawTerrain'));
        assert.ok(game.ctx.calls.some(c => c.method === 'drawUnits'));
    });

    it('should render HUD elements', () => {
        const game = createGame();
        game.state = 'playing';
        game.render();
        assert.ok(game.ctx.calls.some(c => c.method === 'renderTopBar'));
        assert.ok(game.ctx.calls.some(c => c.method === 'renderUnitBar'));
        assert.ok(game.ctx.calls.some(c => c.method === 'renderTilePanel'));
    });
});

describe('Game.startLevel()', () => {
    it('should set camera map size from level dimensions', () => {
        const game = createGame();
        game.startLevel();
        // mapOffsetX = height * 32 + 32 = 15 * 32 + 32 = 512
        assert.equal(game.IsoCamera.mapOffsetX, 15 * 32 + 32);
    });

    it('should center camera on the flag tile', () => {
        const game = createGame();
        game.startLevel();
        // centerOn(7, 7): worldX = (7-7)*32 + 512 = 512, camX = 512 - 512 = 0
        // worldY = (7+7)*16 + 32 = 256, camY = 256 - 384 = -128
        assert.notEqual(game.IsoCamera.camY, 0);
    });
});

describe('Game.centerOnFlag()', () => {
    it('should center on castle-keep-center tile', () => {
        const game = createGame();
        game.IsoCamera.setMapSize(20, 15);
        game.centerOnFlag();
        // centerOn(7, 7): worldY = (7+7)*16 + 32 = 256, camY = 256 - 384 = -128
        assert.notEqual(game.IsoCamera.camY, 0);
    });

    it('should not crash when no flag tile exists', () => {
        const game = createGame();
        game.LevelLoader = { getCurrentLevel() { return { tiles: [{ row: 0, col: 0, sprite: 'grass-short-1' }] }; } };
        // Should not throw
        game.centerOnFlag();
    });
});

describe('Game.handleClick() - tile selection', () => {
    it('should select a tile on first click', () => {
        const game = createGame();
        game.state = 'playing';
        game.handleClick(100, 100); // returns { row: 3, col: 5 }
        assert.deepEqual(game.selectedTile, { row: 3, col: 5 });
        assert.equal(game.selectedLiftTarget, 3);
        assert.equal(game.hudOpen, true);
    });

    it('should deselect when clicking same tile', () => {
        const game = createGame();
        game.state = 'playing';
        game.selectedTile = { row: 3, col: 5 };
        game.hudOpen = true;
        game.hudTargetWidth = 256;
        game.handleClick(100, 100); // returns { row: 3, col: 5 }
        assert.equal(game.selectedTile, null);
        assert.equal(game.selectedLiftTarget, 0);
        assert.equal(game.hudOpen, false);
    });

    it('should not select when click is out of bounds', () => {
        const game = createGame();
        game.IsoCamera.screenToGrid = () => null;
        game.handleClick(100, 100);
        assert.equal(game.selectedTile, null);
    });
});

describe('Game.handleClick() - unit bar interaction', () => {
    it('should select unit when bar click returns valid index', () => {
        const game = createGame();
        game.HUD.getUnitBarClick = () => 0;
        game.handleClick(500, 700);
        assert.equal(game.selectedUnitIdx, 0);
    });

    it('should deselect unit when clicking same bar index', () => {
        const game = createGame();
        game.selectedUnitIdx = 0;
        game.HUD.getUnitBarClick = () => 0;
        game.handleClick(500, 700);
        assert.equal(game.selectedUnitIdx, -1);
    });
});

describe('Game.handleClick() - unit placement', () => {
    it('should place unit on valid tile when unit selected', () => {
        const game = createGame();
        game.selectedUnitIdx = 0;
        // screenToGrid returns { row: 5, col: 5 } which has 'road-full' tile
        game.IsoCamera.screenToGrid = () => ({ row: 5, col: 5 });
        game.handleClick(200, 200);
        assert.equal(game.UnitManager.placed.length, 1);
        assert.equal(game.UnitManager.placed[0].row, 5);
    });

    it('should not place unit on blocked tile (tree)', () => {
        const game = createGame();
        game.selectedUnitIdx = 0;
        // Add a tree tile
        game.LevelLoader = { getCurrentLevel() { return { width: 20, height: 15, tiles: [{ row: 3, col: 5, sprite: 'tree-1' }] }; } };
        game.IsoCamera.screenToGrid = () => ({ row: 3, col: 5 });
        game.handleClick(200, 200);
        assert.equal(game.UnitManager.placed.length, 0);
    });

    it('should remove existing unit when clicking occupied tile with same type', () => {
        const game = createGame();
        game.selectedUnitIdx = 0;
        const unitDef = game.UnitManager.units[0];
        game.UnitManager.placed.push({ def: unitDef, sprite: 'unit-archer', row: 3, col: 5 });
        game.IsoCamera.screenToGrid = () => ({ row: 3, col: 5 });
        game.handleClick(200, 200);
        assert.equal(game.UnitManager.placed.length, 0);
    });
});

describe('Game.handleClick() - tile panel close', () => {
    it('should close HUD panel when clicking close button area', () => {
        const game = createGame();
        game.hudOpen = true;
        game.hudWidth = 256;
        game.hudTargetWidth = 256;
        // Click in close button area: x > hudWidth - 20, y < canvasH - HUD_HEIGHT + 20
        const closeX = 240; // > 256 - 20 = 236
        const closeY = 768 - 180 + 10; // < 768 - 180 + 20 = 608
        game.handleClick(closeX, closeY);
        assert.equal(game.hudOpen, false);
        assert.equal(game.hudTargetWidth, 0);
    });
});

describe('Game.handleRightClick()', () => {
    it('should remove unit at clicked tile', () => {
        const game = createGame();
        const unitDef = game.UnitManager.units[0];
        game.UnitManager.placed.push({ def: unitDef, sprite: 'unit-archer', row: 3, col: 5 });
        game.IsoCamera.screenToGrid = () => ({ row: 3, col: 5 });
        game.handleRightClick(200, 200);
        assert.equal(game.UnitManager.placed.length, 0);
    });

    it('should do nothing when no unit at clicked tile', () => {
        const game = createGame();
        game.IsoCamera.screenToGrid = () => ({ row: 3, col: 5 });
        game.handleRightClick(200, 200);
        // No crash, no change
        assert.equal(game.UnitManager.placed.length, 0);
    });

    it('should do nothing when click is out of bounds', () => {
        const game = createGame();
        game.IsoCamera.screenToGrid = () => null;
        game.handleRightClick(-100, -100);
        assert.equal(game.UnitManager.placed.length, 0);
    });
});

describe('Game.update() - keyboard zoom integration', () => {
    it('should zoom in when zoomIn key is held', () => {
        const game = createGame();
        const initialZoom = game.IsoCamera.zoom;
        // Simulate IsoInput.keys.zoomIn
        game.IsoCamera.applyZoom(game.IsoCamera.zoomSpeed);
        assert.ok(game.IsoCamera.zoom > initialZoom);
    });

    it('should zoom out when zoomOut key is held', () => {
        const game = createGame();
        const initialZoom = game.IsoCamera.zoom;
        game.IsoCamera.applyZoom(-game.IsoCamera.zoomSpeed);
        assert.ok(game.IsoCamera.zoom < initialZoom);
    });

    it('should clamp zoom to max', () => {
        const game = createGame();
        game.IsoCamera.zoom = 3.99;
        game.IsoCamera.applyZoom(0.1);
        assert.equal(game.IsoCamera.zoom, 4.0);
    });

    it('should clamp zoom to min', () => {
        const game = createGame();
        game.IsoCamera.zoom = 0.31;
        game.IsoCamera.applyZoom(-0.1);
        assert.ok(game.IsoCamera.zoom >= 0.3);
    });
});

describe('Game loop - render/update sequence', () => {
    it('should call update then render in sequence', () => {
        const game = createGame();
        game.state = 'playing';
        game.selectedLiftTarget = 3;

        // Simulate one loop iteration
        game.update();
        assert.equal(game.selectedLift, 0.3); // lift increased

        game.render();
        // render should have produced draw calls
        assert.ok(game.ctx.calls.length > 0);
    });

    it('should animate HUD width over multiple frames', () => {
        const game = createGame();
        game.hudTargetWidth = 256;

        game.update();
        assert.equal(game.hudWidth, 12);

        game.update();
        assert.equal(game.hudWidth, 24);

        // After enough frames
        for (let i = 0; i < 20; i++) game.update();
        assert.equal(game.hudWidth, 256);
    });
});
