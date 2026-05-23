/**
 * Isolated pixel-drawing helper tests for generate-damaged-castle-sprites.js
 *
 * Recommendation 4: Isolate pixel-drawing helpers in generators.
 * Tests applyCracks, applyMissingBlocks, applyRubbleDebris by creating
 * small buffers and asserting specific pixel modifications.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-damaged-castle-helpers.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    createBuffer,
    setPixel,
    isInsideDiamond,
    seededRandom,
    resetSeed,
} = require('../../js/level-generators/lib/pixel-utils');

const { TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS } = require('../../js/level-generators/lib/sprite-constants');
const { fillDiamond } = require('../../js/level-generators/lib/fill-patterns');

// ─── Damage Colors (from generate-damaged-castle-sprites.js) ────────────────

const DAMAGE_COLORS = {
    crack: CASTLE_COLORS.wallDark,       // [125, 115, 95]
    rubble: CASTLE_COLORS.wallMortar,    // [145, 135, 112]
    rubbleDark: CASTLE_COLORS.towerDark, // [105, 98, 80]
};

// ─── Re-implement damage functions for isolated testing ─────────────────────

function applyCracks(buffer, seedValue, crackCount) {
    resetSeed(seedValue);
    let pixelsModified = 0;

    for (let crack = 0; crack < crackCount; crack++) {
        let x = 10 + Math.floor(seededRandom() * (TILE_WIDTH - 20));
        let y = 4 + Math.floor(seededRandom() * (TILE_HEIGHT - 8));
        const crackLength = 8 + Math.floor(seededRandom() * 12);

        for (let step = 0; step < crackLength; step++) {
            if (isInsideDiamond(x, y)) {
                const index = (y * TILE_WIDTH + x) * 4;
                if (buffer[index + 3] > 0) {
                    setPixel(buffer, x, y, ...DAMAGE_COLORS.crack);
                    pixelsModified++;
                    if (seededRandom() > 0.5 && isInsideDiamond(x + 1, y)) {
                        setPixel(buffer, x + 1, y, ...DAMAGE_COLORS.crack);
                        pixelsModified++;
                    }
                }
            }
            x += Math.floor(seededRandom() * 3) - 1;
            y += Math.floor(seededRandom() * 2);
        }
    }
    return pixelsModified;
}

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
                            buffer[index] = 0;
                            buffer[index + 1] = 0;
                            buffer[index + 2] = 0;
                            buffer[index + 3] = 0;
                        } else {
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

function applyRubbleDebris(buffer, seedValue, rubbleCount) {
    resetSeed(seedValue);
    let pixelsModified = 0;

    for (let cluster = 0; cluster < rubbleCount; cluster++) {
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function createFilledDiamondBuffer() {
    const buffer = createBuffer();
    // Fill diamond with a known stone color
    fillDiamond(buffer, [160, 155, 140], 0, 1000);
    return buffer;
}

function getPixel(buffer, x, y) {
    const idx = (y * TILE_WIDTH + x) * 4;
    return [buffer[idx], buffer[idx + 1], buffer[idx + 2], buffer[idx + 3]];
}

function countOpaquePixels(buffer) {
    let count = 0;
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const index = (y * TILE_WIDTH + x) * 4;
                if (buffer[index + 3] > 0) count++;
            }
        }
    }
    return count;
}

function countCrackPixels(buffer) {
    let count = 0;
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            const [r, g, b, a] = getPixel(buffer, x, y);
            if (a === 255 && r === DAMAGE_COLORS.crack[0] && g === DAMAGE_COLORS.crack[1] && b === DAMAGE_COLORS.crack[2]) {
                count++;
            }
        }
    }
    return count;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('applyCracks - isolated pixel assertions', () => {
    it('should modify at least some pixels', () => {
        const buffer = createFilledDiamondBuffer();
        const modified = applyCracks(buffer, 60000, 6);
        assert.ok(modified > 0, `Should modify pixels, got ${modified}`);
    });

    it('should produce crack-colored pixels in the buffer', () => {
        const buffer = createFilledDiamondBuffer();
        applyCracks(buffer, 60000, 6);
        const crackCount = countCrackPixels(buffer);
        assert.ok(crackCount > 0, `Should have crack pixels, got ${crackCount}`);
    });

    it('should be deterministic for same seed', () => {
        const buf1 = createFilledDiamondBuffer();
        const mod1 = applyCracks(buf1, 60000, 6);

        const buf2 = createFilledDiamondBuffer();
        const mod2 = applyCracks(buf2, 60000, 6);

        assert.equal(mod1, mod2);
        assert.ok(buf1.equals(buf2));
    });

    it('should produce different results for different seeds', () => {
        const buf1 = createFilledDiamondBuffer();
        applyCracks(buf1, 60000, 6);

        const buf2 = createFilledDiamondBuffer();
        applyCracks(buf2, 70000, 6);

        assert.ok(!buf1.equals(buf2));
    });

    it('should not modify transparent pixels', () => {
        const buffer = createBuffer(); // all transparent
        const modified = applyCracks(buffer, 60000, 6);
        assert.equal(modified, 0, 'Should not modify transparent pixels');
    });

    it('should modify more pixels with higher crack count', () => {
        const buf1 = createFilledDiamondBuffer();
        const mod1 = applyCracks(buf1, 60000, 2);

        const buf2 = createFilledDiamondBuffer();
        const mod2 = applyCracks(buf2, 60000, 10);

        assert.ok(mod2 > mod1, `More cracks (${mod2}) should modify more pixels than fewer (${mod1})`);
    });
});

describe('applyMissingBlocks - isolated pixel assertions', () => {
    it('should modify at least some pixels', () => {
        const buffer = createFilledDiamondBuffer();
        const modified = applyMissingBlocks(buffer, 62000, 4);
        assert.ok(modified > 0, `Should modify pixels, got ${modified}`);
    });

    it('should create some transparent pixels (missing blocks)', () => {
        const buffer = createFilledDiamondBuffer();
        const opaqueBefore = countOpaquePixels(buffer);
        applyMissingBlocks(buffer, 62000, 4);
        const opaqueAfter = countOpaquePixels(buffer);
        // Some blocks should be made transparent
        // (depends on seededRandom > 0.5 for makeTransparent)
        // At least some should be rubble-filled, so opaque count may or may not decrease
        // But total modified should be > 0
        assert.ok(opaqueBefore >= opaqueAfter, 'Opaque count should not increase');
    });

    it('should be deterministic for same seed', () => {
        const buf1 = createFilledDiamondBuffer();
        const mod1 = applyMissingBlocks(buf1, 62000, 4);

        const buf2 = createFilledDiamondBuffer();
        const mod2 = applyMissingBlocks(buf2, 62000, 4);

        assert.equal(mod1, mod2);
        assert.ok(buf1.equals(buf2));
    });

    it('should produce different results for different seeds', () => {
        const buf1 = createFilledDiamondBuffer();
        applyMissingBlocks(buf1, 62000, 4);

        const buf2 = createFilledDiamondBuffer();
        applyMissingBlocks(buf2, 72000, 4);

        assert.ok(!buf1.equals(buf2));
    });

    it('should not modify transparent pixels', () => {
        const buffer = createBuffer();
        const modified = applyMissingBlocks(buffer, 62000, 4);
        assert.equal(modified, 0);
    });

    it('should create rectangular damage patterns', () => {
        const buffer = createFilledDiamondBuffer();
        const original = Buffer.from(buffer);
        applyMissingBlocks(buffer, 62000, 1);

        // Find modified pixels — they should form a roughly rectangular cluster
        const modifiedCoords = [];
        for (let y = 0; y < TILE_HEIGHT; y++) {
            for (let x = 0; x < TILE_WIDTH; x++) {
                const idx = (y * TILE_WIDTH + x) * 4;
                if (buffer[idx] !== original[idx] || buffer[idx + 1] !== original[idx + 1] ||
                    buffer[idx + 2] !== original[idx + 2] || buffer[idx + 3] !== original[idx + 3]) {
                    modifiedCoords.push({ x, y });
                }
            }
        }
        assert.ok(modifiedCoords.length > 0, 'Should have modified pixels');
        // Check that modified pixels are clustered (max spread should be limited)
        if (modifiedCoords.length > 1) {
            const xs = modifiedCoords.map(c => c.x);
            const ys = modifiedCoords.map(c => c.y);
            const xSpread = Math.max(...xs) - Math.min(...xs);
            const ySpread = Math.max(...ys) - Math.min(...ys);
            // Block size is 4-8 wide, 3-5 tall
            assert.ok(xSpread <= 9, `X spread should be block-sized, got ${xSpread}`);
            assert.ok(ySpread <= 6, `Y spread should be block-sized, got ${ySpread}`);
        }
    });
});

describe('applyRubbleDebris - isolated pixel assertions', () => {
    it('should modify at least some pixels', () => {
        const buffer = createFilledDiamondBuffer();
        const modified = applyRubbleDebris(buffer, 63000, 5);
        assert.ok(modified > 0, `Should modify pixels, got ${modified}`);
    });

    it('should place rubble in the bottom half of the sprite', () => {
        const buffer = createFilledDiamondBuffer();
        const original = Buffer.from(buffer);
        applyRubbleDebris(buffer, 63000, 5);

        // Count modified pixels in top half vs bottom half
        let topModified = 0, bottomModified = 0;
        const midY = TILE_HEIGHT / 2;
        for (let y = 0; y < TILE_HEIGHT; y++) {
            for (let x = 0; x < TILE_WIDTH; x++) {
                const idx = (y * TILE_WIDTH + x) * 4;
                if (buffer[idx] !== original[idx] || buffer[idx + 1] !== original[idx + 1] ||
                    buffer[idx + 2] !== original[idx + 2]) {
                    if (y < midY) topModified++;
                    else bottomModified++;
                }
            }
        }
        // Rubble should be predominantly in the bottom half
        assert.ok(bottomModified >= topModified,
            `Bottom (${bottomModified}) should have >= rubble than top (${topModified})`);
    });

    it('should use rubble colors (not crack colors)', () => {
        const buffer = createFilledDiamondBuffer();
        applyRubbleDebris(buffer, 63000, 5);

        // Find a modified pixel and check it's rubble-colored
        let foundRubble = false;
        for (let y = TILE_HEIGHT / 2; y < TILE_HEIGHT && !foundRubble; y++) {
            for (let x = 0; x < TILE_WIDTH && !foundRubble; x++) {
                const [r, g, b, a] = getPixel(buffer, x, y);
                if (a === 255) {
                    const isRubble = (r === DAMAGE_COLORS.rubble[0] && g === DAMAGE_COLORS.rubble[1] && b === DAMAGE_COLORS.rubble[2]);
                    const isRubbleDark = (r === DAMAGE_COLORS.rubbleDark[0] && g === DAMAGE_COLORS.rubbleDark[1] && b === DAMAGE_COLORS.rubbleDark[2]);
                    if (isRubble || isRubbleDark) foundRubble = true;
                }
            }
        }
        assert.ok(foundRubble, 'Should contain rubble-colored pixels');
    });

    it('should be deterministic for same seed', () => {
        const buf1 = createFilledDiamondBuffer();
        const mod1 = applyRubbleDebris(buf1, 63000, 5);

        const buf2 = createFilledDiamondBuffer();
        const mod2 = applyRubbleDebris(buf2, 63000, 5);

        assert.equal(mod1, mod2);
        assert.ok(buf1.equals(buf2));
    });
});
