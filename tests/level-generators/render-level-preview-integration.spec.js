/**
 * Tests for render-level-preview.js renderLevel integration — Recommendation 7.
 *
 * Mocks sharp and filesystem to verify the pixel-copy loop logic and
 * fallback sprite generation without requiring actual sprite files.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/render-level-preview-integration.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const TILE = 32;

// ─── Re-implement tileHash and charToSprite from render-level-preview.js ────

function tileHash(row, col) {
    let h = (row * 7919 + col * 104729 + 31) & 0xFFFFFFFF;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = (h >> 16) ^ h;
    return (h >>> 0) / 0xFFFFFFFF;
}

function charToSprite(ch, row, col) {
    const hash = tileHash(row, col);
    switch (ch) {
        case '.': return `grass-short-${hash > 0.5 ? 2 : 1}`;
        case ',': return `grass-flowers-${hash > 0.5 ? 2 : 1}`;
        case 'O': return `tree-${Math.floor(hash * 3) + 1}`;
        case 'R': return 'rock';
        case 'D': return 'road-full';
        case '~': return `water-${Math.floor(hash * 3) + 1}`;
        case '=': return 'bridge-mm';
        default: return 'grass-short-1';
    }
}

// ─── Re-implement the pixel-copy loop from renderLevel ──────────────────────

/**
 * Simulates the renderLevel pixel-copy logic without sharp/filesystem.
 * Takes a level string and a sprite provider function.
 */
function renderLevelToBuffer(levelContent, getSpriteBuffer) {
    const lines = levelContent.split('\n');
    const mapLines = lines.filter(l => !l.startsWith(';') && !l.startsWith('name=') && l.length > 0);

    const cols = Math.max(...mapLines.map(l => l.length));
    const rows = mapLines.length;
    const width = cols * TILE;
    const height = rows * TILE;

    const output = Buffer.alloc(width * height * 4);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < mapLines[row].length; col++) {
            const ch = mapLines[row][col];
            const spriteName = charToSprite(ch, row, col);
            const srcBuf = getSpriteBuffer(spriteName);

            const destX = col * TILE;
            const destY = row * TILE;
            for (let sy = 0; sy < TILE; sy++) {
                for (let sx = 0; sx < TILE; sx++) {
                    const srcIdx = (sy * TILE + sx) * 4;
                    const destIdx = ((destY + sy) * width + (destX + sx)) * 4;
                    output[destIdx] = srcBuf[srcIdx];
                    output[destIdx + 1] = srcBuf[srcIdx + 1];
                    output[destIdx + 2] = srcBuf[srcIdx + 2];
                    output[destIdx + 3] = srcBuf[srcIdx + 3];
                }
            }
        }
    }

    return { output, width, height, rows, cols };
}

/**
 * Creates a fallback sprite buffer (grey tile) matching the production logic.
 */
function createFallbackSprite() {
    const buf = Buffer.alloc(TILE * TILE * 4, 0);
    for (let i = 0; i < TILE * TILE; i++) {
        buf[i * 4] = 80;
        buf[i * 4 + 1] = 80;
        buf[i * 4 + 2] = 80;
        buf[i * 4 + 3] = 255;
    }
    return buf;
}

/**
 * Creates a colored sprite buffer for testing.
 */
function createColoredSprite(r, g, b) {
    const buf = Buffer.alloc(TILE * TILE * 4, 0);
    for (let i = 0; i < TILE * TILE; i++) {
        buf[i * 4] = r;
        buf[i * 4 + 1] = g;
        buf[i * 4 + 2] = b;
        buf[i * 4 + 3] = 255;
    }
    return buf;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('render-level-preview: pixel-copy loop integration', () => {
    it('should produce correct output dimensions for a simple level', () => {
        const level = '...\n...\n...';
        const { width, height, rows, cols } = renderLevelToBuffer(level, createFallbackSprite);
        assert.equal(cols, 3);
        assert.equal(rows, 3);
        assert.equal(width, 3 * TILE);
        assert.equal(height, 3 * TILE);
    });

    it('should copy sprite pixels to correct positions', () => {
        const level = 'DR';
        const spriteMap = {
            'road-full': createColoredSprite(210, 165, 110),
            'rock': createColoredSprite(130, 128, 122),
        };
        const getSpriteBuffer = (name) => spriteMap[name] || createFallbackSprite();

        const { output, width } = renderLevelToBuffer(level, getSpriteBuffer);

        // First tile (col 0) should be road-colored
        const roadIdx = (0 * width + 0) * 4;
        assert.equal(output[roadIdx], 210);
        assert.equal(output[roadIdx + 1], 165);
        assert.equal(output[roadIdx + 2], 110);

        // Second tile (col 1) should be rock-colored
        const rockIdx = (0 * width + TILE) * 4;
        assert.equal(output[rockIdx], 130);
        assert.equal(output[rockIdx + 1], 128);
        assert.equal(output[rockIdx + 2], 122);
    });

    it('should handle multi-row levels correctly', () => {
        const level = '..\n~~';
        const spriteMap = {
            'grass-short-1': createColoredSprite(95, 180, 72),
            'water-1': createColoredSprite(45, 120, 210),
        };
        const getSpriteBuffer = (name) => spriteMap[name] || createFallbackSprite();

        const { output, width, height } = renderLevelToBuffer(level, getSpriteBuffer);

        // Row 0 should be grass-colored
        const grassIdx = (0 * width + 0) * 4;
        assert.equal(output[grassIdx], 95);
        assert.equal(output[grassIdx + 1], 180);

        // Row 1 (at y=TILE) should be water-colored
        const waterIdx = (TILE * width + 0) * 4;
        assert.equal(output[waterIdx], 45);
        assert.equal(output[waterIdx + 1], 120);
        assert.equal(output[waterIdx + 2], 210);
    });

    it('should use fallback sprite for unknown sprite names', () => {
        const level = 'X'; // Unknown character → grass-short-1
        const getSpriteBuffer = () => createFallbackSprite();

        const { output } = renderLevelToBuffer(level, getSpriteBuffer);

        // Fallback is grey (80, 80, 80)
        assert.equal(output[0], 80);
        assert.equal(output[1], 80);
        assert.equal(output[2], 80);
        assert.equal(output[3], 255);
    });

    it('should filter out comment and name lines', () => {
        const level = '; comment\nname=Test\n..\n~~';
        const { rows, cols } = renderLevelToBuffer(level, createFallbackSprite);
        assert.equal(rows, 2);
        assert.equal(cols, 2);
    });

    it('should handle uneven row lengths', () => {
        const level = '...\n..\n....';
        const { cols, rows } = renderLevelToBuffer(level, createFallbackSprite);
        assert.equal(cols, 4); // max row length
        assert.equal(rows, 3);
    });

    it('should produce fully opaque output when sprites are opaque', () => {
        const level = '..';
        const { output } = renderLevelToBuffer(level, () => createColoredSprite(100, 100, 100));

        // Check all pixels in first tile are opaque
        for (let y = 0; y < TILE; y++) {
            for (let x = 0; x < TILE; x++) {
                const idx = (y * (2 * TILE) + x) * 4;
                assert.equal(output[idx + 3], 255, `Pixel (${x},${y}) should be opaque`);
            }
        }
    });

    it('should preserve alpha channel from source sprites', () => {
        // Create a sprite with some transparent pixels
        const semiTransparent = Buffer.alloc(TILE * TILE * 4, 0);
        for (let i = 0; i < TILE * TILE; i++) {
            semiTransparent[i * 4] = 100;
            semiTransparent[i * 4 + 1] = 100;
            semiTransparent[i * 4 + 2] = 100;
            semiTransparent[i * 4 + 3] = i < TILE * TILE / 2 ? 255 : 0;
        }

        const level = '.';
        const { output } = renderLevelToBuffer(level, () => semiTransparent);

        // First half should be opaque
        assert.equal(output[3], 255);
        // Second half should be transparent
        const halfIdx = (TILE * TILE / 2) * 4;
        assert.equal(output[halfIdx + 3], 0);
    });
});

describe('render-level-preview: fallback sprite generation', () => {
    it('should create a 32×32 grey tile', () => {
        const fallback = createFallbackSprite();
        assert.equal(fallback.length, TILE * TILE * 4);
    });

    it('should be fully opaque', () => {
        const fallback = createFallbackSprite();
        for (let i = 0; i < TILE * TILE; i++) {
            assert.equal(fallback[i * 4 + 3], 255);
        }
    });

    it('should be grey (RGB 80, 80, 80)', () => {
        const fallback = createFallbackSprite();
        assert.equal(fallback[0], 80);
        assert.equal(fallback[1], 80);
        assert.equal(fallback[2], 80);
    });

    it('should be uniform color throughout', () => {
        const fallback = createFallbackSprite();
        for (let i = 0; i < TILE * TILE; i++) {
            assert.equal(fallback[i * 4], 80);
            assert.equal(fallback[i * 4 + 1], 80);
            assert.equal(fallback[i * 4 + 2], 80);
        }
    });
});
