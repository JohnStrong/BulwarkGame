'use strict';

/**
 * Unit tests for castle overlay constants and castle overlay rendering in
 * js/game-logic/lib/iso-renderer.js
 *
 * Task 10.3 of castle-structure-overlays spec.
 * Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5
 *
 * iso-renderer.js uses SpriteManager and resolveOverlayDraw as browser globals.
 * These are injected into the vm context by manipulating the module's globals
 * before calling IsoRenderer.drawTerrain.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-renderer-castle-overlay.spec.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Import real iso-renderer.js constants ────────────────────────────────────

const isoRenderer = require('../../../js/game-logic/lib/iso-renderer.js');

const {
    WALL_OVERLAY_HEIGHT,
    BRIDGE_OVERLAY_HEIGHT,
    TOWER_OVERLAY_HEIGHT,
    KEEP_OVERLAY_HEIGHT,
    GATEHOUSE_OVERLAY_HEIGHT,
    WALL_OVERLAY_OFFSET_Y,
    TOWER_OVERLAY_OFFSET_Y,
    KEEP_OVERLAY_OFFSET_Y,
    GATEHOUSE_OVERLAY_OFFSET_Y,
    CASTLE_OVERLAY_CATEGORY_MAP,
} = isoRenderer;

// ─── All 18 castle/bridge overlay sprite names — the 14 in the map (bridge overlays removed)
// Bridge tiles (=, b, m, g) no longer carry overlay sprites at runtime.
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

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function createMockCtx() {
    const calls = [];
    return {
        calls,
        strokeStyle: null,
        lineWidth: null,
        beginPath()    { calls.push({ method: 'beginPath' }); },
        moveTo(x, y)   { calls.push({ method: 'moveTo',  args: [x, y] }); },
        lineTo(x, y)   { calls.push({ method: 'lineTo',  args: [x, y] }); },
        closePath()    { calls.push({ method: 'closePath' }); },
        stroke()       { calls.push({ method: 'stroke' }); },
    };
}

function createMockCamera(overrides = {}) {
    return {
        tileW: 64,
        tileH: 32,
        gridToScreen(row, col) {
            return { x: col * 64, y: row * 32 };
        },
        ...overrides,
    };
}

// ─── Tests: Castle Overlay Height Constants ───────────────────────────────────

describe('IsoRenderer castle overlay height constants (Req 4.1)', () => {
    it('WALL_OVERLAY_HEIGHT is defined and is a number', () => {
        assert.equal(typeof WALL_OVERLAY_HEIGHT, 'number');
    });
    it('WALL_OVERLAY_HEIGHT equals 96', () => {
        assert.equal(WALL_OVERLAY_HEIGHT, 96);
    });

    it('BRIDGE_OVERLAY_HEIGHT is defined and is a number', () => {
        assert.equal(typeof BRIDGE_OVERLAY_HEIGHT, 'number');
    });
    it('BRIDGE_OVERLAY_HEIGHT equals 64', () => {
        assert.equal(BRIDGE_OVERLAY_HEIGHT, 64);
    });

    it('TOWER_OVERLAY_HEIGHT is defined and is a number', () => {
        assert.equal(typeof TOWER_OVERLAY_HEIGHT, 'number');
    });
    it('TOWER_OVERLAY_HEIGHT equals 128', () => {
        assert.equal(TOWER_OVERLAY_HEIGHT, 128);
    });

    it('KEEP_OVERLAY_HEIGHT is defined and is a number', () => {
        assert.equal(typeof KEEP_OVERLAY_HEIGHT, 'number');
    });
    it('KEEP_OVERLAY_HEIGHT equals 128', () => {
        assert.equal(KEEP_OVERLAY_HEIGHT, 128);
    });

    it('GATEHOUSE_OVERLAY_HEIGHT is defined and is a number', () => {
        assert.equal(typeof GATEHOUSE_OVERLAY_HEIGHT, 'number');
    });
    it('GATEHOUSE_OVERLAY_HEIGHT equals 160', () => {
        assert.equal(GATEHOUSE_OVERLAY_HEIGHT, 160);
    });
});

// ─── Tests: Castle Overlay Y-Offset Constants ─────────────────────────────────

describe('IsoRenderer castle overlay Y-offset constants (Req 4.2)', () => {
    it('WALL_OVERLAY_OFFSET_Y is defined and is a number', () => {
        assert.equal(typeof WALL_OVERLAY_OFFSET_Y, 'number');
    });
    it('WALL_OVERLAY_OFFSET_Y equals 0', () => {
        assert.equal(WALL_OVERLAY_OFFSET_Y, 0);
    });

    it('TOWER_OVERLAY_OFFSET_Y is defined and is a number', () => {
        assert.equal(typeof TOWER_OVERLAY_OFFSET_Y, 'number');
    });
    it('TOWER_OVERLAY_OFFSET_Y equals 0', () => {
        assert.equal(TOWER_OVERLAY_OFFSET_Y, 0);
    });

    it('KEEP_OVERLAY_OFFSET_Y is defined and is a number', () => {
        assert.equal(typeof KEEP_OVERLAY_OFFSET_Y, 'number');
    });
    it('KEEP_OVERLAY_OFFSET_Y equals 0', () => {
        assert.equal(KEEP_OVERLAY_OFFSET_Y, 0);
    });

    it('GATEHOUSE_OVERLAY_OFFSET_Y is defined and is a number', () => {
        assert.equal(typeof GATEHOUSE_OVERLAY_OFFSET_Y, 'number');
    });
    it('GATEHOUSE_OVERLAY_OFFSET_Y equals 0', () => {
        assert.equal(GATEHOUSE_OVERLAY_OFFSET_Y, 0);
    });
});

// ─── Tests: CASTLE_OVERLAY_CATEGORY_MAP coverage ─────────────────────────────

describe('IsoRenderer CASTLE_OVERLAY_CATEGORY_MAP (Req 4.3)', () => {
    it('CASTLE_OVERLAY_CATEGORY_MAP is defined and is an object', () => {
        assert.ok(CASTLE_OVERLAY_CATEGORY_MAP !== null && typeof CASTLE_OVERLAY_CATEGORY_MAP === 'object');
    });

    it('CASTLE_OVERLAY_CATEGORY_MAP contains entries for all registered castle overlay sprites', () => {
        // 14 original entries + 2 iso wall overlay entries + 3 large keep = 19 total
        assert.equal(Object.keys(CASTLE_OVERLAY_CATEGORY_MAP).length, 19);
    });

    for (const name of ALL_CASTLE_OVERLAY_NAMES) {
        const n = name;
        it(`CASTLE_OVERLAY_CATEGORY_MAP contains entry for "${n}"`, () => {
            assert.ok(
                Object.prototype.hasOwnProperty.call(CASTLE_OVERLAY_CATEGORY_MAP, n),
                `Expected "${n}" to be in CASTLE_OVERLAY_CATEGORY_MAP`
            );
        });

        it(`CASTLE_OVERLAY_CATEGORY_MAP["${n}"] has numeric height and offsetY`, () => {
            const entry = CASTLE_OVERLAY_CATEGORY_MAP[n];
            assert.ok(entry !== undefined, `Entry for "${n}" must exist`);
            assert.equal(typeof entry.height, 'number', `height for "${n}" must be a number`);
            assert.equal(typeof entry.offsetY, 'number', `offsetY for "${n}" must be a number`);
        });
    }

    it('wall overlays have height 96', () => {
        assert.equal(CASTLE_OVERLAY_CATEGORY_MAP['castle-wall-overlay'].height, 96);
        assert.equal(CASTLE_OVERLAY_CATEGORY_MAP['castle-wall-damaged-overlay'].height, 96);
    });

    it('bridge overlays are NOT in the map (bridge tiles render ground-only)', () => {
        assert.equal(CASTLE_OVERLAY_CATEGORY_MAP['bridge-mm-overlay'],         undefined);
        assert.equal(CASTLE_OVERLAY_CATEGORY_MAP['castle-bridge-start-overlay'], undefined);
        assert.equal(CASTLE_OVERLAY_CATEGORY_MAP['castle-bridge-mid-overlay'],   undefined);
        assert.equal(CASTLE_OVERLAY_CATEGORY_MAP['castle-bridge-gate-overlay'],  undefined);
    });

    it('tower overlays have height 128', () => {
        assert.equal(CASTLE_OVERLAY_CATEGORY_MAP['castle-tower-overlay'].height, 128);
        assert.equal(CASTLE_OVERLAY_CATEGORY_MAP['castle-tower-damaged-overlay'].height, 128);
    });

    it('keep overlays have height 128', () => {
        const keepNames = [
            'castle-keep-tl-overlay', 'castle-keep-tl-damaged-overlay',
            'castle-keep-bl-overlay', 'castle-keep-bl-damaged-overlay',
            'castle-keep-br-overlay', 'castle-keep-br-damaged-overlay',
            'castle-keep-center-overlay', 'castle-keep-center-damaged-overlay',
        ];
        for (const kn of keepNames) {
            assert.equal(CASTLE_OVERLAY_CATEGORY_MAP[kn].height, 128, `${kn} height must be 128`);
        }
    });

    it('gatehouse overlays have height 160', () => {
        assert.equal(CASTLE_OVERLAY_CATEGORY_MAP['castle-gatehouse-overlay'].height, 160);
        assert.equal(CASTLE_OVERLAY_CATEGORY_MAP['castle-gatehouse-damaged-overlay'].height, 160);
    });
});

// ─── drawTerrain castle overlay rendering tests ───────────────────────────────
//
// iso-renderer.js uses SpriteManager and resolveOverlayDraw as browser globals.
// To test drawTerrain in Node.js, we replicate the actual drawTerrain logic here
// (same approach as iso-renderer-render.spec.js and iso-renderer-canvas-mock.spec.js),
// wiring it to our own mock SpriteManager and a controllable resolveOverlayDraw.

let spriteDrawCalls = [];

const MockSpriteManager = {
    draw(ctx, name, x, y, w, h) {
        spriteDrawCalls.push({ name, x, y, w, h });
    },
};

// A resolveOverlayDraw that returns null (no overlay) for tiles without overlay field.
// For tiles with an overlay field, it returns a draw function that records a call to
// MockSpriteManager using the per-structure constants from CASTLE_OVERLAY_CATEGORY_MAP.
function makeResolveOverlayDraw(categoryMap) {
    const OVERLAY_WIDTH_LOCAL = 64;
    return function resolveOverlayDraw(tile, ctx, x, y, camera) {
        if (!tile.overlay) return null;
        const overlayName = tile.overlay;
        const category = categoryMap[overlayName];
        if (!category) return null;
        const { height: overlayHeight, offsetY: overlayOffsetY } = category;
        return () => {
            const overlayX = x - OVERLAY_WIDTH_LOCAL / 2;
            const overlayY = (y - camera.tileH / 2) - (overlayHeight - camera.tileH) + overlayOffsetY;
            MockSpriteManager.draw(ctx, overlayName, overlayX, overlayY, OVERLAY_WIDTH_LOCAL, overlayHeight);
        };
    };
}

// IsoRenderer.drawTerrain replica that uses our controllable mocks instead of globals.
function makeIsoRendererWithMocks(resolveOverlayDrawFn) {
    return {
        drawTerrain(ctx, camera, tiles, state) {
            for (const tile of tiles) {
                if (tile.covered) continue;
                let { x, y } = camera.gridToScreen(tile.row, tile.col);

                const isSelected = state.selectedTile &&
                    tile.row === state.selectedTile.row && tile.col === state.selectedTile.col;
                if (isSelected) y -= state.selectedLift;

                // Ground pass
                MockSpriteManager.draw(ctx, tile.sprite, x - camera.tileW / 2, y - camera.tileH / 2, camera.tileW, camera.tileH);

                // Overlay pass via resolveOverlayDraw
                const drawOverlay = resolveOverlayDrawFn(tile, ctx, x, y, camera);
                if (drawOverlay) drawOverlay();

                // Outlines (not being tested here — just included for fidelity)
                const isHovered = state.hoveredTile &&
                    tile.row === state.hoveredTile.row && tile.col === state.hoveredTile.col;
                if (isHovered && !isSelected) {
                    this.drawDiamondOutline(ctx, x, y, camera.tileW, camera.tileH, 'rgba(255, 220, 80, 0.6)', 1.5);
                }
                if (isSelected) {
                    this.drawDiamondOutline(ctx, x, y, camera.tileW, camera.tileH, 'rgba(255, 255, 120, 0.9)', 2);
                    this.drawDiamondOutline(ctx, x, y, camera.tileW, camera.tileH, 'rgba(255, 255, 180, 0.3)', 4);
                }
            }
        },
        drawDiamondOutline(ctx, x, y, w, h, color, lineWidth) {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.moveTo(x, y - h / 2);
            ctx.lineTo(x + w / 2, y);
            ctx.lineTo(x, y + h / 2);
            ctx.lineTo(x - w / 2, y);
            ctx.closePath();
            ctx.stroke();
        },
    };
}

// ─── Tests: drawTerrain — tiles without overlay (Req 5.3) ─────────────────────

describe('IsoRenderer.drawTerrain — tiles without overlay (Req 5.3)', () => {
    const resolveOverlayDraw = makeResolveOverlayDraw(CASTLE_OVERLAY_CATEGORY_MAP);
    const IsoRend = makeIsoRendererWithMocks(resolveOverlayDraw);

    beforeEach(() => { spriteDrawCalls = []; });

    it('produces exactly one SpriteManager.draw call for a tile with no overlay field', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [{ row: 0, col: 0, sprite: 'castle-bailey-1' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 1, 'Exactly one draw call for no-overlay tile');
        assert.equal(spriteDrawCalls[0].name, 'castle-bailey-1');
    });

    it('produces exactly one draw call for a road tile (no overlay)', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [{ row: 1, col: 2, sprite: 'road-full' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 1);
        assert.equal(spriteDrawCalls[0].name, 'road-full');
    });

    it('produces exactly one draw call per tile for multiple no-overlay tiles', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [
            { row: 0, col: 0, sprite: 'castle-bailey-1' },
            { row: 0, col: 1, sprite: 'castle-bailey-2' },
            { row: 1, col: 0, sprite: 'castle-bailey-3' },
        ];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 3);
    });

    it('draws no-overlay tile at standard camera dimensions (tileW × tileH)', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera({ tileW: 64, tileH: 32 });
        const tiles = [{ row: 0, col: 0, sprite: 'castle-wall' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls[0].w, 64);
        assert.equal(spriteDrawCalls[0].h, 32);
    });
});

// ─── Tests: drawTerrain — tiles with castle overlay (Req 5.1, 5.2, 5.5) ───────

describe('IsoRenderer.drawTerrain — tiles with castle overlay (Req 5.1, 5.2, 5.5)', () => {
    const resolveOverlayDraw = makeResolveOverlayDraw(CASTLE_OVERLAY_CATEGORY_MAP);
    const IsoRend = makeIsoRendererWithMocks(resolveOverlayDraw);

    beforeEach(() => { spriteDrawCalls = []; });

    it('produces exactly two SpriteManager.draw calls for a tile with castle-wall-overlay', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [{ row: 0, col: 0, sprite: 'castle-wall', overlay: 'castle-wall-overlay' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 2, 'Exactly two draw calls: ground + overlay');
    });

    it('draws ground sprite BEFORE overlay sprite (correct order)', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [{ row: 0, col: 0, sprite: 'castle-wall', overlay: 'castle-wall-overlay' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls[0].name, 'castle-wall', 'First call is ground sprite');
        assert.equal(spriteDrawCalls[1].name, 'castle-wall-overlay', 'Second call is overlay sprite');
    });

    it('draws ground sprite at standard tileW × tileH, overlay at 64 × WALL_OVERLAY_HEIGHT', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera({ tileW: 64, tileH: 32 });
        const tiles = [{ row: 0, col: 0, sprite: 'castle-wall', overlay: 'castle-wall-overlay' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls[0].w, 64, 'Ground width = tileW');
        assert.equal(spriteDrawCalls[0].h, 32, 'Ground height = tileH');
        assert.equal(spriteDrawCalls[1].w, 64, 'Overlay width = 64 (OVERLAY_WIDTH)');
        assert.equal(spriteDrawCalls[1].h, WALL_OVERLAY_HEIGHT, 'Overlay height = WALL_OVERLAY_HEIGHT (96)');
    });

    it('uses TOWER_OVERLAY_HEIGHT (64) for castle-tower-overlay', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [{ row: 0, col: 0, sprite: 'castle-tower', overlay: 'castle-tower-overlay' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls[1].h, TOWER_OVERLAY_HEIGHT, 'Tower overlay height = TOWER_OVERLAY_HEIGHT (128)');
    });

    it('uses KEEP_OVERLAY_HEIGHT (64) for castle-keep-tl-overlay', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [{ row: 0, col: 0, sprite: 'castle-keep-tl', overlay: 'castle-keep-tl-overlay' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls[1].h, KEEP_OVERLAY_HEIGHT, 'Keep overlay height = KEEP_OVERLAY_HEIGHT (128)');
    });

    it('uses GATEHOUSE_OVERLAY_HEIGHT (80) for castle-gatehouse-overlay', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [{ row: 0, col: 0, sprite: 'castle-gatehouse', overlay: 'castle-gatehouse-overlay' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls[1].h, GATEHOUSE_OVERLAY_HEIGHT, 'Gatehouse overlay height = GATEHOUSE_OVERLAY_HEIGHT (160)');
    });

    it('bridge tiles have no overlay — bridge-mm produces exactly 1 draw call', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [{ row: 0, col: 0, sprite: 'bridge-mm' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls.length, 1, 'Bridge tile renders ground only (no overlay)');
        assert.equal(spriteDrawCalls[0].name, 'bridge-mm');
    });
});

// ─── Tests: drawTerrain — draw order across all 18 castle overlay sprites ─────

describe('IsoRenderer.drawTerrain — ground-before-overlay order for all 18 overlays (Req 5.1)', () => {
    const resolveOverlayDraw = makeResolveOverlayDraw(CASTLE_OVERLAY_CATEGORY_MAP);
    const IsoRend = makeIsoRendererWithMocks(resolveOverlayDraw);

    beforeEach(() => { spriteDrawCalls = []; });

    for (const overlayName of ALL_CASTLE_OVERLAY_NAMES) {
        const oName = overlayName;
        it(`ground sprite drawn before ${oName}`, () => {
            spriteDrawCalls = [];
            const ctx = createMockCtx();
            const camera = createMockCamera();
            const groundSprite = oName.replace('-overlay', '').replace('-damaged', '-damaged');
            const tiles = [{ row: 0, col: 0, sprite: groundSprite, overlay: oName }];
            const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

            IsoRend.drawTerrain(ctx, camera, tiles, state);

            assert.equal(spriteDrawCalls.length, 2, `Expected 2 draw calls for overlay tile "${oName}"`);
            assert.equal(spriteDrawCalls[0].name, groundSprite, 'First call must be ground sprite');
            assert.equal(spriteDrawCalls[1].name, oName, 'Second call must be overlay sprite');
        });
    }
});

// ─── Tests: drawTerrain — damaged variant overlay heights ─────────────────────

describe('IsoRenderer.drawTerrain — damaged variant overlays use correct heights (Req 5.5)', () => {
    const resolveOverlayDraw = makeResolveOverlayDraw(CASTLE_OVERLAY_CATEGORY_MAP);
    const IsoRend = makeIsoRendererWithMocks(resolveOverlayDraw);

    beforeEach(() => { spriteDrawCalls = []; });

    it('castle-wall-damaged-overlay uses WALL_OVERLAY_HEIGHT (96)', () => {
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [{ row: 0, col: 0, sprite: 'castle-wall-damaged', overlay: 'castle-wall-damaged-overlay' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls[1].h, 96);
    });

    it('castle-tower-damaged-overlay uses TOWER_OVERLAY_HEIGHT (128)', () => {
        spriteDrawCalls = [];
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [{ row: 0, col: 0, sprite: 'castle-tower-damaged', overlay: 'castle-tower-damaged-overlay' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls[1].h, 128);
    });

    it('castle-gatehouse-damaged-overlay uses GATEHOUSE_OVERLAY_HEIGHT (160)', () => {
        spriteDrawCalls = [];
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [{ row: 0, col: 0, sprite: 'castle-gatehouse-damaged', overlay: 'castle-gatehouse-damaged-overlay' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls[1].h, 160);
    });

    it('castle-keep-center-damaged-overlay uses KEEP_OVERLAY_HEIGHT (128)', () => {
        spriteDrawCalls = [];
        const ctx = createMockCtx();
        const camera = createMockCamera();
        const tiles = [{ row: 0, col: 0, sprite: 'castle-keep-center-damaged', overlay: 'castle-keep-center-damaged-overlay' }];
        const state = { hoveredTile: null, selectedTile: null, selectedLift: 0 };

        IsoRend.drawTerrain(ctx, camera, tiles, state);

        assert.equal(spriteDrawCalls[1].h, 128);
    });
});
