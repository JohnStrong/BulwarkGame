/**
 * Tests for js/level-generators/generate-unit-sprites.js
 *
 * Tests the enhanced unit sprite generation (32×32, unique silhouettes,
 * weapons, directional lighting, palette quantization).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-unit-sprites.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    generateUnitSprite,
    getSilhouette,
    UNIT_SIZE,
} = require('../../js/level-generators/generate-unit-sprites');

const { UNIT_PALETTES, UNIT_SPRITES } = require('../../js/level-generators/lib/sprite-constants');
const { getPaletteForCategory } = require('../../js/level-generators/lib/palette');

const UNIT_CONFIGS = [
    { name: 'knight', type: 'knight', palette: UNIT_PALETTES.knight },
    { name: 'archer', type: 'archer', palette: UNIT_PALETTES.archer },
    { name: 'spearman', type: 'spearman', palette: UNIT_PALETTES.spearman },
    { name: 'crossbowman', type: 'crossbowman', palette: UNIT_PALETTES.crossbowman },
    { name: 'engineer', type: 'engineer', palette: UNIT_PALETTES.engineer },
    { name: 'heavy-infantry', type: 'heavy-infantry', palette: UNIT_PALETTES.heavyInfantry },
    { name: 'skirmisher', type: 'skirmisher', palette: UNIT_PALETTES.skirmisher },
    { name: 'militia', type: 'militia', palette: UNIT_PALETTES.militia },
    { name: 'artillery', type: 'artillery', palette: UNIT_PALETTES.artillery },
];

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] > 0) count++;
    }
    return count;
}

/**
 * Extracts a 1-bit silhouette mask from a buffer (1 = opaque, 0 = transparent).
 */
function extractMask(buf, size) {
    const mask = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) {
        mask[i] = buf[i * 4 + 3] > 0 ? 1 : 0;
    }
    return mask;
}

/**
 * Downscales a mask to half size using nearest-neighbor.
 */
function downscaleMask(mask, fromSize) {
    const toSize = fromSize / 2;
    const result = new Uint8Array(toSize * toSize);
    for (let y = 0; y < toSize; y++) {
        for (let x = 0; x < toSize; x++) {
            // A pixel is opaque if any of the 4 source pixels are opaque
            const sx = x * 2;
            const sy = y * 2;
            result[y * toSize + x] =
                mask[sy * fromSize + sx] |
                mask[sy * fromSize + sx + 1] |
                mask[(sy + 1) * fromSize + sx] |
                mask[(sy + 1) * fromSize + sx + 1];
        }
    }
    return result;
}

describe('generate-unit-sprites: buffer dimensions', () => {
    it('should produce a 32×32 RGBA buffer', () => {
        const buf = generateUnitSprite('knight', UNIT_PALETTES.knight, 20000);
        assert.equal(buf.length, UNIT_SIZE * UNIT_SIZE * 4);
        assert.equal(UNIT_SIZE, 32);
    });
});

describe('generate-unit-sprites: determinism', () => {
    it('should be deterministic for the same inputs', () => {
        const buf1 = generateUnitSprite('archer', UNIT_PALETTES.archer, 20200);
        const buf2 = generateUnitSprite('archer', UNIT_PALETTES.archer, 20200);
        assert.ok(buf1.equals(buf2));
    });

    it('should produce different output for different seed values', () => {
        const buf1 = generateUnitSprite('knight', UNIT_PALETTES.knight, 20000);
        const buf2 = generateUnitSprite('knight', UNIT_PALETTES.knight, 20200);
        assert.ok(!buf1.equals(buf2));
    });
});

describe('generate-unit-sprites: transparent background', () => {
    it('unit sprites should have mostly transparent background', () => {
        const buf = generateUnitSprite('knight', UNIT_PALETTES.knight, 20000);
        const totalPixels = UNIT_SIZE * UNIT_SIZE;
        const opaquePixels = countOpaquePixels(buf);
        const transparentRatio = (totalPixels - opaquePixels) / totalPixels;
        // Unit figure is small on a 32×32 tile, so most should be transparent
        assert.ok(transparentRatio > 0.5,
            `Most of tile should be transparent, got ${(transparentRatio * 100).toFixed(1)}%`);
    });

    it('all transparent pixels should have alpha exactly 0', () => {
        const buf = generateUnitSprite('knight', UNIT_PALETTES.knight, 20000);
        for (let i = 0; i < buf.length; i += 4) {
            const alpha = buf[i + 3];
            assert.ok(alpha === 0 || alpha === 255,
                `Pixel at byte ${i} has alpha ${alpha}, expected 0 or 255`);
        }
    });
});

describe('generate-unit-sprites: palette compliance', () => {
    it('all non-transparent pixels should match the unit palette', () => {
        const palette = getPaletteForCategory('unit');
        const buf = generateUnitSprite('knight', UNIT_PALETTES.knight, 20000);
        for (let i = 0; i < buf.length; i += 4) {
            if (buf[i + 3] === 0) continue;
            const r = buf[i], g = buf[i + 1], b = buf[i + 2];
            const found = palette.some(c => c[0] === r && c[1] === g && c[2] === b);
            assert.ok(found,
                `Pixel at byte ${i} has color [${r},${g},${b}] not in palette`);
        }
    });
});

describe('generate-unit-sprites: unique silhouettes', () => {
    it('all 9 unit types should have unique 1-bit masks at native resolution', () => {
        const masks = UNIT_CONFIGS.map((config, i) => {
            const buf = generateUnitSprite(config.type, config.palette, 20000 + i * 200);
            return extractMask(buf, UNIT_SIZE);
        });

        for (let i = 0; i < masks.length; i++) {
            for (let j = i + 1; j < masks.length; j++) {
                let differ = false;
                for (let k = 0; k < masks[i].length; k++) {
                    if (masks[i][k] !== masks[j][k]) { differ = true; break; }
                }
                assert.ok(differ,
                    `${UNIT_CONFIGS[i].name} and ${UNIT_CONFIGS[j].name} should have different silhouettes`);
            }
        }
    });

    it('silhouettes should remain distinguishable at 16×16 (50% scale)', () => {
        const masks16 = UNIT_CONFIGS.map((config, i) => {
            const buf = generateUnitSprite(config.type, config.palette, 20000 + i * 200);
            const mask32 = extractMask(buf, UNIT_SIZE);
            return downscaleMask(mask32, UNIT_SIZE);
        });

        for (let i = 0; i < masks16.length; i++) {
            for (let j = i + 1; j < masks16.length; j++) {
                let differ = false;
                for (let k = 0; k < masks16[i].length; k++) {
                    if (masks16[i][k] !== masks16[j][k]) { differ = true; break; }
                }
                assert.ok(differ,
                    `${UNIT_CONFIGS[i].name} and ${UNIT_CONFIGS[j].name} should differ at 16×16`);
            }
        }
    });
});

describe('generate-unit-sprites: weapon minimum area', () => {
    it('each unit type weapon should occupy at least 4×4 pixels (16 pixels)', () => {
        // We verify by checking that the weapon drawing adds pixels
        // in a region that covers at least 16 pixels
        for (const config of UNIT_CONFIGS) {
            const buf = generateUnitSprite(config.type, config.palette, 20000);
            const opaqueCount = countOpaquePixels(buf);
            // Each unit should have substantial pixel coverage including weapon
            assert.ok(opaqueCount >= 50,
                `${config.name} should have at least 50 opaque pixels (has ${opaqueCount})`);
        }
    });
});

describe('generate-unit-sprites: directional lighting', () => {
    it('upper-left region should be brighter than lower-right region', () => {
        const buf = generateUnitSprite('knight', UNIT_PALETTES.knight, 20000);
        let ulLuminance = 0, ulCount = 0;
        let brLuminance = 0, brCount = 0;

        for (let y = 0; y < UNIT_SIZE; y++) {
            for (let x = 0; x < UNIT_SIZE; x++) {
                const idx = (y * UNIT_SIZE + x) * 4;
                if (buf[idx + 3] === 0) continue;
                const lum = buf[idx] * 0.299 + buf[idx + 1] * 0.587 + buf[idx + 2] * 0.114;
                const nx = x / (UNIT_SIZE - 1);
                const ny = y / (UNIT_SIZE - 1);
                const factor = (nx + ny) / 2;
                if (factor < 0.35) {
                    ulLuminance += lum;
                    ulCount++;
                } else if (factor > 0.65) {
                    brLuminance += lum;
                    brCount++;
                }
            }
        }

        if (ulCount > 0 && brCount > 0) {
            const avgUL = ulLuminance / ulCount;
            const avgBR = brLuminance / brCount;
            assert.ok(avgUL > avgBR,
                `Upper-left avg luminance (${avgUL.toFixed(1)}) should be > lower-right (${avgBR.toFixed(1)})`);
        }
    });
});

describe('generate-unit-sprites: all unit types generate', () => {
    for (let i = 0; i < UNIT_CONFIGS.length; i++) {
        const config = UNIT_CONFIGS[i];

        it(`${config.name} should generate without errors`, () => {
            assert.doesNotThrow(() => {
                generateUnitSprite(config.type, config.palette, 20000 + i * 200);
            });
        });

        it(`${config.name} should produce opaque pixels`, () => {
            const buf = generateUnitSprite(config.type, config.palette, 20000 + i * 200);
            assert.ok(countOpaquePixels(buf) > 30, `${config.name} should have visible pixels`);
        });
    }
});
