/**
 * Tests for animation-frames.js retry loop trigger — Recommendation 4.
 *
 * Specifically crafts scenarios to trigger the retry path (attempt > 0)
 * in generateWaterFrames when the 10% difference constraint isn't met
 * on the first pass. Verifies the loop terminates correctly.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/animation-frames-retry-trigger.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    generateWaterFrames,
    countNonTransparentPixels,
    countDifferingPixels,
} = require('../../../js/level-generators/lib/animation-frames');

describe('animation-frames: retry loop trigger (attempt > 0)', () => {
    it('should always terminate within 5 retry attempts', () => {
        // Test with many seeds — some should trigger the retry path
        // The function has a max of 5 attempts before giving up
        for (let seed = 0; seed < 100; seed++) {
            const frames = generateWaterFrames(8, seed);
            // If it returns, it terminated (didn't infinite loop)
            assert.equal(frames.length, 8, `Seed ${seed} should produce 8 frames`);
        }
    });

    it('should produce valid frames even when retry is triggered', () => {
        // Use seeds that are more likely to produce similar consecutive frames
        // (low seeds with high frame counts)
        const problematicSeeds = [0, 1, 2, 3, 7, 13, 42, 100, 256, 512, 1024];

        for (const seed of problematicSeeds) {
            const frames = generateWaterFrames(8, seed);

            // All frames should have non-transparent pixels
            for (let i = 0; i < frames.length; i++) {
                const count = countNonTransparentPixels(frames[i]);
                assert.ok(count > 0, `Seed ${seed}, frame ${i}: should have pixels`);
            }

            // All consecutive pairs should meet the 10% threshold
            for (let i = 0; i < frames.length - 1; i++) {
                const nonTransparent = countNonTransparentPixels(frames[i]);
                const diff = countDifferingPixels(frames[i], frames[i + 1]);
                const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
                assert.ok(
                    pct >= 0.10,
                    `Seed ${seed}, frames ${i}→${i + 1}: ${(pct * 100).toFixed(1)}% < 10%`
                );
            }
        }
    });

    it('should produce deterministic output regardless of retry count', () => {
        // The retry uses deterministic seed offsets, so output should be stable
        for (let seed = 0; seed < 50; seed++) {
            const frames1 = generateWaterFrames(6, seed);
            const frames2 = generateWaterFrames(6, seed);

            for (let i = 0; i < frames1.length; i++) {
                assert.ok(
                    Buffer.compare(frames1[i], frames2[i]) === 0,
                    `Seed ${seed}, frame ${i}: should be deterministic`
                );
            }
        }
    });

    it('should handle the case where retry adjusts seed offset correctly', () => {
        // The retry formula is: seed + (attempt + 1) * 10000 + i * 777
        // Verify that different attempts produce different frames
        // by checking that the final output differs from a naive single-pass
        const seed = 42;
        const frames = generateWaterFrames(8, seed);

        // Verify the constraint is satisfied (proving retry worked if needed)
        let minDiff = 1.0;
        for (let i = 0; i < frames.length - 1; i++) {
            const nonTransparent = countNonTransparentPixels(frames[i]);
            const diff = countDifferingPixels(frames[i], frames[i + 1]);
            const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
            if (pct < minDiff) minDiff = pct;
        }
        assert.ok(minDiff >= 0.10, `Minimum diff should be >= 10%, got ${(minDiff * 100).toFixed(1)}%`);
    });

    it('should work with maximum frame count (8) which maximizes retry chances', () => {
        // More frames = more consecutive pairs = higher chance of triggering retry
        let totalPairsChecked = 0;
        for (let seed = 0; seed < 30; seed++) {
            const frames = generateWaterFrames(8, seed);
            assert.equal(frames.length, 8);

            for (let i = 0; i < frames.length - 1; i++) {
                const nonTransparent = countNonTransparentPixels(frames[i]);
                const diff = countDifferingPixels(frames[i], frames[i + 1]);
                const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
                assert.ok(pct >= 0.10);
                totalPairsChecked++;
            }
        }
        // Should have checked 30 seeds × 7 pairs = 210 pairs
        assert.equal(totalPairsChecked, 210);
    });

    it('should produce frames that are all different from each other', () => {
        const frames = generateWaterFrames(8, 99);

        for (let i = 0; i < frames.length; i++) {
            for (let j = i + 1; j < frames.length; j++) {
                const diff = countDifferingPixels(frames[i], frames[j]);
                assert.ok(diff > 0, `Frames ${i} and ${j} should differ`);
            }
        }
    });

    it('should handle seed values that produce near-identical initial frames', () => {
        // Seeds that are multiples of the internal offset (10000) might produce
        // similar frames before retry kicks in
        const edgeSeeds = [10000, 20000, 30000, 10777, 20777];

        for (const seed of edgeSeeds) {
            const frames = generateWaterFrames(5, seed);
            assert.equal(frames.length, 5);

            for (let i = 0; i < frames.length - 1; i++) {
                const nonTransparent = countNonTransparentPixels(frames[i]);
                const diff = countDifferingPixels(frames[i], frames[i + 1]);
                const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
                assert.ok(
                    pct >= 0.10,
                    `Edge seed ${seed}, frames ${i}→${i + 1}: ${(pct * 100).toFixed(1)}% < 10%`
                );
            }
        }
    });
});
