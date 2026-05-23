/**
 * Palette quantization module for the enhanced pixel art sprite pipeline.
 *
 * Provides final-pass palette enforcement ensuring every non-transparent pixel
 * exactly matches a color in the target palette (zero Euclidean color distance).
 * Also enforces binary alpha values (0 or 255) on all pixels.
 *
 * Requirements:
 *   10.2 - Apply palette quantization as final step; every non-transparent pixel
 *          matches a palette color exactly (zero color distance)
 *   10.5 - Every pixel has alpha of 0 or 255 (no intermediate alpha values)
 */

'use strict';

/**
 * Computes the squared Euclidean distance between two RGB colors.
 * Using squared distance avoids the sqrt for comparison purposes.
 *
 * @param {number} r1
 * @param {number} g1
 * @param {number} b1
 * @param {number} r2
 * @param {number} g2
 * @param {number} b2
 * @returns {number} Squared Euclidean distance
 */
function colorDistanceSq(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

/**
 * Finds the nearest palette color to the given RGB values using
 * Euclidean distance in RGB space.
 *
 * @param {number} r - Red channel (0-255)
 * @param {number} g - Green channel (0-255)
 * @param {number} b - Blue channel (0-255)
 * @param {number[][]} palette - Array of [r, g, b] palette colors
 * @returns {number[]} The nearest [r, g, b] palette color
 */
function findNearestColor(r, g, b, palette) {
  let bestColor = palette[0];
  let bestDist = colorDistanceSq(r, g, b, palette[0][0], palette[0][1], palette[0][2]);

  for (let i = 1; i < palette.length; i++) {
    const dist = colorDistanceSq(r, g, b, palette[i][0], palette[i][1], palette[i][2]);
    if (dist < bestDist) {
      bestDist = dist;
      bestColor = palette[i];
    }
    // Early exit on exact match
    if (dist === 0) break;
  }

  return bestColor;
}

/**
 * Maps every non-transparent pixel to the nearest palette color.
 * Uses Euclidean distance in RGB space. Modifies the buffer in place.
 *
 * Also enforces binary alpha values: any pixel with alpha > 0 gets
 * alpha set to 255 (fully opaque), ensuring all pixels are either
 * fully transparent (0) or fully opaque (255).
 *
 * Skips fully transparent pixels (alpha === 0). After quantization,
 * validates that every non-transparent pixel exactly matches a palette
 * color (zero Euclidean distance). Throws if validation fails.
 *
 * @param {Buffer} buffer - RGBA pixel buffer (modified in place)
 * @param {number[][]} palette - Array of [r, g, b] palette colors
 * @returns {Buffer} The same buffer, quantized
 * @throws {Error} If post-quantization validation finds out-of-palette pixels
 */
function quantizeToPalette(buffer, palette) {
  if (!buffer || buffer.length === 0) {
    return buffer;
  }

  if (!palette || palette.length === 0) {
    throw new Error('Quantization failed: palette is empty');
  }

  const pixelCount = buffer.length / 4;

  // Pass 1: Enforce binary alpha and quantize non-transparent pixels
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const alpha = buffer[offset + 3];

    // Skip fully transparent pixels
    if (alpha === 0) continue;

    // Enforce binary alpha: any non-zero alpha becomes 255 (Requirement 10.5)
    buffer[offset + 3] = 255;

    const r = buffer[offset];
    const g = buffer[offset + 1];
    const b = buffer[offset + 2];

    const nearest = findNearestColor(r, g, b, palette);

    buffer[offset] = nearest[0];
    buffer[offset + 1] = nearest[1];
    buffer[offset + 2] = nearest[2];
  }

  // Pass 2: Validate that every non-transparent pixel exactly matches a palette color
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const alpha = buffer[offset + 3];

    // Skip fully transparent pixels
    if (alpha === 0) continue;

    const r = buffer[offset];
    const g = buffer[offset + 1];
    const b = buffer[offset + 2];

    let found = false;
    for (let p = 0; p < palette.length; p++) {
      if (r === palette[p][0] && g === palette[p][1] && b === palette[p][2]) {
        found = true;
        break;
      }
    }

    if (!found) {
      const nearest = findNearestColor(r, g, b, palette);
      const dist = Math.sqrt(colorDistanceSq(r, g, b, nearest[0], nearest[1], nearest[2]));
      throw new Error(
        `Quantization failed: pixel at index ${i} (byte offset ${offset}) has color [${r}, ${g}, ${b}] ` +
        `which is not in the palette. Nearest palette color: [${nearest[0]}, ${nearest[1]}, ${nearest[2]}], ` +
        `distance: ${dist.toFixed(4)}`
      );
    }
  }

  return buffer;
}

module.exports = {
  quantizeToPalette,
  findNearestColor,
  colorDistanceSq,
};
