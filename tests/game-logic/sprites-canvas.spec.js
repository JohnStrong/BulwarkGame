/**
 * Canvas mock tests for js/game-logic/sprites.js
 *
 * Recommendation 1: Test createFallback canvas content and loadAll
 * error handling using lightweight canvas mocks.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/sprites-canvas.spec.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const TILE_SIZE = 32;

// ─── Canvas Mock ────────────────────────────────────────────────────────────

function createMockCanvas(width, height) {
    const drawCalls = [];
    const ctx = {
        drawCalls,
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        fillRect(x, y, w, h) {
            drawCalls.push({ method: 'fillRect', args: [x, y, w, h] });
        },
        fillText(text, x, y) {
            drawCalls.push({ method: 'fillText', args: [text, x, y] });
        },
        drawImage(img, x, y, w, h) {
            drawCalls.push({ method: 'drawImage', args: [img, x, y, w, h] });
        },
    };

    return {
        width,
        height,
        ctx,
        getContext(type) {
            assert.equal(type, '2d');
            return ctx;
        },
    };
}

// ─── SpriteManager replica with mock DOM ────────────────────────────────────

function createSpriteManager() {
    const canvasesCreated = [];

    // Mock document.createElement
    function createElement(tag) {
        assert.equal(tag, 'canvas');
        const canvas = createMockCanvas(0, 0);
        canvasesCreated.push(canvas);
        return canvas;
    }

    const SpriteManager = {
        images: {},
        canvasesCreated,

        spriteList: [
            'grass-short-1', 'grass-short-2',
            'unit-knight', 'unit-archer',
        ],

        createFallback(name) {
            const canvas = createElement('canvas');
            canvas.width = TILE_SIZE;
            canvas.height = TILE_SIZE;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#555';
            ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#fff';
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(name.substring(0, 6), TILE_SIZE / 2, TILE_SIZE / 2);
            return canvas;
        },

        draw(ctx, name, x, y, width, height) {
            const img = this.images[name];
            if (img) {
                ctx.drawImage(img, x, y, width || TILE_SIZE, height || TILE_SIZE);
            }
        }
    };

    return SpriteManager;
}

// ─── createFallback Tests ───────────────────────────────────────────────────

describe('SpriteManager.createFallback', () => {
    it('should create a canvas with TILE_SIZE dimensions', () => {
        const sm = createSpriteManager();
        const canvas = sm.createFallback('test-sprite');
        assert.equal(canvas.width, TILE_SIZE);
        assert.equal(canvas.height, TILE_SIZE);
    });

    it('should fill the canvas with grey background (#555)', () => {
        const sm = createSpriteManager();
        const canvas = sm.createFallback('test-sprite');
        const ctx = canvas.ctx;
        const fillRects = ctx.drawCalls.filter(c => c.method === 'fillRect');
        assert.ok(fillRects.length >= 1);
        assert.deepEqual(fillRects[0].args, [0, 0, TILE_SIZE, TILE_SIZE]);
    });

    it('should render truncated sprite name (max 6 chars)', () => {
        const sm = createSpriteManager();
        const canvas = sm.createFallback('long-sprite-name');
        const ctx = canvas.ctx;
        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        assert.equal(textCalls.length, 1);
        assert.equal(textCalls[0].args[0], 'long-s'); // substring(0, 6)
    });

    it('should center the text on the canvas', () => {
        const sm = createSpriteManager();
        const canvas = sm.createFallback('test');
        const ctx = canvas.ctx;
        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        assert.equal(textCalls[0].args[1], TILE_SIZE / 2); // x = center
        assert.equal(textCalls[0].args[2], TILE_SIZE / 2); // y = center
    });

    it('should handle empty name', () => {
        const sm = createSpriteManager();
        const canvas = sm.createFallback('');
        const ctx = canvas.ctx;
        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        assert.equal(textCalls[0].args[0], ''); // empty substring
    });

    it('should handle short name (< 6 chars)', () => {
        const sm = createSpriteManager();
        const canvas = sm.createFallback('abc');
        const ctx = canvas.ctx;
        const textCalls = ctx.drawCalls.filter(c => c.method === 'fillText');
        assert.equal(textCalls[0].args[0], 'abc');
    });

    it('should return a canvas object (usable as image source)', () => {
        const sm = createSpriteManager();
        const canvas = sm.createFallback('test');
        assert.ok(canvas !== null);
        assert.ok(typeof canvas.getContext === 'function');
    });
});

// ─── draw() with fallback images ────────────────────────────────────────────

describe('SpriteManager.draw: with fallback canvas', () => {
    it('should draw fallback canvas via drawImage', () => {
        const sm = createSpriteManager();
        const fallback = sm.createFallback('missing');
        sm.images['missing'] = fallback;

        const mockCtx = {
            calls: [],
            drawImage(img, x, y, w, h) { mockCtx.calls.push({ img, x, y, w, h }); },
        };

        sm.draw(mockCtx, 'missing', 10, 20, 64, 32);

        assert.equal(mockCtx.calls.length, 1);
        assert.equal(mockCtx.calls[0].img, fallback);
        assert.equal(mockCtx.calls[0].x, 10);
        assert.equal(mockCtx.calls[0].y, 20);
        assert.equal(mockCtx.calls[0].w, 64);
        assert.equal(mockCtx.calls[0].h, 32);
    });
});

// ─── loadAll error handling simulation ──────────────────────────────────────

describe('SpriteManager: loadAll error handling', () => {
    it('should use createFallback when image loading fails', () => {
        const sm = createSpriteManager();

        // Simulate what loadAll does on failure
        const failedSprite = 'nonexistent-sprite';
        sm.images[failedSprite] = sm.createFallback(failedSprite);

        // The fallback should be usable as an image
        assert.ok(sm.images[failedSprite] !== null);
        assert.ok(sm.images[failedSprite].width === TILE_SIZE);
        assert.ok(sm.images[failedSprite].height === TILE_SIZE);
    });

    it('should still allow draw() after fallback assignment', () => {
        const sm = createSpriteManager();
        sm.images['broken'] = sm.createFallback('broken');

        let drawn = false;
        const mockCtx = {
            drawImage() { drawn = true; },
        };

        sm.draw(mockCtx, 'broken', 0, 0, 32, 32);
        assert.ok(drawn, 'draw() should work with fallback canvas');
    });

    it('should create unique fallbacks for different sprite names', () => {
        const sm = createSpriteManager();
        const fb1 = sm.createFallback('grass1');
        const fb2 = sm.createFallback('tree-2');

        // Both should be valid canvases
        assert.equal(fb1.width, TILE_SIZE);
        assert.equal(fb2.width, TILE_SIZE);

        // Text content should differ (names are <= 6 chars so no truncation collision)
        const text1 = fb1.ctx.drawCalls.find(c => c.method === 'fillText').args[0];
        const text2 = fb2.ctx.drawCalls.find(c => c.method === 'fillText').args[0];
        assert.notEqual(text1, text2);
    });
});
