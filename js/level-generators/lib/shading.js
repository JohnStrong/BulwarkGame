/**
 * Layered shading utilities for the enhanced pixel art sprite pipeline.
 *
 * Provides directional lighting, isometric face shading, and shadow edge
 * effects. All functions operate on RGBA pixel buffers in place.
 *
 * Light source direction: upper-left (consistent across all sprite categories).
 *
 * Requirements:
 *   1.1  - Layered shading: lit top face, darker side face, 1-pixel shadow edge
 *   3.3  - Directional lighting: highlight ≥20% brighter, shadow ≥20% darker
 *   10.4 - Consistent upper-left light source across all sprite categories
 */

'use strict';

// ─── Directional Shading ───────────────────────────────────────────────────

/**
 * Applies directional lighting to a pixel buffer.
 *
 * Light source: upper-left. Pixels in the upper-left region of the sprite
 * are brightened by highlightPercent, and pixels in the lower-right region
 * are darkened by shadowPercent. The transition is based on normalized
 * position within the buffer dimensions.
 *
 * Only opaque pixels (alpha === 255) are modified. Transparent pixels are
 * left untouched.
 *
 * @param {Buffer} buffer - RGBA pixel buffer (length = width × height × 4)
 * @param {number} width - Buffer width in pixels
 * @param {number} height - Buffer height in pixels
 * @param {number} highlightPercent - Brightness increase for UL region (e.g., 0.2 = 20%)
 * @param {number} shadowPercent - Darkness increase for BR region (e.g., 0.2 = 20%)
 */
function applyDirectionalShading(buffer, width, height, highlightPercent, shadowPercent) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      // Skip transparent pixels
      if (buffer[index + 3] === 0) continue;

      // Compute normalized position factor.
      // 0.0 = upper-left corner (full highlight)
      // 1.0 = lower-right corner (full shadow)
      const nx = width > 1 ? x / (width - 1) : 0.5;
      const ny = height > 1 ? y / (height - 1) : 0.5;
      const factor = (nx + ny) / 2; // 0 at UL, 1 at BR

      // Determine shading multiplier:
      // factor < 0.5 → highlight (brighten)
      // factor > 0.5 → shadow (darken)
      let multiplier;
      if (factor <= 0.5) {
        // Interpolate from full highlight at factor=0 to no change at factor=0.5
        const t = 1 - (factor / 0.5); // 1 at UL, 0 at center
        multiplier = 1 + (highlightPercent * t);
      } else {
        // Interpolate from no change at factor=0.5 to full shadow at factor=1
        const t = (factor - 0.5) / 0.5; // 0 at center, 1 at BR
        multiplier = 1 - (shadowPercent * t);
      }

      // Apply multiplier to RGB channels, clamping to [0, 255]
      buffer[index] = clamp(Math.round(buffer[index] * multiplier));
      buffer[index + 1] = clamp(Math.round(buffer[index + 1] * multiplier));
      buffer[index + 2] = clamp(Math.round(buffer[index + 2] * multiplier));
    }
  }
}

// ─── Face Shading ──────────────────────────────────────────────────────────

/**
 * Applies isometric face shading to a pixel buffer.
 *
 * Divides the sprite into a "top face" (upper half) and a "side face"
 * (lower half) based on the vertical midpoint. The top face is tinted
 * toward topColor (lit by upper-left light), and the side face is tinted
 * toward sideColor (in shadow).
 *
 * Only opaque pixels (alpha === 255) are modified.
 *
 * @param {Buffer} buffer - RGBA pixel buffer (length = width × height × 4)
 * @param {number} width - Buffer width in pixels
 * @param {number} height - Buffer height in pixels
 * @param {number[]} topColor - [r, g, b] lit face palette color to blend toward
 * @param {number[]} sideColor - [r, g, b] darker side face palette color to blend toward
 */
function applyFaceShading(buffer, width, height, topColor, sideColor) {
  const midY = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      // Skip transparent pixels
      if (buffer[index + 3] === 0) continue;

      const r = buffer[index];
      const g = buffer[index + 1];
      const b = buffer[index + 2];

      if (y < midY) {
        // Top face: blend toward topColor (lit)
        // Use a subtle blend factor so the original color is preserved but shifted
        const blendFactor = 0.3;
        buffer[index] = clamp(Math.round(r + (topColor[0] - r) * blendFactor));
        buffer[index + 1] = clamp(Math.round(g + (topColor[1] - g) * blendFactor));
        buffer[index + 2] = clamp(Math.round(b + (topColor[2] - b) * blendFactor));
      } else {
        // Side face: blend toward sideColor (shadow)
        const blendFactor = 0.3;
        buffer[index] = clamp(Math.round(r + (sideColor[0] - r) * blendFactor));
        buffer[index + 1] = clamp(Math.round(g + (sideColor[1] - g) * blendFactor));
        buffer[index + 2] = clamp(Math.round(b + (sideColor[2] - b) * blendFactor));
      }
    }
  }
}

// ─── Shadow Edge ───────────────────────────────────────────────────────────

/**
 * Applies a 1-pixel shadow edge along the bottom-right perimeter of the sprite.
 *
 * An opaque pixel is considered a "bottom-right edge" pixel if it has a
 * transparent neighbor to its right or below it (or is on the buffer boundary
 * on the right or bottom side). These edge pixels are darkened by 40% to
 * create a visible shadow outline consistent with the upper-left light source.
 *
 * Only opaque pixels (alpha === 255) are modified.
 *
 * @param {Buffer} buffer - RGBA pixel buffer (length = width × height × 4)
 * @param {number} width - Buffer width in pixels
 * @param {number} height - Buffer height in pixels
 */
function applyShadowEdge(buffer, width, height) {
  // We need to identify bottom-right edge pixels without modifying them
  // during iteration, so collect indices first.
  const edgeIndices = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      // Skip transparent pixels
      if (buffer[index + 3] === 0) continue;

      // Check if this pixel is on the bottom-right edge:
      // - right neighbor is transparent or out of bounds
      // - bottom neighbor is transparent or out of bounds
      // - bottom-right neighbor is transparent or out of bounds
      let isBREdge = false;

      // Check right neighbor
      if (x === width - 1) {
        isBREdge = true;
      } else if (buffer[(y * width + (x + 1)) * 4 + 3] === 0) {
        isBREdge = true;
      }

      // Check bottom neighbor
      if (!isBREdge) {
        if (y === height - 1) {
          isBREdge = true;
        } else if (buffer[((y + 1) * width + x) * 4 + 3] === 0) {
          isBREdge = true;
        }
      }

      // Check bottom-right neighbor
      if (!isBREdge) {
        if (x === width - 1 || y === height - 1) {
          isBREdge = true;
        } else if (buffer[((y + 1) * width + (x + 1)) * 4 + 3] === 0) {
          isBREdge = true;
        }
      }

      if (isBREdge) {
        edgeIndices.push(index);
      }
    }
  }

  // Darken all identified edge pixels by 40%
  const darkenFactor = 0.6; // multiply by 0.6 = 40% darker
  for (const index of edgeIndices) {
    buffer[index] = clamp(Math.round(buffer[index] * darkenFactor));
    buffer[index + 1] = clamp(Math.round(buffer[index + 1] * darkenFactor));
    buffer[index + 2] = clamp(Math.round(buffer[index + 2] * darkenFactor));
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Clamps a value to the 0–255 range.
 * @param {number} value
 * @returns {number}
 */
function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

module.exports = {
  applyDirectionalShading,
  applyFaceShading,
  applyShadowEdge,
};
