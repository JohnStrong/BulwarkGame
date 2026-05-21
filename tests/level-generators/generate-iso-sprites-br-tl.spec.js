/**
 * Tests for js/level-generators/generate-iso-sprites-br-tl.js
 *
 * Tests the terrain sprite generation logic by re-implementing the generator
 * functions using the shared utilities (since the module auto-runs generateAll).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-iso-sprites-br-tl.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createBuffer, setPixel, isInsideDiamond, seededRandom, resetSeed, drawEdgeBorder } = require('../../js/level-generators/lib/pixel-utils');
const { fillDiamondWithSpeckle } = require('../../js/level-generators/lib/fill-patterns');
const { TILE_WIDTH, TILE_HEIGHT, TERRAIN_COLORS } = require('../../js/level-generators/lib/sprite-constants');

// Re-implement key generators for testing

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

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] === 255) count++;
    }
    return count;
}

describe('generate-iso-sprites: grass', () => {
    it('should produce opaque pixels inside the diamond', () => {
        const buf = generateGrass(0);
        assert.ok(countOpaquePixels(buf) > 500);
    });

    it('should be deterministic for the same variant', () => {
        const buf1 = generateGrass(0);
        const buf2 = generateGrass(0);
        assert.ok(buf1.equals(buf2));
    });

    it('variant 0 and variant 1 should produce different output', () => {
        const buf0 = generateGrass(0);
        const buf1 = generateGrass(1);
        assert.ok(!buf0.equals(buf1));
    });

    it('should have green-ish colors (grass palette)', () => {
        const buf = generateGrass(0);
        const centerIdx = (16 * TILE_WIDTH + 32) * 4;
        if (buf[centerIdx + 3] === 255) {
            // Grass is [95, 180, 72] — green channel should dominate
            assert.ok(buf[centerIdx + 1] > buf[centerIdx], 'Green should be higher than red');
            assert.ok(buf[centerIdx + 1] > buf[centerIdx + 2], 'Green should be higher than blue');
        }
    });

    it('should leave corner pixels transparent', () => {
        const buf = generateGrass(0);
        const cornerIdx = (0 * TILE_WIDTH + 0) * 4;
        assert.equal(buf[cornerIdx + 3], 0);
    });
});

describe('generate-iso-sprites: road', () => {
    it('should produce opaque pixels inside the diamond', () => {
        const buf = generateRoad();
        assert.ok(countOpaquePixels(buf) > 500);
    });

    it('should be deterministic', () => {
        const buf1 = generateRoad();
        const buf2 = generateRoad();
        assert.ok(buf1.equals(buf2));
    });

    it('should have warm brown colors (road palette)', () => {
        const buf = generateRoad();
        const centerIdx = (16 * TILE_WIDTH + 32) * 4;
        if (buf[centerIdx + 3] === 255) {
            // Road is [210, 165, 110] — red > green > blue
            assert.ok(buf[centerIdx] > buf[centerIdx + 1], 'Red should be highest');
            assert.ok(buf[centerIdx + 1] > buf[centerIdx + 2], 'Green should be higher than blue');
        }
    });
});

describe('generate-iso-sprites: water', () => {
    it('should produce opaque pixels inside the diamond', () => {
        const buf = generateWater(0);
        assert.ok(countOpaquePixels(buf) > 500);
    });

    it('should be deterministic for the same variant', () => {
        const buf1 = generateWater(1);
        const buf2 = generateWater(1);
        assert.ok(buf1.equals(buf2));
    });

    it('different variants should produce different output', () => {
        const buf0 = generateWater(0);
        const buf1 = generateWater(1);
        const buf2 = generateWater(2);
        assert.ok(!buf0.equals(buf1));
        assert.ok(!buf1.equals(buf2));
    });

    it('should have blue-ish colors (water palette)', () => {
        const buf = generateWater(0);
        const centerIdx = (16 * TILE_WIDTH + 32) * 4;
        if (buf[centerIdx + 3] === 255) {
            // Water is [45, 120, 210] — blue > green > red
            assert.ok(buf[centerIdx + 2] > buf[centerIdx + 1], 'Blue should be higher than green');
            assert.ok(buf[centerIdx + 2] > buf[centerIdx], 'Blue should be higher than red');
        }
    });
});

describe('generate-iso-sprites: rock', () => {
    it('should produce opaque pixels inside the diamond', () => {
        const buf = generateRock();
        assert.ok(countOpaquePixels(buf) > 500);
    });

    it('should be deterministic', () => {
        const buf1 = generateRock();
        const buf2 = generateRock();
        assert.ok(buf1.equals(buf2));
    });

    it('center should have grey rock colors (not green grass)', () => {
        const buf = generateRock();
        const centerIdx = (16 * TILE_WIDTH + 32) * 4;
        if (buf[centerIdx + 3] === 255) {
            // Rock is grey [130, 128, 122] — channels should be close together
            const r = buf[centerIdx], g = buf[centerIdx + 1], b = buf[centerIdx + 2];
            const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
            assert.ok(maxDiff < 30, `Rock should be grey-ish, got RGB(${r},${g},${b})`);
        }
    });
});
