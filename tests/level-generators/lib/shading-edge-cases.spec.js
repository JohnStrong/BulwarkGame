/**
 * Edge case tests for js/level-generators/lib/shading.js
 *
 * Recommendation 4 (partial): Tests boundary conditions for applyShadowEdge
 * including single-pixel buffers and minimal dimensions.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/shading-edge-cases.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    applyDirectionalShading,
    applyFaceShading,
    applyShadowEdge,
} = require('../../../js/level-generators/lib/shading');

function getPixel(buffer, width, x, y) {
    const idx = (y * width + x) * 4;
    return [buffer[idx], buffer[idx + 1], buffer[idx + 2], buffer[idx + 3]];
}

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

// ─── applyShadowEdge boundary conditions ────────────────────────────────────

describe('shading: applyShadowEdge boundary conditions', () => {
    it('should handle 1×1 buffer (single pixel)', () => {
        const width = 1;
        const height = 1;
        const buffer = Buffer.alloc(4);
        buffer[0] = 200; buffer[1] = 200; buffer[2] = 200; buffer[3] = 255;

        // Should not throw
        assert.doesNotThrow(() => {
            applyShadowEdge(buffer, width, height);
        });

        // Single pixel has no opaque neighbors, so it's an edge pixel
        const px = getPixel(buffer, width, 0, 0);
        assert.ok(px[0] < 200, `Single pixel should be darkened, got ${px[0]}`);
    });

    it('should handle 1×1 transparent buffer', () => {
        const width = 1;
        const height = 1;
        const buffer = Buffer.alloc(4, 0);

        assert.doesNotThrow(() => {
            applyShadowEdge(buffer, width, height);
        });

        // Should remain all zeros
        assert.deepEqual([...buffer], [0, 0, 0, 0]);
    });

    it('should handle 2×1 buffer (single row, two pixels)', () => {
        const width = 2;
        const height = 1;
        const buffer = Buffer.alloc(width * height * 4);
        // Both pixels opaque
        buffer[0] = 200; buffer[1] = 200; buffer[2] = 200; buffer[3] = 255;
        buffer[4] = 200; buffer[5] = 200; buffer[6] = 200; buffer[7] = 255;

        applyShadowEdge(buffer, width, height);

        // Right pixel (x=1) is on the right edge
        const rightPx = getPixel(buffer, width, 1, 0);
        assert.ok(rightPx[0] < 200, `Right pixel should be darkened`);

        // Both are on bottom edge (height=1, no row below)
        const leftPx = getPixel(buffer, width, 0, 0);
        assert.ok(leftPx[0] < 200, `Left pixel should also be darkened (bottom edge)`);
    });

    it('should handle 1×2 buffer (single column, two pixels)', () => {
        const width = 1;
        const height = 2;
        const buffer = Buffer.alloc(width * height * 4);
        // Both pixels opaque
        buffer[0] = 200; buffer[1] = 200; buffer[2] = 200; buffer[3] = 255;
        buffer[4] = 200; buffer[5] = 200; buffer[6] = 200; buffer[7] = 255;

        applyShadowEdge(buffer, width, height);

        // Bottom pixel (y=1) is on the bottom edge
        const bottomPx = getPixel(buffer, width, 0, 1);
        assert.ok(bottomPx[0] < 200, `Bottom pixel should be darkened`);

        // Both are on right edge (width=1, no column to the right)
        const topPx = getPixel(buffer, width, 0, 0);
        assert.ok(topPx[0] < 200, `Top pixel should also be darkened (right edge)`);
    });

    it('should handle buffer with alternating opaque/transparent pixels', () => {
        const width = 4;
        const height = 1;
        const buffer = Buffer.alloc(width * height * 4, 0);
        // Checkerboard: opaque, transparent, opaque, transparent
        buffer[0] = 200; buffer[1] = 200; buffer[2] = 200; buffer[3] = 255;
        buffer[8] = 200; buffer[9] = 200; buffer[10] = 200; buffer[11] = 255;

        assert.doesNotThrow(() => {
            applyShadowEdge(buffer, width, height);
        });

        // Both opaque pixels are edge pixels (neighbors are transparent)
        const px0 = getPixel(buffer, width, 0, 0);
        const px2 = getPixel(buffer, width, 2, 0);
        assert.ok(px0[0] < 200, 'Isolated pixel 0 should be darkened');
        assert.ok(px2[0] < 200, 'Isolated pixel 2 should be darkened');
    });

    it('should handle buffer with all pixels at value 0 (black opaque)', () => {
        const width = 3;
        const height = 3;
        const buffer = Buffer.alloc(width * height * 4);
        // All opaque black
        for (let i = 0; i < width * height; i++) {
            buffer[i * 4 + 3] = 255; // alpha = 255, RGB = 0
        }

        applyShadowEdge(buffer, width, height);

        // Edge pixels darkened from 0 → 0 * 0.6 = 0 (can't go below 0)
        const edgePx = getPixel(buffer, width, 2, 2);
        assert.equal(edgePx[0], 0, 'Black pixel darkened stays at 0');
    });

    it('should handle buffer with max value pixels (255 opaque)', () => {
        const width = 3;
        const height = 3;
        const buffer = createSolidBuffer(width, height, 255, 255, 255);

        applyShadowEdge(buffer, width, height);

        // Edge pixels: 255 * 0.6 = 153
        const edgePx = getPixel(buffer, width, 2, 2);
        assert.equal(edgePx[0], 153, `White edge pixel should darken to 153, got ${edgePx[0]}`);

        // Interior pixel should remain unchanged
        const centerPx = getPixel(buffer, width, 1, 1);
        assert.equal(centerPx[0], 255, 'Interior pixel should remain 255');
    });
});

// ─── applyDirectionalShading boundary conditions ────────────────────────────

describe('shading: applyDirectionalShading boundary conditions', () => {
    it('should handle 1×1 buffer', () => {
        const buffer = Buffer.alloc(4);
        buffer[0] = 128; buffer[1] = 128; buffer[2] = 128; buffer[3] = 255;

        assert.doesNotThrow(() => {
            applyDirectionalShading(buffer, 1, 1, 0.2, 0.2);
        });
    });

    it('should handle 0% highlight and 0% shadow (no change)', () => {
        const width = 4;
        const height = 4;
        const buffer = createSolidBuffer(width, height, 100, 100, 100);
        const original = Buffer.from(buffer);

        applyDirectionalShading(buffer, width, height, 0, 0);

        // With 0% highlight and shadow, buffer should be unchanged
        assert.ok(buffer.equals(original), 'Zero shading should not modify buffer');
    });

    it('should handle 100% highlight and 100% shadow (extreme)', () => {
        const width = 4;
        const height = 4;
        const buffer = createSolidBuffer(width, height, 128, 128, 128);

        assert.doesNotThrow(() => {
            applyDirectionalShading(buffer, width, height, 1.0, 1.0);
        });

        // UL corner should be very bright (128 * 2.0 = 256, clamped to 255)
        const ul = getPixel(buffer, width, 0, 0);
        assert.equal(ul[0], 255, 'UL with 100% highlight should clamp to 255');

        // BR corner should be very dark (128 * 0.0 = 0)
        const br = getPixel(buffer, width, 3, 3);
        assert.equal(br[0], 0, 'BR with 100% shadow should be 0');
    });
});

// ─── applyFaceShading boundary conditions ───────────────────────────────────

describe('shading: applyFaceShading boundary conditions', () => {
    it('should handle 1×1 buffer (single pixel is top face)', () => {
        const buffer = Buffer.alloc(4);
        buffer[0] = 128; buffer[1] = 128; buffer[2] = 128; buffer[3] = 255;

        assert.doesNotThrow(() => {
            applyFaceShading(buffer, 1, 1, [200, 200, 200], [60, 60, 60]);
        });
    });

    it('should handle odd height (midpoint rounds down)', () => {
        const width = 2;
        const height = 3; // midpoint = 1.5, floor = 1
        const buffer = createSolidBuffer(width, height, 128, 128, 128);

        applyFaceShading(buffer, width, height, [255, 255, 255], [0, 0, 0]);

        // Row 0 is top face (y < 1.5)
        const topPx = getPixel(buffer, width, 0, 0);
        // Row 2 is side face (y >= 1.5)
        const botPx = getPixel(buffer, width, 0, 2);
        assert.ok(topPx[0] > botPx[0],
            `Top face (${topPx[0]}) should be brighter than side face (${botPx[0]})`);
    });

    it('should handle same topColor and sideColor (no visible change)', () => {
        const width = 4;
        const height = 4;
        const buffer = createSolidBuffer(width, height, 128, 128, 128);

        applyFaceShading(buffer, width, height, [128, 128, 128], [128, 128, 128]);

        // All pixels should remain at 128 (blending toward same color)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const px = getPixel(buffer, width, x, y);
                assert.equal(px[0], 128, `Pixel at (${x},${y}) should remain 128`);
            }
        }
    });
});
