/**
 * Tests for SpriteManager.loadAtlas animation-metadata fetch failure.
 *
 * Recommendation 3: Test SpriteManager.loadAtlas animation-metadata fetch failure.
 * When _pixiRenderer.loadSpriteAtlas succeeds and atlasLoaded is true, but the
 * subsequent fetch(jsonPath) for animations metadata throws, assert that:
 *   - _atlasAnimations remains {} (non-fatal)
 *   - _atlasLoaded is still true (atlas is usable without animation metadata)
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/sprites-load-atlas-fetch-failure.spec.js
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SPRITES_MODULE_PATH = path.resolve(__dirname, '../../js/game-logic/sprites.js');

function loadFreshModule() {
    delete require.cache[SPRITES_MODULE_PATH];
    return require(SPRITES_MODULE_PATH);
}

// Minimal stubs needed for sprites.js to load
global.TILE_SIZE = 32;
global.AnimationController = {
    getCurrentFrame() { return 0; },
    registerAnimatedType() {},
    reset() {},
};

describe('SpriteManager.loadAtlas: animation-metadata fetch failure (non-fatal)', () => {
    let SpriteManager;

    beforeEach(() => {
        SpriteManager = loadFreshModule();
    });

    afterEach(() => {
        delete global.fetch;
    });

    it('should keep _atlasLoaded true when fetch throws after successful atlas load', async () => {
        // Stub _pixiRenderer: loadSpriteAtlas succeeds, atlasLoaded = true
        SpriteManager._pixiRenderer = {
            loadSpriteAtlas: async () => { /* success */ },
            atlasLoaded: true,
        };

        // Stub fetch to throw (simulates network failure for animations JSON)
        global.fetch = async () => {
            throw new Error('Network error fetching animations metadata');
        };

        await SpriteManager.loadAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.equal(
            SpriteManager._atlasLoaded,
            true,
            '_atlasLoaded should remain true even when fetch throws'
        );
    });

    it('should keep _atlasAnimations as empty object when fetch throws', async () => {
        SpriteManager._pixiRenderer = {
            loadSpriteAtlas: async () => {},
            atlasLoaded: true,
        };

        global.fetch = async () => {
            throw new Error('Network error');
        };

        await SpriteManager.loadAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.deepEqual(
            SpriteManager._atlasAnimations,
            {},
            '_atlasAnimations should remain {} when fetch throws'
        );
    });

    it('should keep _atlasAnimations as empty object when fetch returns non-ok response', async () => {
        SpriteManager._pixiRenderer = {
            loadSpriteAtlas: async () => {},
            atlasLoaded: true,
        };

        // Stub fetch to return a non-ok response
        global.fetch = async () => ({
            ok: false,
            status: 404,
            json: async () => { throw new Error('Not found'); },
        });

        await SpriteManager.loadAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.equal(SpriteManager._atlasLoaded, true);
        assert.deepEqual(SpriteManager._atlasAnimations, {});
    });

    it('should keep _atlasAnimations as empty object when JSON parse throws', async () => {
        SpriteManager._pixiRenderer = {
            loadSpriteAtlas: async () => {},
            atlasLoaded: true,
        };

        // Stub fetch to return ok but json() throws
        global.fetch = async () => ({
            ok: true,
            json: async () => { throw new SyntaxError('Unexpected token'); },
        });

        await SpriteManager.loadAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.equal(SpriteManager._atlasLoaded, true);
        assert.deepEqual(SpriteManager._atlasAnimations, {});
    });

    it('should populate _atlasAnimations when fetch succeeds with animations data', async () => {
        SpriteManager._pixiRenderer = {
            loadSpriteAtlas: async () => {},
            atlasLoaded: true,
        };

        const mockAtlasData = {
            frames: {},
            animations: {
                'water-anim': ['water-anim-frame-0', 'water-anim-frame-1', 'water-anim-frame-2'],
            },
        };

        global.fetch = async () => ({
            ok: true,
            json: async () => mockAtlasData,
        });

        await SpriteManager.loadAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.equal(SpriteManager._atlasLoaded, true);
        assert.deepEqual(
            SpriteManager._atlasAnimations,
            mockAtlasData.animations,
            '_atlasAnimations should be populated from atlas JSON'
        );
    });

    it('should fall back to loadAll when atlasLoaded is false after loadSpriteAtlas', async () => {
        let loadAllCalled = false;

        SpriteManager._pixiRenderer = {
            loadSpriteAtlas: async () => {},
            atlasLoaded: false, // PixiJS fell back internally
        };

        // Stub loadAll to track if it's called
        const originalLoadAll = SpriteManager.loadAll.bind(SpriteManager);
        SpriteManager.loadAll = async () => { loadAllCalled = true; };

        await SpriteManager.loadAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.equal(
            loadAllCalled,
            true,
            'loadAll should be called when atlasLoaded is false after loadSpriteAtlas'
        );
        assert.equal(SpriteManager._atlasLoaded, false);
    });

    it('should not call fetch when atlasLoaded is false (falls back to loadAll)', async () => {
        let fetchCalled = false;

        SpriteManager._pixiRenderer = {
            loadSpriteAtlas: async () => {},
            atlasLoaded: false,
        };

        global.fetch = async () => {
            fetchCalled = true;
            return { ok: true, json: async () => ({}) };
        };

        SpriteManager.loadAll = async () => {};

        await SpriteManager.loadAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.equal(
            fetchCalled,
            false,
            'fetch should not be called when atlasLoaded is false'
        );
    });
});
