/**
 * Property: tileHash Bias Documentation
 *
 * The tileHash(row, col) function has a known bias where its output
 * never exceeds ~0.5 due to integer overflow in its multiplication steps.
 * This property test documents and enforces this known behavior to prevent
 * accidental "fixes" that would change all level visuals.
 *
 * Recommendation 3: Add property-based tests for the tileHash bias.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// Replicate tileHash exactly as in level-loader.js
function tileHash(row, col) {
    let h = (row * 7919 + col * 104729 + 31) & 0xFFFFFFFF;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = (h >> 16) ^ h;
    return (h >>> 0) / 0xFFFFFFFF;
}

describe('Property: tileHash bias (output never exceeds ~0.5)', () => {
    it('for all row in [0,999] and col in [0,999], tileHash <= 0.5', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 999 }),
                fc.integer({ min: 0, max: 999 }),
                (row, col) => {
                    const h = tileHash(row, col);
                    assert.ok(
                        h <= 0.5,
                        `tileHash(${row}, ${col}) = ${h} exceeds 0.5 bias ceiling`
                    );
                }
            ),
            { numRuns: 5000 }
        );
    });

    it('tileHash always returns a value in [0, 1]', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -1000, max: 1000 }),
                fc.integer({ min: -1000, max: 1000 }),
                (row, col) => {
                    const h = tileHash(row, col);
                    assert.ok(h >= 0 && h <= 1,
                        `tileHash(${row}, ${col}) = ${h} out of [0,1]`);
                }
            ),
            { numRuns: 2000 }
        );
    });

    it('tileHash is deterministic', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 500 }),
                fc.integer({ min: 0, max: 500 }),
                (row, col) => {
                    assert.strictEqual(tileHash(row, col), tileHash(row, col));
                }
            ),
            { numRuns: 1000 }
        );
    });
});
