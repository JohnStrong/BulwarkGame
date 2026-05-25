/**
 * Tests that the hash > 0.5 branch in parseLevelText is effectively dead code
 * due to the known tileHash bias — Recommendation 3.
 *
 * Iterates all (row, col) pairs in a 50×35 grid (typical level size) and
 * asserts that tileHash never exceeds 0.5, confirming grass-short-2 and
 * grass-flowers-2 are never selected in practice.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/level-loader-tilehash-dead-branch.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Replicate tileHash from level-loader.js
function tileHash(row, col) {
    let h = (row * 7919 + col * 104729 + 31) & 0xFFFFFFFF;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = (h >> 16) ^ h;
    return (h >>> 0) / 0xFFFFFFFF;
}

describe('LevelLoader.tileHash: hash > 0.5 branch is dead code', () => {
    it('should never exceed 0.5 across a 50×35 grid (typical level size)', () => {
        const violations = [];
        for (let row = 0; row < 35; row++) {
            for (let col = 0; col < 50; col++) {
                const val = tileHash(row, col);
                if (val > 0.5) {
                    violations.push({ row, col, val });
                }
            }
        }
        assert.equal(
            violations.length,
            0,
            `Expected no tileHash values > 0.5 in 50×35 grid, but found ${violations.length}: ` +
            violations.slice(0, 3).map(v => `tileHash(${v.row},${v.col})=${v.val.toFixed(4)}`).join(', ')
        );
    });

    it('should never exceed 0.5 across a 100×100 grid', () => {
        let maxVal = 0;
        for (let row = 0; row < 100; row++) {
            for (let col = 0; col < 100; col++) {
                const val = tileHash(row, col);
                if (val > maxVal) maxVal = val;
            }
        }
        assert.ok(
            maxVal <= 0.5,
            `Max tileHash in 100×100 grid is ${maxVal.toFixed(6)}, expected <= 0.5`
        );
    });

    it('grass-short-2 is never selected for any tile in a 50×35 level', () => {
        // Simulates the parseLevelText '.' case: sprite = grass-short-${hash > 0.5 ? 2 : 1}
        const selectedVariants = new Set();
        for (let row = 0; row < 35; row++) {
            for (let col = 0; col < 50; col++) {
                const hash = tileHash(row, col);
                const variant = hash > 0.5 ? 2 : 1;
                selectedVariants.add(variant);
            }
        }
        assert.ok(
            !selectedVariants.has(2),
            'grass-short-2 should never be selected due to tileHash bias'
        );
        assert.ok(
            selectedVariants.has(1),
            'grass-short-1 should always be selected'
        );
    });

    it('grass-flowers-2 is never selected for any tile in a 50×35 level', () => {
        // Simulates the parseLevelText ',' case: sprite = grass-flowers-${hash > 0.5 ? 2 : 1}
        const selectedVariants = new Set();
        for (let row = 0; row < 35; row++) {
            for (let col = 0; col < 50; col++) {
                const hash = tileHash(row, col);
                const variant = hash > 0.5 ? 2 : 1;
                selectedVariants.add(variant);
            }
        }
        assert.ok(
            !selectedVariants.has(2),
            'grass-flowers-2 should never be selected due to tileHash bias'
        );
    });

    it('the bias is stable — same result on repeated runs', () => {
        const run1 = [];
        const run2 = [];
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                run1.push(tileHash(row, col) > 0.5 ? 2 : 1);
                run2.push(tileHash(row, col) > 0.5 ? 2 : 1);
            }
        }
        assert.deepEqual(run1, run2, 'Bias behavior should be deterministic');
    });

    it('documents the known bias: max value in large grid is well below 0.5', () => {
        // This test documents the actual maximum observed value
        let maxVal = 0;
        for (let row = 0; row < 200; row++) {
            for (let col = 0; col < 200; col++) {
                const val = tileHash(row, col);
                if (val > maxVal) maxVal = val;
            }
        }
        // The bias keeps values well below 0.5 — document the actual ceiling
        assert.ok(maxVal < 0.5, `Max tileHash value ${maxVal.toFixed(6)} should be < 0.5`);
        // Also assert it's not zero (values are distributed)
        assert.ok(maxVal > 0.1, `Max tileHash value ${maxVal.toFixed(6)} should be > 0.1`);
    });
});
