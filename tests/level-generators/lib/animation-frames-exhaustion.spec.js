/**
 * Tests for animation-frames retry exhaustion (Recommendation 6).
 *
 * Verifies that generateWaterFrames() handles the retry loop correctly,
 * including cases that may require multiple retry attempts to satisfy
 * the 10% difference constraint.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/animation-frames-exhaustion.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    generateWaterFrames,
    countNonTransparentPixels,
    countDifferingPixels,
} = require('../../../js/level-generators/lib/animation-frames');

describe('animation-frames: retry exhaustion and edge cases', () => {
    it('should always satisfy 10% constraint even with pathological seeds', () => {
        // Test a wide range of seeds including ones that might trigger retries
        const pathologicalSeeds = [0, 1, 2, 3, 7, 13, 42, 100, 255, 1000, 9999, 65535, 999999];

        for (const seed of pathologicalSeeds) {
            const frames = generateWaterFrames(8, seed);
            assert.equal(frames.length, 8, `Seed ${seed}: should produce 8 frames`);

            for (let i = 0; i < frames.length - 1; i++) {
                const nonTransparent = countNonTransparentPixels(frames[i]);
                const diff = countDifferingPixels(frames[i], frames[i + 1]);
                const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
                assert.ok(pct >= 0.10,
                    `Seed ${seed}, frames ${i}→${i + 1}: diff ${(pct * 100).toFixed(1)}% < 10%`);
            }
        }
    });

    it('should terminate within 5 retry attempts for all tested seeds', () => {
        // The function has a max of 5 retry attempts. We verify it always
        // produces valid output (doesn't hang or throw) for many seeds.
        for (let seed = 0; seed < 100; seed++) {
            const frames = generateWaterFrames(6, seed);
            assert.equal(frames.length, 6, `Seed ${seed}: should produce 6 frames`);
        }
    });

    it('should produce valid frames with consecutive seed values', () => {
        // Consecutive seeds might produce similar noise patterns,
        // potentially triggering the retry mechanism
        for (let seed = 10000; seed < 10050; seed++) {
            const frames = generateWaterFrames(5, seed);
            for (let i = 0; i < frames.length - 1; i++) {
                const nonTransparent = countNonTransparentPixels(frames[i]);
                const diff = countDifferingPixels(frames[i], frames[i + 1]);
                const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
                assert.ok(pct >= 0.10,
                    `Seed ${seed}, pair ${i}→${i + 1}: ${(pct * 100).toFixed(1)}% < 10%`);
            }
        }
    });

    it('should handle maximum frame count (8) with seeds near overflow', () => {
        // Seeds near integer overflow boundaries
        const overflowSeeds = [
            0x7FFFFFFF, // max signed 32-bit
            0x7FFFFFFE,
            0xFFFFFFFE, // near max unsigned 32-bit
            -1,         // negative seed
            -999999,
        ];

        for (const seed of overflowSeeds) {
            const frames = generateWaterFrames(8, seed);
            assert.equal(frames.length, 8, `Seed ${seed}: should produce 8 frames`);

            for (let i = 0; i < frames.length - 1; i++) {
                const nonTransparent = countNonTransparentPixels(frames[i]);
                const diff = countDifferingPixels(frames[i], frames[i + 1]);
                const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
                assert.ok(pct >= 0.10,
                    `Seed ${seed}, pair ${i}→${i + 1}: ${(pct * 100).toFixed(1)}% < 10%`);
            }
        }
    });

    it('should produce non-empty frames after retry', () => {
        // Verify that retried frames still have meaningful content
        for (let seed = 500; seed < 520; seed++) {
            const frames = generateWaterFrames(7, seed);
            for (let i = 0; i < frames.length; i++) {
                const count = countNonTransparentPixels(frames[i]);
                assert.ok(count > 100,
                    `Seed ${seed}, frame ${i}: should have >100 non-transparent pixels (has ${count})`);
            }
        }
    });

    it('should maintain determinism even when retries are triggered', () => {
        // Run the same generation twice and verify identical output
        for (let seed = 0; seed < 30; seed++) {
            const frames1 = generateWaterFrames(8, seed);
            const frames2 = generateWaterFrames(8, seed);
            for (let i = 0; i < frames1.length; i++) {
                assert.ok(Buffer.compare(frames1[i], frames2[i]) === 0,
                    `Seed ${seed}, frame ${i}: should be deterministic`);
            }
        }
    });

    it('should throw for invalid frame counts', () => {
        assert.throws(() => generateWaterFrames(2, 42), /Invalid water frame count/);
        assert.throws(() => generateWaterFrames(9, 42), /Invalid water frame count/);
        assert.throws(() => generateWaterFrames(0, 42), /Invalid water frame count/);
        assert.throws(() => generateWaterFrames(-1, 42), /Invalid water frame count/);
    });
});
