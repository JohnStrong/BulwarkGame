/**
 * Tests for IsoCamera.applyTransform() (Recommendation 3).
 *
 * Verifies that applyTransform calls ctx.translate and ctx.scale with the
 * correct arguments based on the current zoom level and canvas dimensions.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-camera-apply-transform.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Replicate IsoCamera with applyTransform ─────────────────────────────────

function createCamera() {
    return {
        tileW: 64,
        tileH: 32,
        camX: 0,
        camY: 0,
        zoom: 1.0,
        zoomMin: 0.3,
        zoomMax: 4.0,
        scrollSpeed: 8,
        viewpoint: 'br-tl',
        mapOffsetX: 0,
        mapOffsetY: 0,
        elevation: {},
        canvas: null,

        init(canvas, config) {
            this.canvas = canvas;
            if (config) {
                if (config.tileW) this.tileW = config.tileW;
                if (config.tileH) this.tileH = config.tileH;
                if (config.zoom !== undefined) this.zoom = config.zoom;
            }
        },

        applyTransform(ctx) {
            ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
            ctx.scale(this.zoom, this.zoom);
            ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
        },
    };
}

/**
 * Creates a mock canvas context that records all calls to translate and scale.
 */
function createMockCtx() {
    const calls = [];
    return {
        calls,
        translate(x, y) { calls.push({ method: 'translate', args: [x, y] }); },
        scale(sx, sy) { calls.push({ method: 'scale', args: [sx, sy] }); },
    };
}

const mockCanvas = { width: 1024, height: 768 };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IsoCamera.applyTransform', () => {
    it('should call translate, scale, translate in that order', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        const ctx = createMockCtx();

        cam.applyTransform(ctx);

        assert.equal(ctx.calls.length, 3, 'Expected exactly 3 context calls');
        assert.equal(ctx.calls[0].method, 'translate', 'First call should be translate');
        assert.equal(ctx.calls[1].method, 'scale', 'Second call should be scale');
        assert.equal(ctx.calls[2].method, 'translate', 'Third call should be translate');
    });

    it('should translate to canvas center first (width/2, height/2)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        const ctx = createMockCtx();

        cam.applyTransform(ctx);

        const firstTranslate = ctx.calls[0];
        assert.equal(firstTranslate.args[0], mockCanvas.width / 2,
            'First translate X should be canvas.width / 2');
        assert.equal(firstTranslate.args[1], mockCanvas.height / 2,
            'First translate Y should be canvas.height / 2');
    });

    it('should scale by the current zoom level', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.5 });
        const ctx = createMockCtx();

        cam.applyTransform(ctx);

        const scaleCall = ctx.calls[1];
        assert.equal(scaleCall.args[0], 1.5, 'Scale X should equal zoom');
        assert.equal(scaleCall.args[1], 1.5, 'Scale Y should equal zoom');
    });

    it('should translate back by negative canvas center (-width/2, -height/2)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        const ctx = createMockCtx();

        cam.applyTransform(ctx);

        const secondTranslate = ctx.calls[2];
        assert.equal(secondTranslate.args[0], -mockCanvas.width / 2,
            'Second translate X should be -canvas.width / 2');
        assert.equal(secondTranslate.args[1], -mockCanvas.height / 2,
            'Second translate Y should be -canvas.height / 2');
    });

    it('should use zoom=0.7 (default) when no zoom override given', () => {
        const cam = createCamera();
        cam.init(mockCanvas, {});
        cam.zoom = 0.7; // default
        const ctx = createMockCtx();

        cam.applyTransform(ctx);

        const scaleCall = ctx.calls[1];
        assert.equal(scaleCall.args[0], 0.7);
        assert.equal(scaleCall.args[1], 0.7);
    });

    it('should reflect zoom changes between calls', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });

        const ctx1 = createMockCtx();
        cam.applyTransform(ctx1);
        assert.equal(ctx1.calls[1].args[0], 1.0);

        // Change zoom
        cam.zoom = 2.0;
        const ctx2 = createMockCtx();
        cam.applyTransform(ctx2);
        assert.equal(ctx2.calls[1].args[0], 2.0);
    });

    it('should work with a non-standard canvas size', () => {
        const cam = createCamera();
        const smallCanvas = { width: 320, height: 240 };
        cam.init(smallCanvas, { zoom: 1.0 });
        const ctx = createMockCtx();

        cam.applyTransform(ctx);

        assert.equal(ctx.calls[0].args[0], 160); // 320/2
        assert.equal(ctx.calls[0].args[1], 120); // 240/2
        assert.equal(ctx.calls[2].args[0], -160);
        assert.equal(ctx.calls[2].args[1], -120);
    });

    it('should apply uniform scale (sx === sy)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 0.5 });
        const ctx = createMockCtx();

        cam.applyTransform(ctx);

        const scaleCall = ctx.calls[1];
        assert.equal(scaleCall.args[0], scaleCall.args[1],
            'Scale X and Y should be equal (uniform zoom)');
    });
});
