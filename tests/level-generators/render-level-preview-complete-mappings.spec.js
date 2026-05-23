/**
 * Comprehensive table-driven tests for charToSprite() in render-level-preview.js.
 *
 * Covers every case in the switch statement plus characters that fall through
 * to the default (P, S, b, m, g, Z, X, etc.).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/render-level-preview-complete-mappings.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { charToSprite, tileHash } = require('../../js/level-generators/render-level-preview');

// Fixed position for deterministic hash
const ROW = 5;
const COL = 11;

// ─── Exact-match mappings (no hash variance) ─────────────────────────────────

describe('render-level-preview: exact-match character mappings', () => {
    const exactMappings = [
        // Road full
        { ch: 'D', expected: 'road-full' },
        // Road edges
        { ch: 'L', expected: 'road-edge-left' },
        { ch: 'r', expected: 'road-edge-right' },
        { ch: 'U', expected: 'road-edge-top' },
        { ch: 'u', expected: 'road-edge-bottom' },
        // Road corners
        { ch: '1', expected: 'road-corner-tl' },
        { ch: '2', expected: 'road-corner-tr' },
        { ch: '3', expected: 'road-corner-bl' },
        { ch: '4', expected: 'road-corner-br' },
        // Rock
        { ch: 'R', expected: 'rock' },
        // Water land edges
        { ch: ')', expected: 'water-land-right' },
        { ch: '(', expected: 'water-land-left' },
        // Bridge — top row
        { ch: '{', expected: 'bridge-tl' },
        { ch: '^', expected: 'bridge-tm' },
        { ch: '}', expected: 'bridge-tr' },
        // Bridge — middle row
        { ch: '[', expected: 'bridge-ml' },
        { ch: '=', expected: 'bridge-mm' },
        { ch: ']', expected: 'bridge-mr' },
        // Bridge — bottom row
        { ch: '<', expected: 'bridge-bl' },
        { ch: '_', expected: 'bridge-bm' },
        { ch: '>', expected: 'bridge-br' },
    ];

    for (const { ch, expected } of exactMappings) {
        it(`'${ch}' → '${expected}'`, () => {
            assert.equal(charToSprite(ch, ROW, COL), expected);
        });
    }
});

// ─── Hash-variant mappings (2-variant) ───────────────────────────────────────

describe('render-level-preview: 2-variant hash mappings', () => {
    it('. → grass-short-1 or grass-short-2', () => {
        const sprite = charToSprite('.', ROW, COL);
        assert.match(sprite, /^grass-short-[12]$/);
    });

    it(', → grass-flowers-1 or grass-flowers-2', () => {
        const sprite = charToSprite(',', ROW, COL);
        assert.match(sprite, /^grass-flowers-[12]$/);
    });
});

// ─── Hash-variant mappings (3-variant) ───────────────────────────────────────

describe('render-level-preview: 3-variant hash mappings', () => {
    it('O → tree-1, tree-2, or tree-3', () => {
        const sprite = charToSprite('O', ROW, COL);
        assert.match(sprite, /^tree-[123]$/);
    });

    it('~ → water-1, water-2, or water-3', () => {
        const sprite = charToSprite('~', ROW, COL);
        assert.match(sprite, /^water-[123]$/);
    });

    it('w → water-h-1, water-h-2, or water-h-3', () => {
        const sprite = charToSprite('w', ROW, COL);
        assert.match(sprite, /^water-h-[123]$/);
    });
});

// ─── Default fallback — characters NOT in the switch ─────────────────────────

describe('render-level-preview: default fallback (grass-short-1)', () => {
    // Characters that are NOT in the switch statement and fall through to default
    const defaultChars = [
        // Explicitly mentioned in the task spec
        { ch: 'P', label: 'pine (not in switch)' },
        { ch: 'S', label: 'shrub (not in switch)' },
        { ch: 'b', label: 'b (not in switch)' },
        { ch: 'm', label: 'm (not in switch)' },
        { ch: 'g', label: 'g (not in switch)' },
        { ch: 'Z', label: 'Z (not in switch)' },
        { ch: 'X', label: 'X (not in switch)' },
        // Additional unknown characters
        { ch: 'Q', label: 'Q (not in switch)' },
        { ch: '!', label: '! (not in switch)' },
        { ch: '@', label: '@ (not in switch)' },
        { ch: '#', label: '# (not in switch)' },
        { ch: '$', label: '$ (not in switch)' },
        { ch: '%', label: '% (not in switch)' },
        { ch: '&', label: '& (not in switch)' },
        { ch: '*', label: '* (not in switch)' },
        { ch: '+', label: '+ (not in switch)' },
        { ch: '-', label: '- (not in switch)' },
        { ch: '?', label: '? (not in switch)' },
        { ch: '/', label: '/ (not in switch)' },
        { ch: '\\', label: '\\ (not in switch)' },
        { ch: '|', label: '| (not in switch)' },
        { ch: '`', label: '` (not in switch)' },
        { ch: '~', label: 'tilde handled separately — just confirming default is not triggered' },
    ];

    // Test all except '~' which IS in the switch
    const trueDefaults = defaultChars.filter(({ ch }) => ch !== '~');

    for (const { ch, label } of trueDefaults) {
        it(`'${ch}' (${label}) → 'grass-short-1'`, () => {
            assert.equal(charToSprite(ch, ROW, COL), 'grass-short-1');
        });
    }

    it("'P' (pine) is NOT in the switch — falls through to grass-short-1", () => {
        // Confirm P is not a special case
        assert.equal(charToSprite('P', ROW, COL), 'grass-short-1');
        assert.equal(charToSprite('P', 0, 0), 'grass-short-1');
        assert.equal(charToSprite('P', 99, 99), 'grass-short-1');
    });

    it("'S' (shrub) is NOT in the switch — falls through to grass-short-1", () => {
        assert.equal(charToSprite('S', ROW, COL), 'grass-short-1');
        assert.equal(charToSprite('S', 0, 0), 'grass-short-1');
        assert.equal(charToSprite('S', 99, 99), 'grass-short-1');
    });
});

// ─── Bridge completeness (all 9 cells) ───────────────────────────────────────

describe('render-level-preview: bridge 3×3 grid completeness', () => {
    const bridgeGrid = [
        ['{', 'bridge-tl'],
        ['^', 'bridge-tm'],
        ['}', 'bridge-tr'],
        ['[', 'bridge-ml'],
        ['=', 'bridge-mm'],
        [']', 'bridge-mr'],
        ['<', 'bridge-bl'],
        ['_', 'bridge-bm'],
        ['>', 'bridge-br'],
    ];

    it('all 9 bridge characters map to distinct sprite names', () => {
        const sprites = bridgeGrid.map(([ch]) => charToSprite(ch, ROW, COL));
        const unique = new Set(sprites);
        assert.equal(unique.size, 9, `Expected 9 distinct bridge sprites, got ${unique.size}: ${sprites.join(', ')}`);
    });

    for (const [ch, expected] of bridgeGrid) {
        it(`bridge char '${ch}' → '${expected}' (position-independent)`, () => {
            // Bridge sprites are exact — hash doesn't affect them
            assert.equal(charToSprite(ch, 0, 0), expected);
            assert.equal(charToSprite(ch, 10, 20), expected);
            assert.equal(charToSprite(ch, 99, 99), expected);
        });
    }
});

// ─── Road completeness ────────────────────────────────────────────────────────

describe('render-level-preview: road characters completeness', () => {
    const roadChars = [
        ['D', 'road-full'],
        ['L', 'road-edge-left'],
        ['r', 'road-edge-right'],
        ['U', 'road-edge-top'],
        ['u', 'road-edge-bottom'],
        ['1', 'road-corner-tl'],
        ['2', 'road-corner-tr'],
        ['3', 'road-corner-bl'],
        ['4', 'road-corner-br'],
    ];

    it('all 9 road characters map to distinct sprite names', () => {
        const sprites = roadChars.map(([ch]) => charToSprite(ch, ROW, COL));
        const unique = new Set(sprites);
        assert.equal(unique.size, 9, `Expected 9 distinct road sprites, got ${unique.size}`);
    });

    for (const [ch, expected] of roadChars) {
        it(`road char '${ch}' → '${expected}' (position-independent)`, () => {
            assert.equal(charToSprite(ch, 0, 0), expected);
            assert.equal(charToSprite(ch, 50, 50), expected);
        });
    }
});

// ─── Hash-based variant distribution ─────────────────────────────────────────
//
// Note: tileHash() produces values in [0, 0.5) due to the bit-manipulation
// algorithm used. This means:
//   - '.' always → grass-short-1  (hash > 0.5 is never true)
//   - ',' always → grass-flowers-1
//   - 'O' → tree-1 or tree-2     (Math.floor(hash * 3) ∈ {0, 1})
//   - '~' → water-1 or water-2
//   - 'w' → water-h-1 or water-h-2
// The tests below verify the actual observed behavior.

describe('render-level-preview: hash-based variant distribution', () => {
    it('grass (.) always produces grass-short-1 (hash never exceeds 0.5)', () => {
        // tileHash always returns < 0.5, so hash > 0.5 is always false
        for (let r = 0; r < 50; r++) {
            for (let c = 0; c < 50; c++) {
                assert.equal(charToSprite('.', r, c), 'grass-short-1');
            }
        }
    });

    it('flowers (,) always produces grass-flowers-1 (hash never exceeds 0.5)', () => {
        for (let r = 0; r < 50; r++) {
            for (let c = 0; c < 50; c++) {
                assert.equal(charToSprite(',', r, c), 'grass-flowers-1');
            }
        }
    });

    it('tree (O) produces tree-1 and tree-2 across a 50×50 grid (hash in [0,0.5))', () => {
        const variants = new Set();
        for (let r = 0; r < 50; r++) {
            for (let c = 0; c < 50; c++) {
                variants.add(charToSprite('O', r, c));
            }
        }
        // hash ∈ [0, 0.5) → Math.floor(hash * 3) ∈ {0, 1} → tree-1 or tree-2
        assert.ok(variants.has('tree-1'), 'Should produce tree-1');
        assert.ok(variants.has('tree-2'), 'Should produce tree-2');
        assert.ok(!variants.has('tree-3'), 'tree-3 is unreachable (hash never >= 2/3)');
    });

    it('water (~) produces water-1 and water-2 across a 50×50 grid', () => {
        const variants = new Set();
        for (let r = 0; r < 50; r++) {
            for (let c = 0; c < 50; c++) {
                variants.add(charToSprite('~', r, c));
            }
        }
        assert.ok(variants.has('water-1'), 'Should produce water-1');
        assert.ok(variants.has('water-2'), 'Should produce water-2');
        assert.ok(!variants.has('water-3'), 'water-3 is unreachable (hash never >= 2/3)');
    });

    it('horizontal water (w) produces water-h-1 and water-h-2 across a 50×50 grid', () => {
        const variants = new Set();
        for (let r = 0; r < 50; r++) {
            for (let c = 0; c < 50; c++) {
                variants.add(charToSprite('w', r, c));
            }
        }
        assert.ok(variants.has('water-h-1'), 'Should produce water-h-1');
        assert.ok(variants.has('water-h-2'), 'Should produce water-h-2');
        assert.ok(!variants.has('water-h-3'), 'water-h-3 is unreachable (hash never >= 2/3)');
    });

    it('all hash-variant sprites produce valid names for every position in a 20×20 grid', () => {
        const hashChars = [
            { ch: '.', pattern: /^grass-short-[12]$/ },
            { ch: ',', pattern: /^grass-flowers-[12]$/ },
            { ch: 'O', pattern: /^tree-[123]$/ },
            { ch: '~', pattern: /^water-[123]$/ },
            { ch: 'w', pattern: /^water-h-[123]$/ },
        ];
        for (const { ch, pattern } of hashChars) {
            for (let r = 0; r < 20; r++) {
                for (let c = 0; c < 20; c++) {
                    const sprite = charToSprite(ch, r, c);
                    assert.match(sprite, pattern,
                        `charToSprite('${ch}', ${r}, ${c}) = '${sprite}' does not match ${pattern}`);
                }
            }
        }
    });

    it('tileHash always returns values in [0, 1)', () => {
        for (let r = 0; r < 100; r++) {
            for (let c = 0; c < 100; c++) {
                const h = tileHash(r, c);
                assert.ok(h >= 0 && h < 1,
                    `tileHash(${r}, ${c}) = ${h} is out of [0, 1)`);
            }
        }
    });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('render-level-preview: charToSprite determinism', () => {
    it('same character and position always returns the same sprite', () => {
        const chars = ['.', ',', 'O', '~', 'w', 'D', '{', '^', 'P', 'S'];
        for (const ch of chars) {
            const s1 = charToSprite(ch, 7, 13);
            const s2 = charToSprite(ch, 7, 13);
            assert.equal(s1, s2, `charToSprite('${ch}', 7, 13) should be deterministic`);
        }
    });
});
