/**
 * Boundary and branch coverage tests for shading module.
 *
 * Recommendation 7: Increase branch coverage in shading/dithering.
 * Tests: factor=0 (full highlight), factor=1 (full shadow), factor=0.5 (no change),
 * shadow edge darkening factor (0.6) produces expected RGB values,
 * corner pixel classification in applyShadowEdge.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/shading-boundary.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    applyDirectionalShading,
    applyFaceShading,
    applyShadowEdge,
} = require('../../../js/level-generators/lib/shading');

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

function getPixel(buffer, width, x, y) {
    const idx = (y * width + x) * 4;
    return [buffer[idx], buffer[idx + 1], buffer[idx + 2], buffer[idx + 3]];
}

describe('shading: applyDirectionalShading factor boundaries', () => {
    it('factor=0 (UL corner): multiplier should be 1 + highlightPercent', () => {
        const width = 4;
        const height = 4;
        const buffer = createSolidBuffer(width, height, 100, 100, 100);

        applyDirectionalShading(buffer, width, height, 0.3, 0.3);

        // At (0,0): nx=0, ny=0, factor=0, t=1, multiplier=1.3
        const ul = getPixel(buffer, width, 0, 0);
        assert.equal(ul[0], Math.round(100 * 1.3)); // 130
        assert.equal(ul[1], Math.round(100 * 1.3));
        assert.equal(ul[2], Math.round(100 * 1.3));
    });

    it('factor=1 (BR corner): multiplier should be 1 - shadowPercent', () => {
        const width = 4;
        const height = 4;
        const buffer = createSolidBuffer(width, height, 100, 100, 100);

        applyDirectionalShading(buffer, width, height, 0.3, 0.3);

        // At (3,3): nx=1, ny=1, factor=1, t=1, multiplier=0.7
        const br = getPixel(buffer, width, 3, 3);
        assert.equal(br[0], Math.round(100 * 0.7)); // 70
        assert.equal(br[1], Math.round(100 * 0.7));
        assert.equal(br[2], Math.round(100 * 0.7));
    });

    it('factor=0.5 (center): multiplier should be exactly 1.0 (no change)', () => {
        // For a 3x3 buffer, center pixel (1,1): nx=0.5, ny=0.5, factor=0.5
        // At factor=0.5: t = 1 - (0.5/0.5) = 0, multiplier = 1 + 0 = 1
        const width = 3;
        const height = 3;
        const buffer = createSolidBuffer(width, height, 150, 150, 150);

        applyDirectionalShading(buffer, width, height, 0.4, 0.4);

        const center = getPixel(buffer, width, 1, 1);
        assert.equal(center[0], 150); // No change at factor=0.5
        assert.equal(center[1], 150);
        assert.equal(center[2], 150);
    });

    it('should handle width=1 (nx always 0.5)', () => {
        const width = 1;
        const height = 4;
        const buffer = createSolidBuffer(width, height, 100, 100, 100);

        applyDirectionalShading(buffer, width, height, 0.2, 0.2);

        // With width=1, nx=0.5 for all pixels
        // At (0,0): ny=0, factor=(0.5+0)/2=0.25, in highlight zone
        const top = getPixel(buffer, width, 0, 0);
        assert.ok(top[0] > 100, `Top pixel should be highlighted, got ${top[0]}`);

        // At (0,3): ny=1, factor=(0.5+1)/2=0.75, in shadow zone
        const bot = getPixel(buffer, width, 0, 3);
        assert.ok(bot[0] < 100, `Bottom pixel should be shadowed, got ${bot[0]}`);
    });

    it('should handle height=1 (ny always 0.5)', () => {
        const width = 4;
        const height = 1;
        const buffer = createSolidBuffer(width, height, 100, 100, 100);

        applyDirectionalShading(buffer, width, height, 0.2, 0.2);

        // With height=1, ny=0.5 for all pixels
        // At (0,0): nx=0, factor=(0+0.5)/2=0.25, in highlight zone
        const left = getPixel(buffer, width, 0, 0);
        assert.ok(left[0] > 100, `Left pixel should be highlighted, got ${left[0]}`);

        // At (3,0): nx=1, factor=(1+0.5)/2=0.75, in shadow zone
        const right = getPixel(buffer, width, 3, 0);
        assert.ok(right[0] < 100, `Right pixel should be shadowed, got ${right[0]}`);
    });

    it('should clamp to 0 when shadow would produce negative values', () => {
        const width = 4;
        const height = 4;
        // Low value that would go negative with 100% shadow
        const buffer = createSolidBuffer(width, height, 10, 10, 10);

        applyDirectionalShading(buffer, width, height, 0, 1.0);

        // BR corner: multiplier = 1 - 1.0 = 0, so value = 0
        const br = getPixel(buffer, width, 3, 3);
        assert.equal(br[0], 0);
        assert.equal(br[1], 0);
        assert.equal(br[2], 0);
    });

    it('should clamp to 255 when highlight would overflow', () => {
        const width = 4;
        const height = 4;
        const buffer = createSolidBuffer(width, height, 200, 200, 200);

        applyDirectionalShading(buffer, width, height, 1.0, 0);

        // UL corner: multiplier = 1 + 1.0 = 2.0, value = 400, clamped to 255
        const ul = getPixel(buffer, width, 0, 0);
        assert.equal(ul[0], 255);
        assert.equal(ul[1], 255);
        assert.equal(ul[2], 255);
    });
});

describe('shading: applyShadowEdge darkening factor verification', () => {
    it('should darken by exactly 40% (multiply by 0.6)', () => {
        const width = 3;
        const height = 3;
        const buffer = Buffer.alloc(width * height * 4, 0);
        // Single pixel at center
        const idx = (1 * width + 1) * 4;
        buffer[idx] = 200; buffer[idx + 1] = 150; buffer[idx + 2] = 100; buffer[idx + 3] = 255;

        applyShadowEdge(buffer, width, height);

        const px = getPixel(buffer, width, 1, 1);
        assert.equal(px[0], Math.round(200 * 0.6)); // 120
        assert.equal(px[1], Math.round(150 * 0.6)); // 90
        assert.equal(px[2], Math.round(100 * 0.6)); // 60
    });

    it('should darken value 255 to 153', () => {
        const width = 3;
        const height = 3;
        const buffer = Buffer.alloc(width * height * 4, 0);
        const idx = (1 * width + 1) * 4;
        buffer[idx] = 255; buffer[idx + 1] = 255; buffer[idx + 2] = 255; buffer[idx + 3] = 255;

        applyShadowEdge(buffer, width, height);

        const px = getPixel(buffer, width, 1, 1);
        assert.equal(px[0], 153); // round(255 * 0.6) = 153
    });

    it('should darken value 1 to 1 (round(1 * 0.6) = 1)', () => {
        const width = 3;
        const height = 3;
        const buffer = Buffer.alloc(width * height * 4, 0);
        const idx = (1 * width + 1) * 4;
        buffer[idx] = 1; buffer[idx + 1] = 1; buffer[idx + 2] = 1; buffer[idx + 3] = 255;

        applyShadowEdge(buffer, width, height);

        const px = getPixel(buffer, width, 1, 1);
        assert.equal(px[0], Math.round(1 * 0.6)); // 1
    });

    it('should darken value 0 to 0 (no underflow)', () => {
        const width = 3;
        const height = 3;
        const buffer = Buffer.alloc(width * height * 4, 0);
        const idx = (1 * width + 1) * 4;
        buffer[idx] = 0; buffer[idx + 1] = 0; buffer[idx + 2] = 0; buffer[idx + 3] = 255;

        applyShadowEdge(buffer, width, height);

        const px = getPixel(buffer, width, 1, 1);
        assert.equal(px[0], 0);
    });
});

describe('shading: applyShadowEdge corner pixel classification', () => {
    it('top-left corner of solid block should NOT be edge (has right and bottom neighbors)', () => {
        const width = 4;
        const height = 4;
        const buffer = createSolidBuffer(width, height, 200, 200, 200);

        applyShadowEdge(buffer, width, height);

        // (0,0) has right neighbor (1,0) and bottom neighbor (0,1) and BR neighbor (1,1)
        // All are opaque, so (0,0) is NOT an edge pixel
        // But wait — (0,0) is on the boundary of the buffer, so right/bottom checks pass
        // Actually for a fully opaque buffer, only right column, bottom row, and BR diagonal matter
        // (0,0): right=(1,0) opaque, bottom=(0,1) opaque, BR=(1,1) opaque → NOT edge
        const tl = getPixel(buffer, width, 0, 0);
        assert.equal(tl[0], 200, 'Top-left interior pixel should not be darkened');
    });

    it('top-right corner should be edge (x === width-1)', () => {
        const width = 4;
        const height = 4;
        const buffer = createSolidBuffer(width, height, 200, 200, 200);

        applyShadowEdge(buffer, width, height);

        const tr = getPixel(buffer, width, 3, 0);
        assert.ok(tr[0] < 200, `Top-right corner should be darkened (right edge), got ${tr[0]}`);
    });

    it('bottom-left corner should be edge (y === height-1)', () => {
        const width = 4;
        const height = 4;
        const buffer = createSolidBuffer(width, height, 200, 200, 200);

        applyShadowEdge(buffer, width, height);

        const bl = getPixel(buffer, width, 0, 3);
        assert.ok(bl[0] < 200, `Bottom-left corner should be darkened (bottom edge), got ${bl[0]}`);
    });

    it('bottom-right corner should be edge (both boundaries)', () => {
        const width = 4;
        const height = 4;
        const buffer = createSolidBuffer(width, height, 200, 200, 200);

        applyShadowEdge(buffer, width, height);

        const br = getPixel(buffer, width, 3, 3);
        assert.ok(br[0] < 200, `Bottom-right corner should be darkened, got ${br[0]}`);
    });

    it('pixel with only BR diagonal transparent should be edge', () => {
        const width = 3;
        const height = 3;
        // All opaque except (2,2) which is transparent
        const buffer = createSolidBuffer(width, height, 200, 200, 200);
        // Make (2,2) transparent
        const idx = (2 * width + 2) * 4;
        buffer[idx + 3] = 0;

        applyShadowEdge(buffer, width, height);

        // (1,1) has right=(2,1) opaque, bottom=(1,2) opaque, but BR=(2,2) transparent → edge
        const px = getPixel(buffer, width, 1, 1);
        assert.ok(px[0] < 200, `Pixel (1,1) should be edge due to transparent BR diagonal, got ${px[0]}`);
    });
});
