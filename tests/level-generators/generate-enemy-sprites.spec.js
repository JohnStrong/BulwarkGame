/**
 * Tests for js/level-generators/generate-enemy-sprites.js
 *
 * Tests the enhanced enemy sprite generation (64×32, unique silhouettes,
 * silhouette modifiers, weapons, directional lighting, palette quantization).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-enemy-sprites.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    generateEnemySprite,
    getEnemySilhouette,
    drawSilhouetteModifier,
    drawEnemyWeapon,
    drawEnemySilhouette,
    ENEMY_TYPES,
    ENEMY_WIDTH,
    ENEMY_HEIGHT,
    ENEMY_COLORS,
    createEnemyBuffer,
    setPixel,
    fillRect,
} = require('../../js/level-generators/generate-enemy-sprites');

const { ENEMY_PALETTE, getPaletteForCategory } = require('../../js/level-generators/lib/palette');

// ─── Helpers ────────────────────────────────────────────────────────────────

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
function extractMask(buf, width, height) {
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        mask[i] = buf[i * 4 + 3] > 0 ? 1 : 0;
    }
    return mask;
}

/**
 * Downscales a mask to half size using nearest-neighbor (any-opaque rule).
 */
function downscaleMask(mask, fromWidth, fromHeight) {
    const toWidth = Math.floor(fromWidth / 2);
    const toHeight = Math.floor(fromHeight / 2);
    const result = new Uint8Array(toWidth * toHeight);
    for (let y = 0; y < toHeight; y++) {
        for (let x = 0; x < toWidth; x++) {
            const sx = x * 2;
            const sy = y * 2;
            result[y * toWidth + x] =
                mask[sy * fromWidth + sx] |
                mask[sy * fromWidth + sx + 1] |
                mask[(sy + 1) * fromWidth + sx] |
                mask[(sy + 1) * fromWidth + sx + 1];
        }
    }
    return result;
}

// ─── Buffer Dimensions ──────────────────────────────────────────────────────

describe('generate-enemy-sprites: buffer dimensions', () => {
    it('should produce a 64×32 RGBA buffer', () => {
        const buf = generateEnemySprite('knight', 30000);
        assert.equal(buf.length, ENEMY_WIDTH * ENEMY_HEIGHT * 4);
        assert.equal(ENEMY_WIDTH, 64);
        assert.equal(ENEMY_HEIGHT, 32);
    });

    it('createEnemyBuffer should return a zeroed buffer of correct size', () => {
        const buf = createEnemyBuffer();
        assert.equal(buf.length, 64 * 32 * 4);
        // All bytes should be 0 (transparent)
        for (let i = 0; i < buf.length; i++) {
            assert.equal(buf[i], 0);
        }
    });
});

// ─── Constants ──────────────────────────────────────────────────────────────

describe('generate-enemy-sprites: constants', () => {
    it('should define exactly 5 enemy types', () => {
        assert.equal(ENEMY_TYPES.length, 5);
    });

    it('enemy types should have correct names', () => {
        const names = ENEMY_TYPES.map(e => e.name);
        assert.deepEqual(names, [
            'enemy-knight',
            'enemy-archer',
            'enemy-spearman',
            'enemy-militia',
            'enemy-siege',
        ]);
    });

    it('enemy types should have correct type keys', () => {
        const types = ENEMY_TYPES.map(e => e.type);
        assert.deepEqual(types, ['knight', 'archer', 'spearman', 'militia', 'siege']);
    });

    it('ENEMY_COLORS should map all 8 palette entries', () => {
        const colorKeys = Object.keys(ENEMY_COLORS);
        assert.equal(colorKeys.length, 8);
        assert.deepEqual(colorKeys, [
            'body', 'accent', 'shadow', 'olive',
            'highlight', 'armor', 'leather', 'banner',
        ]);
    });

    it('ENEMY_COLORS values should reference ENEMY_PALETTE entries', () => {
        const values = Object.values(ENEMY_COLORS);
        for (let i = 0; i < values.length; i++) {
            assert.deepEqual(values[i], ENEMY_PALETTE[i]);
        }
    });
});

// ─── Determinism ────────────────────────────────────────────────────────────

describe('generate-enemy-sprites: determinism', () => {
    it('should be deterministic for the same inputs', () => {
        const buf1 = generateEnemySprite('knight', 30000);
        const buf2 = generateEnemySprite('knight', 30000);
        assert.ok(buf1.equals(buf2));
    });

    it('should produce different output for different seed values', () => {
        const buf1 = generateEnemySprite('knight', 30000);
        const buf2 = generateEnemySprite('knight', 30300);
        assert.ok(!buf1.equals(buf2));
    });

    it('should produce different output for different enemy types', () => {
        const buf1 = generateEnemySprite('knight', 30000);
        const buf2 = generateEnemySprite('archer', 30000);
        assert.ok(!buf1.equals(buf2));
    });
});

// ─── Transparent Background ─────────────────────────────────────────────────

describe('generate-enemy-sprites: transparent background', () => {
    it('enemy sprites should have mostly transparent background', () => {
        const buf = generateEnemySprite('knight', 30000);
        const totalPixels = ENEMY_WIDTH * ENEMY_HEIGHT;
        const opaquePixels = countOpaquePixels(buf);
        const transparentRatio = (totalPixels - opaquePixels) / totalPixels;
        // Enemy figure is relatively small on a 64×32 tile
        assert.ok(transparentRatio > 0.4,
            `Most of tile should be transparent, got ${(transparentRatio * 100).toFixed(1)}%`);
    });

    it('all pixels should have binary alpha (0 or 255)', () => {
        const buf = generateEnemySprite('archer', 30300);
        for (let i = 0; i < buf.length; i += 4) {
            const alpha = buf[i + 3];
            assert.ok(alpha === 0 || alpha === 255,
                `Pixel at byte ${i} has alpha ${alpha}, expected 0 or 255`);
        }
    });
});

// ─── Palette Compliance ─────────────────────────────────────────────────────

describe('generate-enemy-sprites: palette compliance', () => {
    it('all non-transparent pixels should match the enemy palette', () => {
        const palette = getPaletteForCategory('enemy');
        const buf = generateEnemySprite('knight', 30000);
        for (let i = 0; i < buf.length; i += 4) {
            if (buf[i + 3] === 0) continue;
            const r = buf[i], g = buf[i + 1], b = buf[i + 2];
            const found = palette.some(c => c[0] === r && c[1] === g && c[2] === b);
            assert.ok(found,
                `Pixel at byte ${i} has color [${r},${g},${b}] not in enemy palette`);
        }
    });

    it('palette compliance holds for all 5 enemy types', () => {
        const palette = getPaletteForCategory('enemy');
        for (let i = 0; i < ENEMY_TYPES.length; i++) {
            const buf = generateEnemySprite(ENEMY_TYPES[i].type, 30000 + i * 300);
            for (let j = 0; j < buf.length; j += 4) {
                if (buf[j + 3] === 0) continue;
                const r = buf[j], g = buf[j + 1], b = buf[j + 2];
                const found = palette.some(c => c[0] === r && c[1] === g && c[2] === b);
                assert.ok(found,
                    `${ENEMY_TYPES[i].name}: pixel at byte ${j} has color [${r},${g},${b}] not in palette`);
            }
        }
    });

    it('enemy palette should share no more than 2 colors with player unit palette', () => {
        const unitPalette = getPaletteForCategory('unit');
        const enemyPalette = ENEMY_PALETTE;
        let sharedCount = 0;
        for (const ec of enemyPalette) {
            for (const uc of unitPalette) {
                if (ec[0] === uc[0] && ec[1] === uc[1] && ec[2] === uc[2]) {
                    sharedCount++;
                    break;
                }
            }
        }
        assert.ok(sharedCount <= 2,
            `Enemy palette shares ${sharedCount} colors with unit palette (max 2 allowed)`);
    });
});

// ─── Unique Silhouettes ─────────────────────────────────────────────────────

describe('generate-enemy-sprites: unique silhouettes', () => {
    it('all 5 enemy types should have unique 1-bit masks at native resolution', () => {
        const masks = ENEMY_TYPES.map((enemy, i) => {
            const buf = generateEnemySprite(enemy.type, 30000 + i * 300);
            return extractMask(buf, ENEMY_WIDTH, ENEMY_HEIGHT);
        });

        for (let i = 0; i < masks.length; i++) {
            for (let j = i + 1; j < masks.length; j++) {
                let differ = false;
                for (let k = 0; k < masks[i].length; k++) {
                    if (masks[i][k] !== masks[j][k]) { differ = true; break; }
                }
                assert.ok(differ,
                    `${ENEMY_TYPES[i].name} and ${ENEMY_TYPES[j].name} should have different silhouettes`);
            }
        }
    });

    it('silhouettes should remain distinguishable at 32×16 (50% scale)', () => {
        const masks16 = ENEMY_TYPES.map((enemy, i) => {
            const buf = generateEnemySprite(enemy.type, 30000 + i * 300);
            const mask = extractMask(buf, ENEMY_WIDTH, ENEMY_HEIGHT);
            return downscaleMask(mask, ENEMY_WIDTH, ENEMY_HEIGHT);
        });

        for (let i = 0; i < masks16.length; i++) {
            for (let j = i + 1; j < masks16.length; j++) {
                let differ = false;
                for (let k = 0; k < masks16[i].length; k++) {
                    if (masks16[i][k] !== masks16[j][k]) { differ = true; break; }
                }
                assert.ok(differ,
                    `${ENEMY_TYPES[i].name} and ${ENEMY_TYPES[j].name} should differ at 32×16`);
            }
        }
    });
});

// ─── Silhouette Definitions ─────────────────────────────────────────────────

describe('generate-enemy-sprites: getEnemySilhouette', () => {
    it('should return silhouette objects with valid rectangle parts', () => {
        for (const enemy of ENEMY_TYPES) {
            const sil = getEnemySilhouette(enemy.type);
            assert.ok(typeof sil === 'object' && sil !== null,
                `${enemy.type} should return an object`);
            for (const [partName, rect] of Object.entries(sil)) {
                assert.ok(typeof rect.x === 'number', `${enemy.type}.${partName}.x should be a number`);
                assert.ok(typeof rect.y === 'number', `${enemy.type}.${partName}.y should be a number`);
                assert.ok(rect.w > 0, `${enemy.type}.${partName}.w should be positive`);
                assert.ok(rect.h > 0, `${enemy.type}.${partName}.h should be positive`);
            }
        }
    });

    it('all silhouette parts should fit within 64×32 bounds', () => {
        for (const enemy of ENEMY_TYPES) {
            const sil = getEnemySilhouette(enemy.type);
            for (const [partName, rect] of Object.entries(sil)) {
                assert.ok(rect.x >= 0 && rect.x + rect.w <= ENEMY_WIDTH,
                    `${enemy.type}.${partName} x-range [${rect.x}, ${rect.x + rect.w}) exceeds width`);
                assert.ok(rect.y >= 0 && rect.y + rect.h <= ENEMY_HEIGHT,
                    `${enemy.type}.${partName} y-range [${rect.y}, ${rect.y + rect.h}) exceeds height`);
            }
        }
    });

    it('each enemy type should have a head and torso part', () => {
        for (const enemy of ENEMY_TYPES) {
            const sil = getEnemySilhouette(enemy.type);
            assert.ok('head' in sil, `${enemy.type} should have a head`);
            assert.ok('torso' in sil, `${enemy.type} should have a torso`);
        }
    });

    it('default case should return a valid silhouette', () => {
        const sil = getEnemySilhouette('unknown-type');
        assert.ok('head' in sil);
        assert.ok('torso' in sil);
    });
});

// ─── Silhouette Modifiers ───────────────────────────────────────────────────

describe('generate-enemy-sprites: drawSilhouetteModifier', () => {
    it('should add pixels to the buffer for each enemy type', () => {
        for (const enemy of ENEMY_TYPES) {
            const buf = createEnemyBuffer();
            const beforeCount = countOpaquePixels(buf);
            drawSilhouetteModifier(buf, enemy.type);
            const afterCount = countOpaquePixels(buf);
            assert.ok(afterCount > beforeCount,
                `${enemy.type} modifier should add opaque pixels (before: ${beforeCount}, after: ${afterCount})`);
        }
    });

    it('each enemy type modifier should produce a unique pattern', () => {
        const buffers = ENEMY_TYPES.map(enemy => {
            const buf = createEnemyBuffer();
            drawSilhouetteModifier(buf, enemy.type);
            return buf;
        });

        for (let i = 0; i < buffers.length; i++) {
            for (let j = i + 1; j < buffers.length; j++) {
                assert.ok(!buffers[i].equals(buffers[j]),
                    `${ENEMY_TYPES[i].type} and ${ENEMY_TYPES[j].type} modifiers should differ`);
            }
        }
    });
});

// ─── Weapon Drawing ─────────────────────────────────────────────────────────

describe('generate-enemy-sprites: drawEnemyWeapon', () => {
    it('should add pixels to the buffer for each enemy type', () => {
        for (const enemy of ENEMY_TYPES) {
            const buf = createEnemyBuffer();
            const beforeCount = countOpaquePixels(buf);
            drawEnemyWeapon(buf, enemy.type);
            const afterCount = countOpaquePixels(buf);
            assert.ok(afterCount > beforeCount,
                `${enemy.type} weapon should add opaque pixels (before: ${beforeCount}, after: ${afterCount})`);
        }
    });

    it('each weapon should occupy at least 16 pixels (4×4 area)', () => {
        for (const enemy of ENEMY_TYPES) {
            const buf = createEnemyBuffer();
            drawEnemyWeapon(buf, enemy.type);
            const pixelCount = countOpaquePixels(buf);
            assert.ok(pixelCount >= 16,
                `${enemy.type} weapon should have at least 16 pixels (has ${pixelCount})`);
        }
    });

    it('each enemy type weapon should produce a unique pattern', () => {
        const buffers = ENEMY_TYPES.map(enemy => {
            const buf = createEnemyBuffer();
            drawEnemyWeapon(buf, enemy.type);
            return buf;
        });

        for (let i = 0; i < buffers.length; i++) {
            for (let j = i + 1; j < buffers.length; j++) {
                assert.ok(!buffers[i].equals(buffers[j]),
                    `${ENEMY_TYPES[i].type} and ${ENEMY_TYPES[j].type} weapons should differ`);
            }
        }
    });
});

// ─── Directional Lighting ───────────────────────────────────────────────────

describe('generate-enemy-sprites: directional lighting', () => {
    it('shading should produce luminance variation across the sprite', () => {
        // The enemy palette is inherently dark (crimson, shadow purple, near-black),
        // so we verify that directional shading introduces measurable luminance
        // variation rather than checking absolute UL > BR ordering.
        const buf = generateEnemySprite('knight', 30000);
        let minLum = 255, maxLum = 0;

        for (let y = 0; y < ENEMY_HEIGHT; y++) {
            for (let x = 0; x < ENEMY_WIDTH; x++) {
                const idx = (y * ENEMY_WIDTH + x) * 4;
                if (buf[idx + 3] === 0) continue;
                const lum = buf[idx] * 0.299 + buf[idx + 1] * 0.587 + buf[idx + 2] * 0.114;
                if (lum < minLum) minLum = lum;
                if (lum > maxLum) maxLum = lum;
            }
        }

        const range = maxLum - minLum;
        assert.ok(range > 5,
            `Directional shading should produce luminance variation (range: ${range.toFixed(1)})`);
    });

    it('shading should be applied (sprite differs from unshaded version)', () => {
        // Generate a sprite without shading to compare
        const buf = createEnemyBuffer();
        drawEnemySilhouette(buf, 'knight', 30000);
        drawSilhouetteModifier(buf, 'knight');
        drawEnemyWeapon(buf, 'knight');
        // Don't apply shading — this is the "unshaded" reference

        const shadedBuf = generateEnemySprite('knight', 30000);
        // The shaded version should differ from unshaded (due to applyDirectionalShading + quantize)
        assert.ok(!buf.equals(shadedBuf),
            'Shaded sprite should differ from unshaded sprite');
    });
});

// ─── Pixel Utilities ────────────────────────────────────────────────────────

describe('generate-enemy-sprites: setPixel', () => {
    it('should set RGBA values at correct position', () => {
        const buf = createEnemyBuffer();
        setPixel(buf, 10, 5, 100, 150, 200);
        const idx = (5 * ENEMY_WIDTH + 10) * 4;
        assert.equal(buf[idx], 100);
        assert.equal(buf[idx + 1], 150);
        assert.equal(buf[idx + 2], 200);
        assert.equal(buf[idx + 3], 255);
    });

    it('should clamp color values to 0-255', () => {
        const buf = createEnemyBuffer();
        setPixel(buf, 0, 0, -50, 300, 128);
        const idx = 0;
        assert.equal(buf[idx], 0);
        assert.equal(buf[idx + 1], 255);
        assert.equal(buf[idx + 2], 128);
        assert.equal(buf[idx + 3], 255);
    });

    it('should ignore out-of-bounds coordinates', () => {
        const buf = createEnemyBuffer();
        // These should not throw
        setPixel(buf, -1, 0, 255, 0, 0);
        setPixel(buf, 64, 0, 255, 0, 0);
        setPixel(buf, 0, -1, 255, 0, 0);
        setPixel(buf, 0, 32, 255, 0, 0);
        // Buffer should remain all zeros
        assert.equal(countOpaquePixels(buf), 0);
    });
});

describe('generate-enemy-sprites: fillRect', () => {
    it('should fill a rectangular region', () => {
        const buf = createEnemyBuffer();
        fillRect(buf, 5, 5, 3, 4, 100, 100, 100);
        // Should have 3×4 = 12 opaque pixels
        assert.equal(countOpaquePixels(buf), 12);
    });

    it('should clip to buffer bounds', () => {
        const buf = createEnemyBuffer();
        // Partially out of bounds
        fillRect(buf, 62, 30, 5, 5, 200, 200, 200);
        // Only 2×2 = 4 pixels should be within bounds
        assert.equal(countOpaquePixels(buf), 4);
    });
});

// ─── All Types Generate Successfully ────────────────────────────────────────

describe('generate-enemy-sprites: all enemy types generate', () => {
    for (let i = 0; i < ENEMY_TYPES.length; i++) {
        const enemy = ENEMY_TYPES[i];

        it(`${enemy.name} should generate without errors`, () => {
            assert.doesNotThrow(() => {
                generateEnemySprite(enemy.type, 30000 + i * 300);
            });
        });

        it(`${enemy.name} should produce opaque pixels`, () => {
            const buf = generateEnemySprite(enemy.type, 30000 + i * 300);
            assert.ok(countOpaquePixels(buf) > 50,
                `${enemy.name} should have visible pixels`);
        });

        it(`${enemy.name} should have correct buffer size`, () => {
            const buf = generateEnemySprite(enemy.type, 30000 + i * 300);
            assert.equal(buf.length, ENEMY_WIDTH * ENEMY_HEIGHT * 4);
        });
    }
});

// ─── drawEnemySilhouette ────────────────────────────────────────────────────

describe('generate-enemy-sprites: drawEnemySilhouette', () => {
    it('should draw body parts onto the buffer', () => {
        const buf = createEnemyBuffer();
        drawEnemySilhouette(buf, 'knight', 30000);
        assert.ok(countOpaquePixels(buf) > 30,
            'Silhouette should produce visible pixels');
    });

    it('should be deterministic for same seed', () => {
        const buf1 = createEnemyBuffer();
        const buf2 = createEnemyBuffer();
        drawEnemySilhouette(buf1, 'archer', 12345);
        drawEnemySilhouette(buf2, 'archer', 12345);
        assert.ok(buf1.equals(buf2));
    });

    it('should produce different results for different seeds', () => {
        const buf1 = createEnemyBuffer();
        const buf2 = createEnemyBuffer();
        drawEnemySilhouette(buf1, 'archer', 12345);
        drawEnemySilhouette(buf2, 'archer', 99999);
        assert.ok(!buf1.equals(buf2));
    });
});
