/**
 * Tests for js/level-generators/lib/unit-body.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/unit-body.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { drawUnit } = require('../../../js/level-generators/lib/unit-body');
const { createBuffer } = require('../../../js/level-generators/lib/pixel-utils');
const { TILE_WIDTH, TILE_HEIGHT, UNIT_PALETTES } = require('../../../js/level-generators/lib/sprite-constants');

describe('unit-body: drawUnit', () => {
    it('should draw pixels onto the buffer (not all transparent)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.knight, 'sword', 20000);

        let opaqueCount = 0;
        for (let i = 3; i < buf.length; i += 4) {
            if (buf[i] > 0) opaqueCount++;
        }
        assert.ok(opaqueCount > 50, `Should have many opaque pixels, got ${opaqueCount}`);
    });

    it('should produce deterministic output for the same seed', () => {
        const buf1 = createBuffer();
        drawUnit(buf1, UNIT_PALETTES.knight, 'sword', 20000);

        const buf2 = createBuffer();
        drawUnit(buf2, UNIT_PALETTES.knight, 'sword', 20000);

        assert.ok(buf1.equals(buf2));
    });

    it('should produce different output for different seeds', () => {
        const buf1 = createBuffer();
        drawUnit(buf1, UNIT_PALETTES.knight, 'sword', 20000);

        const buf2 = createBuffer();
        drawUnit(buf2, UNIT_PALETTES.knight, 'sword', 21000);

        assert.ok(!buf1.equals(buf2));
    });

    it('should produce different output for different palettes', () => {
        const buf1 = createBuffer();
        drawUnit(buf1, UNIT_PALETTES.knight, 'sword', 20000);

        const buf2 = createBuffer();
        drawUnit(buf2, UNIT_PALETTES.archer, 'sword', 20000);

        assert.ok(!buf1.equals(buf2));
    });

    it('should produce different output for different weapons', () => {
        const buf1 = createBuffer();
        drawUnit(buf1, UNIT_PALETTES.knight, 'sword', 20000);

        const buf2 = createBuffer();
        drawUnit(buf2, UNIT_PALETTES.knight, 'bow', 20000);

        assert.ok(!buf1.equals(buf2));
    });

    it('should draw the figure roughly centered on the tile', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.spearman, 'spear', 20000);

        // Check that pixels exist near the center (around x=32, y=14)
        let centerAreaOpaque = 0;
        for (let y = 8; y <= 24; y++) {
            for (let x = 26; x <= 38; x++) {
                const idx = (y * TILE_WIDTH + x) * 4;
                if (buf[idx + 3] > 0) centerAreaOpaque++;
            }
        }
        assert.ok(centerAreaOpaque > 30, 'Figure should be drawn near center');
    });

    it('should include a drop shadow (semi-transparent pixels)', () => {
        const buf = createBuffer();
        drawUnit(buf, UNIT_PALETTES.militia, 'club', 20000);

        let semiTransparentCount = 0;
        for (let i = 3; i < buf.length; i += 4) {
            if (buf[i] > 0 && buf[i] < 255) semiTransparentCount++;
        }
        assert.ok(semiTransparentCount > 0, 'Should have semi-transparent shadow pixels');
    });

    it('should work with all unit palettes without throwing', () => {
        const weapons = ['sword', 'shield', 'spear', 'bow', 'crossbow', 'javelin', 'hammer', 'club', 'cannon'];
        const palettes = Object.values(UNIT_PALETTES);

        for (let i = 0; i < palettes.length; i++) {
            const buf = createBuffer();
            assert.doesNotThrow(() => {
                drawUnit(buf, palettes[i], weapons[i], 20000 + i * 200);
            });
        }
    });
});
