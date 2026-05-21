/**
 * Core pixel buffer utilities for sprite generation.
 *
 * Provides the foundational drawing primitives used by all sprite generators:
 *   - A seeded pseudo-random number generator (PRNG) for deterministic output
 *   - Pixel writing with bounds checking and color clamping
 *   - Isometric diamond geometry helpers
 *   - Edge border drawing
 *
 * Higher-level operations (diamond fills, stone patterns) live in fill-patterns.js.
 * Color constants and sprite names live in sprite-constants.js.
 */

const { TILE_WIDTH, TILE_HEIGHT, BORDER_COLOR } = require('./sprite-constants');

// ─── Seeded PRNG ────────────────────────────────────────────────────────────

let randomSeed = 1;

/**
 * Returns the next deterministic random float between 0 and 1.
 * Uses a linear congruential generator so the same seed always
 * produces the same sequence of values.
 *
 * @returns {number} A float between 0 and 1.
 */
function seededRandom() {
    randomSeed = (randomSeed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (randomSeed >>> 0) / 0xFFFFFFFF;
}

/**
 * Resets the PRNG to a specific seed value.
 * Call this before drawing a sprite to guarantee reproducible output.
 *
 * @param {number} newSeed - The seed value to set.
 */
function resetSeed(newSeed) {
    randomSeed = newSeed;
}

// ─── Buffer Creation ────────────────────────────────────────────────────────

/**
 * Creates a new empty RGBA pixel buffer for one tile (64×32 pixels, 4 channels).
 * All bytes start at 0, meaning fully transparent black.
 *
 * @returns {Buffer} A zeroed buffer of length TILE_WIDTH × TILE_HEIGHT × 4.
 */
function createBuffer() {
    return Buffer.alloc(TILE_WIDTH * TILE_HEIGHT * 4);
}

// ─── Pixel Drawing ──────────────────────────────────────────────────────────

/**
 * Writes one fully opaque pixel at the given (x, y) position in the buffer.
 * If the coordinates are outside the tile bounds, the call is silently ignored.
 * Color values are clamped to 0–255.
 *
 * @param {Buffer} buffer - The pixel buffer to write into.
 * @param {number} x - Horizontal position (0 = left edge).
 * @param {number} y - Vertical position (0 = top edge).
 * @param {number} red - Red channel value (0–255).
 * @param {number} green - Green channel value (0–255).
 * @param {number} blue - Blue channel value (0–255).
 */
function setPixel(buffer, x, y, red, green, blue) {
    if (x < 0 || x >= TILE_WIDTH || y < 0 || y >= TILE_HEIGHT) return;
    const index = (y * TILE_WIDTH + x) * 4;
    buffer[index] = Math.max(0, Math.min(255, Math.round(red)));
    buffer[index + 1] = Math.max(0, Math.min(255, Math.round(green)));
    buffer[index + 2] = Math.max(0, Math.min(255, Math.round(blue)));
    buffer[index + 3] = 255;
}

// ─── Diamond Geometry ───────────────────────────────────────────────────────

/**
 * Returns true if the pixel at (x, y) falls inside the isometric diamond shape.
 * The diamond is centered at (32, 16) and spans the full 64×32 tile.
 *
 * Formula: |x - 32| / 32 + |y - 16| / 16 <= 1
 *
 * @param {number} x - Horizontal pixel position.
 * @param {number} y - Vertical pixel position.
 * @returns {boolean} True if the pixel is inside the diamond.
 */
function isInsideDiamond(x, y) {
    return (Math.abs(x - 32) / 32 + Math.abs(y - 16) / 16) <= 1;
}

// ─── Edge Border ────────────────────────────────────────────────────────────

/**
 * Draws a 1-pixel dark border around the edge of all opaque pixels in the buffer.
 * An "edge pixel" is any opaque pixel that has at least one transparent neighbor.
 * This gives sprites a clean outline against any background.
 *
 * @param {Buffer} buffer - The pixel buffer to add borders to.
 */
function drawEdgeBorder(buffer) {
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            const index = (y * TILE_WIDTH + x) * 4;
            if (buffer[index + 3] === 0) continue;

            let isEdge = false;
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                for (let offsetX = -1; offsetX <= 1; offsetX++) {
                    const neighborX = x + offsetX;
                    const neighborY = y + offsetY;

                    if (neighborX < 0 || neighborX >= TILE_WIDTH || neighborY < 0 || neighborY >= TILE_HEIGHT) {
                        isEdge = true;
                        continue;
                    }
                    if (buffer[(neighborY * TILE_WIDTH + neighborX) * 4 + 3] === 0) {
                        isEdge = true;
                    }
                }
            }

            if (isEdge) {
                buffer[index] = BORDER_COLOR[0];
                buffer[index + 1] = BORDER_COLOR[1];
                buffer[index + 2] = BORDER_COLOR[2];
            }
        }
    }
}

module.exports = {
    TILE_WIDTH,
    TILE_HEIGHT,
    BORDER_COLOR,
    seededRandom,
    resetSeed,
    createBuffer,
    setPixel,
    isInsideDiamond,
    drawEdgeBorder,
};
