/**
 * Tests asserting the seven tree overlay sprite names are present in
 * SpriteManager.spriteList (task 2.1 of tree-overlay-system spec).
 *
 * Loads the REAL sprites.js module so the assertion reflects the actual
 * production file rather than a hardcoded replica.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/sprites-overlay.spec.js
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

// ─── Expected overlay names ───────────────────────────────────────────────────

const EXPECTED_OVERLAY_NAMES = [
    'tree-oak-overlay-1',
    'tree-oak-overlay-2',
    'tree-oak-overlay-3',
    'tree-pine-overlay-1',
    'tree-pine-overlay-2',
    'tree-shrub-overlay-1',
    'tree-shrub-overlay-2',
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SpriteManager.spriteList — tree overlay sprites (task 2.1)', () => {
    let SpriteManager;

    beforeEach(() => {
        SpriteManager = loadFreshSpriteManager();
    });

    afterEach(() => {
        delete require.cache[SPRITES_PATH];
    });

    it('should contain all seven tree overlay sprite names', () => {
        for (const name of EXPECTED_OVERLAY_NAMES) {
            assert.ok(
                SpriteManager.spriteList.includes(name),
                `spriteList is missing: ${name}`
            );
        }
    });

    it('should contain exactly 7 overlay sprite names (no extras, no duplicates)', () => {
        const overlayEntries = SpriteManager.spriteList.filter(n =>
            n.startsWith('tree-oak-overlay-') ||
            n.startsWith('tree-pine-overlay-') ||
            n.startsWith('tree-shrub-overlay-')
        );
        assert.equal(
            overlayEntries.length,
            7,
            `Expected 7 overlay entries, got ${overlayEntries.length}: ${overlayEntries.join(', ')}`
        );
    });

    it('should still contain tree-1 through tree-7 (backward compatibility)', () => {
        for (let i = 1; i <= 7; i++) {
            assert.ok(
                SpriteManager.spriteList.includes(`tree-${i}`),
                `spriteList is missing legacy tree-${i}`
            );
        }
    });

    it('should have 3 oak overlay variants', () => {
        const oak = SpriteManager.spriteList.filter(n => n.startsWith('tree-oak-overlay-'));
        assert.equal(oak.length, 3, `Expected 3 oak overlays, got ${oak.length}`);
    });

    it('should have 2 pine overlay variants', () => {
        const pine = SpriteManager.spriteList.filter(n => n.startsWith('tree-pine-overlay-'));
        assert.equal(pine.length, 2, `Expected 2 pine overlays, got ${pine.length}`);
    });

    it('should have 2 shrub overlay variants', () => {
        const shrub = SpriteManager.spriteList.filter(n => n.startsWith('tree-shrub-overlay-'));
        assert.equal(shrub.length, 2, `Expected 2 shrub overlays, got ${shrub.length}`);
    });

    it('overlay names should appear after tree-7 in the list', () => {
        const tree7Idx = SpriteManager.spriteList.indexOf('tree-7');
        assert.ok(tree7Idx >= 0, 'tree-7 must be in spriteList');
        for (const name of EXPECTED_OVERLAY_NAMES) {
            const overlayIdx = SpriteManager.spriteList.indexOf(name);
            assert.ok(
                overlayIdx > tree7Idx,
                `${name} (index ${overlayIdx}) should appear after tree-7 (index ${tree7Idx})`
            );
        }
    });

    it('spriteList should have no duplicate entries overall', () => {
        const set = new Set(SpriteManager.spriteList);
        assert.equal(
            set.size,
            SpriteManager.spriteList.length,
            'spriteList contains duplicate entries'
        );
    });

    it('overlay sprites should be loadable via loadAll() without errors', async () => {
        const loadedNames = [];
        global.loadImage = async (src) => {
            loadedNames.push(src);
            return { src };
        };
        const sm = loadFreshSpriteManager();
        await sm.loadAll();

        for (const name of EXPECTED_OVERLAY_NAMES) {
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
