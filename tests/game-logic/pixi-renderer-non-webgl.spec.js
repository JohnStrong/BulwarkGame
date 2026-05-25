/**
 * Tests for pixi-renderer._tryWebGL non-WebGL-renderer rejection branch.
 *
 * Recommendation 4: Test pixi-renderer._tryWebGL non-WebGL-renderer rejection.
 * When PIXI.Application creates an app but app.renderer is NOT an instance of
 * PIXI.Renderer, _tryWebGL should reject and initPixiRenderer should fall
 * through to the CanvasRenderer path.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/pixi-renderer-non-webgl.spec.js
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadFreshModule() {
    const modulePath = require.resolve('../../js/game-logic/pixi-renderer.js');
    delete require.cache[modulePath];
    return require('../../js/game-logic/pixi-renderer.js');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('pixi-renderer: _tryWebGL non-WebGL-renderer rejection', () => {
    let origPIXI;

    beforeEach(() => {
        origPIXI = global.PIXI;
    });

    afterEach(() => {
        global.PIXI = origPIXI;
    });

    it('should reject when app.renderer is not instanceof PIXI.Renderer', async () => {
        // Set up PIXI where Application creates an app but renderer is a plain object
        // (not an instance of PIXI.Renderer)
        global.PIXI = {
            Application: class {
                constructor(opts) {
                    // Renderer is a plain object — NOT instanceof PIXI.Renderer
                    this.renderer = { type: 'not-webgl' };
                    this.stage = { addChild() {} };
                    this.view = opts && opts.view;
                }
                destroy() {}
            },
            Renderer: class { constructor() { this.type = 'webgl'; } },
            CanvasRenderer: class { constructor() { this.type = 'canvas'; } },
            Sprite: class { constructor(t) { this.texture = t; } },
            BaseTexture: {
                from(path) {
                    return {
                        valid: false,
                        on(event, cb) { if (event === 'loaded') setTimeout(cb, 0); },
                    };
                },
            },
            Spritesheet: class {
                constructor(bt, data) { this.textures = {}; }
                parse() { return Promise.resolve(); }
            },
        };

        const mod = loadFreshModule();
        const canvas = { width: 800, height: 600 };

        // initPixiRenderer should fall through to CanvasRenderer since WebGL
        // renderer check fails. But CanvasRenderer also uses the same Application
        // stub (with forceCanvas: true), which will also produce a non-Renderer.
        // The CanvasRenderer path doesn't check instanceof PIXI.Renderer, so it
        // should succeed and return 'canvas-renderer'.
        const api = await mod.initPixiRenderer(canvas, 5000);

        // The WebGL path should have been rejected (renderer not instanceof PIXI.Renderer)
        // and fallen through to CanvasRenderer or canvas2d
        assert.ok(
            api.rendererType === 'canvas-renderer' || api.rendererType === 'canvas2d',
            `Expected canvas-renderer or canvas2d fallback, got: ${api.rendererType}`
        );
    });

    it('should fall through to canvas2d when both WebGL and CanvasRenderer fail', async () => {
        // Both Application constructors throw
        global.PIXI = {
            Application: class {
                constructor() {
                    throw new Error('No renderer available');
                }
            },
            Renderer: class {},
            CanvasRenderer: class {},
            Sprite: class { constructor(t) { this.texture = t; } },
            BaseTexture: { from() { return { valid: false, on() {} }; } },
            Spritesheet: class { constructor() { this.textures = {}; } parse() { return Promise.resolve(); } },
        };

        const mod = loadFreshModule();
        const canvas = { width: 800, height: 600 };
        const api = await mod.initPixiRenderer(canvas, 5000);

        assert.equal(api.rendererType, 'canvas2d');
    });

    it('should not accept a plain object renderer as WebGL (instanceof check)', async () => {
        // Track whether _tryWebGL rejected
        let webglRejected = false;

        global.PIXI = {
            Application: class {
                constructor(opts) {
                    if (!opts.forceCanvas) {
                        // WebGL attempt: renderer is a plain object, not instanceof PIXI.Renderer
                        this.renderer = { type: 'plain-object' };
                    } else {
                        // CanvasRenderer attempt: use CanvasRenderer prototype
                        this.renderer = Object.create(global.PIXI.CanvasRenderer.prototype);
                    }
                    this.stage = { addChild() {} };
                    this.view = opts && opts.view;
                }
                destroy() { webglRejected = true; }
            },
            Renderer: class { constructor() { this.type = 'webgl'; } },
            CanvasRenderer: class { constructor() { this.type = 'canvas'; } },
            Sprite: class { constructor(t) { this.texture = t; } },
            BaseTexture: { from() { return { valid: false, on() {} }; } },
            Spritesheet: class { constructor() { this.textures = {}; } parse() { return Promise.resolve(); } },
        };

        const mod = loadFreshModule();
        const canvas = { width: 800, height: 600 };
        const api = await mod.initPixiRenderer(canvas, 5000);

        // Should have fallen through to canvas-renderer since WebGL renderer
        // was not instanceof PIXI.Renderer
        assert.equal(api.rendererType, 'canvas-renderer');
        // The WebGL app should have been destroyed (app.destroy called)
        assert.ok(webglRejected, 'WebGL app.destroy() should be called when renderer check fails');
    });

    it('should accept a proper PIXI.Renderer instance as WebGL', async () => {
        // Restore the original PIXI stub that creates proper WebGL renderer
        global.PIXI = {
            Application: class {
                constructor(opts) {
                    if (!opts.forceCanvas) {
                        // Proper WebGL renderer — instanceof PIXI.Renderer
                        this.renderer = Object.create(global.PIXI.Renderer.prototype);
                    } else {
                        this.renderer = Object.create(global.PIXI.CanvasRenderer.prototype);
                    }
                    this.stage = { addChild() {} };
                    this.view = opts && opts.view;
                }
                destroy() {}
            },
            Renderer: class { constructor() { this.type = 'webgl'; } },
            CanvasRenderer: class { constructor() { this.type = 'canvas'; } },
            Sprite: class { constructor(t) { this.texture = t; } },
            BaseTexture: { from() { return { valid: false, on() {} }; } },
            Spritesheet: class { constructor() { this.textures = {}; } parse() { return Promise.resolve(); } },
        };

        const mod = loadFreshModule();
        const canvas = { width: 800, height: 600 };
        const api = await mod.initPixiRenderer(canvas, 5000);

        assert.equal(api.rendererType, 'webgl', 'Should use WebGL when renderer is instanceof PIXI.Renderer');
    });
});
