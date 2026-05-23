/**
 * Integration tests for SpriteManager._resolveAnimatedFrame()
 *
 * Recommendation 9: Test _resolveAnimatedFrame() with the REAL sprites.js
 * module and the REAL AnimationController.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/sprites-animated-frame.spec.js
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ─── Load real modules ────────────────────────────────────────────────────────

const AnimationController = require('../../js/game-logic/animation-controller.js');

const SPRITES_MODULE_PATH = path.resolve(__dirname, '../../js/game-logic/sprites.js');

/**
 * Clears the require cache for sprites.js and returns a fresh SpriteManager.
 * Must be called AFTER all globals are set up.
 */
function loadFreshSpriteManager() {
    delete require.cache[SPRITES_MODULE_PATH];
    return require(SPRITES_MODULE_PATH);
}

// ─── Shared global stubs ──────────────────────────────────────────────────────

// sprites.js uses TILE_SIZE as a global
global.TILE_SIZE = 32;

// sprites.js uses loadImage as a global (used by loadAll)
global.loadImage = async (src) => ({ src });

// sprites.js uses document.createElement for createFallback
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

// sprites.js references AnimationController as a global
global.AnimationController = AnimationController;

// ─── Suite 1: _resolveAnimatedFrame with atlas loaded ────────────────────────

describe('SpriteManager._resolveAnimatedFrame() — atlas loaded, animation registered', () => {
    let SpriteManager;

    beforeEach(() => {
        AnimationController.reset();

        SpriteManager = loadFreshSpriteManager();

        // Simulate a successfully loaded atlas with water animation
        SpriteManager._atlasLoaded = true;
        SpriteManager._atlasAnimations = {
            'water-anim': ['water-frame-0', 'water-frame-1', 'water-frame-2'],
        };

        // Register the animation — starts at frame 0
        AnimationController.registerAnimatedType('water-anim', 3, 500);
    });

    afterEach(() => {
        AnimationController.reset();
    });

    it('should return the current frame name for water-1 (frame 0 at start)', () => {
        // AnimationController starts at frame 0
        const frame = AnimationController.getCurrentFrame('water-anim');
        assert.equal(frame, 0, 'AnimationController should start at frame 0');

        const resolved = SpriteManager._resolveAnimatedFrame('water-1');
        assert.equal(
            resolved,
            'water-frame-0',
            '_resolveAnimatedFrame("water-1") should return "water-frame-0" at frame 0'
        );
    });

    it('should return the same current frame for water-2 (same animation type)', () => {
        // water-2 also starts with 'water-' so it matches 'water-anim'
        const resolved = SpriteManager._resolveAnimatedFrame('water-2');
        assert.equal(
            resolved,
            'water-frame-0',
            '_resolveAnimatedFrame("water-2") should resolve to the same current frame'
        );
    });

    it('should return the same current frame for water-3', () => {
        const resolved = SpriteManager._resolveAnimatedFrame('water-3');
        assert.equal(resolved, 'water-frame-0');
    });

    it('should return original name for grass-short-1 (no animation match)', () => {
        const resolved = SpriteManager._resolveAnimatedFrame('grass-short-1');
        assert.equal(
            resolved,
            'grass-short-1',
            'Non-animated sprites should be returned unchanged'
        );
    });

    it('should return original name for road-full (no animation match)', () => {
        const resolved = SpriteManager._resolveAnimatedFrame('road-full');
        assert.equal(resolved, 'road-full');
    });

    it('should return original name for castle-wall (no animation match)', () => {
        const resolved = SpriteManager._resolveAnimatedFrame('castle-wall');
        assert.equal(resolved, 'castle-wall');
    });

    it('should return original name for tree-1 (no animation match)', () => {
        const resolved = SpriteManager._resolveAnimatedFrame('tree-1');
        assert.equal(resolved, 'tree-1');
    });
});

// ─── Suite 2: _resolveAnimatedFrame with multiple animation types ─────────────

describe('SpriteManager._resolveAnimatedFrame() — multiple animation types', () => {
    let SpriteManager;

    beforeEach(() => {
        AnimationController.reset();

        SpriteManager = loadFreshSpriteManager();

        SpriteManager._atlasLoaded = true;
        SpriteManager._atlasAnimations = {
            'water-anim': ['water-frame-0', 'water-frame-1', 'water-frame-2'],
            'flag-anim':  ['flag-frame-0', 'flag-frame-1'],
        };

        AnimationController.registerAnimatedType('water-anim', 3, 500);
        AnimationController.registerAnimatedType('flag-anim', 2, 300);
    });

    afterEach(() => {
        AnimationController.reset();
    });

    it('should resolve water sprites to water animation frames', () => {
        const resolved = SpriteManager._resolveAnimatedFrame('water-1');
        assert.equal(resolved, 'water-frame-0');
    });

    it('should resolve flag sprites to flag animation frames', () => {
        const resolved = SpriteManager._resolveAnimatedFrame('flag-1');
        assert.equal(resolved, 'flag-frame-0');
    });

    it('should not cross-match animation types', () => {
        // 'water-1' should not resolve to a flag frame
        const resolved = SpriteManager._resolveAnimatedFrame('water-1');
        assert.ok(
            resolved.startsWith('water-'),
            `'water-1' should resolve to a water frame, got '${resolved}'`
        );
    });
});

// ─── Suite 3: _resolveAnimatedFrame when atlas is NOT loaded ─────────────────

describe('SpriteManager._resolveAnimatedFrame() — atlas not loaded', () => {
    let SpriteManager;

    beforeEach(() => {
        AnimationController.reset();

        SpriteManager = loadFreshSpriteManager();

        // Atlas is NOT loaded
        SpriteManager._atlasLoaded = false;
        SpriteManager._atlasAnimations = {
            'water-anim': ['water-frame-0', 'water-frame-1', 'water-frame-2'],
        };

        AnimationController.registerAnimatedType('water-anim', 3, 500);
    });

    afterEach(() => {
        AnimationController.reset();
    });

    it('should return original name unchanged when atlas is not loaded', () => {
        const resolved = SpriteManager._resolveAnimatedFrame('water-1');
        assert.equal(
            resolved,
            'water-1',
            'When atlas is not loaded, name should be returned unchanged'
        );
    });

    it('should return original name for any sprite when atlas is not loaded', () => {
        const names = ['water-1', 'grass-short-1', 'road-full', 'castle-wall'];
        for (const name of names) {
            const resolved = SpriteManager._resolveAnimatedFrame(name);
            assert.equal(resolved, name, `'${name}' should be unchanged when atlas not loaded`);
        }
    });
});

// ─── Suite 4: _resolveAnimatedFrame when AnimationController is undefined ────

describe('SpriteManager._resolveAnimatedFrame() — AnimationController unavailable', () => {
    let SpriteManager;
    let savedAnimationController;

    beforeEach(() => {
        AnimationController.reset();

        // Remove AnimationController from global scope
        savedAnimationController = global.AnimationController;
        delete global.AnimationController;

        SpriteManager = loadFreshSpriteManager();

        SpriteManager._atlasLoaded = true;
        SpriteManager._atlasAnimations = {
            'water-anim': ['water-frame-0', 'water-frame-1', 'water-frame-2'],
        };
    });

    afterEach(() => {
        // Restore AnimationController
        global.AnimationController = savedAnimationController;
        AnimationController.reset();
    });

    it('should return original name when AnimationController is undefined', () => {
        const resolved = SpriteManager._resolveAnimatedFrame('water-1');
        assert.equal(
            resolved,
            'water-1',
            'Should return original name when AnimationController is not available'
        );
    });

    it('should return original name for any sprite when AnimationController is undefined', () => {
        const names = ['water-1', 'water-2', 'grass-short-1'];
        for (const name of names) {
            const resolved = SpriteManager._resolveAnimatedFrame(name);
            assert.equal(resolved, name, `'${name}' should be unchanged without AnimationController`);
        }
    });
});

// ─── Suite 5: _resolveAnimatedFrame with empty or missing frames array ────────

describe('SpriteManager._resolveAnimatedFrame() — edge cases in animation data', () => {
    let SpriteManager;

    beforeEach(() => {
        AnimationController.reset();

        SpriteManager = loadFreshSpriteManager();
        SpriteManager._atlasLoaded = true;
    });

    afterEach(() => {
        AnimationController.reset();
    });

    it('should return original name when frames array is empty', () => {
        SpriteManager._atlasAnimations = {
            'water-anim': [], // empty frames
        };
        AnimationController.registerAnimatedType('water-anim', 3, 500);

        const resolved = SpriteManager._resolveAnimatedFrame('water-1');
        assert.equal(resolved, 'water-1', 'Empty frames array should not cause resolution');
    });

    it('should return original name when _atlasAnimations is empty', () => {
        SpriteManager._atlasAnimations = {};

        const resolved = SpriteManager._resolveAnimatedFrame('water-1');
        assert.equal(resolved, 'water-1', 'No animations registered should return original name');
    });

    it('should handle sprite name that exactly matches animation base', () => {
        SpriteManager._atlasAnimations = {
            'water-anim': ['water-frame-0', 'water-frame-1'],
        };
        AnimationController.registerAnimatedType('water-anim', 2, 500);

        // 'water' exactly matches the animBase ('water-anim' → 'water')
        const resolved = SpriteManager._resolveAnimatedFrame('water');
        assert.equal(resolved, 'water-frame-0', '"water" should match "water-anim" base');
    });
});

// ─── Suite 6: Integration — draw() uses _resolveAnimatedFrame ────────────────

describe('SpriteManager.draw() — uses _resolveAnimatedFrame for animated sprites', () => {
    let SpriteManager;

    beforeEach(() => {
        AnimationController.reset();

        SpriteManager = loadFreshSpriteManager();

        SpriteManager._atlasLoaded = false; // Use Canvas 2D path
        SpriteManager._atlasAnimations = {
            'water-anim': ['water-frame-0', 'water-frame-1', 'water-frame-2'],
        };

        AnimationController.registerAnimatedType('water-anim', 3, 500);
    });

    afterEach(() => {
        AnimationController.reset();
    });

    it('should draw the resolved frame image when atlas is loaded', () => {
        // Enable atlas path
        SpriteManager._atlasLoaded = true;

        // Pre-load the resolved frame name into images
        const fakeFrameImg = { src: 'water-frame-0.png' };
        SpriteManager.images['water-frame-0'] = fakeFrameImg;

        let drawnImg = null;
        const mockCtx = {
            drawImage(img) { drawnImg = img; },
        };

        SpriteManager.draw(mockCtx, 'water-1', 0, 0, 32, 32);

        assert.equal(
            drawnImg,
            fakeFrameImg,
            'draw() should use the resolved frame image'
        );
    });

    it('should fall back to original name image when resolved frame is not in images', () => {
        SpriteManager._atlasLoaded = true;

        // Only the original name is in images, not the resolved frame
        const fakeImg = { src: 'water-1.png' };
        SpriteManager.images['water-1'] = fakeImg;
        // 'water-frame-0' is NOT in images

        let drawnImg = null;
        const mockCtx = {
            drawImage(img) { drawnImg = img; },
        };

        SpriteManager.draw(mockCtx, 'water-1', 0, 0, 32, 32);

        assert.equal(
            drawnImg,
            fakeImg,
            'draw() should fall back to original name image when resolved frame is missing'
        );
    });
});
