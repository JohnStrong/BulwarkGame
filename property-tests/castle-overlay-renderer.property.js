/**
 * Property 5: Overlay draw sequence invariant
 * Property 6: Overlay dimensions invariant
 * Property 7: Overlay positioning formula invariant
 *
 * Tests the overlay draw behavior of resolveOverlayDraw (from overlay-utils.js)
 * directly, with SpriteManager mocked via require.cache injection — the same
 * approach used by tests/game-logic/lib/overlay-utils.spec.js.
 *
 * We test resolveOverlayDraw rather than IsoRenderer.drawTerrain because
 * drawTerrain requires browser globals (SpriteManager as a global). All overlay
 * draw logic for castle/bridge tiles lives in resolveOverlayDraw, and
 * drawTerrain simply calls it and invokes the returned function.
 *
 * // Feature: castle-structure-overlays, Property 5: Overlay draw sequence invariant
 * // Feature: castle-structure-overlays, Property 6: Overlay dimensions invariant
 * // Feature: castle-structure-overlays, Property 7: Overlay positioning formula invariant
 *
 * **Validates: Requirements 10.5, 10.6, 10.7**
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fc = require('fast-check');

// ─── Module paths ─────────────────────────────────────────────────────────────

const OVERLAY_UTILS_PATH = path.resolve(__dirname, '../js/game-logic/lib/overlay-utils.js');
const ISO_RENDERER_PATH  = path.resolve(__dirname, '../js/game-logic/lib/iso-renderer.js');
const SPRITES_PATH       = path.resolve(__dirname, '../js/game-logic/sprites.js');

// ─── CASTLE_OVERLAY_CATEGORY_MAP (mirrors iso-renderer.js) ───────────────────

const CASTLE_OVERLAY_CATEGORY_MAP = {
    'castle-wall-overlay':                { height: 48, offsetY: 0 },
    'castle-wall-damaged-overlay':        { height: 48, offsetY: 0 },
    'castle-tower-overlay':               { height: 64, offsetY: 0 },
    'castle-tower-damaged-overlay':       { height: 64, offsetY: 0 },
    'castle-keep-tl-overlay':             { height: 64, offsetY: 0 },
    'castle-keep-tl-damaged-overlay':     { height: 64, offsetY: 0 },
    'castle-keep-bl-overlay':             { height: 64, offsetY: 0 },
    'castle-keep-bl-damaged-overlay':     { height: 64, offsetY: 0 },
    'castle-keep-br-overlay':             { height: 64, offsetY: 0 },
    'castle-keep-br-damaged-overlay':     { height: 64, offsetY: 0 },
    'castle-keep-center-overlay':         { height: 64, offsetY: 0 },
    'castle-keep-center-damaged-overlay': { height: 64, offsetY: 0 },
    'castle-gatehouse-overlay':           { height: 80, offsetY: 0 },
    'castle-gatehouse-damaged-overlay':   { height: 80, offsetY: 0 },
    'bridge-mm-overlay':                  { height: 48, offsetY: 0 },
    'castle-bridge-start-overlay':        { height: 48, offsetY: 0 },
    'castle-bridge-mid-overlay':          { height: 48, offsetY: 0 },
    'castle-bridge-gate-overlay':         { height: 48, offsetY: 0 },
};

/** All 18 castle/bridge overlay sprite names. */
const ALL_CASTLE_OVERLAY_NAMES = Object.keys(CASTLE_OVERLAY_CATEGORY_MAP);

// ─── Mock state ───────────────────────────────────────────────────────────────

/** Collects every SpriteManager.draw call argument list in order. */
let spriteDrawCalls = [];

const mockSpriteManager = {
    draw(ctx, name, x, y, w, h) {
        spriteDrawCalls.push({ name, x, y, w, h });
    },
    spriteList: [],
    images: {},
};

const mockIsoRenderer = {
    OVERLAY_WIDTH: 64,
    OVERLAY_HEIGHT: 48,
    TREE_OVERLAY_OFFSET_Y: 0,
    CASTLE_OVERLAY_CATEGORY_MAP,
};

// ─── Module helpers ───────────────────────────────────────────────────────────

function injectMocks() {
    require.cache[ISO_RENDERER_PATH] = {
        id: ISO_RENDERER_PATH,
        filename: ISO_RENDERER_PATH,
        loaded: true,
        exports: mockIsoRenderer,
    };
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

/** Minimal canvas context stub — overlay-utils doesn't use ctx directly. */
function createMockCtx() {
    return { drawImage() {}, fillRect() {} };
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Camera with tileW and tileH in [1, 256]. */
const cameraArb = fc.record({
    tileW: fc.integer({ min: 1, max: 256 }),
    tileH: fc.integer({ min: 1, max: 256 }),
});

/** Any of the 18 registered castle/bridge overlay sprite names. */
const castleOverlayNameArb = fc.constantFrom(...ALL_CASTLE_OVERLAY_NAMES);

/**
 * A tile object with a registered castle overlay field and a matching base sprite.
 * We use the overlay name to derive a plausible base sprite (not critical for
 * these properties — the base sprite name only appears in the first draw call).
 */
const castleTileArb = castleOverlayNameArb.map(overlayName => ({
    sprite: overlayName.replace('-overlay', '').replace('-damaged', ''),
    overlay: overlayName,
}));

/** Arbitrary screen position (x, y) for the tile center. */
const positionArb = fc.record({
    x: fc.integer({ min: -1000, max: 10000 }),
    y: fc.integer({ min: -1000, max: 10000 }),
});

// ─── Property 5: Overlay draw sequence invariant ──────────────────────────────

describe('Property 5: Overlay draw sequence invariant', () => {
    // Feature: castle-structure-overlays, Property 5: Overlay draw sequence invariant

    let resolveOverlayDraw;

    beforeEach(() => {
        spriteDrawCalls = [];
        ({ resolveOverlayDraw } = loadFreshOverlayUtils());
    });

    afterEach(() => {
        clearCaches();
    });

    it('resolveOverlayDraw draw fn uses tile.overlay as its sprite name (verifying sequence)', () => {
        /**
         * For any tile with a castle overlay and any valid camera,
         * the draw function returned by resolveOverlayDraw shall call
         * SpriteManager.draw with tile.overlay as the sprite name.
         *
         * This validates that the overlay draw closure captures the correct
         * overlay name — the "second call" in the full drawTerrain sequence.
         * (The first call — tile.sprite — is made by drawTerrain before invoking
         * the returned closure; resolveOverlayDraw itself only produces the
         * overlay draw closure, so here we verify the overlay half of the contract.)
         */
        fc.assert(
            fc.property(castleTileArb, positionArb, cameraArb, (tile, { x, y }, camera) => {
                spriteDrawCalls = [];
                const drawFn = resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
                assert.ok(typeof drawFn === 'function',
                    `resolveOverlayDraw should return a function for overlay "${tile.overlay}"`);

                drawFn();

                assert.strictEqual(spriteDrawCalls.length, 1,
                    'draw fn should produce exactly one SpriteManager.draw call');
                assert.strictEqual(spriteDrawCalls[0].name, tile.overlay,
                    `draw fn must use tile.overlay ("${tile.overlay}"), not tile.sprite ("${tile.sprite}")`);
            }),
            { numRuns: 200 }
        );
    });

    it('resolveOverlayDraw returns non-null for any registered castle overlay', () => {
        /**
         * For any tile with a castle overlay field, resolveOverlayDraw must
         * not return null — it must return a callable draw function.
         * This ensures the overlay draw is never silently skipped.
         */
        fc.assert(
            fc.property(castleTileArb, positionArb, cameraArb, (tile, { x, y }, camera) => {
                spriteDrawCalls = [];
                const drawFn = resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
                assert.ok(drawFn !== null,
                    `resolveOverlayDraw must not return null for overlay "${tile.overlay}"`);
                assert.strictEqual(typeof drawFn, 'function',
                    `resolveOverlayDraw must return a function for overlay "${tile.overlay}"`);
            }),
            { numRuns: 200 }
        );
    });

    it('tiles without overlay return null (no overlay draw happens)', () => {
        /**
         * Tiles with no overlay field must return null, ensuring only one
         * SpriteManager.draw call would be made in drawTerrain (ground sprite only).
         */
        const noOverlayTileArb = fc.record({
            sprite: fc.constantFrom('grass-short-1', 'road-full', 'rock', 'water-1'),
        });

        fc.assert(
            fc.property(noOverlayTileArb, positionArb, cameraArb, (tile, { x, y }, camera) => {
                spriteDrawCalls = [];
                const result = resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
                assert.strictEqual(result, null,
                    `resolveOverlayDraw must return null for tile with no overlay field`);
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 6: Overlay dimensions invariant ─────────────────────────────────

describe('Property 6: Overlay dimensions invariant', () => {
    // Feature: castle-structure-overlays, Property 6: Overlay dimensions invariant

    let resolveOverlayDraw;

    beforeEach(() => {
        spriteDrawCalls = [];
        ({ resolveOverlayDraw } = loadFreshOverlayUtils());
    });

    afterEach(() => {
        clearCaches();
    });

    it('overlay draw call always uses OVERLAY_WIDTH=64, never camera.tileW', () => {
        /**
         * For any castle overlay tile and any camera configuration,
         * the width passed to SpriteManager.draw must be 64 (OVERLAY_WIDTH),
         * regardless of camera.tileW.
         */
        fc.assert(
            fc.property(castleTileArb, positionArb, cameraArb, (tile, { x, y }, camera) => {
                spriteDrawCalls = [];
                const drawFn = resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
                drawFn();

                assert.strictEqual(spriteDrawCalls[0].w, 64,
                    `Overlay width must be OVERLAY_WIDTH=64, not camera.tileW=${camera.tileW}`);
            }),
            { numRuns: 200 }
        );
    });

    it('overlay height is the per-structure constant (48, 64, or 80), never camera.tileH', () => {
        /**
         * For any castle overlay tile and any camera configuration,
         * the height passed to SpriteManager.draw must be the per-structure
         * constant from CASTLE_OVERLAY_CATEGORY_MAP, not camera.tileH.
         */
        fc.assert(
            fc.property(castleTileArb, positionArb, cameraArb, (tile, { x, y }, camera) => {
                spriteDrawCalls = [];
                const drawFn = resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
                drawFn();

                const expectedHeight = CASTLE_OVERLAY_CATEGORY_MAP[tile.overlay].height;

                assert.strictEqual(spriteDrawCalls[0].h, expectedHeight,
                    `Overlay "${tile.overlay}" height must be ${expectedHeight}, not camera.tileH=${camera.tileH}`);
                assert.ok(
                    [48, 64, 80].includes(spriteDrawCalls[0].h),
                    `Overlay height must be one of 48, 64, 80 — got ${spriteDrawCalls[0].h}`
                );
            }),
            { numRuns: 200 }
        );
    });

    it('48px height sprites: walls and bridges (6 sprites)', () => {
        /**
         * All wall and bridge overlay sprites must use height=48.
         */
        const height48Names = [
            'castle-wall-overlay', 'castle-wall-damaged-overlay',
            'bridge-mm-overlay', 'castle-bridge-start-overlay',
            'castle-bridge-mid-overlay', 'castle-bridge-gate-overlay',
        ];

        fc.assert(
            fc.property(fc.constantFrom(...height48Names), positionArb, cameraArb, (overlayName, { x, y }, camera) => {
                spriteDrawCalls = [];
                const tile = { sprite: 'dummy', overlay: overlayName };
                const drawFn = resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
                drawFn();

                assert.strictEqual(spriteDrawCalls[0].h, 48,
                    `Wall/bridge overlay "${overlayName}" must use height=48, got ${spriteDrawCalls[0].h}`);
            }),
            { numRuns: 100 }
        );
    });

    it('64px height sprites: towers and keeps (10 sprites)', () => {
        /**
         * All tower and keep overlay sprites must use height=64.
         */
        const height64Names = [
            'castle-tower-overlay', 'castle-tower-damaged-overlay',
            'castle-keep-tl-overlay', 'castle-keep-tl-damaged-overlay',
            'castle-keep-bl-overlay', 'castle-keep-bl-damaged-overlay',
            'castle-keep-br-overlay', 'castle-keep-br-damaged-overlay',
            'castle-keep-center-overlay', 'castle-keep-center-damaged-overlay',
        ];

        fc.assert(
            fc.property(fc.constantFrom(...height64Names), positionArb, cameraArb, (overlayName, { x, y }, camera) => {
                spriteDrawCalls = [];
                const tile = { sprite: 'dummy', overlay: overlayName };
                const drawFn = resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
                drawFn();

                assert.strictEqual(spriteDrawCalls[0].h, 64,
                    `Tower/keep overlay "${overlayName}" must use height=64, got ${spriteDrawCalls[0].h}`);
            }),
            { numRuns: 100 }
        );
    });

    it('80px height sprites: gatehouse (2 sprites)', () => {
        /**
         * Both gatehouse overlay sprites must use height=80.
         */
        const height80Names = [
            'castle-gatehouse-overlay',
            'castle-gatehouse-damaged-overlay',
        ];

        fc.assert(
            fc.property(fc.constantFrom(...height80Names), positionArb, cameraArb, (overlayName, { x, y }, camera) => {
                spriteDrawCalls = [];
                const tile = { sprite: 'dummy', overlay: overlayName };
                const drawFn = resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
                drawFn();

                assert.strictEqual(spriteDrawCalls[0].h, 80,
                    `Gatehouse overlay "${overlayName}" must use height=80, got ${spriteDrawCalls[0].h}`);
            }),
            { numRuns: 50 }
        );
    });
});

// ─── Property 7: Overlay positioning formula invariant ────────────────────────

describe('Property 7: Overlay positioning formula invariant', () => {
    // Feature: castle-structure-overlays, Property 7: Overlay positioning formula invariant

    let resolveOverlayDraw;

    beforeEach(() => {
        spriteDrawCalls = [];
        ({ resolveOverlayDraw } = loadFreshOverlayUtils());
    });

    afterEach(() => {
        clearCaches();
    });

    it('overlay X = tileCenterX - 32 for any position and camera', () => {
        /**
         * The draw X must always be x - OVERLAY_WIDTH/2 = x - 32,
         * where x is the tile center screen X coordinate.
         * This must hold regardless of camera.tileW.
         */
        fc.assert(
            fc.property(castleTileArb, positionArb, cameraArb, (tile, { x, y }, camera) => {
                spriteDrawCalls = [];
                const drawFn = resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
                drawFn();

                const expectedX = x - 32; // x - OVERLAY_WIDTH/2
                assert.strictEqual(spriteDrawCalls[0].x, expectedX,
                    `Overlay X must be tileCenterX - 32 = ${expectedX}, got ${spriteDrawCalls[0].x}`);
            }),
            { numRuns: 200 }
        );
    });

    it('overlay Y = tileTopY - (overlayHeight - camera.tileH) + overlayOffsetY', () => {
        /**
         * The draw Y must follow the formula:
         *   tileTopY = y - camera.tileH / 2
         *   overlayY = tileTopY - (overlayHeight - camera.tileH) + overlayOffsetY
         *
         * where overlayHeight and overlayOffsetY come from CASTLE_OVERLAY_CATEGORY_MAP.
         */
        fc.assert(
            fc.property(castleTileArb, positionArb, cameraArb, (tile, { x, y }, camera) => {
                spriteDrawCalls = [];
                const drawFn = resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
                drawFn();

                const { height: overlayHeight, offsetY: overlayOffsetY } = CASTLE_OVERLAY_CATEGORY_MAP[tile.overlay];
                const tileTopY = y - camera.tileH / 2;
                const expectedY = tileTopY - (overlayHeight - camera.tileH) + overlayOffsetY;

                assert.strictEqual(spriteDrawCalls[0].y, expectedY,
                    `Overlay "${tile.overlay}" Y must be ${expectedY} ` +
                    `(tileTopY=${tileTopY} - (${overlayHeight} - ${camera.tileH}) + ${overlayOffsetY}), ` +
                    `got ${spriteDrawCalls[0].y}`
                );
            }),
            { numRuns: 200 }
        );
    });

    it('positioning formula holds for all 18 overlay sprites independently', () => {
        /**
         * Verify the formula for each of the 18 sprites with many camera/position combos.
         */
        fc.assert(
            fc.property(castleOverlayNameArb, positionArb, cameraArb, (overlayName, { x, y }, camera) => {
                spriteDrawCalls = [];
                const tile = { sprite: 'dummy', overlay: overlayName };
                const drawFn = resolveOverlayDraw(tile, createMockCtx(), x, y, camera);
                drawFn();

                const { height: overlayHeight, offsetY: overlayOffsetY } = CASTLE_OVERLAY_CATEGORY_MAP[overlayName];
                const tileTopY    = y - camera.tileH / 2;
                const expectedX   = x - 32;
                const expectedY   = tileTopY - (overlayHeight - camera.tileH) + overlayOffsetY;

                assert.strictEqual(spriteDrawCalls[0].x, expectedX,
                    `X: expected ${expectedX} for overlay "${overlayName}", got ${spriteDrawCalls[0].x}`);
                assert.strictEqual(spriteDrawCalls[0].y, expectedY,
                    `Y: expected ${expectedY} for overlay "${overlayName}", got ${spriteDrawCalls[0].y}`);
            }),
            { numRuns: 300 }
        );
    });

    it('taller overlays (80px gatehouse) are positioned higher than shorter overlays (48px wall) at same position', () => {
        /**
         * A taller overlay has a larger (overlayHeight - camera.tileH) term, so its Y
         * coordinate is lower (more negative / further up the screen).
         * Given the same tile position and camera, gatehouse Y < wall Y.
         */
        const fixedCamera = { tileW: 64, tileH: 32 };
        const fixedPos = { x: 320, y: 240 };

        fc.assert(
            fc.property(fc.constant(null), () => {
                // Gatehouse: height=80, offsetY=0
                spriteDrawCalls = [];
                const gatehouseTile = { sprite: 'castle-gatehouse', overlay: 'castle-gatehouse-overlay' };
                const fn1 = resolveOverlayDraw(gatehouseTile, createMockCtx(), fixedPos.x, fixedPos.y, fixedCamera);
                fn1();
                const gatehouseY = spriteDrawCalls[0].y;

                // Wall: height=48, offsetY=0
                spriteDrawCalls = [];
                const wallTile = { sprite: 'castle-wall', overlay: 'castle-wall-overlay' };
                const fn2 = resolveOverlayDraw(wallTile, createMockCtx(), fixedPos.x, fixedPos.y, fixedCamera);
                fn2();
                const wallY = spriteDrawCalls[0].y;

                assert.ok(
                    gatehouseY < wallY,
                    `Gatehouse (height=80) overlay Y=${gatehouseY} should be above wall (height=48) overlay Y=${wallY}`
                );
            }),
            { numRuns: 1 }
        );
    });
});
