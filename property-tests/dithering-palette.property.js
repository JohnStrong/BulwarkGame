/**
 * Property 19: Terrain Transition Dithering Palette Compliance
 *
 * For any terrain transition edge with ordered dithering applied, all pixels
 * within the 4-pixel dithering border region SHALL use only colors from the
 * defined palette (no intermediate computed colors).
 *
 * Feature: enhanced-pixel-art-sprites, Property 19: Terrain Transition Dithering Palette Compliance
 *
 * **Validates: Requirements 1.5**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { TILE_WIDTH, TILE_HEIGHT } = require('../js/level-generators/lib/sprite-constants');
const { createBuffer, setPixel, isInsideDiamond, resetSeed, seededRandom } = require('../js/level-generators/lib/pixel-utils');
const { applyOrderedDithering } = require('../js/level-generators/lib/dithering');
const { getPaletteForCategory, PRIMARY_PALETTE } = require('../js/level-generators/lib/palette');

/**
 * The terrain palette — all valid colors for terrain sprites.
 */
const TERRAIN_PALETTE = getPaletteForCategory('terrain');

/**
 * Arbitrary for edge directions.
 */
const edgeArb = fc.constantFrom('top', 'bottom', 'left', 'right');

/**
 * Arbitrary for border widths (1–8 pixels, default is 4).
 */
const borderWidthArb = fc.integer({ min: 1, max: 8 });

/**
 * Arbitrary for selecting two different palette color indices.
 */
const paletteColorPairArb = fc.tuple(
  fc.integer({ min: 0, max: TERRAIN_PALETTE.length - 1 }),
  fc.integer({ min: 0, max: TERRAIN_PALETTE.length - 1 })
).filter(([a, b]) => a !== b);

/**
 * Arbitrary for seed values.
 */
const seedArb = fc.integer({ min: 1, max: 1_000_000 });

/**
 * Creates a buffer filled with opaque pixels of a single palette color
 * inside the diamond region (simulating a terrain tile before dithering).
 */
function createFilledBuffer(baseColor) {
  const buffer = createBuffer();
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      if (isInsideDiamond(x, y)) {
        setPixel(buffer, x, y, baseColor[0], baseColor[1], baseColor[2]);
      }
    }
  }
  return buffer;
}

/**
 * Gets the depth of a pixel into the border region for a given edge.
 * Returns -1 if outside the border region.
 */
function getDepthInBorder(x, y, borderWidth, edge) {
  switch (edge) {
    case 'top':
      return y < borderWidth ? y : -1;
    case 'bottom':
      return y >= TILE_HEIGHT - borderWidth ? (TILE_HEIGHT - 1 - y) : -1;
    case 'left':
      return x < borderWidth ? x : -1;
    case 'right':
      return x >= TILE_WIDTH - borderWidth ? (TILE_WIDTH - 1 - x) : -1;
    default:
      return -1;
  }
}

/**
 * Checks if a color exactly matches any color in the palette.
 */
function isInPalette(r, g, b, palette) {
  for (let i = 0; i < palette.length; i++) {
    if (r === palette[i][0] && g === palette[i][1] && b === palette[i][2]) {
      return true;
    }
  }
  return false;
}

describe('Property 19: Terrain Transition Dithering Palette Compliance', () => {
  it('all pixels in the dithering border region use only palette colors (no intermediate computed colors)', () => {
    fc.assert(
      fc.property(paletteColorPairArb, edgeArb, borderWidthArb, ([idxA, idxB], edge, borderWidth) => {
        const colorA = TERRAIN_PALETTE[idxA];
        const colorB = TERRAIN_PALETTE[idxB];

        // Create a buffer filled with colorA (simulating a terrain tile)
        const buffer = createFilledBuffer(colorA);

        // Apply ordered dithering on the specified edge
        applyOrderedDithering(buffer, TILE_WIDTH, TILE_HEIGHT, colorA, colorB, borderWidth, edge);

        // Verify all pixels in the dithering border region use only palette colors
        for (let y = 0; y < TILE_HEIGHT; y++) {
          for (let x = 0; x < TILE_WIDTH; x++) {
            const index = (y * TILE_WIDTH + x) * 4;
            const alpha = buffer[index + 3];

            // Skip transparent pixels
            if (alpha === 0) continue;

            // Check if this pixel is in the border region
            const depth = getDepthInBorder(x, y, borderWidth, edge);
            if (depth < 0) continue;

            const r = buffer[index];
            const g = buffer[index + 1];
            const b = buffer[index + 2];

            // The pixel must be either colorA or colorB (both are palette colors)
            const isColorA = (r === colorA[0] && g === colorA[1] && b === colorA[2]);
            const isColorB = (r === colorB[0] && g === colorB[1] && b === colorB[2]);

            assert.ok(
              isColorA || isColorB,
              `Pixel at (${x}, ${y}) in the ${edge} dithering border region has color ` +
              `[${r}, ${g}, ${b}] which is neither colorA [${colorA}] nor colorB [${colorB}]. ` +
              `Dithering must use only the two provided palette colors, no intermediate values.`
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('dithered pixels in the border region are all valid terrain palette colors', () => {
    fc.assert(
      fc.property(paletteColorPairArb, edgeArb, ([idxA, idxB], edge) => {
        const colorA = TERRAIN_PALETTE[idxA];
        const colorB = TERRAIN_PALETTE[idxB];
        const borderWidth = 4; // Default dithering border width

        // Create a buffer filled with colorA
        const buffer = createFilledBuffer(colorA);

        // Apply ordered dithering
        applyOrderedDithering(buffer, TILE_WIDTH, TILE_HEIGHT, colorA, colorB, borderWidth, edge);

        // Verify all opaque pixels in the border region are valid palette colors
        for (let y = 0; y < TILE_HEIGHT; y++) {
          for (let x = 0; x < TILE_WIDTH; x++) {
            const index = (y * TILE_WIDTH + x) * 4;
            const alpha = buffer[index + 3];

            if (alpha === 0) continue;

            const depth = getDepthInBorder(x, y, borderWidth, edge);
            if (depth < 0) continue;

            const r = buffer[index];
            const g = buffer[index + 1];
            const b = buffer[index + 2];

            assert.ok(
              isInPalette(r, g, b, TERRAIN_PALETTE),
              `Pixel at (${x}, ${y}) in the ${edge} dithering border region has color ` +
              `[${r}, ${g}, ${b}] which is not in the terrain palette. ` +
              `All dithered pixels must use only defined palette colors.`
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
