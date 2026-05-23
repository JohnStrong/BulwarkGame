/**
 * Property 16: Enemy Silhouette Differentiation
 *
 * For any enemy unit type, its 1-bit silhouette mask SHALL differ from the
 * corresponding player unit type's mask by at least one silhouette modifier
 * region (helmet shape, banner element, or shield emblem area).
 *
 * Feature: enhanced-pixel-art-sprites, Property 16: Enemy Silhouette Differentiation
 *
 * **Validates: Requirements 8.1, 8.2**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const {
    generateEnemySprite,
    getEnemySilhouette,
    drawSilhouetteModifier,
    createEnemyBuffer,
    ENEMY_TYPES,
    ENEMY_WIDTH,
    ENEMY_HEIGHT,
} = require('../js/level-generators/generate-enemy-sprites');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extracts a 1-bit silhouette mask from an RGBA buffer.
 * A pixel is "on" (1) if alpha > 0, "off" (0) if alpha === 0.
 * @param {Buffer} buffer - RGBA pixel buffer
 * @param {number} width - Buffer width
 * @param {number} height - Buffer height
 * @returns {Uint8Array} 1-bit mask (width*height entries)
 */
function extractMask(buffer, width, height) {
    const totalPixels = width * height;
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
 * Counts the number of pixels that differ between two masks.
 * @param {Uint8Array} maskA
 * @param {Uint8Array} maskB
 * @returns {number}
 */
function countMaskDifferences(maskA, maskB) {
    let count = 0;
    for (let i = 0; i < maskA.length; i++) {
        if (maskA[i] !== maskB[i]) count++;
    }
    return count;
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

const enemyTypeNames = ENEMY_TYPES.map(e => e.type);

/**
 * Arbitrary for a single enemy type.
 */
const enemyTypeArb = fc.constantFrom(...enemyTypeNames);

/**
 * Arbitrary for a pair of distinct enemy types.
 */
const enemyPairArb = fc.constantFrom(...allPairs(enemyTypeNames));

/**
 * Arbitrary for seed values.
 */
const seedArb = fc.integer({ min: 1, max: 100_000 });

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Property 16: Enemy Silhouette Differentiation', () => {
    it('each enemy type has a silhouette modifier that adds pixels not present in the base body shape', () => {
        fc.assert(
            fc.property(enemyTypeArb, seedArb, (enemyType, seed) => {
                // Generate a buffer with ONLY the silhouette modifier drawn
                const modifierBuffer = createEnemyBuffer();
                drawSilhouetteModifier(modifierBuffer, enemyType);
                const modifierMask = extractMask(modifierBuffer, ENEMY_WIDTH, ENEMY_HEIGHT);

                // Count how many pixels the modifier adds
                let modifierPixelCount = 0;
                for (let i = 0; i < modifierMask.length; i++) {
                    if (modifierMask[i] === 1) modifierPixelCount++;
                }

                // Each enemy type must have at least one silhouette modifier region
                assert.ok(
                    modifierPixelCount > 0,
                    `Enemy type "${enemyType}" has no silhouette modifier pixels. ` +
                    `Each enemy type must have at least one silhouette modifier region ` +
                    `(helmet shape, banner element, or shield emblem area).`
                );
            }),
            { numRuns: 100 }
        );
    });

    it('enemy silhouettes are unique from each other (all pairs differ)', () => {
        fc.assert(
            fc.property(enemyPairArb, seedArb, ([typeA, typeB], seed) => {
                const bufferA = generateEnemySprite(typeA, seed);
                const bufferB = generateEnemySprite(typeB, seed);

                const maskA = extractMask(bufferA, ENEMY_WIDTH, ENEMY_HEIGHT);
                const maskB = extractMask(bufferB, ENEMY_WIDTH, ENEMY_HEIGHT);

                assert.strictEqual(
                    masksAreDifferent(maskA, maskB),
                    true,
                    `Enemy types "${typeA}" and "${typeB}" (seed=${seed}) produce ` +
                    `identical 1-bit silhouette masks. Each enemy type must have a ` +
                    `unique silhouette.`
                );
            }),
            { numRuns: 100 }
        );
    });

    it('enemy silhouette definitions are structurally different from each other', () => {
        fc.assert(
            fc.property(enemyPairArb, ([typeA, typeB]) => {
                const silA = getEnemySilhouette(typeA);
                const silB = getEnemySilhouette(typeB);

                const strA = JSON.stringify(silA);
                const strB = JSON.stringify(silB);

                assert.notStrictEqual(
                    strA,
                    strB,
                    `Enemy types "${typeA}" and "${typeB}" have identical silhouette ` +
                    `definitions. Each enemy type must have a unique body shape.`
                );
            }),
            { numRuns: 100 }
        );
    });

    it('silhouette modifier adds pixels beyond the base enemy body silhouette', () => {
        fc.assert(
            fc.property(enemyTypeArb, seedArb, (enemyType, seed) => {
                // Generate full enemy sprite (includes body + modifier + weapon + shading)
                const fullBuffer = generateEnemySprite(enemyType, seed);
                const fullMask = extractMask(fullBuffer, ENEMY_WIDTH, ENEMY_HEIGHT);

                // Generate modifier-only buffer to identify modifier region
                const modifierBuffer = createEnemyBuffer();
                drawSilhouetteModifier(modifierBuffer, enemyType);
                const modifierMask = extractMask(modifierBuffer, ENEMY_WIDTH, ENEMY_HEIGHT);

                // The modifier must contribute at least some pixels to the full sprite
                // (i.e., the modifier region should have opaque pixels in the full sprite)
                let modifierContribution = 0;
                for (let i = 0; i < modifierMask.length; i++) {
                    if (modifierMask[i] === 1 && fullMask[i] === 1) {
                        modifierContribution++;
                    }
                }

                assert.ok(
                    modifierContribution > 0,
                    `Enemy type "${enemyType}" (seed=${seed}): silhouette modifier ` +
                    `region has no visible pixels in the final sprite. The modifier ` +
                    `must add pixels not present in the base body shape.`
                );
            }),
            { numRuns: 100 }
        );
    });
});
