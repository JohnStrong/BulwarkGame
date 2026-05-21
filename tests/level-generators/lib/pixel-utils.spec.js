/**
 * Tests for js/level-generators/lib/pixel-utils.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/pixel-utils.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    TILE_WIDTH,
    TILE_HEIGHT,
    BORDER_COLOR,
    seededRandom,
    resetSeed,
    createBuffer,
    setPixel,
    isInsideDiamond,
    drawEdgeBorder,
} = require('../../../js/level-generators/lib/pixel-utils');

describe('pixel-utils: re-exported constants', () => {
    it('TILE_WIDTH should be 64', () => {
        assert.equal(TILE_WIDTH, 64);
    });

    it('TILE_HEIGHT should be 32', () => {
        assert.equal(TILE_HEIGHT, 32);
    });

    it('BORDER_COLOR should be a dark RGB array', () => {
        assert.ok(Array.isArray(BORDER_COLOR));
        assert.equal(BORDER_COLOR.length, 3);
    });
});

describe('pixel-utils: seededRandom', () => {
    it('should return a number between 0 and 1', () => {
        resetSeed(42);
        for (let i = 0; i < 100; i++) {
            const val = seededRandom();
            assert.ok(val >= 0 && val <= 1, `Value ${val} out of range`);
        }
    });

    it('should produce deterministic output for the same seed', () => {
        resetSeed(12345);
        const sequence1 = [];
        for (let i = 0; i < 10; i++) sequence1.push(seededRandom());

        resetSeed(12345);
        const sequence2 = [];
        for (let i = 0; i < 10; i++) sequence2.push(seededRandom());

        assert.deepEqual(sequence1, sequence2);
    });

    it('should produce different output for different seeds', () => {
        resetSeed(100);
        const val1 = seededRandom();

        resetSeed(200);
        const val2 = seededRandom();

        assert.notEqual(val1, val2);
    });

    it('should produce varying values (not constant)', () => {
        resetSeed(999);
        const values = new Set();
        for (let i = 0; i < 50; i++) values.add(seededRandom());
        assert.ok(values.size > 40, 'PRNG should produce varied output');
    });
});

describe('pixel-utils: resetSeed', () => {
    it('should reset the PRNG state so next call is deterministic', () => {
        resetSeed(42);
        const first = seededRandom();
        resetSeed(42);
        const second = seededRandom();
        assert.equal(first, second);
    });
});

describe('pixel-utils: createBuffer', () => {
    it('should return a Buffer of correct size (64 * 32 * 4 = 8192 bytes)', () => {
        const buf = createBuffer();
        assert.ok(Buffer.isBuffer(buf));
        assert.equal(buf.length, TILE_WIDTH * TILE_HEIGHT * 4);
    });

    it('should be initialized to all zeros (transparent black)', () => {
        const buf = createBuffer();
        for (let i = 0; i < buf.length; i++) {
            assert.equal(buf[i], 0);
        }
    });
});

describe('pixel-utils: setPixel', () => {
    it('should write RGBA values at the correct buffer offset', () => {
        const buf = createBuffer();
        setPixel(buf, 10, 5, 100, 150, 200);
        const idx = (5 * TILE_WIDTH + 10) * 4;
        assert.equal(buf[idx], 100);
        assert.equal(buf[idx + 1], 150);
        assert.equal(buf[idx + 2], 200);
        assert.equal(buf[idx + 3], 255); // fully opaque
    });

    it('should clamp values above 255', () => {
        const buf = createBuffer();
        setPixel(buf, 0, 0, 300, 400, 500);
        const idx = 0;
        assert.equal(buf[idx], 255);
        assert.equal(buf[idx + 1], 255);
        assert.equal(buf[idx + 2], 255);
    });

    it('should clamp values below 0', () => {
        const buf = createBuffer();
        setPixel(buf, 0, 0, -50, -100, -200);
        const idx = 0;
        assert.equal(buf[idx], 0);
        assert.equal(buf[idx + 1], 0);
        assert.equal(buf[idx + 2], 0);
    });

    it('should round fractional values', () => {
        const buf = createBuffer();
        setPixel(buf, 0, 0, 100.7, 50.3, 200.5);
        const idx = 0;
        assert.equal(buf[idx], 101);
        assert.equal(buf[idx + 1], 50);
        assert.equal(buf[idx + 2], 201); // Math.round(200.5) = 201
    });

    it('should silently ignore out-of-bounds coordinates (negative x)', () => {
        const buf = createBuffer();
        setPixel(buf, -1, 0, 255, 0, 0);
        // Buffer should remain all zeros
        assert.equal(buf[0], 0);
    });

    it('should silently ignore out-of-bounds coordinates (x >= TILE_WIDTH)', () => {
        const buf = createBuffer();
        setPixel(buf, TILE_WIDTH, 0, 255, 0, 0);
        assert.equal(buf[0], 0);
    });

    it('should silently ignore out-of-bounds coordinates (negative y)', () => {
        const buf = createBuffer();
        setPixel(buf, 0, -1, 255, 0, 0);
        assert.equal(buf[0], 0);
    });

    it('should silently ignore out-of-bounds coordinates (y >= TILE_HEIGHT)', () => {
        const buf = createBuffer();
        setPixel(buf, 0, TILE_HEIGHT, 255, 0, 0);
        // No crash, buffer unchanged at last valid position
        const lastIdx = (TILE_HEIGHT - 1) * TILE_WIDTH * 4;
        assert.equal(buf[lastIdx], 0);
    });

    it('should write to the last valid pixel (63, 31)', () => {
        const buf = createBuffer();
        setPixel(buf, 63, 31, 42, 84, 126);
        const idx = (31 * TILE_WIDTH + 63) * 4;
        assert.equal(buf[idx], 42);
        assert.equal(buf[idx + 1], 84);
        assert.equal(buf[idx + 2], 126);
        assert.equal(buf[idx + 3], 255);
    });
});

describe('pixel-utils: isInsideDiamond', () => {
    it('should return true for the center of the diamond (32, 16)', () => {
        assert.equal(isInsideDiamond(32, 16), true);
    });

    it('should return true for points near the center', () => {
        assert.equal(isInsideDiamond(30, 16), true);
        assert.equal(isInsideDiamond(34, 16), true);
        assert.equal(isInsideDiamond(32, 14), true);
        assert.equal(isInsideDiamond(32, 18), true);
    });

    it('should return true for the diamond tips', () => {
        // Left tip: (0, 16)
        assert.equal(isInsideDiamond(0, 16), true);
        // Right tip: (63, 16) — on the boundary
        // Top tip: (32, 0)
        assert.equal(isInsideDiamond(32, 0), true);
        // Bottom tip: (32, 31) — on the boundary
    });

    it('should return false for corners of the tile', () => {
        assert.equal(isInsideDiamond(0, 0), false);
        assert.equal(isInsideDiamond(63, 0), false);
        assert.equal(isInsideDiamond(0, 31), false);
        assert.equal(isInsideDiamond(63, 31), false);
    });

    it('should return false for points clearly outside', () => {
        assert.equal(isInsideDiamond(5, 5), false);
        assert.equal(isInsideDiamond(60, 5), false);
        assert.equal(isInsideDiamond(5, 28), false);
        assert.equal(isInsideDiamond(60, 28), false);
    });

    it('boundary formula: |x-32|/32 + |y-16|/16 <= 1', () => {
        // Exactly on boundary
        assert.equal(isInsideDiamond(0, 16), true);   // |0-32|/32 + |16-16|/16 = 1
        assert.equal(isInsideDiamond(32, 0), true);   // |32-32|/32 + |0-16|/16 = 1
        // Just outside
        assert.equal(isInsideDiamond(0, 15), false);  // 1 + 1/16 > 1
    });
});

describe('pixel-utils: drawEdgeBorder', () => {
    it('should color edge pixels with BORDER_COLOR', () => {
        const buf = createBuffer();
        // Draw a small filled area
        for (let y = 10; y <= 20; y++) {
            for (let x = 20; x <= 40; x++) {
                setPixel(buf, x, y, 100, 150, 200);
            }
        }

        drawEdgeBorder(buf);

        // Check that a corner pixel (which has transparent neighbors) is now border color
        const idx = (10 * TILE_WIDTH + 20) * 4;
        assert.equal(buf[idx], BORDER_COLOR[0]);
        assert.equal(buf[idx + 1], BORDER_COLOR[1]);
        assert.equal(buf[idx + 2], BORDER_COLOR[2]);
    });

    it('should not modify transparent pixels', () => {
        const buf = createBuffer();
        setPixel(buf, 32, 16, 100, 100, 100);
        drawEdgeBorder(buf);

        // A pixel far from the drawn pixel should remain transparent
        const farIdx = (0 * TILE_WIDTH + 0) * 4;
        assert.equal(buf[farIdx + 3], 0);
    });

    it('should not modify interior pixels (those with all opaque neighbors)', () => {
        const buf = createBuffer();
        // Fill a 5x5 block
        for (let y = 10; y <= 14; y++) {
            for (let x = 10; x <= 14; x++) {
                setPixel(buf, x, y, 100, 150, 200);
            }
        }

        drawEdgeBorder(buf);

        // Center pixel (12, 12) has all opaque neighbors — should keep original color
        const centerIdx = (12 * TILE_WIDTH + 12) * 4;
        assert.equal(buf[centerIdx], 100);
        assert.equal(buf[centerIdx + 1], 150);
        assert.equal(buf[centerIdx + 2], 200);
    });
});
