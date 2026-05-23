/**
 * Tests for js/game-logic/pixi-renderer.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/pixi-renderer.spec.js
 *
 * Because pixi-renderer.js is a browser module that depends on PixiJS (a DOM
 * library), these tests exercise the pure-logic portions that can run in
 * Node.js without a browser:
 *
 *  - Draw-call batching counters (Property 18 / Req 7.4)
 *  - Integer pixel alignment (Property 13 / Req 5.2)
 *  - Fallback to Canvas 2D when PixiJS is unavailable
 *  - Atlas fallback to SpriteManager.loadAll() on failure
 *  - initPixiRenderer resolves to an API object with the expected shape
 *  - loadSpriteAtlas falls back gracefully on fetch failure
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Minimal PIXI stub ────────────────────────────────────────────────────────
// pixi-renderer.js checks `typeof PIXI` at runtime (browser global).
// In Node.js tests we stub it so the module can be required.

global.PIXI = {
    Application: class {
        constructor(opts) {
            // Simulate forceCanvas behaviour: if forceCanvas is true, renderer
            // is a CanvasRenderer stub; otherwise it's a Renderer stub.
            if (opts && opts.forceCanvas) {
                this.renderer = { type: 'canvas' };
            } else {
                // Simulate WebGL renderer — must be instanceof PIXI.Renderer
                this.renderer = Object.create(global.PIXI.Renderer.prototype);
            }
            this.stage = { addChild() {} };
            this.view = opts && opts.view;
        }
        destroy() {}
    },
    Renderer: class { constructor() { this.type = 'webgl'; } },
    CanvasRenderer: class { constructor() { this.type = 'canvas'; } },
    Sprite: class {
        constructor(texture) { this.texture = texture; this.x = 0; this.y = 0; }
    },
    BaseTexture: {
        from(path) {
            return {
                valid: false,
                _path: path,
                on(event, cb) {
                    // Simulate async load success
                    if (event === 'loaded') setTimeout(cb, 0);
                },
            };
        },
    },
    Spritesheet: class {
        constructor(baseTexture, data) {
            this.baseTexture = baseTexture;
            this.data = data;
            this.textures = {};
            // Populate textures from data.frames
            if (data && data.frames) {
                for (const name of Object.keys(data.frames)) {
                    this.textures[name] = { name, frame: data.frames[name].frame };
                }
            }
        }
        parse() { return Promise.resolve(); }
    },
};

// ─── Stub fetch ───────────────────────────────────────────────────────────────

function makeFetchStub(responseData, shouldFail = false) {
    return async function fetch(url) {
        if (shouldFail) throw new Error(`Network error: ${url}`);
        return {
            ok: true,
            json: async () => responseData,
        };
    };
}

// ─── Load module fresh for each test ─────────────────────────────────────────

function loadFreshModule() {
    // Clear require cache so each test gets a clean module state.
    const modulePath = require.resolve('../../js/game-logic/pixi-renderer.js');
    delete require.cache[modulePath];
    return require('../../js/game-logic/pixi-renderer.js');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('pixi-renderer: draw-call batching (Req 7.4, Property 18)', () => {
    let mod;

    beforeEach(() => {
        mod = loadFreshModule();
    });

    it('should allow up to MAX_DRAW_CALLS_PER_LAYER draw calls per layer', () => {
        const max = mod.MAX_DRAW_CALLS_PER_LAYER;
        assert.equal(max, 10);

        for (let i = 0; i < max; i++) {
            const allowed = mod.trackDrawCall('ground');
            assert.ok(allowed, `Call ${i + 1} should be within budget`);
        }
    });

    it('should reject draw calls beyond the budget', () => {
        const max = mod.MAX_DRAW_CALLS_PER_LAYER;
        for (let i = 0; i < max; i++) mod.trackDrawCall('ground');

        const overBudget = mod.trackDrawCall('ground');
        assert.equal(overBudget, false, 'Call beyond budget should be rejected');
    });

    it('should track each layer independently', () => {
        const max = mod.MAX_DRAW_CALLS_PER_LAYER;
        // Exhaust 'ground' layer
        for (let i = 0; i < max; i++) mod.trackDrawCall('ground');

        // 'structure' layer should still have budget
        const allowed = mod.trackDrawCall('structure');
        assert.ok(allowed, 'structure layer should be independent of ground');
    });

    it('should reset counters after resetDrawCallCounters()', () => {
        const max = mod.MAX_DRAW_CALLS_PER_LAYER;
        for (let i = 0; i < max; i++) mod.trackDrawCall('ground');

        mod.resetDrawCallCounters();

        const allowed = mod.trackDrawCall('ground');
        assert.ok(allowed, 'Counter should be reset to 0');
    });

    it('getDrawCallCount should return current count', () => {
        mod.trackDrawCall('unit');
        mod.trackDrawCall('unit');
        assert.equal(mod.getDrawCallCount('unit'), 2);
    });

    it('getDrawCallCount should return 0 for unused layer', () => {
        assert.equal(mod.getDrawCallCount('overlay'), 0);
    });
});

describe('pixi-renderer: integer pixel alignment (Req 5.2, Property 13)', () => {
    let mod;

    beforeEach(() => {
        mod = loadFreshModule();
    });

    it('should floor fractional x coordinate before drawing', () => {
        const calls = [];
        const mockCtx = { drawImage(img, x, y, w, h) { calls.push({ x, y }); } };

        // Stub SpriteManager in global scope for the fallback path
        global.SpriteManager = {
            draw(ctx, name, x, y, w, h) { ctx.drawImage(null, x, y, w, h); },
        };

        mod.drawSprite(mockCtx, 'grass-short-1', 10.7, 20.0, 64, 32);

        assert.equal(calls.length, 1);
        assert.equal(calls[0].x, 10, 'x should be floored to 10');

        delete global.SpriteManager;
    });

    it('should floor fractional y coordinate before drawing', () => {
        const calls = [];
        const mockCtx = { drawImage(img, x, y, w, h) { calls.push({ x, y }); } };

        global.SpriteManager = {
            draw(ctx, name, x, y, w, h) { ctx.drawImage(null, x, y, w, h); },
        };

        mod.drawSprite(mockCtx, 'grass-short-1', 0, 15.9, 64, 32);

        assert.equal(calls[0].y, 15, 'y should be floored to 15');

        delete global.SpriteManager;
    });

    it('should not alter integer coordinates', () => {
        const calls = [];
        const mockCtx = { drawImage(img, x, y, w, h) { calls.push({ x, y }); } };

        global.SpriteManager = {
            draw(ctx, name, x, y, w, h) { ctx.drawImage(null, x, y, w, h); },
        };

        mod.drawSprite(mockCtx, 'road-full', 100, 200, 64, 32);

        assert.equal(calls[0].x, 100);
        assert.equal(calls[0].y, 200);

        delete global.SpriteManager;
    });
});

describe('pixi-renderer: Canvas 2D fallback (Req 5.5)', () => {
    it('should fall back to Canvas 2D when PixiJS Application throws', async () => {
        // Override PIXI.Application to always throw
        const origApp = global.PIXI.Application;
        global.PIXI.Application = class {
            constructor() { throw new Error('WebGL not supported'); }
        };

        const mod = loadFreshModule();
        const canvas = { width: 800, height: 600 };
        const api = await mod.initPixiRenderer(canvas, 100);

        assert.equal(api.rendererType, 'canvas2d');

        global.PIXI.Application = origApp;
    });

    it('should fall back to CanvasRenderer when WebGL times out', async () => {
        // Override PIXI.Application: first call (WebGL) hangs, second (forceCanvas) succeeds
        const origApp = global.PIXI.Application;
        let callCount = 0;
        global.PIXI.Application = class {
            constructor(opts) {
                callCount++;
                if (!opts.forceCanvas) {
                    // Simulate a hang — never resolve, let timeout fire
                    // We do this by not throwing but also not completing quickly.
                    // The timeout in the test is 50ms; we just block by not
                    // resolving. Since the constructor is synchronous, we throw
                    // a timeout-like error to simulate the timeout path.
                    throw new Error('Simulated WebGL timeout');
                }
                this.renderer = Object.create(global.PIXI.CanvasRenderer.prototype);
                this.stage = { addChild() {} };
            }
            destroy() {}
        };

        const mod = loadFreshModule();
        const canvas = { width: 800, height: 600 };
        const api = await mod.initPixiRenderer(canvas, 50);

        assert.equal(api.rendererType, 'canvas-renderer');

        global.PIXI.Application = origApp;
    });
});

describe('pixi-renderer: initPixiRenderer API shape (Req 6.3, 6.4)', () => {
    it('should return an object with the expected API surface', async () => {
        const mod = loadFreshModule();
        const canvas = { width: 800, height: 600 };
        const api = await mod.initPixiRenderer(canvas, 5000);

        assert.ok(typeof api.rendererType === 'string', 'rendererType should be a string');
        assert.ok(typeof api.atlasLoaded === 'boolean', 'atlasLoaded should be a boolean');
        assert.ok(typeof api.loadSpriteAtlas === 'function', 'loadSpriteAtlas should be a function');
        assert.ok(typeof api.drawSprite === 'function', 'drawSprite should be a function');
        assert.ok(typeof api.resetDrawCallCounters === 'function');
        assert.ok(typeof api.trackDrawCall === 'function');
        assert.ok(typeof api.getDrawCallCount === 'function');
        assert.ok(api.textures instanceof Map, 'textures should be a Map');
    });

    it('should use the provided canvas element (Req 6.4)', async () => {
        const mod = loadFreshModule();
        const canvas = { width: 1024, height: 768 };
        const api = await mod.initPixiRenderer(canvas, 5000);

        // When PixiJS initializes successfully, the app should reference the canvas
        if (api.rendererType !== 'canvas2d' && api.app) {
            assert.equal(api.app.view, canvas, 'PixiJS app should use the provided canvas');
        }
    });

    it('should return the same API on repeated calls (idempotent)', async () => {
        const mod = loadFreshModule();
        const canvas = { width: 800, height: 600 };
        const api1 = await mod.initPixiRenderer(canvas, 5000);
        const api2 = await mod.initPixiRenderer(canvas, 5000);

        assert.equal(api1.rendererType, api2.rendererType);
    });
});

describe('pixi-renderer: atlas loading fallback (Req 5.1, 6.6, 6.7)', () => {
    it('should fall back to SpriteManager.loadAll() when fetch fails', async () => {
        const mod = loadFreshModule();

        // Stub fetch to fail
        global.fetch = makeFetchStub(null, true);

        let loadAllCalled = false;
        global.SpriteManager = {
            loadAll: async () => { loadAllCalled = true; },
        };

        await mod.loadSpriteAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.ok(loadAllCalled, 'SpriteManager.loadAll() should be called on atlas failure');
        assert.equal(mod._getAtlasLoaded(), false);

        delete global.fetch;
        delete global.SpriteManager;
    });

    it('should fall back when JSON parse fails', async () => {
        const mod = loadFreshModule();

        // Stub fetch to return invalid JSON
        global.fetch = async () => ({
            ok: true,
            json: async () => { throw new Error('Invalid JSON'); },
        });

        let loadAllCalled = false;
        global.SpriteManager = {
            loadAll: async () => { loadAllCalled = true; },
        };

        await mod.loadSpriteAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.ok(loadAllCalled, 'SpriteManager.loadAll() should be called on JSON parse failure');

        delete global.fetch;
        delete global.SpriteManager;
    });

    it('should populate textures map on successful atlas load', async () => {
        const mod = loadFreshModule();

        const atlasData = {
            meta: { image: 'atlas-0.png', size: { w: 1024, h: 1024 } },
            frames: {
                'grass-short-1': { frame: { x: 0, y: 0, w: 64, h: 32 } },
                'road-full':     { frame: { x: 65, y: 0, w: 64, h: 32 } },
            },
        };

        global.fetch = makeFetchStub(atlasData);

        await mod.loadSpriteAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.ok(mod._getAtlasLoaded(), 'atlasLoaded should be true after successful load');
        assert.ok(mod._textures.has('grass-short-1'), 'grass-short-1 texture should be registered');
        assert.ok(mod._textures.has('road-full'), 'road-full texture should be registered');

        delete global.fetch;
    });

    it('should not call SpriteManager.loadAll() on successful atlas load', async () => {
        const mod = loadFreshModule();

        const atlasData = {
            meta: { image: 'atlas-0.png', size: { w: 512, h: 512 } },
            frames: {
                'water-1': { frame: { x: 0, y: 0, w: 64, h: 32 } },
            },
        };

        global.fetch = makeFetchStub(atlasData);

        let loadAllCalled = false;
        global.SpriteManager = {
            loadAll: async () => { loadAllCalled = true; },
        };

        await mod.loadSpriteAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.equal(loadAllCalled, false, 'SpriteManager.loadAll() should NOT be called on success');

        delete global.fetch;
        delete global.SpriteManager;
    });
});

describe('pixi-renderer: drawSprite Canvas 2D delegation', () => {
    it('should delegate to SpriteManager.draw() in canvas2d mode', () => {
        const mod = loadFreshModule();

        // Force canvas2d mode by resetting and not initializing PixiJS
        mod._reset();

        const drawCalls = [];
        global.SpriteManager = {
            draw(ctx, name, x, y, w, h) {
                drawCalls.push({ name, x, y, w, h });
            },
        };

        const mockCtx = {};
        mod.drawSprite(mockCtx, 'castle-wall', 50.5, 100.9, 64, 32);

        assert.equal(drawCalls.length, 1);
        assert.equal(drawCalls[0].name, 'castle-wall');
        assert.equal(drawCalls[0].x, 50, 'x should be floored');
        assert.equal(drawCalls[0].y, 100, 'y should be floored');

        delete global.SpriteManager;
    });
});

describe('pixi-renderer: drawSprite PixiJS path (Req 7.4)', () => {
    // Helper: initialise a fresh module into webgl mode and load a texture.
    // Returns { mod, api } — mod is module.exports, api is the initPixiRenderer result.
    // api.app.stage is the live stage object that drawSprite uses internally.
    async function setupWebGLMode() {
        const mod = loadFreshModule();
        const canvas = { width: 800, height: 600 };
        // initPixiRenderer with the default PIXI stub enters 'webgl' mode.
        const api = await mod.initPixiRenderer(canvas, 5000);
        return { mod, api };
    }

    it('should NOT call SpriteManager.draw when _rendererType is webgl and texture exists', async () => {
        const { mod } = await setupWebGLMode();

        const atlasData = {
            meta: { image: 'atlas-0.png', size: { w: 512, h: 512 } },
            frames: { 'test-sprite': { frame: { x: 0, y: 0, w: 64, h: 32 } } },
        };
        global.fetch = makeFetchStub(atlasData);
        await mod.loadSpriteAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');
        delete global.fetch;

        // Now _atlasLoaded is true and _rendererType is 'webgl'.
        assert.equal(mod._getRendererType(), 'webgl');
        assert.equal(mod._getAtlasLoaded(), true);

        let spriteManagerCalled = false;
        global.SpriteManager = {
            draw() { spriteManagerCalled = true; },
        };

        const mockCtx = {};
        mod.drawSprite(mockCtx, 'test-sprite', 10, 20, 64, 32);

        assert.equal(spriteManagerCalled, false, 'SpriteManager.draw must NOT be called on PixiJS path');

        delete global.SpriteManager;
    });

    it('should silently skip (no stage.addChild) when draw-call budget is exceeded', async () => {
        const { mod, api } = await setupWebGLMode();

        const atlasData = {
            meta: { image: 'atlas-0.png', size: { w: 512, h: 512 } },
            frames: { 'test-sprite': { frame: { x: 0, y: 0, w: 64, h: 32 } } },
        };
        global.fetch = makeFetchStub(atlasData);
        await mod.loadSpriteAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');
        delete global.fetch;

        // Exhaust the budget for 'ground' layer.
        const max = mod.MAX_DRAW_CALLS_PER_LAYER;
        for (let i = 0; i < max; i++) mod.trackDrawCall('ground');

        // Intercept addChild on the live stage (api.app is the PIXI.Application instance).
        let addChildCalled = false;
        if (api.app && api.app.stage) {
            const origAddChild = api.app.stage.addChild.bind(api.app.stage);
            api.app.stage.addChild = (...args) => {
                addChildCalled = true;
                return origAddChild(...args);
            };
        }

        const mockCtx = {};
        mod.drawSprite(mockCtx, 'test-sprite', 0, 0, 64, 32, 'ground');

        assert.equal(addChildCalled, false, 'stage.addChild must not be called when budget exceeded');
    });

    it('should create a PIXI.Sprite and call stage.addChild for a known texture', async () => {
        const { mod, api } = await setupWebGLMode();

        const atlasData = {
            meta: { image: 'atlas-0.png', size: { w: 512, h: 512 } },
            frames: { 'test-sprite': { frame: { x: 0, y: 0, w: 64, h: 32 } } },
        };
        global.fetch = makeFetchStub(atlasData);
        await mod.loadSpriteAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');
        delete global.fetch;

        assert.equal(mod._getRendererType(), 'webgl');
        assert.equal(mod._getAtlasLoaded(), true);
        assert.ok(mod._textures.has('test-sprite'), 'texture must be registered');

        // Intercept addChild on the live stage via the api.app reference.
        const addedChildren = [];
        assert.ok(api.app && api.app.stage, 'api.app.stage must exist in webgl mode');
        api.app.stage.addChild = (child) => { addedChildren.push(child); };

        const mockCtx = {};
        mod.drawSprite(mockCtx, 'test-sprite', 50, 75, 64, 32);

        assert.equal(addedChildren.length, 1, 'stage.addChild should be called once');
        // The added child should be a PIXI.Sprite with floored coordinates.
        const sprite = addedChildren[0];
        assert.ok(sprite instanceof global.PIXI.Sprite, 'added child should be a PIXI.Sprite');
        assert.equal(sprite.x, 50, 'sprite x should be floored integer');
        assert.equal(sprite.y, 75, 'sprite y should be floored integer');
    });
});
