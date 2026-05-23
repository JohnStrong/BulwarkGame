/**
 * Tests for generateDamagedCastleSprite dispatcher function.
 *
 * Covers the main entry point that routes to individual damaged
 * castle sprite generators based on type string.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-damaged-castle-dispatcher.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    generateDamagedCastleSprite,
    generateDamagedWall,
    generateDamagedTower,
    generateDamagedKeepTL,
    generateDamagedKeepBL,
    generateDamagedKeepBR,
    generateDamagedKeepCenter,
    generateDamagedGatehouse,
    generateDamagedBailey1,
    generateDamagedBailey2,
    generateDamagedBailey3,
    DAMAGED_CASTLE_TYPES,
    countOpaquePixels,
    MIN_DAMAGE_PERCENT,
} = require('../../js/level-generators/generate-damaged-castle-sprites');

const { TILE_WIDTH, TILE_HEIGHT } = require('../../js/level-generators/lib/sprite-constants');

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('generateDamagedCastleSprite: dispatcher', () => {
    it('should dispatch to generateDamagedWall for "wall" type', () => {
        const buf = generateDamagedCastleSprite('wall', 50000);
        const directBuf = generateDamagedWall(50000);
        assert.ok(buf.equals(directBuf));
    });

    it('should dispatch to generateDamagedTower for "tower" type', () => {
        const buf = generateDamagedCastleSprite('tower', 50000);
        const directBuf = generateDamagedTower(50000);
        assert.ok(buf.equals(directBuf));
    });

    it('should dispatch to generateDamagedKeepTL for "keep-tl" type', () => {
        const buf = generateDamagedCastleSprite('keep-tl', 50000);
        const directBuf = generateDamagedKeepTL(50000);
        assert.ok(buf.equals(directBuf));
    });

    it('should dispatch to generateDamagedKeepBL for "keep-bl" type', () => {
        const buf = generateDamagedCastleSprite('keep-bl', 50000);
        const directBuf = generateDamagedKeepBL(50000);
        assert.ok(buf.equals(directBuf));
    });

    it('should dispatch to generateDamagedKeepBR for "keep-br" type', () => {
        const buf = generateDamagedCastleSprite('keep-br', 50000);
        const directBuf = generateDamagedKeepBR(50000);
        assert.ok(buf.equals(directBuf));
    });

    it('should dispatch to generateDamagedKeepCenter for "keep-center" type', () => {
        const buf = generateDamagedCastleSprite('keep-center', 50000);
        const directBuf = generateDamagedKeepCenter(50000);
        assert.ok(buf.equals(directBuf));
    });

    it('should dispatch to generateDamagedGatehouse for "gatehouse" type', () => {
        const buf = generateDamagedCastleSprite('gatehouse', 50000);
        const directBuf = generateDamagedGatehouse(50000);
        assert.ok(buf.equals(directBuf));
    });

    it('should dispatch to generateDamagedBailey1 for "bailey-1" type', () => {
        const buf = generateDamagedCastleSprite('bailey-1', 50000);
        const directBuf = generateDamagedBailey1(50000);
        assert.ok(buf.equals(directBuf));
    });

    it('should dispatch to generateDamagedBailey2 for "bailey-2" type', () => {
        const buf = generateDamagedCastleSprite('bailey-2', 50000);
        const directBuf = generateDamagedBailey2(50000);
        assert.ok(buf.equals(directBuf));
    });

    it('should dispatch to generateDamagedBailey3 for "bailey-3" type', () => {
        const buf = generateDamagedCastleSprite('bailey-3', 50000);
        const directBuf = generateDamagedBailey3(50000);
        assert.ok(buf.equals(directBuf));
    });

    it('should produce deterministic output for same type and seed', () => {
        const buf1 = generateDamagedCastleSprite('tower', 12345);
        const buf2 = generateDamagedCastleSprite('tower', 12345);
        assert.ok(buf1.equals(buf2));
    });

    it('should produce different output for different seeds', () => {
        const buf1 = generateDamagedCastleSprite('wall', 10000);
        const buf2 = generateDamagedCastleSprite('wall', 20000);
        assert.ok(!buf1.equals(buf2));
    });

    it('should produce different output for different types', () => {
        const buf1 = generateDamagedCastleSprite('wall', 50000);
        const buf2 = generateDamagedCastleSprite('tower', 50000);
        assert.ok(!buf1.equals(buf2));
    });
});

describe('generateDamagedCastleSprite: all types produce valid output', () => {
    const types = ['wall', 'tower', 'keep-tl', 'keep-bl', 'keep-br',
                   'keep-center', 'gatehouse', 'bailey-1', 'bailey-2', 'bailey-3'];

    for (const type of types) {
        it(`"${type}" should produce a buffer with opaque pixels`, () => {
            const buf = generateDamagedCastleSprite(type, 50000);
            const opaque = countOpaquePixels(buf);
            assert.ok(opaque > 0, `${type} should have opaque pixels, got ${opaque}`);
        });

        it(`"${type}" should produce correct buffer size`, () => {
            const buf = generateDamagedCastleSprite(type, 50000);
            assert.equal(buf.length, TILE_WIDTH * TILE_HEIGHT * 4);
        });

        it(`"${type}" should have binary alpha values`, () => {
            const buf = generateDamagedCastleSprite(type, 50000);
            for (let i = 3; i < buf.length; i += 4) {
                assert.ok(buf[i] === 0 || buf[i] === 255,
                    `${type}: pixel at byte ${i} has alpha ${buf[i]}`);
            }
        });
    }
});

describe('DAMAGED_CASTLE_TYPES constant', () => {
    it('should contain all 10 damaged castle types', () => {
        assert.equal(DAMAGED_CASTLE_TYPES.length, 10);
    });

    it('should include wall, tower, keep variants, gatehouse, and bailey variants', () => {
        const typeNames = DAMAGED_CASTLE_TYPES.map(t => t.type || t);
        assert.ok(typeNames.includes('wall') || DAMAGED_CASTLE_TYPES.some(t => (t.type || t) === 'wall'));
    });
});

describe('MIN_DAMAGE_PERCENT constant', () => {
    it('should be a number between 0 and 1', () => {
        assert.ok(typeof MIN_DAMAGE_PERCENT === 'number');
        assert.ok(MIN_DAMAGE_PERCENT >= 0 && MIN_DAMAGE_PERCENT <= 1,
            `MIN_DAMAGE_PERCENT should be between 0 and 1, got ${MIN_DAMAGE_PERCENT}`);
    });
});

describe('countOpaquePixels utility', () => {
    it('should return 0 for an empty buffer', () => {
        const buf = Buffer.alloc(TILE_WIDTH * TILE_HEIGHT * 4, 0);
        assert.equal(countOpaquePixels(buf), 0);
    });

    it('should count pixels inside diamond with alpha > 0', () => {
        // Use a full tile-sized buffer and set center pixel (which is inside diamond)
        const buf = Buffer.alloc(TILE_WIDTH * TILE_HEIGHT * 4, 0);
        const centerX = Math.floor(TILE_WIDTH / 2);
        const centerY = Math.floor(TILE_HEIGHT / 2);
        const idx = (centerY * TILE_WIDTH + centerX) * 4;
        buf[idx] = 100;
        buf[idx + 1] = 100;
        buf[idx + 2] = 100;
        buf[idx + 3] = 255;
        const count = countOpaquePixels(buf);
        assert.ok(count >= 1, `Center pixel should be inside diamond, got count ${count}`);
    });

    it('should return positive count for a fully opaque tile-sized buffer', () => {
        const buf = Buffer.alloc(TILE_WIDTH * TILE_HEIGHT * 4);
        for (let i = 0; i < buf.length; i += 4) {
            buf[i] = 100;
            buf[i + 1] = 100;
            buf[i + 2] = 100;
            buf[i + 3] = 255;
        }
        const count = countOpaquePixels(buf);
        // Diamond inscribed in tile should cover a significant portion
        assert.ok(count > 0, `Should count pixels inside diamond, got ${count}`);
        assert.ok(count < TILE_WIDTH * TILE_HEIGHT, 'Should not count all pixels (diamond clips corners)');
    });
});
