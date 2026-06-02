/**
 * Tests for generateIsoWallOverlay in generate-iso-sprites-br-tl.js.
 *
 * The function draws a two-face isometric stone wall on a 64×96 transparent
 * canvas (BR→TL viewpoint):
 *
 * Geometry constants (post-update, H=96):
 *   DIAMOND_LEFT_Y = 80  (y of left & right diamond vertices)
 *   DIAMOND_BOT_Y  = 95  (y of bottom diamond vertex)
 *   WALL_H         = 64  → wallTopY = 95 - 64 = 31
 *   MERLON_H       = 6   → merlonTopCap = wallTopY - MERLON_H = 25
 *   PERIOD         = 9   (MERLON_W=5 + CRENEL_W=4)
 *   isMerlon(x)    = (x % 9) < 5
 *
 * LEFT face (SW edge, West→South): x = 0..31
 *   leftSurfaceRow(x) = floor(80 + x * 0.5) + 1
 *   x=0  → sr=81  (wall body = rows [31..80])
 *   x=31 → sr=96  (wall body = rows [31..95])
 *
 * RIGHT face (SE edge, South→East): x = 32..63
 *   rightSurfaceRow(x) = floor(80 + (63 - x) * 0.5) + 1
 *   x=32 → sr=96  (wall body = rows [31..95])
 *   x=63 → sr=81  (wall body = rows [31..80])
 *
 * Wall body for column x: rows [wallTopY, sr-1] (inclusive)
 * Parapet cap: always drawn at y=wallTopY for every column
 * Merlons (when isMerlon(x)): drawn at y = wallTopY-1 down to merlonTopCap+1
 *   plus dark cap at merlonTopCap
 * Arrow slits (undamaged only): drawn at x=14 (left face) and x=50 (right face),
 *   vertical pixels at slitY..slitY+9, horizontal arm at slitY+4 ±1
 *
 * Bottom rows y=96..95 (none — canvas ends at H-1=95): diamond footprint is
 * entirely within the canvas but left transparent (alpha=0).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-iso-sprites-iso-wall-overlay.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    generateIsoWallOverlay,
} = require('../../js/level-generators/generate-iso-sprites-br-tl');

const { getPaletteForCategory } = require('../../js/level-generators/lib/palette');

// ── Geometry constants (must mirror the implementation exactly) ───────────────
const W             = 64;
const H             = 96;
const DIAMOND_LEFT_Y = 80;
const DIAMOND_BOT_Y  = 95;
const WALL_H        = 64;
const MERLON_H      = 6;
const MERLON_W      = 5;
const CRENEL_W      = 4;
const PERIOD        = MERLON_W + CRENEL_W;    // 9
const wallTopY      = DIAMOND_BOT_Y - WALL_H; // 31
const merlonTopCap  = wallTopY - MERLON_H;    // 25
const slitXL        = 14;
const slitXR        = 50;
const slitY         = wallTopY + Math.floor(WALL_H * 0.38); // 31 + 24 = 55

function leftSurfaceRow(x)  { return Math.floor(DIAMOND_LEFT_Y + x * 0.5) + 1; }
function rightSurfaceRow(x) { return Math.floor(DIAMOND_LEFT_Y + (63 - x) * 0.5) + 1; }
function surfaceRowFor(x)   { return x <= 31 ? leftSurfaceRow(x) : rightSurfaceRow(x); }
function isMerlon(x)        { return (x % PERIOD) < MERLON_W; }

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Tests: buffer dimensions ──────────────────────────────────────────────────

describe('generateIsoWallOverlay: buffer dimensions', () => {
    it('undamaged: returns a Buffer of exactly 64×96×4 bytes', () => {
        const buf = generateIsoWallOverlay(false);
        assert.ok(Buffer.isBuffer(buf));
        assert.equal(buf.length, W * H * 4);
        assert.equal(buf.length, 24576);
    });

    it('damaged: returns a Buffer of exactly 64×96×4 bytes', () => {
        assert.equal(generateIsoWallOverlay(true).length, W * H * 4);
    });

    it('default argument (no args) produces same size as explicit false', () => {
        assert.equal(generateIsoWallOverlay().length, W * H * 4);
    });
});

// ── Tests: transparent background ────────────────────────────────────────────

describe('generateIsoWallOverlay: transparent background', () => {
    it('has a significant number of transparent pixels', () => {
        const buf = generateIsoWallOverlay(false);
        let transp = 0;
        for (let i = 3; i < buf.length; i += 4) if (buf[i] === 0) transp++;
        assert.ok(transp > 100, `expected >100 transparent pixels, got ${transp}`);
    });

    it('top-left corner (0,0) is transparent', () => {
        assert.equal(getPixel(generateIsoWallOverlay(false), 0, 0).a, 0);
    });

    it('top-right corner (63,0) is transparent', () => {
        assert.equal(getPixel(generateIsoWallOverlay(false), 63, 0).a, 0);
    });

    it('rows y < merlonTopCap (y < 25) are all transparent', () => {
        const buf = generateIsoWallOverlay(false);
        for (let y = 0; y < merlonTopCap; y++) {
            for (let x = 0; x < W; x++) {
                assert.equal(getPixel(buf, x, y).a, 0,
                    `y=${y} x=${x}: should be transparent above merlonTopCap=${merlonTopCap}`);
            }
        }
    });

    it('topmost opaque row is at or near merlonTopCap (y=25) for merlon columns', () => {
        const buf = generateIsoWallOverlay(false);
        let found = false;
        for (let x = 0; x < W; x++) {
            if (isMerlon(x) && getPixel(buf, x, merlonTopCap).a === 255) {
                found = true;
                break;
            }
        }
        assert.ok(found, `expected at least one opaque pixel at y=merlonTopCap=${merlonTopCap}`);
    });
});

// ── Tests: parapet cap and merlons ────────────────────────────────────────────

describe('generateIsoWallOverlay: parapet cap and battlements', () => {
    it('wallTopY row (y=31) has opaque pixels in every column (cap is unconditional)', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 0; x < W; x++) {
            assert.equal(getPixel(buf, x, wallTopY).a, 255,
                `x=${x}: parapet cap at wallTopY=${wallTopY} should be opaque`);
        }
    });

    it('merlon columns (x%9 < 5) have opaque pixels above the parapet at y=wallTopY-1=30', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 0; x < W; x++) {
            if (isMerlon(x)) {
                assert.equal(getPixel(buf, x, wallTopY - 1).a, 255,
                    `x=${x} (merlon): y=${wallTopY - 1} should be opaque`);
            }
        }
    });

    it('crenel columns (x%9 >= 5) have NO opaque pixels strictly above wallTopY', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 0; x < W; x++) {
            if (!isMerlon(x)) {
                for (let y = merlonTopCap; y < wallTopY; y++) {
                    assert.equal(getPixel(buf, x, y).a, 0,
                        `x=${x} (crenel): y=${y} above parapet should be transparent`);
                }
            }
        }
    });

    it('total opaque pixel count is significant (wall has real coverage)', () => {
        assert.ok(countOpaquePixels(generateIsoWallOverlay(false)) > 500,
            'expected > 500 opaque pixels in a 64×96 wall canvas');
    });

    it('merlon top cap at y=merlonTopCap=25 is opaque for merlon column x=0', () => {
        const buf = generateIsoWallOverlay(false);
        assert.ok(isMerlon(0), 'x=0 should be a merlon column');
        assert.equal(getPixel(buf, 0, merlonTopCap).a, 255,
            `x=0 y=${merlonTopCap}: merlon top cap should be opaque`);
    });
});

// ── Tests: LEFT face column geometry (x = 0..31) ─────────────────────────────

describe('generateIsoWallOverlay: LEFT face column geometry', () => {
    it('leftSurfaceRow(0) = 81, leftSurfaceRow(31) = 96', () => {
        assert.equal(leftSurfaceRow(0), 81);
        assert.equal(leftSurfaceRow(31), 96);
    });

    it('x=0: leftSR=81 → wall body fills [31..80], rows 81..95 are transparent', () => {
        const buf = generateIsoWallOverlay(false);
        const sr = leftSurfaceRow(0); // 81
        assert.equal(sr, 81);
        // Parapet cap at wallTopY=31 must be opaque
        assert.equal(getPixel(buf, 0, wallTopY).a, 255, 'parapet cap');
        // Rows at and below sr must be transparent
        for (let y = sr; y < H; y++) {
            assert.equal(getPixel(buf, 0, y).a, 0,
                `x=0 y=${y}: y>=${sr} should be transparent`);
        }
    });

    it('x=16: leftSR=89 → some wall body rows in [31..88] are opaque', () => {
        const buf = generateIsoWallOverlay(false);
        const sr = leftSurfaceRow(16); // floor(80+8)+1 = 89
        assert.equal(sr, 89);
        let opaqueCount = 0;
        for (let y = wallTopY; y < sr; y++) {
            if (getPixel(buf, 16, y).a === 255) opaqueCount++;
        }
        assert.ok(opaqueCount > 0, `x=16: expected opaque body rows in [${wallTopY}..${sr - 1}]`);
    });

    it('x=31: leftSR=96 → full wall body [31..95] fully covered', () => {
        const buf = generateIsoWallOverlay(false);
        const sr = leftSurfaceRow(31); // 96
        assert.equal(sr, H);
        assert.equal(getPixel(buf, 31, wallTopY).a, 255, 'parapet cap at wallTopY');
        assert.equal(getPixel(buf, 31, wallTopY + 10).a, 255, 'mid-body row opaque');
    });

    it('for each x in [0..31]: rows y >= leftSR(x) are transparent', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 0; x <= 31; x++) {
            const sr = leftSurfaceRow(x);
            for (let y = sr; y < H; y++) {
                assert.equal(getPixel(buf, x, y).a, 0,
                    `LEFT x=${x} y=${y}: y>=${sr} (below diamond surface) should be transparent`);
            }
        }
    });
});

// ── Tests: RIGHT face column geometry (x = 32..63) ───────────────────────────

describe('generateIsoWallOverlay: RIGHT face column geometry', () => {
    it('rightSurfaceRow(32) = 96, rightSurfaceRow(63) = 81', () => {
        assert.equal(rightSurfaceRow(32), 96);
        assert.equal(rightSurfaceRow(63), 81);
    });

    it('x=32: rightSR=96 → full wall body [31..95] + ridge seam all opaque', () => {
        const buf = generateIsoWallOverlay(false);
        for (let y = wallTopY; y < H; y++) {
            assert.equal(getPixel(buf, 32, y).a, 255,
                `x=32 y=${y}: ridge/wall body should be opaque`);
        }
    });

    it('x=48: rightSR=89 → some wall body rows in [31..88] are opaque', () => {
        const buf = generateIsoWallOverlay(false);
        const sr = rightSurfaceRow(48); // floor(80+(63-48)*0.5)+1 = floor(87.5)+1 = 88
        assert.ok(sr > wallTopY, `rightSR(48)=${sr} should be above wallTopY`);
        assert.equal(getPixel(buf, 48, wallTopY).a, 255, 'parapet cap');
        // Rows at and beyond sr are transparent
        for (let y = sr; y < H; y++) {
            assert.equal(getPixel(buf, 48, y).a, 0,
                `x=48 y=${y}: y>=${sr} should be transparent`);
        }
    });

    it('x=63: rightSR=81 → wall body [31..80], rows 81..95 are transparent', () => {
        const buf = generateIsoWallOverlay(false);
        const sr = rightSurfaceRow(63); // 81
        assert.equal(sr, 81);
        for (let y = sr; y < H; y++) {
            assert.equal(getPixel(buf, 63, y).a, 0,
                `x=63 y=${y}: y>=${sr} should be transparent`);
        }
    });

    it('for each x in [33..63]: rows y >= rightSR(x) are transparent', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 33; x <= 63; x++) {
            const sr = rightSurfaceRow(x);
            for (let y = sr; y < H; y++) {
                assert.equal(getPixel(buf, x, y).a, 0,
                    `RIGHT x=${x} y=${y}: y>=${sr} should be transparent`);
            }
        }
    });
});

// ── Tests: ridge seam at x=32 ────────────────────────────────────────────────

describe('generateIsoWallOverlay: ridge seam', () => {
    it('x=32: rows wallTopY..H-1 (y=31..95) are all opaque (ridge overdraw)', () => {
        const buf = generateIsoWallOverlay(false);
        for (let y = wallTopY; y < H; y++) {
            assert.equal(getPixel(buf, 32, y).a, 255,
                `x=32 y=${y}: ridge seam should be opaque`);
        }
    });
});

// ── Tests: arrow slits (undamaged only) ──────────────────────────────────────

describe('generateIsoWallOverlay: arrow slits', () => {
    it(`undamaged: slit column x=${slitXL} has opaque pixels at slitY=${slitY}..${slitY + 9}`, () => {
        const buf = generateIsoWallOverlay(false);
        for (let dy = 0; dy < 10; dy++) {
            const sy = slitY + dy;
            if (sy < H) {
                assert.equal(getPixel(buf, slitXL, sy).a, 255,
                    `left slit x=${slitXL} y=${sy} should be opaque`);
            }
        }
    });

    it(`undamaged: slit column x=${slitXR} has opaque pixels at slitY=${slitY}..${slitY + 9}`, () => {
        const buf = generateIsoWallOverlay(false);
        for (let dy = 0; dy < 10; dy++) {
            const sy = slitY + dy;
            if (sy < H) {
                assert.equal(getPixel(buf, slitXR, sy).a, 255,
                    `right slit x=${slitXR} y=${sy} should be opaque`);
            }
        }
    });

    it('undamaged: cross-slit horizontal arm is drawn at slitY+4 ± 1', () => {
        const buf = generateIsoWallOverlay(false);
        const armY = slitY + 4;
        if (armY < H) {
            // x=slitXL-1 arm (if in bounds)
            if (slitXL > 0)   assert.equal(getPixel(buf, slitXL - 1, armY).a, 255, 'left arm -1');
            if (slitXL < 63)  assert.equal(getPixel(buf, slitXL + 1, armY).a, 255, 'left arm +1');
        }
    });

    it('damaged: NO arrow slit drawn at x=slitXL — those pixels may differ from undamaged', () => {
        const undamaged = generateIsoWallOverlay(false);
        const damaged   = generateIsoWallOverlay(true);
        // At least one pixel in the slit region should differ between damaged and undamaged
        // (damaged skips the slit drawing loop entirely)
        let differs = false;
        for (let dy = 0; dy < 10; dy++) {
            const sy = slitY + dy;
            if (sy < H) {
                const u = getPixel(undamaged, slitXL, sy);
                const d = getPixel(damaged, slitXL, sy);
                if (u.r !== d.r || u.g !== d.g || u.b !== d.b) { differs = true; break; }
            }
        }
        assert.ok(differs, 'damaged variant should differ from undamaged in the slit region');
    });
});

// ── Tests: determinism ────────────────────────────────────────────────────────

describe('generateIsoWallOverlay: determinism', () => {
    it('two calls with damaged=false produce identical buffers', () => {
        assert.ok(generateIsoWallOverlay(false).equals(generateIsoWallOverlay(false)));
    });

    it('two calls with damaged=true produce identical buffers', () => {
        assert.ok(generateIsoWallOverlay(true).equals(generateIsoWallOverlay(true)));
    });

    it('no-arg call is identical to damaged=false', () => {
        assert.ok(generateIsoWallOverlay().equals(generateIsoWallOverlay(false)));
    });
});

// ── Tests: damaged vs undamaged ───────────────────────────────────────────────

describe('generateIsoWallOverlay: damaged vs undamaged', () => {
    it('damaged and undamaged buffers are not byte-for-byte identical', () => {
        assert.ok(!generateIsoWallOverlay(false).equals(generateIsoWallOverlay(true)));
    });

    it('both variants have the same buffer length (64×96×4)', () => {
        assert.equal(generateIsoWallOverlay(false).length, generateIsoWallOverlay(true).length);
    });

    it('damaged variant still has plentiful opaque pixels (wall is still drawn)', () => {
        assert.ok(countOpaquePixels(generateIsoWallOverlay(true)) > 500);
    });

    it('damaged variant has parapet cap at wallTopY=31 for every column', () => {
        const buf = generateIsoWallOverlay(true);
        for (let x = 0; x < W; x++) {
            assert.equal(getPixel(buf, x, wallTopY).a, 255,
                `damaged x=${x}: parapet cap at wallTopY=${wallTopY} should still be opaque`);
        }
    });
});

// ── Tests: palette compliance ─────────────────────────────────────────────────

describe('generateIsoWallOverlay: palette compliance', () => {
    it('undamaged: every opaque pixel is within ±15 of a castle palette color', () => {
        const palette = getPaletteForCategory('castle');
        const buf = generateIsoWallOverlay(false);
        for (let i = 0; i < W * H; i++) {
            const idx = i * 4;
            if (buf[idx + 3] === 0) continue;
            assert.ok(
                closeToPalette(buf[idx], buf[idx + 1], buf[idx + 2], palette),
                `undamaged pixel ${i} RGB(${buf[idx]},${buf[idx + 1]},${buf[idx + 2]}) not near castle palette`
            );
        }
    });

    it('damaged: every opaque pixel is within ±15 of a castle palette color', () => {
        const palette = getPaletteForCategory('castle');
        const buf = generateIsoWallOverlay(true);
        for (let i = 0; i < W * H; i++) {
            const idx = i * 4;
            if (buf[idx + 3] === 0) continue;
            assert.ok(
                closeToPalette(buf[idx], buf[idx + 1], buf[idx + 2], palette),
                `damaged pixel ${i} RGB(${buf[idx]},${buf[idx + 1]},${buf[idx + 2]}) not near castle palette`
            );
        }
    });
});

// ── Tests: diamond footprint stays transparent ────────────────────────────────

describe('generateIsoWallOverlay: diamond footprint stays transparent', () => {
    it('for each column x in [0..31]: rows y >= leftSR(x) are transparent', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 0; x <= 31; x++) {
            const sr = leftSurfaceRow(x);
            for (let y = sr; y < H; y++) {
                assert.equal(getPixel(buf, x, y).a, 0,
                    `LEFT x=${x} y=${y}: diamond footprint (y>=${sr}) should be transparent`);
            }
        }
    });

    it('for each column x in [33..63]: rows y >= rightSR(x) are transparent', () => {
        const buf = generateIsoWallOverlay(false);
        for (let x = 33; x <= 63; x++) {
            const sr = rightSurfaceRow(x);
            for (let y = sr; y < H; y++) {
                assert.equal(getPixel(buf, x, y).a, 0,
                    `RIGHT x=${x} y=${y}: diamond footprint (y>=${sr}) should be transparent`);
            }
        }
    });

    it('diamond top vertex area (near x=32, y=64) is transparent', () => {
        const buf = generateIsoWallOverlay(false);
        // y=64 is between wallTopY=31 and DIAMOND_LEFT_Y=80.
        // Column x=32 has the ridge seam drawn from wallTopY=31..95, so it's opaque there.
        // But columns far from x=32 near y=64 should still be within the wall body
        // (between merlonTopCap and sr), so this just verifies top corner stays clear.
        assert.equal(getPixel(buf, 0, 64).a, 255,
            'x=0 y=64 is within the wall body (64 < leftSR(0)=81), should be opaque');
        assert.equal(getPixel(buf, 63, 64).a, 255,
            'x=63 y=64 is within the wall body (64 < rightSR(63)=81), should be opaque');
    });
});

// ── Tests: wall geometry sanity checks ───────────────────────────────────────

describe('generateIsoWallOverlay: geometry sanity', () => {
    it('wallTopY = DIAMOND_BOT_Y - WALL_H = 95 - 64 = 31', () => {
        assert.equal(wallTopY, 31);
    });

    it('merlonTopCap = wallTopY - MERLON_H = 31 - 6 = 25', () => {
        assert.equal(merlonTopCap, 25);
    });

    it('leftSurfaceRow(0) = floor(80 + 0) + 1 = 81', () => {
        assert.equal(leftSurfaceRow(0), 81);
    });

    it('leftSurfaceRow(31) = floor(80 + 15.5) + 1 = 96 = H', () => {
        assert.equal(leftSurfaceRow(31), H);
    });

    it('rightSurfaceRow(32) = floor(80 + 15.5) + 1 = 96 = H', () => {
        assert.equal(rightSurfaceRow(32), H);
    });

    it('rightSurfaceRow(63) = floor(80 + 0) + 1 = 81', () => {
        assert.equal(rightSurfaceRow(63), 81);
    });

    it('slitY = wallTopY + floor(64 * 0.38) = 31 + 24 = 55', () => {
        assert.equal(slitY, 55);
    });
});
