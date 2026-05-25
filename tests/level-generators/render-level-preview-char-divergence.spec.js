/**
 * Tests that document the known divergence between render-level-preview.js
 * and level-loader.js for the 'P' (pine) and 'S' (shrub) characters.
 *
 * render-level-preview.charToSprite() does NOT handle 'P' or 'S' — they
 * fall through to the default case and return 'grass-short-1'. This is a
 * known gap vs level-loader.js which maps them to tree-4/5 and tree-6/7.
 *
 * These tests pin the CURRENT behavior so any future fix is caught.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/render-level-preview-char-divergence.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { charToSprite, tileHash } = require('../../js/level-generators/render-level-preview.js');

// ─── Tests: P and S fall through to default ───────────────────────────────────

describe('render-level-preview: charToSprite — P and S divergence from level-loader', () => {
    it('should map "P" to grass-short-1 (falls through to default — diverges from level-loader)', () => {
        // level-loader maps 'P' → tree-4 or tree-5
        // render-level-preview has no 'P' case → falls through to default
        const result = charToSprite('P', 0, 0);
        assert.equal(
            result,
            'grass-short-1',
            '"P" should fall through to default (grass-short-1) in render-level-preview'
        );
    });

    it('should map "S" to grass-short-1 (falls through to default — diverges from level-loader)', () => {
        // level-loader maps 'S' → tree-6 or tree-7
        // render-level-preview has no 'S' case → falls through to default
        const result = charToSprite('S', 0, 0);
        assert.equal(
            result,
            'grass-short-1',
            '"S" should fall through to default (grass-short-1) in render-level-preview'
        );
    });

    it('"P" and "S" should produce the same result as any other unknown character', () => {
        // Both should behave identically to 'Z' (unknown)
        const resultP = charToSprite('P', 3, 7);
        const resultZ = charToSprite('Z', 3, 7);
        const resultS = charToSprite('S', 3, 7);
        assert.equal(resultP, resultZ, '"P" and "Z" should both fall through to default');
        assert.equal(resultS, resultZ, '"S" and "Z" should both fall through to default');
    });

    it('"P" result is independent of position (always grass-short-1)', () => {
        // Since it falls through to default, position doesn't matter
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                assert.equal(
                    charToSprite('P', row, col),
                    'grass-short-1',
                    `charToSprite('P', ${row}, ${col}) should always be grass-short-1`
                );
            }
        }
    });

    it('"S" result is independent of position (always grass-short-1)', () => {
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                assert.equal(
                    charToSprite('S', row, col),
                    'grass-short-1',
                    `charToSprite('S', ${row}, ${col}) should always be grass-short-1`
                );
            }
        }
    });
});

// ─── Tests: contrast with level-loader behavior ───────────────────────────────

describe('render-level-preview: charToSprite — contrast with level-loader for O', () => {
    it('"O" IS handled and maps to tree-1, tree-2, or tree-3 (same as level-loader)', () => {
        // 'O' is the only tree character that render-level-preview handles
        const validOakSprites = ['tree-1', 'tree-2', 'tree-3'];
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const result = charToSprite('O', row, col);
                assert.ok(
                    validOakSprites.includes(result),
                    `charToSprite('O', ${row}, ${col}) = "${result}" should be one of ${validOakSprites.join(', ')}`
                );
            }
        }
    });

    it('"O" uses tileHash for variant selection (same algorithm as level-loader)', () => {
        // Verify the hash-based selection is consistent
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const hash = tileHash(row, col);
                const expected = `tree-${Math.floor(hash * 3) + 1}`;
                assert.equal(
                    charToSprite('O', row, col),
                    expected,
                    `charToSprite('O', ${row}, ${col}) should use tileHash for variant`
                );
            }
        }
    });
});

// ─── Tests: all characters that ARE handled ───────────────────────────────────

describe('render-level-preview: charToSprite — all handled characters return non-default', () => {
    const handledChars = [
        { ch: '.', check: (r) => r.startsWith('grass-short-') },
        { ch: ',', check: (r) => r.startsWith('grass-flowers-') },
        { ch: 'O', check: (r) => r.startsWith('tree-') },
        { ch: 'R', check: (r) => r === 'rock' },
        { ch: 'D', check: (r) => r === 'road-full' },
        { ch: 'L', check: (r) => r === 'road-edge-left' },
        { ch: 'r', check: (r) => r === 'road-edge-right' },
        { ch: 'U', check: (r) => r === 'road-edge-top' },
        { ch: 'u', check: (r) => r === 'road-edge-bottom' },
        { ch: '~', check: (r) => r.startsWith('water-') && !r.includes('h-') },
        { ch: 'w', check: (r) => r.startsWith('water-h-') },
        { ch: ')', check: (r) => r === 'water-land-right' },
        { ch: '(', check: (r) => r === 'water-land-left' },
        { ch: '=', check: (r) => r === 'bridge-mm' },
    ];

    for (const { ch, check } of handledChars) {
        it(`"${ch}" is handled and returns the expected sprite`, () => {
            const result = charToSprite(ch, 0, 0);
            assert.ok(check(result), `charToSprite('${ch}', 0, 0) = "${result}" failed check`);
        });
    }
});

// ─── Tests: unhandled characters that fall through ────────────────────────────

describe('render-level-preview: charToSprite — unhandled characters fall through to grass-short-1', () => {
    const unhandledChars = ['P', 'S', 'T', 'K', 'j', 'J', 'F', 'G', 'W', 'C', 'Z', '?', 'b', 'm', 'g'];

    for (const ch of unhandledChars) {
        it(`"${ch}" falls through to grass-short-1`, () => {
            assert.equal(
                charToSprite(ch, 0, 0),
                'grass-short-1',
                `charToSprite('${ch}', 0, 0) should return grass-short-1`
            );
        });
    }
});
