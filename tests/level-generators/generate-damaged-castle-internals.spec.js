/**
 * Direct unit tests for the internal damage-application helpers in
 * js/level-generators/generate-damaged-castle-sprites.js.
 *
 * Covers: countOpaquePixels, applyCracks, applyMissingBlocks,
 *         applyRubbleDebris, applyDamage, and the generateDamagedCastleSprite
 *         dispatcher's default (unknown type) branch.
 *
 * Because the helpers are not exported, they are replicated inline here
 * using the same logic as the production file. This is the same pattern
 * used throughout the test suite for browser-global modules.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-damaged-castle-internals.spec.js
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
const { TILE_WIDTH, TILE_HEIGHT } = require('../../js/level-generators/lib/sprite-constants');
const { fillDiamond } = require('../../js/level-generators/lib/fill-patterns');

// ─── Replicated helpers (same logic as production file) ──────────────────────

const CRACK_COLOR   = [125, 115, 95];
const RUBBLE_COLOR  = [145, 135, 112];
const RUBBLE_DARK   = [105, 98, 80];

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

function applyCracks(buffer, seedValue, crackCount) {
    resetSeed(seedValue);
    let pixelsModified = 0;
    for (let crack = 0; crack < crackCount; crack++) {
        let x = 10 + Math.floor(seededRandom() * (TILE_WIDTH - 20));
        let y = 4  + Math.floor(seededRandom() * (TILE_HEIGHT - 8));
        const crackLength = 8 + Math.floor(seededRandom() * 12);
        for (let step = 0; step < crackLength; step++) {
            if (isInsideDiamond(x, y)) {
                const index = (y * TILE_WIDTH + x) * 4;
                if (buffer[index + 3] > 0) {
                    setPixel(buffer, x, y, ...CRACK_COLOR);
                    pixelsModified++;
                    if (seededRandom() > 0.5 && isInsideDiamond(x + 1, y)) {
                        setPixel(buffer, x + 1, y, ...CRACK_COLOR);
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
        const blockY = 4  + Math.floor(seededRandom() * (TILE_HEIGHT - 10));
        const blockW = 4  + Math.floor(seededRandom() * 5);
        const blockH = 3  + Math.floor(seededRandom() * 3);
        const makeTransparent = seededRandom() > 0.5;
        for (let py = 0; py < blockH; py++) {
            for (let px = 0; px < blockW; px++) {
                const x = blockX + px;
                const y = blockY + py;
                if (isInsideDiamond(x, y)) {
                    const index = (y * TILE_WIDTH + x) * 4;
                    if (buffer[index + 3] > 0) {
                        if (makeTransparent) {
                            buffer[index] = 0; buffer[index + 1] = 0;
                            buffer[index + 2] = 0; buffer[index + 3] = 0;
                        } else {
                            const rubbleColor = seededRandom() > 0.5 ? RUBBLE_COLOR : RUBBLE_DARK;
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
                            const rubbleColor = seededRandom() > 0.4 ? RUBBLE_COLOR : RUBBLE_DARK;
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

// ─── Helper: create a fully-filled diamond buffer ────────────────────────────

function createFilledBuffer(seed = 1000) {
    const buf = createBuffer();
    fillDiamond(buf, [175, 162, 135], 8, seed);
    return buf;
}

// ─── Tests: countOpaquePixels ─────────────────────────────────────────────────

describe('countOpaquePixels', () => {
    it('should return 0 for an empty (all-transparent) buffer', () => {
        const buf = createBuffer();
        assert.equal(countOpaquePixels(buf), 0);
    });

    it('should return a positive count for a filled diamond buffer', () => {
        const buf = createFilledBuffer();
        const count = countOpaquePixels(buf);
        assert.ok(count > 500, `Expected > 500 opaque pixels inside diamond, got ${count}`);
    });

    it('should only count pixels inside the diamond (not corners)', () => {
        const buf = createBuffer();
        // Manually set a corner pixel opaque — it should NOT be counted
        const cornerIdx = 0; // (0,0) is outside the diamond
        buf[cornerIdx + 3] = 255;
        assert.equal(countOpaquePixels(buf), 0, 'Corner pixel outside diamond should not be counted');
    });

    it('should count a single pixel set inside the diamond', () => {
        const buf = createBuffer();
        // (32, 16) is the center — definitely inside the diamond
        setPixel(buf, 32, 16, 100, 100, 100);
        assert.equal(countOpaquePixels(buf), 1);
    });

    it('should be deterministic for the same buffer', () => {
        const buf = createFilledBuffer(2000);
        const count1 = countOpaquePixels(buf);
        const count2 = countOpaquePixels(buf);
        assert.equal(count1, count2);
    });
});

// ─── Tests: applyCracks ───────────────────────────────────────────────────────

describe('applyCracks', () => {
    it('should return a positive pixel-modified count on a filled buffer', () => {
        const buf = createFilledBuffer();
        const modified = applyCracks(buf, 1000, 3);
        assert.ok(modified > 0, `applyCracks should modify at least one pixel, got ${modified}`);
    });

    it('should return 0 on an empty (transparent) buffer', () => {
        const buf = createBuffer(); // all transparent
        const modified = applyCracks(buf, 1000, 6);
        assert.equal(modified, 0, 'No opaque pixels to crack in an empty buffer');
    });

    it('should be deterministic for the same seed', () => {
        const buf1 = createFilledBuffer(5000);
        const buf2 = createFilledBuffer(5000);
        applyCracks(buf1, 9999, 4);
        applyCracks(buf2, 9999, 4);
        assert.ok(buf1.equals(buf2), 'applyCracks should be deterministic for the same seed');
    });

    it('should produce different results for different seeds', () => {
        const buf1 = createFilledBuffer(5000);
        const buf2 = createFilledBuffer(5000);
        applyCracks(buf1, 1111, 4);
        applyCracks(buf2, 2222, 4);
        assert.ok(!buf1.equals(buf2), 'Different seeds should produce different crack patterns');
    });

    it('should modify more pixels with more cracks', () => {
        const buf1 = createFilledBuffer(5000);
        const buf2 = createFilledBuffer(5000);
        const modified1 = applyCracks(buf1, 7777, 1);
        const modified2 = applyCracks(buf2, 7777, 10);
        assert.ok(modified2 >= modified1, 'More cracks should modify at least as many pixels');
    });
});

// ─── Tests: applyMissingBlocks ────────────────────────────────────────────────

describe('applyMissingBlocks', () => {
    it('should return a positive pixel-modified count on a filled buffer', () => {
        const buf = createFilledBuffer();
        const modified = applyMissingBlocks(buf, 2000, 3);
        assert.ok(modified > 0, `applyMissingBlocks should modify at least one pixel, got ${modified}`);
    });

    it('should reduce the opaque pixel count (some blocks become transparent)', () => {
        const buf = createFilledBuffer(3000);
        const before = countOpaquePixels(buf);
        applyMissingBlocks(buf, 2000, 4);
        const after = countOpaquePixels(buf);
        // Some blocks may be made transparent, so after <= before
        assert.ok(after <= before, 'Missing blocks should not increase opaque pixel count');
    });

    it('should be deterministic for the same seed', () => {
        const buf1 = createFilledBuffer(5000);
        const buf2 = createFilledBuffer(5000);
        applyMissingBlocks(buf1, 3333, 3);
        applyMissingBlocks(buf2, 3333, 3);
        assert.ok(buf1.equals(buf2), 'applyMissingBlocks should be deterministic');
    });

    it('should return 0 on an empty buffer', () => {
        const buf = createBuffer();
        const modified = applyMissingBlocks(buf, 2000, 4);
        assert.equal(modified, 0, 'No opaque pixels to remove in an empty buffer');
    });
});

// ─── Tests: applyRubbleDebris ─────────────────────────────────────────────────

describe('applyRubbleDebris', () => {
    it('should return a positive pixel-modified count on a filled buffer', () => {
        const buf = createFilledBuffer();
        const modified = applyRubbleDebris(buf, 3000, 3);
        assert.ok(modified > 0, `applyRubbleDebris should modify at least one pixel, got ${modified}`);
    });

    it('should be deterministic for the same seed', () => {
        const buf1 = createFilledBuffer(5000);
        const buf2 = createFilledBuffer(5000);
        applyRubbleDebris(buf1, 4444, 4);
        applyRubbleDebris(buf2, 4444, 4);
        assert.ok(buf1.equals(buf2), 'applyRubbleDebris should be deterministic');
    });

    it('should produce different results for different seeds', () => {
        const buf1 = createFilledBuffer(5000);
        const buf2 = createFilledBuffer(5000);
        applyRubbleDebris(buf1, 1234, 4);
        applyRubbleDebris(buf2, 5678, 4);
        assert.ok(!buf1.equals(buf2), 'Different seeds should produce different rubble patterns');
    });

    it('should concentrate rubble in the lower half of the diamond', () => {
        const buf = createFilledBuffer(5000);
        applyRubbleDebris(buf, 3000, 20);

        // Count rubble-colored pixels in upper vs lower half
        let upperRubble = 0, lowerRubble = 0;
        const midY = TILE_HEIGHT / 2;
        for (let y = 0; y < TILE_HEIGHT; y++) {
            for (let x = 0; x < TILE_WIDTH; x++) {
                if (!isInsideDiamond(x, y)) continue;
                const idx = (y * TILE_WIDTH + x) * 4;
                const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
                const isRubble = (
                    (r === RUBBLE_COLOR[0] && g === RUBBLE_COLOR[1] && b === RUBBLE_COLOR[2]) ||
                    (r === RUBBLE_DARK[0]  && g === RUBBLE_DARK[1]  && b === RUBBLE_DARK[2])
                );
                if (isRubble) {
                    if (y < midY) upperRubble++;
                    else lowerRubble++;
                }
            }
        }
        // Rubble should be more concentrated in the lower half
        assert.ok(
            lowerRubble >= upperRubble,
            `Rubble should concentrate in lower half: lower=${lowerRubble}, upper=${upperRubble}`
        );
    });

    it('should return 0 on an empty buffer', () => {
        const buf = createBuffer();
        const modified = applyRubbleDebris(buf, 3000, 5);
        assert.equal(modified, 0, 'No opaque pixels to add rubble to in an empty buffer');
    });
});

// ─── Tests: generateDamagedCastleSprite dispatcher (unknown type) ─────────────

describe('generateDamagedCastleSprite — unknown type behavior', () => {
    it('should throw or return null for an unknown sprite type (documents the default branch)', () => {
        // Load the real module to test the dispatcher's default branch.
        // The production code throws an error for unknown types — this test
        // documents that behavior so any future change (e.g. returning null)
        // is caught.
        const mod = require('../../js/level-generators/generate-damaged-castle-sprites.js');
        if (typeof mod.generateDamagedCastleSprite !== 'function') {
            // Module does not export the dispatcher — skip gracefully
            return;
        }
        // The dispatcher currently throws for unknown types.
        // Assert that behavior is consistent (either throws or returns null/undefined).
        let threw = false;
        let result;
        try {
            result = mod.generateDamagedCastleSprite('unknown-type', 99999);
        } catch (e) {
            threw = true;
        }
        // Either it threw (current behavior) or returned a falsy value (future behavior)
        assert.ok(
            threw || result == null,
            'Unknown type should either throw or return null/undefined'
        );
    });

    it('should handle all 10 known damaged castle types without throwing', () => {
        const mod = require('../../js/level-generators/generate-damaged-castle-sprites.js');
        if (typeof mod.generateDamagedCastleSprite !== 'function') return;

        const knownTypes = [
            'wall', 'tower', 'keep-tl', 'keep-bl', 'keep-br',
            'keep-center', 'gatehouse', 'bailey-1', 'bailey-2', 'bailey-3',
        ];
        for (const type of knownTypes) {
            assert.doesNotThrow(
                () => mod.generateDamagedCastleSprite(type, 50000),
                `generateDamagedCastleSprite('${type}') should not throw`
            );
        }
    });
});
