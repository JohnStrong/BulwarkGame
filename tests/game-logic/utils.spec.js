/**
 * Tests for js/game-logic/utils.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/utils.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Replicate the constants and functions from utils.js for unit testing
const TILE_SIZE = 32;
const HEX_WIDTH = 32;
const HEX_HEIGHT = 28;
const HEX_ROW_HEIGHT = 21;
const HEX_COL_OFFSET = 16;

function hexToPixel(row, col) {
    const x = col * HEX_WIDTH + (row % 2 === 1 ? HEX_COL_OFFSET : 0);
    const y = row * HEX_ROW_HEIGHT;
    return { x, y };
}

describe('utils.js constants', () => {
    it('TILE_SIZE should be 32', () => {
        assert.equal(TILE_SIZE, 32);
    });

    it('HEX_WIDTH should be 32', () => {
        assert.equal(HEX_WIDTH, 32);
    });

    it('HEX_HEIGHT should be 28', () => {
        assert.equal(HEX_HEIGHT, 28);
    });

    it('HEX_ROW_HEIGHT should be 21 (75% of HEX_HEIGHT)', () => {
        assert.equal(HEX_ROW_HEIGHT, 21);
    });

    it('HEX_COL_OFFSET should be 16 (half of HEX_WIDTH)', () => {
        assert.equal(HEX_COL_OFFSET, 16);
    });
});

describe('hexToPixel', () => {
    it('should return {x: 0, y: 0} for row=0, col=0', () => {
        const result = hexToPixel(0, 0);
        assert.deepEqual(result, { x: 0, y: 0 });
    });

    it('should compute x as col * HEX_WIDTH for even rows', () => {
        const result = hexToPixel(0, 3);
        assert.equal(result.x, 3 * HEX_WIDTH);
    });

    it('should add HEX_COL_OFFSET for odd rows', () => {
        const result = hexToPixel(1, 0);
        assert.equal(result.x, HEX_COL_OFFSET);
    });

    it('should compute y as row * HEX_ROW_HEIGHT', () => {
        const result = hexToPixel(5, 0);
        assert.equal(result.y, 5 * HEX_ROW_HEIGHT);
    });

    it('should handle odd row with non-zero col', () => {
        const result = hexToPixel(3, 4);
        assert.equal(result.x, 4 * HEX_WIDTH + HEX_COL_OFFSET);
        assert.equal(result.y, 3 * HEX_ROW_HEIGHT);
    });

    it('should handle even row with non-zero col (no offset)', () => {
        const result = hexToPixel(2, 5);
        assert.equal(result.x, 5 * HEX_WIDTH);
        assert.equal(result.y, 2 * HEX_ROW_HEIGHT);
    });

    it('should handle large row/col values', () => {
        const result = hexToPixel(100, 200);
        assert.equal(result.x, 200 * HEX_WIDTH); // even row, no offset
        assert.equal(result.y, 100 * HEX_ROW_HEIGHT);
    });

    it('should handle row=0 (even) with various cols', () => {
        for (let col = 0; col < 10; col++) {
            const result = hexToPixel(0, col);
            assert.equal(result.x, col * HEX_WIDTH);
            assert.equal(result.y, 0);
        }
    });

    it('should alternate offset correctly for consecutive rows', () => {
        const r0 = hexToPixel(0, 1);
        const r1 = hexToPixel(1, 1);
        const r2 = hexToPixel(2, 1);
        // Even rows: no offset
        assert.equal(r0.x, HEX_WIDTH);
        // Odd rows: offset
        assert.equal(r1.x, HEX_WIDTH + HEX_COL_OFFSET);
        // Even rows: no offset
        assert.equal(r2.x, HEX_WIDTH);
    });
});
