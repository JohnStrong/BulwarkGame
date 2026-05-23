/**
 * Ordered dithering module for terrain transition edges.
 *
 * Implements 4×4 Bayer matrix dithering to blend two terrain palette colors
 * within a border region. The output uses ONLY the two provided palette colors
 * — no intermediate computed colors are produced.
 *
 * Requirements:
 *   1.5 - Ordered dithering within a 4-pixel border region on transition edges,
 *          blending two terrain palette colors without introducing colors outside
 *          the defined palette.
 */

'use strict';

// ─── 4×4 Bayer Dithering Matrix ────────────────────────────────────────────
// Normalized threshold values (0–15) for a standard 4×4 ordered dither pattern.
// Each value represents the threshold at which a pixel flips from colorA to colorB.

const BAYER_4X4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];

const BAYER_SIZE = 4;
const BAYER_LEVELS = 16; // 4×4 = 16 threshold levels

/**
 * Applies ordered dithering in a border region between two terrain types.
 *
 * The dithering region is a strip of `borderWidth` pixels along the specified
 * edge of the buffer. Within this strip, pixels are set to either colorA or
 * colorB based on the Bayer matrix threshold — producing a gradual transition
 * pattern using only the two palette colors.
 *
 * Pixels outside the border region or that are fully transparent (alpha === 0)
 * are left unchanged.
 *
 * @param {Buffer} buffer - RGBA pixel buffer (modified in place)
 * @param {number} width - Width of the buffer in pixels
 * @param {number} height - Height of the buffer in pixels
 * @param {number[]} colorA - First terrain palette color [r, g, b]
 * @param {number[]} colorB - Second terrain palette color [r, g, b]
 * @param {number} [borderWidth=4] - Width of dithering region in pixels
 * @param {'top'|'bottom'|'left'|'right'} edge - Which edge to dither
 * @returns {Buffer} The same buffer, with dithering applied
 */
function applyOrderedDithering(buffer, width, height, colorA, colorB, borderWidth = 4, edge) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      // Skip fully transparent pixels
      if (buffer[index + 3] === 0) continue;

      // Determine how deep this pixel is into the border region (0 = at edge, borderWidth-1 = deepest)
      const depth = getDepthInBorder(x, y, width, height, borderWidth, edge);

      // Skip pixels outside the border region
      if (depth < 0) continue;

      // Calculate the blend ratio based on depth into the border.
      // depth 0 (at the edge) → mostly colorB (the neighboring terrain)
      // depth borderWidth-1 (deepest into this tile) → mostly colorA (this terrain)
      const ratio = depth / (borderWidth - 1);

      // Scale ratio to Bayer threshold range [0, BAYER_LEVELS - 1]
      const threshold = ratio * (BAYER_LEVELS - 1);

      // Look up the Bayer matrix value for this pixel position
      const bayerValue = BAYER_4X4[y % BAYER_SIZE][x % BAYER_SIZE];

      // Choose colorA or colorB based on threshold comparison
      const color = bayerValue < threshold ? colorA : colorB;

      buffer[index]     = color[0];
      buffer[index + 1] = color[1];
      buffer[index + 2] = color[2];
      // Alpha stays at 255 (opaque) — we already skipped transparent pixels
    }
  }

  return buffer;
}

/**
 * Calculates how deep a pixel is within the border region for a given edge.
 * Returns -1 if the pixel is outside the border region.
 *
 * @param {number} x - Pixel x coordinate
 * @param {number} y - Pixel y coordinate
 * @param {number} width - Buffer width
 * @param {number} height - Buffer height
 * @param {number} borderWidth - Width of the dithering border in pixels
 * @param {'top'|'bottom'|'left'|'right'} edge - Which edge the border is on
 * @returns {number} Depth into border (0 = at edge, borderWidth-1 = deepest), or -1 if outside
 */
function getDepthInBorder(x, y, width, height, borderWidth, edge) {
  switch (edge) {
    case 'top':
      return y < borderWidth ? y : -1;
    case 'bottom':
      return y >= height - borderWidth ? (height - 1 - y) : -1;
    case 'left':
      return x < borderWidth ? x : -1;
    case 'right':
      return x >= width - borderWidth ? (width - 1 - x) : -1;
    default:
      return -1;
  }
}

module.exports = {
  applyOrderedDithering,
  BAYER_4X4,
};
