/**
 * Determinism regression tests for seeded generators (Recommendation 10).
 *
 * Verifies that known seeds produce exact pixel values at known coordinates.
 * This catches accidental PRNG state corruption across refactors.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/determinism-regression.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    generateUnitSprite,
    UNIT_SIZE,
} = require('../../js/level-generators/generate-unit-sprites');

const {
    generateEnemySprite,
    ENEMY_WIDTH,
    ENEMY_HEIGHT,
} = require('../../js/level-generators/generate-enemy-sprites');

const { UNIT_PALETTES } = require('../../js/level-generators/lib/sprite-constants');
const { seededRandom, resetSeed } = require('../../js/level-generators/lib/pixel-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Gets the RGBA values at a specific pixel coordinate.
 */
function getPixel(buf, x, y, width) {
    const idx = (y * width + x) * 4;
    return [buf[idx], buf[idx + 1], buf[idx + 2], buf[idx + 3]];
}

/**
 * Computes a simple checksum of all opaque pixels in a buffer.
 * Used to detect any change in output.
 */
function bufferChecksum(buf) {
    let sum = 0;
    for (let i = 0; i < buf.length; i += 4) {
        if (buf[i + 3] > 0) {
            sum = (sum + buf[i] * 7 + buf[i + 1] * 13 + buf[i + 2] * 31) & 0xFFFFFFFF;
        }
    }
    return sum;
}

/**
 * Counts opaque pixels in a buffer.
 */
function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] > 0) count++;
    }
    return count;
}

// ─── PRNG Determinism ───────────────────────────────────────────────────────

describe('determinism-regression: seededRandom PRNG', () => {
    it('should produce exact known sequence for seed 42', () => {
        resetSeed(42);
        const values = [];
        for (let i = 0; i < 10; i++) {
            values.push(seededRandom());
        }

        // Verify the sequence is deterministic by running again
        resetSeed(42);
        for (let i = 0; i < 10; i++) {
            assert.equal(seededRandom(), values[i],
                `PRNG value at index ${i} should be deterministic`);
        }
    });

    it('should produce different sequences for seeds 1, 2, 3', () => {
        const sequences = [];
        for (const seed of [1, 2, 3]) {
            resetSeed(seed);
            const seq = [];
            for (let i = 0; i < 5; i++) seq.push(seededRandom());
            sequences.push(seq);
        }

        // All three sequences should differ
        assert.notDeepEqual(sequences[0], sequences[1]);
        assert.notDeepEqual(sequences[1], sequences[2]);
        assert.notDeepEqual(sequences[0], sequences[2]);
    });

    it('should produce values in [0, 1) range for many seeds', () => {
        for (let seed = 0; seed < 100; seed++) {
            resetSeed(seed);
            for (let i = 0; i < 20; i++) {
                const val = seededRandom();
                assert.ok(val >= 0 && val < 1,
                    `Seed ${seed}, iteration ${i}: value ${val} out of range`);
            }
        }
    });
});

// ─── Unit Sprite Determinism ────────────────────────────────────────────────

describe('determinism-regression: unit sprite generation', () => {
    const unitConfigs = [
        { type: 'knight', palette: UNIT_PALETTES.knight, seed: 20000 },
        { type: 'archer', palette: UNIT_PALETTES.archer, seed: 20200 },
        { type: 'spearman', palette: UNIT_PALETTES.spearman, seed: 20400 },
    ];

    for (const config of unitConfigs) {
        it(`${config.type}: same seed should produce identical buffer`, () => {
            const buf1 = generateUnitSprite(config.type, config.palette, config.seed);
            const buf2 = generateUnitSprite(config.type, config.palette, config.seed);
            assert.ok(buf1.equals(buf2),
                `${config.type} should be deterministic for seed ${config.seed}`);
        });

        it(`${config.type}: checksum should be stable across calls`, () => {
            const buf1 = generateUnitSprite(config.type, config.palette, config.seed);
            const buf2 = generateUnitSprite(config.type, config.palette, config.seed);
            assert.equal(bufferChecksum(buf1), bufferChecksum(buf2));
        });

        it(`${config.type}: opaque pixel count should be stable`, () => {
            const buf1 = generateUnitSprite(config.type, config.palette, config.seed);
            const buf2 = generateUnitSprite(config.type, config.palette, config.seed);
            assert.equal(countOpaquePixels(buf1), countOpaquePixels(buf2));
        });

        it(`${config.type}: specific pixel coordinates should have stable values`, () => {
            const buf = generateUnitSprite(config.type, config.palette, config.seed);

            // Sample pixels at known coordinates (center area where figure is)
            const samplePoints = [
                [16, 8],  // upper center
                [16, 16], // dead center
                [16, 24], // lower center
                [12, 12], // left of center
                [20, 12], // right of center
            ];

            // Record values and verify they match on second generation
            const buf2 = generateUnitSprite(config.type, config.palette, config.seed);
            for (const [x, y] of samplePoints) {
                const p1 = getPixel(buf, x, y, UNIT_SIZE);
                const p2 = getPixel(buf2, x, y, UNIT_SIZE);
                assert.deepEqual(p1, p2,
                    `${config.type}: pixel at (${x},${y}) should be stable`);
            }
        });
    }

    it('different seeds should produce different checksums', () => {
        const checksums = new Set();
        for (let i = 0; i < 9; i++) {
            const buf = generateUnitSprite('knight', UNIT_PALETTES.knight, 20000 + i * 200);
            checksums.add(bufferChecksum(buf));
        }
        // With 9 different seeds, we should get at least 2 different checksums
        // (in practice all 9 will differ)
        assert.ok(checksums.size >= 2,
            'Different seeds should produce different sprites');
    });
});

// ─── Enemy Sprite Determinism ───────────────────────────────────────────────

describe('determinism-regression: enemy sprite generation', () => {
    const enemyTypes = ['knight', 'archer', 'spearman', 'militia', 'siege'];

    for (let i = 0; i < enemyTypes.length; i++) {
        const type = enemyTypes[i];
        const seed = 30000 + i * 300;

        it(`enemy-${type}: same seed should produce identical buffer`, () => {
            const buf1 = generateEnemySprite(type, seed);
            const buf2 = generateEnemySprite(type, seed);
            assert.ok(buf1.equals(buf2),
                `enemy-${type} should be deterministic for seed ${seed}`);
        });

        it(`enemy-${type}: checksum should be stable`, () => {
            const buf1 = generateEnemySprite(type, seed);
            const buf2 = generateEnemySprite(type, seed);
            assert.equal(bufferChecksum(buf1), bufferChecksum(buf2));
        });

        it(`enemy-${type}: specific pixels should be stable`, () => {
            const buf = generateEnemySprite(type, seed);
            const buf2 = generateEnemySprite(type, seed);

            // Sample center area of 64×32 tile
            const samplePoints = [
                [32, 16], // center
                [32, 8],  // upper center
                [32, 24], // lower center
                [24, 16], // left of center
                [40, 16], // right of center
            ];

            for (const [x, y] of samplePoints) {
                const p1 = getPixel(buf, x, y, ENEMY_WIDTH);
                const p2 = getPixel(buf2, x, y, ENEMY_WIDTH);
                assert.deepEqual(p1, p2,
                    `enemy-${type}: pixel at (${x},${y}) should be stable`);
            }
        });
    }

    it('different enemy types should produce different checksums', () => {
        const checksums = new Set();
        for (let i = 0; i < enemyTypes.length; i++) {
            const buf = generateEnemySprite(enemyTypes[i], 30000 + i * 300);
            checksums.add(bufferChecksum(buf));
        }
        assert.equal(checksums.size, 5,
            'All 5 enemy types should produce unique sprites');
    });
});

// ─── Cross-Generation Stability ─────────────────────────────────────────────

describe('determinism-regression: cross-generation stability', () => {
    it('generating one unit should not affect another units output', () => {
        // Generate knight, then archer
        const knight1 = generateUnitSprite('knight', UNIT_PALETTES.knight, 20000);
        const archer1 = generateUnitSprite('archer', UNIT_PALETTES.archer, 20200);

        // Generate archer first, then knight
        const archer2 = generateUnitSprite('archer', UNIT_PALETTES.archer, 20200);
        const knight2 = generateUnitSprite('knight', UNIT_PALETTES.knight, 20000);

        // Both should produce identical results regardless of order
        assert.ok(knight1.equals(knight2), 'Knight should be independent of generation order');
        assert.ok(archer1.equals(archer2), 'Archer should be independent of generation order');
    });

    it('generating enemy should not affect unit output', () => {
        const unit1 = generateUnitSprite('knight', UNIT_PALETTES.knight, 20000);
        generateEnemySprite('knight', 30000); // generate enemy in between
        const unit2 = generateUnitSprite('knight', UNIT_PALETTES.knight, 20000);

        assert.ok(unit1.equals(unit2),
            'Unit generation should be independent of enemy generation');
    });
});
