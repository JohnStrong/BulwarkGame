'use strict';

/**
 * Tests for the inlined resolveOverlayDraw function in
 * js/game-logic/lib/iso-renderer.js (added by castle-structure-overlays diff).
 *
 * The function is now exported directly from iso-renderer.js and owns the
 * full overlay-dispatch logic (tree-*, castle-*, bridge-* allowlist + error paths).
 * These tests exercise the real exported module, not a replicated copy.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-renderer-resolve-overlay.spec.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ─── Paths ────────────────────────────────────────────────────────────────────

const ISO_RENDERER_PATH = path.resolve(
    __dirname, '../../../js/game-logic/lib/iso-renderer.js'
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recorded calls to the mock SpriteManager.draw. */
let spriteDrawCalls = [];

const mockSpriteManager = {
    draw(ctx, name, x, y, w, h) {
        spriteDrawCalls.push({ name, x, y, w, h });
    },
    spriteList: [],
    images: {},
};

function createMockCtx() {
    return { _isMockCtx: true };
}

function createCamera(overrides = {}) {
    return { tileW: 64, tileH: 32, ...overrides };
}


/**
 * Load iso-renderer.js with a mock SpriteManager injected into the require cache.
 * iso-renderer.js uses `SpriteManager` as a browser global; in Node.js it is
 * referenced by name. We inject the mock via a vm context wrapper approach:
 * instead, we load the module's text and wrap it so SpriteManager is defined.
 */
function loadIsoRenderer() {
    // Clear the cached module so each test suite gets a fresh copy.
    delete require.cache[ISO_RENDERER_PATH];

    // Inject the mock SpriteManager into a synthetic module that the real file
    // can access as a module-level variable. We do this by temporarily patching
    // global.SpriteManager before loading.
    global.SpriteManager = mockSpriteManager;

    const mod = require(ISO_RENDERER_PATH);

    // Do NOT delete global.SpriteManager here — the exported closures capture
    // it by reference and need it available when invoked.
    return mod;
}

function clearCache() {
    delete require.cache[ISO_RENDERER_PATH];
    delete global.SpriteManager;
}

// ─── All registered castle overlay names (bridge overlays removed from map) ────

const ALL_CASTLE_OVERLAY_NAMES = [
    'castle-wall-overlay',
    'castle-wall-damaged-overlay',
    'castle-tower-overlay',
    'castle-tower-damaged-overlay',
    'castle-keep-tl-overlay',
    'castle-keep-tl-damaged-overlay',
    'castle-keep-bl-overlay',
    'castle-keep-bl-damaged-overlay',
    'castle-keep-br-overlay',
    'castle-keep-br-damaged-overlay',
    'castle-keep-center-overlay',
    'castle-keep-center-damaged-overlay',
    'castle-gatehouse-overlay',
    'castle-gatehouse-damaged-overlay',
];


// ─── Tests: module exports ────────────────────────────────────────────────────

describe('iso-renderer.js module exports', () => {
    let mod;

    beforeEach(() => {
        spriteDrawCalls = [];
        mod = loadIsoRenderer();
    });

    afterEach(() => { clearCache(); });

    it('exports OVERLAY_WIDTH = 64', () => {
        assert.equal(mod.OVERLAY_WIDTH, 64);
    });

    it('exports OVERLAY_HEIGHT = 48', () => {
        assert.equal(mod.OVERLAY_HEIGHT, 48);
    });

    it('exports TREE_OVERLAY_OFFSET_Y = 0', () => {
        assert.equal(mod.TREE_OVERLAY_OFFSET_Y, 0);
    });

    it('exports WALL_OVERLAY_HEIGHT = 96', () => {
        assert.equal(mod.WALL_OVERLAY_HEIGHT, 96);
    });

    it('exports BRIDGE_OVERLAY_HEIGHT = 64', () => {
        assert.equal(mod.BRIDGE_OVERLAY_HEIGHT, 64);
    });

    it('exports TOWER_OVERLAY_HEIGHT = 128', () => {
        assert.equal(mod.TOWER_OVERLAY_HEIGHT, 128);
    });

    it('exports KEEP_OVERLAY_HEIGHT = 128', () => {
        assert.equal(mod.KEEP_OVERLAY_HEIGHT, 128);
    });

    it('exports GATEHOUSE_OVERLAY_HEIGHT = 160', () => {
        assert.equal(mod.GATEHOUSE_OVERLAY_HEIGHT, 160);
    });

    it('exports all four *_OVERLAY_OFFSET_Y constants as 0 (bridge removed)', () => {
        assert.equal(mod.WALL_OVERLAY_OFFSET_Y,      0);
        assert.equal(mod.TOWER_OVERLAY_OFFSET_Y,     0);
        assert.equal(mod.KEEP_OVERLAY_OFFSET_Y,      0);
        assert.equal(mod.GATEHOUSE_OVERLAY_OFFSET_Y, 0);
    });

    it('exports CASTLE_OVERLAY_CATEGORY_MAP as an object', () => {
        assert.equal(typeof mod.CASTLE_OVERLAY_CATEGORY_MAP, 'object');
        assert.ok(mod.CASTLE_OVERLAY_CATEGORY_MAP !== null);
    });

    it('exports IsoRenderer as an object', () => {
        assert.equal(typeof mod.IsoRenderer, 'object');
    });
});


// ─── Tests: resolveOverlayDraw — no overlay (null return) ────────────────────

describe('resolveOverlayDraw — returns null when no overlay', () => {
    let resolveOverlayDraw;

    beforeEach(() => {
        spriteDrawCalls = [];
        // resolveOverlayDraw is not directly exported; test via IsoRenderer.drawTerrain
        // or we can extract it. Since it is module-private but used by drawTerrain,
        // we test it indirectly through drawTerrain with a minimal tile set.
        loadIsoRenderer();
    });

    afterEach(() => { clearCache(); });

    it('drawTerrain makes exactly 1 SpriteManager.draw call for tile with no overlay', () => {
        const mod = loadIsoRenderer();
        const ctx = createMockCtx();
        const camera = createCamera();
        camera.gridToScreen = (row, col) => ({ x: col * 64, y: row * 32 });

        const tiles = [{ row: 0, col: 0, sprite: 'grass-short-1' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        mod.IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 1);
        assert.equal(spriteDrawCalls[0].name, 'grass-short-1');
    });

    it('drawTerrain makes exactly 1 call for tile with overlay=undefined', () => {
        const mod = loadIsoRenderer();
        const ctx = createMockCtx();
        const camera = createCamera();
        camera.gridToScreen = (row, col) => ({ x: col * 64, y: row * 32 });

        const tiles = [{ row: 0, col: 0, sprite: 'road-full', overlay: undefined }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        mod.IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 1);
    });

    it('drawTerrain makes exactly 1 call for tile with overlay=null', () => {
        const mod = loadIsoRenderer();
        const ctx = createMockCtx();
        const camera = createCamera();
        camera.gridToScreen = (row, col) => ({ x: col * 64, y: row * 32 });

        const tiles = [{ row: 0, col: 0, sprite: 'road-full', overlay: null }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        mod.IsoRenderer.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 1);
    });
});


// ─── Tests: resolveOverlayDraw — tree-* overlays ─────────────────────────────

describe('resolveOverlayDraw — tree-* overlays via drawTerrain', () => {
    let mod;

    beforeEach(() => {
        spriteDrawCalls = [];
        mod = loadIsoRenderer();
    });

    afterEach(() => { clearCache(); });

    function makeCamera(tileW, tileH) {
        return {
            tileW, tileH,
            gridToScreen: (row, col) => ({ x: col * tileW, y: row * tileH }),
        };
    }

    it('produces 2 draw calls for a tile with tree-oak-overlay-1', () => {
        const camera = makeCamera(64, 32);
        const tiles = [{ row: 0, col: 0, sprite: 'grass-short-1', overlay: 'tree-oak-overlay-1' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        mod.IsoRenderer.drawTerrain(createMockCtx(), camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 2);
        assert.equal(spriteDrawCalls[0].name, 'grass-short-1');
        assert.equal(spriteDrawCalls[1].name, 'tree-oak-overlay-1');
    });

    it('tree overlay is drawn at OVERLAY_WIDTH=64 × OVERLAY_HEIGHT=48', () => {
        const camera = makeCamera(64, 32);
        const tiles = [{ row: 0, col: 0, sprite: 'grass-short-2', overlay: 'tree-pine-overlay-2' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        mod.IsoRenderer.drawTerrain(createMockCtx(), camera, tiles, state);

        assert.equal(spriteDrawCalls[1].w, 64);
        assert.equal(spriteDrawCalls[1].h, 48);
    });

    it('tree overlay x = tileCenterX - 32 (OVERLAY_WIDTH/2)', () => {
        const camera = makeCamera(64, 32);
        // gridToScreen(1,2) => { x: 128, y: 32 }
        const tiles = [{ row: 1, col: 2, sprite: 'grass-short-1', overlay: 'tree-shrub-overlay-1' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        mod.IsoRenderer.drawTerrain(createMockCtx(), camera, tiles, state);

        const tileCenterX = 128;
        assert.equal(spriteDrawCalls[1].x, tileCenterX - 32);
    });

    it('tree overlay y = tileTopY - (48 - tileH) + TREE_OVERLAY_OFFSET_Y', () => {
        const camera = makeCamera(64, 32);
        // gridToScreen(1,2) => { x:128, y:32 }
        // tileTopY = 32 - 32/2 = 16
        // overlayY = 16 - (48-32) + 0 = 0
        const tiles = [{ row: 1, col: 2, sprite: 'grass-short-1', overlay: 'tree-oak-overlay-2' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        mod.IsoRenderer.drawTerrain(createMockCtx(), camera, tiles, state);

        const tileTopY = 32 - 32 / 2; // 16
        const expected = tileTopY - (48 - 32) + 0;
        assert.equal(spriteDrawCalls[1].y, expected);
    });

    it('handles all seven tree overlay names without throwing', () => {
        const camera = makeCamera(64, 32);
        const overlayNames = [
            'tree-oak-overlay-1', 'tree-oak-overlay-2', 'tree-oak-overlay-3',
            'tree-pine-overlay-1', 'tree-pine-overlay-2',
            'tree-shrub-overlay-1', 'tree-shrub-overlay-2',
        ];
        for (const overlayName of overlayNames) {
            spriteDrawCalls = [];
            const tiles = [{ row: 0, col: 0, sprite: 'grass-short-1', overlay: overlayName }];
            const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };
            assert.doesNotThrow(
                () => mod.IsoRenderer.drawTerrain(createMockCtx(), camera, tiles, state),
                `Should not throw for ${overlayName}`
            );
            assert.equal(spriteDrawCalls[1].name, overlayName);
        }
    });
});

