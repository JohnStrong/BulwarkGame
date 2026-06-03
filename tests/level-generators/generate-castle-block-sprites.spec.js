/**
 * Tests for generate-castle-block-sprites.js
 *
 * Covers:
 *   - Exported geometry constants: W, TOP_H, FACE_H
 *   - Colour constants: valid RGB triples with correct brightness ordering
 *   - canvasHeightForBlocks: formula = blockCount × FACE_H + TOP_H
 *   - generateBlockOverlay:
 *       · correct byte length for blockCount 1, 2, 3
 *       · ground connector (last TOP_H rows) is fully transparent
 *       · at least one opaque pixel in the face area
 *       · binary alpha (0 or 255 only)
 *       · deterministic with same seed; different seeds differ
 *   - SPRITE_DEFS:
 *       · 23 entries, no duplicates, all names end with "-overlay"
 *       · every entry has blockCount ≥ 1 and a numeric seed
 *       · blockCount maps to correct canvas height
 *       · gen output byte length matches W × canvasHeight × 4
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-castle-block-sprites.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const mod = require('../../js/level-generators/generate-castle-block-sprites');

const {
    generateBlockOverlay,
    canvasHeightForBlocks,
    SPRITE_DEFS,
    W,
    TOP_H,
    FACE_H,
    STONE_HI,
    STONE_MID,
    STONE_SHAD,
    MORTAR,
    MOSS,
    L_HI, L_MID, L_SHAD,
    R_HI, R_MID, R_SHAD,
    OUTLINE,
} = mod;

// ─── Geometry constants ───────────────────────────────────────────────────────

describe('Geometry constants', () => {
    it('W is 64',     () => assert.equal(W,      64));
    it('TOP_H is 32', () => assert.equal(TOP_H,  32));
    it('FACE_H is 16',() => assert.equal(FACE_H, 16));
    it('W / TOP_H ratio is 2:1 (iso diamond proportion)',
       () => assert.equal(W / TOP_H, 2));
});

// ─── Colour constants ────────────────────────────────────────────────────────

describe('Colour constants are valid RGB triples', () => {
    const check = (name, arr) => {
        assert.ok(Array.isArray(arr),           `${name} must be an array`);
        assert.equal(arr.length, 3,             `${name} must have 3 elements`);
        for (const ch of arr)
            assert.ok(typeof ch === 'number' && ch >= 0 && ch <= 255,
                `${name} channel ${ch} must be in [0, 255]`);
    };

    it('STONE_HI',   () => check('STONE_HI',   STONE_HI));
    it('STONE_MID',  () => check('STONE_MID',  STONE_MID));
    it('STONE_SHAD', () => check('STONE_SHAD', STONE_SHAD));
    it('MORTAR',     () => check('MORTAR',     MORTAR));
    it('MOSS',       () => check('MOSS',       MOSS));
    it('L_HI',       () => check('L_HI',       L_HI));
    it('L_MID',      () => check('L_MID',      L_MID));
    it('L_SHAD',     () => check('L_SHAD',     L_SHAD));
    it('R_HI',       () => check('R_HI',       R_HI));
    it('R_MID',      () => check('R_MID',      R_MID));
    it('R_SHAD',     () => check('R_SHAD',     R_SHAD));
    it('OUTLINE',    () => check('OUTLINE',    OUTLINE));
});

describe('Colour brightness ordering (directional lighting)', () => {
    const lum = ([r, g, b]) => r + g + b;

    it('STONE_HI > STONE_MID > STONE_SHAD',  () => {
        assert.ok(lum(STONE_HI) > lum(STONE_MID),   'HI > MID');
        assert.ok(lum(STONE_MID) > lum(STONE_SHAD), 'MID > SHAD');
    });

    it('Left face brighter than right face (L_HI > R_HI)', () =>
        assert.ok(lum(L_HI) > lum(R_HI),
            `L_HI (${lum(L_HI)}) should exceed R_HI (${lum(R_HI)})`));

    it('OUTLINE is very dark (luminance < 90)', () =>
        assert.ok(lum(OUTLINE) < 90,
            `OUTLINE luminance ${lum(OUTLINE)} should be < 90`));

    it('MORTAR is darker than STONE_SHAD', () =>
        assert.ok(lum(MORTAR) < lum(STONE_SHAD),
            `MORTAR (${lum(MORTAR)}) should be darker than STONE_SHAD (${lum(STONE_SHAD)})`));

    it('MOSS has a green bias (G channel dominates)', () =>
        assert.ok(MOSS[1] > MOSS[0] && MOSS[1] > MOSS[2],
            `MOSS G (${MOSS[1]}) should be > R (${MOSS[0]}) and B (${MOSS[2]})`));
});

// ─── canvasHeightForBlocks ────────────────────────────────────────────────────

describe('canvasHeightForBlocks', () => {
    it('is a function', () => assert.equal(typeof canvasHeightForBlocks, 'function'));

    it('blockCount=1 → 48  (FACE_H + TOP_H)',     () => assert.equal(canvasHeightForBlocks(1), 48));
    it('blockCount=2 → 64  (2×FACE_H + TOP_H)',   () => assert.equal(canvasHeightForBlocks(2), 64));
    it('blockCount=3 → 80  (3×FACE_H + TOP_H)',   () => assert.equal(canvasHeightForBlocks(3), 80));

    it('general: equals blockCount × FACE_H + TOP_H', () => {
        for (let n = 1; n <= 6; n++)
            assert.equal(canvasHeightForBlocks(n), n * FACE_H + TOP_H);
    });
});

// ─── generateBlockOverlay ─────────────────────────────────────────────────────

describe('generateBlockOverlay: returns a Buffer', () => {
    it('returns a Buffer', () => assert.ok(Buffer.isBuffer(generateBlockOverlay(1))));
});

describe('generateBlockOverlay: byte length', () => {
    for (const bc of [1, 2, 3]) {
        it(`blockCount=${bc} → W × canvasHeight × 4 bytes`, () => {
            const expected = W * canvasHeightForBlocks(bc) * 4;
            assert.equal(generateBlockOverlay(bc).length, expected);
        });
    }
});

describe('generateBlockOverlay: transparent ground connector', () => {
    // The bottom TOP_H rows of the canvas must remain alpha=0 so the wall
    // appears to grow out of the ground tile rather than float above it.
    for (const bc of [1, 2]) {
        it(`blockCount=${bc}: last TOP_H rows are fully transparent`, () => {
            const buf = generateBlockOverlay(bc);
            const h   = canvasHeightForBlocks(bc);
            for (let y = h - TOP_H; y < h; y++) {
                for (let x = 0; x < W; x++) {
                    const a = buf[((y * W + x) * 4) + 3];
                    if (a !== 0)
                        assert.fail(`Row ${y}, col ${x}: alpha=${a} (expected 0)`);
                }
            }
        });
    }
});

describe('generateBlockOverlay: opaque pixels in the face area', () => {
    it('blockCount=1: at least one opaque pixel above the ground connector', () => {
        const buf    = generateBlockOverlay(1);
        const faceH  = 1 * FACE_H;   // rows 0..faceH-1 are face area
        let found    = false;
        for (let y = 0; y < faceH && !found; y++)
            for (let x = 0; x < W && !found; x++)
                if (buf[((y * W + x) * 4) + 3] === 255) found = true;
        assert.ok(found, 'Expected opaque pixels in the face rows');
    });

    it('blockCount=2: at least one opaque pixel in the face area', () => {
        const buf   = generateBlockOverlay(2);
        const faceH = 2 * FACE_H;
        let found   = false;
        for (let y = 0; y < faceH && !found; y++)
            for (let x = 0; x < W && !found; x++)
                if (buf[((y * W + x) * 4) + 3] === 255) found = true;
        assert.ok(found);
    });
});

describe('generateBlockOverlay: binary alpha', () => {
    it('blockCount=1: every alpha is 0 or 255', () => {
        const buf = generateBlockOverlay(1);
        for (let i = 3; i < buf.length; i += 4) {
            const a = buf[i];
            if (a !== 0 && a !== 255)
                assert.fail(`Semi-transparent pixel: alpha=${a} at byte ${i}`);
        }
    });
});

describe('generateBlockOverlay: determinism and seed variation', () => {
    it('same args → identical bytes', () => {
        const a = generateBlockOverlay(1, 1000);
        const b = generateBlockOverlay(1, 1000);
        assert.deepEqual(a, b);
    });

    it('different seeds → different bytes', () => {
        const a = generateBlockOverlay(1, 1000);
        const b = generateBlockOverlay(1, 5999);
        let differs = false;
        for (let i = 0; i < a.length; i++)
            if (a[i] !== b[i]) { differs = true; break; }
        assert.ok(differs, 'Different seeds must produce different output');
    });
});

describe('generateBlockOverlay: right face is darker than left face', () => {
    it('blockCount=1: max luminance on left half > max luminance on right half', () => {
        const buf    = generateBlockOverlay(1, 1000);
        const faceH  = 1 * FACE_H;
        let maxLeft  = 0, maxRight = 0;

        for (let y = 0; y < faceH; y++) {
            // Left face occupies x in [r, 31] for row r
            for (let x = 0; x <= 31; x++) {
                const base = (y * W + x) * 4;
                if (buf[base + 3] === 255) {
                    const lum = buf[base] + buf[base + 1] + buf[base + 2];
                    if (lum > maxLeft) maxLeft = lum;
                }
            }
            // Right face occupies x in [32, 63-r]
            for (let x = 32; x < W; x++) {
                const base = (y * W + x) * 4;
                if (buf[base + 3] === 255) {
                    const lum = buf[base] + buf[base + 1] + buf[base + 2];
                    if (lum > maxRight) maxRight = lum;
                }
            }
        }

        assert.ok(maxLeft > maxRight,
            `Left max (${maxLeft}) should be brighter than right max (${maxRight})`);
    });
});

// ─── SPRITE_DEFS ──────────────────────────────────────────────────────────────

describe('SPRITE_DEFS: basic shape', () => {
    it('is an array',              () => assert.ok(Array.isArray(SPRITE_DEFS)));
    it('has exactly 23 entries',   () => assert.equal(SPRITE_DEFS.length, 23,
        `Expected 23, got ${SPRITE_DEFS.length}`));

    it('every entry has a non-empty string name', () => {
        for (const d of SPRITE_DEFS) {
            assert.equal(typeof d.name, 'string');
            assert.ok(d.name.length > 0, `name must not be empty`);
        }
    });

    it('every entry has a positive integer blockCount', () => {
        for (const d of SPRITE_DEFS)
            assert.ok(Number.isInteger(d.blockCount) && d.blockCount >= 1,
                `blockCount must be ≥ 1 for "${d.name}"`);
    });

    it('every entry has a numeric seed', () => {
        for (const d of SPRITE_DEFS)
            assert.equal(typeof d.seed, 'number',
                `seed must be a number for "${d.name}"`);
    });
});

describe('SPRITE_DEFS: no duplicates', () => {
    it('all names are unique', () => {
        const names  = SPRITE_DEFS.map(d => d.name);
        const unique = new Set(names);
        assert.equal(unique.size, names.length, 'Duplicate sprite names found');
    });
});

describe('SPRITE_DEFS: name format', () => {
    it('every name ends with "-overlay"', () => {
        for (const d of SPRITE_DEFS)
            assert.ok(d.name.endsWith('-overlay'),
                `"${d.name}" must end with "-overlay"`);
    });
});

describe('SPRITE_DEFS: blockCount → canvas height', () => {
    it('wall / bridge / iso-wall entries use blockCount=1 → 48px', () => {
        const entries = SPRITE_DEFS.filter(d =>
            d.name.includes('wall') || d.name.includes('bridge'));
        assert.ok(entries.length > 0, 'Expected wall/bridge entries');
        for (const d of entries)
            assert.equal(canvasHeightForBlocks(d.blockCount), 48,
                `"${d.name}" → 48px`);
    });

    it('tower / keep-quadrant entries use blockCount=2 → 64px', () => {
        const entries = SPRITE_DEFS.filter(d =>
            (d.name.includes('tower') ||
             d.name.includes('keep-tl') || d.name.includes('keep-bl') ||
             d.name.includes('keep-br') || d.name.includes('keep-center')) &&
            !d.name.includes('gatehouse'));
        assert.ok(entries.length > 0);
        for (const d of entries)
            assert.equal(canvasHeightForBlocks(d.blockCount), 64, `"${d.name}" → 64px`);
    });

    it('gatehouse entries use blockCount=3 → 80px', () => {
        const entries = SPRITE_DEFS.filter(d => d.name.includes('gatehouse'));
        assert.ok(entries.length > 0);
        for (const d of entries)
            assert.equal(canvasHeightForBlocks(d.blockCount), 80, `"${d.name}" → 80px`);
    });
});

describe('SPRITE_DEFS: gen output byte length is correct for every entry', () => {
    it('generateBlockOverlay(def.blockCount, def.seed) → W × canvasH × 4 bytes', () => {
        for (const def of SPRITE_DEFS) {
            const buf      = generateBlockOverlay(def.blockCount, def.seed);
            const expected = W * canvasHeightForBlocks(def.blockCount) * 4;
            assert.ok(Buffer.isBuffer(buf), `"${def.name}" must return a Buffer`);
            assert.equal(buf.length, expected,
                `"${def.name}": expected ${expected} bytes, got ${buf.length}`);
        }
    });
});

describe('SPRITE_DEFS: all 23 expected names are present', () => {
    const expected = [
        'castle-wall-overlay',            'castle-wall-damaged-overlay',
        'castle-iso-wall-overlay',        'castle-iso-wall-damaged-overlay',
        'bridge-mm-overlay',              'castle-bridge-start-overlay',
        'castle-bridge-mid-overlay',      'castle-bridge-gate-overlay',
        'castle-tower-overlay',           'castle-tower-damaged-overlay',
        'castle-keep-tl-overlay',         'castle-keep-tl-damaged-overlay',
        'castle-keep-bl-overlay',         'castle-keep-bl-damaged-overlay',
        'castle-keep-br-overlay',         'castle-keep-br-damaged-overlay',
        'castle-keep-center-overlay',     'castle-keep-center-damaged-overlay',
        'castle-gatehouse-overlay',       'castle-gatehouse-damaged-overlay',
        'castle-keep-overlay',            'castle-keep-damaged-overlay',
        'castle-keep-destroyed-overlay',
    ];

    const defined = new Set(SPRITE_DEFS.map(d => d.name));

    for (const name of expected)
        it(`"${name}" is present`, () =>
            assert.ok(defined.has(name), `Missing "${name}"`));
});
