/**
 * Tests for js/level-generators/lib/shading.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/shading.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  applyDirectionalShading,
  applyFaceShading,
  applyShadowEdge,
} = require('../../../js/level-generators/lib/shading');

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Creates a solid-color RGBA buffer of given dimensions.
 */
function createSolidBuffer(width, height, r, g, b, a = 255) {
  const buffer = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    buffer[i * 4] = r;
    buffer[i * 4 + 1] = g;
    buffer[i * 4 + 2] = b;
    buffer[i * 4 + 3] = a;
  }
  return buffer;
}

/**
 * Gets pixel RGBA at (x, y).
 */
function getPixel(buffer, width, x, y) {
  const idx = (y * width + x) * 4;
  return [buffer[idx], buffer[idx + 1], buffer[idx + 2], buffer[idx + 3]];
}

/**
 * Computes luminance from RGB values.
 */
function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ─── applyDirectionalShading ───────────────────────────────────────────────

describe('shading: applyDirectionalShading', () => {
  it('should brighten upper-left pixels and darken lower-right pixels', () => {
    const width = 8;
    const height = 8;
    const buffer = createSolidBuffer(width, height, 128, 128, 128);

    applyDirectionalShading(buffer, width, height, 0.2, 0.2);

    // Upper-left corner (0,0) should be brighter than original 128
    const ul = getPixel(buffer, width, 0, 0);
    assert.ok(ul[0] > 128, `UL red ${ul[0]} should be > 128`);
    assert.ok(ul[1] > 128, `UL green ${ul[1]} should be > 128`);
    assert.ok(ul[2] > 128, `UL blue ${ul[2]} should be > 128`);

    // Lower-right corner (7,7) should be darker than original 128
    const br = getPixel(buffer, width, 7, 7);
    assert.ok(br[0] < 128, `BR red ${br[0]} should be < 128`);
    assert.ok(br[1] < 128, `BR green ${br[1]} should be < 128`);
    assert.ok(br[2] < 128, `BR blue ${br[2]} should be < 128`);
  });

  it('should not modify transparent pixels', () => {
    const width = 4;
    const height = 4;
    const buffer = createSolidBuffer(width, height, 100, 100, 100, 0);

    applyDirectionalShading(buffer, width, height, 0.3, 0.3);

    // All pixels should remain unchanged
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = getPixel(buffer, width, x, y);
        assert.deepEqual(px, [100, 100, 100, 0]);
      }
    }
  });

  it('should produce highlight at least 20% brighter at UL corner with 0.2 highlightPercent', () => {
    const width = 8;
    const height = 8;
    const baseValue = 100;
    const buffer = createSolidBuffer(width, height, baseValue, baseValue, baseValue);

    applyDirectionalShading(buffer, width, height, 0.2, 0.2);

    const ul = getPixel(buffer, width, 0, 0);
    // At factor=0, multiplier = 1 + 0.2 = 1.2, so value should be 120
    assert.ok(ul[0] >= baseValue * 1.2 - 1, `UL pixel ${ul[0]} should be ~${baseValue * 1.2}`);
  });

  it('should produce shadow at least 20% darker at BR corner with 0.2 shadowPercent', () => {
    const width = 8;
    const height = 8;
    const baseValue = 100;
    const buffer = createSolidBuffer(width, height, baseValue, baseValue, baseValue);

    applyDirectionalShading(buffer, width, height, 0.2, 0.2);

    const br = getPixel(buffer, width, 7, 7);
    // At factor=1, multiplier = 1 - 0.2 = 0.8, so value should be 80
    assert.ok(br[0] <= baseValue * 0.8 + 1, `BR pixel ${br[0]} should be ~${baseValue * 0.8}`);
  });

  it('should clamp values to [0, 255] range', () => {
    const width = 4;
    const height = 4;
    // Use high values that would overflow with highlight
    const buffer = createSolidBuffer(width, height, 250, 250, 250);

    applyDirectionalShading(buffer, width, height, 0.5, 0.5);

    // Check no pixel exceeds 255
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = getPixel(buffer, width, x, y);
        assert.ok(px[0] <= 255 && px[0] >= 0);
        assert.ok(px[1] <= 255 && px[1] >= 0);
        assert.ok(px[2] <= 255 && px[2] >= 0);
      }
    }
  });

  it('should produce a gradient from UL to BR (Requirement 10.4)', () => {
    const width = 8;
    const height = 8;
    const buffer = createSolidBuffer(width, height, 128, 128, 128);

    applyDirectionalShading(buffer, width, height, 0.3, 0.3);

    // Average luminance of upper-left quadrant should be higher than lower-right
    let ulLum = 0;
    let brLum = 0;
    let ulCount = 0;
    let brCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = getPixel(buffer, width, x, y);
        const lum = luminance(px[0], px[1], px[2]);
        if (x < width / 2 && y < height / 2) {
          ulLum += lum;
          ulCount++;
        } else if (x >= width / 2 && y >= height / 2) {
          brLum += lum;
          brCount++;
        }
      }
    }

    const avgUL = ulLum / ulCount;
    const avgBR = brLum / brCount;
    assert.ok(avgUL > avgBR, `UL avg luminance ${avgUL} should be > BR avg luminance ${avgBR}`);
  });
});

// ─── applyFaceShading ──────────────────────────────────────────────────────

describe('shading: applyFaceShading', () => {
  it('should blend top half toward topColor and bottom half toward sideColor', () => {
    const width = 4;
    const height = 8;
    const buffer = createSolidBuffer(width, height, 128, 128, 128);

    const topColor = [200, 200, 200]; // bright
    const sideColor = [60, 60, 60];   // dark

    applyFaceShading(buffer, width, height, topColor, sideColor);

    // Top half pixel (0, 0) should be shifted toward topColor (brighter)
    const topPx = getPixel(buffer, width, 0, 0);
    assert.ok(topPx[0] > 128, `Top pixel R ${topPx[0]} should be > 128 (shifted toward topColor)`);

    // Bottom half pixel (0, 7) should be shifted toward sideColor (darker)
    const botPx = getPixel(buffer, width, 0, 7);
    assert.ok(botPx[0] < 128, `Bottom pixel R ${botPx[0]} should be < 128 (shifted toward sideColor)`);
  });

  it('should not modify transparent pixels', () => {
    const width = 4;
    const height = 4;
    const buffer = createSolidBuffer(width, height, 100, 100, 100, 0);

    applyFaceShading(buffer, width, height, [200, 200, 200], [50, 50, 50]);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = getPixel(buffer, width, x, y);
        assert.deepEqual(px, [100, 100, 100, 0]);
      }
    }
  });

  it('should divide at vertical midpoint (Requirement 1.1)', () => {
    const width = 4;
    const height = 4;
    const buffer = createSolidBuffer(width, height, 128, 128, 128);

    const topColor = [255, 255, 255];
    const sideColor = [0, 0, 0];

    applyFaceShading(buffer, width, height, topColor, sideColor);

    // Row 0 and 1 are top face (y < height/2 = 2)
    const topRow = getPixel(buffer, width, 0, 1);
    // Row 2 and 3 are side face (y >= height/2 = 2)
    const botRow = getPixel(buffer, width, 0, 2);

    assert.ok(topRow[0] > botRow[0], `Top face pixel ${topRow[0]} should be brighter than side face ${botRow[0]}`);
  });

  it('should preserve alpha channel values', () => {
    const width = 4;
    const height = 4;
    const buffer = createSolidBuffer(width, height, 128, 128, 128, 255);

    applyFaceShading(buffer, width, height, [200, 200, 200], [60, 60, 60]);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = getPixel(buffer, width, x, y);
        assert.equal(px[3], 255, `Alpha should remain 255`);
      }
    }
  });
});

// ─── applyShadowEdge ───────────────────────────────────────────────────────

describe('shading: applyShadowEdge', () => {
  it('should darken pixels on the right and bottom edges of opaque regions', () => {
    const width = 4;
    const height = 4;
    // Create a 2x2 opaque block in the center
    const buffer = Buffer.alloc(width * height * 4, 0);
    // Set pixels (1,1), (2,1), (1,2), (2,2) as opaque white
    const setPixel = (x, y, r, g, b) => {
      const idx = (y * width + x) * 4;
      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = 255;
    };
    setPixel(1, 1, 200, 200, 200);
    setPixel(2, 1, 200, 200, 200);
    setPixel(1, 2, 200, 200, 200);
    setPixel(2, 2, 200, 200, 200);

    applyShadowEdge(buffer, width, height);

    // (2,1) is on the right edge (right neighbor at (3,1) is transparent)
    const rightEdge = getPixel(buffer, width, 2, 1);
    assert.ok(rightEdge[0] < 200, `Right edge pixel ${rightEdge[0]} should be darkened from 200`);

    // (1,2) is on the bottom edge (bottom neighbor at (1,3) is transparent)
    const bottomEdge = getPixel(buffer, width, 1, 2);
    assert.ok(bottomEdge[0] < 200, `Bottom edge pixel ${bottomEdge[0]} should be darkened from 200`);

    // (2,2) is on both right and bottom edges
    const brCorner = getPixel(buffer, width, 2, 2);
    assert.ok(brCorner[0] < 200, `BR corner pixel ${brCorner[0]} should be darkened from 200`);
  });

  it('should not darken interior pixels that have opaque neighbors on all sides', () => {
    const width = 5;
    const height = 5;
    // Create a 3x3 opaque block in the center (1,1) to (3,3)
    const buffer = Buffer.alloc(width * height * 4, 0);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        const idx = (y * width + x) * 4;
        buffer[idx] = 150;
        buffer[idx + 1] = 150;
        buffer[idx + 2] = 150;
        buffer[idx + 3] = 255;
      }
    }

    applyShadowEdge(buffer, width, height);

    // Center pixel (2,2) has opaque neighbors on all sides including BR diagonal
    // It should NOT be darkened
    const center = getPixel(buffer, width, 2, 2);
    assert.equal(center[0], 150, `Interior pixel should remain unchanged at 150, got ${center[0]}`);
  });

  it('should not modify transparent pixels', () => {
    const width = 4;
    const height = 4;
    const buffer = Buffer.alloc(width * height * 4, 0); // all transparent

    applyShadowEdge(buffer, width, height);

    // All pixels should remain zero
    for (let i = 0; i < buffer.length; i++) {
      assert.equal(buffer[i], 0);
    }
  });

  it('should darken edge pixels by approximately 40%', () => {
    const width = 3;
    const height = 3;
    // Single opaque pixel at center (1,1) - all neighbors are transparent
    const buffer = Buffer.alloc(width * height * 4, 0);
    const idx = (1 * width + 1) * 4;
    buffer[idx] = 200;
    buffer[idx + 1] = 200;
    buffer[idx + 2] = 200;
    buffer[idx + 3] = 255;

    applyShadowEdge(buffer, width, height);

    const px = getPixel(buffer, width, 1, 1);
    // 200 * 0.6 = 120
    assert.equal(px[0], 120, `Pixel should be darkened to 120, got ${px[0]}`);
    assert.equal(px[1], 120);
    assert.equal(px[2], 120);
  });

  it('should preserve alpha values of edge pixels', () => {
    const width = 3;
    const height = 3;
    const buffer = Buffer.alloc(width * height * 4, 0);
    const idx = (1 * width + 1) * 4;
    buffer[idx] = 200;
    buffer[idx + 1] = 200;
    buffer[idx + 2] = 200;
    buffer[idx + 3] = 255;

    applyShadowEdge(buffer, width, height);

    const px = getPixel(buffer, width, 1, 1);
    assert.equal(px[3], 255, 'Alpha should remain 255');
  });

  it('should handle a fully opaque buffer (all boundary pixels are edges)', () => {
    const width = 4;
    const height = 4;
    const buffer = createSolidBuffer(width, height, 200, 200, 200);

    applyShadowEdge(buffer, width, height);

    // Right column (x=3) should be darkened
    for (let y = 0; y < height; y++) {
      const px = getPixel(buffer, width, 3, y);
      assert.ok(px[0] < 200, `Right edge pixel at (3,${y}) should be darkened`);
    }

    // Bottom row (y=3) should be darkened
    for (let x = 0; x < width; x++) {
      const px = getPixel(buffer, width, x, 3);
      assert.ok(px[0] < 200, `Bottom edge pixel at (${x},3) should be darkened`);
    }
  });
});
