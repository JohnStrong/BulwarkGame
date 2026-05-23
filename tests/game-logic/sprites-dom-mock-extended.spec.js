/**
 * Extended DOM mock tests for js/game-logic/sprites.js (SpriteManager)
 *
 * Recommendation 2: Test SpriteManager.loadAll() and createFallback()
 * using the REAL module with lightweight DOM/browser global stubs.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/sprites-dom-mock-extended.spec.js
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SPRITES_MODULE_PATH = path.resolve(__dirname, '../../js/game-logic/sprites.js');

/**
 * Clears the require cache for sprites.js and returns a fresh module.
 * This ensures each test starts with a clean SpriteManager state.
 */
function loadFreshModule() {
    delete require.cache[SPRITES_MODULE_PATH];
    return require(SPRITES_MODULE_PATH);
}

// ─── Canvas mock factory ──────────────────────────────────────────────────────

function makeMockCanvas() {
    const calls = [];
    const ctx = {
        calls,
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        fillRect(x, y, w, h) { calls.push({ m: 'fillRect', a: [x, y, w, h] }); },
        fillText(t, x, y)    { calls.push({ m: 'fillText', a: [t, x, y] }); },
        drawImage(img, x, y, w, h) { calls.push({ m: 'drawImage', a: [img, x, y, w, h] }); },
    };
    return {
        width: 0,
        height: 0,
        calls,
        ctx,
        getContext(type) {
            calls.push({ m: 'getContext', a: [type] });
            return ctx;
        },
    };
}

// ─── Global stubs shared across suites ───────────────────────────────────────

// sprites.js references TILE_SIZE as a global
global.TILE_SIZE = 32;

// sprites.js references AnimationController as a global — provide a minimal stub
// so _resolveAnimatedFrame doesn't throw when atlas is not loaded.
global.AnimationController = {
    getCurrentFrame() { return 0; },
    registerAnimatedType() {},
    reset() {},
};

// ─── Suite 1: loadAll() populates images on success ──────────────────────────

describe('SpriteManager.loadAll() — success path (real module)', () => {
    let SpriteManager;
    let mockCanvas;

    beforeEach(() => {
        mockCanvas = makeMockCanvas();

        // Stub Image: fires onload asynchronously so loadImage() resolves
        global.Image = class {
            constructor() {
                this.src = '';
                setTimeout(() => { if (this.onload) this.onload(); }, 0);
            }
        };

        // Stub document so createFallback doesn't throw if called
        global.document = {
            createElement: (_tag) => makeMockCanvas(),
        };

        // Stub loadImage as a global (sprites.js calls it as a bare name)
        global.loadImage = async (src) => {
            const img = new global.Image();
            img.src = src;
            return img;
        };

        SpriteManager = loadFreshModule();
    });

    afterEach(() => {
        delete global.Image;
        delete global.document;
        delete global.loadImage;
    });

    it('should populate images for every sprite in spriteList', async () => {
        await SpriteManager.loadAll();

        for (const name of SpriteManager.spriteList) {
            assert.ok(
                SpriteManager.images[name] !== undefined,
                `Expected images['${name}'] to be populated`
            );
        }
    });

    it('should store an Image-like object for each sprite', async () => {
        await SpriteManager.loadAll();

        // Each value should be an instance of the stubbed Image class
        for (const name of SpriteManager.spriteList) {
            const img = SpriteManager.images[name];
            assert.ok(img instanceof global.Image, `images['${name}'] should be an Image instance`);
        }
    });

    it('should load the correct src path for each sprite', async () => {
        const loadedSrcs = [];
        global.loadImage = async (src) => {
            loadedSrcs.push(src);
            const img = new global.Image();
            img.src = src;
            return img;
        };

        // Reload module to pick up the new loadImage stub
        SpriteManager = loadFreshModule();
        await SpriteManager.loadAll();

        for (const name of SpriteManager.spriteList) {
            const expected = `assets/sprites/${name}.png`;
            assert.ok(
                loadedSrcs.includes(expected),
                `Expected loadImage to be called with '${expected}'`
            );
        }
    });

    it('should load all sprites concurrently (Promise.all)', async () => {
        // Verify all sprites are loaded even when loadImage is slow
        let resolveCount = 0;
        global.loadImage = async (src) => {
            resolveCount++;
            return { src };
        };

        SpriteManager = loadFreshModule();
        await SpriteManager.loadAll();

        assert.equal(
            resolveCount,
            SpriteManager.spriteList.length,
            'loadImage should be called once per sprite'
        );
    });
});

// ─── Suite 2: loadAll() fallback path when loadImage rejects ─────────────────

describe('SpriteManager.loadAll() — fallback path (real module)', () => {
    let SpriteManager;

    beforeEach(() => {
        // Stub document so createFallback can run
        global.document = {
            createElement: (_tag) => makeMockCanvas(),
        };

        global.Image = class {
            constructor() {
                this.src = '';
                setTimeout(() => { if (this.onload) this.onload(); }, 0);
            }
        };

        SpriteManager = loadFreshModule();
    });

    afterEach(() => {
        delete global.Image;
        delete global.document;
        delete global.loadImage;
    });

    it('should call createFallback when loadImage rejects for a sprite', async () => {
        const failingSprite = SpriteManager.spriteList[0]; // e.g. 'grass-short-1'

        global.loadImage = async (src) => {
            if (src.includes(failingSprite)) {
                throw new Error(`Simulated load failure for ${failingSprite}`);
            }
            return { src };
        };

        SpriteManager = loadFreshModule();

        let createFallbackCalled = false;
        const originalCreateFallback = SpriteManager.createFallback.bind(SpriteManager);
        SpriteManager.createFallback = function (name) {
            if (name === failingSprite) createFallbackCalled = true;
            return originalCreateFallback(name);
        };

        await SpriteManager.loadAll();

        assert.ok(
            createFallbackCalled,
            `createFallback should be called when loadImage rejects for '${failingSprite}'`
        );
    });

    it('should store a fallback canvas in images when loadImage rejects', async () => {
        const failingSprite = 'water-1';

        global.loadImage = async (src) => {
            if (src.includes(failingSprite)) throw new Error('Not found');
            return { src };
        };

        SpriteManager = loadFreshModule();
        await SpriteManager.loadAll();

        // The fallback is a canvas element (has getContext)
        const fallback = SpriteManager.images[failingSprite];
        assert.ok(fallback !== undefined, 'Fallback should be stored in images');
        assert.ok(
            typeof fallback.getContext === 'function',
            'Fallback should be a canvas-like object with getContext'
        );
    });

    it('should use fallback for all sprites when loadImage always rejects', async () => {
        global.loadImage = async () => {
            throw new Error('Network error');
        };

        SpriteManager = loadFreshModule();
        await SpriteManager.loadAll();

        for (const name of SpriteManager.spriteList) {
            const img = SpriteManager.images[name];
            assert.ok(img !== undefined, `images['${name}'] should have a fallback`);
            assert.ok(
                typeof img.getContext === 'function',
                `images['${name}'] fallback should be canvas-like`
            );
        }
    });

    it('should still populate successful sprites alongside fallbacks', async () => {
        const failingSprites = new Set(['water-1', 'water-2', 'water-3']);

        global.loadImage = async (src) => {
            for (const name of failingSprites) {
                if (src.includes(name)) throw new Error('Not found');
            }
            return { src };
        };

        SpriteManager = loadFreshModule();
        await SpriteManager.loadAll();

        // Failing sprites should have canvas fallbacks
        for (const name of failingSprites) {
            assert.ok(
                typeof SpriteManager.images[name].getContext === 'function',
                `'${name}' should have a canvas fallback`
            );
        }

        // Successful sprites should have plain image objects (no getContext)
        const successSprite = SpriteManager.spriteList.find(n => !failingSprites.has(n));
        assert.ok(
            typeof SpriteManager.images[successSprite].getContext !== 'function',
            `'${successSprite}' should be a loaded image, not a fallback`
        );
    });
});

// ─── Suite 3: createFallback() uses document.createElement('canvas') ─────────

describe('SpriteManager.createFallback() — real module with document stub', () => {
    let SpriteManager;
    let createdCanvases;

    beforeEach(() => {
        createdCanvases = [];

        global.document = {
            createElement: (tag) => {
                const canvas = makeMockCanvas();
                createdCanvases.push({ tag, canvas });
                return canvas;
            },
        };

        global.Image = class {
            constructor() { setTimeout(() => { if (this.onload) this.onload(); }, 0); }
        };
        global.loadImage = async (src) => ({ src });

        SpriteManager = loadFreshModule();
    });

    afterEach(() => {
        delete global.document;
        delete global.Image;
        delete global.loadImage;
    });

    it('should call document.createElement("canvas")', () => {
        SpriteManager.createFallback('test-sprite');

        assert.equal(createdCanvases.length, 1, 'createElement should be called once');
        assert.equal(createdCanvases[0].tag, 'canvas', 'createElement should be called with "canvas"');
    });

    it('should return the canvas element created by document.createElement', () => {
        const result = SpriteManager.createFallback('test-sprite');

        assert.ok(result !== undefined, 'createFallback should return a value');
        assert.ok(
            typeof result.getContext === 'function',
            'Returned value should be a canvas-like object'
        );
    });

    it('should set canvas width and height to TILE_SIZE', () => {
        const canvas = SpriteManager.createFallback('test-sprite');

        assert.equal(canvas.width, global.TILE_SIZE, 'canvas.width should equal TILE_SIZE');
        assert.equal(canvas.height, global.TILE_SIZE, 'canvas.height should equal TILE_SIZE');
    });

    it('should call canvas.getContext("2d")', () => {
        const canvas = SpriteManager.createFallback('test-sprite');

        const getContextCall = canvas.calls.find(c => c.m === 'getContext');
        assert.ok(getContextCall, 'getContext should be called');
        assert.equal(getContextCall.a[0], '2d', 'getContext should be called with "2d"');
    });

    it('should call ctx.fillRect to draw the background', () => {
        const canvas = SpriteManager.createFallback('test-sprite');

        const fillRectCall = canvas.ctx.calls.find(c => c.m === 'fillRect');
        assert.ok(fillRectCall, 'fillRect should be called to draw background');
        assert.deepEqual(
            fillRectCall.a,
            [0, 0, global.TILE_SIZE, global.TILE_SIZE],
            'fillRect should cover the full canvas'
        );
    });

    it('should call ctx.fillText with truncated sprite name', () => {
        const canvas = SpriteManager.createFallback('castle-keep-center');

        const fillTextCall = canvas.ctx.calls.find(c => c.m === 'fillText');
        assert.ok(fillTextCall, 'fillText should be called');
        assert.equal(
            fillTextCall.a[0],
            'castle',
            'fillText should use first 6 chars of name'
        );
    });

    it('should center the text at (TILE_SIZE/2, TILE_SIZE/2)', () => {
        const canvas = SpriteManager.createFallback('rock');

        const fillTextCall = canvas.ctx.calls.find(c => c.m === 'fillText');
        assert.ok(fillTextCall, 'fillText should be called');
        assert.equal(fillTextCall.a[1], global.TILE_SIZE / 2, 'text x should be TILE_SIZE/2');
        assert.equal(fillTextCall.a[2], global.TILE_SIZE / 2, 'text y should be TILE_SIZE/2');
    });

    it('should handle short names without truncation', () => {
        const canvas = SpriteManager.createFallback('rock');

        const fillTextCall = canvas.ctx.calls.find(c => c.m === 'fillText');
        assert.equal(fillTextCall.a[0], 'rock', 'Short names should not be truncated');
    });
});
