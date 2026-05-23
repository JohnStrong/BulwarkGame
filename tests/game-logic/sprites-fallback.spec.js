/**
 * Tests for SpriteManager.createFallback and draw method edge cases.
 *
 * Covers the fallback sprite creation logic and the draw method's
 * handling of missing sprites.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/sprites-fallback.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── SpriteManager replica ──────────────────────────────────────────────────

const TILE_SIZE = 32;

function createSpriteManager() {
    return {
        images: {},

        createFallback(name) {
            // In the real code this creates a canvas element.
            // For testing, we simulate the logic and return a descriptor.
            return {
                type: 'fallback',
                width: TILE_SIZE,
                height: TILE_SIZE,
                label: name.substring(0, 6),
                bgColor: '#555',
                textColor: '#fff',
                font: '7px monospace',
            };
        },

        draw(ctx, name, x, y, width, height) {
            const img = this.images[name];
            if (img) {
                ctx.drawImage(img, x, y, width || TILE_SIZE, height || TILE_SIZE);
            }
        }
    };
}

function createMockCtx() {
    const calls = [];
    return {
        calls,
        drawImage(img, x, y, w, h) { calls.push({ method: 'drawImage', args: [img, x, y, w, h] }); },
    };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SpriteManager.createFallback', () => {
    it('should create a fallback with TILE_SIZE dimensions', () => {
        const sm = createSpriteManager();
        const fallback = sm.createFallback('grass-short-1');
        assert.equal(fallback.width, 32);
        assert.equal(fallback.height, 32);
    });

    it('should truncate name to 6 characters for label', () => {
        const sm = createSpriteManager();
        const fallback = sm.createFallback('castle-keep-center');
        assert.equal(fallback.label, 'castle');
    });

    it('should handle short names without truncation', () => {
        const sm = createSpriteManager();
        const fallback = sm.createFallback('rock');
        assert.equal(fallback.label, 'rock');
    });

    it('should handle empty name', () => {
        const sm = createSpriteManager();
        const fallback = sm.createFallback('');
        assert.equal(fallback.label, '');
    });

    it('should use grey background color', () => {
        const sm = createSpriteManager();
        const fallback = sm.createFallback('test');
        assert.equal(fallback.bgColor, '#555');
    });

    it('should use white text color', () => {
        const sm = createSpriteManager();
        const fallback = sm.createFallback('test');
        assert.equal(fallback.textColor, '#fff');
    });

    it('should use monospace font', () => {
        const sm = createSpriteManager();
        const fallback = sm.createFallback('test');
        assert.equal(fallback.font, '7px monospace');
    });
});

describe('SpriteManager.draw', () => {
    it('should call drawImage when sprite exists', () => {
        const sm = createSpriteManager();
        sm.images['grass-short-1'] = { src: 'grass.png' };
        const ctx = createMockCtx();

        sm.draw(ctx, 'grass-short-1', 10, 20, 32, 32);

        assert.equal(ctx.calls.length, 1);
        assert.equal(ctx.calls[0].method, 'drawImage');
    });

    it('should pass correct coordinates to drawImage', () => {
        const sm = createSpriteManager();
        sm.images['road-full'] = { src: 'road.png' };
        const ctx = createMockCtx();

        sm.draw(ctx, 'road-full', 100, 200, 64, 32);

        assert.deepEqual(ctx.calls[0].args.slice(1), [100, 200, 64, 32]);
    });

    it('should not call drawImage when sprite does not exist', () => {
        const sm = createSpriteManager();
        const ctx = createMockCtx();

        sm.draw(ctx, 'nonexistent-sprite', 10, 20, 32, 32);

        assert.equal(ctx.calls.length, 0);
    });

    it('should use TILE_SIZE as default width when not specified', () => {
        const sm = createSpriteManager();
        sm.images['test'] = { src: 'test.png' };
        const ctx = createMockCtx();

        sm.draw(ctx, 'test', 0, 0, undefined, undefined);

        assert.equal(ctx.calls[0].args[3], TILE_SIZE);
        assert.equal(ctx.calls[0].args[4], TILE_SIZE);
    });

    it('should use provided width and height when specified', () => {
        const sm = createSpriteManager();
        sm.images['test'] = { src: 'test.png' };
        const ctx = createMockCtx();

        sm.draw(ctx, 'test', 0, 0, 48, 24);

        assert.equal(ctx.calls[0].args[3], 48);
        assert.equal(ctx.calls[0].args[4], 24);
    });

    it('should handle zero coordinates', () => {
        const sm = createSpriteManager();
        sm.images['test'] = { src: 'test.png' };
        const ctx = createMockCtx();

        sm.draw(ctx, 'test', 0, 0, 32, 32);

        assert.deepEqual(ctx.calls[0].args.slice(1), [0, 0, 32, 32]);
    });
});
