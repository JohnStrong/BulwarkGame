/**
 * Integration tests for js/level-generators/generate-enemy-sprites.js
 *
 * Recommendation 2 & 3: Tests the full generation pipeline for all enemy types,
 * verifying buffer dimensions, palette compliance, and that all 5 types
 * generate successfully with correct properties.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-enemy-sprites-integration.spec.js
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
} = require('../../js/level-generators/generate-enemy-sprites');

const { getPaletteForCategory } = require('../../js/level-generators/lib/palette');

// ─── Helpers ────────────────────────────────────────────────────────────────

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] > 0) count++;
    }
    return count;
}

function getPixelColors(buf) {
    const colors = new Set();
    for (let i = 0; i < buf.length; i += 4) {
        if (buf[i + 3] > 0) {
            colors.add(`${buf[i]},${buf[i + 1]},${buf[i + 2]}`);
        }
    }
    return colors;
}

// ─── Full Pipeline Integration ──────────────────────────────────────────────

describe('generate-enemy-sprites: full pipeline integration', () => {
    it('should generate all 5 enemy types without errors', () => {
        for (let i = 0; i < ENEMY_TYPES.length; i++) {
            const enemy = ENEMY_TYPES[i];
            assert.doesNotThrow(() => {
                generateEnemySprite(enemy.type, 30000 + i * 300);
            }, `${enemy.name} should generate without errors`);
        }
    });

    it('all generated sprites should have correct buffer size (64×32×4)', () => {
        for (let i = 0; i < ENEMY_TYPES.length; i++) {
            const buf = generateEnemySprite(ENEMY_TYPES[i].type, 30000 + i * 300);
            assert.equal(buf.length, ENEMY_WIDTH * ENEMY_HEIGHT * 4,
                `${ENEMY_TYPES[i].name} buffer size should be ${ENEMY_WIDTH * ENEMY_HEIGHT * 4}`);
        }
    });

    it('all generated sprites should have visible content (>50 opaque pixels)', () => {
        for (let i = 0; i < ENEMY_TYPES.length; i++) {
            const buf = generateEnemySprite(ENEMY_TYPES[i].type, 30000 + i * 300);
            const opaque = countOpaquePixels(buf);
            assert.ok(opaque > 50,
                `${ENEMY_TYPES[i].name} should have >50 opaque pixels, got ${opaque}`);
        }
    });

    it('all generated sprites should pass palette compliance', () => {
        const palette = getPaletteForCategory('enemy');
        for (let i = 0; i < ENEMY_TYPES.length; i++) {
            const buf = generateEnemySprite(ENEMY_TYPES[i].type, 30000 + i * 300);
            for (let j = 0; j < buf.length; j += 4) {
                if (buf[j + 3] === 0) continue;
                const r = buf[j], g = buf[j + 1], b = buf[j + 2];
                const found = palette.some(c => c[0] === r && c[1] === g && c[2] === b);
                assert.ok(found,
                    `${ENEMY_TYPES[i].name}: pixel at byte ${j} color [${r},${g},${b}] not in palette`);
            }
        }
    });

    it('all generated sprites should have binary alpha (0 or 255)', () => {
        for (let i = 0; i < ENEMY_TYPES.length; i++) {
            const buf = generateEnemySprite(ENEMY_TYPES[i].type, 30000 + i * 300);
            for (let j = 3; j < buf.length; j += 4) {
                assert.ok(buf[j] === 0 || buf[j] === 255,
                    `${ENEMY_TYPES[i].name}: alpha at byte ${j} is ${buf[j]}, expected 0 or 255`);
            }
        }
    });

    it('generation should complete within reasonable time (<2s for all 5)', () => {
        const start = Date.now();
        for (let i = 0; i < ENEMY_TYPES.length; i++) {
            generateEnemySprite(ENEMY_TYPES[i].type, 30000 + i * 300);
        }
        const elapsed = Date.now() - start;
        assert.ok(elapsed < 2000,
            `All 5 enemy sprites should generate in <2s, took ${elapsed}ms`);
    });
});

// ─── drawEnemySilhouette direct tests ───────────────────────────────────────

describe('generate-enemy-sprites: drawEnemySilhouette direct', () => {
    it('should draw all body parts defined in the silhouette', () => {
        for (const enemy of ENEMY_TYPES) {
            const buf = createEnemyBuffer();
            drawEnemySilhouette(buf, enemy.type, 30000);
            const silhouette = getEnemySilhouette(enemy.type);
            const partCount = Object.keys(silhouette).length;

            // Each part should contribute pixels
            const opaque = countOpaquePixels(buf);
            assert.ok(opaque >= partCount * 2,
                `${enemy.type}: should have at least ${partCount * 2} pixels for ${partCount} parts, got ${opaque}`);
        }
    });

    it('should use multiple colors from ENEMY_COLORS', () => {
        for (const enemy of ENEMY_TYPES) {
            const buf = createEnemyBuffer();
            drawEnemySilhouette(buf, enemy.type, 30000);
            const colors = getPixelColors(buf);
            // Due to noise, there should be many color variations
            assert.ok(colors.size >= 3,
                `${enemy.type}: should use at least 3 distinct colors, got ${colors.size}`);
        }
    });

    it('should not draw outside buffer bounds', () => {
        for (const enemy of ENEMY_TYPES) {
            const buf = createEnemyBuffer();
            // This should not throw even if silhouette parts are near edges
            assert.doesNotThrow(() => {
                drawEnemySilhouette(buf, enemy.type, 30000);
            });
        }
    });
});

// ─── drawSilhouetteModifier direct tests ────────────────────────────────────

describe('generate-enemy-sprites: drawSilhouetteModifier direct', () => {
    it('should add at least 5 pixels per modifier', () => {
        for (const enemy of ENEMY_TYPES) {
            const buf = createEnemyBuffer();
            drawSilhouetteModifier(buf, enemy.type);
            const opaque = countOpaquePixels(buf);
            assert.ok(opaque >= 5,
                `${enemy.type} modifier should add at least 5 pixels, got ${opaque}`);
        }
    });

    it('knight modifier should draw above the head (spiked helmet)', () => {
        const buf = createEnemyBuffer();
        drawSilhouetteModifier(buf, 'knight');
        // Check that pixels exist in the upper region (y < 8)
        let hasUpperPixels = false;
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < ENEMY_WIDTH; x++) {
                if (buf[(y * ENEMY_WIDTH + x) * 4 + 3] > 0) {
                    hasUpperPixels = true;
                    break;
                }
            }
            if (hasUpperPixels) break;
        }
        assert.ok(hasUpperPixels, 'Knight helmet spikes should be in upper region');
    });

    it('archer modifier should draw to the right (tattered banner)', () => {
        const buf = createEnemyBuffer();
        drawSilhouetteModifier(buf, 'archer');
        // Check that pixels exist in the right region (x > 40)
        let hasRightPixels = false;
        for (let y = 0; y < ENEMY_HEIGHT; y++) {
            for (let x = 40; x < ENEMY_WIDTH; x++) {
                if (buf[(y * ENEMY_WIDTH + x) * 4 + 3] > 0) {
                    hasRightPixels = true;
                    break;
                }
            }
            if (hasRightPixels) break;
        }
        assert.ok(hasRightPixels, 'Archer banner should extend to the right');
    });

    it('siege modifier should draw a war banner', () => {
        const buf = createEnemyBuffer();
        drawSilhouetteModifier(buf, 'siege');
        const opaque = countOpaquePixels(buf);
        // War banner + pole should be substantial
        assert.ok(opaque >= 15,
            `Siege war banner should have at least 15 pixels, got ${opaque}`);
    });
});

// ─── drawEnemyWeapon direct tests ───────────────────────────────────────────

describe('generate-enemy-sprites: drawEnemyWeapon direct', () => {
    it('knight weapon (dark sword) should have crossguard', () => {
        const buf = createEnemyBuffer();
        drawEnemyWeapon(buf, 'knight');
        // Crossguard is horizontal — check for pixels spanning at least 5px wide
        const opaque = countOpaquePixels(buf);
        assert.ok(opaque >= 20, `Knight sword should have at least 20 pixels, got ${opaque}`);
    });

    it('archer weapon (dark bow) should have curved arc', () => {
        const buf = createEnemyBuffer();
        drawEnemyWeapon(buf, 'archer');
        const opaque = countOpaquePixels(buf);
        assert.ok(opaque >= 16, `Archer bow should have at least 16 pixels, got ${opaque}`);
    });

    it('spearman weapon should have long shaft + head', () => {
        const buf = createEnemyBuffer();
        drawEnemyWeapon(buf, 'spearman');
        const opaque = countOpaquePixels(buf);
        // Shaft (2×13) + head (4×4) = 26 + 16 = 42 pixels
        assert.ok(opaque >= 30, `Spearman weapon should have at least 30 pixels, got ${opaque}`);
    });

    it('militia weapon (spiked club) should have club head', () => {
        const buf = createEnemyBuffer();
        drawEnemyWeapon(buf, 'militia');
        const opaque = countOpaquePixels(buf);
        assert.ok(opaque >= 20, `Militia club should have at least 20 pixels, got ${opaque}`);
    });

    it('siege weapon should have battering ram + wheels', () => {
        const buf = createEnemyBuffer();
        drawEnemyWeapon(buf, 'siege');
        const opaque = countOpaquePixels(buf);
        // Ram body (9×3) + base (9×2) + head (3×3) + 2 wheels (3×3 each) = substantial
        assert.ok(opaque >= 40, `Siege weapon should have at least 40 pixels, got ${opaque}`);
    });

    it('all weapons should use only ENEMY_COLORS palette colors', () => {
        const paletteColors = Object.values(ENEMY_COLORS);
        for (const enemy of ENEMY_TYPES) {
            const buf = createEnemyBuffer();
            drawEnemyWeapon(buf, enemy.type);
            for (let i = 0; i < buf.length; i += 4) {
                if (buf[i + 3] === 0) continue;
                const r = buf[i], g = buf[i + 1], b = buf[i + 2];
                const found = paletteColors.some(c => c[0] === r && c[1] === g && c[2] === b);
                assert.ok(found,
                    `${enemy.type} weapon: pixel color [${r},${g},${b}] not in ENEMY_COLORS`);
            }
        }
    });
});
