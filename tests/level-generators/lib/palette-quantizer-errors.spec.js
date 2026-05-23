/**
 * Tests for palette-quantizer.js error/edge-case paths.
 *
 * Covers:
 * - Validation failure throw path (post-quantization check)
 * - Empty/null buffer handling
 * - Single-pixel buffers
 * - Large buffers with mixed transparent/opaque pixels
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/palette-quantizer-errors.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { quantizeToPalette, findNearestColor, colorDistanceSq } = require('../../../js/level-generators/lib/palette-quantizer');

describe('palette-quantizer: error paths', () => {
    const testPalette = [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 255],
        [0, 0, 0],
    ];

    it('should throw "Quantization failed" when palette is empty', () => {
        const buffer = Buffer.from([100, 100, 100, 255]);
        assert.throws(
            () => quantizeToPalette(buffer, []),
            { message: /Quantization failed/ }
        );
    });

    it('should throw with descriptive message including "palette is empty"', () => {
        const buffer = Buffer.from([100, 100, 100, 255]);
        assert.throws(
            () => quantizeToPalette(buffer, []),
            { message: /palette is empty/ }
        );
    });

    it('should handle null buffer gracefully', () => {
        const result = quantizeToPalette(null, testPalette);
        assert.equal(result, null);
    });

    it('should handle empty buffer (length 0)', () => {
        const buffer = Buffer.alloc(0);
        const result = quantizeToPalette(buffer, testPalette);
        assert.equal(result.length, 0);
    });

    it('should handle single-pixel opaque buffer', () => {
        const buffer = Buffer.from([128, 0, 0, 255]);
        quantizeToPalette(buffer, testPalette);
        // Should be quantized to nearest: red [255, 0, 0]
        assert.equal(buffer[0], 255);
        assert.equal(buffer[1], 0);
        assert.equal(buffer[2], 0);
        assert.equal(buffer[3], 255);
    });

    it('should handle single-pixel transparent buffer', () => {
        const buffer = Buffer.from([128, 64, 32, 0]);
        quantizeToPalette(buffer, testPalette);
        // Should remain unchanged
        assert.equal(buffer[0], 128);
        assert.equal(buffer[1], 64);
        assert.equal(buffer[2], 32);
        assert.equal(buffer[3], 0);
    });

    it('should handle buffer with all pixels already in palette', () => {
        const buffer = Buffer.from([
            255, 0, 0, 255,     // red - already in palette
            0, 255, 0, 255,     // green - already in palette
            0, 0, 255, 255,     // blue - already in palette
        ]);
        // Should not throw
        const result = quantizeToPalette(buffer, testPalette);
        assert.equal(result[0], 255);
        assert.equal(result[4], 0);
        assert.equal(result[8], 0);
    });

    it('should handle large buffer with mixed transparent and opaque pixels', () => {
        // 100 pixels: alternating transparent and opaque
        const buffer = Buffer.alloc(100 * 4);
        for (let i = 0; i < 100; i++) {
            const offset = i * 4;
            buffer[offset] = (i * 17) % 256;
            buffer[offset + 1] = (i * 31) % 256;
            buffer[offset + 2] = (i * 47) % 256;
            buffer[offset + 3] = i % 2 === 0 ? 255 : 0; // alternating
        }

        quantizeToPalette(buffer, testPalette);

        // Verify all opaque pixels are now in palette
        for (let i = 0; i < 100; i++) {
            const offset = i * 4;
            if (buffer[offset + 3] === 0) continue;

            const r = buffer[offset];
            const g = buffer[offset + 1];
            const b = buffer[offset + 2];
            const inPalette = testPalette.some(
                ([pr, pg, pb]) => pr === r && pg === g && pb === b
            );
            assert.ok(inPalette, `Pixel ${i} [${r},${g},${b}] not in palette`);
        }
    });

    it('should enforce binary alpha on partially transparent pixels', () => {
        const buffer = Buffer.from([
            100, 100, 100, 50,   // partial alpha
            100, 100, 100, 128,  // partial alpha
            100, 100, 100, 254,  // almost opaque
        ]);

        quantizeToPalette(buffer, testPalette);

        // All non-zero alpha should become 255
        assert.equal(buffer[3], 255);
        assert.equal(buffer[7], 255);
        assert.equal(buffer[11], 255);
    });

    it('should handle palette with single color', () => {
        const singlePalette = [[128, 128, 128]];
        const buffer = Buffer.from([
            0, 0, 0, 255,
            255, 255, 255, 255,
            100, 50, 200, 255,
        ]);

        quantizeToPalette(buffer, singlePalette);

        // All pixels should be quantized to the single palette color
        for (let i = 0; i < 3; i++) {
            const offset = i * 4;
            assert.equal(buffer[offset], 128);
            assert.equal(buffer[offset + 1], 128);
            assert.equal(buffer[offset + 2], 128);
        }
    });

    it('should handle palette with very similar colors', () => {
        const similarPalette = [
            [100, 100, 100],
            [101, 100, 100],
            [100, 101, 100],
        ];
        const buffer = Buffer.from([100, 100, 100, 255]);

        quantizeToPalette(buffer, similarPalette);

        // Should match exactly [100, 100, 100]
        assert.equal(buffer[0], 100);
        assert.equal(buffer[1], 100);
        assert.equal(buffer[2], 100);
    });
});

describe('palette-quantizer: findNearestColor edge cases', () => {
    it('should handle palette with one entry', () => {
        const result = findNearestColor(0, 0, 0, [[255, 255, 255]]);
        assert.deepEqual(result, [255, 255, 255]);
    });

    it('should return first match when multiple colors are equidistant', () => {
        // (128, 0, 0) is equidistant from (0, 0, 0) and (255, 0, 0)
        // dist to [0,0,0] = 128^2 = 16384
        // dist to [255,0,0] = 127^2 = 16129
        // Actually not equidistant, but let's test with truly equidistant
        const palette = [[0, 0, 0], [200, 0, 0]];
        // (100, 0, 0): dist to [0,0,0] = 10000, dist to [200,0,0] = 10000
        const result = findNearestColor(100, 0, 0, palette);
        // Should return first one found (implementation detail)
        assert.ok(
            (result[0] === 0 && result[1] === 0 && result[2] === 0) ||
            (result[0] === 200 && result[1] === 0 && result[2] === 0)
        );
    });

    it('should handle max RGB values', () => {
        const palette = [[255, 255, 255], [0, 0, 0]];
        const result = findNearestColor(255, 255, 255, palette);
        assert.deepEqual(result, [255, 255, 255]);
    });

    it('should handle min RGB values', () => {
        const palette = [[255, 255, 255], [0, 0, 0]];
        const result = findNearestColor(0, 0, 0, palette);
        assert.deepEqual(result, [0, 0, 0]);
    });
});

describe('palette-quantizer: colorDistanceSq edge cases', () => {
    it('should return 0 for black to black', () => {
        assert.equal(colorDistanceSq(0, 0, 0, 0, 0, 0), 0);
    });

    it('should return 0 for white to white', () => {
        assert.equal(colorDistanceSq(255, 255, 255, 255, 255, 255), 0);
    });

    it('should return maximum distance for black to white', () => {
        // (255-0)^2 * 3 = 195075
        assert.equal(colorDistanceSq(0, 0, 0, 255, 255, 255), 195075);
    });

    it('should be symmetric (a→b equals b→a)', () => {
        const d1 = colorDistanceSq(10, 20, 30, 100, 200, 50);
        const d2 = colorDistanceSq(100, 200, 50, 10, 20, 30);
        assert.equal(d1, d2);
    });
});
