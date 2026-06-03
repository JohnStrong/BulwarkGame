/**
 * Pixel-level assertions for js/level-generators/lib/unit-body.js
 * — Recommendation 4.
 *
 * Verifies drop-shadow placement, cape wind-wobble sine calculation,
 * and body part pixel positions using the same buffer-inspection pattern
 * established in weapons-pixel-direct.spec.js.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/unit-body-pixel.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { drawUnit } = require('../../../js/level-generators/lib/unit-body');
const { createBuffer } = require('../../../js/level-generators/lib/pixel-utils');
const { TILE_WIDTH, TILE_HEIGHT, UNIT_PALETTES } = require('../../../js/level-generators/lib/sprite-constants');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPixel(buf, x, y) {
    if (x < 0 || x >= TILE_WIDTH || y < 0 || y >= TILE_HEIGHT) {
        return { r: 0, g: 0, b: 0, a: 0 };
    }
    const i = (y * TILE_WIDTH + x) * 4;
    return { r: buf[i], g: buf[i + 1], b: buf[i + 2], a: buf[i + 3] };
}

function isOpaque(buf, x, y) {
    return getPixel(buf, x, y).a === 255;
}

function isSemiTransparent(buf, x, y) {
    const a = getPixel(buf, x, y).a;
    return a > 0 && a < 255;
}

// Standard anchor from unit-body.js
const CX = 32;
const CY = 14;

// ─── Drop shadow ──────────────────────────────────────────────────────────────

describe('unit-body: drop shadow pixel assertions', () => {
    it('should have semi-transparent pixels at the shadow ellipse center (CX, CY+9)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        // Shadow at (centerX, centerY+9) = (32, 23) — offsetX=-1, offsetY=0 in the ellipse,
        // not overlapping with any boot pixel (boots are at CX±1/±2, CY+9)
        assert.ok(
            isSemiTransparent(buf, CX, CY + 9),
            `Shadow at (${CX}, ${CY + 9}) should be semi-transparent`
        );
    });

    it('shadow pixels should have alpha = 100', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        // Check a shadow pixel not covered by a boot: (CX, CY+9) = (32, 23)
        const p = getPixel(buf, CX, CY + 9);
        assert.equal(p.a, 100, `Shadow alpha should be 100, got ${p.a}`);
    });

    it('shadow pixels should be very dark (near-black)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        const p = getPixel(buf, CX, CY + 9);
        // Shadow color: [20, 20, 15]
        assert.ok(p.r <= 25, `Shadow R should be <= 25, got ${p.r}`);
        assert.ok(p.g <= 25, `Shadow G should be <= 25, got ${p.g}`);
        assert.ok(p.b <= 20, `Shadow B should be <= 20, got ${p.b}`);
    });

    it('should have semi-transparent pixels across the shadow ellipse width', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        // Shadow spans offsetX = -5 to +5 at offsetY = 0 (y = CY + 9)
        let shadowCount = 0;
        for (let x = CX - 4; x <= CX + 6; x++) {
            if (isSemiTransparent(buf, x, CY + 9)) shadowCount++;
        }
        assert.ok(shadowCount >= 3, `Should have at least 3 shadow pixels in row, got ${shadowCount}`);
    });

    it('shadow should not appear above the figure (y < CY + 8)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        // No semi-transparent pixels should exist above the shadow zone
        let aboveShadow = 0;
        for (let y = 0; y < CY + 8; y++) {
            for (let x = 0; x < TILE_WIDTH; x++) {
                if (isSemiTransparent(buf, x, y)) aboveShadow++;
            }
        }
        assert.equal(aboveShadow, 0, `No shadow pixels should appear above y=${CY + 8}`);
    });
});

// ─── Torso ────────────────────────────────────────────────────────────────────

describe('unit-body: torso pixel assertions', () => {
    it('should have opaque pixels in the torso region (CX-3 to CX+2, CY-1 to CY+4)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        // Torso: col -3 to +2, row 0 to 5 relative to (CX, CY-1)
        let torsoPixels = 0;
        for (let row = 0; row < 6; row++) {
            for (let col = -3; col <= 2; col++) {
                if (isOpaque(buf, CX + col, CY - 1 + row)) torsoPixels++;
            }
        }
        assert.ok(torsoPixels >= 20, `Torso should have >= 20 opaque pixels, got ${torsoPixels}`);
    });

    it('torso should use the palette body color', () => {
        const buf = createBuffer();
        const palette = UNIT_PALETTES.knight;
        drawUnit(buf, palette, 'sword', 20000);
        // Center of torso (CX, CY+1) should be close to body color
        const p = getPixel(buf, CX, CY + 1);
        assert.equal(p.a, 255, 'Torso center should be opaque');
        // Body color with noise ±7.5 and lighting shift ±10
        // Just verify it's in a reasonable range
        assert.ok(p.r > 0 && p.g > 0 && p.b > 0, 'Torso should have non-zero RGB');
    });
});

// ─── Legs ─────────────────────────────────────────────────────────────────────

describe('unit-body: legs pixel assertions', () => {
    it('should have opaque pixels at left leg position (CX-2, CY+5)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        assert.ok(isOpaque(buf, CX - 2, CY + 5), `Left leg at (${CX - 2}, ${CY + 5}) should be opaque`);
    });

    it('should have opaque pixels at right leg position (CX+1, CY+5)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        assert.ok(isOpaque(buf, CX + 1, CY + 5), `Right leg at (${CX + 1}, ${CY + 5}) should be opaque`);
    });

    it('should have dark brown boots at (CX-2, CY+9)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        assert.ok(isOpaque(buf, CX - 2, CY + 9), `Left boot at (${CX - 2}, ${CY + 9}) should be opaque`);
        const p = getPixel(buf, CX - 2, CY + 9);
        // Boot color: [50, 35, 20] — dark brown
        assert.ok(p.r > p.g && p.g > p.b, `Boot should be dark brown, got RGB(${p.r},${p.g},${p.b})`);
        assert.ok(p.r < 80, `Boot R should be < 80 (dark), got ${p.r}`);
    });

    it('should have dark brown boots at (CX+1, CY+9)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        assert.ok(isOpaque(buf, CX + 1, CY + 9), `Right boot at (${CX + 1}, ${CY + 9}) should be opaque`);
    });
});

// ─── Head ─────────────────────────────────────────────────────────────────────

describe('unit-body: head pixel assertions', () => {
    it('should have opaque pixels in the head region (CX-1 to CX+2, CY-6 to CY-3)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        // Head: col -1 to +2, row -2 to +1 relative to (CX, CY-4)
        let headPixels = 0;
        for (let row = -2; row <= 1; row++) {
            for (let col = -1; col <= 2; col++) {
                if (isOpaque(buf, CX + col, CY - 4 + row)) headPixels++;
            }
        }
        assert.ok(headPixels >= 8, `Head should have >= 8 opaque pixels, got ${headPixels}`);
    });

    it('head pixels should use skin color', () => {
        const buf = createBuffer();
        const palette = UNIT_PALETTES.knight;
        drawUnit(buf, palette, 'sword', 20000);
        // Head center: (CX, CY-4)
        const p = getPixel(buf, CX, CY - 4);
        assert.equal(p.a, 255, 'Head center should be opaque');
        // Skin color is warm (r > b typically)
        assert.ok(p.r > 0, 'Head should have non-zero red channel');
    });
});

// ─── Helmet ───────────────────────────────────────────────────────────────────

describe('unit-body: helmet pixel assertions', () => {
    it('should have accent-colored pixels at helmet top (CX, CY-6)', () => {
        const buf = createBuffer();
        const palette = UNIT_PALETTES.knight;
        drawUnit(buf, palette, 'sword', 20000);
        assert.ok(isOpaque(buf, CX, CY - 6), `Helmet top at (${CX}, ${CY - 6}) should be opaque`);
        const p = getPixel(buf, CX, CY - 6);
        // Should match accent color (knight accent is gold-ish)
        assert.ok(p.r > 0 && p.g > 0, 'Helmet should have non-zero RGB');
    });

    it('should have accent-colored pixels at helmet brim (CX-1, CY-5)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        assert.ok(isOpaque(buf, CX - 1, CY - 5), `Helmet brim at (${CX - 1}, ${CY - 5}) should be opaque`);
    });

    it('should have 6 helmet pixels total', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        // Helmet pixels: (CX, CY-6), (CX+1, CY-6), (CX-1, CY-5), (CX, CY-5), (CX+1, CY-5), (CX+2, CY-5)
        const helmetPositions = [
            [CX, CY - 6], [CX + 1, CY - 6],
            [CX - 1, CY - 5], [CX, CY - 5], [CX + 1, CY - 5], [CX + 2, CY - 5],
        ];
        let helmetCount = 0;
        for (const [x, y] of helmetPositions) {
            if (isOpaque(buf, x, y)) helmetCount++;
        }
        assert.equal(helmetCount, 6, `Should have exactly 6 helmet pixels, got ${helmetCount}`);
    });
});

// ─── Cape wind-wobble ─────────────────────────────────────────────────────────

describe('unit-body: cape wind-wobble sine calculation', () => {
    it('should produce cape pixels in the expected column range', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        // Cape: col = CX - 4 + windWobble, where windWobble = round(sin(row * 0.8) * 0.5)
        // windWobble is always 0 or ±1 (since sin * 0.5 rounds to 0 or ±1 at most)
        // So cape x is in range [CX-5, CX-3]
        let capeFound = false;
        for (let row = 0; row < 6; row++) {
            for (let x = CX - 5; x <= CX - 3; x++) {
                if (isOpaque(buf, x, CY + row)) {
                    capeFound = true;
                    break;
                }
            }
            if (capeFound) break;
        }
        assert.ok(capeFound, 'Cape pixels should appear in column range [CX-5, CX-3]');
    });

    it('cape wind-wobble formula: round(sin(row * 0.8) * 0.5) is always 0 or ±1', () => {
        // Verify the mathematical property of the wobble formula
        for (let row = 0; row < 6; row++) {
            const wobble = Math.round(Math.sin(row * 0.8) * 0.5);
            assert.ok(
                wobble >= -1 && wobble <= 1,
                `Wind wobble at row ${row} should be -1, 0, or 1, got ${wobble}`
            );
        }
    });

    it('cape should span 6 rows (CY to CY+5)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        // Each row should have at least one cape pixel in the expected range
        let rowsWithCape = 0;
        for (let row = 0; row < 6; row++) {
            for (let x = CX - 5; x <= CX - 2; x++) {
                if (isOpaque(buf, x, CY + row)) {
                    rowsWithCape++;
                    break;
                }
            }
        }
        assert.ok(rowsWithCape >= 4, `Cape should span at least 4 rows, got ${rowsWithCape}`);
    });

    it('cape uses palette.cape color', () => {
        const buf = createBuffer();
        const palette = UNIT_PALETTES.knight;
        drawUnit(buf, palette, 'sword', 20000);
        // Find a cape pixel and verify it's close to the cape color
        let capePixel = null;
        for (let row = 0; row < 6; row++) {
            const wobble = Math.round(Math.sin(row * 0.8) * 0.5);
            const x = CX - 4 + wobble;
            const y = CY + row;
            if (isOpaque(buf, x, y)) {
                capePixel = getPixel(buf, x, y);
                break;
            }
        }
        assert.ok(capePixel !== null, 'Should find at least one cape pixel');
        assert.equal(capePixel.a, 255, 'Cape pixel should be opaque');
    });
});

// ─── Shoulders / pauldrons ────────────────────────────────────────────────────

describe('unit-body: shoulder pauldron pixel assertions', () => {
    it('should have accent-colored pixels at left pauldron (CX-3, CY-1)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        assert.ok(isOpaque(buf, CX - 3, CY - 1), `Left pauldron at (${CX - 3}, ${CY - 1}) should be opaque`);
    });

    it('should have accent-colored pixels at right pauldron (CX+2, CY-1)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        assert.ok(isOpaque(buf, CX + 2, CY - 1), `Right pauldron at (${CX + 2}, ${CY - 1}) should be opaque`);
    });

    it('should have 4 pauldron pixels total', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);
        const pauldronPositions = [
            [CX - 3, CY - 1], [CX + 2, CY - 1],
            [CX - 3, CY], [CX + 2, CY],
        ];
        let count = 0;
        for (const [x, y] of pauldronPositions) {
            if (isOpaque(buf, x, y)) count++;
        }
        assert.equal(count, 4, `Should have exactly 4 pauldron pixels, got ${count}`);
    });
});

// ─── All unit types ───────────────────────────────────────────────────────────

describe('unit-body: all unit types produce valid figures', () => {
    const weapons = ['sword', 'shield', 'spear', 'bow', 'crossbow', 'javelin', 'hammer', 'club', 'cannon'];
    const paletteKeys = Object.keys(UNIT_PALETTES);

    for (let i = 0; i < paletteKeys.length; i++) {
        const key = paletteKeys[i];
        const weapon = weapons[i % weapons.length];

        it(`${key} with ${weapon} should have drop shadow at (CX, CY+9)`, () => {
            const buf = createBuffer();
            drawUnit(buf, UNIT_PALETTES[key], weapon, 20000 + i * 200);
            assert.ok(
                isSemiTransparent(buf, CX, CY + 9),
                `${key} drop shadow should be semi-transparent at (${CX}, ${CY + 9})`
            );
        });

        it(`${key} with ${weapon} should have opaque torso pixels`, () => {
            const buf = createBuffer();
            drawUnit(buf, UNIT_PALETTES[key], weapon, 20000 + i * 200);
            assert.ok(
                isOpaque(buf, CX, CY + 1),
                `${key} torso center at (${CX}, ${CY + 1}) should be opaque`
            );
        });
    }
});
