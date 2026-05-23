/**
 * Tests for render-level-preview charToSprite() mappings (Recommendation 8).
 *
 * Verifies all 30+ character-to-sprite mappings in the preview renderer,
 * especially the bridge variants which are unique to this file.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/render-level-preview-mappings.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { charToSprite, tileHash } = require('../../js/level-generators/render-level-preview');

// Fixed position for deterministic hash
const ROW = 3;
const COL = 7;

describe('render-level-preview: charToSprite mappings', () => {
    describe('terrain characters', () => {
        it('. → grass-short-1 or grass-short-2', () => {
            const sprite = charToSprite('.', ROW, COL);
            assert.match(sprite, /^grass-short-[12]$/);
        });

        it(', → grass-flowers-1 or grass-flowers-2', () => {
            const sprite = charToSprite(',', ROW, COL);
            assert.match(sprite, /^grass-flowers-[12]$/);
        });

        it('O → tree-1, tree-2, or tree-3 (oak)', () => {
            const sprite = charToSprite('O', ROW, COL);
            assert.match(sprite, /^tree-[123]$/);
        });

        it('R → rock', () => {
            const sprite = charToSprite('R', ROW, COL);
            assert.equal(sprite, 'rock');
        });

        it('D → road-full', () => {
            const sprite = charToSprite('D', ROW, COL);
            assert.equal(sprite, 'road-full');
        });

        it('~ → water-1, water-2, or water-3', () => {
            const sprite = charToSprite('~', ROW, COL);
            assert.match(sprite, /^water-[123]$/);
        });
    });

    describe('road edge characters', () => {
        it('L → road-edge-left', () => {
            assert.equal(charToSprite('L', ROW, COL), 'road-edge-left');
        });

        it('r → road-edge-right', () => {
            assert.equal(charToSprite('r', ROW, COL), 'road-edge-right');
        });

        it('U → road-edge-top', () => {
            assert.equal(charToSprite('U', ROW, COL), 'road-edge-top');
        });

        it('u → road-edge-bottom', () => {
            assert.equal(charToSprite('u', ROW, COL), 'road-edge-bottom');
        });
    });

    describe('road corner characters', () => {
        it('1 → road-corner-tl', () => {
            assert.equal(charToSprite('1', ROW, COL), 'road-corner-tl');
        });

        it('2 → road-corner-tr', () => {
            assert.equal(charToSprite('2', ROW, COL), 'road-corner-tr');
        });

        it('3 → road-corner-bl', () => {
            assert.equal(charToSprite('3', ROW, COL), 'road-corner-bl');
        });

        it('4 → road-corner-br', () => {
            assert.equal(charToSprite('4', ROW, COL), 'road-corner-br');
        });
    });

    describe('water variants', () => {
        it('w → water-h-1, water-h-2, or water-h-3', () => {
            const sprite = charToSprite('w', ROW, COL);
            assert.match(sprite, /^water-h-[123]$/);
        });

        it(') → water-land-right', () => {
            assert.equal(charToSprite(')', ROW, COL), 'water-land-right');
        });

        it('( → water-land-left', () => {
            assert.equal(charToSprite('(', ROW, COL), 'water-land-left');
        });
    });

    describe('bridge characters (3×3 grid)', () => {
        it('{ → bridge-tl (top-left)', () => {
            assert.equal(charToSprite('{', ROW, COL), 'bridge-tl');
        });

        it('^ → bridge-tm (top-middle)', () => {
            assert.equal(charToSprite('^', ROW, COL), 'bridge-tm');
        });

        it('} → bridge-tr (top-right)', () => {
            assert.equal(charToSprite('}', ROW, COL), 'bridge-tr');
        });

        it('[ → bridge-ml (middle-left)', () => {
            assert.equal(charToSprite('[', ROW, COL), 'bridge-ml');
        });

        it('= → bridge-mm (middle-middle)', () => {
            assert.equal(charToSprite('=', ROW, COL), 'bridge-mm');
        });

        it('] → bridge-mr (middle-right)', () => {
            assert.equal(charToSprite(']', ROW, COL), 'bridge-mr');
        });

        it('< → bridge-bl (bottom-left)', () => {
            assert.equal(charToSprite('<', ROW, COL), 'bridge-bl');
        });

        it('_ → bridge-bm (bottom-middle)', () => {
            assert.equal(charToSprite('_', ROW, COL), 'bridge-bm');
        });

        it('> → bridge-br (bottom-right)', () => {
            assert.equal(charToSprite('>', ROW, COL), 'bridge-br');
        });
    });

    describe('default case', () => {
        const unknownChars = ['Z', 'X', 'Q', '!', '@', '#', '$', '%', '&', '*', '+', '-'];

        for (const ch of unknownChars) {
            it(`'${ch}' → grass-short-1 (default fallback)`, () => {
                assert.equal(charToSprite(ch, ROW, COL), 'grass-short-1');
            });
        }
    });

    describe('variant distribution', () => {
        it('grass mapping should produce valid sprite names across positions', () => {
            for (let r = 0; r < 50; r++) {
                for (let c = 0; c < 50; c++) {
                    const sprite = charToSprite('.', r, c);
                    assert.match(sprite, /^grass-short-[12]$/);
                }
            }
        });

        it('water mapping should produce valid sprite names across positions', () => {
            const variants = new Set();
            for (let r = 0; r < 100; r++) {
                for (let c = 0; c < 100; c++) {
                    const sprite = charToSprite('~', r, c);
                    assert.match(sprite, /^water-[123]$/);
                    variants.add(sprite);
                }
            }
            // Should produce at least 2 water variants
            assert.ok(variants.size >= 2, `Should produce multiple water variants, got ${variants.size}`);
        });
    });
});

describe('render-level-preview: tileHash', () => {
    it('should return values between 0 and 1', () => {
        for (let r = 0; r < 20; r++) {
            for (let c = 0; c < 20; c++) {
                const h = tileHash(r, c);
                assert.ok(h >= 0 && h <= 1, `tileHash(${r},${c}) = ${h} out of range`);
            }
        }
    });

    it('should be deterministic', () => {
        assert.equal(tileHash(5, 10), tileHash(5, 10));
    });

    it('should produce different values for different inputs', () => {
        const h1 = tileHash(0, 0);
        const h2 = tileHash(0, 1);
        assert.notEqual(h1, h2);
    });
});
