/**
 * Property 15: Enemy Palette Separation
 *
 * For any generated enemy sprite, the set of colors used SHALL share no more
 * than 2 colors with the player unit palette, ensuring immediate visual
 * differentiation.
 *
 * Feature: enhanced-pixel-art-sprites, Property 15: Enemy Palette Separation
 *
 * **Validates: Requirements 8.1, 8.2**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const {
    generateEnemySprite,
    ENEMY_TYPES,
    ENEMY_WIDTH,
    ENEMY_HEIGHT,
} = require('../js/level-generators/generate-enemy-sprites');
const {
    ENEMY_PALETTE,
    PRIMARY_PALETTE,
    getPaletteForCategory,
} = require('../js/level-generators/lib/palette');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extracts the set of unique non-transparent colors from an RGBA buffer.
 * Returns an array of [r, g, b] tuples.
 */
function extractColors(buffer, width, height) {
    const colorSet = new Set();
    const totalPixels = width * height;
    for (let i = 0; i < totalPixels; i++) {
        const offset = i * 4;
        const alpha = buffer[offset + 3];
        if (alpha === 0) continue;
        const r = buffer[offset];
        const g = buffer[offset + 1];
        const b = buffer[offset + 2];
        colorSet.add(`${r},${g},${b}`);
    }
    return [...colorSet].map(s => s.split(',').map(Number));
}

/**
 * Checks if two colors are identical (exact RGB match).
 */
function colorsEqual(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * Counts how many colors from `spriteColors` appear in the given palette.
 */
function countOverlap(spriteColors, palette) {
    let overlap = 0;
    for (const color of spriteColors) {
        for (const palColor of palette) {
            if (colorsEqual(color, palColor)) {
                overlap++;
                break;
            }
        }
    }
    return overlap;
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

/**
 * Arbitrary for enemy type selection (one of the 5 enemy types).
 */
const enemyTypeArb = fc.constantFrom(...ENEMY_TYPES.map(e => e.type));

/**
 * Arbitrary for seed values.
 */
const seedArb = fc.integer({ min: 1, max: 100_000 });

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Property 15: Enemy Palette Separation', () => {
    it('generated enemy sprites use colors from ENEMY_PALETTE only', () => {
        fc.assert(
            fc.property(enemyTypeArb, seedArb, (enemyType, seed) => {
                const buffer = generateEnemySprite(enemyType, seed);
                const spriteColors = extractColors(buffer, ENEMY_WIDTH, ENEMY_HEIGHT);
                const enemyPalette = getPaletteForCategory('enemy');

                // Every non-transparent pixel color must be in the enemy palette
                for (const color of spriteColors) {
                    const inPalette = enemyPalette.some(pc => colorsEqual(color, pc));
                    assert.strictEqual(
                        inPalette,
                        true,
                        `Enemy sprite "${enemyType}" (seed=${seed}) contains color ` +
                        `[${color}] which is not in the ENEMY_PALETTE.`
                    );
                }
            }),
            { numRuns: 100 }
        );
    });

    it('ENEMY_PALETTE shares no more than 2 colors with PRIMARY_PALETTE (player palette)', () => {
        fc.assert(
            fc.property(fc.constant(null), () => {
                const overlap = countOverlap(ENEMY_PALETTE, PRIMARY_PALETTE);
                assert.ok(
                    overlap <= 2,
                    `ENEMY_PALETTE shares ${overlap} colors with PRIMARY_PALETTE, ` +
                    `but the maximum allowed is 2. Shared colors must be ≤ 2 ` +
                    `to ensure immediate visual differentiation.`
                );
            }),
            { numRuns: 100 }
        );
    });

    it('enemy sprite colors overlap with player palette by no more than 2 colors', () => {
        fc.assert(
            fc.property(enemyTypeArb, seedArb, (enemyType, seed) => {
                const buffer = generateEnemySprite(enemyType, seed);
                const spriteColors = extractColors(buffer, ENEMY_WIDTH, ENEMY_HEIGHT);

                const overlap = countOverlap(spriteColors, PRIMARY_PALETTE);
                assert.ok(
                    overlap <= 2,
                    `Enemy sprite "${enemyType}" (seed=${seed}) shares ${overlap} colors ` +
                    `with the player unit palette (PRIMARY_PALETTE). Maximum allowed is 2.`
                );
            }),
            { numRuns: 100 }
        );
    });
});
