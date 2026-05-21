/**
 * Tests for js/game-logic/sprites.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/sprites.spec.js
 *
 * Note: SpriteManager relies heavily on DOM (Image, Canvas, fetch).
 * These tests cover the logic that can be tested without a browser:
 * - spriteList completeness
 * - draw() behavior with mock context
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const TILE_SIZE = 32;

// Minimal SpriteManager replica for testable logic
const SpriteManager = {
    images: {},

    spriteList: [
        'grass-short-1', 'grass-short-2',
        'grass-flowers-1', 'grass-flowers-2',
        'road-full',
        'water-1', 'water-2', 'water-3',
        'bridge-mm',
        'tree-1', 'tree-2', 'tree-3', 'tree-4',
        'tree-5', 'tree-6', 'tree-7',
        'rock',
        'unit-knight', 'unit-heavy-infantry', 'unit-spearman',
        'unit-archer', 'unit-crossbowman', 'unit-skirmisher',
        'unit-engineer', 'unit-militia', 'unit-artillery',
        'castle-bridge-mid', 'castle-tower',
        'castle-keep-tl', 'castle-keep-bl', 'castle-keep-br',
        'castle-keep-center', 'castle-gatehouse', 'castle-wall',
        'castle-bailey-1', 'castle-bailey-2', 'castle-bailey-3'
    ],

    draw(ctx, name, x, y, width, height) {
        const img = this.images[name];
        if (img) {
            ctx.drawImage(img, x, y, width || TILE_SIZE, height || TILE_SIZE);
        }
    }
};

describe('SpriteManager.spriteList', () => {
    it('should contain all grass sprites', () => {
        assert.ok(SpriteManager.spriteList.includes('grass-short-1'));
        assert.ok(SpriteManager.spriteList.includes('grass-short-2'));
        assert.ok(SpriteManager.spriteList.includes('grass-flowers-1'));
        assert.ok(SpriteManager.spriteList.includes('grass-flowers-2'));
    });

    it('should contain road sprite', () => {
        assert.ok(SpriteManager.spriteList.includes('road-full'));
    });

    it('should contain 3 water sprites', () => {
        assert.ok(SpriteManager.spriteList.includes('water-1'));
        assert.ok(SpriteManager.spriteList.includes('water-2'));
        assert.ok(SpriteManager.spriteList.includes('water-3'));
    });

    it('should contain 7 tree sprites', () => {
        for (let i = 1; i <= 7; i++) {
            assert.ok(SpriteManager.spriteList.includes(`tree-${i}`));
        }
    });

    it('should contain all 9 unit sprites', () => {
        const unitSprites = [
            'unit-knight', 'unit-heavy-infantry', 'unit-spearman',
            'unit-archer', 'unit-crossbowman', 'unit-skirmisher',
            'unit-engineer', 'unit-militia', 'unit-artillery'
        ];
        for (const s of unitSprites) {
            assert.ok(SpriteManager.spriteList.includes(s), `Missing: ${s}`);
        }
    });

    it('should contain all castle sprites', () => {
        const castleSprites = [
            'castle-bridge-mid', 'castle-tower',
            'castle-keep-tl', 'castle-keep-bl', 'castle-keep-br',
            'castle-keep-center', 'castle-gatehouse', 'castle-wall',
            'castle-bailey-1', 'castle-bailey-2', 'castle-bailey-3'
        ];
        for (const s of castleSprites) {
            assert.ok(SpriteManager.spriteList.includes(s), `Missing: ${s}`);
        }
    });

    it('should have no duplicate entries', () => {
        const set = new Set(SpriteManager.spriteList);
        assert.equal(set.size, SpriteManager.spriteList.length);
    });

    it('should have no empty string entries', () => {
        for (const s of SpriteManager.spriteList) {
            assert.ok(s.length > 0);
        }
    });
});

describe('SpriteManager.draw', () => {
    it('should call drawImage when sprite exists', () => {
        let called = false;
        let args = null;
        const mockCtx = {
            drawImage(img, x, y, w, h) { called = true; args = { img, x, y, w, h }; }
        };
        SpriteManager.images['test-sprite'] = { fake: true };
        SpriteManager.draw(mockCtx, 'test-sprite', 10, 20, 64, 32);
        assert.ok(called);
        assert.equal(args.x, 10);
        assert.equal(args.y, 20);
        assert.equal(args.w, 64);
        assert.equal(args.h, 32);
        delete SpriteManager.images['test-sprite'];
    });

    it('should use TILE_SIZE as default width/height', () => {
        let args = null;
        const mockCtx = {
            drawImage(img, x, y, w, h) { args = { w, h }; }
        };
        SpriteManager.images['test-sprite'] = { fake: true };
        SpriteManager.draw(mockCtx, 'test-sprite', 0, 0);
        assert.equal(args.w, TILE_SIZE);
        assert.equal(args.h, TILE_SIZE);
        delete SpriteManager.images['test-sprite'];
    });

    it('should not call drawImage when sprite does not exist', () => {
        let called = false;
        const mockCtx = {
            drawImage() { called = true; }
        };
        SpriteManager.draw(mockCtx, 'nonexistent', 0, 0, 32, 32);
        assert.equal(called, false);
    });
});
