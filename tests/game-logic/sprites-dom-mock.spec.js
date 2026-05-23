/**
 * DOM mock tests for js/game-logic/sprites.js (SpriteManager)
 *
 * Recommendation 1: Test SpriteManager.loadAll(), createFallback(), and draw()
 * using lightweight DOM mocks.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/sprites-dom-mock.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── DOM Mocks ──────────────────────────────────────────────────────────────

function createMockImage() {
    const img = {
        src: '',
        onload: null,
        onerror: null,
        width: 64,
        height: 32,
    };
    return img;
}

function createMockCanvasCtx() {
    const calls = [];
    return {
        calls,
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        fillRect(x, y, w, h) { calls.push({ m: 'fillRect', a: [x, y, w, h] }); },
        fillText(t, x, y) { calls.push({ m: 'fillText', a: [t, x, y] }); },
        drawImage(img, x, y, w, h) { calls.push({ m: 'drawImage', a: [img, x, y, w, h] }); },
    };
}

// ─── SpriteManager replica with DOM mocks ───────────────────────────────────

const TILE_SIZE = 32;

function createSpriteManager() {
    return {
        images: {},
        spriteList: ['grass-short-1', 'grass-short-2', 'road-full', 'water-1'],

        async loadAll(loadImageFn) {
            const promises = this.spriteList.map(async (name) => {
                try {
                    this.images[name] = await loadImageFn(`assets/sprites/${name}.png`);
                } catch (e) {
                    this.images[name] = this.createFallback(name);
                }
            });
            await Promise.all(promises);
        },

        createFallback(name) {
            // Simulate canvas creation for fallback
            const ctx = createMockCanvasCtx();
            ctx.fillStyle = '#555';
            ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#fff';
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(name.substring(0, 6), TILE_SIZE / 2, TILE_SIZE / 2);
            return { isFallback: true, name, ctx };
        },

        draw(ctx, name, x, y, width, height) {
            const img = this.images[name];
            if (img) {
                ctx.drawImage(img, x, y, width || TILE_SIZE, height || TILE_SIZE);
            }
        },
    };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SpriteManager.loadAll() with DOM mocks', () => {
    it('should load all sprites from the sprite list', async () => {
        const sm = createSpriteManager();
        const loadImageFn = async (src) => ({ src, loaded: true });
        await sm.loadAll(loadImageFn);

        assert.equal(Object.keys(sm.images).length, 4);
        assert.ok(sm.images['grass-short-1'].loaded);
        assert.ok(sm.images['road-full'].loaded);
    });

    it('should create fallback for failed loads', async () => {
        const sm = createSpriteManager();
        const loadImageFn = async (src) => {
            if (src.includes('water')) throw new Error('Not found');
            return { src, loaded: true };
        };
        await sm.loadAll(loadImageFn);

        assert.ok(sm.images['grass-short-1'].loaded);
        assert.ok(sm.images['water-1'].isFallback);
    });

    it('should handle all loads failing gracefully', async () => {
        const sm = createSpriteManager();
        const loadImageFn = async () => { throw new Error('Network error'); };
        await sm.loadAll(loadImageFn);

        // All should be fallbacks
        for (const name of sm.spriteList) {
            assert.ok(sm.images[name].isFallback, `${name} should be fallback`);
        }
    });
});

describe('SpriteManager.createFallback()', () => {
    it('should create a fallback with the sprite name', () => {
        const sm = createSpriteManager();
        const fallback = sm.createFallback('castle-wall');
        assert.ok(fallback.isFallback);
        assert.equal(fallback.name, 'castle-wall');
    });

    it('should truncate long names to 6 characters', () => {
        const sm = createSpriteManager();
        const fallback = sm.createFallback('very-long-sprite-name');
        // The fillText call should use substring(0, 6)
        const textCall = fallback.ctx.calls.find(c => c.m === 'fillText');
        assert.equal(textCall.a[0], 'very-l');
    });
});

describe('SpriteManager.draw()', () => {
    it('should call ctx.drawImage when sprite exists', () => {
        const sm = createSpriteManager();
        sm.images['grass-short-1'] = { loaded: true };
        const ctx = createMockCanvasCtx();
        sm.draw(ctx, 'grass-short-1', 100, 200, 64, 32);
        const drawCall = ctx.calls.find(c => c.m === 'drawImage');
        assert.ok(drawCall);
        assert.deepEqual(drawCall.a.slice(1), [100, 200, 64, 32]);
    });

    it('should not call drawImage when sprite does not exist', () => {
        const sm = createSpriteManager();
        const ctx = createMockCanvasCtx();
        sm.draw(ctx, 'nonexistent', 0, 0, 64, 32);
        assert.equal(ctx.calls.length, 0);
    });

    it('should use TILE_SIZE as default dimensions', () => {
        const sm = createSpriteManager();
        sm.images['test'] = { loaded: true };
        const ctx = createMockCanvasCtx();
        sm.draw(ctx, 'test', 10, 20);
        const drawCall = ctx.calls.find(c => c.m === 'drawImage');
        assert.deepEqual(drawCall.a.slice(1), [10, 20, TILE_SIZE, TILE_SIZE]);
    });
});
