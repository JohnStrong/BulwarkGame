/**
 * Property 6: Directional Lighting Consistency (terrain)
 *
 * For any generated terrain sprite with shading applied, the average luminance
 * of pixels in the upper-left body region SHALL be at least 20% higher than
 * the average luminance of pixels in the lower-right body region.
 *
 * Feature: enhanced-pixel-art-sprites, Property 6: Directional Lighting Consistency
 *
 * **Validates: Requirements 1.1**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { TILE_WIDTH, TILE_HEIGHT } = require('../js/level-generators/lib/sprite-constants');
const { createBuffer, setPixel, isInsideDiamond } = require('../js/level-generators/lib/pixel-utils');
const { applyDirectionalShading, applyFaceShading, applyShadowEdge } = require('../js/level-generators/lib/shading');
const { PRIMARY_PALETTE } = require('../js/level-generators/lib/palette');

/**
 * Computes the luminance of an RGB pixel using the standard formula.
 * Returns a value in [0, 255].
 *
 * @param {number} r - Red channel (0–255)
 * @param {number} g - Green channel (0–255)
 * @param {number} b - Blue channel (0–255)
 * @returns {number} Luminance value
 */
function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Computes the average luminance of opaque pixels in a rectangular region
 * of the buffer, restricted to pixels inside the diamond.
 *
 * @param {Buffer} buffer - RGBA pixel buffer
 * @param {number} width - Buffer width
 * @param {number} height - Buffer height
 * @param {number} startX - Region start X (inclusive)
 * @param {number} startY - Region start Y (inclusive)
 * @param {number} endX - Region end X (exclusive)
 * @param {number} endY - Region end Y (exclusive)
 * @returns {{avgLuminance: number, pixelCount: number}}
 */
function getRegionLuminance(buffer, width, height, startX, startY, endX, endY) {
  let totalLuminance = 0;
  let pixelCount = 0;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const index = (y * width + x) * 4;
      const alpha = buffer[index + 3];

      // Only consider opaque pixels
      if (alpha === 0) continue;

      const r = buffer[index];
      const g = buffer[index + 1];
      const b = buffer[index + 2];
      totalLuminance += luminance(r, g, b);
      pixelCount++;
    }
  }

  return {
    avgLuminance: pixelCount > 0 ? totalLuminance / pixelCount : 0,
    pixelCount,
  };
}

/**
 * Creates a terrain-like buffer filled with a uniform color inside the diamond.
 * This simulates a terrain sprite before shading is applied.
 */
function createTerrainBuffer(baseColor) {
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
 * Arbitrary for base colors from the terrain palette.
 */
const terrainColorArb = fc.constantFrom(
  PRIMARY_PALETTE[0],  // grass green
  PRIMARY_PALETTE[1],  // grass dark
  PRIMARY_PALETTE[2],  // road tan
  PRIMARY_PALETTE[3],  // water blue
  PRIMARY_PALETTE[4],  // tree canopy
  PRIMARY_PALETTE[15], // bridge stone
);

/**
 * Arbitrary for highlight/shadow percentages (at least 20% as per requirement).
 */
const shadingPercentArb = fc.double({ min: 0.2, max: 0.5, noNaN: true });

describe('Property 6: Directional Lighting Consistency (terrain)', () => {
  it('after applyDirectionalShading with ≥20% highlight/shadow, UL region luminance is at least 20% higher than BR region', () => {
    // The directional shading function applies a gradient based on normalized
    // position: factor = (nx + ny) / 2, where nx = x/(width-1), ny = y/(height-1).
    // At factor=0 (UL corner): full highlight. At factor=1 (BR corner): full shadow.
    //
    // We sample the extreme UL corner region (factor < 0.25) and extreme BR
    // corner region (factor > 0.75) to capture the strongest shading effect.
    // These regions are where the full highlight/shadow percentages are applied.

    fc.assert(
      fc.property(terrainColorArb, shadingPercentArb, shadingPercentArb, (baseColor, highlightPct, shadowPct) => {
        const buffer = createTerrainBuffer(baseColor);

        // Apply directional shading with upper-left light source
        applyDirectionalShading(buffer, TILE_WIDTH, TILE_HEIGHT, highlightPct, shadowPct);

        // Sample UL corner: pixels where (nx + ny)/2 < 0.25
        // This means x/(63) + y/(31) < 0.5, i.e., very close to the UL corner
        let ulTotal = 0, ulCount = 0;
        let brTotal = 0, brCount = 0;

        for (let y = 0; y < TILE_HEIGHT; y++) {
          for (let x = 0; x < TILE_WIDTH; x++) {
            const index = (y * TILE_WIDTH + x) * 4;
            if (buffer[index + 3] === 0) continue;

            const nx = x / (TILE_WIDTH - 1);
            const ny = y / (TILE_HEIGHT - 1);
            const factor = (nx + ny) / 2;

            const r = buffer[index];
            const g = buffer[index + 1];
            const b = buffer[index + 2];
            const lum = luminance(r, g, b);

            if (factor <= 0.2) {
              ulTotal += lum;
              ulCount++;
            } else if (factor >= 0.8) {
              brTotal += lum;
              brCount++;
            }
          }
        }

        // Skip if either region has no opaque pixels
        if (ulCount === 0 || brCount === 0) return;

        const ulAvg = ulTotal / ulCount;
        const brAvg = brTotal / brCount;

        // Skip if BR luminance is 0
        if (brAvg === 0) return;

        // The upper-left region should be at least 20% brighter than lower-right
        const ratio = ulAvg / brAvg;

        assert.ok(
          ratio >= 1.2,
          `Upper-left avg luminance (${ulAvg.toFixed(2)}) should be at least 20% ` +
          `higher than lower-right avg luminance (${brAvg.toFixed(2)}). ` +
          `Actual ratio: ${ratio.toFixed(4)} (expected >= 1.2). ` +
          `Base color: [${baseColor}], highlight: ${(highlightPct * 100).toFixed(1)}%, shadow: ${(shadowPct * 100).toFixed(1)}%`
        );
      }),
      { numRuns: 100 }
    );
  });

  it('face shading produces brighter top half than bottom half for terrain sprites', () => {
    // Top half region (lit face)
    const topStartX = Math.floor(TILE_WIDTH * 0.25);
    const topStartY = 2;
    const topEndX = Math.floor(TILE_WIDTH * 0.75);
    const topEndY = Math.floor(TILE_HEIGHT * 0.45);

    // Bottom half region (shadow face)
    const botStartX = Math.floor(TILE_WIDTH * 0.25);
    const botStartY = Math.floor(TILE_HEIGHT * 0.55);
    const botEndX = Math.floor(TILE_WIDTH * 0.75);
    const botEndY = TILE_HEIGHT - 2;

    const TERRAIN_TOP_COLOR = PRIMARY_PALETTE[0];   // [95, 180, 72] grass green (brighter)
    const TERRAIN_SIDE_COLOR = PRIMARY_PALETTE[1];  // [75, 155, 55] grass dark (darker)

    fc.assert(
      fc.property(terrainColorArb, (baseColor) => {
        const buffer = createTerrainBuffer(baseColor);

        // Apply face shading as the terrain generator does
        applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, TERRAIN_TOP_COLOR, TERRAIN_SIDE_COLOR);

        const topRegion = getRegionLuminance(buffer, TILE_WIDTH, TILE_HEIGHT, topStartX, topStartY, topEndX, topEndY);
        const botRegion = getRegionLuminance(buffer, TILE_WIDTH, TILE_HEIGHT, botStartX, botStartY, botEndX, botEndY);

        // Skip if either region has no opaque pixels
        if (topRegion.pixelCount === 0 || botRegion.pixelCount === 0) return;
        if (botRegion.avgLuminance === 0) return;

        // The top face (lit) should be brighter than the bottom face (shadow)
        assert.ok(
          topRegion.avgLuminance > botRegion.avgLuminance,
          `Top face avg luminance (${topRegion.avgLuminance.toFixed(2)}) should be higher ` +
          `than bottom face avg luminance (${botRegion.avgLuminance.toFixed(2)}). ` +
          `Face shading with topColor [${TERRAIN_TOP_COLOR}] and sideColor [${TERRAIN_SIDE_COLOR}] ` +
          `should produce a lit top face and darker side face. Base color: [${baseColor}]`
        );
      }),
      { numRuns: 100 }
    );
  });
});
