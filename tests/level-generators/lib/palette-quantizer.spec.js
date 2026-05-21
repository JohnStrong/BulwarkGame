/**
 * Unit tests for palette-quantizer module.
 *
 * Tests the quantizeToPalette function which maps every non-transparent pixel
 * to the nearest palette color using Euclidean RGB distance.
 *
 * Requirements: 10.2, 10.5
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { quantizeToPalette, findNearestColor, colorDistanceSq } = require('../../../js/level-generators/lib/palette-quantizer');

describe('palette-quantizer', () => {
  const testPalette = [
    [255, 0, 0],     // red
    [0, 255, 0],     // green
    [0, 0, 255],     // blue
    [255, 255, 255], // white
    [0, 0, 0],       // black
  ];

  describe('colorDistanceSq', () => {
    it('returns 0 for identical colors', () => {
      assert.equal(colorDistanceSq(100, 150, 200, 100, 150, 200), 0);
    });

    it('computes correct squared distance', () => {
      // (255-0)^2 + (0-0)^2 + (0-0)^2 = 65025
      assert.equal(colorDistanceSq(255, 0, 0, 0, 0, 0), 65025);
    });

    it('computes distance for arbitrary colors', () => {
      // (10-20)^2 + (30-40)^2 + (50-60)^2 = 100 + 100 + 100 = 300
      assert.equal(colorDistanceSq(10, 30, 50, 20, 40, 60), 300);
    });
  });

  describe('findNearestColor', () => {
    it('returns exact match when color is in palette', () => {
      const result = findNearestColor(255, 0, 0, testPalette);
      assert.deepEqual(result, [255, 0, 0]);
    });

    it('finds nearest color for off-palette color', () => {
      // (250, 10, 10) is closest to red [255, 0, 0]
      const result = findNearestColor(250, 10, 10, testPalette);
      assert.deepEqual(result, [255, 0, 0]);
    });

    it('finds nearest color for mid-range value', () => {
      // (128, 128, 128) - closest to white [255,255,255] by distance
      // dist to white: (127^2)*3 = 48387
      // dist to black: (128^2)*3 = 49152
      const result = findNearestColor(128, 128, 128, testPalette);
      assert.deepEqual(result, [255, 255, 255]);
    });
  });

  describe('quantizeToPalette', () => {
    it('quantizes non-transparent pixels to nearest palette color', () => {
      // 2 pixels: one reddish, one greenish
      const buffer = Buffer.from([
        250, 10, 10, 255,   // reddish -> should become [255, 0, 0]
        10, 240, 10, 255,   // greenish -> should become [0, 255, 0]
      ]);

      const result = quantizeToPalette(buffer, testPalette);

      assert.equal(result[0], 255);
      assert.equal(result[1], 0);
      assert.equal(result[2], 0);
      assert.equal(result[3], 255);

      assert.equal(result[4], 0);
      assert.equal(result[5], 255);
      assert.equal(result[6], 0);
      assert.equal(result[7], 255);
    });

    it('skips fully transparent pixels (alpha === 0)', () => {
      const buffer = Buffer.from([
        123, 45, 67, 0,     // transparent - should remain unchanged
        250, 10, 10, 255,   // opaque - should be quantized
      ]);

      quantizeToPalette(buffer, testPalette);

      // Transparent pixel unchanged
      assert.equal(buffer[0], 123);
      assert.equal(buffer[1], 45);
      assert.equal(buffer[2], 67);
      assert.equal(buffer[3], 0);

      // Opaque pixel quantized to red
      assert.equal(buffer[4], 255);
      assert.equal(buffer[5], 0);
      assert.equal(buffer[6], 0);
      assert.equal(buffer[7], 255);
    });

    it('returns the same buffer reference (modifies in place)', () => {
      const buffer = Buffer.from([255, 0, 0, 255]);
      const result = quantizeToPalette(buffer, testPalette);
      assert.equal(result, buffer);
    });

    it('handles empty buffer', () => {
      const buffer = Buffer.alloc(0);
      const result = quantizeToPalette(buffer, testPalette);
      assert.equal(result.length, 0);
    });

    it('throws on empty palette', () => {
      const buffer = Buffer.from([100, 100, 100, 255]);
      assert.throws(
        () => quantizeToPalette(buffer, []),
        /Quantization failed/
      );
    });

    it('enforces binary alpha: non-zero alpha becomes 255 (Requirement 10.5)', () => {
      const buffer = Buffer.from([
        250, 10, 10, 255,
        10, 240, 10, 200,  // non-zero alpha, should become 255
        50, 50, 50, 1,     // barely visible, alpha should become 255
      ]);

      quantizeToPalette(buffer, testPalette);

      assert.equal(buffer[3], 255);
      assert.equal(buffer[7], 255);  // was 200, now enforced to 255
      assert.equal(buffer[11], 255); // was 1, now enforced to 255
    });

    it('leaves alpha 0 pixels completely untouched', () => {
      const buffer = Buffer.from([
        123, 45, 67, 0,   // transparent - RGB should not change
      ]);

      quantizeToPalette(buffer, testPalette);

      assert.equal(buffer[0], 123);
      assert.equal(buffer[1], 45);
      assert.equal(buffer[2], 67);
      assert.equal(buffer[3], 0);
    });

    it('ensures zero color distance post-quantization for all non-transparent pixels', () => {
      // Create a buffer with various colors
      const buffer = Buffer.from([
        100, 50, 50, 255,
        50, 200, 50, 255,
        50, 50, 200, 255,
        200, 200, 200, 255,
      ]);

      quantizeToPalette(buffer, testPalette);

      // Verify each pixel exactly matches a palette color
      for (let i = 0; i < 4; i++) {
        const offset = i * 4;
        const r = buffer[offset];
        const g = buffer[offset + 1];
        const b = buffer[offset + 2];

        const inPalette = testPalette.some(
          ([pr, pg, pb]) => pr === r && pg === g && pb === b
        );
        assert.ok(inPalette, `Pixel ${i} [${r},${g},${b}] not in palette`);
      }
    });

    it('handles buffer with all transparent pixels', () => {
      const buffer = Buffer.from([
        123, 45, 67, 0,
        89, 101, 112, 0,
      ]);

      const result = quantizeToPalette(buffer, testPalette);

      // All pixels should remain unchanged
      assert.equal(result[0], 123);
      assert.equal(result[1], 45);
      assert.equal(result[2], 67);
      assert.equal(result[4], 89);
      assert.equal(result[5], 101);
      assert.equal(result[6], 112);
    });

    it('works with the primary palette from palette.js', () => {
      const { PRIMARY_PALETTE } = require('../../../js/level-generators/lib/palette');

      // A pixel that's close to grass green [95, 180, 72]
      const buffer = Buffer.from([90, 175, 70, 255]);

      quantizeToPalette(buffer, PRIMARY_PALETTE);

      assert.equal(buffer[0], 95);
      assert.equal(buffer[1], 180);
      assert.equal(buffer[2], 72);
    });
  });
});
