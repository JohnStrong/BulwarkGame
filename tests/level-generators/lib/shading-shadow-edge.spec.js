/**
 * Tests for shading.js applyShadowEdge edge cases.
 *
 * Covers:
 * - Single-pixel sprites (1x1)
 * - All-transparent buffers
 * - Very small buffers (2x2, 1xN, Nx1)
 * - Buffers where every pixel is an edge pixel
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/shading-shadow-edge.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { applyShadowEdge } = require('../../../js/level-generators/lib/shading');

function getPixel(buffer, width, x, y) {
    const idx = (y * width + x) * 4;
    return [buffer[idx], buffer[idx + 1], buffer[idx + 2], buffer[idx + 3]];
}

function setPixel(buffer, width, x, y, r, g, b, a = 255) {
    const idx = (y * width + x) * 4;
    buffer[idx] = r;
    buffer[idx + 1] = g;
    buffer[idx + 2] = b;
    buffer[idx + 3] = a;
}

describe('shading: applyShadowEdge - single-pixel sprites', () => {
    it('should darken a single opaque pixel (1x1 buffer)', () => {
        const buffer = Buffer.alloc(4);
        buffer[0] = 200;
        buffer[1] = 200;
        buffer[2] = 200;
        buffer[3] = 255;

        applyShadowEdge(buffer, 1, 1);

        // Single pixel has no opaque neighbors on right/bottom, so it's an edge pixel
        // Should be darkened by ~40%: 200 * 0.6 = 120
        const px = getPixel(buffer, 1, 0, 0);
        assert.equal(px[0], 120);
        assert.equal(px[1], 120);
        assert.equal(px[2], 120);
        assert.equal(px[3], 255);
    });

    it('should not modify a single transparent pixel (1x1 buffer)', () => {
        const buffer = Buffer.alloc(4, 0);

        applyShadowEdge(buffer, 1, 1);

        assert.deepEqual([...buffer], [0, 0, 0, 0]);
    });
});

describe('shading: applyShadowEdge - all-transparent buffers', () => {
    it('should not modify any pixels in a fully transparent 4x4 buffer', () => {
        const width = 4;
        const height = 4;
        const buffer = Buffer.alloc(width * height * 4, 0);

        applyShadowEdge(buffer, width, height);

        for (let i = 0; i < buffer.length; i++) {
            assert.equal(buffer[i], 0, `Byte ${i} should remain 0`);
        }
    });

    it('should not modify any pixels in a fully transparent 1x10 buffer', () => {
        const width = 1;
        const height = 10;
        const buffer = Buffer.alloc(width * height * 4, 0);

        applyShadowEdge(buffer, width, height);

        for (let i = 0; i < buffer.length; i++) {
            assert.equal(buffer[i], 0);
        }
    });

    it('should not modify any pixels in a fully transparent 10x1 buffer', () => {
        const width = 10;
        const height = 1;
        const buffer = Buffer.alloc(width * height * 4, 0);

        applyShadowEdge(buffer, width, height);

        for (let i = 0; i < buffer.length; i++) {
            assert.equal(buffer[i], 0);
        }
    });
});

describe('shading: applyShadowEdge - small buffers', () => {
    it('should handle 2x2 fully opaque buffer', () => {
        const width = 2;
        const height = 2;
        const buffer = Buffer.alloc(width * height * 4);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                setPixel(buffer, width, x, y, 200, 200, 200);
            }
        }

        applyShadowEdge(buffer, width, height);

        // Right column (x=1) should be darkened (right neighbor is out of bounds/transparent)
        const rightTop = getPixel(buffer, width, 1, 0);
        assert.ok(rightTop[0] < 200, `Right-top pixel should be darkened: ${rightTop[0]}`);

        // Bottom row (y=1) should be darkened
        const bottomLeft = getPixel(buffer, width, 0, 1);
        assert.ok(bottomLeft[0] < 200, `Bottom-left pixel should be darkened: ${bottomLeft[0]}`);

        // Bottom-right corner (1,1) should be darkened
        const bottomRight = getPixel(buffer, width, 1, 1);
        assert.ok(bottomRight[0] < 200, `Bottom-right pixel should be darkened: ${bottomRight[0]}`);
    });

    it('should handle 1xN vertical strip (all pixels are right-edge)', () => {
        const width = 1;
        const height = 4;
        const buffer = Buffer.alloc(width * height * 4);
        for (let y = 0; y < height; y++) {
            setPixel(buffer, width, 0, y, 200, 200, 200);
        }

        applyShadowEdge(buffer, width, height);

        // All pixels are on the right edge (no right neighbor) and bottom pixel is on bottom edge
        // At minimum, the bottom pixel should be darkened
        const bottomPx = getPixel(buffer, width, 0, 3);
        assert.ok(bottomPx[0] < 200, `Bottom pixel in 1xN strip should be darkened: ${bottomPx[0]}`);
    });

    it('should handle Nx1 horizontal strip (all pixels are bottom-edge)', () => {
        const width = 4;
        const height = 1;
        const buffer = Buffer.alloc(width * height * 4);
        for (let x = 0; x < width; x++) {
            setPixel(buffer, width, x, 0, 200, 200, 200);
        }

        applyShadowEdge(buffer, width, height);

        // All pixels are on the bottom edge (no bottom neighbor) and rightmost is on right edge
        // At minimum, the rightmost pixel should be darkened
        const rightPx = getPixel(buffer, width, 3, 0);
        assert.ok(rightPx[0] < 200, `Rightmost pixel in Nx1 strip should be darkened: ${rightPx[0]}`);
    });
});

describe('shading: applyShadowEdge - mixed transparent/opaque', () => {
    it('should only darken opaque pixels adjacent to transparent pixels on right/bottom', () => {
        const width = 3;
        const height = 3;
        const buffer = Buffer.alloc(width * height * 4, 0);

        // Create an L-shape:
        // X X .
        // X . .
        // . . .
        setPixel(buffer, width, 0, 0, 200, 200, 200);
        setPixel(buffer, width, 1, 0, 200, 200, 200);
        setPixel(buffer, width, 0, 1, 200, 200, 200);

        applyShadowEdge(buffer, width, height);

        // (1,0) has transparent right neighbor → should be darkened
        const px10 = getPixel(buffer, width, 1, 0);
        assert.ok(px10[0] < 200, `Pixel (1,0) should be darkened: ${px10[0]}`);

        // (0,1) has transparent bottom neighbor → should be darkened
        const px01 = getPixel(buffer, width, 0, 1);
        assert.ok(px01[0] < 200, `Pixel (0,1) should be darkened: ${px01[0]}`);
    });

    it('should preserve alpha of darkened pixels', () => {
        const width = 3;
        const height = 3;
        const buffer = Buffer.alloc(width * height * 4, 0);
        setPixel(buffer, width, 1, 1, 200, 200, 200, 255);

        applyShadowEdge(buffer, width, height);

        const px = getPixel(buffer, width, 1, 1);
        assert.equal(px[3], 255, 'Alpha should remain 255 after darkening');
    });
});
