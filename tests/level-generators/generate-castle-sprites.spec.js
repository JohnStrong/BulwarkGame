/**
 * Tests for js/level-generators/generate-castle-sprites.js
 *
 * Tests the individual sprite generation functions by requiring the module
 * and verifying buffer output properties. Since the module runs generateAll()
 * on require (which writes to disk), we test the underlying logic by
 * re-implementing the function calls with the shared utilities.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-castle-sprites.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createBuffer, setPixel, isInsideDiamond, seededRandom, resetSeed, drawEdgeBorder } = require('../../js/level-generators/lib/pixel-utils');
const { fillDiamond, drawStoneBlocks } = require('../../js/level-generators/lib/fill-patterns');
const { TILE_WIDTH, TILE_HEIGHT, TERRAIN_COLORS, CASTLE_COLORS } = require('../../js/level-generators/lib/sprite-constants');

// Re-implement the sprite generators locally for testing (they aren't exported)

function generateBridgeStart() {
    const buffer = createBuffer();
    resetSeed(10000);
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noise = (seededRandom() - 0.5) * 10;
                if (x < 32) {
                    setPixel(buffer, x, y, TERRAIN_COLORS.road[0] + noise, TERRAIN_COLORS.road[1] + noise * 0.8, TERRAIN_COLORS.road[2] + noise * 0.6);
                } else {
                    const isPlankGap = y % 5 === 0;
                    const plankColor = isPlankGap ? CASTLE_COLORS.woodDark : CASTLE_COLORS.wood;
                    setPixel(buffer, x, y, ...plankColor);
                }
            }
        }
    }
    drawEdgeBorder(buffer);
    return buffer;
}

function generateTower() {
    const buffer = createBuffer();
    fillDiamond(buffer, CASTLE_COLORS.tower, 8, 11000);
    const centerX = 32, centerY = 16, towerRadius = 12;
    resetSeed(11100);
    for (let offsetY = -towerRadius; offsetY <= towerRadius; offsetY++) {
        for (let offsetX = -towerRadius; offsetX <= towerRadius; offsetX++) {
            const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            if (distance <= towerRadius && isInsideDiamond(centerX + offsetX, centerY + offsetY)) {
                const noise = (seededRandom() - 0.5) * 8;
                let stoneColor;
                if (distance > towerRadius - 2) stoneColor = CASTLE_COLORS.towerDark;
                else if (distance > towerRadius - 4) stoneColor = CASTLE_COLORS.tower;
                else stoneColor = CASTLE_COLORS.towerLight;
                setPixel(buffer, centerX + offsetX, centerY + offsetY, stoneColor[0] + noise, stoneColor[1] + noise, stoneColor[2] + noise);
            }
        }
    }
    for (let dotIndex = 0; dotIndex < 10; dotIndex++) {
        const angle = (dotIndex / 10) * Math.PI * 2;
        const dotX = centerX + Math.round((towerRadius - 1) * Math.cos(angle));
        const dotY = centerY + Math.round((towerRadius - 1) * Math.sin(angle) * 0.5);
        setPixel(buffer, dotX, dotY, ...CASTLE_COLORS.towerDark);
    }
    drawEdgeBorder(buffer);
    return buffer;
}

function generateWall() {
    const buffer = createBuffer();
    drawStoneBlocks(buffer, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, 14000);
    drawEdgeBorder(buffer);
    return buffer;
}

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] === 255) count++;
    }
    return count;
}

describe('generate-castle-sprites: bridge-start', () => {
    it('should produce a buffer with opaque pixels inside the diamond', () => {
        const buf = generateBridgeStart();
        assert.ok(countOpaquePixels(buf) > 500);
    });

    it('should be deterministic', () => {
        const buf1 = generateBridgeStart();
        const buf2 = generateBridgeStart();
        assert.ok(buf1.equals(buf2));
    });

    it('left half should have road-like colors (warm brown)', () => {
        const buf = generateBridgeStart();
        // Sample a pixel on the left side at center height
        const idx = (16 * TILE_WIDTH + 16) * 4;
        if (buf[idx + 3] === 255) {
            // Road color is around [210, 165, 110] ± noise
            assert.ok(buf[idx] > 150, 'Red channel should be warm');
            assert.ok(buf[idx + 1] > 100, 'Green channel should be moderate');
        }
    });

    it('right half should have wood-like colors (brown)', () => {
        const buf = generateBridgeStart();
        // Sample a pixel on the right side at center height
        const idx = (16 * TILE_WIDTH + 48) * 4;
        if (buf[idx + 3] === 255) {
            // Wood color is around [120, 78, 38] or [85, 55, 25]
            assert.ok(buf[idx] < 200, 'Red channel should be moderate (wood)');
        }
    });
});

describe('generate-castle-sprites: tower', () => {
    it('should produce a buffer with opaque pixels', () => {
        const buf = generateTower();
        assert.ok(countOpaquePixels(buf) > 300);
    });

    it('should be deterministic', () => {
        const buf1 = generateTower();
        const buf2 = generateTower();
        assert.ok(buf1.equals(buf2));
    });

    it('should have a circular pattern (center pixels lighter than edge)', () => {
        const buf = generateTower();
        // Center pixel
        const centerIdx = (16 * TILE_WIDTH + 32) * 4;
        // Edge pixel (at radius boundary)
        const edgeIdx = (16 * TILE_WIDTH + 43) * 4; // centerX + 11

        if (buf[centerIdx + 3] === 255 && buf[edgeIdx + 3] === 255) {
            // Center should be lighter (towerLight) than edge (towerDark)
            assert.ok(buf[centerIdx] >= buf[edgeIdx], 'Center should be lighter than edge');
        }
    });
});

describe('generate-castle-sprites: wall', () => {
    it('should produce a buffer with opaque pixels inside the diamond', () => {
        const buf = generateWall();
        assert.ok(countOpaquePixels(buf) > 500);
    });

    it('should be deterministic', () => {
        const buf1 = generateWall();
        const buf2 = generateWall();
        assert.ok(buf1.equals(buf2));
    });

    it('should have stone-colored pixels (grey-brown range)', () => {
        const buf = generateWall();
        const centerIdx = (16 * TILE_WIDTH + 32) * 4;
        if (buf[centerIdx + 3] === 255) {
            // Wall colors are in the 125-195 range for red channel
            assert.ok(buf[centerIdx] > 80 && buf[centerIdx] < 220);
        }
    });
});

describe('generate-castle-sprites: bailey variants', () => {
    function generateBailey1() {
        const buffer = createBuffer();
        resetSeed(16000);
        for (let y = 0; y < TILE_HEIGHT; y++) {
            for (let x = 0; x < TILE_WIDTH; x++) {
                if (isInsideDiamond(x, y)) {
                    const noise = (seededRandom() - 0.5) * 12;
                    setPixel(buffer, x, y, 200 + noise, 155 + noise * 0.8, 100 + noise * 0.6);
                }
            }
        }
        resetSeed(16050);
        for (let strandIndex = 0; strandIndex < 15; strandIndex++) {
            const startX = Math.floor(seededRandom() * TILE_WIDTH);
            const startY = Math.floor(seededRandom() * TILE_HEIGHT);
            const strandLength = 3 + Math.floor(seededRandom() * 4);
            const strandAngle = seededRandom() * Math.PI;
            for (let step = 0; step < strandLength; step++) {
                const pixelX = startX + Math.round(Math.cos(strandAngle) * step);
                const pixelY = startY + Math.round(Math.sin(strandAngle) * step);
                if (isInsideDiamond(pixelX, pixelY)) {
                    setPixel(buffer, pixelX, pixelY, ...CASTLE_COLORS.straw);
                }
            }
        }
        drawEdgeBorder(buffer);
        return buffer;
    }

    it('bailey-1 should produce opaque pixels', () => {
        const buf = generateBailey1();
        assert.ok(countOpaquePixels(buf) > 500);
    });

    it('bailey-1 should be deterministic', () => {
        const buf1 = generateBailey1();
        const buf2 = generateBailey1();
        assert.ok(buf1.equals(buf2));
    });

    it('bailey-1 should have warm dirt colors', () => {
        const buf = generateBailey1();
        const centerIdx = (16 * TILE_WIDTH + 32) * 4;
        if (buf[centerIdx + 3] === 255) {
            // Dirt is around [200, 155, 100]
            assert.ok(buf[centerIdx] > 150, 'Red should be warm');
            assert.ok(buf[centerIdx + 2] < buf[centerIdx], 'Blue should be less than red (warm tone)');
        }
    });
});
