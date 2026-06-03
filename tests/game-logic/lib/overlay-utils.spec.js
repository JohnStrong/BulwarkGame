'use strict';

/**
 * Unit tests for js/game-logic/lib/overlay-utils.js
 *
 * Task 7.2 of castle-structure-overlays spec.
 * Requirements: 4.3, 4.4, 5.1, 5.2, 5.3
 *
 * Loads the REAL overlay-utils.js module with mocked dependencies injected
 * into the require cache before loading. iso-renderer.js has no module.exports
 * (browser global), so we inject a mock module into require.cache directly.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/overlay-utils.spec.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ─── Paths ───────────────────────────────────────────────────────────────────

const OVERLAY_UTILS_PATH   = path.resolve(__dirname, '../../../js/game-logic/lib/overlay-utils.js');
const ISO_RENDERER_PATH    = path.resolve(__dirname, '../../../js/game-logic/lib/iso-renderer.js');
const SPRITES_PATH         = path.resolve(__dirname, '../../../js/game-logic/sprites.js');

// ─── Minimal CASTLE_OVERLAY_CATEGORY_MAP matching design.md §5 ───────────────

const CASTLE_OVERLAY_CATEGORY_MAP = {
    'castle-wall-overlay':               { height: 96,  offsetY: 0 },
    'castle-wall-damaged-overlay':       { height: 96,  offsetY: 0 },
    'castle-tower-overlay':              { height: 128, offsetY: 0 },
    'castle-tower-damaged-overlay':      { height: 128, offsetY: 0 },
    'castle-keep-tl-overlay':            { height: 128, offsetY: 0 },
    'castle-keep-tl-damaged-overlay':    { height: 128, offsetY: 0 },
    'castle-keep-bl-overlay':            { height: 128, offsetY: 0 },
    'castle-keep-bl-damaged-overlay':    { height: 128, offsetY: 0 },
    'castle-keep-br-overlay':            { height: 128, offsetY: 0 },
    'castle-keep-br-damaged-overlay':    { height: 128, offsetY: 0 },
    'castle-keep-center-overlay':        { height: 128, offsetY: 0 },
    'castle-keep-center-damaged-overlay':{ height: 128, offsetY: 0 },
    'castle-gatehouse-overlay':          { height: 160, offsetY: 0 },
    'castle-gatehouse-damaged-overlay':  { height: 160, offsetY: 0 },
    'bridge-mm-overlay':                 { height: 64,  offsetY: 0 },
    'castle-bridge-start-overlay':       { height: 64,  offsetY: 0 },
    'castle-bridge-mid-overlay':         { height: 64,  offsetY: 0 },
    'castle-bridge-gate-overlay':        { height: 64,  offsetY: 0 },
};

// ─── Mock iso-renderer exports ────────────────────────────────────────────────

const mockIsoRenderer = {
    OVERLAY_WIDTH: 64,
    OVERLAY_HEIGHT: 48,
    TREE_OVERLAY_OFFSET_Y: 0,
    CASTLE_OVERLAY_CATEGORY_MAP,
};

// ─── Mock SpriteManager ───────────────────────────────────────────────────────

let spriteDrawCalls = [];
const mockSpriteManager = {
    draw(ctx, name, x, y, w, h) {
        spriteDrawCalls.push({ name, x, y, w, h });
    },
    spriteList: [],
    images: {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function injectMocks() {
    // Inject mock iso-renderer into the require cache
    require.cache[ISO_RENDERER_PATH] = {
        id: ISO_RENDERER_PATH,
        filename: ISO_RENDERER_PATH,
        loaded: true,
        exports: mockIsoRenderer,
    };
    // Inject mock sprites.js into the require cache
    require.cache[SPRITES_PATH] = {
        id: SPRITES_PATH,
        filename: SPRITES_PATH,
        loaded: true,
        exports: mockSpriteManager,
    };
}

function loadFreshOverlayUtils() {
    delete require.cache[OVERLAY_UTILS_PATH];
    injectMocks();
    return require(OVERLAY_UTILS_PATH);
}

function clearCaches() {
    delete require.cache[OVERLAY_UTILS_PATH];
    delete require.cache[ISO_RENDERER_PATH];
    delete require.cache[SPRITES_PATH];
}

function createMockCtx() {
    return {
        drawImage() {},
        fillRect() {},
    };
}

function createMockCamera(overrides = {}) {
    return { tileW: 64, tileH: 32, ...overrides };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveOverlayDraw — null return', () => {
    let resolveOverlayDraw;

    beforeEach(() => {
        spriteDrawCalls = [];
        ({ resolveOverlayDraw } = loadFreshOverlayUtils());
    });

    afterEach(() => {
        clearCaches();
    });

    it('returns null when tile has no overlay field', () => {
        const tile = { sprite: 'grass-short-1' };
        const result = resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera());
        assert.equal(result, null);
    });

    it('returns null when tile.overlay is undefined', () => {
        const tile = { sprite: 'road-full', overlay: undefined };
        const result = resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera());
        assert.equal(result, null);
    });

    it('returns null when tile.overlay is null', () => {
        const tile = { sprite: 'road-full', overlay: null };
        const result = resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera());
        assert.equal(result, null);
    });

    it('returns null when tile.overlay is empty string', () => {
        const tile = { sprite: 'road-full', overlay: '' };
        const result = resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera());
        assert.equal(result, null);
    });
});

describe('resolveOverlayDraw — tree-* overlays', () => {
    let resolveOverlayDraw;

    beforeEach(() => {
        spriteDrawCalls = [];
        ({ resolveOverlayDraw } = loadFreshOverlayUtils());
    });

    afterEach(() => {
        clearCaches();
    });

    it('returns a function for a tile with a tree-* overlay', () => {
        const tile = { sprite: 'grass-short-1', overlay: 'tree-oak-overlay-1' };
        const result = resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera());
        assert.equal(typeof result, 'function');
    });

    it('returns a function for tree-pine-overlay-2', () => {
        const tile = { sprite: 'grass-short-2', overlay: 'tree-pine-overlay-2' };
        const result = resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera());
        assert.equal(typeof result, 'function');
    });

    it('returned function calls SpriteManager.draw with the overlay name', () => {
        const tile = { sprite: 'grass-short-1', overlay: 'tree-shrub-overlay-1' };
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const drawFn = resolveOverlayDraw(tile, ctx, 200, 150, camera);

        drawFn();

        assert.equal(spriteDrawCalls.length, 1);
        assert.equal(spriteDrawCalls[0].name, 'tree-shrub-overlay-1');
    });

    it('returned function draws tree overlay at OVERLAY_WIDTH × OVERLAY_HEIGHT (64 × 48)', () => {
        const tile = { sprite: 'grass-short-1', overlay: 'tree-oak-overlay-3' };
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const drawFn = resolveOverlayDraw(tile, ctx, 200, 150, camera);

        drawFn();

        assert.equal(spriteDrawCalls[0].w, 64, 'width must be OVERLAY_WIDTH (64)');
        assert.equal(spriteDrawCalls[0].h, 48, 'height must be OVERLAY_HEIGHT (48)');
    });

    it('returned function positions tree overlay using the standard formula', () => {
        const x = 200, y = 150;
        const camera = createMockCamera({ tileW: 64, tileH: 32 });
        const tile = { sprite: 'grass-short-1', overlay: 'tree-oak-overlay-1' };
        const ctx = createMockCtx();
        const drawFn = resolveOverlayDraw(tile, ctx, x, y, camera);

        drawFn();

        // Formula: overlayX = x - OVERLAY_WIDTH/2 = 200 - 32 = 168
        //          tileTopY = y - tileH/2 = 150 - 16 = 134
        //          overlayY = tileTopY - (OVERLAY_HEIGHT - tileH) + TREE_OVERLAY_OFFSET_Y
        //                   = 134 - (48 - 32) + 0 = 134 - 16 = 118
        assert.equal(spriteDrawCalls[0].x, 168, 'overlayX = x - OVERLAY_WIDTH/2');
        assert.equal(spriteDrawCalls[0].y, 118, 'overlayY formula: tileTopY - (OVERLAY_HEIGHT - tileH) + offsetY');
    });
});

describe('resolveOverlayDraw — castle-* and bridge-* overlays', () => {
    let resolveOverlayDraw;

    beforeEach(() => {
        spriteDrawCalls = [];
        ({ resolveOverlayDraw } = loadFreshOverlayUtils());
    });

    afterEach(() => {
        clearCaches();
    });

    it('returns a function for a registered castle-wall-overlay', () => {
        const tile = { sprite: 'castle-wall', overlay: 'castle-wall-overlay' };
        const result = resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera());
        assert.equal(typeof result, 'function');
    });

    it('returns a function for a registered castle-tower-overlay', () => {
        const tile = { sprite: 'castle-tower', overlay: 'castle-tower-overlay' };
        const result = resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera());
        assert.equal(typeof result, 'function');
    });

    it('returns a function for a registered bridge-mm-overlay', () => {
        const tile = { sprite: 'bridge-mm', overlay: 'bridge-mm-overlay' };
        const result = resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera());
        assert.equal(typeof result, 'function');
    });

    it('returns a function for a registered castle-gatehouse-overlay', () => {
        const tile = { sprite: 'castle-gatehouse', overlay: 'castle-gatehouse-overlay' };
        const result = resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera());
        assert.equal(typeof result, 'function');
    });

    it('returned function calls SpriteManager.draw with the overlay name', () => {
        const tile = { sprite: 'castle-wall', overlay: 'castle-wall-overlay' };
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const drawFn = resolveOverlayDraw(tile, ctx, 200, 150, camera);

        drawFn();

        assert.equal(spriteDrawCalls.length, 1);
        assert.equal(spriteDrawCalls[0].name, 'castle-wall-overlay');
    });

    it('returned function uses OVERLAY_WIDTH (64) as width for all castle overlays', () => {
        const tile = { sprite: 'castle-tower', overlay: 'castle-tower-overlay' };
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const drawFn = resolveOverlayDraw(tile, ctx, 200, 150, camera);

        drawFn();

        assert.equal(spriteDrawCalls[0].w, 64, 'width must be OVERLAY_WIDTH (64)');
    });

    it('returned function uses per-structure height for wall overlay (height=96)', () => {
        const tile = { sprite: 'castle-wall', overlay: 'castle-wall-overlay' };
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const drawFn = resolveOverlayDraw(tile, ctx, 200, 150, camera);

        drawFn();

        assert.equal(spriteDrawCalls[0].h, 96, 'wall overlay height must be 96');
    });

    it('returned function uses per-structure height for tower overlay (height=128)', () => {
        const tile = { sprite: 'castle-tower', overlay: 'castle-tower-overlay' };
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const drawFn = resolveOverlayDraw(tile, ctx, 200, 150, camera);

        drawFn();

        assert.equal(spriteDrawCalls[0].h, 128, 'tower overlay height must be 128');
    });

    it('returned function uses per-structure height for gatehouse overlay (height=160)', () => {
        const tile = { sprite: 'castle-gatehouse', overlay: 'castle-gatehouse-overlay' };
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const drawFn = resolveOverlayDraw(tile, ctx, 200, 150, camera);

        drawFn();

        assert.equal(spriteDrawCalls[0].h, 160, 'gatehouse overlay height must be 160');
    });

    it('positions castle overlay using the per-structure formula (wall, height=96)', () => {
        const x = 200, y = 150;
        const camera = createMockCamera({ tileW: 64, tileH: 32 });
        const tile = { sprite: 'castle-wall', overlay: 'castle-wall-overlay' };
        const ctx = createMockCtx();
        const drawFn = resolveOverlayDraw(tile, ctx, x, y, camera);

        drawFn();

        // overlayX = x - OVERLAY_WIDTH/2 = 200 - 32 = 168
        // tileTopY = y - tileH/2 = 150 - 16 = 134
        // overlayY = tileTopY - (overlayHeight - tileH) + offsetY
        //          = 134 - (96 - 32) + 0 = 134 - 64 = 70
        assert.equal(spriteDrawCalls[0].x, 168, 'overlayX = x - OVERLAY_WIDTH/2');
        assert.equal(spriteDrawCalls[0].y, 70, 'overlayY = tileTopY - (height - tileH) + offsetY');
    });

    it('positions castle overlay using the per-structure formula (tower, height=128)', () => {
        const x = 200, y = 150;
        const camera = createMockCamera({ tileW: 64, tileH: 32 });
        const tile = { sprite: 'castle-tower', overlay: 'castle-tower-overlay' };
        const ctx = createMockCtx();
        const drawFn = resolveOverlayDraw(tile, ctx, x, y, camera);

        drawFn();

        // overlayX = 200 - 32 = 168
        // tileTopY = 150 - 16 = 134
        // overlayY = 134 - (128 - 32) + 0 = 134 - 96 = 38
        assert.equal(spriteDrawCalls[0].x, 168, 'overlayX = x - OVERLAY_WIDTH/2');
        assert.equal(spriteDrawCalls[0].y, 38, 'overlayY = tileTopY - (128 - tileH) + offsetY');
    });

    it('positions castle overlay using the per-structure formula (gatehouse, height=160)', () => {
        const x = 200, y = 150;
        const camera = createMockCamera({ tileW: 64, tileH: 32 });
        const tile = { sprite: 'castle-gatehouse', overlay: 'castle-gatehouse-overlay' };
        const ctx = createMockCtx();
        const drawFn = resolveOverlayDraw(tile, ctx, x, y, camera);

        drawFn();

        // overlayX = 200 - 32 = 168
        // tileTopY = 150 - 16 = 134
        // overlayY = 134 - (160 - 32) + 0 = 134 - 128 = 6
        assert.equal(spriteDrawCalls[0].x, 168, 'overlayX = x - OVERLAY_WIDTH/2');
        assert.equal(spriteDrawCalls[0].y, 6, 'overlayY = tileTopY - (160 - tileH) + offsetY');
    });

    it('handles damaged variants (castle-wall-damaged-overlay) with height=96', () => {
        const tile = { sprite: 'castle-wall-damaged', overlay: 'castle-wall-damaged-overlay' };
        const ctx = createMockCtx();
        const drawFn = resolveOverlayDraw(tile, ctx, 100, 100, createMockCamera());

        drawFn();

        assert.equal(spriteDrawCalls[0].name, 'castle-wall-damaged-overlay');
        assert.equal(spriteDrawCalls[0].h, 96);
    });

    it('handles damaged variants (castle-tower-damaged-overlay) with height=128', () => {
        const tile = { sprite: 'castle-tower-damaged', overlay: 'castle-tower-damaged-overlay' };
        const ctx = createMockCtx();
        const drawFn = resolveOverlayDraw(tile, ctx, 100, 100, createMockCamera());

        drawFn();

        assert.equal(spriteDrawCalls[0].name, 'castle-tower-damaged-overlay');
        assert.equal(spriteDrawCalls[0].h, 128);
    });
});

describe('resolveOverlayDraw — error cases', () => {
    let resolveOverlayDraw;

    beforeEach(() => {
        spriteDrawCalls = [];
        ({ resolveOverlayDraw } = loadFreshOverlayUtils());
    });

    afterEach(() => {
        clearCaches();
    });

    it('throws for an overlay name not on the allowlist (not tree-, castle-, or bridge-)', () => {
        const tile = { sprite: 'grass-short-1', overlay: 'unknown-overlay' };
        assert.throws(
            () => resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera()),
            /Overlay not allowed on sprite/
        );
    });

    it('throws for a completely arbitrary overlay name', () => {
        const tile = { sprite: 'road-full', overlay: 'not-a-valid-overlay' };
        assert.throws(
            () => resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera()),
            /Overlay not allowed on sprite/
        );
    });

    it('throws for a castle- prefix name NOT registered in CASTLE_OVERLAY_CATEGORY_MAP', () => {
        const tile = { sprite: 'castle-wall', overlay: 'castle-unregistered-overlay' };
        assert.throws(
            () => resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera()),
            /Unregistered castle overlay sprite/
        );
    });

    it('throws for a bridge- prefix name NOT registered in CASTLE_OVERLAY_CATEGORY_MAP', () => {
        const tile = { sprite: 'bridge-mm', overlay: 'bridge-nonexistent-overlay' };
        assert.throws(
            () => resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera()),
            /Unregistered castle overlay sprite/
        );
    });
});

describe('resolveOverlayDraw — all 18 registered castle/bridge overlay names', () => {
    let resolveOverlayDraw;

    const ALL_CASTLE_OVERLAY_NAMES = Object.keys(CASTLE_OVERLAY_CATEGORY_MAP);

    beforeEach(() => {
        spriteDrawCalls = [];
        ({ resolveOverlayDraw } = loadFreshOverlayUtils());
    });

    afterEach(() => {
        clearCaches();
    });

    for (const overlayName of ALL_CASTLE_OVERLAY_NAMES) {
        // Closure capture — use immediately invoked function or block scoping
        const name = overlayName;
        it(`returns a function for registered overlay: ${name}`, () => {
            const tile = { sprite: 'dummy-sprite', overlay: name };
            const result = resolveOverlayDraw(tile, createMockCtx(), 100, 100, createMockCamera());
            assert.equal(typeof result, 'function', `Expected function for "${name}"`);
        });
    }
});

describe('resolveOverlayDraw — keep overlay 192px wide draw width', () => {
    // The diff added logic: castle-keep-overlay* and castle-keep-damaged* names
    // use overlayDrawWidth = 192 instead of OVERLAY_WIDTH (64).
    let resolveOverlayDraw;

    beforeEach(() => {
        spriteDrawCalls = [];
        ({ resolveOverlayDraw } = loadFreshOverlayUtils());
    });

    afterEach(() => {
        clearCaches();
    });

    it('uses 192 as draw width for castle-keep-overlay (exact prefix match)', () => {
        const tile = { sprite: 'castle-keep-tl', overlay: 'castle-keep-overlay' };
        // Register the name in the mock map so it resolves
        const origMap = mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP;
        mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP = {
            ...origMap,
            'castle-keep-overlay': { height: 64, offsetY: 0 },
        };
        const mod = loadFreshOverlayUtils();
        const drawFn = mod.resolveOverlayDraw(tile, createMockCtx(), 200, 150, createMockCamera());
        drawFn();
        assert.equal(spriteDrawCalls[0].w, 192, 'castle-keep-overlay must use 192px draw width');
        mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP = origMap;
    });

    it('uses 192 as draw width for castle-keep-tl-overlay (starts with castle-keep-overlay prefix? No — tests castle-keep-damaged prefix)', () => {
        // castle-keep-tl-overlay does NOT start with 'castle-keep-overlay' or 'castle-keep-damaged'
        // so it should use OVERLAY_WIDTH (64), not 192.
        const tile = { sprite: 'castle-keep-tl', overlay: 'castle-keep-tl-overlay' };
        const drawFn = resolveOverlayDraw(tile, createMockCtx(), 200, 150, createMockCamera());
        drawFn();
        assert.equal(spriteDrawCalls[0].w, 64, 'castle-keep-tl-overlay uses standard OVERLAY_WIDTH (64)');
    });

    it('uses 192 as draw width for overlay names starting with castle-keep-damaged', () => {
        const tile = { sprite: 'castle-keep-damaged', overlay: 'castle-keep-damaged-overlay' };
        const origMap = mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP;
        mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP = {
            ...origMap,
            'castle-keep-damaged-overlay': { height: 64, offsetY: 0 },
        };
        const mod = loadFreshOverlayUtils();
        const drawFn = mod.resolveOverlayDraw(tile, createMockCtx(), 200, 150, createMockCamera());
        drawFn();
        assert.equal(spriteDrawCalls[0].w, 192, 'castle-keep-damaged-overlay must use 192px draw width');
        mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP = origMap;
    });

    it('uses 192 as draw width for overlay names starting with castle-keep-destroyed', () => {
        const tile = { sprite: 'castle-keep-destroyed', overlay: 'castle-keep-destroyed-overlay' };
        const origMap = mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP;
        mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP = {
            ...origMap,
            'castle-keep-destroyed-overlay': { height: 64, offsetY: 0 },
        };
        const mod = loadFreshOverlayUtils();
        const drawFn = mod.resolveOverlayDraw(tile, createMockCtx(), 200, 150, createMockCamera());
        drawFn();
        assert.equal(spriteDrawCalls[0].w, 192, 'castle-keep-destroyed-overlay must use 192px draw width');
        mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP = origMap;
    });

    it('uses standard 64px draw width for non-keep castle overlays (castle-wall-overlay)', () => {
        const tile = { sprite: 'castle-wall', overlay: 'castle-wall-overlay' };
        const drawFn = resolveOverlayDraw(tile, createMockCtx(), 200, 150, createMockCamera());
        drawFn();
        assert.equal(spriteDrawCalls[0].w, 64, 'castle-wall-overlay must use standard OVERLAY_WIDTH (64)');
    });

    it('uses standard 64px draw width for castle-tower-overlay', () => {
        const tile = { sprite: 'castle-tower', overlay: 'castle-tower-overlay' };
        const drawFn = resolveOverlayDraw(tile, createMockCtx(), 200, 150, createMockCamera());
        drawFn();
        assert.equal(spriteDrawCalls[0].w, 64, 'castle-tower-overlay must use standard OVERLAY_WIDTH (64)');
    });

    it('uses standard 64px draw width for castle-gatehouse-overlay', () => {
        const tile = { sprite: 'castle-gatehouse', overlay: 'castle-gatehouse-overlay' };
        const drawFn = resolveOverlayDraw(tile, createMockCtx(), 200, 150, createMockCamera());
        drawFn();
        assert.equal(spriteDrawCalls[0].w, 64, 'castle-gatehouse-overlay must use standard OVERLAY_WIDTH (64)');
    });

    it('correctly centers a 192px wide keep overlay (overlayX = x - 96)', () => {
        const x = 200, y = 150;
        const camera = createMockCamera({ tileW: 64, tileH: 32 });
        const tile = { sprite: 'castle-keep-damaged', overlay: 'castle-keep-damaged-overlay' };
        const origMap = mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP;
        mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP = {
            ...origMap,
            'castle-keep-damaged-overlay': { height: 64, offsetY: 0 },
        };
        const mod = loadFreshOverlayUtils();
        const drawFn = mod.resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
        drawFn();

        // With overlayDrawWidth = 192: overlayX = x - 192/2 = 200 - 96 = 104
        assert.equal(spriteDrawCalls[0].x, 104, 'Keep overlay X = x - 96 (half of 192)');
        mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP = origMap;
    });

    it('Y position formula is unchanged for 192px wide keep overlays', () => {
        const x = 200, y = 150;
        const camera = createMockCamera({ tileW: 64, tileH: 32 });
        const tile = { sprite: 'castle-keep-damaged', overlay: 'castle-keep-damaged-overlay' };
        const origMap = mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP;
        mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP = {
            ...origMap,
            'castle-keep-damaged-overlay': { height: 128, offsetY: 0 },
        };
        const mod = loadFreshOverlayUtils();
        const drawFn = mod.resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
        drawFn();

        // overlayY = (y - tileH/2) - (overlayHeight - tileH) + offsetY
        //          = (150 - 16) - (128 - 32) + 0 = 134 - 96 = 38
        assert.equal(spriteDrawCalls[0].y, 38, 'Y formula is unchanged for 192px wide overlay');
        mockIsoRenderer.CASTLE_OVERLAY_CATEGORY_MAP = origMap;
    });
});

describe('resolveOverlayDraw — module exports', () => {
    it('exports resolveOverlayDraw as a named export', () => {
        const mod = loadFreshOverlayUtils();
        assert.equal(typeof mod.resolveOverlayDraw, 'function');
        clearCaches();
    });

    it('does not export unexpected properties', () => {
        const mod = loadFreshOverlayUtils();
        const keys = Object.keys(mod);
        assert.deepEqual(keys, ['resolveOverlayDraw'], `Unexpected exports: ${keys.join(', ')}`);
        clearCaches();
    });
});
