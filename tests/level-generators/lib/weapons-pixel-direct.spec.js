/**
 * Direct pixel-level tests for each individual draw* function in
 * js/level-generators/lib/weapons.js.
 *
 * Each test calls the function with a zeroed buffer and asserts that
 * at least one pixel was written at the expected position, verifying
 * the deterministic coordinate logic documented in each function's JSDoc.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/weapons-pixel-direct.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    drawSword,
    drawSpear,
    drawBow,
    drawCrossbow,
    drawJavelin,
    drawHammer,
    drawShield,
    drawCannon,
    drawClub,
} = require('../../../js/level-generators/lib/weapons');

const { createBuffer, resetSeed } = require('../../../js/level-generators/lib/pixel-utils');
const { TILE_WIDTH, TILE_HEIGHT } = require('../../../js/level-generators/lib/sprite-constants');

// Standard anchor used by unit-body.js
const CX = 32;
const CY = 14;

// ─── Helper ───────────────────────────────────────────────────────────────────

function isOpaque(buf, x, y) {
    if (x < 0 || x >= TILE_WIDTH || y < 0 || y >= TILE_HEIGHT) return false;
    return buf[(y * TILE_WIDTH + x) * 4 + 3] === 255;
}

function getPixelRGB(buf, x, y) {
    const i = (y * TILE_WIDTH + x) * 4;
    return [buf[i], buf[i + 1], buf[i + 2]];
}

// ─── drawSword ────────────────────────────────────────────────────────────────

describe('drawSword: pixel-level assertions', () => {
    it('should draw a silver blade pixel at (CX+4, CY-3) — top of blade', () => {
        const buf = createBuffer();
        drawSword(buf, CX, CY);
        // Blade starts at centerY - 3, row 0 of the 8-row loop
        assert.ok(isOpaque(buf, CX + 4, CY - 3), 'Blade pixel at CX+4, CY-3 should be opaque');
        const [r, g, b] = getPixelRGB(buf, CX + 4, CY - 3);
        // Silver: [190, 190, 195] — all channels should be high and close together
        assert.ok(r > 150 && g > 150 && b > 150, `Blade should be silver-ish, got RGB(${r},${g},${b})`);
    });

    it('should draw the gold crossguard at (CX+3, CY-3)', () => {
        const buf = createBuffer();
        drawSword(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 3, CY - 3), 'Crossguard pixel at CX+3, CY-3 should be opaque');
        const [r, g, b] = getPixelRGB(buf, CX + 3, CY - 3);
        // Gold: [200, 170, 50] — red > green > blue
        assert.ok(r > g && g > b, `Crossguard should be gold-ish, got RGB(${r},${g},${b})`);
    });

    it('should draw the brown grip at (CX+4, CY+1)', () => {
        const buf = createBuffer();
        drawSword(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 4, CY + 1), 'Grip pixel at CX+4, CY+1 should be opaque');
        const [r, g, b] = getPixelRGB(buf, CX + 4, CY + 1);
        // Brown: [80, 55, 30] — red > green > blue, all low
        assert.ok(r > g && g > b, `Grip should be brown-ish, got RGB(${r},${g},${b})`);
    });

    it('should draw the full 8-row blade (CX+4, CY-3 through CY-10)', () => {
        const buf = createBuffer();
        drawSword(buf, CX, CY);
        for (let row = 0; row < 8; row++) {
            assert.ok(
                isOpaque(buf, CX + 4, CY - 3 - row),
                `Blade row ${row} at (CX+4, CY-3-${row}) should be opaque`
            );
        }
    });
});

// ─── drawSpear ────────────────────────────────────────────────────────────────

describe('drawSpear: pixel-level assertions', () => {
    it('should draw the wooden shaft at (CX+3, CY-8) — top of shaft', () => {
        const buf = createBuffer();
        drawSpear(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 3, CY - 8), 'Shaft top at CX+3, CY-8 should be opaque');
        const [r, g, b] = getPixelRGB(buf, CX + 3, CY - 8);
        // Wood: [110, 80, 40] — warm brown
        assert.ok(r > g && g > b, `Shaft should be wood-brown, got RGB(${r},${g},${b})`);
    });

    it('should draw the silver spearhead at (CX+3, CY-9)', () => {
        const buf = createBuffer();
        drawSpear(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 3, CY - 9), 'Spearhead at CX+3, CY-9 should be opaque');
        const [r, g, b] = getPixelRGB(buf, CX + 3, CY - 9);
        // Silver: [185, 185, 190]
        assert.ok(r > 150 && g > 150 && b > 150, `Spearhead should be silver, got RGB(${r},${g},${b})`);
    });

    it('should draw the full 14-row shaft', () => {
        const buf = createBuffer();
        drawSpear(buf, CX, CY);
        for (let row = 0; row < 14; row++) {
            assert.ok(
                isOpaque(buf, CX + 3, CY - 8 + row),
                `Shaft row ${row} at (CX+3, CY-8+${row}) should be opaque`
            );
        }
    });
});

// ─── drawBow ──────────────────────────────────────────────────────────────────

describe('drawBow: pixel-level assertions', () => {
    it('should draw the bowstring at (CX-4, CY-4) — top of string', () => {
        const buf = createBuffer();
        drawBow(buf, CX, CY);
        assert.ok(isOpaque(buf, CX - 4, CY - 4), 'Bowstring top at CX-4, CY-4 should be opaque');
    });

    it('should draw the nocked arrow at (CX+2, CY-1)', () => {
        const buf = createBuffer();
        drawBow(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 2, CY - 1), 'Arrow start at CX+2, CY-1 should be opaque');
    });

    it('should draw the silver arrowhead at (CX+8, CY-1)', () => {
        const buf = createBuffer();
        drawBow(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 8, CY - 1), 'Arrowhead at CX+8, CY-1 should be opaque');
        const [r, g, b] = getPixelRGB(buf, CX + 8, CY - 1);
        // Silver: [160, 160, 165]
        assert.ok(r > 130 && g > 130 && b > 130, `Arrowhead should be silver, got RGB(${r},${g},${b})`);
    });
});

// ─── drawCrossbow ─────────────────────────────────────────────────────────────

describe('drawCrossbow: pixel-level assertions', () => {
    it('should draw the crossbar at (CX-4, CY+1) — left end', () => {
        const buf = createBuffer();
        drawCrossbow(buf, CX, CY);
        assert.ok(isOpaque(buf, CX - 4, CY + 1), 'Left crossbar end at CX-4, CY+1 should be opaque');
    });

    it('should draw the crossbar at (CX+4, CY+1) — right end', () => {
        const buf = createBuffer();
        drawCrossbow(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 4, CY + 1), 'Right crossbar end at CX+4, CY+1 should be opaque');
    });

    it('should draw the bolt at (CX, CY)', () => {
        const buf = createBuffer();
        drawCrossbow(buf, CX, CY);
        assert.ok(isOpaque(buf, CX, CY), 'Bolt at CX, CY should be opaque');
    });
});

// ─── drawJavelin ──────────────────────────────────────────────────────────────

describe('drawJavelin: pixel-level assertions', () => {
    it('should draw the shaft at (CX+4, CY-4) — top of shaft', () => {
        const buf = createBuffer();
        drawJavelin(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 4, CY - 4), 'Javelin shaft top at CX+4, CY-4 should be opaque');
    });

    it('should draw the silver tip at (CX+4, CY-5)', () => {
        const buf = createBuffer();
        drawJavelin(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 4, CY - 5), 'Javelin tip at CX+4, CY-5 should be opaque');
        const [r, g, b] = getPixelRGB(buf, CX + 4, CY - 5);
        assert.ok(r > 150 && g > 150 && b > 150, `Tip should be silver, got RGB(${r},${g},${b})`);
    });

    it('should draw the full 7-row shaft', () => {
        const buf = createBuffer();
        drawJavelin(buf, CX, CY);
        for (let row = 0; row < 7; row++) {
            assert.ok(
                isOpaque(buf, CX + 4, CY - 4 + row),
                `Javelin shaft row ${row} at (CX+4, CY-4+${row}) should be opaque`
            );
        }
    });
});

// ─── drawHammer ───────────────────────────────────────────────────────────────

describe('drawHammer: pixel-level assertions', () => {
    it('should draw the handle at (CX+4, CY-1) — top of handle', () => {
        const buf = createBuffer();
        drawHammer(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 4, CY - 1), 'Hammer handle top at CX+4, CY-1 should be opaque');
    });

    it('should draw the hammerhead at (CX+4, CY-2) — center of head', () => {
        const buf = createBuffer();
        drawHammer(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 4, CY - 2), 'Hammerhead center at CX+4, CY-2 should be opaque');
        const [r, g, b] = getPixelRGB(buf, CX + 4, CY - 2);
        // Grey iron: [150, 150, 150]
        assert.ok(r > 100 && g > 100 && b > 100, `Hammerhead should be grey, got RGB(${r},${g},${b})`);
    });

    it('should draw the hammerhead width at (CX+3, CY-2) and (CX+5, CY-2)', () => {
        const buf = createBuffer();
        drawHammer(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 3, CY - 2), 'Left hammerhead at CX+3, CY-2 should be opaque');
        assert.ok(isOpaque(buf, CX + 5, CY - 2), 'Right hammerhead at CX+5, CY-2 should be opaque');
    });
});

// ─── drawShield ───────────────────────────────────────────────────────────────

describe('drawShield: pixel-level assertions', () => {
    it('should draw the shield face at (CX-5, CY) — left edge', () => {
        const buf = createBuffer();
        resetSeed(100);
        const palette = { accent: [200, 170, 50] };
        drawShield(buf, CX, CY, palette);
        assert.ok(isOpaque(buf, CX - 5, CY), 'Shield left edge at CX-5, CY should be opaque');
    });

    it('should draw the gold boss at (CX-4, CY)', () => {
        const buf = createBuffer();
        resetSeed(100);
        const palette = { accent: [200, 170, 50] };
        drawShield(buf, CX, CY, palette);
        assert.ok(isOpaque(buf, CX - 4, CY), 'Shield boss at CX-4, CY should be opaque');
        const [r, g, b] = getPixelRGB(buf, CX - 4, CY);
        // Gold boss: [220, 200, 80] — red > green > blue
        assert.ok(r > g && g > b, `Shield boss should be gold, got RGB(${r},${g},${b})`);
    });

    it('should draw the shield spanning 7 rows (CY-3 to CY+3)', () => {
        const buf = createBuffer();
        resetSeed(100);
        const palette = { accent: [200, 170, 50] };
        drawShield(buf, CX, CY, palette);
        for (let row = -3; row <= 3; row++) {
            assert.ok(
                isOpaque(buf, CX - 5, CY + row),
                `Shield row at (CX-5, CY+${row}) should be opaque`
            );
        }
    });
});

// ─── drawCannon ───────────────────────────────────────────────────────────────

describe('drawCannon: pixel-level assertions', () => {
    it('should draw the barrel at (CX, CY+7) — bottom of barrel', () => {
        const buf = createBuffer();
        drawCannon(buf, CX, CY);
        assert.ok(isOpaque(buf, CX, CY + 7), 'Cannon barrel at CX, CY+7 should be opaque');
        const [r, g, b] = getPixelRGB(buf, CX, CY + 7);
        // Dark iron: [55, 52, 48] — all channels low and close
        assert.ok(r < 100 && g < 100 && b < 100, `Barrel should be dark iron, got RGB(${r},${g},${b})`);
    });

    it('should draw the barrel top at (CX, CY+6)', () => {
        const buf = createBuffer();
        drawCannon(buf, CX, CY);
        assert.ok(isOpaque(buf, CX, CY + 6), 'Cannon barrel top at CX, CY+6 should be opaque');
    });

    it('should draw the left wheel at (CX-4, CY+9)', () => {
        const buf = createBuffer();
        drawCannon(buf, CX, CY);
        assert.ok(isOpaque(buf, CX - 4, CY + 9), 'Left wheel at CX-4, CY+9 should be opaque');
        const [r, g, b] = getPixelRGB(buf, CX - 4, CY + 9);
        // Wood: [80, 55, 30]
        assert.ok(r > g && g > b, `Wheel should be wood-brown, got RGB(${r},${g},${b})`);
    });

    it('should draw the right wheel at (CX+4, CY+9)', () => {
        const buf = createBuffer();
        drawCannon(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 4, CY + 9), 'Right wheel at CX+4, CY+9 should be opaque');
    });
});

// ─── drawClub ─────────────────────────────────────────────────────────────────

describe('drawClub: pixel-level assertions', () => {
    it('should draw the shaft at (CX+3, CY-2) — top of shaft', () => {
        const buf = createBuffer();
        drawClub(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 3, CY - 2), 'Club shaft top at CX+3, CY-2 should be opaque');
    });

    it('should draw the wider head at (CX+3, CY-3)', () => {
        const buf = createBuffer();
        drawClub(buf, CX, CY);
        assert.ok(isOpaque(buf, CX + 3, CY - 3), 'Club head at CX+3, CY-3 should be opaque');
        assert.ok(isOpaque(buf, CX + 4, CY - 3), 'Club head at CX+4, CY-3 should be opaque');
    });

    it('should draw the full 6-row shaft', () => {
        const buf = createBuffer();
        drawClub(buf, CX, CY);
        for (let row = 0; row < 6; row++) {
            assert.ok(
                isOpaque(buf, CX + 3, CY - 2 + row),
                `Club shaft row ${row} at (CX+3, CY-2+${row}) should be opaque`
            );
        }
    });
});
