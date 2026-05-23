/**
 * Tests for animation-frames.js retry logic in generateWaterFrames.
 *
 * Covers:
 * - The retry mechanism when consecutive frames don't meet 10% difference threshold
 * - Verifying that the retry produces valid frames after adjustment
 * - Edge cases with minimum and maximum frame counts
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/animation-frames-retry.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    generateWaterFrames,
    countNonTransparentPixels,
    countDifferingPixels,
} = require('../../../js/level-generators/lib/animation-frames');

describe('animation-frames: generateWaterFrames retry logic', () => {
    it('should satisfy 10% difference constraint for all consecutive pairs with seed 1', () => {
        const frames = generateWaterFrames(8, 1);
        for (let i = 0; i < frames.length - 1; i++) {
            const nonTransparent = countNonTransparentPixels(frames[i]);
            const diff = countDifferingPixels(frames[i], frames[i + 1]);
            const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
            assert.ok(
                pct >= 0.10,
                `Frames ${i}→${i + 1}: diff ${(pct * 100).toFixed(1)}% < 10% (seed=1)`
            );
        }
    });

    it('should satisfy constraint across many different seeds', () => {
        // Test with 20 different seeds to exercise retry paths
        for (let seed = 0; seed < 20; seed++) {
            const frames = generateWaterFrames(5, seed * 7777);
            for (let i = 0; i < frames.length - 1; i++) {
                const nonTransparent = countNonTransparentPixels(frames[i]);
                const diff = countDifferingPixels(frames[i], frames[i + 1]);
                const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
                assert.ok(
                    pct >= 0.10,
                    `Seed ${seed * 7777}, frames ${i}→${i + 1}: diff ${(pct * 100).toFixed(1)}% < 10%`
                );
            }
        }
    });

    it('should satisfy constraint with maximum frame count (8 frames)', () => {
        // More frames = more consecutive pairs = more chances for retry
        for (let seed = 100; seed < 110; seed++) {
            const frames = generateWaterFrames(8, seed);
            for (let i = 0; i < frames.length - 1; i++) {
                const nonTransparent = countNonTransparentPixels(frames[i]);
                const diff = countDifferingPixels(frames[i], frames[i + 1]);
                const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
                assert.ok(
                    pct >= 0.10,
                    `Seed ${seed}, 8 frames, pair ${i}→${i + 1}: diff ${(pct * 100).toFixed(1)}% < 10%`
                );
            }
        }
    });

    it('should satisfy constraint with minimum frame count (3 frames)', () => {
        for (let seed = 200; seed < 210; seed++) {
            const frames = generateWaterFrames(3, seed);
            for (let i = 0; i < frames.length - 1; i++) {
                const nonTransparent = countNonTransparentPixels(frames[i]);
                const diff = countDifferingPixels(frames[i], frames[i + 1]);
                const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
                assert.ok(
                    pct >= 0.10,
                    `Seed ${seed}, 3 frames, pair ${i}→${i + 1}: diff ${(pct * 100).toFixed(1)}% < 10%`
                );
            }
        }
    });

    it('should produce deterministic results even when retry is triggered', () => {
        // Same seed should always produce same output regardless of retries
        const frames1 = generateWaterFrames(6, 42);
        const frames2 = generateWaterFrames(6, 42);
        for (let i = 0; i < frames1.length; i++) {
            assert.ok(
                Buffer.compare(frames1[i], frames2[i]) === 0,
                `Frame ${i} should be identical for same seed even with retries`
            );
        }
    });

    it('should produce frames with non-zero non-transparent pixel count', () => {
        // Ensures retry doesn't produce empty frames
        for (let seed = 300; seed < 310; seed++) {
            const frames = generateWaterFrames(5, seed);
            for (let i = 0; i < frames.length; i++) {
                const count = countNonTransparentPixels(frames[i]);
                assert.ok(count > 0, `Seed ${seed}, frame ${i} should have non-transparent pixels`);
            }
        }
    });

    it('should handle seed value of 0', () => {
        const frames = generateWaterFrames(4, 0);
        assert.equal(frames.length, 4);
        for (let i = 0; i < frames.length - 1; i++) {
            const nonTransparent = countNonTransparentPixels(frames[i]);
            const diff = countDifferingPixels(frames[i], frames[i + 1]);
            const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
            assert.ok(pct >= 0.10, `Seed 0, frames ${i}→${i + 1}: diff ${(pct * 100).toFixed(1)}% < 10%`);
        }
    });

    it('should handle very large seed values', () => {
        const frames = generateWaterFrames(4, 999999999);
        assert.equal(frames.length, 4);
        for (let i = 0; i < frames.length - 1; i++) {
            const nonTransparent = countNonTransparentPixels(frames[i]);
            const diff = countDifferingPixels(frames[i], frames[i + 1]);
            const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
            assert.ok(pct >= 0.10, `Large seed, frames ${i}→${i + 1}: diff ${(pct * 100).toFixed(1)}% < 10%`);
        }
    });
});
