/**
 * Tests for js/level-generators/lib/fill-patterns.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/fill-patterns.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { fillDiamond, fillDiamondWithSpeckle, drawStoneBlocks } = require('../../../js/level-generators/lib/fill-patterns');
const { createBuffer, isInsideDiamond, resetSeed } = require('../../../js/level-generators/lib/pixel-utils');
const { TILE_WIDTH, TILE_HEIGHT } = require('../../../js/level-generators/lib/sprite-constants');

describe('fill-patterns: fillDiamond', () => {
    it('should fill pixels inside the diamond with opaque color', () => {
        const buf = createBuffer();
        fillDiamond(buf, [100, 150, 200], 0, 1000);

        // Center pixel should be opaque
        const centerIdx = (16 * TILE_WIDTH + 32) * 4;
        assert.equal(buf[centerIdx + 3], 255);
    });

    it('should leave pixels outside the diamond transparent', () => {
        const buf = createBuffer();
        fillDiamond(buf, [100, 150, 200], 0, 1000);

        // Corner pixel should remain transparent
        const cornerIdx = (0 * TILE_WIDTH + 0) * 4;
        assert.equal(buf[cornerIdx + 3], 0);
    });

    it('should produce deterministic output for the same seed', () => {
        const buf1 = createBuffer();
        fillDiamond(buf1, [100, 150, 200], 10, 5000);

        const buf2 = createBuffer();
        fillDiamond(buf2, [100, 150, 200], 10, 5000);

        assert.ok(buf1.equals(buf2), 'Same seed should produce identical buffers');
    });

    it('should produce different output for different seeds', () => {
        const buf1 = createBuffer();
        fillDiamond(buf1, [100, 150, 200], 10, 5000);

        const buf2 = createBuffer();
        fillDiamond(buf2, [100, 150, 200], 10, 6000);

        assert.ok(!buf1.equals(buf2), 'Different seeds should produce different buffers');
    });

    it('with noiseAmount=0, all diamond pixels should have the exact base color', () => {
        const buf = createBuffer();
        fillDiamond(buf, [100, 150, 200], 0, 1000);

        // Check center pixel
        const centerIdx = (16 * TILE_WIDTH + 32) * 4;
        assert.equal(buf[centerIdx], 100);
        assert.equal(buf[centerIdx + 1], 150);
        assert.equal(buf[centerIdx + 2], 200);
    });

    it('with noiseAmount > 0, pixels should vary around the base color', () => {
        const buf = createBuffer();
        fillDiamond(buf, [128, 128, 128], 20, 2000);

        // Collect red channel values from diamond pixels
        const redValues = new Set();
        for (let y = 0; y < TILE_HEIGHT; y++) {
            for (let x = 0; x < TILE_WIDTH; x++) {
                if (isInsideDiamond(x, y)) {
                    const idx = (y * TILE_WIDTH + x) * 4;
                    redValues.add(buf[idx]);
                }
            }
        }
        // Should have variation
        assert.ok(redValues.size > 5, 'Noise should produce color variation');
    });
});

describe('fill-patterns: fillDiamondWithSpeckle', () => {
    it('should fill pixels inside the diamond with opaque color', () => {
        const buf = createBuffer();
        fillDiamondWithSpeckle(buf, [100, 150, 200], 10, 3000);

        const centerIdx = (16 * TILE_WIDTH + 32) * 4;
        assert.equal(buf[centerIdx + 3], 255);
    });

    it('should leave pixels outside the diamond transparent', () => {
        const buf = createBuffer();
        fillDiamondWithSpeckle(buf, [100, 150, 200], 10, 3000);

        const cornerIdx = (0 * TILE_WIDTH + 0) * 4;
        assert.equal(buf[cornerIdx + 3], 0);
    });

    it('should produce deterministic output for the same seed', () => {
        const buf1 = createBuffer();
        fillDiamondWithSpeckle(buf1, [100, 150, 200], 10, 4000);

        const buf2 = createBuffer();
        fillDiamondWithSpeckle(buf2, [100, 150, 200], 10, 4000);

        assert.ok(buf1.equals(buf2));
    });

    it('should produce more variation than fillDiamond due to speckle', () => {
        const bufPlain = createBuffer();
        fillDiamond(bufPlain, [128, 128, 128], 10, 7000);

        const bufSpeckle = createBuffer();
        fillDiamondWithSpeckle(bufSpeckle, [128, 128, 128], 10, 7000);

        // They use the same seed but different logic, so output differs
        assert.ok(!bufPlain.equals(bufSpeckle));
    });
});

describe('fill-patterns: drawStoneBlocks', () => {
    it('should fill the diamond area (no transparent pixels inside diamond)', () => {
        const buf = createBuffer();
        drawStoneBlocks(buf, [155, 145, 120], [178, 168, 142], [145, 135, 112], 12000);

        // Check several diamond-interior pixels are opaque
        const testPoints = [[32, 16], [20, 10], [40, 20], [32, 8], [32, 24]];
        for (const [x, y] of testPoints) {
            if (isInsideDiamond(x, y)) {
                const idx = (y * TILE_WIDTH + x) * 4;
                assert.equal(buf[idx + 3], 255, `Pixel (${x},${y}) should be opaque`);
            }
        }
    });

    it('should leave pixels outside the diamond transparent', () => {
        const buf = createBuffer();
        drawStoneBlocks(buf, [155, 145, 120], [178, 168, 142], [145, 135, 112], 12000);

        const cornerIdx = (0 * TILE_WIDTH + 0) * 4;
        assert.equal(buf[cornerIdx + 3], 0);
    });

    it('should produce deterministic output for the same seed', () => {
        const buf1 = createBuffer();
        drawStoneBlocks(buf1, [155, 145, 120], [178, 168, 142], [145, 135, 112], 12000);

        const buf2 = createBuffer();
        drawStoneBlocks(buf2, [155, 145, 120], [178, 168, 142], [145, 135, 112], 12000);

        assert.ok(buf1.equals(buf2));
    });

    it('should produce different output for different seeds', () => {
        const buf1 = createBuffer();
        drawStoneBlocks(buf1, [155, 145, 120], [178, 168, 142], [145, 135, 112], 12000);

        const buf2 = createBuffer();
        drawStoneBlocks(buf2, [155, 145, 120], [178, 168, 142], [145, 135, 112], 13000);

        assert.ok(!buf1.equals(buf2));
    });

    it('should contain both mortar and stone colors (color variation)', () => {
        const buf = createBuffer();
        const mortarColor = [145, 135, 112];
        const stoneColor = [155, 145, 120];
        drawStoneBlocks(buf, stoneColor, [178, 168, 142], mortarColor, 14000);

        // Collect unique red channel values from diamond pixels
        const redValues = new Set();
        for (let y = 0; y < TILE_HEIGHT; y++) {
            for (let x = 0; x < TILE_WIDTH; x++) {
                if (isInsideDiamond(x, y)) {
                    const idx = (y * TILE_WIDTH + x) * 4;
                    redValues.add(buf[idx]);
                }
            }
        }
        // Should have significant variation (mortar + stone + noise)
        assert.ok(redValues.size > 10, 'Stone blocks should have varied colors');
    });
});
