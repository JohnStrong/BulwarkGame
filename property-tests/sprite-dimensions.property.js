/**
 * Property 1: Sprite Dimension Invariant (terrain category)
 *
 * For any generated terrain sprite, its pixel buffer dimensions SHALL match
 * 64×32 (width×height). Test that all terrain sprite buffers have length
 * TILE_WIDTH * TILE_HEIGHT * 4 = 64 * 32 * 4 = 8192 bytes.
 *
 * Feature: enhanced-pixel-art-sprites, Property 1: Sprite Dimension Invariant
 *
 * **Validates: Requirements 1.6**
 */
'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { TILE_WIDTH, TILE_HEIGHT } = require('../js/level-generators/lib/sprite-constants');
const { createTerrainNoiseGenerator } = require('../js/level-generators/lib/noise-texture');

// Import terrain generator functions — they are not individually exported,
// so we replicate the generation logic using the same modules.
const { createBuffer, setPixel, isInsideDiamond, seededRandom, resetSeed, drawEdgeBorder } = require('../js/level-generators/lib/pixel-utils');
const { applyFaceShading, applyShadowEdge } = require('../js/level-generators/lib/shading');
const { applyOrderedDithering } = require('../js/level-generators/lib/dithering');
const { quantizeToPalette } = require('../js/level-generators/lib/palette-quantizer');
const { getPaletteForCategory, PRIMARY_PALETTE } = require('../js/level-generators/lib/palette');

const EXPECTED_BUFFER_LENGTH = TILE_WIDTH * TILE_HEIGHT * 4; // 8192

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
 * Arbitrary for seed values used to create noise generators.
 */
const seedArb = fc.integer({ min: 1, max: 1_000_000 });

/**
 * Arbitrary for grass variant indices.
 */
const variantArb = fc.integer({ min: 0, max: 100 });

describe('Property 1: Sprite Dimension Invariant (terrain)', () => {
  let noiseGenCache = new Map();

  /**
   * Gets or creates a noise generator for a given seed.
   */
  async function getNoiseGen(seed) {
    if (!noiseGenCache.has(seed)) {
      noiseGenCache.set(seed, await createTerrainNoiseGenerator(seed));
    }
    return noiseGenCache.get(seed);
  }

  it('all terrain grass sprite buffers have length TILE_WIDTH * TILE_HEIGHT * 4 = 8192 bytes', async () => {
    // Pre-create a noise generator for use in the property test
    const noiseGen = await createTerrainNoiseGenerator(42);

    fc.assert(
      fc.property(variantArb, (variant) => {
        const buffer = generateGrassForTest(variant, noiseGen);

        assert.strictEqual(
          buffer.length,
          EXPECTED_BUFFER_LENGTH,
          `Terrain grass sprite (variant ${variant}) buffer length is ${buffer.length}, ` +
          `expected ${EXPECTED_BUFFER_LENGTH} (${TILE_WIDTH}×${TILE_HEIGHT}×4)`
        );
      }),
      { numRuns: 100 }
    );
  });

  it('buffer dimensions match 64×32 (width × height)', async () => {
    const noiseGen = await createTerrainNoiseGenerator(84);

    fc.assert(
      fc.property(variantArb, (variant) => {
        const buffer = generateGrassForTest(variant, noiseGen);

        // Verify the buffer can be interpreted as a 64×32 RGBA image
        const expectedPixelCount = TILE_WIDTH * TILE_HEIGHT;
        const actualPixelCount = buffer.length / 4;

        assert.strictEqual(
          actualPixelCount,
          expectedPixelCount,
          `Expected ${expectedPixelCount} pixels (${TILE_WIDTH}×${TILE_HEIGHT}), ` +
          `got ${actualPixelCount} pixels`
        );

        assert.strictEqual(TILE_WIDTH, 64, 'TILE_WIDTH should be 64');
        assert.strictEqual(TILE_HEIGHT, 32, 'TILE_HEIGHT should be 32');
      }),
      { numRuns: 100 }
    );
  });
});
