/**
 * Generate damaged castle sprite variants (64×32 tile dimensions).
 *
 * Produces exactly 10 damaged variants of castle structure sprites:
 *   - castle-wall-damaged
 *   - castle-tower-damaged
 *   - castle-keep-tl-damaged
 *   - castle-keep-bl-damaged
 *   - castle-keep-br-damaged
 *   - castle-keep-center-damaged
 *   - castle-gatehouse-damaged
 *   - castle-bailey-1-damaged
 *   - castle-bailey-2-damaged
 *   - castle-bailey-3-damaged
 *
 * Each damaged variant replaces at least 15% of the stone block area
 * with cracks, missing blocks, or rubble debris pixels.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 *
 * Usage:
 *   node js/level-generators/generate-damaged-castle-sprites.js
 */

'use strict';

const sharp = require('sharp');
const path = require('path');

const {
    TILE_WIDTH,
    TILE_HEIGHT,
    OUTPUT_DIR,
    CASTLE_COLORS,
} = require('./lib/sprite-constants');

const {
    createBuffer,
    setPixel,
    isInsideDiamond,
    seededRandom,
    resetSeed,
    drawEdgeBorder,
} = require('./lib/pixel-utils');

const { fillDiamond } = require('./lib/fill-patterns');
const { applyFaceShading, applyShadowEdge } = require('./lib/shading');
const { quantizeToPalette } = require('./lib/palette-quantizer');
const { getPaletteForCategory } = require('./lib/palette');

// Castle palette for quantization (PRIMARY_PALETTE + CASTLE_ACCENT_COLORS)
const CASTLE_PALETTE = getPaletteForCategory('castle');

// ─── Constants ──────────────────────────────────────────────────────────────

/** Exactly 10 damaged castle variants (Requirement 9.1) */
const DAMAGED_CASTLE_TYPES = [
    { name: 'castle-wall-damaged', type: 'wall', seed: 50000 },
    { name: 'castle-tower-damaged', type: 'tower', seed: 50100 },
    { name: 'castle-keep-tl-damaged', type: 'keep-tl', seed: 50200 },
    { name: 'castle-keep-bl-damaged', type: 'keep-bl', seed: 50300 },
    { name: 'castle-keep-br-damaged', type: 'keep-br', seed: 50400 },
    { name: 'castle-keep-center-damaged', type: 'keep-center', seed: 50500 },
    { name: 'castle-gatehouse-damaged', type: 'gatehouse', seed: 50600 },
    { name: 'castle-bailey-1-damaged', type: 'bailey-1', seed: 50700 },
    { name: 'castle-bailey-2-damaged', type: 'bailey-2', seed: 50800 },
    { name: 'castle-bailey-3-damaged', type: 'bailey-3', seed: 50900 },
];

/** Minimum percentage of stone block area that must show damage */
const MIN_DAMAGE_PERCENT = 0.15;

// ─── Damage Colors ──────────────────────────────────────────────────────────
// All damage colors are drawn from CASTLE_COLORS palette values

const DAMAGE_COLORS = {
    crack: CASTLE_COLORS.wallDark,       // [125, 115, 95] - dark crack lines
    rubble: CASTLE_COLORS.wallMortar,    // [145, 135, 112] - rubble debris
    rubbleDark: CASTLE_COLORS.towerDark, // [105, 98, 80] - darker rubble
    gap: null,                           // transparent (missing blocks)
};

// ─── Stone Block Pattern (base for damaged sprites) ─────────────────────────

/**
 * Draws an enhanced stone masonry pattern identical to the undamaged castle
 * generator. This provides the base that damage is applied on top of.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number[]} stoneColor - Primary stone block color [r, g, b].
 * @param {number[]} stoneLightColor - Lighter stone variant for variation.
 * @param {number[]} mortarColor - Color for the 1-pixel mortar lines.
 * @param {number} seedValue - Seed for reproducible randomness.
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

// ─── Damage Application ─────────────────────────────────────────────────────

/**
 * Counts the number of opaque (non-transparent) pixels inside the diamond.
 * This represents the "stone block area" for damage percentage calculation.
 *
 * @param {Buffer} buffer - The pixel buffer to analyze.
 * @returns {number} Count of opaque pixels inside the diamond.
 */
function countOpaquePixels(buffer) {
    let count = 0;
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const index = (y * TILE_WIDTH + x) * 4;
                if (buffer[index + 3] > 0) {
                    count++;
                }
            }
        }
    }
    return count;
}

/**
 * Applies crack damage to the buffer. Cracks are dark jagged lines
 * that run diagonally or vertically through stone blocks.
 *
 * @param {Buffer} buffer - The pixel buffer to damage.
 * @param {number} seedValue - Seed for reproducible crack placement.
 * @param {number} crackCount - Number of crack lines to draw.
 * @returns {number} Number of pixels modified.
 */
function applyCracks(buffer, seedValue, crackCount) {
    resetSeed(seedValue);
    let pixelsModified = 0;

    for (let crack = 0; crack < crackCount; crack++) {
        // Random start position within the diamond
        let x = 10 + Math.floor(seededRandom() * (TILE_WIDTH - 20));
        let y = 4 + Math.floor(seededRandom() * (TILE_HEIGHT - 8));
        const crackLength = 8 + Math.floor(seededRandom() * 12);

        for (let step = 0; step < crackLength; step++) {
            if (isInsideDiamond(x, y)) {
                const index = (y * TILE_WIDTH + x) * 4;
                if (buffer[index + 3] > 0) {
                    setPixel(buffer, x, y, ...DAMAGE_COLORS.crack);
                    pixelsModified++;
                    // Widen crack occasionally (2px wide)
                    if (seededRandom() > 0.5 && isInsideDiamond(x + 1, y)) {
                        setPixel(buffer, x + 1, y, ...DAMAGE_COLORS.crack);
                        pixelsModified++;
                    }
                }
            }
            // Random walk: mostly downward with horizontal jitter
            x += Math.floor(seededRandom() * 3) - 1;
            y += Math.floor(seededRandom() * 2);
        }
    }
    return pixelsModified;
}

/**
 * Applies missing block damage — removes rectangular sections of stone
 * by making them transparent (gaps) or filling with rubble.
 *
 * @param {Buffer} buffer - The pixel buffer to damage.
 * @param {number} seedValue - Seed for reproducible block removal.
 * @param {number} blockCount - Number of blocks to remove.
 * @returns {number} Number of pixels modified.
 */
function applyMissingBlocks(buffer, seedValue, blockCount) {
    resetSeed(seedValue);
    let pixelsModified = 0;

    for (let block = 0; block < blockCount; block++) {
        const blockX = 12 + Math.floor(seededRandom() * (TILE_WIDTH - 24));
        const blockY = 4 + Math.floor(seededRandom() * (TILE_HEIGHT - 10));
        const blockW = 4 + Math.floor(seededRandom() * 5);
        const blockH = 3 + Math.floor(seededRandom() * 3);
        const makeTransparent = seededRandom() > 0.5;

        for (let py = 0; py < blockH; py++) {
            for (let px = 0; px < blockW; px++) {
                const x = blockX + px;
                const y = blockY + py;
                if (isInsideDiamond(x, y)) {
                    const index = (y * TILE_WIDTH + x) * 4;
                    if (buffer[index + 3] > 0) {
                        if (makeTransparent) {
                            // Missing block — transparent gap
                            buffer[index] = 0;
                            buffer[index + 1] = 0;
                            buffer[index + 2] = 0;
                            buffer[index + 3] = 0;
                        } else {
                            // Rubble-filled gap
                            const rubbleColor = seededRandom() > 0.5
                                ? DAMAGE_COLORS.rubble
                                : DAMAGE_COLORS.rubbleDark;
                            setPixel(buffer, x, y, ...rubbleColor);
                        }
                        pixelsModified++;
                    }
                }
            }
        }
    }
    return pixelsModified;
}

/**
 * Applies rubble debris at the base of the sprite — scattered stone
 * fragments along the bottom portion of the diamond.
 *
 * @param {Buffer} buffer - The pixel buffer to damage.
 * @param {number} seedValue - Seed for reproducible rubble placement.
 * @param {number} rubbleCount - Number of rubble clusters to draw.
 * @returns {number} Number of pixels modified.
 */
function applyRubbleDebris(buffer, seedValue, rubbleCount) {
    resetSeed(seedValue);
    let pixelsModified = 0;

    for (let cluster = 0; cluster < rubbleCount; cluster++) {
        // Rubble tends to accumulate at the bottom half
        const clusterX = 16 + Math.floor(seededRandom() * (TILE_WIDTH - 32));
        const clusterY = Math.floor(TILE_HEIGHT * 0.5) + Math.floor(seededRandom() * (TILE_HEIGHT * 0.4));
        const clusterSize = 3 + Math.floor(seededRandom() * 4);

        for (let py = 0; py < clusterSize; py++) {
            for (let px = 0; px < clusterSize; px++) {
                if (seededRandom() > 0.3) {
                    const x = clusterX + px;
                    const y = clusterY + py;
                    if (isInsideDiamond(x, y)) {
                        const index = (y * TILE_WIDTH + x) * 4;
                        if (buffer[index + 3] > 0) {
                            const rubbleColor = seededRandom() > 0.4
                                ? DAMAGE_COLORS.rubble
                                : DAMAGE_COLORS.rubbleDark;
                            setPixel(buffer, x, y, ...rubbleColor);
                            pixelsModified++;
                        }
                    }
                }
            }
        }
    }
    return pixelsModified;
}

/**
 * Applies damage to a buffer ensuring at least MIN_DAMAGE_PERCENT of the
 * stone block area is replaced by damage indicators.
 *
 * Strategy: Apply cracks, missing blocks, and rubble in increasing amounts
 * until the 15% threshold is met.
 *
 * @param {Buffer} buffer - The pixel buffer to damage (modified in place).
 * @param {number} seedValue - Base seed for all damage operations.
 * @param {number} totalOpaquePixels - Total opaque pixel count before damage.
 */
function applyDamage(buffer, seedValue, totalOpaquePixels) {
    const targetDamagePixels = Math.ceil(totalOpaquePixels * MIN_DAMAGE_PERCENT);
    let totalDamaged = 0;

    // Phase 1: Cracks (typically covers ~5-8% of area)
    totalDamaged += applyCracks(buffer, seedValue + 1000, 6);

    // Phase 2: Missing blocks (typically covers ~5-8% of area)
    totalDamaged += applyMissingBlocks(buffer, seedValue + 2000, 4);

    // Phase 3: Rubble debris (fills remaining gap to reach 15%)
    totalDamaged += applyRubbleDebris(buffer, seedValue + 3000, 5);

    // Phase 4: If still below threshold, add more damage
    let extraPass = 0;
    while (totalDamaged < targetDamagePixels && extraPass < 10) {
        extraPass++;
        totalDamaged += applyCracks(buffer, seedValue + 4000 + extraPass * 100, 3);
        totalDamaged += applyMissingBlocks(buffer, seedValue + 5000 + extraPass * 100, 2);
        totalDamaged += applyRubbleDebris(buffer, seedValue + 6000 + extraPass * 100, 3);
    }
}

// ─── Sprite Generation Functions ────────────────────────────────────────────

/**
 * Generates a damaged wall sprite — stone block wall with cracks and gaps.
 * @param {number} seedValue - Base seed for deterministic generation.
 * @returns {Buffer} The completed 64×32 RGBA pixel buffer.
 */
function generateDamagedWall(seedValue) {
    const buffer = createBuffer();
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, seedValue);
    const opaqueCount = countOpaquePixels(buffer);
    applyDamage(buffer, seedValue, opaqueCount);
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates a damaged tower sprite — circular tower with crumbling top.
 * @param {number} seedValue - Base seed for deterministic generation.
 * @returns {Buffer} The completed 64×32 RGBA pixel buffer.
 */
function generateDamagedTower(seedValue) {
    const buffer = createBuffer();
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

    const opaqueCount = countOpaquePixels(buffer);
    applyDamage(buffer, seedValue, opaqueCount);
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates a damaged keep top-left sprite.
 * @param {number} seedValue - Base seed for deterministic generation.
 * @returns {Buffer} The completed 64×32 RGBA pixel buffer.
 */
function generateDamagedKeepTL(seedValue) {
    const buffer = createBuffer();
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.tower, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallMortar, seedValue);

    // Window slit (partially destroyed)
    const slitX = 30;
    const slitY = 12;
    for (let dy = 0; dy < 2; dy++) {
        if (isInsideDiamond(slitX, slitY + dy)) {
            setPixel(buffer, slitX, slitY + dy, 25, 25, 22);
        }
    }

    const opaqueCount = countOpaquePixels(buffer);
    applyDamage(buffer, seedValue, opaqueCount);
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates a damaged keep bottom-left sprite.
 * @param {number} seedValue - Base seed for deterministic generation.
 * @returns {Buffer} The completed 64×32 RGBA pixel buffer.
 */
function generateDamagedKeepBL(seedValue) {
    const buffer = createBuffer();
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.tower, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallMortar, seedValue);

    // Window slit (cracked)
    const slitX = 34;
    const slitY = 14;
    for (let dy = 0; dy < 2; dy++) {
        if (isInsideDiamond(slitX, slitY + dy)) {
            setPixel(buffer, slitX, slitY + dy, 25, 25, 22);
        }
    }

    const opaqueCount = countOpaquePixels(buffer);
    applyDamage(buffer, seedValue, opaqueCount);
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates a damaged keep bottom-right sprite.
 * @param {number} seedValue - Base seed for deterministic generation.
 * @returns {Buffer} The completed 64×32 RGBA pixel buffer.
 */
function generateDamagedKeepBR(seedValue) {
    const buffer = createBuffer();
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.tower, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallMortar, seedValue);

    const opaqueCount = countOpaquePixels(buffer);
    applyDamage(buffer, seedValue, opaqueCount);
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates a damaged keep center sprite — broken flag pole, crumbling stone.
 * @param {number} seedValue - Base seed for deterministic generation.
 * @returns {Buffer} The completed 64×32 RGBA pixel buffer.
 */
function generateDamagedKeepCenter(seedValue) {
    const buffer = createBuffer();
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, seedValue);

    // Broken flag pole (shorter than undamaged version)
    for (let y = 8; y <= 14; y++) {
        if (isInsideDiamond(32, y)) {
            setPixel(buffer, 32, y, 55, 35, 18);
        }
    }

    const opaqueCount = countOpaquePixels(buffer);
    applyDamage(buffer, seedValue, opaqueCount);
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates a damaged gatehouse sprite — collapsed arch, bent portcullis.
 * @param {number} seedValue - Base seed for deterministic generation.
 * @returns {Buffer} The completed 64×32 RGBA pixel buffer.
 */
function generateDamagedGatehouse(seedValue) {
    const buffer = createBuffer();
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, seedValue);

    // Partially collapsed archway (smaller than undamaged)
    resetSeed(seedValue + 70);
    for (let y = 10; y <= 22; y++) {
        for (let x = 24; x <= 40; x++) {
            if (isInsideDiamond(x, y)) {
                setPixel(buffer, x, y, 25, 22, 20);
            }
        }
    }

    // Bent/broken iron bars (fewer than undamaged)
    for (let x = 25; x <= 39; x += 4) {
        for (let y = 11; y <= 20; y++) {
            if (isInsideDiamond(x, y)) {
                setPixel(buffer, x, y, ...CASTLE_COLORS.iron);
            }
        }
    }

    const opaqueCount = countOpaquePixels(buffer);
    applyDamage(buffer, seedValue, opaqueCount);
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates a damaged bailey-1 sprite — dirt floor with scattered rubble.
 * @param {number} seedValue - Base seed for deterministic generation.
 * @returns {Buffer} The completed 64×32 RGBA pixel buffer.
 */
function generateDamagedBailey1(seedValue) {
    const buffer = createBuffer();

    resetSeed(seedValue);
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noise = (seededRandom() - 0.5) * 12;
                setPixel(buffer, x, y, 200 + noise, 155 + noise * 0.8, 100 + noise * 0.6);
            }
        }
    }

    const opaqueCount = countOpaquePixels(buffer);
    applyDamage(buffer, seedValue, opaqueCount);
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates a damaged bailey-2 sprite — mixed dirt/straw with debris.
 * @param {number} seedValue - Base seed for deterministic generation.
 * @returns {Buffer} The completed 64×32 RGBA pixel buffer.
 */
function generateDamagedBailey2(seedValue) {
    const buffer = createBuffer();

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

    const opaqueCount = countOpaquePixels(buffer);
    applyDamage(buffer, seedValue, opaqueCount);
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates a damaged bailey-3 sprite — dense straw with scattered rubble.
 * @param {number} seedValue - Base seed for deterministic generation.
 * @returns {Buffer} The completed 64×32 RGBA pixel buffer.
 */
function generateDamagedBailey3(seedValue) {
    const buffer = createBuffer();

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

    const opaqueCount = countOpaquePixels(buffer);
    applyDamage(buffer, seedValue, opaqueCount);
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

// ─── Sprite Dispatch ────────────────────────────────────────────────────────

/**
 * Generates a single damaged castle sprite buffer based on type.
 *
 * @param {string} type - The castle type key (e.g. 'wall', 'tower', 'keep-tl').
 * @param {number} seedValue - Base seed for deterministic rendering.
 * @returns {Buffer} The completed 64×32 RGBA pixel buffer.
 */
function generateDamagedCastleSprite(type, seedValue) {
    switch (type) {
        case 'wall':        return generateDamagedWall(seedValue);
        case 'tower':       return generateDamagedTower(seedValue);
        case 'keep-tl':     return generateDamagedKeepTL(seedValue);
        case 'keep-bl':     return generateDamagedKeepBL(seedValue);
        case 'keep-br':     return generateDamagedKeepBR(seedValue);
        case 'keep-center': return generateDamagedKeepCenter(seedValue);
        case 'gatehouse':   return generateDamagedGatehouse(seedValue);
        case 'bailey-1':    return generateDamagedBailey1(seedValue);
        case 'bailey-2':    return generateDamagedBailey2(seedValue);
        case 'bailey-3':    return generateDamagedBailey3(seedValue);
        default:
            throw new Error(`Unknown damaged castle type: "${type}"`);
    }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function generateAll() {
    console.log('Generating damaged castle sprites (64×32)...\n');

    for (const entry of DAMAGED_CASTLE_TYPES) {
        const buffer = generateDamagedCastleSprite(entry.type, entry.seed);
        await sharp(buffer, { raw: { width: TILE_WIDTH, height: TILE_HEIGHT, channels: 4 } })
            .png()
            .toFile(path.join(OUTPUT_DIR, `${entry.name}.png`));
        console.log(`  ✓ ${entry.name}.png`);
    }

    console.log(`\nDone! ${DAMAGED_CASTLE_TYPES.length} damaged castle sprites (64×32, enhanced).`);
}

// Export for testing
module.exports = {
    generateDamagedCastleSprite,
    generateDamagedWall,
    generateDamagedTower,
    generateDamagedKeepTL,
    generateDamagedKeepBL,
    generateDamagedKeepBR,
    generateDamagedKeepCenter,
    generateDamagedGatehouse,
    generateDamagedBailey1,
    generateDamagedBailey2,
    generateDamagedBailey3,
    applyCracks,
    applyMissingBlocks,
    applyRubbleDebris,
    applyDamage,
    countOpaquePixels,
    DAMAGED_CASTLE_TYPES,
    CASTLE_PALETTE,
    MIN_DAMAGE_PERCENT,
};

// Run if executed directly
if (require.main === module) {
    generateAll().catch(error => {
        console.error(`[SPRITE-BUILD-ERROR] generate-damaged-castle-sprites: ${error.message}`);
        console.error(`  Stage: generation`);
        console.error(`  Details: ${error.stack}`);
        process.exit(1);
    });
}
