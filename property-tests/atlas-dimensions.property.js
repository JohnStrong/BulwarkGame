/**
 * Property 12: Atlas Power-of-Two Dimensions
 *
 * For any generated atlas image, both the width and height SHALL be powers
 * of two (i.e., values in the set {256, 512, 1024, 2048}).
 *
 * Feature: enhanced-pixel-art-sprites, Property 12: Atlas Power-of-Two Dimensions
 *
 * **Validates: Requirements 4.3**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { packAtlas } = require('../js/level-generators/lib/atlas-packer');

/** Valid power-of-two dimensions for atlas images. */
const VALID_DIMENSIONS = new Set([256, 512, 1024, 2048]);

/**
 * Checks if a value is a valid power-of-two atlas dimension.
 */
function isPowerOfTwoDimension(value) {
  return VALID_DIMENSIONS.has(value);
}

/**
 * Generates a valid sprite entry for the atlas packer with small dimensions.
 */
const smallSpriteArb = (index) =>
  fc.record({
    width: fc.integer({ min: 8, max: 64 }),
    height: fc.integer({ min: 8, max: 64 }),
  }).map(({ width, height }) => ({
    name: `dim-sprite-${index}`,
    width,
    height,
    buffer: Buffer.alloc(width * height * 4, 200),
  }));

/**
 * Generates a valid sprite entry with larger dimensions to test bigger atlas sizes.
 */
const largeSpriteArb = (index) =>
  fc.record({
    width: fc.integer({ min: 64, max: 256 }),
    height: fc.integer({ min: 64, max: 256 }),
  }).map(({ width, height }) => ({
    name: `large-sprite-${index}`,
    width,
    height,
    buffer: Buffer.alloc(width * height * 4, 150),
  }));

/**
 * Generates a list of 1–20 small sprites.
 */
const smallSpritesArb = fc.integer({ min: 1, max: 20 }).chain((count) =>
  fc.tuple(...Array.from({ length: count }, (_, i) => smallSpriteArb(i)))
);

/**
 * Generates a list of 1–8 large sprites to force larger atlas dimensions.
 */
const largeSpritesArb = fc.integer({ min: 1, max: 8 }).chain((count) =>
  fc.tuple(...Array.from({ length: count }, (_, i) => largeSpriteArb(i)))
);

describe('Property 12: Atlas Power-of-Two Dimensions', () => {
  it('atlas dimensions shall be powers of two for small sprites', () => {
    fc.assert(
      fc.property(smallSpritesArb, (sprites) => {
        const { atlases, metadata } = packAtlas(sprites);

        // Check metadata reports power-of-two size
        assert.ok(
          isPowerOfTwoDimension(metadata.meta.size.w),
          `Atlas width ${metadata.meta.size.w} is not a valid power-of-two dimension (expected one of ${[...VALID_DIMENSIONS].join(', ')})`
        );
        assert.ok(
          isPowerOfTwoDimension(metadata.meta.size.h),
          `Atlas height ${metadata.meta.size.h} is not a valid power-of-two dimension (expected one of ${[...VALID_DIMENSIONS].join(', ')})`
        );

        // Verify atlas buffer sizes match power-of-two dimensions
        // The first atlas buffer should have size = width * height * 4 (RGBA)
        const expectedBufferSize = metadata.meta.size.w * metadata.meta.size.h * 4;
        assert.strictEqual(
          atlases[0].length,
          expectedBufferSize,
          `Atlas buffer size ${atlases[0].length} does not match expected ${expectedBufferSize} (${metadata.meta.size.w}x${metadata.meta.size.h}x4)`
        );
      }),
      { numRuns: 100 }
    );
  });

  it('atlas dimensions shall be powers of two for large sprites', () => {
    fc.assert(
      fc.property(largeSpritesArb, (sprites) => {
        const { atlases, metadata } = packAtlas(sprites);

        // Check metadata reports power-of-two size
        assert.ok(
          isPowerOfTwoDimension(metadata.meta.size.w),
          `Atlas width ${metadata.meta.size.w} is not a valid power-of-two dimension`
        );
        assert.ok(
          isPowerOfTwoDimension(metadata.meta.size.h),
          `Atlas height ${metadata.meta.size.h} is not a valid power-of-two dimension`
        );

        // All atlas buffers should have power-of-two dimensions
        for (let i = 0; i < atlases.length; i++) {
          const bufferPixels = atlases[i].length / 4;
          // Buffer size must be a product of two power-of-two values
          // Check that buffer length is divisible by valid widths
          let validDimensions = false;
          for (const w of VALID_DIMENSIONS) {
            const h = bufferPixels / w;
            if (Number.isInteger(h) && VALID_DIMENSIONS.has(h)) {
              validDimensions = true;
              break;
            }
          }
          assert.ok(
            validDimensions,
            `Atlas ${i} buffer size ${atlases[i].length} bytes (${bufferPixels} pixels) does not correspond to power-of-two dimensions`
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('all frames fit within the power-of-two atlas bounds', () => {
    fc.assert(
      fc.property(smallSpritesArb, (sprites) => {
        const { metadata } = packAtlas(sprites);
        const atlasW = metadata.meta.size.w;
        const atlasH = metadata.meta.size.h;

        for (const [name, entry] of Object.entries(metadata.frames)) {
          const right = entry.frame.x + entry.frame.w;
          const bottom = entry.frame.y + entry.frame.h;

          assert.ok(
            right <= atlasW,
            `Frame "${name}" extends beyond atlas width: x=${entry.frame.x} + w=${entry.frame.w} = ${right} > ${atlasW}`
          );
          assert.ok(
            bottom <= atlasH,
            `Frame "${name}" extends beyond atlas height: y=${entry.frame.y} + h=${entry.frame.h} = ${bottom} > ${atlasH}`
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
