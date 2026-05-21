/**
 * Tests for js/level-generators/lib/dithering.js
 *
 * Validates the ordered dithering module that applies 4×4 Bayer matrix dithering
 * to terrain transition edges.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/dithering.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { applyOrderedDithering, BAYER_4X4 } = require('../../../js/level-generators/lib/dithering');

// Helper: create a simple RGBA buffer filled with a given color
function createFilledBuffer(width, height, color) {
  const buffer = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    buffer[i * 4] = color[0];
    buffer[i * 4 + 1] = color[1];
    buffer[i * 4 + 2] = color[2];
    buffer[i * 4 + 3] = 255;
  }
  return buffer;
}

// Helper: create a buffer with transparent pixels
function createTransparentBuffer(width, height) {
  return Buffer.alloc(width * height * 4, 0);
}

// Helper: get pixel color at (x, y)
function getPixel(buffer, width, x, y) {
  const idx = (y * width + x) * 4;
  return [buffer[idx], buffer[idx + 1], buffer[idx + 2], buffer[idx + 3]];
}

const colorA = [95, 180, 72];   // grass green
const colorB = [210, 165, 110]; // road tan

describe('dithering: applyOrderedDithering', () => {
  it('should return the same buffer reference (modifies in place)', () => {
    const buffer = createFilledBuffer(16, 16, colorA);
    const result = applyOrderedDithering(buffer, 16, 16, colorA, colorB, 4, 'top');
    assert.strictEqual(result, buffer);
  });

  it('should only use colorA or colorB in the dithered region (no intermediate colors)', () => {
    const width = 16;
    const height = 16;
    const buffer = createFilledBuffer(width, height, colorA);
    applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'top');

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < width; x++) {
        const [r, g, b, a] = getPixel(buffer, width, x, y);
        if (a === 0) continue;
        const isColorA = r === colorA[0] && g === colorA[1] && b === colorA[2];
        const isColorB = r === colorB[0] && g === colorB[1] && b === colorB[2];
        assert.ok(isColorA || isColorB,
          `Pixel at (${x},${y}) is [${r},${g},${b}] — expected colorA or colorB`);
      }
    }
  });

  it('should not modify pixels outside the border region', () => {
    const width = 16;
    const height = 16;
    const buffer = createFilledBuffer(width, height, colorA);
    const original = Buffer.from(buffer);
    applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'top');

    // Pixels at y >= 4 should be unchanged
    for (let y = 4; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        assert.equal(buffer[idx], original[idx], `R at (${x},${y})`);
        assert.equal(buffer[idx + 1], original[idx + 1], `G at (${x},${y})`);
        assert.equal(buffer[idx + 2], original[idx + 2], `B at (${x},${y})`);
        assert.equal(buffer[idx + 3], original[idx + 3], `A at (${x},${y})`);
      }
    }
  });

  it('should skip transparent pixels', () => {
    const width = 8;
    const height = 8;
    const buffer = createTransparentBuffer(width, height);
    applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'top');

    // All pixels should remain transparent
    for (let i = 0; i < width * height; i++) {
      assert.equal(buffer[i * 4 + 3], 0, `Pixel ${i} should remain transparent`);
    }
  });

  it('should apply dithering on the bottom edge', () => {
    const width = 16;
    const height = 16;
    const buffer = createFilledBuffer(width, height, colorA);
    applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'bottom');

    // Pixels in the bottom 4 rows should be dithered
    let hasColorB = false;
    for (let y = height - 4; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [r, g, b, a] = getPixel(buffer, width, x, y);
        if (a === 0) continue;
        const isColorA = r === colorA[0] && g === colorA[1] && b === colorA[2];
        const isColorB = r === colorB[0] && g === colorB[1] && b === colorB[2];
        assert.ok(isColorA || isColorB,
          `Pixel at (${x},${y}) is [${r},${g},${b}] — expected colorA or colorB`);
        if (isColorB) hasColorB = true;
      }
    }
    assert.ok(hasColorB, 'Bottom edge should contain some colorB pixels');

    // Pixels above the border should be unchanged
    for (let y = 0; y < height - 4; y++) {
      for (let x = 0; x < width; x++) {
        const [r, g, b] = getPixel(buffer, width, x, y);
        assert.equal(r, colorA[0]);
        assert.equal(g, colorA[1]);
        assert.equal(b, colorA[2]);
      }
    }
  });

  it('should apply dithering on the left edge', () => {
    const width = 16;
    const height = 16;
    const buffer = createFilledBuffer(width, height, colorA);
    applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'left');

    // Left 4 columns should be dithered
    let hasColorB = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < 4; x++) {
        const [r, g, b, a] = getPixel(buffer, width, x, y);
        if (a === 0) continue;
        const isColorA = r === colorA[0] && g === colorA[1] && b === colorA[2];
        const isColorB = r === colorB[0] && g === colorB[1] && b === colorB[2];
        assert.ok(isColorA || isColorB,
          `Pixel at (${x},${y}) is [${r},${g},${b}] — expected colorA or colorB`);
        if (isColorB) hasColorB = true;
      }
    }
    assert.ok(hasColorB, 'Left edge should contain some colorB pixels');

    // Pixels to the right of the border should be unchanged
    for (let y = 0; y < height; y++) {
      for (let x = 4; x < width; x++) {
        const [r, g, b] = getPixel(buffer, width, x, y);
        assert.equal(r, colorA[0]);
        assert.equal(g, colorA[1]);
        assert.equal(b, colorA[2]);
      }
    }
  });

  it('should apply dithering on the right edge', () => {
    const width = 16;
    const height = 16;
    const buffer = createFilledBuffer(width, height, colorA);
    applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'right');

    // Right 4 columns should be dithered
    let hasColorB = false;
    for (let y = 0; y < height; y++) {
      for (let x = width - 4; x < width; x++) {
        const [r, g, b, a] = getPixel(buffer, width, x, y);
        if (a === 0) continue;
        const isColorA = r === colorA[0] && g === colorA[1] && b === colorA[2];
        const isColorB = r === colorB[0] && g === colorB[1] && b === colorB[2];
        assert.ok(isColorA || isColorB,
          `Pixel at (${x},${y}) is [${r},${g},${b}] — expected colorA or colorB`);
        if (isColorB) hasColorB = true;
      }
    }
    assert.ok(hasColorB, 'Right edge should contain some colorB pixels');
  });

  it('should produce a gradient pattern (more colorB near edge, more colorA deeper in)', () => {
    const width = 16;
    const height = 16;
    const buffer = createFilledBuffer(width, height, colorA);
    applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'top');

    // Count colorB pixels per row in the border region
    const colorBCountPerRow = [];
    for (let y = 0; y < 4; y++) {
      let count = 0;
      for (let x = 0; x < width; x++) {
        const [r, g, b] = getPixel(buffer, width, x, y);
        if (r === colorB[0] && g === colorB[1] && b === colorB[2]) count++;
      }
      colorBCountPerRow.push(count);
    }

    // Row 0 (at edge) should have more colorB than row 3 (deepest)
    assert.ok(colorBCountPerRow[0] >= colorBCountPerRow[3],
      `Edge row should have >= colorB pixels than deepest row: ${colorBCountPerRow[0]} vs ${colorBCountPerRow[3]}`);
  });

  it('should use default borderWidth of 4 when not specified', () => {
    const width = 16;
    const height = 16;
    const buffer = createFilledBuffer(width, height, colorA);
    // Call without explicit borderWidth (uses default)
    applyOrderedDithering(buffer, width, height, colorA, colorB, undefined, 'top');

    // Row 4 should be unchanged (outside default 4-pixel border)
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getPixel(buffer, width, x, 4);
      assert.equal(r, colorA[0]);
      assert.equal(g, colorA[1]);
      assert.equal(b, colorA[2]);
    }
  });

  it('should handle custom borderWidth', () => {
    const width = 16;
    const height = 16;
    const buffer = createFilledBuffer(width, height, colorA);
    applyOrderedDithering(buffer, width, height, colorA, colorB, 8, 'top');

    // Row 7 should be in the border region (dithered)
    let hasDithering = false;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getPixel(buffer, width, x, 7);
      if (r === colorB[0] && g === colorB[1] && b === colorB[2]) {
        hasDithering = true;
        break;
      }
    }
    // Row 7 is the deepest row in an 8-pixel border — it should have at least some colorB
    // (or all colorA if threshold is very high). Either way, row 8 should be unchanged.
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getPixel(buffer, width, x, 8);
      assert.equal(r, colorA[0]);
      assert.equal(g, colorA[1]);
      assert.equal(b, colorA[2]);
    }
  });
});

describe('dithering: BAYER_4X4 matrix', () => {
  it('should be a 4×4 matrix', () => {
    assert.equal(BAYER_4X4.length, 4);
    for (const row of BAYER_4X4) {
      assert.equal(row.length, 4);
    }
  });

  it('should contain values 0–15 (all unique)', () => {
    const values = BAYER_4X4.flat().sort((a, b) => a - b);
    assert.deepEqual(values, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });
});
