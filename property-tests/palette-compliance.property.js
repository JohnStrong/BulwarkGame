/**
 * Property 2: Palette Quantization Exactness
 *
 * For any generated sprite (terrain, castle, unit, enemy, or damaged variant),
 * every non-transparent pixel SHALL exactly match a color in the defined palette
 * for that sprite's category (primary palette + category-specific extensions),
 * with zero Euclidean color distance.
 *
 * Feature: enhanced-pixel-art-sprites, Property 2: Palette Quantization Exactness
 *
 * **Validates: Requirements 10.2, 2.5, 9.4**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { quantizeToPalette, colorDistanceSq } = require('../js/level-generators/lib/palette-quantizer');
const { getPaletteForCategory } = require('../js/level-generators/lib/palette');

/**
 * Arbitrary for sprite categories.
 */
const categoryArb = fc.constantFrom('terrain', 'castle', 'unit', 'enemy');

/**
 * Generates an arbitrary RGBA pixel buffer with random pixel values.
 * Dimensions are constrained to small sizes for fast execution.
 * Pixels have random RGB values and alpha of either 0 or a random non-zero value
 * (to test that the quantizer handles intermediate alpha correctly).
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

describe('Property 2: Palette Quantization Exactness', () => {
  it('every non-transparent pixel exactly matches a palette color after quantization (zero Euclidean distance)', () => {
    fc.assert(
      fc.property(categoryArb, pixelBufferArb, (category, [dims, pixels]) => {
        const palette = getPaletteForCategory(category);
        const buffer = buildBuffer(pixels);

        // Run quantization
        quantizeToPalette(buffer, palette);

        // Verify every non-transparent pixel exactly matches a palette color
        const pixelCount = dims.width * dims.height;
        for (let i = 0; i < pixelCount; i++) {
          const offset = i * 4;
          const alpha = buffer[offset + 3];

          // Skip fully transparent pixels
          if (alpha === 0) continue;

          const r = buffer[offset];
          const g = buffer[offset + 1];
          const b = buffer[offset + 2];

          // Find if this color exists exactly in the palette
          let exactMatch = false;
          for (let p = 0; p < palette.length; p++) {
            if (r === palette[p][0] && g === palette[p][1] && b === palette[p][2]) {
              exactMatch = true;
              break;
            }
          }

          assert.strictEqual(
            exactMatch,
            true,
            `Pixel at index ${i} has color [${r}, ${g}, ${b}] which does not exactly match ` +
            `any color in the "${category}" palette (zero Euclidean distance required)`
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('quantization maps arbitrary RGB values to the nearest palette color with zero final distance', () => {
    fc.assert(
      fc.property(categoryArb, pixelBufferArb, (category, [dims, pixels]) => {
        const palette = getPaletteForCategory(category);
        const buffer = buildBuffer(pixels);

        quantizeToPalette(buffer, palette);

        // Verify zero Euclidean distance for all non-transparent pixels
        const pixelCount = dims.width * dims.height;
        for (let i = 0; i < pixelCount; i++) {
          const offset = i * 4;
          const alpha = buffer[offset + 3];

          if (alpha === 0) continue;

          const r = buffer[offset];
          const g = buffer[offset + 1];
          const b = buffer[offset + 2];

          // Compute minimum distance to any palette color
          let minDist = Infinity;
          for (let p = 0; p < palette.length; p++) {
            const dist = colorDistanceSq(r, g, b, palette[p][0], palette[p][1], palette[p][2]);
            if (dist < minDist) minDist = dist;
            if (dist === 0) break;
          }

          assert.strictEqual(
            minDist,
            0,
            `Pixel at index ${i} has color [${r}, ${g}, ${b}] with non-zero distance ` +
            `(${Math.sqrt(minDist).toFixed(4)}) to nearest palette color in "${category}" category`
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
