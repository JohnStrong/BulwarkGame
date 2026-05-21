/**
 * Tests for js/level-generators/generate-unit-sprites.js
 *
 * Tests the unit sprite generation by calling the shared utilities directly
 * (since the module auto-runs generateAll() which writes to disk).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-unit-sprites.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createBuffer } = require('../../js/level-generators/lib/pixel-utils');
const { drawUnit } = require('../../js/level-generators/lib/unit-body');
const { TILE_WIDTH, TILE_HEIGHT, UNIT_PALETTES, UNIT_SPRITES } = require('../../js/level-generators/lib/sprite-constants');

// Re-implement generateUnitSprite from the source
function generateUnitSprite(palette, weapon, seedValue) {
    const buffer = createBuffer();
    drawUnit(buffer, palette, weapon, seedValue + 500);
    return buffer;
}

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] > 0) count++;
    }
    return count;
}

const UNIT_CONFIGS = [
    { name: 'knight', palette: UNIT_PALETTES.knight, weapon: 'sword' },
    { name: 'heavyInfantry', palette: UNIT_PALETTES.heavyInfantry, weapon: 'shield' },
    { name: 'spearman', palette: UNIT_PALETTES.spearman, weapon: 'spear' },
    { name: 'archer', palette: UNIT_PALETTES.archer, weapon: 'bow' },
    { name: 'crossbowman', palette: UNIT_PALETTES.crossbowman, weapon: 'crossbow' },
    { name: 'skirmisher', palette: UNIT_PALETTES.skirmisher, weapon: 'javelin' },
    { name: 'engineer', palette: UNIT_PALETTES.engineer, weapon: 'hammer' },
    { name: 'militia', palette: UNIT_PALETTES.militia, weapon: 'club' },
    { name: 'artillery', palette: UNIT_PALETTES.artillery, weapon: 'cannon' },
];

describe('generate-unit-sprites: generateUnitSprite', () => {
    it('should produce a buffer of correct size', () => {
        const buf = generateUnitSprite(UNIT_PALETTES.knight, 'sword', 20000);
        assert.equal(buf.length, TILE_WIDTH * TILE_HEIGHT * 4);
    });

    it('should draw pixels (not all transparent)', () => {
        const buf = generateUnitSprite(UNIT_PALETTES.knight, 'sword', 20000);
        assert.ok(countOpaquePixels(buf) > 50);
    });

    it('should be deterministic for the same inputs', () => {
        const buf1 = generateUnitSprite(UNIT_PALETTES.archer, 'bow', 20200);
        const buf2 = generateUnitSprite(UNIT_PALETTES.archer, 'bow', 20200);
        assert.ok(buf1.equals(buf2));
    });

    it('should produce different output for different seed values', () => {
        const buf1 = generateUnitSprite(UNIT_PALETTES.knight, 'sword', 20000);
        const buf2 = generateUnitSprite(UNIT_PALETTES.knight, 'sword', 20200);
        assert.ok(!buf1.equals(buf2));
    });
});

describe('generate-unit-sprites: all unit types', () => {
    for (let i = 0; i < UNIT_CONFIGS.length; i++) {
        const config = UNIT_CONFIGS[i];

        it(`${config.name} should generate without errors`, () => {
            assert.doesNotThrow(() => {
                generateUnitSprite(config.palette, config.weapon, 20000 + i * 200);
            });
        });

        it(`${config.name} should produce opaque pixels`, () => {
            const buf = generateUnitSprite(config.palette, config.weapon, 20000 + i * 200);
            assert.ok(countOpaquePixels(buf) > 30, `${config.name} should have visible pixels`);
        });

        it(`${config.name} should have pixels near center (figure is centered)`, () => {
            const buf = generateUnitSprite(config.palette, config.weapon, 20000 + i * 200);
            let centerPixels = 0;
            for (let y = 8; y <= 24; y++) {
                for (let x = 26; x <= 38; x++) {
                    const idx = (y * TILE_WIDTH + x) * 4;
                    if (buf[idx + 3] > 0) centerPixels++;
                }
            }
            assert.ok(centerPixels > 20, `${config.name} figure should be near center`);
        });
    }
});

describe('generate-unit-sprites: each unit looks different', () => {
    it('all 9 units should produce unique buffers', () => {
        const buffers = UNIT_CONFIGS.map((config, i) =>
            generateUnitSprite(config.palette, config.weapon, 20000 + i * 200)
        );

        for (let i = 0; i < buffers.length; i++) {
            for (let j = i + 1; j < buffers.length; j++) {
                assert.ok(
                    !buffers[i].equals(buffers[j]),
                    `${UNIT_CONFIGS[i].name} and ${UNIT_CONFIGS[j].name} should look different`
                );
            }
        }
    });
});

describe('generate-unit-sprites: UNIT_SPRITES registry', () => {
    it('should have a sprite name for each unit config', () => {
        for (const config of UNIT_CONFIGS) {
            assert.ok(config.name in UNIT_SPRITES, `Missing sprite name for ${config.name}`);
        }
    });

    it('sprite names should follow unit-* pattern', () => {
        for (const [key, name] of Object.entries(UNIT_SPRITES)) {
            assert.ok(name.startsWith('unit-'), `${key}: "${name}" should start with "unit-"`);
        }
    });
});

describe('generate-unit-sprites: transparency', () => {
    it('unit sprites should have mostly transparent background', () => {
        const buf = generateUnitSprite(UNIT_PALETTES.knight, 'sword', 20000);
        const totalPixels = TILE_WIDTH * TILE_HEIGHT;
        const opaquePixels = countOpaquePixels(buf);
        const transparentRatio = (totalPixels - opaquePixels) / totalPixels;
        // Unit figure is small (~10x16px) on a 64x32 tile, so most should be transparent
        assert.ok(transparentRatio > 0.8, `Most of tile should be transparent, got ${(transparentRatio * 100).toFixed(1)}%`);
    });
});
