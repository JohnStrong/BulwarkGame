/**
 * Property 5: Water Animation Frame Difference
 *
 * For any generated water animation sequence, the frame count SHALL be between
 * 3 and 8 inclusive, and each consecutive frame pair SHALL differ in at least
 * 10% of their non-transparent pixels.
 *
 * Feature: enhanced-pixel-art-sprites, Property 5: Water Animation Frame Difference
 *
 * **Validates: Requirements 1.3**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const {
  generateWaterFrames,
  countNonTransparentPixels,
  countDifferingPixels,
} = require('../js/level-generators/lib/animation-frames');

/**
 * Arbitrary for valid water frame counts (3–8 inclusive).
 */
const frameCountArb = fc.integer({ min: 3, max: 8 });

/**
 * Arbitrary for seed values (wide range of integers).
 */
const seedArb = fc.integer({ min: 1, max: 1_000_000 });

describe('Property 5: Water Animation Frame Difference', () => {
  it('frame count is between 3 and 8 inclusive', () => {
    fc.assert(
      fc.property(frameCountArb, seedArb, (frameCount, seed) => {
        const frames = generateWaterFrames(frameCount, seed);

        assert.ok(
          frames.length >= 3 && frames.length <= 8,
          `Expected frame count between 3 and 8, got ${frames.length}`
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

  it('each consecutive frame pair differs in at least 10% of non-transparent pixels', () => {
    fc.assert(
      fc.property(frameCountArb, seedArb, (frameCount, seed) => {
        const frames = generateWaterFrames(frameCount, seed);

        for (let i = 0; i < frames.length - 1; i++) {
          const nonTransparent = countNonTransparentPixels(frames[i]);

          // Skip if no non-transparent pixels (degenerate case)
          if (nonTransparent === 0) continue;

          const diffPixels = countDifferingPixels(frames[i], frames[i + 1]);
          const diffPercent = diffPixels / nonTransparent;

          assert.ok(
            diffPercent >= 0.10,
            `Consecutive frames ${i} and ${i + 1} differ by only ` +
            `${(diffPercent * 100).toFixed(2)}% of non-transparent pixels ` +
            `(${diffPixels}/${nonTransparent}). Expected at least 10%.`
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
