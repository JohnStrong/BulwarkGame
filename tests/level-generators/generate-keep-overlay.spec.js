/**
 * Tests for generateKeepOverlay in generate-iso-sprites-br-tl.js.
 *
 * generateKeepOverlay(state) produces a 192×192 RGBA transparent-background
 * overlay sprite for the full castle keep. The `state` parameter accepts:
 *   'healthy'   — intact keep with towers, hall, windows, flag, and walkway
 *   'damaged'   — cracked walls, shorter windows, torn flag, crack overlay
 *   'destroyed' — rubble pile with scattered blocks and charred timber
 *
 * Canvas dimensions: 192 × 192 px (KEEP_SPRITE_WIDTH × KEEP_SPRITE_HEIGHT).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-keep-overlay.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    generateKeepOverlay,
    KEEP_SPRITE_WIDTH,
    KEEP_SPRITE_HEIGHT,
} = require('../../js/level-generators/generate-iso-sprites-br-tl');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const W = 192;
const H = 192;
const EXPECTED_BYTES = W * H * 4; // 147456

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] === 255) count++;
    }
    return count;
}

function countTransparentPixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] === 0) count++;
    }
    return count;
}

// ─── Tests: exported constants ────────────────────────────────────────────────

describe('generateKeepOverlay: KEEP_SPRITE_WIDTH / KEEP_SPRITE_HEIGHT constants', () => {
    it('KEEP_SPRITE_WIDTH should be 192', () => {
        assert.equal(KEEP_SPRITE_WIDTH, 192);
    });

    it('KEEP_SPRITE_HEIGHT should be 192', () => {
        assert.equal(KEEP_SPRITE_HEIGHT, 192);
    });

    it('KEEP_SPRITE_WIDTH × KEEP_SPRITE_HEIGHT × 4 should equal 147456 bytes', () => {
        assert.equal(KEEP_SPRITE_WIDTH * KEEP_SPRITE_HEIGHT * 4, 147456);
    });
});

// ─── Tests: buffer byte length ────────────────────────────────────────────────

describe('generateKeepOverlay: buffer byte length', () => {
    it("'healthy' state should return a buffer of 147456 bytes (192×192×4)", () => {
        const buf = generateKeepOverlay('healthy');
        assert.equal(buf.length, EXPECTED_BYTES,
            `Expected ${EXPECTED_BYTES} bytes for 'healthy', got ${buf.length}`);
    });

    it("'damaged' state should return a buffer of 147456 bytes (192×192×4)", () => {
        const buf = generateKeepOverlay('damaged');
        assert.equal(buf.length, EXPECTED_BYTES,
            `Expected ${EXPECTED_BYTES} bytes for 'damaged', got ${buf.length}`);
    });

    it("'destroyed' state should return a buffer of 147456 bytes (192×192×4)", () => {
        const buf = generateKeepOverlay('destroyed');
        assert.equal(buf.length, EXPECTED_BYTES,
            `Expected ${EXPECTED_BYTES} bytes for 'destroyed', got ${buf.length}`);
    });

    it('default state (no argument) should produce a 147456-byte buffer', () => {
        const buf = generateKeepOverlay();
        assert.equal(buf.length, EXPECTED_BYTES,
            `Expected ${EXPECTED_BYTES} bytes for default state, got ${buf.length}`);
    });
});

// ─── Tests: transparent background ───────────────────────────────────────────

describe('generateKeepOverlay: transparent background', () => {
    it("'healthy' should have some transparent pixels (non-structure areas are alpha=0)", () => {
        const buf = generateKeepOverlay('healthy');
        assert.ok(countTransparentPixels(buf) > 0,
            'healthy keep should have transparent background pixels');
    });

    it("'damaged' should have some transparent pixels", () => {
        const buf = generateKeepOverlay('damaged');
        assert.ok(countTransparentPixels(buf) > 0,
            'damaged keep should have transparent background pixels');
    });

    it("'destroyed' should have some transparent pixels", () => {
        const buf = generateKeepOverlay('destroyed');
        assert.ok(countTransparentPixels(buf) > 0,
            'destroyed keep should have transparent background pixels');
    });

    it('top-left corner pixel (0,0) should be transparent for all states', () => {
        for (const state of ['healthy', 'damaged', 'destroyed']) {
            const buf = generateKeepOverlay(state);
            assert.equal(buf[3], 0,
                `${state}: corner pixel (0,0) should be transparent (alpha=0)`);
        }
    });

    it('top-right corner pixel (191,0) should be transparent', () => {
        const buf = generateKeepOverlay('healthy');
        const idx = (0 * W + 191) * 4;
        assert.equal(buf[idx + 3], 0,
            'top-right corner should be transparent');
    });
});

// ─── Tests: opaque structure pixels ──────────────────────────────────────────

describe('generateKeepOverlay: opaque structure pixels', () => {
    it("'healthy' should have substantial opaque pixels (the keep body)", () => {
        const buf = generateKeepOverlay('healthy');
        const opaque = countOpaquePixels(buf);
        assert.ok(opaque > 5000,
            `Expected >5000 opaque pixels for healthy keep, got ${opaque}`);
    });

    it("'damaged' should have substantial opaque pixels", () => {
        const buf = generateKeepOverlay('damaged');
        const opaque = countOpaquePixels(buf);
        assert.ok(opaque > 5000,
            `Expected >5000 opaque pixels for damaged keep, got ${opaque}`);
    });

    it("'destroyed' should have substantial opaque pixels (rubble pile)", () => {
        const buf = generateKeepOverlay('destroyed');
        const opaque = countOpaquePixels(buf);
        assert.ok(opaque > 1000,
            `Expected >1000 opaque pixels for destroyed keep, got ${opaque}`);
    });

    it("'healthy' should have more opaque pixels than 'destroyed' (intact vs rubble)", () => {
        const healthy   = generateKeepOverlay('healthy');
        const destroyed = generateKeepOverlay('destroyed');
        assert.ok(
            countOpaquePixels(healthy) > countOpaquePixels(destroyed),
            'intact keep should have more opaque structure pixels than rubble'
        );
    });
});

// ─── Tests: state distinctness ────────────────────────────────────────────────

describe('generateKeepOverlay: state variants are visually distinct', () => {
    it("'healthy' and 'damaged' should not be byte-for-byte identical", () => {
        const healthy = generateKeepOverlay('healthy');
        const damaged = generateKeepOverlay('damaged');
        assert.ok(!healthy.equals(damaged),
            "'healthy' and 'damaged' should produce different sprites");
    });

    it("'healthy' and 'destroyed' should not be byte-for-byte identical", () => {
        const healthy   = generateKeepOverlay('healthy');
        const destroyed = generateKeepOverlay('destroyed');
        assert.ok(!healthy.equals(destroyed),
            "'healthy' and 'destroyed' should produce different sprites");
    });

    it("'damaged' and 'destroyed' should not be byte-for-byte identical", () => {
        const damaged   = generateKeepOverlay('damaged');
        const destroyed = generateKeepOverlay('destroyed');
        assert.ok(!damaged.equals(destroyed),
            "'damaged' and 'destroyed' should produce different sprites");
    });
});

// ─── Tests: determinism ───────────────────────────────────────────────────────

describe('generateKeepOverlay: determinism', () => {
    it("'healthy' should produce identical output on repeated calls", () => {
        const a = generateKeepOverlay('healthy');
        const b = generateKeepOverlay('healthy');
        assert.ok(a.equals(b), "'healthy' keep should be deterministic");
    });

    it("'damaged' should produce identical output on repeated calls", () => {
        const a = generateKeepOverlay('damaged');
        const b = generateKeepOverlay('damaged');
        assert.ok(a.equals(b), "'damaged' keep should be deterministic");
    });

    it("'destroyed' should produce identical output on repeated calls", () => {
        const a = generateKeepOverlay('destroyed');
        const b = generateKeepOverlay('destroyed');
        assert.ok(a.equals(b), "'destroyed' keep should be deterministic");
    });

    it('default state should match explicit healthy state', () => {
        const defaultBuf = generateKeepOverlay();
        const healthyBuf = generateKeepOverlay('healthy');
        assert.ok(defaultBuf.equals(healthyBuf),
            "default state (no arg) should produce the same output as 'healthy'");
    });
});

// ─── Tests: structure layout — healthy ───────────────────────────────────────

describe("generateKeepOverlay: 'healthy' structural layout", () => {
    /**
     * The healthy keep body spans x=16..175, y=30..(H-20).
     * The top section (y≈30) should contain opaque pixels across the wide body.
     */
    it("healthy keep body center (x=96, y=80) should be opaque", () => {
        const buf = generateKeepOverlay('healthy');
        const idx = (80 * W + 96) * 4;
        assert.equal(buf[idx + 3], 255,
            'center of the keep body should be opaque (alpha=255)');
    });

    /**
     * The walkway platform sits at y = bodyY0 = 30, with highlight at y=28 and
     * surface fill at y=29. The area around x=96, y=29 should be opaque.
     */
    it("healthy keep walkway row (y≈29) should have opaque pixels across the body width", () => {
        const buf = generateKeepOverlay('healthy');
        let opaqueInRow = 0;
        for (let x = 20; x < 170; x++) {
            const idx = (29 * W + x) * 4;
            if (buf[idx + 3] === 255) opaqueInRow++;
        }
        assert.ok(opaqueInRow > 100,
            `Expected many opaque walkway pixels at y=29, got ${opaqueInRow}`);
    });

    /**
     * Side towers are at x=16..44 (left) and x=147..175 (right).
     * The middle of the left tower column should be opaque.
     */
    it("healthy keep left tower area (x=25, y=90) should be opaque", () => {
        const buf = generateKeepOverlay('healthy');
        const idx = (90 * W + 25) * 4;
        assert.equal(buf[idx + 3], 255,
            'left tower area should be opaque in the keep structure');
    });

    it("healthy keep right tower area (x=165, y=90) should be opaque", () => {
        const buf = generateKeepOverlay('healthy');
        const idx = (90 * W + 165) * 4;
        assert.equal(buf[idx + 3], 255,
            'right tower area should be opaque in the keep structure');
    });
});

// ─── Tests: structure layout — destroyed ─────────────────────────────────────

describe("generateKeepOverlay: 'destroyed' rubble layout", () => {
    /**
     * The destroyed state draws a rubble pile in the lower 2/3 of the canvas,
     * starting at y=80. The center lower area should have opaque rubble pixels.
     */
    it("destroyed keep lower center (x=96, y=120) should be opaque (rubble)", () => {
        const buf = generateKeepOverlay('destroyed');
        const idx = (120 * W + 96) * 4;
        assert.equal(buf[idx + 3], 255,
            'center of rubble pile should be opaque');
    });

    /**
     * The rubble does not extend to the very top of the canvas (y < 80).
     * Row y=10 should be fully transparent in the destroyed state.
     */
    it("destroyed keep top rows (y=10) should be fully transparent (no structure above rubble)", () => {
        const buf = generateKeepOverlay('destroyed');
        for (let x = 0; x < W; x++) {
            const idx = (10 * W + x) * 4;
            assert.equal(buf[idx + 3], 0,
                `pixel at (${x}, 10) should be transparent in destroyed keep`);
        }
    });
});

// ─── Tests: palette compliance ────────────────────────────────────────────────

describe('generateKeepOverlay: palette compliance after quantization', () => {
    /**
     * After quantizeToPalette, every opaque pixel must exactly match one of
     * the castle palette colors (zero Euclidean distance).
     */
    it("'healthy' opaque pixels should all be on the castle palette", () => {
        const { getPaletteForCategory } = require('../../js/level-generators/lib/palette');
        const palette = getPaletteForCategory('castle');

        const buf = generateKeepOverlay('healthy');
        const total = W * H;
        let violations = 0;
        for (let i = 0; i < total; i++) {
            const idx = i * 4;
            if (buf[idx + 3] === 0) continue; // skip transparent
            const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
            const onPalette = palette.some(([pr, pg, pb]) =>
                pr === r && pg === g && pb === b
            );
            if (!onPalette) violations++;
        }
        assert.equal(violations, 0,
            `'healthy' has ${violations} opaque pixels not on the castle palette`);
    });

    it("'damaged' opaque pixels should all be on the castle palette", () => {
        const { getPaletteForCategory } = require('../../js/level-generators/lib/palette');
        const palette = getPaletteForCategory('castle');

        const buf = generateKeepOverlay('damaged');
        const total = W * H;
        let violations = 0;
        for (let i = 0; i < total; i++) {
            const idx = i * 4;
            if (buf[idx + 3] === 0) continue;
            const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
            const onPalette = palette.some(([pr, pg, pb]) =>
                pr === r && pg === g && pb === b
            );
            if (!onPalette) violations++;
        }
        assert.equal(violations, 0,
            `'damaged' has ${violations} opaque pixels not on the castle palette`);
    });

    it("'destroyed' opaque pixels should all be on the castle palette", () => {
        const { getPaletteForCategory } = require('../../js/level-generators/lib/palette');
        const palette = getPaletteForCategory('castle');

        const buf = generateKeepOverlay('destroyed');
        const total = W * H;
        let violations = 0;
        for (let i = 0; i < total; i++) {
            const idx = i * 4;
            if (buf[idx + 3] === 0) continue;
            const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
            const onPalette = palette.some(([pr, pg, pb]) =>
                pr === r && pg === g && pb === b
            );
            if (!onPalette) violations++;
        }
        assert.equal(violations, 0,
            `'destroyed' has ${violations} opaque pixels not on the castle palette`);
    });
});

// ─── Tests: ground diamond region transparency ────────────────────────────────

describe('generateKeepOverlay: ground diamond rows should remain transparent', () => {
    /**
     * The keep overlay should not draw into the ground diamond area at the
     * very bottom of the canvas (last 20 rows: y=172..191). The keep body
     * ends at bodyY1 = H - 20 = 172, so rows 172–191 must be alpha=0.
     */
    it("bottom 20 rows (y=172..191) should be fully transparent", () => {
        const buf = generateKeepOverlay('healthy');
        const groundStart = H - 20; // 172
        for (let y = groundStart; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const idx = (y * W + x) * 4;
                assert.equal(buf[idx + 3], 0,
                    `pixel at (${x}, ${y}) in ground region should be transparent`);
            }
        }
    });
});
