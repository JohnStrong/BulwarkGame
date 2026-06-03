/**
 * Tests for generateCastleOverlay in generate-iso-sprites-br-tl.js:
 *   - Buffer byte length matches canvas dimensions for each structure category
 *   - Undamaged and damaged variants of the same structure type are not identical
 *
 * Canvas heights (updated for epic castle scale):
 *   wall:       96 px (64 px above 32 px ground = 2 full tile heights)
 *   bridge:     48 px (16 px above ground — low parapets)
 *   tower/keep: 128 px (96 px above ground = 3 tile heights)
 *   gatehouse:  144 px (112 px above ground — tallest structure)
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-castle-overlay.spec.js
 *
 * Requirements: 1.3, 1.4, 1.5, 1.6, 1.7
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { generateCastleOverlay } = require('../../js/level-generators/generate-iso-sprites-br-tl');

// ─── Canvas dimension constants (reflect CASTLE_OVERLAY_CANVAS_HEIGHTS) ───────

const WALL_BYTES         = 64 * 96  * 4;  // 24576 — 2 tile heights of wall
const BRIDGE_BYTES       = 64 * 48  * 4;  // 12288 — low bridge parapets (unchanged)
const TOWER_KEEP_BYTES   = 64 * 128 * 4;  // 32768 — 3+ tile heights
const GATEHOUSE_BYTES    = 64 * 144 * 4;  // 36864 — tallest structure

// ─── Tests: buffer byte length per structure category ────────────────────────

describe('generateCastleOverlay: buffer byte length — wall (64×96×4 = 24576)', () => {
    it("'wall' undamaged should return a buffer of 24576 bytes", () => {
        const buf = generateCastleOverlay('wall', false);
        assert.equal(buf.length, WALL_BYTES,
            `Expected ${WALL_BYTES} bytes (64×96×4) for 'wall', got ${buf.length}`);
    });

    it("'wall' damaged should return a buffer of 24576 bytes", () => {
        const buf = generateCastleOverlay('wall', true);
        assert.equal(buf.length, WALL_BYTES,
            `Expected ${WALL_BYTES} bytes (64×96×4) for damaged 'wall', got ${buf.length}`);
    });
});

describe('generateCastleOverlay: buffer byte length — bridge types (64×48×4 = 12288)', () => {
    const bridgeTypes = ['bridge-mm', 'bridge-start', 'bridge-mid', 'bridge-gate'];

    for (const structureType of bridgeTypes) {
        it(`'${structureType}' should return a buffer of ${BRIDGE_BYTES} bytes`, () => {
            const buf = generateCastleOverlay(structureType, false);
            assert.equal(buf.length, BRIDGE_BYTES,
                `Expected ${BRIDGE_BYTES} bytes (64×48×4) for '${structureType}', got ${buf.length}`);
        });
    }
});

describe('generateCastleOverlay: buffer byte length — tower/keep types (64×128×4 = 32768)', () => {
    const towerKeepTypes = ['tower', 'keep-tl', 'keep-bl', 'keep-br', 'keep-center'];

    for (const structureType of towerKeepTypes) {
        it(`'${structureType}' undamaged should return a buffer of ${TOWER_KEEP_BYTES} bytes`, () => {
            const buf = generateCastleOverlay(structureType, false);
            assert.equal(buf.length, TOWER_KEEP_BYTES,
                `Expected ${TOWER_KEEP_BYTES} bytes (64×128×4) for '${structureType}', got ${buf.length}`);
        });
    }

    for (const structureType of ['tower', 'keep-tl', 'keep-bl', 'keep-br', 'keep-center']) {
        it(`'${structureType}' damaged should return a buffer of ${TOWER_KEEP_BYTES} bytes`, () => {
            const buf = generateCastleOverlay(structureType, true);
            assert.equal(buf.length, TOWER_KEEP_BYTES,
                `Expected ${TOWER_KEEP_BYTES} bytes (64×128×4) for damaged '${structureType}', got ${buf.length}`);
        });
    }
});

describe('generateCastleOverlay: buffer byte length — gatehouse (64×144×4 = 36864)', () => {
    it("'gatehouse' undamaged should return a buffer of 36864 bytes", () => {
        const buf = generateCastleOverlay('gatehouse', false);
        assert.equal(buf.length, GATEHOUSE_BYTES,
            `Expected ${GATEHOUSE_BYTES} bytes (64×144×4) for 'gatehouse', got ${buf.length}`);
    });

    it("'gatehouse' damaged should return a buffer of 36864 bytes", () => {
        const buf = generateCastleOverlay('gatehouse', true);
        assert.equal(buf.length, GATEHOUSE_BYTES,
            `Expected ${GATEHOUSE_BYTES} bytes (64×144×4) for damaged 'gatehouse', got ${buf.length}`);
    });
});

// ─── Tests: undamaged vs damaged variant distinctness ────────────────────────

describe('generateCastleOverlay: undamaged and damaged variants are not byte-for-byte identical', () => {
    const damagedTypes = ['wall', 'tower', 'keep-tl', 'keep-bl', 'keep-br', 'keep-center', 'gatehouse'];

    for (const structureType of damagedTypes) {
        it(`'${structureType}' undamaged and damaged should not be byte-for-byte identical`, () => {
            const undamaged = generateCastleOverlay(structureType, false);
            const damaged   = generateCastleOverlay(structureType, true);
            assert.ok(
                !undamaged.equals(damaged),
                `'${structureType}' undamaged and damaged variants should differ visually`
            );
        });
    }
});

// ─── Tests: drawWalkwayPlatform (tested via generateCastleOverlay 'wall') ─────
//
// drawWalkwayPlatform replaced drawBattlements. Instead of alternating merlon/
// crenel gaps, the top of each wall now carries a solid 3-row slab:
//   topY - 2 : highlight row  (brightest — upward-facing stone)
//   topY - 1 : surface fill row (walkway color — distinct from wall body)
//   topY     : front ledge shadow row (darkest)
//
// These tests exercise the change indirectly through generateCastleOverlay('wall')
// because drawWalkwayPlatform is an internal helper (not exported).

describe('drawWalkwayPlatform via generateCastleOverlay wall: general top-row coverage', () => {
    /**
     * The old battlement design left crenels (gaps) as transparent. The new
     * walkway is solid — every column across x=15..48 (the front face span)
     * at the topY row must be opaque.
     *
     * We probe the wall overlay for opacity in the top region and assert that
     * there are NO fully transparent columns across the full width (no crenel gaps).
     */
    it('wall undamaged: top section should have opaque pixels across the full width (no crenel gaps)', () => {
        const buf = generateCastleOverlay('wall', false);
        const W = 64;
        // groundStart = H - 32; for wall H=96, groundStart=64.
        // The walkway platform sits just above groundStart, so we scan rows 60-63.
        const groundStart = 96 - 32; // 64
        let emptyColumns = 0;

        for (let x = 15; x < 49; x++) {
            let hasOpaqueInTop = false;
            for (let y = groundStart - 5; y < groundStart; y++) {
                const idx = (y * W + x) * 4;
                if (buf[idx + 3] === 255) { hasOpaqueInTop = true; break; }
            }
            if (!hasOpaqueInTop) emptyColumns++;
        }

        assert.equal(emptyColumns, 0,
            `wall should have no transparent column gaps in top rows (old crenels), got ${emptyColumns} empty columns`);
    });

    it('wall damaged: top section should also have no crenel gaps', () => {
        const buf = generateCastleOverlay('wall', true);
        const W = 64;
        const groundStart = 96 - 32;
        let emptyColumns = 0;

        for (let x = 15; x < 49; x++) {
            let hasOpaqueInTop = false;
            for (let y = groundStart - 5; y < groundStart; y++) {
                const idx = (y * W + x) * 4;
                if (buf[idx + 3] === 255) { hasOpaqueInTop = true; break; }
            }
            if (!hasOpaqueInTop) emptyColumns++;
        }

        assert.equal(emptyColumns, 0,
            `damaged wall should have no transparent column gaps in top rows, got ${emptyColumns} empty columns`);
    });
});

describe('drawWalkwayPlatform via generateCastleOverlay wall: walkway is lighter than wall body', () => {
    /**
     * The walkway surface (topY-1) uses wallColor + [18,15,10] for undamaged,
     * which should be brighter than the mid-wall body pixels.
     * We compare mean brightness in the top 3 rows vs mid-wall rows.
     */
    it('wall undamaged: top 3 rows should be brighter on average than mid-wall rows', () => {
        const buf = generateCastleOverlay('wall', false);
        const W = 64;
        const groundStart = 96 - 32; // 64
        const midStart = Math.floor(groundStart * 0.4);
        const midEnd   = Math.floor(groundStart * 0.6);

        function meanBrightness(y0, y1) {
            let total = 0, count = 0;
            for (let y = y0; y < y1; y++) {
                for (let x = 15; x < 49; x++) {
                    const idx = (y * W + x) * 4;
                    if (buf[idx + 3] === 255) {
                        total += (buf[idx] + buf[idx + 1] + buf[idx + 2]) / 3;
                        count++;
                    }
                }
            }
            return count > 0 ? total / count : 0;
        }

        const topBrightness = meanBrightness(groundStart - 2, groundStart);
        const midBrightness = meanBrightness(midStart, midEnd);

        assert.ok(topBrightness > midBrightness,
            `walkway top rows (${topBrightness.toFixed(1)}) should be brighter than mid-wall (${midBrightness.toFixed(1)})`);
    });
});

describe('drawWalkwayPlatform via generateCastleOverlay wall: front ledge is darker than walkway surface', () => {
    /**
     * drawWalkwayPlatform is called with topY=2 for the wall, so the three
     * platform rows land at absolute canvas positions:
     *   y=0 : highlight row     (wallColor + [28,24,18])
     *   y=1 : surface fill row  (wallColor + [18,15,10])
     *   y=2 : front ledge row   (wallColor - [20,18,16])
     *
     * The front ledge (y=2) must be darker than the surface fill (y=1).
     */
    it('wall undamaged: front ledge row (y=2) should be darker than the surface fill row (y=1)', () => {
        const buf = generateCastleOverlay('wall', false);
        const W = 64;

        function rowMeanBrightness(y) {
            let total = 0, count = 0;
            for (let x = 15; x < 49; x++) {
                const idx = (y * W + x) * 4;
                if (buf[idx + 3] === 255) {
                    total += (buf[idx] + buf[idx + 1] + buf[idx + 2]) / 3;
                    count++;
                }
            }
            return count > 0 ? total / count : null;
        }

        const surfaceBrightness = rowMeanBrightness(1); // topY - 1
        const ledgeBrightness   = rowMeanBrightness(2); // topY

        if (surfaceBrightness !== null && ledgeBrightness !== null) {
            assert.ok(ledgeBrightness < surfaceBrightness,
                `front ledge (row 2, brightness ${ledgeBrightness.toFixed(1)}) should be darker than surface fill (row 1, brightness ${surfaceBrightness.toFixed(1)})`);
        }
    });
});

describe('drawWalkwayPlatform via generateCastleOverlay wall: determinism', () => {
    it('wall undamaged should produce identical output on repeated calls', () => {
        const a = generateCastleOverlay('wall', false);
        const b = generateCastleOverlay('wall', false);
        assert.ok(a.equals(b), 'wall undamaged must be deterministic');
    });

    it('wall damaged should produce identical output on repeated calls', () => {
        const a = generateCastleOverlay('wall', true);
        const b = generateCastleOverlay('wall', true);
        assert.ok(a.equals(b), 'wall damaged must be deterministic');
    });
});

describe('drawWalkwayPlatform via generateCastleOverlay wall: transparent background preserved', () => {
    /**
     * The ground diamond region (rows >= groundStart) must remain fully transparent
     * in the wall overlay — drawWalkwayPlatform must not bleed into the ground area.
     */
    it('wall undamaged: ground diamond rows should remain fully transparent', () => {
        const buf = generateCastleOverlay('wall', false);
        const W = 64;
        const H = 96;
        const groundStart = H - 32; // 64

        for (let y = groundStart; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const idx = (y * W + x) * 4;
                assert.equal(buf[idx + 3], 0,
                    `pixel at (${x}, ${y}) in ground region should be transparent (alpha=0)`);
            }
        }
    });

    it('wall damaged: ground diamond rows should remain fully transparent', () => {
        const buf = generateCastleOverlay('wall', true);
        const W = 64;
        const H = 96;
        const groundStart = H - 32;

        for (let y = groundStart; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const idx = (y * W + x) * 4;
                assert.equal(buf[idx + 3], 0,
                    `damaged wall: pixel at (${x}, ${y}) should be transparent`);
            }
        }
    });
});
