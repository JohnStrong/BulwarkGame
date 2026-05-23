/**
 * Property: Flag Animation Frame Difference
 *
 * For any generated flag animation sequence, the frame count SHALL be between
 * 2 and 6 inclusive, and each consecutive frame pair SHALL differ in at least
 * one non-transparent pixel (visible animation movement).
 *
 * Feature: enhanced-pixel-art-sprites
 * Recommendation 6: Add flag animation frame tests
 *
 * **Validates: Requirements 5.3**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const {
    generateFlagFrames,
    countNonTransparentPixels,
    countDifferingPixels,
} = require('../js/level-generators/lib/animation-frames');

/**
 * Arbitrary for valid flag frame counts (2–6 inclusive).
 */
const frameCountArb = fc.integer({ min: 2, max: 6 });

/**
 * Arbitrary for seed values (wide range of integers).
 */
const seedArb = fc.integer({ min: 1, max: 1_000_000 });

describe('Flag Animation Frame Difference', () => {
    it('frame count is between 2 and 6 inclusive', () => {
        fc.assert(
            fc.property(frameCountArb, seedArb, (frameCount, seed) => {
                const frames = generateFlagFrames(frameCount, seed);

                assert.ok(
                    frames.length >= 2 && frames.length <= 6,
                    `Expected frame count between 2 and 6, got ${frames.length}`
                );
                assert.strictEqual(
                    frames.length,
                    frameCount,
                    `Expected ${frameCount} frames, got ${frames.length}`
                );
            }),
            { numRuns: 100 }
        );
    });

    it('each frame should contain non-transparent pixels (flag is visible)', () => {
        fc.assert(
            fc.property(frameCountArb, seedArb, (frameCount, seed) => {
                const frames = generateFlagFrames(frameCount, seed);

                for (let i = 0; i < frames.length; i++) {
                    const nonTransparent = countNonTransparentPixels(frames[i]);
                    assert.ok(
                        nonTransparent > 0,
                        `Frame ${i} should have at least one non-transparent pixel`
                    );
                }
            }),
            { numRuns: 100 }
        );
    });

    it('each consecutive frame pair should differ in at least one pixel', () => {
        fc.assert(
            fc.property(frameCountArb, seedArb, (frameCount, seed) => {
                const frames = generateFlagFrames(frameCount, seed);

                for (let i = 0; i < frames.length - 1; i++) {
                    const diffPixels = countDifferingPixels(frames[i], frames[i + 1]);

                    assert.ok(
                        diffPixels > 0,
                        `Consecutive frames ${i} and ${i + 1} should differ ` +
                        `in at least one pixel (got ${diffPixels} differing pixels). ` +
                        `Seed: ${seed}, frameCount: ${frameCount}`
                    );
                }
            }),
            { numRuns: 100 }
        );
    });

    it('all frames should have consistent buffer size (TILE_WIDTH * TILE_HEIGHT * 4)', () => {
        fc.assert(
            fc.property(frameCountArb, seedArb, (frameCount, seed) => {
                const frames = generateFlagFrames(frameCount, seed);
                const expectedSize = 64 * 32 * 4; // TILE_WIDTH * TILE_HEIGHT * 4 channels

                for (let i = 0; i < frames.length; i++) {
                    assert.strictEqual(
                        frames[i].length,
                        expectedSize,
                        `Frame ${i} buffer size should be ${expectedSize}, got ${frames[i].length}`
                    );
                }
            }),
            { numRuns: 50 }
        );
    });

    it('should throw for frame count below minimum (< 2)', () => {
        assert.throws(
            () => generateFlagFrames(1, 42),
            (err) => err.message.includes('Invalid flag frame count')
        );
    });

    it('should throw for frame count above maximum (> 6)', () => {
        assert.throws(
            () => generateFlagFrames(7, 42),
            (err) => err.message.includes('Invalid flag frame count')
        );
    });

    it('should be deterministic — same seed produces same frames', () => {
        fc.assert(
            fc.property(frameCountArb, seedArb, (frameCount, seed) => {
                const frames1 = generateFlagFrames(frameCount, seed);
                const frames2 = generateFlagFrames(frameCount, seed);

                assert.strictEqual(frames1.length, frames2.length);
                for (let i = 0; i < frames1.length; i++) {
                    assert.ok(
                        frames1[i].equals(frames2[i]),
                        `Frame ${i} should be identical for same seed`
                    );
                }
            }),
            { numRuns: 50 }
        );
    });
});
