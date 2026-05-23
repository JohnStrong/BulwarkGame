/**
 * Property 4: Grass Noise Uniqueness
 *
 * For any two grass sprites generated with different seed values, the resulting
 * pixel buffers SHALL differ in at least one non-transparent pixel position,
 * and each grass sprite SHALL use at least 3 distinct palette colors.
 *
 * Feature: enhanced-pixel-art-sprites, Property 4: Grass Noise Uniqueness
 *
 * **Validates: Requirements 1.2**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { TILE_WIDTH, TILE_HEIGHT } = require('../js/level-generators/lib/sprite-constants');
const { createTerrainNoiseGenerator } = require('../js/level-generators/lib/noise-texture');
const { createBuffer, setPixel, isInsideDiamond, seededRandom, resetSeed, drawEdgeBorder } = require('../js/level-generators/lib/pixel-utils');
const { applyFaceShading, applyShadowEdge } = require('../js/level-generators/lib/shading');
const { applyOrderedDithering } = require('../js/level-generators/lib/dithering');
const { quantizeToPalette } = require('../js/level-generators/lib/palette-quantizer');
const { getPaletteForCategory, PRIMARY_PALETTE } = require('../js/level-generators/lib/palette');

// Grass palette colors (same as in generate-iso-sprites-br-tl.js)
const GRASS_COLORS = [
  PRIMARY_PALETTE[0],  // [95, 180, 72] grass green (base)
  PRIMARY_PALETTE[1],  // [75, 155, 55] grass dark
  PRIMARY_PALETTE[4],  // [48, 130, 42] tree canopy (deep green)
];

const TERRAIN_TOP_COLOR = PRIMARY_PALETTE[0];
const TERRAIN_SIDE_COLOR = PRIMARY_PALETTE[1];

/**
 * Generates a grass sprite buffer using the same logic as the main generator.
 * Uses a specific noise generator (seeded externally) and variant index.
 */
function generateGrassForTest(variant, noiseGen) {
  const buffer = createBuffer();
  resetSeed(1000 + variant * 100);

  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      if (isInsideDiamond(x, y)) {
        const noiseVal = noiseGen(x + variant * 64, y + variant * 32, 12);
        let color;
        if (noiseVal < -0.3) {
          color = GRASS_COLORS[2];
        } else if (noiseVal < 0.3) {
          color = GRASS_COLORS[0];
        } else {
          color = GRASS_COLORS[1];
        }
        const pixelNoise = (seededRandom() - 0.5) * 6;
        setPixel(buffer, x, y,
          color[0] + pixelNoise,
          color[1] + pixelNoise,
          color[2] + pixelNoise);
      }
    }
  }

  applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, TERRAIN_TOP_COLOR, TERRAIN_SIDE_COLOR);
  applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
  applyOrderedDithering(buffer, TILE_WIDTH, TILE_HEIGHT, GRASS_COLORS[0], GRASS_COLORS[1], 4, 'bottom');
  drawEdgeBorder(buffer);

  const palette = getPaletteForCategory('terrain');
  quantizeToPalette(buffer, palette);

  return buffer;
}

/**
 * Counts distinct non-transparent colors in a buffer.
 * Returns a Set of color strings for comparison.
 */
function getDistinctColors(buffer) {
  const colors = new Set();
  const pixelCount = buffer.length / 4;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const alpha = buffer[offset + 3];
    if (alpha === 0) continue;

    const r = buffer[offset];
    const g = buffer[offset + 1];
    const b = buffer[offset + 2];
    colors.add(`${r},${g},${b}`);
  }

  return colors;
}

/**
 * Checks if two buffers differ in at least one non-transparent pixel position.
 */
function buffersHaveNonTransparentDifference(bufferA, bufferB) {
  const pixelCount = bufferA.length / 4;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const alphaA = bufferA[offset + 3];
    const alphaB = bufferB[offset + 3];

    // Both transparent — not a difference in non-transparent pixels
    if (alphaA === 0 && alphaB === 0) continue;

    // One transparent, one not — that's a difference
    if (alphaA !== alphaB) return true;

    // Both opaque — compare RGB
    if (bufferA[offset] !== bufferB[offset] ||
        bufferA[offset + 1] !== bufferB[offset + 1] ||
        bufferA[offset + 2] !== bufferB[offset + 2]) {
      return true;
    }
  }

  return false;
}

/**
 * Arbitrary for seed values that produce different noise generators.
 */
const seedArb = fc.integer({ min: 1, max: 1_000_000 });

/**
 * Arbitrary for pairs of different seeds.
 */
const differentSeedPairArb = fc.tuple(seedArb, seedArb).filter(([a, b]) => a !== b);

/**
 * Arbitrary for variant indices.
 */
const variantArb = fc.integer({ min: 0, max: 50 });

describe('Property 4: Grass Noise Uniqueness', () => {
  it('two grass sprites with different seeds differ in at least one non-transparent pixel', async () => {
    // Use different seeds for the noise generators to produce different sprites
    const noiseGenA = await createTerrainNoiseGenerator(42);
    const noiseGenB = await createTerrainNoiseGenerator(99);

    fc.assert(
      fc.property(variantArb, (variant) => {
        const bufferA = generateGrassForTest(variant, noiseGenA);
        const bufferB = generateGrassForTest(variant, noiseGenB);

        assert.ok(
          buffersHaveNonTransparentDifference(bufferA, bufferB),
          `Grass sprites generated with different noise seeds but same variant (${variant}) ` +
          `should differ in at least one non-transparent pixel position`
        );
      }),
      { numRuns: 100 }
    );
  });

  it('two grass sprites with different variants differ in at least one non-transparent pixel', async () => {
    const noiseGen = await createTerrainNoiseGenerator(42);

    fc.assert(
      fc.property(
        fc.tuple(variantArb, variantArb).filter(([a, b]) => a !== b),
        ([variantA, variantB]) => {
          const bufferA = generateGrassForTest(variantA, noiseGen);
          const bufferB = generateGrassForTest(variantB, noiseGen);

          assert.ok(
            buffersHaveNonTransparentDifference(bufferA, bufferB),
            `Grass sprites with different variants (${variantA} vs ${variantB}) ` +
            `should differ in at least one non-transparent pixel position`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each grass sprite uses at least 3 distinct palette colors', async () => {
    const noiseGen = await createTerrainNoiseGenerator(42);

    fc.assert(
      fc.property(variantArb, (variant) => {
        const buffer = generateGrassForTest(variant, noiseGen);
        const distinctColors = getDistinctColors(buffer);

        assert.ok(
          distinctColors.size >= 3,
          `Grass sprite (variant ${variant}) uses only ${distinctColors.size} distinct colors, ` +
          `expected at least 3 distinct palette colors for ground detail variation`
        );
      }),
      { numRuns: 100 }
    );
  });
});
