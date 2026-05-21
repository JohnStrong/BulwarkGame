/**
 * Property 3: Binary Alpha Invariant
 *
 * For any generated sprite, every pixel SHALL have an alpha value of exactly
 * 0 (fully transparent) or exactly 255 (fully opaque), with no intermediate
 * alpha values.
 *
 * Feature: enhanced-pixel-art-sprites, Property 3: Binary Alpha Invariant
 *
 * **Validates: Requirements 10.5**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { quantizeToPalette } = require('../js/level-generators/lib/palette-quantizer');
const { getPaletteForCategory } = require('../js/level-generators/lib/palette');

/**
 * Arbitrary for sprite categories.
 */
const categoryArb = fc.constantFrom('terrain', 'castle', 'unit', 'enemy');

/**
 * Generates an arbitrary RGBA pixel buffer with random pixel values,
 * including intermediate alpha values (1–254) to test that the quantizer
 * enforces binary alpha.
 */
const pixelBufferArb = fc
  .record({
    width: fc.integer({ min: 2, max: 32 }),
    height: fc.integer({ min: 2, max: 32 }),
  })
  .chain(({ width, height }) => {
    const pixelCount = width * height;
    return fc.tuple(
      fc.constant({ width, height }),
      fc.array(
        fc.record({
          r: fc.integer({ min: 0, max: 255 }),
          g: fc.integer({ min: 0, max: 255 }),
          b: fc.integer({ min: 0, max: 255 }),
          a: fc.integer({ min: 0, max: 255 }),
        }),
        { minLength: pixelCount, maxLength: pixelCount }
      )
    );
  });

/**
 * Builds an RGBA Buffer from an array of pixel objects.
 */
function buildBuffer(pixels) {
  const buffer = Buffer.alloc(pixels.length * 4);
  for (let i = 0; i < pixels.length; i++) {
    const offset = i * 4;
    buffer[offset] = pixels[i].r;
    buffer[offset + 1] = pixels[i].g;
    buffer[offset + 2] = pixels[i].b;
    buffer[offset + 3] = pixels[i].a;
  }
  return buffer;
}

describe('Property 3: Binary Alpha Invariant', () => {
  it('every pixel has alpha of exactly 0 or 255 after quantization (no intermediate alpha values)', () => {
    fc.assert(
      fc.property(categoryArb, pixelBufferArb, (category, [dims, pixels]) => {
        const palette = getPaletteForCategory(category);
        const buffer = buildBuffer(pixels);

        // Run quantization
        quantizeToPalette(buffer, palette);

        // Verify every pixel has binary alpha
        const pixelCount = dims.width * dims.height;
        for (let i = 0; i < pixelCount; i++) {
          const offset = i * 4;
          const alpha = buffer[offset + 3];

          assert.ok(
            alpha === 0 || alpha === 255,
            `Pixel at index ${i} has intermediate alpha value ${alpha} ` +
            `(expected exactly 0 or 255)`
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('pixels with alpha 0 remain fully transparent after quantization', () => {
    fc.assert(
      fc.property(categoryArb, pixelBufferArb, (category, [dims, pixels]) => {
        const palette = getPaletteForCategory(category);

        // Force some pixels to be fully transparent
        const modifiedPixels = pixels.map((p, i) =>
          i % 3 === 0 ? { ...p, a: 0 } : p
        );
        const buffer = buildBuffer(modifiedPixels);

        quantizeToPalette(buffer, palette);

        // Verify originally-transparent pixels remain transparent
        const pixelCount = dims.width * dims.height;
        for (let i = 0; i < pixelCount; i++) {
          if (i % 3 === 0) {
            const offset = i * 4;
            assert.strictEqual(
              buffer[offset + 3],
              0,
              `Pixel at index ${i} was originally transparent (alpha=0) ` +
              `but has alpha=${buffer[offset + 3]} after quantization`
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('pixels with any non-zero alpha become fully opaque (255) after quantization', () => {
    fc.assert(
      fc.property(categoryArb, pixelBufferArb, (category, [dims, pixels]) => {
        const palette = getPaletteForCategory(category);

        // Force some pixels to have intermediate alpha (1–254)
        const modifiedPixels = pixels.map((p, i) =>
          i % 2 === 0 ? { ...p, a: Math.max(1, Math.min(254, p.a || 1)) } : p
        );
        const buffer = buildBuffer(modifiedPixels);

        quantizeToPalette(buffer, palette);

        // Verify all originally non-zero alpha pixels are now 255
        const pixelCount = dims.width * dims.height;
        for (let i = 0; i < pixelCount; i++) {
          if (i % 2 === 0) {
            const offset = i * 4;
            assert.strictEqual(
              buffer[offset + 3],
              255,
              `Pixel at index ${i} had non-zero alpha but is ${buffer[offset + 3]} ` +
              `after quantization (expected 255)`
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
