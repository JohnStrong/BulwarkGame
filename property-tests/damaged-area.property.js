/**
 * Property 17: Damaged Sprite Minimum Damage Area
 *
 * For any damaged castle sprite variant, at least 15% of the stone block area
 * pixels present in the undamaged version SHALL be replaced by damage indicators
 * (cracks, gaps, or rubble-colored pixels).
 *
 * Feature: enhanced-pixel-art-sprites, Property 17: Damaged Sprite Minimum Damage Area
 *
 * **Validates: Requirements 9.2**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const {
    generateDamagedCastleSprite,
    DAMAGED_CASTLE_TYPES,
    countOpaquePixels,
    MIN_DAMAGE_PERCENT,
    CASTLE_PALETTE,
} = require('../js/level-generators/generate-damaged-castle-sprites');
const { TILE_WIDTH, TILE_HEIGHT } = require('../js/level-generators/lib/sprite-constants');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generates the undamaged base buffer for a given castle type and seed.
 * This replicates the base stone pattern generation without applying damage,
 * allowing us to compare against the damaged version pixel-by-pixel.
 */
const {
    createBuffer,
    setPixel,
    isInsideDiamond,
    seededRandom,
    resetSeed,
    drawEdgeBorder,
} = require('../js/level-generators/lib/pixel-utils');
const { fillDiamond } = require('../js/level-generators/lib/fill-patterns');
const { applyFaceShading, applyShadowEdge } = require('../js/level-generators/lib/shading');
const { quantizeToPalette } = require('../js/level-generators/lib/palette-quantizer');
const { CASTLE_COLORS } = require('../js/level-generators/lib/sprite-constants');

/**
 * Draws enhanced stone blocks (same logic as the damaged castle generator base).
 */
function drawEnhancedStoneBlocks(buffer, stoneColor, stoneLightColor, mortarColor, seedValue) {
    fillDiamond(buffer, mortarColor, 4, seedValue);
    resetSeed(seedValue + 100);

    const courseHeight = 5;
    const mortarThickness = 1;
    const blockMinWidth = 6;
    const blockMaxWidth = 10;

    for (let courseIndex = 0; courseIndex < Math.floor(TILE_HEIGHT / courseHeight); courseIndex++) {
        const courseY = courseIndex * courseHeight;
        const rowOffset = (courseIndex % 2 === 0) ? 0 : 4;

        let blockX = rowOffset;
        while (blockX < TILE_WIDTH) {
            const blockWidth = blockMinWidth + Math.floor(seededRandom() * (blockMaxWidth - blockMinWidth + 1));
            const useLight = seededRandom() > 0.5;
            const baseBlockColor = useLight ? stoneLightColor : stoneColor;

            for (let py = 0; py < courseHeight - mortarThickness; py++) {
                for (let px = 0; px < blockWidth - 1; px++) {
                    const x = blockX + px;
                    const y = courseY + py;
                    if (x >= 0 && x < TILE_WIDTH && y >= 0 && y < TILE_HEIGHT && isInsideDiamond(x, y)) {
                        const variation = (seededRandom() - 0.5) * 12;
                        setPixel(buffer, x, y,
                            baseBlockColor[0] + variation,
                            baseBlockColor[1] + variation,
                            baseBlockColor[2] + variation);
                    }
                }
            }
            blockX += blockWidth;
        }
    }
}

/**
 * Generates an undamaged base buffer for a given castle type.
 * This mirrors the base generation in generate-damaged-castle-sprites.js
 * but WITHOUT applying damage, shading, border, or quantization —
 * we only need the raw stone block area to count the base opaque pixels.
 */
function generateUndamagedBase(type, seedValue) {
    const buffer = createBuffer();

    switch (type) {
        case 'wall':
            drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, seedValue);
            break;
        case 'tower': {
            fillDiamond(buffer, CASTLE_COLORS.tower, 8, seedValue);
            const centerX = 32;
            const centerY = 16;
            const towerRadius = 12;
            resetSeed(seedValue + 50);
            for (let offsetY = -towerRadius; offsetY <= towerRadius; offsetY++) {
                for (let offsetX = -towerRadius; offsetX <= towerRadius; offsetX++) {
                    const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
                    if (distance <= towerRadius && isInsideDiamond(centerX + offsetX, centerY + offsetY)) {
                        const noise = (seededRandom() - 0.5) * 8;
                        let stoneColor;
                        if (distance > towerRadius - 2) {
                            stoneColor = CASTLE_COLORS.towerDark;
                        } else if (distance > towerRadius - 4) {
                            stoneColor = CASTLE_COLORS.tower;
                        } else {
                            stoneColor = CASTLE_COLORS.towerLight;
                        }
                        setPixel(buffer, centerX + offsetX, centerY + offsetY,
                            stoneColor[0] + noise, stoneColor[1] + noise, stoneColor[2] + noise);
                    }
                }
            }
            break;
        }
        case 'keep-tl':
        case 'keep-bl':
        case 'keep-br':
            drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.tower, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallMortar, seedValue);
            break;
        case 'keep-center':
            drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, seedValue);
            break;
        case 'gatehouse':
            drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, seedValue);
            break;
        case 'bailey-1': {
            resetSeed(seedValue);
            for (let y = 0; y < TILE_HEIGHT; y++) {
                for (let x = 0; x < TILE_WIDTH; x++) {
                    if (isInsideDiamond(x, y)) {
                        const noise = (seededRandom() - 0.5) * 12;
                        setPixel(buffer, x, y, 200 + noise, 155 + noise * 0.8, 100 + noise * 0.6);
                    }
                }
            }
            break;
        }
        case 'bailey-2': {
            resetSeed(seedValue);
            for (let y = 0; y < TILE_HEIGHT; y++) {
                for (let x = 0; x < TILE_WIDTH; x++) {
                    if (isInsideDiamond(x, y)) {
                        const noise = (seededRandom() - 0.5) * 10;
                        const isStraw = seededRandom() > 0.4;
                        if (isStraw) {
                            setPixel(buffer, x, y,
                                CASTLE_COLORS.straw[0] + noise,
                                CASTLE_COLORS.straw[1] + noise,
                                CASTLE_COLORS.straw[2] + noise);
                        } else {
                            setPixel(buffer, x, y, 195 + noise, 150 + noise * 0.8, 95 + noise * 0.6);
                        }
                    }
                }
            }
            break;
        }
        case 'bailey-3': {
            resetSeed(seedValue);
            for (let y = 0; y < TILE_HEIGHT; y++) {
                for (let x = 0; x < TILE_WIDTH; x++) {
                    if (isInsideDiamond(x, y)) {
                        const noise = (seededRandom() - 0.5) * 10;
                        const strawColor = seededRandom() > 0.3 ? CASTLE_COLORS.straw : CASTLE_COLORS.strawDark;
                        setPixel(buffer, x, y,
                            strawColor[0] + noise,
                            strawColor[1] + noise,
                            strawColor[2] + noise);
                    }
                }
            }
            break;
        }
        default:
            throw new Error(`Unknown castle type: ${type}`);
    }

    return buffer;
}

/**
 * Counts the number of pixels that differ between two buffers within the
 * diamond area. A pixel "differs" if its RGBA values are not identical.
 * Transparent pixels in the damaged buffer that were opaque in the undamaged
 * buffer count as damage (missing blocks / gaps).
 *
 * @param {Buffer} undamagedBuffer - The undamaged base buffer.
 * @param {Buffer} damagedBuffer - The damaged sprite buffer.
 * @returns {number} Count of pixels that changed (damage indicators).
 */
function countDamagedPixels(undamagedBuffer, damagedBuffer) {
    let damagedCount = 0;

    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (!isInsideDiamond(x, y)) continue;

            const index = (y * TILE_WIDTH + x) * 4;
            const undamagedAlpha = undamagedBuffer[index + 3];

            // Only count pixels that were opaque in the undamaged version
            if (undamagedAlpha === 0) continue;

            const damagedR = damagedBuffer[index];
            const damagedG = damagedBuffer[index + 1];
            const damagedB = damagedBuffer[index + 2];
            const damagedA = damagedBuffer[index + 3];

            const undamagedR = undamagedBuffer[index];
            const undamagedG = undamagedBuffer[index + 1];
            const undamagedB = undamagedBuffer[index + 2];

            // If the pixel became transparent (gap) or changed color (crack/rubble)
            if (damagedA === 0) {
                damagedCount++;
            } else if (damagedR !== undamagedR || damagedG !== undamagedG || damagedB !== undamagedB) {
                damagedCount++;
            }
        }
    }

    return damagedCount;
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

/**
 * Arbitrary for damaged castle type selection (one of the 10 types).
 */
const damagedTypeArb = fc.constantFrom(...DAMAGED_CASTLE_TYPES.map(entry => ({
    type: entry.type,
    name: entry.name,
})));

/**
 * Arbitrary for seed values.
 */
const seedArb = fc.integer({ min: 1, max: 100_000 });

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Property 17: Damaged Sprite Minimum Damage Area', () => {
    it('each damaged castle sprite has at least 15% of stone block area replaced by damage indicators', () => {
        fc.assert(
            fc.property(damagedTypeArb, seedArb, ({ type, name }, seed) => {
                // Generate the undamaged base to count the original stone block area
                const undamagedBuffer = generateUndamagedBase(type, seed);
                const totalStoneArea = countOpaquePixels(undamagedBuffer);

                // Generate the damaged sprite
                const damagedBuffer = generateDamagedCastleSprite(type, seed);

                // Count pixels that differ between undamaged base and damaged sprite
                const damagedPixelCount = countDamagedPixels(undamagedBuffer, damagedBuffer);

                // Calculate damage percentage
                const damagePercent = totalStoneArea > 0
                    ? damagedPixelCount / totalStoneArea
                    : 0;

                assert.ok(
                    damagePercent >= MIN_DAMAGE_PERCENT,
                    `Damaged castle sprite "${name}" (type="${type}", seed=${seed}) ` +
                    `has only ${(damagePercent * 100).toFixed(2)}% damage ` +
                    `(${damagedPixelCount}/${totalStoneArea} pixels), ` +
                    `but at least ${(MIN_DAMAGE_PERCENT * 100).toFixed(1)}% is required.`
                );
            }),
            { numRuns: 100 }
        );
    });
});
