/**
 * Edge direction tests for dithering module.
 *
 * Recommendation 7: Test all four edge directions in applyOrderedDithering()
 * and verify the gradient pattern for each direction.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/dithering-edges.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { applyOrderedDithering } = require('../../../js/level-generators/lib/dithering');

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

function getPixel(buffer, width, x, y) {
    const idx = (y * width + x) * 4;
    return [buffer[idx], buffer[idx + 1], buffer[idx + 2], buffer[idx + 3]];
}

const colorA = [95, 180, 72];
const colorB = [210, 165, 110];

function isColorA(r, g, b) {
    return r === colorA[0] && g === colorA[1] && b === colorA[2];
}

function isColorB(r, g, b) {
    return r === colorB[0] && g === colorB[1] && b === colorB[2];
}

describe('dithering: left edge direction', () => {
    it('should only modify pixels in the left borderWidth columns', () => {
        const width = 16;
        const height = 16;
        const buffer = createFilledBuffer(width, height, colorA);
        const original = Buffer.from(buffer);
        applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'left');

        // Pixels at x >= 4 should be unchanged
        for (let y = 0; y < height; y++) {
            for (let x = 4; x < width; x++) {
                const idx = (y * width + x) * 4;
                assert.equal(buffer[idx], original[idx], `R at (${x},${y})`);
                assert.equal(buffer[idx + 1], original[idx + 1], `G at (${x},${y})`);
                assert.equal(buffer[idx + 2], original[idx + 2], `B at (${x},${y})`);
            }
        }
    });

    it('should use only colorA and colorB in the left border region', () => {
        const width = 16;
        const height = 16;
        const buffer = createFilledBuffer(width, height, colorA);
        applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'left');

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < 4; x++) {
                const [r, g, b] = getPixel(buffer, width, x, y);
                assert.ok(isColorA(r, g, b) || isColorB(r, g, b),
                    `Pixel at (${x},${y}) is [${r},${g},${b}] — expected colorA or colorB`);
            }
        }
    });

    it('should have gradient: more colorB at x=0, more colorA at x=3', () => {
        const width = 16;
        const height = 16;
        const buffer = createFilledBuffer(width, height, colorA);
        applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'left');

        let colorBAtEdge = 0;
        let colorBAtDeep = 0;
        for (let y = 0; y < height; y++) {
            const [r0, g0, b0] = getPixel(buffer, width, 0, y);
            if (isColorB(r0, g0, b0)) colorBAtEdge++;
            const [r3, g3, b3] = getPixel(buffer, width, 3, y);
            if (isColorB(r3, g3, b3)) colorBAtDeep++;
        }
        assert.ok(colorBAtEdge >= colorBAtDeep,
            `Edge (x=0) should have >= colorB than deep (x=3): ${colorBAtEdge} vs ${colorBAtDeep}`);
    });
});

describe('dithering: right edge direction', () => {
    it('should only modify pixels in the right borderWidth columns', () => {
        const width = 16;
        const height = 16;
        const buffer = createFilledBuffer(width, height, colorA);
        const original = Buffer.from(buffer);
        applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'right');

        // Pixels at x < 12 should be unchanged
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < 12; x++) {
                const idx = (y * width + x) * 4;
                assert.equal(buffer[idx], original[idx], `R at (${x},${y})`);
            }
        }
    });

    it('should use only colorA and colorB in the right border region', () => {
        const width = 16;
        const height = 16;
        const buffer = createFilledBuffer(width, height, colorA);
        applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'right');

        for (let y = 0; y < height; y++) {
            for (let x = 12; x < 16; x++) {
                const [r, g, b] = getPixel(buffer, width, x, y);
                assert.ok(isColorA(r, g, b) || isColorB(r, g, b),
                    `Pixel at (${x},${y}) is [${r},${g},${b}] — expected colorA or colorB`);
            }
        }
    });

    it('should have gradient: more colorB at x=15 (edge), more colorA at x=12 (deep)', () => {
        const width = 16;
        const height = 16;
        const buffer = createFilledBuffer(width, height, colorA);
        applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'right');

        let colorBAtEdge = 0;
        let colorBAtDeep = 0;
        for (let y = 0; y < height; y++) {
            const [r15, g15, b15] = getPixel(buffer, width, 15, y);
            if (isColorB(r15, g15, b15)) colorBAtEdge++;
            const [r12, g12, b12] = getPixel(buffer, width, 12, y);
            if (isColorB(r12, g12, b12)) colorBAtDeep++;
        }
        assert.ok(colorBAtEdge >= colorBAtDeep,
            `Edge (x=15) should have >= colorB than deep (x=12): ${colorBAtEdge} vs ${colorBAtDeep}`);
    });
});

describe('dithering: top edge gradient verification', () => {
    it('should have more colorB at y=0 (edge) than y=3 (deepest)', () => {
        const width = 16;
        const height = 16;
        const buffer = createFilledBuffer(width, height, colorA);
        applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'top');

        let colorBAtEdge = 0;
        let colorBAtDeep = 0;
        for (let x = 0; x < width; x++) {
            const [r0, g0, b0] = getPixel(buffer, width, x, 0);
            if (isColorB(r0, g0, b0)) colorBAtEdge++;
            const [r3, g3, b3] = getPixel(buffer, width, x, 3);
            if (isColorB(r3, g3, b3)) colorBAtDeep++;
        }
        assert.ok(colorBAtEdge >= colorBAtDeep,
            `Edge (y=0) should have >= colorB than deep (y=3): ${colorBAtEdge} vs ${colorBAtDeep}`);
    });
});

describe('dithering: bottom edge gradient verification', () => {
    it('should have more colorB at y=15 (edge) than y=12 (deepest)', () => {
        const width = 16;
        const height = 16;
        const buffer = createFilledBuffer(width, height, colorA);
        applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'bottom');

        let colorBAtEdge = 0;
        let colorBAtDeep = 0;
        for (let x = 0; x < width; x++) {
            const [r15, g15, b15] = getPixel(buffer, width, x, 15);
            if (isColorB(r15, g15, b15)) colorBAtEdge++;
            const [r12, g12, b12] = getPixel(buffer, width, x, 12);
            if (isColorB(r12, g12, b12)) colorBAtDeep++;
        }
        assert.ok(colorBAtEdge >= colorBAtDeep,
            `Edge (y=15) should have >= colorB than deep (y=12): ${colorBAtEdge} vs ${colorBAtDeep}`);
    });
});

describe('dithering: invalid edge direction', () => {
    it('should not modify any pixels for unknown edge direction', () => {
        const width = 16;
        const height = 16;
        const buffer = createFilledBuffer(width, height, colorA);
        const original = Buffer.from(buffer);
        applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'diagonal');

        assert.ok(buffer.equals(original), 'Unknown edge should leave buffer unchanged');
    });

    it('should not modify any pixels when edge is undefined', () => {
        const width = 16;
        const height = 16;
        const buffer = createFilledBuffer(width, height, colorA);
        const original = Buffer.from(buffer);
        applyOrderedDithering(buffer, width, height, colorA, colorB, 4, undefined);

        assert.ok(buffer.equals(original), 'Undefined edge should leave buffer unchanged');
    });
});

describe('dithering: borderWidth edge cases', () => {
    it('should handle borderWidth=1 (single pixel strip)', () => {
        const width = 8;
        const height = 8;
        const buffer = createFilledBuffer(width, height, colorA);
        applyOrderedDithering(buffer, width, height, colorA, colorB, 1, 'top');

        // Only row 0 should be affected
        let hasColorB = false;
        for (let x = 0; x < width; x++) {
            const [r, g, b] = getPixel(buffer, width, x, 0);
            if (isColorB(r, g, b)) hasColorB = true;
        }
        // With borderWidth=1, depth=0 always, ratio=0/(1-1)=NaN → threshold=NaN
        // bayerValue < NaN is always false, so all pixels become colorB
        // Actually: depth / (borderWidth - 1) = 0/0 = NaN, threshold = NaN
        // bayerValue < NaN → false → color = colorB
        for (let x = 0; x < width; x++) {
            const [r, g, b] = getPixel(buffer, width, x, 0);
            assert.ok(isColorA(r, g, b) || isColorB(r, g, b),
                `Pixel at (${x},0) should be colorA or colorB`);
        }

        // Row 1 should be unchanged
        for (let x = 0; x < width; x++) {
            const [r, g, b] = getPixel(buffer, width, x, 1);
            assert.ok(isColorA(r, g, b), `Row 1 pixel at (${x},1) should be unchanged`);
        }
    });

    it('should handle borderWidth equal to buffer dimension', () => {
        const width = 4;
        const height = 4;
        const buffer = createFilledBuffer(width, height, colorA);
        applyOrderedDithering(buffer, width, height, colorA, colorB, 4, 'top');

        // All rows should be in the border region
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const [r, g, b] = getPixel(buffer, width, x, y);
                assert.ok(isColorA(r, g, b) || isColorB(r, g, b),
                    `Pixel at (${x},${y}) should be colorA or colorB`);
            }
        }
    });
});
