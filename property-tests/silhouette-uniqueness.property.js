/**
 * Property 8: Unit Silhouette Uniqueness
 *
 * For any pair of different unit types (player or enemy), when both sprites
 * are reduced to 1-bit masks at native resolution, the masks SHALL differ
 * in at least one pixel position.
 *
 * Feature: enhanced-pixel-art-sprites, Property 8: Unit Silhouette Uniqueness
 *
 * **Validates: Requirements 3.1, 3.5**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const {
    generateUnitSprite,
    getSilhouette,
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
 * Extracts a 1-bit silhouette mask from a 32×32 RGBA buffer.
 * A pixel is "on" (1) if alpha > 0, "off" (0) if alpha === 0.
 * @param {Buffer} buffer - 32×32 RGBA pixel buffer
 * @returns {Uint8Array} 1-bit mask (1024 entries, one per pixel)
 */
function extractMask(buffer) {
    const totalPixels = UNIT_SIZE * UNIT_SIZE;
    const mask = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
        const alpha = buffer[i * 4 + 3];
        mask[i] = alpha > 0 ? 1 : 0;
    }
    return mask;
}

/**
 * Checks if two masks differ in at least one pixel position.
 * @param {Uint8Array} maskA
 * @param {Uint8Array} maskB
 * @returns {boolean}
 */
function masksAreDifferent(maskA, maskB) {
    for (let i = 0; i < maskA.length; i++) {
        if (maskA[i] !== maskB[i]) return true;
    }
    return false;
}

/**
 * Generates all unique pairs from an array.
 */
function allPairs(arr) {
    const pairs = [];
    for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
            pairs.push([arr[i], arr[j]]);
        }
    }
    return pairs;
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

/**
 * Arbitrary that generates a pair of distinct unit types.
 */
const unitPairArb = fc.constantFrom(...allPairs(UNIT_TYPES));

/**
 * Arbitrary for seed values.
 */
const seedArb = fc.integer({ min: 1, max: 100_000 });

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Property 8: Unit Silhouette Uniqueness', () => {
    it('any pair of different unit types produces different 1-bit masks at native 32×32 resolution', () => {
        fc.assert(
            fc.property(unitPairArb, seedArb, ([typeA, typeB], seed) => {
                const paletteA = getPaletteForUnit(typeA);
                const paletteB = getPaletteForUnit(typeB);

                const bufferA = generateUnitSprite(typeA, paletteA, seed);
                const bufferB = generateUnitSprite(typeB, paletteB, seed);

                const maskA = extractMask(bufferA);
                const maskB = extractMask(bufferB);

                assert.strictEqual(
                    masksAreDifferent(maskA, maskB),
                    true,
                    `Unit types "${typeA}" and "${typeB}" (seed=${seed}) produce identical ` +
                    `1-bit silhouette masks at native 32×32 resolution. ` +
                    `They must differ in at least one pixel position.`
                );
            }),
            { numRuns: 100 }
        );
    });

    it('silhouette definitions are structurally unique for each unit type', () => {
        fc.assert(
            fc.property(unitPairArb, ([typeA, typeB]) => {
                const silA = getSilhouette(typeA);
                const silB = getSilhouette(typeB);

                // Convert silhouettes to comparable strings
                const strA = JSON.stringify(silA);
                const strB = JSON.stringify(silB);

                assert.notStrictEqual(
                    strA,
                    strB,
                    `Unit types "${typeA}" and "${typeB}" have identical silhouette definitions. ` +
                    `Each unit type must have a unique silhouette shape.`
                );
            }),
            { numRuns: 100 }
        );
    });
});
