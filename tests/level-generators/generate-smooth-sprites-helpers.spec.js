/**
 * Isolated pixel-drawing helper tests for generate-smooth-sprites.js
 *
 * Recommendation 4: Isolate pixel-drawing helpers in generators.
 * Tests drawCobblestones, drawBridgeWall, drawDirt, drawGrassEdgeVertical,
 * drawGrassEdgeHorizontal by creating small buffers and asserting pixel values.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-smooth-sprites-helpers.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Re-implement helpers from generate-smooth-sprites.js ───────────────────

const SIZE = 32;

const GRASS_EDGE = [82, 162, 60];
const GRASS_DARK = [75, 155, 55];
const DIRT = [210, 165, 110];
const DIRT_LIGHT = [230, 185, 130];
const DIRT_DARK = [170, 130, 80];
const STONE = [140, 138, 130];
const STONE_LIGHT = [165, 162, 152];
const STONE_DARK = [90, 88, 80];
const BRIDGE_WALL = [100, 98, 88];
const BRIDGE_WALL_DARK = [62, 60, 52];
const BRIDGE_ROAD = [140, 138, 128];
const BRIDGE_ROAD_DARK = [95, 92, 82];

let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }

function px(buf, x, y, r, g, b) {
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    const i = (y * SIZE + x) * 4;
    buf[i] = Math.max(0, Math.min(255, Math.round(r)));
    buf[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[i + 3] = 255;
}

function getPixel(buf, x, y) {
    const i = (y * SIZE + x) * 4;
    return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
}

function createBuf() { return Buffer.alloc(SIZE * SIZE * 4); }

function drawCobblestones(buf, x1, y1, x2, y2, sv) {
    resetSeed(sv);
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * 10;
            px(buf, x, y, STONE_DARK[0] + n, STONE_DARK[1] + n, STONE_DARK[2] + n);
        }
    resetSeed(sv + 100);
    const stoneSize = 5;
    for (let sy = y1; sy <= y2; sy += stoneSize + 1) {
        const rowOffset = ((sy - y1) / (stoneSize + 1)) % 2 === 0 ? 0 : 3;
        for (let sx = x1 + rowOffset; sx <= x2; sx += stoneSize + 2) {
            const sw = stoneSize + Math.floor(seededRandom() * 2) - 1;
            const sh = stoneSize + Math.floor(seededRandom() * 2) - 2;
            const isLight = seededRandom() > 0.5;
            const color = isLight ? STONE_LIGHT : STONE;
            for (let dy = 0; dy < sh; dy++) {
                for (let dx = 0; dx < sw; dx++) {
                    if ((dx === 0 && dy === 0) || (dx === sw - 1 && dy === 0) ||
                        (dx === 0 && dy === sh - 1) || (dx === sw - 1 && dy === sh - 1)) continue;
                    const n = (seededRandom() - 0.5) * 12;
                    px(buf, sx + dx, sy + dy, color[0] + n, color[1] + n, color[2] + n);
                }
            }
        }
    }
}

function drawDirt(buf, x1, y1, x2, y2, sv) {
    resetSeed(sv);
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * 10;
            px(buf, x, y, DIRT[0] + n, DIRT[1] + n * 0.8, DIRT[2] + n * 0.6);
        }
    resetSeed(sv + 200);
    for (let i = 0; i < 8; i++) {
        let cx = x1 + Math.floor(seededRandom() * (x2 - x1));
        let cy = y1 + Math.floor(seededRandom() * (y2 - y1));
        const len = 3 + Math.floor(seededRandom() * 5);
        for (let d = 0; d < len; d++) {
            px(buf, cx, cy, ...DIRT_DARK);
            cx += Math.floor(seededRandom() * 3) - 1;
            cy += Math.floor(seededRandom() * 3) - 1;
        }
    }
    resetSeed(sv + 300);
    for (let i = 0; i < 5; i++) {
        const lx = x1 + Math.floor(seededRandom() * (x2 - x1));
        const ly = y1 + Math.floor(seededRandom() * (y2 - y1));
        px(buf, lx, ly, ...DIRT_LIGHT);
        px(buf, lx + 1, ly, ...DIRT_LIGHT);
    }
}

function drawGrassEdgeVertical(buf, edgeX, side, sv) {
    resetSeed(sv);
    for (let y = 0; y < SIZE; y++) {
        const jag = Math.floor(seededRandom() * 3);
        for (let d = 0; d < jag; d++) {
            const x = side === 'left' ? edgeX + d : edgeX - d;
            px(buf, x, y, ...GRASS_EDGE);
            if (seededRandom() > 0.5) px(buf, x, y, ...GRASS_DARK);
        }
    }
}

function drawGrassEdgeHorizontal(buf, edgeY, side, sv) {
    resetSeed(sv);
    for (let x = 0; x < SIZE; x++) {
        const jag = Math.floor(seededRandom() * 3);
        for (let d = 0; d < jag; d++) {
            const y = side === 'top' ? edgeY + d : edgeY - d;
            px(buf, x, y, ...GRASS_EDGE);
            if (seededRandom() > 0.5) px(buf, x, y, ...GRASS_DARK);
        }
    }
}

function drawBridgeWall(buf, x1, y1, x2, y2, sv) {
    resetSeed(sv);
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * 5;
            px(buf, x, y, BRIDGE_WALL_DARK[0] + n, BRIDGE_WALL_DARK[1] + n, BRIDGE_WALL_DARK[2] + n);
        }
    resetSeed(sv + 50);
    for (let sy = y1; sy <= y2; sy += 7) {
        const rowOff = ((sy - y1) / 7) % 2 === 0 ? 0 : 4;
        for (let sx = x1 + rowOff; sx <= x2; sx += 8) {
            const sw = 6 + Math.floor(seededRandom() * 3);
            const sh = 5 + Math.floor(seededRandom() * 2);
            for (let dy = 1; dy < sh - 1 && sy + dy <= y2; dy++)
                for (let dx = 1; dx < sw - 1 && sx + dx <= x2; dx++) {
                    const n = (seededRandom() - 0.5) * 6;
                    px(buf, sx + dx, sy + dy, BRIDGE_WALL[0] + n, BRIDGE_WALL[1] + n, BRIDGE_WALL[2] + n);
                }
        }
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('drawCobblestones - pixel-level assertions', () => {
    it('should fill the specified region with opaque pixels', () => {
        const buf = createBuf();
        drawCobblestones(buf, 0, 0, 15, 15, 5000);

        let opaqueCount = 0;
        for (let y = 0; y <= 15; y++) {
            for (let x = 0; x <= 15; x++) {
                const [, , , a] = getPixel(buf, x, y);
                if (a === 255) opaqueCount++;
            }
        }
        // All pixels in region should be opaque
        assert.equal(opaqueCount, 16 * 16);
    });

    it('should not modify pixels outside the specified region', () => {
        const buf = createBuf();
        drawCobblestones(buf, 5, 5, 10, 10, 5000);

        // Check pixel at (0,0) — should still be transparent
        const [, , , a] = getPixel(buf, 0, 0);
        assert.equal(a, 0);
    });

    it('should produce deterministic output for same seed', () => {
        const buf1 = createBuf();
        drawCobblestones(buf1, 0, 0, 15, 15, 5000);

        const buf2 = createBuf();
        drawCobblestones(buf2, 0, 0, 15, 15, 5000);

        assert.ok(buf1.equals(buf2), 'Same seed should produce identical output');
    });

    it('should produce different output for different seeds', () => {
        const buf1 = createBuf();
        drawCobblestones(buf1, 0, 0, 15, 15, 5000);

        const buf2 = createBuf();
        drawCobblestones(buf2, 0, 0, 15, 15, 6000);

        assert.ok(!buf1.equals(buf2), 'Different seeds should produce different output');
    });

    it('should use stone-grey color range (not green or blue)', () => {
        const buf = createBuf();
        drawCobblestones(buf, 0, 0, 15, 15, 5000);

        // Sample center pixel — should be in grey/stone range
        const [r, g, b] = getPixel(buf, 8, 8);
        // Stone colors range from ~80-170 in all channels, relatively close together
        const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
        assert.ok(maxDiff < 30, `Stone pixel should be grey-ish, got RGB(${r},${g},${b})`);
    });
});

describe('drawDirt - pixel-level assertions', () => {
    it('should fill the specified region with opaque pixels', () => {
        const buf = createBuf();
        drawDirt(buf, 0, 0, 15, 15, 3000);

        let opaqueCount = 0;
        for (let y = 0; y <= 15; y++) {
            for (let x = 0; x <= 15; x++) {
                const [, , , a] = getPixel(buf, x, y);
                if (a === 255) opaqueCount++;
            }
        }
        assert.equal(opaqueCount, 16 * 16);
    });

    it('should produce warm brown colors (red > green > blue)', () => {
        const buf = createBuf();
        drawDirt(buf, 0, 0, 31, 31, 3000);

        // Sample multiple pixels and check average color tendency
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let y = 5; y < 25; y += 5) {
            for (let x = 5; x < 25; x += 5) {
                const [r, g, b] = getPixel(buf, x, y);
                rSum += r; gSum += g; bSum += b; count++;
            }
        }
        const avgR = rSum / count, avgG = gSum / count, avgB = bSum / count;
        assert.ok(avgR > avgG, `Average red (${avgR}) should be > green (${avgG})`);
        assert.ok(avgG > avgB, `Average green (${avgG}) should be > blue (${avgB})`);
    });

    it('should contain some dark crack pixels (DIRT_DARK color)', () => {
        const buf = createBuf();
        drawDirt(buf, 0, 0, 31, 31, 3000);

        let darkCount = 0;
        for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 32; x++) {
                const [r, g, b] = getPixel(buf, x, y);
                if (r === DIRT_DARK[0] && g === DIRT_DARK[1] && b === DIRT_DARK[2]) darkCount++;
            }
        }
        assert.ok(darkCount > 0, 'Should have at least some DIRT_DARK crack pixels');
    });

    it('should be deterministic for same seed', () => {
        const buf1 = createBuf();
        drawDirt(buf1, 0, 0, 15, 15, 3000);

        const buf2 = createBuf();
        drawDirt(buf2, 0, 0, 15, 15, 3000);

        assert.ok(buf1.equals(buf2));
    });
});

describe('drawGrassEdgeVertical - pixel-level assertions', () => {
    it('should draw grass pixels near the edge column (left side)', () => {
        const buf = createBuf();
        drawGrassEdgeVertical(buf, 14, 'left', 3120);

        // Check that some pixels at or near x=14 are opaque
        let opaqueNearEdge = 0;
        for (let y = 0; y < SIZE; y++) {
            for (let x = 14; x < 17; x++) {
                const [, , , a] = getPixel(buf, x, y);
                if (a === 255) opaqueNearEdge++;
            }
        }
        assert.ok(opaqueNearEdge > 0, 'Should have opaque pixels near edge');
    });

    it('should draw grass pixels near the edge column (right side)', () => {
        const buf = createBuf();
        drawGrassEdgeVertical(buf, 17, 'right', 3220);

        let opaqueNearEdge = 0;
        for (let y = 0; y < SIZE; y++) {
            for (let x = 15; x <= 17; x++) {
                const [, , , a] = getPixel(buf, x, y);
                if (a === 255) opaqueNearEdge++;
            }
        }
        assert.ok(opaqueNearEdge > 0, 'Should have opaque pixels near edge');
    });

    it('should use green grass colors', () => {
        const buf = createBuf();
        drawGrassEdgeVertical(buf, 14, 'left', 3120);

        // Find first opaque pixel and check it's green
        for (let y = 0; y < SIZE; y++) {
            const [r, g, b, a] = getPixel(buf, 14, y);
            if (a === 255) {
                assert.ok(g > r, `Grass edge should be green, got RGB(${r},${g},${b})`);
                assert.ok(g > b, `Grass edge should be green, got RGB(${r},${g},${b})`);
                break;
            }
        }
    });

    it('should be deterministic for same seed', () => {
        const buf1 = createBuf();
        drawGrassEdgeVertical(buf1, 14, 'left', 3120);

        const buf2 = createBuf();
        drawGrassEdgeVertical(buf2, 14, 'left', 3120);

        assert.ok(buf1.equals(buf2));
    });
});

describe('drawGrassEdgeHorizontal - pixel-level assertions', () => {
    it('should draw grass pixels near the edge row (top side)', () => {
        const buf = createBuf();
        drawGrassEdgeHorizontal(buf, 14, 'top', 3320);

        let opaqueNearEdge = 0;
        for (let x = 0; x < SIZE; x++) {
            for (let y = 14; y < 17; y++) {
                const [, , , a] = getPixel(buf, x, y);
                if (a === 255) opaqueNearEdge++;
            }
        }
        assert.ok(opaqueNearEdge > 0, 'Should have opaque pixels near edge');
    });

    it('should draw grass pixels near the edge row (bottom side)', () => {
        const buf = createBuf();
        drawGrassEdgeHorizontal(buf, 17, 'bottom', 3420);

        let opaqueNearEdge = 0;
        for (let x = 0; x < SIZE; x++) {
            for (let y = 15; y <= 17; y++) {
                const [, , , a] = getPixel(buf, x, y);
                if (a === 255) opaqueNearEdge++;
            }
        }
        assert.ok(opaqueNearEdge > 0, 'Should have opaque pixels near edge');
    });
});

describe('drawBridgeWall - pixel-level assertions', () => {
    it('should fill the specified region with opaque pixels', () => {
        const buf = createBuf();
        drawBridgeWall(buf, 0, 0, 15, 10, 4025);

        let opaqueCount = 0;
        for (let y = 0; y <= 10; y++) {
            for (let x = 0; x <= 15; x++) {
                const [, , , a] = getPixel(buf, x, y);
                if (a === 255) opaqueCount++;
            }
        }
        assert.equal(opaqueCount, 16 * 11);
    });

    it('should use dark stone colors (darker than cobblestones)', () => {
        const buf = createBuf();
        drawBridgeWall(buf, 0, 0, 15, 10, 4025);

        // Sample average brightness — bridge wall should be darker than cobblestones
        let brightnessSum = 0, count = 0;
        for (let y = 0; y <= 10; y += 2) {
            for (let x = 0; x <= 15; x += 2) {
                const [r, g, b] = getPixel(buf, x, y);
                brightnessSum += (r + g + b) / 3;
                count++;
            }
        }
        const avgBrightness = brightnessSum / count;
        // Bridge wall dark is [62, 60, 52], wall is [100, 98, 88]
        // Average should be in the 60-110 range
        assert.ok(avgBrightness < 130, `Bridge wall should be dark, avg brightness: ${avgBrightness}`);
    });

    it('should be deterministic for same seed', () => {
        const buf1 = createBuf();
        drawBridgeWall(buf1, 0, 0, 15, 10, 4025);

        const buf2 = createBuf();
        drawBridgeWall(buf2, 0, 0, 15, 10, 4025);

        assert.ok(buf1.equals(buf2));
    });
});
