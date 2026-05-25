/**
 * Tests for the tileHash dead branch in level-loader.js (Recommendation 5).
 *
 * Documents the integer overflow bias in tileHash() that makes the `hash > 0.5`
 * branch unreachable for grass-short-2 and grass-flowers-2. Tests verify:
 *   1. The bias is real (no hash exceeds 0.5 across a large sample)
 *   2. Both variant 1 and variant 2 ARE reachable when the threshold is lowered
 *
 * This test file documents the known bug and validates the fix condition.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/level-loader-tilehash-fix.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Replicate tileHash from level-loader.js ──────────────────────────────────

/**
 * Original tileHash — has integer overflow bias, values never exceed ~0.5.
 */
function tileHashOriginal(row, col) {
    let h = (row * 7919 + col * 104729 + 31) & 0xFFFFFFFF;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = (h >> 16) ^ h;
    return (h >>> 0) / 0xFFFFFFFF;
}

/**
 * Fixed tileHash — uses BigInt arithmetic to avoid overflow bias.
 * This is the proposed fix: same algorithm but with proper 32-bit unsigned math
 * using BigInt modular multiplication to prevent JS number precision loss.
 */
function tileHashFixed(row, col) {
    const M = BigInt(0x100000000);
    let h = BigInt((row * 7919 + col * 104729 + 31) & 0xFFFFFFFF);
    h = ((h >> 16n) ^ h) & 0xFFFFFFFFn;
    h = (h * 0x45d9f3bn) % M;
    h = ((h >> 16n) ^ h) & 0xFFFFFFFFn;
    h = (h * 0x45d9f3bn) % M;
    h = ((h >> 16n) ^ h) & 0xFFFFFFFFn;
    return Number(h) / 0xFFFFFFFF;
}

// ─── Tests documenting the bias ───────────────────────────────────────────────

describe('tileHash: integer overflow bias (known bug)', () => {
    it('original tileHash should produce values in [0, 1]', () => {
        for (let r = 0; r < 50; r++) {
            for (let c = 0; c < 50; c++) {
                const h = tileHashOriginal(r, c);
                assert.ok(h >= 0 && h <= 1, `tileHash(${r},${c}) = ${h} out of [0,1]`);
            }
        }
    });

    it('original tileHash should never exceed 0.5 (documents the bias)', () => {
        // This test documents the known bug: due to integer overflow in JS,
        // the hash values are biased to [0, ~0.5], making hash > 0.5 unreachable.
        let maxHash = 0;
        for (let r = 0; r < 100; r++) {
            for (let c = 0; c < 100; c++) {
                const h = tileHashOriginal(r, c);
                if (h > maxHash) maxHash = h;
            }
        }
        // Document: max observed value is well below 0.5
        assert.ok(maxHash < 0.5,
            `Max hash ${maxHash} should be < 0.5 (documents the overflow bias)`);
    });

    it('original tileHash: grass-short-2 is never produced (hash > 0.5 unreachable)', () => {
        // Verify that no position produces grass-short-2 with the original hash
        let foundVariant2 = false;
        for (let r = 0; r < 100; r++) {
            for (let c = 0; c < 100; c++) {
                const h = tileHashOriginal(r, c);
                if (h > 0.5) {
                    foundVariant2 = true;
                    break;
                }
            }
            if (foundVariant2) break;
        }
        assert.equal(foundVariant2, false,
            'grass-short-2 should never be produced with original tileHash (documents dead branch)');
    });
});

// ─── Tests validating the fix ─────────────────────────────────────────────────

describe('tileHash: fixed version produces both variants', () => {
    it('fixed tileHash should produce values in [0, 1]', () => {
        for (let r = 0; r < 50; r++) {
            for (let c = 0; c < 50; c++) {
                const h = tileHashFixed(r, c);
                assert.ok(h >= 0 && h <= 1, `tileHashFixed(${r},${c}) = ${h} out of [0,1]`);
            }
        }
    });

    it('fixed tileHash should produce values both above and below 0.5', () => {
        let hasAbove = false;
        let hasBelow = false;
        for (let r = 0; r < 100; r++) {
            for (let c = 0; c < 100; c++) {
                const h = tileHashFixed(r, c);
                if (h > 0.5) hasAbove = true;
                if (h < 0.5) hasBelow = true;
                if (hasAbove && hasBelow) break;
            }
            if (hasAbove && hasBelow) break;
        }
        assert.ok(hasAbove, 'Fixed tileHash should produce values > 0.5');
        assert.ok(hasBelow, 'Fixed tileHash should produce values < 0.5');
    });

    it('fixed tileHash: grass-short-2 is reachable (hash > 0.5 possible)', () => {
        let foundVariant2 = false;
        for (let r = 0; r < 100; r++) {
            for (let c = 0; c < 100; c++) {
                const h = tileHashFixed(r, c);
                if (h > 0.5) {
                    foundVariant2 = true;
                    break;
                }
            }
            if (foundVariant2) break;
        }
        assert.ok(foundVariant2,
            'Fixed tileHash should produce hash > 0.5, making grass-short-2 reachable');
    });

    it('fixed tileHash: both grass-short-1 and grass-short-2 are produced', () => {
        const variants = new Set();
        for (let r = 0; r < 100; r++) {
            for (let c = 0; c < 100; c++) {
                const h = tileHashFixed(r, c);
                variants.add(h > 0.5 ? 'grass-short-2' : 'grass-short-1');
            }
        }
        assert.ok(variants.has('grass-short-1'), 'grass-short-1 should be produced');
        assert.ok(variants.has('grass-short-2'), 'grass-short-2 should be produced');
    });

    it('fixed tileHash: both grass-flowers-1 and grass-flowers-2 are produced', () => {
        const variants = new Set();
        for (let r = 0; r < 100; r++) {
            for (let c = 0; c < 100; c++) {
                const h = tileHashFixed(r, c);
                variants.add(h > 0.5 ? 'grass-flowers-2' : 'grass-flowers-1');
            }
        }
        assert.ok(variants.has('grass-flowers-1'), 'grass-flowers-1 should be produced');
        assert.ok(variants.has('grass-flowers-2'), 'grass-flowers-2 should be produced');
    });

    it('fixed tileHash should be deterministic', () => {
        for (let r = 0; r < 20; r++) {
            for (let c = 0; c < 20; c++) {
                assert.equal(tileHashFixed(r, c), tileHashFixed(r, c),
                    `tileHashFixed(${r},${c}) should be deterministic`);
            }
        }
    });
});

// ─── Alternative fix: lower threshold to 0.25 ────────────────────────────────

describe('tileHash: alternative fix — lower threshold to 0.25', () => {
    it('original tileHash with threshold 0.25 produces both grass variants', () => {
        // If we change the condition from hash > 0.5 to hash > 0.25,
        // both variants become reachable without changing the hash function.
        const variants = new Set();
        for (let r = 0; r < 100; r++) {
            for (let c = 0; c < 100; c++) {
                const h = tileHashOriginal(r, c);
                variants.add(h > 0.25 ? 'grass-short-2' : 'grass-short-1');
            }
        }
        assert.ok(variants.has('grass-short-1'), 'grass-short-1 should be produced with threshold 0.25');
        assert.ok(variants.has('grass-short-2'), 'grass-short-2 should be produced with threshold 0.25');
    });

    it('original tileHash with threshold 0.25 produces both flower variants', () => {
        const variants = new Set();
        for (let r = 0; r < 100; r++) {
            for (let c = 0; c < 100; c++) {
                const h = tileHashOriginal(r, c);
                variants.add(h > 0.25 ? 'grass-flowers-2' : 'grass-flowers-1');
            }
        }
        assert.ok(variants.has('grass-flowers-1'), 'grass-flowers-1 should be produced');
        assert.ok(variants.has('grass-flowers-2'), 'grass-flowers-2 should be produced');
    });
});
