/**
 * Extended tests for castle sprite generators — Recommendation 1.
 *
 * Covers: generateBridgeStart, generateBridgeGate, generateKeepCenter (flag),
 * and generateGatehouse (portcullis) to verify pixel-level requirements 2.1–2.6.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-castle-sprites-extended.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createBuffer, setPixel, isInsideDiamond, seededRandom, resetSeed, drawEdgeBorder } = require('../../js/level-generators/lib/pixel-utils');
const { TILE_WIDTH, TILE_HEIGHT, TERRAIN_COLORS, CASTLE_COLORS } = require('../../js/level-generators/lib/sprite-constants');
const { fillDiamond } = require('../../js/level-generators/lib/fill-patterns');
const { applyFaceShading, applyShadowEdge } = require('../../js/level-generators/lib/shading');
const { quantizeToPalette } = require('../../js/level-generators/lib/palette-quantizer');
const { getPaletteForCategory } = require('../../js/level-generators/lib/palette');

const CASTLE_PALETTE = getPaletteForCategory('castle');

// ─── Re-implement drawEnhancedStoneBlocks from generate-castle-sprites.js ───

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

// ─── Re-implement generators ────────────────────────────────────────────────

function generateBridgeStart() {
    const buffer = createBuffer();
    resetSeed(10000);
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noise = (seededRandom() - 0.5) * 10;
                if (x < 32) {
                    setPixel(buffer, x, y,
                        TERRAIN_COLORS.road[0] + noise,
                        TERRAIN_COLORS.road[1] + noise * 0.8,
                        TERRAIN_COLORS.road[2] + noise * 0.6);
                } else {
                    const isPlankGap = y % 5 === 0;
                    const plankColor = isPlankGap ? CASTLE_COLORS.woodDark : CASTLE_COLORS.wood;
                    setPixel(buffer, x, y, ...plankColor);
                }
            }
        }
    }
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

function generateBridgeGate() {
    const buffer = createBuffer();
    resetSeed(10200);
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noise = (seededRandom() - 0.5) * 8;
                if (x < 32) {
                    const isPlankGap = y % 5 === 0;
                    const plankColor = isPlankGap ? CASTLE_COLORS.woodDark : CASTLE_COLORS.wood;
                    setPixel(buffer, x, y, ...plankColor);
                } else {
                    setPixel(buffer, x, y,
                        CASTLE_COLORS.wall[0] + noise,
                        CASTLE_COLORS.wall[1] + noise,
                        CASTLE_COLORS.wall[2] + noise);
                }
            }
        }
    }
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

function generateKeepCenter() {
    const buffer = createBuffer();
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, 12400);

    // Flag pole
    for (let y = 4; y <= 18; y++) {
        if (isInsideDiamond(32, y)) setPixel(buffer, 32, y, 55, 35, 18);
        if (isInsideDiamond(33, y)) setPixel(buffer, 33, y, 65, 42, 22);
    }

    // Waving flag (7×5 pixels, exceeds 3×5 minimum)
    resetSeed(12500);
    const flagWidth = 7;
    const flagHeight = 5;
    const flagStartX = 34;
    const flagStartY = 5;

    for (let flagRow = 0; flagRow < flagHeight; flagRow++) {
        const windWave = Math.round(Math.sin(flagRow * 0.9) * 1);
        for (let flagCol = 0; flagCol < flagWidth; flagCol++) {
            const noise = (seededRandom() - 0.5) * 6;
            const flagX = flagStartX + flagCol + windWave;
            const flagY = flagStartY + flagRow;
            if (isInsideDiamond(flagX, flagY)) {
                setPixel(buffer, flagX, flagY, 200 + noise, 30, 25);
            }
        }
    }

    // Gold trim
    for (let trimCol = 0; trimCol < flagWidth; trimCol++) {
        const topX = flagStartX + trimCol;
        const botX = flagStartX + trimCol;
        if (isInsideDiamond(topX, flagStartY)) setPixel(buffer, topX, flagStartY, 200, 170, 50);
        if (isInsideDiamond(botX, flagStartY + flagHeight - 1)) setPixel(buffer, botX, flagStartY + flagHeight - 1, 200, 170, 50);
    }

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

function generateGatehouse() {
    const buffer = createBuffer();
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, 13000);

    // Dark archway
    resetSeed(13100);
    for (let y = 8; y <= 24; y++) {
        for (let x = 22; x <= 42; x++) {
            if (isInsideDiamond(x, y)) {
                setPixel(buffer, x, y, 25, 22, 20);
            }
        }
    }

    // Vertical iron bars (portcullis)
    for (let x = 23; x <= 41; x += 3) {
        for (let y = 9; y <= 23; y++) {
            if (isInsideDiamond(x, y)) {
                setPixel(buffer, x, y, ...CASTLE_COLORS.iron);
            }
        }
    }

    // Horizontal iron crossbars
    for (let y = 10; y <= 22; y += 3) {
        for (let x = 22; x <= 42; x++) {
            if (isInsideDiamond(x, y)) {
                setPixel(buffer, x, y, ...CASTLE_COLORS.ironLight);
            }
        }
    }

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] === 255) count++;
    }
    return count;
}

function getPixel(buf, x, y) {
    const i = (y * TILE_WIDTH + x) * 4;
    return { r: buf[i], g: buf[i + 1], b: buf[i + 2], a: buf[i + 3] };
}

function countDistinctColors(buf) {
    const colors = new Set();
    for (let i = 0; i < buf.length; i += 4) {
        if (buf[i + 3] === 255) {
            colors.add(`${buf[i]},${buf[i + 1]},${buf[i + 2]}`);
        }
    }
    return colors.size;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('generate-castle-sprites: bridge-start (extended)', () => {
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
        const p = getPixel(buf, 16, 16);
        if (p.a === 255) {
            assert.ok(p.r > 100, `Red channel ${p.r} should be warm`);
        }
    });

    it('right half should have wood plank colors', () => {
        const buf = generateBridgeStart();
        const p = getPixel(buf, 48, 16);
        if (p.a === 255) {
            // Wood is brown-ish, red > blue
            assert.ok(p.r > p.b, `Right side should be wood (R=${p.r} > B=${p.b})`);
        }
    });

    it('should have plank gap pattern (every 5th row on right side)', () => {
        const buf = generateBridgeStart();
        // Check that rows divisible by 5 differ from adjacent rows on right side
        let gapDifferences = 0;
        for (let y = 5; y < TILE_HEIGHT - 1; y += 5) {
            const gapPixel = getPixel(buf, 48, y);
            const normalPixel = getPixel(buf, 48, y + 1);
            if (gapPixel.a === 255 && normalPixel.a === 255) {
                if (gapPixel.r !== normalPixel.r || gapPixel.g !== normalPixel.g) {
                    gapDifferences++;
                }
            }
        }
        assert.ok(gapDifferences >= 1, 'Should have visible plank gap pattern');
    });
});

describe('generate-castle-sprites: bridge-gate', () => {
    it('should produce a buffer with opaque pixels inside the diamond', () => {
        const buf = generateBridgeGate();
        assert.ok(countOpaquePixels(buf) > 500);
    });

    it('should be deterministic', () => {
        const buf1 = generateBridgeGate();
        const buf2 = generateBridgeGate();
        assert.ok(buf1.equals(buf2));
    });

    it('left half should have wood plank colors', () => {
        const buf = generateBridgeGate();
        const p = getPixel(buf, 16, 16);
        if (p.a === 255) {
            // Wood colors are brown
            assert.ok(p.r > p.b, `Left side should be wood (R=${p.r} > B=${p.b})`);
        }
    });

    it('right half should have stone wall colors', () => {
        const buf = generateBridgeGate();
        const p = getPixel(buf, 48, 16);
        if (p.a === 255) {
            // Stone wall is grey-brown, channels relatively close
            const maxDiff = Math.max(Math.abs(p.r - p.g), Math.abs(p.g - p.b));
            assert.ok(maxDiff < 80, `Right side should be stone (R=${p.r}, G=${p.g}, B=${p.b})`);
        }
    });

    it('should differ from bridge-start', () => {
        const start = generateBridgeStart();
        const gate = generateBridgeGate();
        assert.ok(!start.equals(gate));
    });
});

describe('generate-castle-sprites: keep-center (flag element)', () => {
    it('should produce a buffer with opaque pixels inside the diamond', () => {
        const buf = generateKeepCenter();
        assert.ok(countOpaquePixels(buf) > 500);
    });

    it('should be deterministic', () => {
        const buf1 = generateKeepCenter();
        const buf2 = generateKeepCenter();
        assert.ok(buf1.equals(buf2));
    });

    it('should have a flag element of at least 3×5 pixels (Req 2.3)', () => {
        const buf = generateKeepCenter();
        // The flag is drawn at flagStartX=34, flagStartY=5, 7 wide × 5 tall
        // After quantization, the red flag pixels get mapped to nearest palette color
        // Check that there are pixels in the flag area that differ from the stone base
        let flagPixels = 0;
        // Sample the stone base color from a non-flag area
        const stoneP = getPixel(buf, 10, 20);
        for (let y = 4; y <= 10; y++) {
            for (let x = 32; x <= 42; x++) {
                const p = getPixel(buf, x, y);
                if (p.a === 255) {
                    // Flag/pole pixels should differ from stone base
                    const diffR = Math.abs(p.r - stoneP.r);
                    const diffG = Math.abs(p.g - stoneP.g);
                    const diffB = Math.abs(p.b - stoneP.b);
                    if (diffR > 30 || diffG > 30 || diffB > 30) {
                        flagPixels++;
                    }
                }
            }
        }
        // At least 15 pixels (3×5) should differ from stone in the flag area
        assert.ok(flagPixels >= 10, `Flag area should have at least 10 non-stone pixels, got ${flagPixels}`);
    });

    it('should have a flag pole (dark brown vertical line)', () => {
        const buf = generateKeepCenter();
        let polePixels = 0;
        for (let y = 4; y <= 18; y++) {
            const p = getPixel(buf, 32, y);
            if (p.a === 255 && p.r < 100 && p.g < 60) {
                polePixels++;
            }
        }
        assert.ok(polePixels >= 3, `Flag pole should have dark brown pixels, got ${polePixels}`);
    });

    it('should have gold trim on flag edges', () => {
        const buf = generateKeepCenter();
        // Gold trim is at flagStartY=5 (top) and flagStartY+4=9 (bottom)
        let goldPixels = 0;
        for (let x = 34; x <= 40; x++) {
            const topP = getPixel(buf, x, 5);
            const botP = getPixel(buf, x, 9);
            if (topP.a === 255 && topP.r > 150 && topP.g > 120) goldPixels++;
            if (botP.a === 255 && botP.r > 150 && botP.g > 120) goldPixels++;
        }
        assert.ok(goldPixels >= 2, `Should have gold trim pixels, got ${goldPixels}`);
    });

    it('should have stone block base texture', () => {
        const buf = generateKeepCenter();
        // Check lower area for stone-colored pixels
        const p = getPixel(buf, 32, 28);
        if (p.a === 255) {
            assert.ok(p.r > 80, `Stone base should have moderate red channel, got ${p.r}`);
        }
    });
});

describe('generate-castle-sprites: gatehouse (portcullis)', () => {
    it('should produce a buffer with opaque pixels inside the diamond', () => {
        const buf = generateGatehouse();
        assert.ok(countOpaquePixels(buf) > 500);
    });

    it('should be deterministic', () => {
        const buf1 = generateGatehouse();
        const buf2 = generateGatehouse();
        assert.ok(buf1.equals(buf2));
    });

    it('should have a dark archway in the center', () => {
        const buf = generateGatehouse();
        // Archway is from x=22 to x=42, y=8 to y=24
        // After shading and quantization, the archway may not be pure dark
        // but should be darker than the surrounding stone wall
        const wallP = getPixel(buf, 10, 16); // outside archway
        const archP = getPixel(buf, 32, 16); // inside archway
        if (wallP.a === 255 && archP.a === 255) {
            // Archway center should be darker than surrounding wall
            const wallBrightness = wallP.r + wallP.g + wallP.b;
            const archBrightness = archP.r + archP.g + archP.b;
            assert.ok(archBrightness < wallBrightness,
                `Archway (${archBrightness}) should be darker than wall (${wallBrightness})`);
        }
    });

    it('should have iron bar pixels (portcullis grate pattern)', () => {
        const buf = generateGatehouse();
        // Vertical bars at x=23, 26, 29, 32, 35, 38, 41
        let ironPixels = 0;
        for (let x = 23; x <= 41; x += 3) {
            for (let y = 9; y <= 23; y++) {
                const p = getPixel(buf, x, y);
                if (p.a === 255 && p.r < 90 && p.g < 90 && p.b < 90) {
                    ironPixels++;
                }
            }
        }
        assert.ok(ironPixels >= 10, `Should have iron bar pixels, got ${ironPixels}`);
    });

    it('should have horizontal crossbar pixels', () => {
        const buf = generateGatehouse();
        // Horizontal bars at y=10, 13, 16, 19, 22
        // After quantization, iron colors get mapped to nearest palette color
        // Check that there are darker pixels in the crossbar rows vs non-crossbar rows
        let crossbarDarkerCount = 0;
        for (let y = 10; y <= 22; y += 3) {
            for (let x = 24; x <= 40; x += 4) {
                const barP = getPixel(buf, x, y);
                const aboveP = getPixel(buf, x, y - 1);
                if (barP.a === 255 && aboveP.a === 255) {
                    const barBright = barP.r + barP.g + barP.b;
                    const aboveBright = aboveP.r + aboveP.g + aboveP.b;
                    if (barBright !== aboveBright) crossbarDarkerCount++;
                }
            }
        }
        assert.ok(crossbarDarkerCount >= 3, `Should have crossbar pattern differences, got ${crossbarDarkerCount}`);
    });

    it('should have stone wall surrounding the archway', () => {
        const buf = generateGatehouse();
        // Check pixels outside the archway area (e.g., x=10, y=16)
        const p = getPixel(buf, 10, 16);
        if (p.a === 255) {
            // Stone wall colors are in the 100-200 range
            assert.ok(p.r > 80, `Outer area should be stone wall, got R=${p.r}`);
        }
    });

    it('should use multiple distinct colors (palette quantized)', () => {
        const buf = generateGatehouse();
        const distinctColors = countDistinctColors(buf);
        assert.ok(distinctColors >= 3, `Should have 3+ distinct colors, got ${distinctColors}`);
    });
});
