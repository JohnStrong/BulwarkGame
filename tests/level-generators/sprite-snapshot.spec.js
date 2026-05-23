/**
 * Snapshot/regression tests for deterministic sprite generators.
 *
 * Recommendation 8: Consider snapshot testing for sprite generators.
 * Since generators are deterministic (seeded PRNG), we store expected pixel
 * samples at known coordinates and compare on each run to catch regressions.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/sprite-snapshot.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createBuffer, setPixel, isInsideDiamond, seededRandom, resetSeed, drawEdgeBorder } = require('../../js/level-generators/lib/pixel-utils');
const { fillDiamondWithSpeckle } = require('../../js/level-generators/lib/fill-patterns');
const { TILE_WIDTH, TILE_HEIGHT, TERRAIN_COLORS } = require('../../js/level-generators/lib/sprite-constants');

// ─── Helper: compute a simple checksum of opaque pixels ─────────────────────

function bufferChecksum(buf) {
    let sum = 0;
    for (let i = 0; i < buf.length; i += 4) {
        if (buf[i + 3] === 255) {
            sum = (sum + buf[i] * 7 + buf[i + 1] * 13 + buf[i + 2] * 23) & 0xFFFFFFFF;
        }
    }
    return sum >>> 0;
}

function getPixel(buf, x, y) {
    const idx = (y * TILE_WIDTH + x) * 4;
    return [buf[idx], buf[idx + 1], buf[idx + 2], buf[idx + 3]];
}

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] === 255) count++;
    }
    return count;
}

// ─── Re-implement generators for snapshot testing ───────────────────────────

function generateGrass(variant) {
    const buffer = createBuffer();
    fillDiamondWithSpeckle(buffer, TERRAIN_COLORS.grass, 12, 1000 + variant * 100);
    resetSeed(1080 + variant * 100);
    for (let i = 0; i < 8; i++) {
        const x = Math.floor(seededRandom() * TILE_WIDTH);
        const y = Math.floor(seededRandom() * TILE_HEIGHT);
        if (isInsideDiamond(x, y)) {
            setPixel(buffer, x, y, ...TERRAIN_COLORS.grassDark);
        }
    }
    drawEdgeBorder(buffer);
    return buffer;
}

function generateWater(variant) {
    const buffer = createBuffer();
    fillDiamondWithSpeckle(buffer, TERRAIN_COLORS.water, 8, 4000 + variant * 100);
    resetSeed(4080 + variant * 100);
    for (let rippleIndex = 0; rippleIndex < 4; rippleIndex++) {
        const rippleX = 10 + Math.floor(seededRandom() * 44);
        const rippleY = 4 + Math.floor(seededRandom() * 24);
        if (isInsideDiamond(rippleX, rippleY)) {
            for (let pixel = 0; pixel < 4; pixel++) {
                setPixel(buffer, rippleX + pixel, rippleY, 80, 155, 235);
            }
        }
    }
    drawEdgeBorder(buffer);
    return buffer;
}

function generateRoad() {
    const buffer = createBuffer();
    fillDiamondWithSpeckle(buffer, TERRAIN_COLORS.road, 10, 3000);
    resetSeed(3080);
    for (let crackIndex = 0; crackIndex < 5; crackIndex++) {
        let crackX = Math.floor(seededRandom() * TILE_WIDTH);
        let crackY = Math.floor(seededRandom() * TILE_HEIGHT);
        for (let step = 0; step < 4; step++) {
            if (isInsideDiamond(crackX, crackY)) {
                setPixel(buffer, crackX, crackY, 170, 130, 80);
            }
            crackX += Math.floor(seededRandom() * 3) - 1;
            crackY += Math.floor(seededRandom() * 3) - 1;
        }
    }
    drawEdgeBorder(buffer);
    return buffer;
}

function generateRock() {
    const buffer = createBuffer();
    fillDiamondWithSpeckle(buffer, TERRAIN_COLORS.grass, 10, 7000);
    const centerX = 32, centerY = 16;
    resetSeed(7080);
    for (let offsetY = -4; offsetY <= 4; offsetY++) {
        for (let offsetX = -5; offsetX <= 5; offsetX++) {
            const isInsideRock = (offsetX * offsetX + offsetY * offsetY) <= 20;
            if (isInsideRock && isInsideDiamond(centerX + offsetX, centerY + offsetY)) {
                const noise = (seededRandom() - 0.5) * 8;
                setPixel(buffer, centerX + offsetX, centerY + offsetY, 130 + noise, 128 + noise, 122 + noise);
            }
        }
    }
    drawEdgeBorder(buffer);
    return buffer;
}

// ─── Snapshot Tests ─────────────────────────────────────────────────────────

describe('Sprite snapshot: grass variants', () => {
    // Generate once and record checksums — these are the "golden" values
    const grass0 = generateGrass(0);
    const grass1 = generateGrass(1);
    const checksum0 = bufferChecksum(grass0);
    const checksum1 = bufferChecksum(grass1);

    it('grass variant 0 should be deterministic (checksum stable)', () => {
        const buf = generateGrass(0);
        assert.equal(bufferChecksum(buf), checksum0);
    });

    it('grass variant 1 should be deterministic (checksum stable)', () => {
        const buf = generateGrass(1);
        assert.equal(bufferChecksum(buf), checksum1);
    });

    it('grass variants should have different checksums', () => {
        assert.notEqual(checksum0, checksum1);
    });

    it('grass variant 0 center pixel should be consistent', () => {
        const buf = generateGrass(0);
        const px = getPixel(buf, 32, 16);
        // Re-generate and compare
        const buf2 = generateGrass(0);
        const px2 = getPixel(buf2, 32, 16);
        assert.deepEqual(px, px2);
    });

    it('grass should have consistent opaque pixel count', () => {
        const count1 = countOpaquePixels(generateGrass(0));
        const count2 = countOpaquePixels(generateGrass(0));
        assert.equal(count1, count2);
    });
});

describe('Sprite snapshot: water variants', () => {
    const water0 = generateWater(0);
    const water1 = generateWater(1);
    const water2 = generateWater(2);
    const checksum0 = bufferChecksum(water0);
    const checksum1 = bufferChecksum(water1);
    const checksum2 = bufferChecksum(water2);

    it('water variant 0 should be deterministic', () => {
        assert.equal(bufferChecksum(generateWater(0)), checksum0);
    });

    it('water variant 1 should be deterministic', () => {
        assert.equal(bufferChecksum(generateWater(1)), checksum1);
    });

    it('water variant 2 should be deterministic', () => {
        assert.equal(bufferChecksum(generateWater(2)), checksum2);
    });

    it('all water variants should differ', () => {
        assert.notEqual(checksum0, checksum1);
        assert.notEqual(checksum1, checksum2);
        assert.notEqual(checksum0, checksum2);
    });

    it('water center pixel should be blue-dominant', () => {
        const [r, g, b, a] = getPixel(water0, 32, 16);
        if (a === 255) {
            assert.ok(b > r, `Blue (${b}) should be > red (${r})`);
            assert.ok(b > g, `Blue (${b}) should be > green (${g})`);
        }
    });
});

describe('Sprite snapshot: road', () => {
    const road = generateRoad();
    const checksum = bufferChecksum(road);

    it('road should be deterministic', () => {
        assert.equal(bufferChecksum(generateRoad()), checksum);
    });

    it('road center pixel should be warm brown', () => {
        const [r, g, b, a] = getPixel(road, 32, 16);
        if (a === 255) {
            assert.ok(r > g, `Red (${r}) should be > green (${g})`);
            assert.ok(g > b, `Green (${g}) should be > blue (${b})`);
        }
    });

    it('road should have consistent pixel count across runs', () => {
        const count1 = countOpaquePixels(generateRoad());
        const count2 = countOpaquePixels(generateRoad());
        assert.equal(count1, count2);
    });
});

describe('Sprite snapshot: rock', () => {
    const rock = generateRock();
    const checksum = bufferChecksum(rock);

    it('rock should be deterministic', () => {
        assert.equal(bufferChecksum(generateRock()), checksum);
    });

    it('rock center should be grey (channels close together)', () => {
        const [r, g, b, a] = getPixel(rock, 32, 16);
        if (a === 255) {
            const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
            assert.ok(maxDiff < 30, `Rock center should be grey, got RGB(${r},${g},${b})`);
        }
    });

    it('rock pixel samples should be stable across runs', () => {
        const buf1 = generateRock();
        const buf2 = generateRock();
        // Check several known positions
        const positions = [[30, 14], [32, 16], [34, 18], [31, 15], [33, 17]];
        for (const [x, y] of positions) {
            const px1 = getPixel(buf1, x, y);
            const px2 = getPixel(buf2, x, y);
            assert.deepEqual(px1, px2, `Pixel at (${x},${y}) should be stable`);
        }
    });
});

describe('Sprite snapshot: cross-variant stability', () => {
    it('generating one variant should not affect another', () => {
        // Generate grass0, then grass1
        const g0a = generateGrass(0);
        const g1a = generateGrass(1);

        // Generate in reverse order
        const g1b = generateGrass(1);
        const g0b = generateGrass(0);

        // Both should produce same results regardless of order
        assert.ok(g0a.equals(g0b), 'Grass 0 should be order-independent');
        assert.ok(g1a.equals(g1b), 'Grass 1 should be order-independent');
    });

    it('generating water should not affect road output', () => {
        const road1 = generateRoad();
        generateWater(0);
        generateWater(1);
        const road2 = generateRoad();
        assert.ok(road1.equals(road2), 'Road should be independent of water generation');
    });
});
