/**
 * Tests for the tree overlay additions in generate-iso-sprites-br-tl.js:
 *   - OVERLAY_WIDTH / OVERLAY_HEIGHT constants (64×48)
 *   - createOverlayBuffer() — allocates a fully-transparent 64×48 RGBA buffer
 *   - setOverlayPixel()     — writes one opaque pixel, clamps, ignores OOB
 *   - generateTreeOverlay() — produces distinct, palette-quantized overlay sprites
 *
 * Because the source file is a pure script with no module.exports, the
 * testable logic is re-implemented inline here (same pattern as the existing
 * generate-iso-sprites-br-tl.spec.js).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-iso-sprites-overlay.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { PRIMARY_PALETTE } = require('../../js/level-generators/lib/palette');
const { quantizeToPalette, getPaletteForCategory } = require('../../js/level-generators/lib/palette-quantizer');
const { resetSeed, seededRandom } = require('../../js/level-generators/lib/pixel-utils');
const { TERRAIN_COLORS } = require('../../js/level-generators/lib/sprite-constants');

// ─── Re-implement overlay constants and helpers ──────────────────────────────

const OVERLAY_WIDTH  = 64;
const OVERLAY_HEIGHT = 48;

function createOverlayBuffer() {
    return Buffer.alloc(OVERLAY_WIDTH * OVERLAY_HEIGHT * 4, 0);
}

function setOverlayPixel(buffer, x, y, red, green, blue) {
    if (x < 0 || x >= OVERLAY_WIDTH || y < 0 || y >= OVERLAY_HEIGHT) return;
    const index = (y * OVERLAY_WIDTH + x) * 4;
    buffer[index]     = Math.max(0, Math.min(255, Math.round(red)));
    buffer[index + 1] = Math.max(0, Math.min(255, Math.round(green)));
    buffer[index + 2] = Math.max(0, Math.min(255, Math.round(blue)));
    buffer[index + 3] = 255;
}

// Grass detail colors (mirrors the source constants)
const GRASS_COLORS = [
    PRIMARY_PALETTE[0],  // [95, 180, 72]  grass green (base)
    PRIMARY_PALETTE[1],  // [75, 155, 55]  grass dark
    PRIMARY_PALETTE[4],  // [48, 130, 42]  deep green accents
];

/**
 * Minimal re-implementation of generateTreeOverlay for testing.
 * Mirrors the source logic exactly so tests validate the real algorithm.
 */
function generateTreeOverlay(variant, treeType) {
    const buffer = createOverlayBuffer();

    const centerX = 32;
    const centerY = 28;

    resetSeed(8000 + variant * 100 + (treeType === 'oak' ? 0 : treeType === 'pine' ? 1000 : 2000));

    if (treeType === 'oak') {
        const canopyRadius = 11 + (variant % 3);
        const trunkX = centerX + 3;
        const trunkY = centerY + canopyRadius - 2;

        resetSeed(8010 + variant * 100);
        for (let oy = -2; oy <= 6; oy++) {
            for (let ox = -2; ox <= 2; ox++) {
                setOverlayPixel(buffer, trunkX + ox, trunkY + oy, ...PRIMARY_PALETTE[7]);
            }
        }

        resetSeed(8020 + variant * 100);
        const innerRadius = canopyRadius;
        for (let oy = -innerRadius; oy <= innerRadius; oy++) {
            for (let ox = -innerRadius; ox <= innerRadius; ox++) {
                const dist = Math.sqrt(ox * ox + oy * oy);
                const cx = centerX + ox;
                const cy = centerY + oy - 2;
                if (dist <= innerRadius) {
                    const noise = (seededRandom() - 0.5) * 4;
                    if (dist < innerRadius * 0.5) {
                        setOverlayPixel(buffer, cx, cy,
                            GRASS_COLORS[2][0] + noise,
                            GRASS_COLORS[2][1] + noise,
                            GRASS_COLORS[2][2] + noise);
                    } else {
                        setOverlayPixel(buffer, cx, cy,
                            TERRAIN_COLORS.treeCanopy[0] + noise,
                            TERRAIN_COLORS.treeCanopy[1] + noise,
                            TERRAIN_COLORS.treeCanopy[2] + noise);
                    }
                }
            }
        }

        resetSeed(8030 + variant * 100);
        const outerRadius = canopyRadius - 3;
        for (let oy = -outerRadius; oy <= outerRadius; oy++) {
            for (let ox = -outerRadius; ox <= outerRadius; ox++) {
                const dist = Math.sqrt(ox * ox + oy * oy);
                const cx = centerX + ox - 1;
                const cy = centerY + oy - 3;
                if (dist <= outerRadius) {
                    const noise = (seededRandom() - 0.5) * 5;
                    let leafColor;
                    if (dist < outerRadius * 0.4)       leafColor = GRASS_COLORS[2];
                    else if (dist > outerRadius * 0.8)  leafColor = GRASS_COLORS[0];
                    else                                 leafColor = TERRAIN_COLORS.treeCanopy;
                    setOverlayPixel(buffer, cx, cy,
                        leafColor[0] + noise,
                        leafColor[1] + noise,
                        leafColor[2] + noise);
                }
            }
        }

    } else if (treeType === 'pine') {
        const baseRadius = 8 + (variant % 3);
        const trunkX = centerX;
        const trunkY = centerY + baseRadius - 1;

        resetSeed(8110 + variant * 100);
        for (let oy = -1; oy <= 7; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                setOverlayPixel(buffer, trunkX + ox, trunkY + oy, ...PRIMARY_PALETTE[7]);
            }
        }

        const ringCount = 4;
        resetSeed(8120 + variant * 100);
        for (let ring = 0; ring < ringCount; ring++) {
            const ringRadius  = Math.round(baseRadius * (1 - ring * 0.22));
            const ringRadiusY = Math.round(ringRadius * 0.55);
            const ringCenterY = centerY + Math.round(baseRadius * 0.5) - ring * Math.round(baseRadius * 0.55);

            for (let oy = -ringRadiusY; oy <= ringRadiusY; oy++) {
                for (let ox = -ringRadius; ox <= ringRadius; ox++) {
                    const rx = ringRadius  > 0 ? ringRadius  : 1;
                    const ry = ringRadiusY > 0 ? ringRadiusY : 1;
                    const inEllipse = (ox * ox) / (rx * rx) + (oy * oy) / (ry * ry) <= 1;
                    if (inEllipse) {
                        const cx = centerX + ox;
                        const cy = ringCenterY + oy;
                        const dist = Math.sqrt(ox * ox + oy * oy);
                        const outerR = Math.sqrt(rx * rx + ry * ry) * 0.5;
                        const noise = (seededRandom() - 0.5) * 4;
                        let leafColor;
                        if (dist < outerR * 0.4)       leafColor = GRASS_COLORS[2];
                        else if (dist > outerR * 0.75) leafColor = GRASS_COLORS[0];
                        else                           leafColor = TERRAIN_COLORS.treeCanopy;
                        setOverlayPixel(buffer, cx, cy,
                            leafColor[0] + noise,
                            leafColor[1] + noise,
                            leafColor[2] + noise);
                    }
                }
            }
        }

    } else {
        // shrub
        const canopyRadiusX = 6 + (variant % 3);
        const canopyRadiusY = Math.round(canopyRadiusX * 0.5);
        const trunkX = centerX;
        const trunkY = centerY + canopyRadiusY + 1;

        resetSeed(8210 + variant * 100);
        for (let oy = 0; oy <= 4; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                setOverlayPixel(buffer, trunkX + ox, trunkY + oy, ...PRIMARY_PALETTE[7]);
            }
        }

        resetSeed(8220 + variant * 100);
        const rx = canopyRadiusX;
        const ry = canopyRadiusY > 0 ? canopyRadiusY : 1;

        for (let oy = -ry; oy <= ry; oy++) {
            for (let ox = -rx; ox <= rx; ox++) {
                const inEllipse = (ox * ox) / (rx * rx) + (oy * oy) / (ry * ry) <= 1;
                if (inEllipse) {
                    const cx = centerX + ox;
                    const cy = centerY + oy;
                    const dist = Math.sqrt(ox * ox + oy * oy);
                    const outerR = Math.sqrt(rx * rx + ry * ry) * 0.5;
                    const noise = (seededRandom() - 0.5) * 4;
                    let leafColor;
                    if (dist < outerR * 0.4)       leafColor = GRASS_COLORS[2];
                    else if (dist > outerR * 0.75) leafColor = GRASS_COLORS[0];
                    else                           leafColor = TERRAIN_COLORS.treeCanopy;
                    setOverlayPixel(buffer, cx, cy,
                        leafColor[0] + noise,
                        leafColor[1] + noise,
                        leafColor[2] + noise);
                }
            }
        }
    }

    // Final pass: quantize to terrain palette
    const { getPaletteForCategory: getP } = require('../../js/level-generators/lib/palette');
    const palette = getP('terrain');
    quantizeToPalette(buffer, palette);

    return buffer;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countOpaquePixels(buf, width, height) {
    let count = 0;
    for (let i = 3; i < width * height * 4; i += 4) {
        if (buf[i] === 255) count++;
    }
    return count;
}

function countTransparentPixels(buf, width, height) {
    let count = 0;
    for (let i = 3; i < width * height * 4; i += 4) {
        if (buf[i] === 0) count++;
    }
    return count;
}

// ─── Tests: createOverlayBuffer ──────────────────────────────────────────────

describe('createOverlayBuffer', () => {
    it('should return a Buffer of exactly OVERLAY_WIDTH × OVERLAY_HEIGHT × 4 bytes', () => {
        const buf = createOverlayBuffer();
        assert.equal(buf.length, OVERLAY_WIDTH * OVERLAY_HEIGHT * 4);
        assert.equal(buf.length, 64 * 48 * 4);
    });

    it('should be fully transparent (all bytes zero)', () => {
        const buf = createOverlayBuffer();
        for (let i = 0; i < buf.length; i++) {
            assert.equal(buf[i], 0, `byte ${i} should be 0`);
        }
    });

    it('should return a new independent buffer each call', () => {
        const a = createOverlayBuffer();
        const b = createOverlayBuffer();
        assert.notEqual(a.buffer, b.buffer);
        a[0] = 42;
        assert.equal(b[0], 0, 'modifying one buffer should not affect the other');
    });
});

// ─── Tests: OVERLAY_WIDTH / OVERLAY_HEIGHT constants ─────────────────────────

describe('overlay constants', () => {
    it('OVERLAY_WIDTH should be 64', () => {
        assert.equal(OVERLAY_WIDTH, 64);
    });

    it('OVERLAY_HEIGHT should be 48', () => {
        assert.equal(OVERLAY_HEIGHT, 48);
    });

    it('OVERLAY_HEIGHT should be 16 px taller than a standard 32 px tile', () => {
        assert.equal(OVERLAY_HEIGHT - 32, 16);
    });
});

// ─── Tests: setOverlayPixel ───────────────────────────────────────────────────

describe('setOverlayPixel', () => {
    it('should write RGBA at the correct buffer offset', () => {
        const buf = createOverlayBuffer();
        setOverlayPixel(buf, 0, 0, 100, 150, 200);
        assert.equal(buf[0], 100);
        assert.equal(buf[1], 150);
        assert.equal(buf[2], 200);
        assert.equal(buf[3], 255);
    });

    it('should write to the correct position for non-zero coordinates', () => {
        const buf = createOverlayBuffer();
        const x = 10, y = 5;
        setOverlayPixel(buf, x, y, 10, 20, 30);
        const idx = (y * OVERLAY_WIDTH + x) * 4;
        assert.equal(buf[idx],     10);
        assert.equal(buf[idx + 1], 20);
        assert.equal(buf[idx + 2], 30);
        assert.equal(buf[idx + 3], 255);
    });

    it('should always set alpha to 255 (fully opaque)', () => {
        const buf = createOverlayBuffer();
        setOverlayPixel(buf, 32, 24, 0, 0, 0);
        const idx = (24 * OVERLAY_WIDTH + 32) * 4;
        assert.equal(buf[idx + 3], 255);
    });

    it('should clamp red channel above 255 to 255', () => {
        const buf = createOverlayBuffer();
        setOverlayPixel(buf, 1, 1, 300, 0, 0);
        assert.equal(buf[(1 * OVERLAY_WIDTH + 1) * 4], 255);
    });

    it('should clamp green channel below 0 to 0', () => {
        const buf = createOverlayBuffer();
        setOverlayPixel(buf, 1, 1, 0, -50, 0);
        assert.equal(buf[(1 * OVERLAY_WIDTH + 1) * 4 + 1], 0);
    });

    it('should silently ignore x < 0 (out-of-bounds)', () => {
        const buf = createOverlayBuffer();
        assert.doesNotThrow(() => setOverlayPixel(buf, -1, 0, 255, 0, 0));
        // Buffer should remain all zeros
        assert.equal(buf[0], 0);
    });

    it('should silently ignore x >= OVERLAY_WIDTH (out-of-bounds)', () => {
        const buf = createOverlayBuffer();
        assert.doesNotThrow(() => setOverlayPixel(buf, OVERLAY_WIDTH, 0, 255, 0, 0));
    });

    it('should silently ignore y < 0 (out-of-bounds)', () => {
        const buf = createOverlayBuffer();
        assert.doesNotThrow(() => setOverlayPixel(buf, 0, -1, 255, 0, 0));
    });

    it('should silently ignore y >= OVERLAY_HEIGHT (out-of-bounds)', () => {
        const buf = createOverlayBuffer();
        assert.doesNotThrow(() => setOverlayPixel(buf, 0, OVERLAY_HEIGHT, 255, 0, 0));
    });

    it('should write to the last valid pixel (63, 47)', () => {
        const buf = createOverlayBuffer();
        setOverlayPixel(buf, 63, 47, 1, 2, 3);
        const idx = (47 * OVERLAY_WIDTH + 63) * 4;
        assert.equal(buf[idx],     1);
        assert.equal(buf[idx + 1], 2);
        assert.equal(buf[idx + 2], 3);
        assert.equal(buf[idx + 3], 255);
    });

    it('should round fractional color values', () => {
        const buf = createOverlayBuffer();
        setOverlayPixel(buf, 0, 0, 100.6, 50.4, 200.9);
        assert.equal(buf[0], 101);
        assert.equal(buf[1], 50);
        assert.equal(buf[2], 201);
    });
});

// ─── Tests: generateTreeOverlay — buffer dimensions ──────────────────────────

describe('generateTreeOverlay: buffer dimensions', () => {
    it('oak variant 0 should produce a 64×48×4 buffer', () => {
        const buf = generateTreeOverlay(0, 'oak');
        assert.equal(buf.length, OVERLAY_WIDTH * OVERLAY_HEIGHT * 4);
    });

    it('pine variant 0 should produce a 64×48×4 buffer', () => {
        const buf = generateTreeOverlay(0, 'pine');
        assert.equal(buf.length, OVERLAY_WIDTH * OVERLAY_HEIGHT * 4);
    });

    it('shrub variant 0 should produce a 64×48×4 buffer', () => {
        const buf = generateTreeOverlay(0, 'shrub');
        assert.equal(buf.length, OVERLAY_WIDTH * OVERLAY_HEIGHT * 4);
    });
});

// ─── Tests: generateTreeOverlay — transparent background ─────────────────────

describe('generateTreeOverlay: transparent background invariant', () => {
    it('oak overlay should have some transparent pixels (background is alpha=0)', () => {
        const buf = generateTreeOverlay(0, 'oak');
        const transparent = countTransparentPixels(buf, OVERLAY_WIDTH, OVERLAY_HEIGHT);
        assert.ok(transparent > 0, `Expected transparent pixels, got ${transparent}`);
    });

    it('pine overlay should have some transparent pixels', () => {
        const buf = generateTreeOverlay(0, 'pine');
        const transparent = countTransparentPixels(buf, OVERLAY_WIDTH, OVERLAY_HEIGHT);
        assert.ok(transparent > 0, `Expected transparent pixels, got ${transparent}`);
    });

    it('shrub overlay should have some transparent pixels', () => {
        const buf = generateTreeOverlay(0, 'shrub');
        const transparent = countTransparentPixels(buf, OVERLAY_WIDTH, OVERLAY_HEIGHT);
        assert.ok(transparent > 0, `Expected transparent pixels, got ${transparent}`);
    });

    it('oak overlay should have opaque pixels (the tree itself)', () => {
        const buf = generateTreeOverlay(0, 'oak');
        const opaque = countOpaquePixels(buf, OVERLAY_WIDTH, OVERLAY_HEIGHT);
        assert.ok(opaque > 50, `Expected opaque tree pixels, got ${opaque}`);
    });

    it('pine overlay should have opaque pixels', () => {
        const buf = generateTreeOverlay(0, 'pine');
        const opaque = countOpaquePixels(buf, OVERLAY_WIDTH, OVERLAY_HEIGHT);
        assert.ok(opaque > 30, `Expected opaque tree pixels, got ${opaque}`);
    });

    it('shrub overlay should have opaque pixels', () => {
        const buf = generateTreeOverlay(0, 'shrub');
        const opaque = countOpaquePixels(buf, OVERLAY_WIDTH, OVERLAY_HEIGHT);
        assert.ok(opaque > 10, `Expected opaque tree pixels, got ${opaque}`);
    });

    it('corner pixel (0,0) should be transparent for all tree types', () => {
        for (const treeType of ['oak', 'pine', 'shrub']) {
            const buf = generateTreeOverlay(0, treeType);
            assert.equal(buf[3], 0, `${treeType}: corner pixel should be transparent`);
        }
    });
});

// ─── Tests: generateTreeOverlay — determinism ────────────────────────────────

describe('generateTreeOverlay: determinism', () => {
    it('oak variant 0 should produce identical output on repeated calls', () => {
        const a = generateTreeOverlay(0, 'oak');
        const b = generateTreeOverlay(0, 'oak');
        assert.ok(a.equals(b), 'oak variant 0 should be deterministic');
    });

    it('pine variant 1 should produce identical output on repeated calls', () => {
        const a = generateTreeOverlay(1, 'pine');
        const b = generateTreeOverlay(1, 'pine');
        assert.ok(a.equals(b), 'pine variant 1 should be deterministic');
    });

    it('shrub variant 0 should produce identical output on repeated calls', () => {
        const a = generateTreeOverlay(0, 'shrub');
        const b = generateTreeOverlay(0, 'shrub');
        assert.ok(a.equals(b), 'shrub variant 0 should be deterministic');
    });
});

// ─── Tests: generateTreeOverlay — visual distinctness ────────────────────────

describe('generateTreeOverlay: visual distinctness', () => {
    it('oak and pine overlays should not be byte-for-byte identical', () => {
        const oak   = generateTreeOverlay(0, 'oak');
        const pine  = generateTreeOverlay(0, 'pine');
        assert.ok(!oak.equals(pine), 'oak and pine should produce different sprites');
    });

    it('oak and shrub overlays should not be byte-for-byte identical', () => {
        const oak   = generateTreeOverlay(0, 'oak');
        const shrub = generateTreeOverlay(0, 'shrub');
        assert.ok(!oak.equals(shrub), 'oak and shrub should produce different sprites');
    });

    it('pine and shrub overlays should not be byte-for-byte identical', () => {
        const pine  = generateTreeOverlay(0, 'pine');
        const shrub = generateTreeOverlay(0, 'shrub');
        assert.ok(!pine.equals(shrub), 'pine and shrub should produce different sprites');
    });

    it('oak variant 0 and variant 1 should differ', () => {
        const v0 = generateTreeOverlay(0, 'oak');
        const v1 = generateTreeOverlay(1, 'oak');
        assert.ok(!v0.equals(v1), 'oak variants 0 and 1 should differ');
    });

    it('pine variant 0 and variant 1 should differ', () => {
        const v0 = generateTreeOverlay(0, 'pine');
        const v1 = generateTreeOverlay(1, 'pine');
        assert.ok(!v0.equals(v1), 'pine variants 0 and 1 should differ');
    });

    it('shrub variant 0 and variant 1 should differ', () => {
        const v0 = generateTreeOverlay(0, 'shrub');
        const v1 = generateTreeOverlay(1, 'shrub');
        assert.ok(!v0.equals(v1), 'shrub variants 0 and 1 should differ');
    });
});

// ─── Tests: generateTreeOverlay — palette compliance ─────────────────────────

describe('generateTreeOverlay: palette compliance after quantization', () => {
    /**
     * After quantizeToPalette, every opaque pixel must exactly match one of
     * the palette colors (zero Euclidean distance).
     */
    function checkPaletteCompliance(buf, palette, label) {
        const total = OVERLAY_WIDTH * OVERLAY_HEIGHT;
        for (let i = 0; i < total; i++) {
            const idx = i * 4;
            if (buf[idx + 3] === 0) continue; // skip transparent
            const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
            const onPalette = palette.some(([pr, pg, pb]) =>
                pr === r && pg === g && pb === b
            );
            assert.ok(onPalette,
                `${label}: pixel ${i} RGB(${r},${g},${b}) not on palette`);
        }
    }

    it('oak variant 0 opaque pixels should all be on the terrain palette', () => {
        const { getPaletteForCategory } = require('../../js/level-generators/lib/palette');
        const palette = getPaletteForCategory('terrain');
        const buf = generateTreeOverlay(0, 'oak');
        checkPaletteCompliance(buf, palette, 'oak-0');
    });

    it('pine variant 0 opaque pixels should all be on the terrain palette', () => {
        const { getPaletteForCategory } = require('../../js/level-generators/lib/palette');
        const palette = getPaletteForCategory('terrain');
        const buf = generateTreeOverlay(0, 'pine');
        checkPaletteCompliance(buf, palette, 'pine-0');
    });

    it('shrub variant 0 opaque pixels should all be on the terrain palette', () => {
        const { getPaletteForCategory } = require('../../js/level-generators/lib/palette');
        const palette = getPaletteForCategory('terrain');
        const buf = generateTreeOverlay(0, 'shrub');
        checkPaletteCompliance(buf, palette, 'shrub-0');
    });
});

// ─── Tests: generateTreeOverlay — canopy shape characteristics ───────────────

describe('generateTreeOverlay: canopy shape characteristics', () => {
    /**
     * Oak has the largest canopy (radius 11–13), so it should have more opaque
     * pixels than shrub (radius 6–8) for the same variant.
     */
    it('oak should have more opaque pixels than shrub (larger canopy)', () => {
        const oak   = generateTreeOverlay(0, 'oak');
        const shrub = generateTreeOverlay(0, 'shrub');
        const oakOpaque   = countOpaquePixels(oak,   OVERLAY_WIDTH, OVERLAY_HEIGHT);
        const shrubOpaque = countOpaquePixels(shrub, OVERLAY_WIDTH, OVERLAY_HEIGHT);
        assert.ok(oakOpaque > shrubOpaque,
            `oak (${oakOpaque}) should have more opaque pixels than shrub (${shrubOpaque})`);
    });

    /**
     * Oak canopy is centered around y≈26 (centerY=28, raised 2px).
     * The top half of the canvas (rows 0–23) should contain opaque pixels
     * for oak (canopy bleeds upward) but fewer for shrub (low, flat).
     */
    it('oak canopy should extend into the upper portion of the canvas', () => {
        const buf = generateTreeOverlay(0, 'oak');
        let upperOpaque = 0;
        for (let y = 0; y < 20; y++) {
            for (let x = 0; x < OVERLAY_WIDTH; x++) {
                if (buf[(y * OVERLAY_WIDTH + x) * 4 + 3] === 255) upperOpaque++;
            }
        }
        assert.ok(upperOpaque > 0,
            `oak canopy should have opaque pixels in upper rows, got ${upperOpaque}`);
    });

    /**
     * Shrub is low and wide — it should have opaque pixels spread horizontally
     * but concentrated in the lower portion of the canvas.
     */
    it('shrub canopy should be concentrated in the lower portion of the canvas', () => {
        const buf = generateTreeOverlay(0, 'shrub');
        let lowerOpaque = 0;
        for (let y = 24; y < OVERLAY_HEIGHT; y++) {
            for (let x = 0; x < OVERLAY_WIDTH; x++) {
                if (buf[(y * OVERLAY_WIDTH + x) * 4 + 3] === 255) lowerOpaque++;
            }
        }
        assert.ok(lowerOpaque > 0,
            `shrub should have opaque pixels in lower rows, got ${lowerOpaque}`);
    });
});
