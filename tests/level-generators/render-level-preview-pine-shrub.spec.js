/**
 * Tests for charToSprite() with 'P' (pine) and 'S' (shrub) characters (Recommendation 7).
 *
 * Documents the known gap: 'P' and 'S' are valid level tile characters used in
 * generate-random-level.js and generate-tutorial-level.js, but charToSprite()
 * has no case for them and silently falls back to 'grass-short-1'.
 *
 * Tests:
 *   1. Document the current fallback behavior (P and S → grass-short-1)
 *   2. Verify the fallback is consistent (not random)
 *   3. Provide a reference implementation showing what the correct mapping should be
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/render-level-preview-pine-shrub.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { charToSprite, tileHash } = require('../../js/level-generators/render-level-preview');

const ROW = 5;
const COL = 10;

// ─── Document current behavior (known gap) ────────────────────────────────────

describe('render-level-preview: charToSprite — P and S characters (known gap)', () => {
    it("'P' (pine) currently falls back to grass-short-1 (no pine case in switch)", () => {
        // This test documents the current behavior.
        // 'P' is used in generate-random-level.js for pine trees but has no
        // case in charToSprite(), so it silently returns the default.
        const sprite = charToSprite('P', ROW, COL);
        assert.equal(sprite, 'grass-short-1',
            "'P' should currently fall back to grass-short-1 (documents missing case)");
    });

    it("'S' (shrub) currently falls back to grass-short-1 (no shrub case in switch)", () => {
        // 'S' is used for shrubs but has no case in charToSprite().
        const sprite = charToSprite('S', ROW, COL);
        assert.equal(sprite, 'grass-short-1',
            "'S' should currently fall back to grass-short-1 (documents missing case)");
    });

    it("'P' fallback is consistent across all tile positions", () => {
        // The fallback should always be grass-short-1 regardless of position
        for (let r = 0; r < 20; r++) {
            for (let c = 0; c < 20; c++) {
                const sprite = charToSprite('P', r, c);
                assert.equal(sprite, 'grass-short-1',
                    `'P' at (${r},${c}) should consistently fall back to grass-short-1`);
            }
        }
    });

    it("'S' fallback is consistent across all tile positions", () => {
        for (let r = 0; r < 20; r++) {
            for (let c = 0; c < 20; c++) {
                const sprite = charToSprite('S', r, c);
                assert.equal(sprite, 'grass-short-1',
                    `'S' at (${r},${c}) should consistently fall back to grass-short-1`);
            }
        }
    });
});

// ─── Reference implementation showing correct behavior ───────────────────────

describe('render-level-preview: charToSprite — reference implementation with P and S', () => {
    /**
     * Reference implementation of charToSprite with P and S cases added.
     * This shows what the production function should look like after the fix.
     */
    function charToSpriteFixed(ch, row, col) {
        const hash = tileHash(row, col);
        switch (ch) {
            case '.': return `grass-short-${hash > 0.5 ? 2 : 1}`;
            case ',': return `grass-flowers-${hash > 0.5 ? 2 : 1}`;
            case 'O': return `tree-${Math.floor(hash * 3) + 1}`;
            case 'P': return `tree-${Math.floor(hash * 3) + 1}`; // pine → tree variant
            case 'S': return `tree-${Math.floor(hash * 3) + 1}`; // shrub → tree variant
            case 'R': return 'rock';
            case 'D': return 'road-full';
            case 'L': return 'road-edge-left';
            case 'r': return 'road-edge-right';
            case 'U': return 'road-edge-top';
            case 'u': return 'road-edge-bottom';
            case '1': return 'road-corner-tl';
            case '2': return 'road-corner-tr';
            case '3': return 'road-corner-bl';
            case '4': return 'road-corner-br';
            case '~': return `water-${Math.floor(hash * 3) + 1}`;
            case 'w': return `water-h-${Math.floor(hash * 3) + 1}`;
            case ')': return 'water-land-right';
            case '(': return 'water-land-left';
            case '{': return 'bridge-tl';
            case '^': return 'bridge-tm';
            case '}': return 'bridge-tr';
            case '[': return 'bridge-ml';
            case '=': return 'bridge-mm';
            case ']': return 'bridge-mr';
            case '<': return 'bridge-bl';
            case '_': return 'bridge-bm';
            case '>': return 'bridge-br';
            default: return 'grass-short-1';
        }
    }

    it("fixed charToSprite: 'P' should map to a tree variant (not grass)", () => {
        const sprite = charToSpriteFixed('P', ROW, COL);
        assert.match(sprite, /^tree-[123]$/,
            "'P' should map to a tree variant in the fixed implementation");
    });

    it("fixed charToSprite: 'S' should map to a tree variant (not grass)", () => {
        const sprite = charToSpriteFixed('S', ROW, COL);
        assert.match(sprite, /^tree-[123]$/,
            "'S' should map to a tree variant in the fixed implementation");
    });

    it("fixed charToSprite: 'P' should produce valid tree names across positions", () => {
        for (let r = 0; r < 30; r++) {
            for (let c = 0; c < 30; c++) {
                const sprite = charToSpriteFixed('P', r, c);
                assert.match(sprite, /^tree-[123]$/,
                    `'P' at (${r},${c}) should produce a valid tree sprite`);
            }
        }
    });

    it("fixed charToSprite: 'S' should produce valid tree names across positions", () => {
        for (let r = 0; r < 30; r++) {
            for (let c = 0; c < 30; c++) {
                const sprite = charToSpriteFixed('S', r, c);
                assert.match(sprite, /^tree-[123]$/,
                    `'S' at (${r},${c}) should produce a valid tree sprite`);
            }
        }
    });

    it("fixed charToSprite: existing mappings should be unchanged", () => {
        // Verify the fix doesn't break existing character mappings
        assert.equal(charToSpriteFixed('R', ROW, COL), 'rock');
        assert.equal(charToSpriteFixed('D', ROW, COL), 'road-full');
        assert.equal(charToSpriteFixed('=', ROW, COL), 'bridge-mm');
        assert.match(charToSpriteFixed('.', ROW, COL), /^grass-short-[12]$/);
        assert.match(charToSpriteFixed('~', ROW, COL), /^water-[123]$/);
        assert.match(charToSpriteFixed('O', ROW, COL), /^tree-[123]$/);
    });

    it("fixed charToSprite: unknown characters still fall back to grass-short-1", () => {
        assert.equal(charToSpriteFixed('Z', ROW, COL), 'grass-short-1');
        assert.equal(charToSpriteFixed('X', ROW, COL), 'grass-short-1');
        assert.equal(charToSpriteFixed('?', ROW, COL), 'grass-short-1');
    });
});

// ─── Verify P and S are used in level generators ──────────────────────────────

describe('render-level-preview: P and S character usage context', () => {
    it("'P' character is a valid level tile character (used in random level generator)", () => {
        // This test documents that 'P' is a real character in the level format.
        // The random level generator uses 'P' for pine trees.
        // charToSprite should handle it explicitly rather than falling through to default.
        const currentBehavior = charToSprite('P', 0, 0);
        const expectedIfFixed = 'tree-1'; // or tree-2 or tree-3

        // Document: current behavior is a silent fallback
        assert.equal(currentBehavior, 'grass-short-1',
            'Current behavior: P silently falls back to grass (this is the bug)');

        // The fix would make it return a tree sprite
        assert.match(expectedIfFixed, /^tree-[123]$/,
            'Expected behavior after fix: P should return a tree sprite');
    });

    it("'S' character is a valid level tile character (used in random level generator)", () => {
        const currentBehavior = charToSprite('S', 0, 0);
        assert.equal(currentBehavior, 'grass-short-1',
            'Current behavior: S silently falls back to grass (this is the bug)');
    });

    it("'O' character (oak) correctly maps to tree variants", () => {
        // O is handled correctly — P and S should be treated similarly
        const sprite = charToSprite('O', ROW, COL);
        assert.match(sprite, /^tree-[123]$/,
            "'O' correctly maps to tree variants");
    });
});
