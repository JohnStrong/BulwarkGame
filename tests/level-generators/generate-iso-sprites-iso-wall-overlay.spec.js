/**
 * Tests for generateIsoWallOverlay in generate-iso-sprites-br-tl.js.
 *
 * New geometry (smooth flat walkway, no merlons):
 *   GROUND_Y  = 80,  WALL_H = 48  → wallTopY = 32
 *   Walkway: rows 30 (highlight), 31 (surface), 32 (front ledge shadow)
 *   Stone body starts at row 33 for all columns.
 *   Corner seam at x=32 drawn from walkTopY(30) downward.
 *
 * Uses Node.js built-in test runner (node:test).
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { generateIsoWallOverlay } = require('../../js/level-generators/generate-iso-sprites-br-tl');
const { getPaletteForCategory }   = require('../../js/level-generators/lib/palette');

const W        = 64;
const H        = 96;
const GROUND_Y = 80;
const WALL_H   = 48;
const wallTopY = GROUND_Y - WALL_H;   // 32 — front ledge row
const walkHighY = wallTopY - 2;        // 30 — highlight row
const walkSurfY = wallTopY - 1;        // 31 — surface row
const stoneTop  = wallTopY + 1;        // 33 — stone face starts here

// Arrow slit geometry
const slitX    = 14;
const slitMidY = wallTopY + Math.floor(WALL_H * 0.45); // 32 + 21 = 53

function leftSR(x)  { return Math.floor(GROUND_Y + x * 0.5) + 1; }
function rightSR(x) { return Math.floor(GROUND_Y + (63 - x) * 0.5) + 1; }

function getPixel(buf, x, y) {
    const idx = (y * W + x) * 4;
    return { r: buf[idx], g: buf[idx + 1], b: buf[idx + 2], a: buf[idx + 3] };
}

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) if (buf[i] === 255) count++;
    return count;
}

function closeToPalette(r, g, b, palette) {
    return palette.some(([pr, pg, pb]) =>
        Math.abs(r - pr) <= 15 && Math.abs(g - pg) <= 15 && Math.abs(b - pb) <= 15);
}

// ── Geometry sanity ───────────────────────────────────────────────────────────

describe('generateIsoWallOverlay: geometry constants', () => {
    it('wallTopY = 80 - 48 = 32', () => assert.equal(wallTopY, 32));
    it('walkHighY = wallTopY - 2 = 30', () => assert.equal(walkHighY, 30));
    it('walkSurfY = wallTopY - 1 = 31', () => assert.equal(walkSurfY, 31));
    it('stoneTop = wallTopY + 1 = 33', () => assert.equal(stoneTop, 33));
    it('leftSR(0) = 81', () => assert.equal(leftSR(0), 81));
    it('leftSR(31) = 96 = H', () => assert.equal(leftSR(31), H));
    it('rightSR(32) = 96 = H', () => assert.equal(rightSR(32), H));
    it('rightSR(63) = 81', () => assert.equal(rightSR(63), 81));
    it('slitMidY = 32 + 21 = 53', () => assert.equal(slitMidY, 53));
});

// ── Buffer dimensions ─────────────────────────────────────────────────────────

describe('generateIsoWallOverlay: buffer dimensions', () => {
    it('undamaged: Buffer of exactly 64×96×4 = 24576 bytes', () => {
        assert.equal(generateIsoWallOverlay(false).length, W * H * 4);
    });
    it('damaged: same buffer size', () => {
        assert.equal(generateIsoWallOverlay(true).length, W * H * 4);
    });
    it('no-arg: same as damaged=false', () => {
        assert.equal(generateIsoWallOverlay().length, W * H * 4);
    });
});

// ── Transparent background ────────────────────────────────────────────────────

describe('generateIsoWallOverlay: transparent background', () => {
    it('has significant transparent pixels', () => {
        const buf = generateIsoWallOverlay(false);
        let t = 0;
        for (let i = 3; i < buf.length; i += 4) if (buf[i] === 0) t++;
        assert.ok(t > 100, `expected >100 transparent, got ${t}`);
    });

    it('top-left corner (0,0) is transparent', () => {
        assert.equal(getPixel(generateIsoWallOverlay(false), 0, 0).a, 0);
    });

    it('top-right corner (63,0) is transparent', () => {
        assert.equal(getPixel(generateIsoWallOverlay(false), 63, 0).a, 0);
    });

    it('rows y < walkHighY (y < 30) are all transparent', () => {
        const buf = generateIsoWallOverlay(false);
        for (let y = 0; y < walkHighY; y++) {
            for (let x = 0; x < W; x++) {
                assert.equal(getPixel(buf, x, y).a, 0,
                    `y=${y} x=${x}: should be transparent above walkHighY=${walkHighY}`);
            }
        }
    });

    it('topmost opaque row is walkHighY=30 for every column', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 0; x < W; x++) {
            assert.equal(getPixel(buf, x, walkHighY).a, 255,
                `x=${x}: walkHighY=${walkHighY} should be opaque`);
        }
    });
});

// ── Flat walkway platform ─────────────────────────────────────────────────────

describe('generateIsoWallOverlay: flat walkway platform', () => {
    it('walkHighY row (y=30) is opaque for all columns', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 0; x < W; x++) {
            assert.equal(getPixel(buf, x, walkHighY).a, 255,
                `x=${x}: highlight row should be opaque`);
        }
    });

    it('walkSurfY row (y=31) is opaque for all columns', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 0; x < W; x++) {
            assert.equal(getPixel(buf, x, walkSurfY).a, 255,
                `x=${x}: surface row should be opaque`);
        }
    });

    it('wallTopY row (y=32 — front ledge shadow) is opaque for all columns', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 0; x < W; x++) {
            assert.equal(getPixel(buf, x, wallTopY).a, 255,
                `x=${x}: ledge shadow row should be opaque`);
        }
    });

    it('walkway surface (y=31) is lighter than wall face — placement is visually distinct', () => {
        const buf = generateIsoWallOverlay(false);
        // Sample a few columns — surface row should have higher average brightness
        // than stone body a few rows below
        let surfSum = 0, stoneSum = 0, count = 0;
        for (const x of [10, 20, 40, 50]) {
            const surf = getPixel(buf, x, walkSurfY);
            const stone = getPixel(buf, x, stoneTop + 5);
            if (surf.a === 255 && stone.a === 255) {
                surfSum += surf.r + surf.g + surf.b;
                stoneSum += stone.r + stone.g + stone.b;
                count++;
            }
        }
        assert.ok(count > 0, 'need some opaque pixels to compare');
        assert.ok(surfSum / count > stoneSum / count,
            `walkway surface (avg=${(surfSum/count).toFixed(0)}) should be brighter than stone face (avg=${(stoneSum/count).toFixed(0)})`);
    });

    it('total opaque pixel count is significant', () => {
        assert.ok(countOpaquePixels(generateIsoWallOverlay(false)) > 500);
    });
});

// ── LEFT face column geometry ─────────────────────────────────────────────────

describe('generateIsoWallOverlay: LEFT face column geometry', () => {
    it('for all x in [0..31]: rows y >= leftSR(x) are transparent', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 0; x <= 31; x++) {
            const sr = leftSR(x);
            for (let y = sr; y < H; y++) {
                assert.equal(getPixel(buf, x, y).a, 0,
                    `x=${x} y=${y}: below diamond surface should be transparent`);
            }
        }
    });

    it('x=0: stone body rows [33..80] have opaque pixels', () => {
        const buf = generateIsoWallOverlay(false);
        assert.equal(getPixel(buf, 0, stoneTop).a, 255, 'stoneTop row at x=0 opaque');
        assert.equal(getPixel(buf, 0, 70).a, 255, 'y=70 at x=0 opaque');
    });

    it('x=31: full stone body [33..95] covered', () => {
        const buf = generateIsoWallOverlay(false);
        assert.equal(getPixel(buf, 31, stoneTop).a, 255, 'stoneTop at x=31 opaque');
        assert.equal(getPixel(buf, 31, 80).a, 255, 'y=80 at x=31 opaque');
    });
});

// ── RIGHT face column geometry ────────────────────────────────────────────────

describe('generateIsoWallOverlay: RIGHT face column geometry', () => {
    it('x=32 corner seam: rows walkHighY..H-1 (y=30..95) all opaque', () => {
        const buf = generateIsoWallOverlay(false);
        for (let y = walkHighY; y < H; y++) {
            assert.equal(getPixel(buf, 32, y).a, 255,
                `x=32 y=${y}: corner seam should be opaque`);
        }
    });

    it('for all x in [33..63]: rows y >= rightSR(x) are transparent', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 33; x <= 63; x++) {
            const sr = rightSR(x);
            for (let y = sr; y < H; y++) {
                assert.equal(getPixel(buf, x, y).a, 0,
                    `x=${x} y=${y}: y>=${sr} should be transparent`);
            }
        }
    });

    it('x=63: rows 81..95 transparent', () => {
        const buf = generateIsoWallOverlay(false);
        const sr = rightSR(63); // 81
        for (let y = sr; y < H; y++) {
            assert.equal(getPixel(buf, 63, y).a, 0,
                `x=63 y=${y}: y>=${sr} should be transparent`);
        }
    });
});

// ── Arrow slit ────────────────────────────────────────────────────────────────

describe('generateIsoWallOverlay: arrow slit', () => {
    it(`undamaged: vertical slot at x=${slitX} spans slitMidY ±5`, () => {
        const buf = generateIsoWallOverlay(false);
        for (let dy = -5; dy <= 5; dy++) {
            const sy = slitMidY + dy;
            if (sy > wallTopY && sy < H) {
                assert.equal(getPixel(buf, slitX, sy).a, 255,
                    `slit x=${slitX} y=${sy} should be opaque`);
            }
        }
    });

    it('damaged: slit region differs from undamaged', () => {
        const u = generateIsoWallOverlay(false);
        const d = generateIsoWallOverlay(true);
        let differs = false;
        for (let dy = -5; dy <= 5; dy++) {
            const sy = slitMidY + dy;
            if (sy > wallTopY && sy < H) {
                const up = getPixel(u, slitX, sy);
                const dp = getPixel(d, slitX, sy);
                if (up.r !== dp.r || up.g !== dp.g || up.b !== dp.b) { differs = true; break; }
            }
        }
        assert.ok(differs, 'damaged variant should differ in slit region');
    });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('generateIsoWallOverlay: determinism', () => {
    it('two undamaged calls produce identical buffers', () => {
        assert.ok(generateIsoWallOverlay(false).equals(generateIsoWallOverlay(false)));
    });
    it('two damaged calls produce identical buffers', () => {
        assert.ok(generateIsoWallOverlay(true).equals(generateIsoWallOverlay(true)));
    });
    it('no-arg equals damaged=false', () => {
        assert.ok(generateIsoWallOverlay().equals(generateIsoWallOverlay(false)));
    });
});

// ── Damaged vs undamaged ──────────────────────────────────────────────────────

describe('generateIsoWallOverlay: damaged vs undamaged', () => {
    it('buffers are not byte-for-byte identical', () => {
        assert.ok(!generateIsoWallOverlay(false).equals(generateIsoWallOverlay(true)));
    });
    it('same buffer length', () => {
        assert.equal(generateIsoWallOverlay(false).length, generateIsoWallOverlay(true).length);
    });
    it('damaged still has plenty of opaque pixels', () => {
        assert.ok(countOpaquePixels(generateIsoWallOverlay(true)) > 500);
    });
    it('damaged still has walkway platform at rows 30-32', () => {
        const buf = generateIsoWallOverlay(true);
        for (let x = 0; x < W; x++) {
            assert.equal(getPixel(buf, x, walkHighY).a, 255, `damaged x=${x}: walkHighY opaque`);
            assert.equal(getPixel(buf, x, walkSurfY).a, 255, `damaged x=${x}: walkSurfY opaque`);
            assert.equal(getPixel(buf, x, wallTopY).a,  255, `damaged x=${x}: wallTopY opaque`);
        }
    });
});

// ── Palette compliance ────────────────────────────────────────────────────────

describe('generateIsoWallOverlay: palette compliance', () => {
    it('undamaged: every opaque pixel within ±15 of castle palette', () => {
        const palette = getPaletteForCategory('castle');
        const buf = generateIsoWallOverlay(false);
        for (let i = 0; i < W * H; i++) {
            const idx = i * 4;
            if (buf[idx + 3] === 0) continue;
            assert.ok(
                closeToPalette(buf[idx], buf[idx + 1], buf[idx + 2], palette),
                `pixel ${i} RGB(${buf[idx]},${buf[idx + 1]},${buf[idx + 2]}) not near castle palette`
            );
        }
    });
});

// ── Diamond footprint stays transparent ──────────────────────────────────────

describe('generateIsoWallOverlay: diamond footprint stays transparent', () => {
    it('for all x in [0..31]: rows y >= leftSR(x) are transparent', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 0; x <= 31; x++) {
            for (let y = leftSR(x); y < H; y++) {
                assert.equal(getPixel(buf, x, y).a, 0,
                    `LEFT x=${x} y=${y}: diamond footprint should be transparent`);
            }
        }
    });

    it('for all x in [33..63]: rows y >= rightSR(x) are transparent', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 33; x <= 63; x++) {
            for (let y = rightSR(x); y < H; y++) {
                assert.equal(getPixel(buf, x, y).a, 0,
                    `RIGHT x=${x} y=${y}: diamond footprint should be transparent`);
            }
        }
    });
});
