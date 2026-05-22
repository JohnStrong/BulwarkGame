/**
 * Property 9: Unit Weapon Minimum Area
 *
 * For any generated unit sprite (player or enemy), the weapon element SHALL
 * occupy a contiguous region of at least 4×4 pixels (16 pixels minimum)
 * that are colored differently from the body palette color.
 *
 * Feature: enhanced-pixel-art-sprites, Property 9: Unit Weapon Minimum Area
 *
 * **Validates: Requirements 3.2**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const {
    createUnitBuffer,
    drawWeaponElement,
    drawSilhouette,
    UNIT_SIZE,
} = require('../js/level-generators/generate-unit-sprites');
const { UNIT_PALETTES } = require('../js/level-generators/lib/sprite-constants');

// ─── Unit Types ─────────────────────────────────────────────────────────────

const UNIT_TYPES = [
    'knight', 'archer', 'spearman', 'crossbowman', 'engineer',
    'heavy-infantry', 'skirmisher', 'militia', 'artillery',
];

/**
 * Maps unit type to its palette from UNIT_PALETTES.
 */
function getPaletteForUnit(unitType) {
    const key = unitType === 'heavy-infantry' ? 'heavyInfantry' : unitType;
    return UNIT_PALETTES[key];
}

/**
 * Counts the number of non-transparent pixels in a buffer that are colored
 * differently from the body palette color. These represent weapon pixels.
 *
 * Strategy: Generate the body silhouette alone, then generate body + weapon.
 * Pixels that exist in the weapon version but NOT in the body-only version
 * (or differ in color) are weapon pixels.
 *
 * @param {string} unitType
 * @param {object} palette
 * @param {number} seed
 * @returns {number} Count of weapon-specific pixels
 */
function countWeaponPixels(unitType, palette, seed) {
    // Generate body-only buffer
    const bodyBuffer = createUnitBuffer();
    drawSilhouette(bodyBuffer, unitType, palette, seed);

    // Generate body + weapon buffer
    const fullBuffer = createUnitBuffer();
    drawSilhouette(fullBuffer, unitType, palette, seed);
    drawWeaponElement(fullBuffer, unitType, palette);

    // Count pixels that differ between body-only and body+weapon
    const totalPixels = UNIT_SIZE * UNIT_SIZE;
    let weaponPixelCount = 0;

    for (let i = 0; i < totalPixels; i++) {
        const offset = i * 4;
        const fullAlpha = fullBuffer[offset + 3];
        const bodyAlpha = bodyBuffer[offset + 3];

        if (fullAlpha === 0) continue;

        // Pixel is a weapon pixel if:
        // 1. It exists in full but not in body (new pixel from weapon), OR
        // 2. It exists in both but has different color (weapon overwrote body)
        if (bodyAlpha === 0) {
            // New pixel added by weapon
            weaponPixelCount++;
        } else {
            // Check if color changed
            const bodyR = bodyBuffer[offset];
            const bodyG = bodyBuffer[offset + 1];
            const bodyB = bodyBuffer[offset + 2];
            const fullR = fullBuffer[offset];
            const fullG = fullBuffer[offset + 1];
            const fullB = fullBuffer[offset + 2];

            if (bodyR !== fullR || bodyG !== fullG || bodyB !== fullB) {
                weaponPixelCount++;
            }
        }
    }

    return weaponPixelCount;
}

/**
 * Checks if weapon pixels form a contiguous region that spans at least
 * 4 pixels in both width and height (bounding box check).
 *
 * @param {string} unitType
 * @param {object} palette
 * @param {number} seed
 * @returns {{width: number, height: number, count: number}}
 */
function getWeaponBounds(unitType, palette, seed) {
    // Generate body-only buffer
    const bodyBuffer = createUnitBuffer();
    drawSilhouette(bodyBuffer, unitType, palette, seed);

    // Generate body + weapon buffer
    const fullBuffer = createUnitBuffer();
    drawSilhouette(fullBuffer, unitType, palette, seed);
    drawWeaponElement(fullBuffer, unitType, palette);

    let minX = UNIT_SIZE, maxX = -1, minY = UNIT_SIZE, maxY = -1;
    let count = 0;

    for (let y = 0; y < UNIT_SIZE; y++) {
        for (let x = 0; x < UNIT_SIZE; x++) {
            const offset = (y * UNIT_SIZE + x) * 4;
            const fullAlpha = fullBuffer[offset + 3];
            const bodyAlpha = bodyBuffer[offset + 3];

            if (fullAlpha === 0) continue;

            let isWeaponPixel = false;
            if (bodyAlpha === 0) {
                isWeaponPixel = true;
            } else {
                const bodyR = bodyBuffer[offset];
                const bodyG = bodyBuffer[offset + 1];
                const bodyB = bodyBuffer[offset + 2];
                const fullR = fullBuffer[offset];
                const fullG = fullBuffer[offset + 1];
                const fullB = fullBuffer[offset + 2];

                if (bodyR !== fullR || bodyG !== fullG || bodyB !== fullB) {
                    isWeaponPixel = true;
                }
            }

            if (isWeaponPixel) {
                count++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (count === 0) return { width: 0, height: 0, count: 0 };

    return {
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        count,
    };
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

/**
 * Arbitrary for unit types.
 */
const unitTypeArb = fc.constantFrom(...UNIT_TYPES);

/**
 * Arbitrary for seed values.
 */
const seedArb = fc.integer({ min: 1, max: 100_000 });

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Property 9: Unit Weapon Minimum Area', () => {
    it('weapon element occupies at least 16 pixels (4×4 minimum area) for any unit type', () => {
        fc.assert(
            fc.property(unitTypeArb, seedArb, (unitType, seed) => {
                const palette = getPaletteForUnit(unitType);
                const pixelCount = countWeaponPixels(unitType, palette, seed);

                assert.ok(
                    pixelCount >= 16,
                    `Unit type "${unitType}" (seed=${seed}) has only ${pixelCount} weapon pixels. ` +
                    `Minimum required is 16 pixels (4×4 area).`
                );
            }),
            { numRuns: 100 }
        );
    });

    it('weapon element spans at least 4 pixels in both width and height', () => {
        fc.assert(
            fc.property(unitTypeArb, seedArb, (unitType, seed) => {
                const palette = getPaletteForUnit(unitType);
                const bounds = getWeaponBounds(unitType, palette, seed);

                assert.ok(
                    bounds.width >= 4,
                    `Unit type "${unitType}" (seed=${seed}) weapon bounding box width is ` +
                    `${bounds.width}px, minimum required is 4px.`
                );
                assert.ok(
                    bounds.height >= 4,
                    `Unit type "${unitType}" (seed=${seed}) weapon bounding box height is ` +
                    `${bounds.height}px, minimum required is 4px.`
                );
            }),
            { numRuns: 100 }
        );
    });
});
