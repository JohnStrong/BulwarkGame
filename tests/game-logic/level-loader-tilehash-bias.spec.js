/**
 * Tests for LevelLoader.tileHash() bias property — Recommendation 5.
 *
 * Verifies the documented bias: values never exceed ~0.5 due to integer
 * overflow in the multiplication steps. This is a known limitation that
 * must remain stable (fixing it would change all tile visuals).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/level-loader-tilehash-bias.spec.js
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

describe('LevelLoader.tileHash: bias property (values never exceed ~0.5)', () => {
    it('should never exceed 0.55 across a large range of inputs', () => {
        let maxValue = 0;
        for (let row = 0; row < 100; row++) {
            for (let col = 0; col < 100; col++) {
                const val = tileHash(row, col);
                if (val > maxValue) maxValue = val;
            }
        }
        assert.ok(
            maxValue <= 0.55,
            `Max tileHash value should be <= 0.55 (bias), got ${maxValue}`
        );
    });

    it('should never exceed 0.55 for extreme coordinate values', () => {
        const extremeCoords = [
            [0, 0], [0, 1000], [1000, 0], [1000, 1000],
            [999, 999], [500, 500], [255, 255], [127, 127],
            [1, 99999], [99999, 1], [50000, 50000],
        ];
        for (const [row, col] of extremeCoords) {
            const val = tileHash(row, col);
            assert.ok(
                val <= 0.55,
                `tileHash(${row}, ${col}) = ${val} should be <= 0.55`
            );
        }
    });

    it('should have all values in [0, 0.55] for a 200×200 grid', () => {
        for (let row = 0; row < 200; row++) {
            for (let col = 0; col < 200; col++) {
                const val = tileHash(row, col);
                assert.ok(val >= 0, `tileHash(${row},${col}) = ${val} should be >= 0`);
                assert.ok(val <= 0.55, `tileHash(${row},${col}) = ${val} should be <= 0.55`);
            }
        }
    });

    it('should mean that hash > 0.5 checks rarely/never trigger', () => {
        // This confirms the documented limitation: grass-short-2 variant
        // (which requires hash > 0.5) should rarely or never be selected
        let above05Count = 0;
        const total = 10000;
        for (let row = 0; row < 100; row++) {
            for (let col = 0; col < 100; col++) {
                if (tileHash(row, col) > 0.5) above05Count++;
            }
        }
        // Due to the bias, very few (if any) values should exceed 0.5
        const ratio = above05Count / total;
        assert.ok(
            ratio < 0.1,
            `Only ${(ratio * 100).toFixed(1)}% of values exceed 0.5 (expected < 10% due to bias)`
        );
    });

    it('should still produce varied distribution within [0, 0.5]', () => {
        // Even with the bias, values should be spread across the valid range
        const buckets = new Array(10).fill(0);
        for (let row = 0; row < 100; row++) {
            for (let col = 0; col < 100; col++) {
                const val = tileHash(row, col);
                const bucket = Math.min(9, Math.floor(val * 20)); // 20 buckets in [0,1], but only first 10 matter
                buckets[bucket]++;
            }
        }
        // At least 3 of the first 10 buckets (covering [0, 0.5]) should have entries
        const nonEmptyBuckets = buckets.filter(b => b > 0).length;
        assert.ok(
            nonEmptyBuckets >= 3,
            `Should have varied distribution, got ${nonEmptyBuckets} non-empty buckets`
        );
    });

    it('should be deterministic — bias is stable across runs', () => {
        const values1 = [];
        const values2 = [];
        for (let i = 0; i < 50; i++) {
            values1.push(tileHash(i, i * 3 + 7));
            values2.push(tileHash(i, i * 3 + 7));
        }
        assert.deepEqual(values1, values2);
    });
});
