/**
 * Shared diamond fill patterns used by multiple sprite generators.
 *
 * These are the common "base layer" operations that most sprites start with:
 *   - fillDiamond: solid color fill with noise (used by terrain, castle, and unit sprites)
 *   - fillDiamondWithSpeckle: same as fillDiamond but with occasional bright/dark spots
 *   - drawStoneBlocks: stone masonry pattern (used by castle walls, keep, gatehouse)
 *
 * All functions operate on a pixel buffer and respect the isometric diamond boundary.
 */

const {
    TILE_WIDTH,
    TILE_HEIGHT,
    setPixel,
    isInsideDiamond,
    seededRandom,
    resetSeed,
} = require('./pixel-utils');

// ─── Basic Diamond Fills ────────────────────────────────────────────────────

/**
 * Fills the diamond area with a solid color plus uniform per-pixel noise.
 * This is the simplest fill — no speckles, just smooth color variation.
 * Used by castle sprites where speckle would look wrong on stone.
 *
 * @param {Buffer} buffer - The pixel buffer to fill.
 * @param {number[]} baseColor - Base [red, green, blue] color.
 * @param {number} noiseAmount - Maximum noise range (e.g. 12 means ±6).
 * @param {number} seedValue - Seed for reproducible randomness.
 */
function fillDiamond(buffer, baseColor, noiseAmount, seedValue) {
    resetSeed(seedValue);

    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noise = (seededRandom() - 0.5) * noiseAmount;
                setPixel(buffer, x, y,
                    baseColor[0] + noise,
                    baseColor[1] + noise,
                    baseColor[2] + noise);
            }
        }
    }
}

/**
 * Fills the diamond area with a solid color, per-pixel noise, and occasional
 * bright/dark speckles for a more natural, organic look.
 * Used by terrain sprites (grass, road, water) where natural variation matters.
 *
 * @param {Buffer} buffer - The pixel buffer to fill.
 * @param {number[]} baseColor - Base [red, green, blue] color.
 * @param {number} noiseAmount - Maximum noise range (e.g. 12 means ±6).
 * @param {number} seedValue - Seed for reproducible randomness.
 */
function fillDiamondWithSpeckle(buffer, baseColor, noiseAmount, seedValue) {
    resetSeed(seedValue);

    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noise = (seededRandom() - 0.5) * noiseAmount;

                // Occasional bright or dark speckle for natural variation
                const speckle = seededRandom() > 0.92 ? 10 : (seededRandom() < 0.08 ? -8 : 0);

                setPixel(buffer, x, y,
                    baseColor[0] + noise + speckle,
                    baseColor[1] + noise + speckle,
                    baseColor[2] + noise + speckle);
            }
        }
    }
}

// ─── Stone Block Pattern ────────────────────────────────────────────────────

/**
 * Draws a stone masonry pattern over the diamond area.
 * First fills with mortar color, then draws offset rows of stone blocks.
 * Used by castle walls, keep tiles, and gatehouse.
 *
 * The pattern resembles brickwork: each row of blocks is offset by half
 * a block width from the row above, creating a staggered look.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number[]} stoneColor - Primary stone block color [r, g, b].
 * @param {number[]} stoneLightColor - Lighter stone variant (randomly chosen per block).
 * @param {number[]} mortarColor - Color for the gaps between blocks.
 * @param {number} seedValue - Seed for reproducible randomness.
 */
function drawStoneBlocks(buffer, stoneColor, stoneLightColor, mortarColor, seedValue) {
    // First pass: fill entire diamond with mortar (the gaps between stones)
    fillDiamond(buffer, mortarColor, 6, seedValue);

    // Second pass: draw stone blocks in offset rows
    resetSeed(seedValue + 100);

    for (let blockRow = 0; blockRow < TILE_HEIGHT; blockRow += 6) {
        const rowOffset = ((blockRow / 6) % 2 === 0) ? 0 : 4;

        for (let blockCol = rowOffset; blockCol < TILE_WIDTH; blockCol += 8) {
            const blockWidth = 6 + Math.floor(seededRandom() * 2);
            const blockHeight = 4 + Math.floor(seededRandom() * 2);

            // Randomly pick light or standard stone color for this block
            const color = seededRandom() > 0.4 ? stoneLightColor : stoneColor;

            for (let pixelRow = 1; pixelRow < blockHeight; pixelRow++) {
                for (let pixelCol = 1; pixelCol < blockWidth; pixelCol++) {
                    const x = blockCol + pixelCol;
                    const y = blockRow + pixelRow;

                    if (isInsideDiamond(x, y)) {
                        const noise = (seededRandom() - 0.5) * 8;
                        setPixel(buffer, x, y,
                            color[0] + noise, color[1] + noise, color[2] + noise);
                    }
                }
            }
        }
    }
}

module.exports = {
    fillDiamond,
    fillDiamondWithSpeckle,
    drawStoneBlocks,
};
