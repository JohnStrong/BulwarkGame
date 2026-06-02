/**
 * Tests asserting the 18 castle overlay sprite names are present in
 * SpriteManager.spriteList, and that all existing flat castle sprite names
 * are still present (backward compatibility).
 *
 * Task 2.2 of castle-structure-overlays spec.
 * Requirements: 2.2, 7.3, 8.2
 *
 * Loads the REAL sprites.js module so the assertion reflects the actual
 * production file rather than a hardcoded replica.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/sprites-castle-overlay.spec.js
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ─── Global stubs required by sprites.js ─────────────────────────────────────

global.TILE_SIZE = 32;

global.AnimationController = {
    getCurrentFrame() { return 0; },
    registerAnimatedType() {},
    reset() {},
};

global.document = {
    createElement: (_tag) => ({
        width: 0,
        height: 0,
        getContext: () => ({
            fillStyle: '',
            font: '',
            textAlign: '',
            textBaseline: '',
            fillRect() {},
            fillText() {},
        }),
    }),
};

global.loadImage = async (src) => ({ src });

// ─── Load real module ─────────────────────────────────────────────────────────

const SPRITES_PATH = path.resolve(__dirname, '../../js/game-logic/sprites.js');

function loadFreshSpriteManager() {
    delete require.cache[SPRITES_PATH];
    return require(SPRITES_PATH);
}

// ─── Expected castle overlay sprite names (20 total) ─────────────────────────

const EXPECTED_CASTLE_OVERLAY_NAMES = [
    // Walls and bridges: 64×48 px
    'castle-wall-overlay',
    'castle-wall-damaged-overlay',
    'bridge-mm-overlay',
    'castle-bridge-start-overlay',
    'castle-bridge-mid-overlay',
    'castle-bridge-gate-overlay',
    // Towers and keeps: 64×64 px
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
    // Gatehouse: 64×80 px
    'castle-gatehouse-overlay',
    'castle-gatehouse-damaged-overlay',
    // Isometric wall face: 64×48 px — used by all castle structure tiles at runtime
    'castle-iso-wall-overlay',
    'castle-iso-wall-damaged-overlay',
];

// ─── Existing flat castle sprite names (backward compatibility) ───────────────

const EXISTING_FLAT_CASTLE_NAMES = [
    'castle-bridge-start',
    'castle-bridge-mid',
    'castle-bridge-gate',
    'castle-tower',
    'castle-keep-tl',
    'castle-keep-bl',
    'castle-keep-br',
    'castle-keep-center',
    'castle-gatehouse',
    'castle-wall',
    'castle-bailey-1',
    'castle-bailey-2',
    'castle-bailey-3',
    'castle-wall-damaged',
    'castle-tower-damaged',
    'castle-keep-tl-damaged',
    'castle-keep-bl-damaged',
    'castle-keep-br-damaged',
    'castle-keep-center-damaged',
    'castle-gatehouse-damaged',
    'castle-bailey-1-damaged',
    'castle-bailey-2-damaged',
    'castle-bailey-3-damaged',
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SpriteManager.spriteList — castle overlay sprites (task 2.2)', () => {
    let SpriteManager;

    beforeEach(() => {
        SpriteManager = loadFreshSpriteManager();
    });

    afterEach(() => {
        delete require.cache[SPRITES_PATH];
    });

    // ── All 18 castle overlay names are present ───────────────────────────────

    it('should contain all 20 castle overlay sprite names', () => {
        for (const name of EXPECTED_CASTLE_OVERLAY_NAMES) {
            assert.ok(
                SpriteManager.spriteList.includes(name),
                `spriteList is missing: ${name}`
            );
        }
    });

    it('should contain exactly 20 castle overlay sprite names (no extras, no duplicates)', () => {
        const overlayEntries = SpriteManager.spriteList.filter(n =>
            (n.startsWith('castle-') || n.startsWith('bridge-')) && n.endsWith('-overlay')
        );
        assert.equal(
            overlayEntries.length,
            20,
            `Expected 20 castle overlay entries, got ${overlayEntries.length}: ${overlayEntries.join(', ')}`
        );
    });

    // ── Overlay names by category ─────────────────────────────────────────────

    it('should contain 2 wall overlay sprites (undamaged + damaged)', () => {
        const wallOverlays = SpriteManager.spriteList.filter(n =>
            n === 'castle-wall-overlay' || n === 'castle-wall-damaged-overlay'
        );
        assert.equal(wallOverlays.length, 2, `Expected 2 wall overlays, got ${wallOverlays.length}`);
    });

    it('should contain 4 bridge overlay sprites (no damaged variants)', () => {
        const bridgeOverlays = SpriteManager.spriteList.filter(n =>
            n === 'bridge-mm-overlay' ||
            n === 'castle-bridge-start-overlay' ||
            n === 'castle-bridge-mid-overlay' ||
            n === 'castle-bridge-gate-overlay'
        );
        assert.equal(bridgeOverlays.length, 4, `Expected 4 bridge overlays, got ${bridgeOverlays.length}`);
    });

    it('should contain 2 tower overlay sprites (undamaged + damaged)', () => {
        const towerOverlays = SpriteManager.spriteList.filter(n =>
            n === 'castle-tower-overlay' || n === 'castle-tower-damaged-overlay'
        );
        assert.equal(towerOverlays.length, 2, `Expected 2 tower overlays, got ${towerOverlays.length}`);
    });

    it('should contain 8 keep overlay sprites (4 quadrants × 2 variants)', () => {
        const keepOverlays = SpriteManager.spriteList.filter(n =>
            n.startsWith('castle-keep-') && n.endsWith('-overlay')
        );
        assert.equal(keepOverlays.length, 8, `Expected 8 keep overlays, got ${keepOverlays.length}`);
    });

    it('should contain 2 gatehouse overlay sprites (undamaged + damaged)', () => {
        const gatehouseOverlays = SpriteManager.spriteList.filter(n =>
            n === 'castle-gatehouse-overlay' || n === 'castle-gatehouse-damaged-overlay'
        );
        assert.equal(gatehouseOverlays.length, 2, `Expected 2 gatehouse overlays, got ${gatehouseOverlays.length}`);
    });

    // ── Backward compatibility: existing flat castle sprites still present ────

    it('should still contain all existing flat castle sprite names (Req 8.2)', () => {
        for (const name of EXISTING_FLAT_CASTLE_NAMES) {
            assert.ok(
                SpriteManager.spriteList.includes(name),
                `spriteList is missing existing flat castle sprite: ${name}`
            );
        }
    });

    it('should still contain bridge-mm (flat ground sprite)', () => {
        assert.ok(
            SpriteManager.spriteList.includes('bridge-mm'),
            'spriteList is missing legacy bridge-mm'
        );
    });

    // ── No duplicates overall ─────────────────────────────────────────────────

    it('spriteList should have no duplicate entries overall', () => {
        const set = new Set(SpriteManager.spriteList);
        assert.equal(
            set.size,
            SpriteManager.spriteList.length,
            'spriteList contains duplicate entries'
        );
    });

    // ── Castle overlay sprites are loadable via loadAll() ─────────────────────

    it('castle overlay sprites should be loadable via loadAll() without errors', async () => {
        const loadedNames = [];
        global.loadImage = async (src) => {
            loadedNames.push(src);
            return { src };
        };
        const sm = loadFreshSpriteManager();
        await sm.loadAll();

        for (const name of EXPECTED_CASTLE_OVERLAY_NAMES) {
            const expectedSrc = `assets/sprites/${name}.png`;
            assert.ok(
                loadedNames.includes(expectedSrc),
                `loadAll() did not attempt to load ${expectedSrc}`
            );
        }

        // Restore
        global.loadImage = async (src) => ({ src });
    });
});
