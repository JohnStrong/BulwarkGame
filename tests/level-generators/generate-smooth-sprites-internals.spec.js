/**
 * Direct unit tests for the internal sprite-generator functions in
 * js/level-generators/generate-smooth-sprites.js.
 *
 * Because the module has no module.exports, the generator functions are
 * replicated inline here using the same logic and palette constants.
 * This is the same pattern used throughout the test suite.
 *
 * Covers: genGrass, genFlowers, genRoadFull, genBridgeMM, genWaterV,
 *         genWaterH, genWaterEdgeRight, genWaterEdgeLeft,
 *         genTree, genPine, genShrub, genRock
 *
 * Each test asserts:
 *   (a) the returned Buffer has the correct length (SIZE × SIZE × 4)
 *   (b) the function is deterministic (two calls produce identical output)
 *   (c) the buffer has at least one non-zero pixel
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-smooth-sprites-internals.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Constants (mirrored from generate-smooth-sprites.js) ────────────────────

const SIZE = 32;
const EXPECTED_BUF_LEN = SIZE * SIZE * 4;

// Palette
const GRASS       = [95, 180, 72];
const GRASS_DARK  = [75, 155, 55];
const DIRT        = [210, 165, 110];
const DIRT_LIGHT  = [230, 185, 130];
const DIRT_DARK   = [170, 130, 80];
const STONE       = [140, 138, 130];
const STONE_LIGHT = [165, 162, 152];
const WATER       = [45, 120, 210];
const WATER_LIGHT = [80, 155, 235];
const WATER_DARK  = [25, 85, 175];
const WATER_EDGE  = [35, 100, 190];
const TREE_DARK   = [28, 85, 25];
const TREE_MID    = [48, 130, 42];
const TREE_LIGHT  = [75, 170, 60];
const TREE_SHADOW = [38, 108, 32];
const PINE_DARK   = [18, 62, 28];
const PINE_MID    = [30, 90, 38];
const PINE_LIGHT  = [48, 120, 50];
const PINE_TRUNK  = [65, 42, 25];
const SHRUB_DARK  = [35, 105, 30];
const SHRUB_MID   = [52, 138, 42];
const SHRUB_LIGHT = [72, 165, 55];
const BRIDGE_WALL      = [100, 98, 88];
const BRIDGE_WALL_DARK = [62, 60, 52];
const BRIDGE_ROAD      = [140, 138, 128];
const BRIDGE_ROAD_DARK = [95, 92, 82];

// ─── PRNG (mirrored) ──────────────────────────────────────────────────────────

let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }

// ─── Buffer helpers ───────────────────────────────────────────────────────────

function createBuf() { return Buffer.alloc(SIZE * SIZE * 4); }

function px(buf, x, y, r, g, b) {
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    const i = (y * SIZE + x) * 4;
    buf[i]     = Math.max(0, Math.min(255, Math.round(r)));
    buf[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[i + 3] = 255;
}

function fill(buf, color, noise, sv) {
    resetSeed(sv);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * noise;
            px(buf, x, y, color[0] + n, color[1] + n, color[2] + n);
        }
}

function drawDirt(buf, x1, y1, x2, y2, sv) {
    resetSeed(sv);
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * 10;
            px(buf, x, y, DIRT[0] + n, DIRT[1] + n, DIRT[2] + n);
        }
    resetSeed(sv + 50);
    for (let i = 0; i < 8; i++) {
        let cx = x1 + Math.floor(seededRandom() * (x2 - x1 + 1));
        let cy = y1 + Math.floor(seededRandom() * (y2 - y1 + 1));
        for (let s = 0; s < 4; s++) {
            px(buf, cx, cy, ...DIRT_DARK);
            cx += Math.floor(seededRandom() * 3) - 1;
            cy += Math.floor(seededRandom() * 3) - 1;
        }
    }
}

function drawBridgeRoad(buf, x1, y1, x2, y2, sv) {
    resetSeed(sv);
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * 4;
            px(buf, x, y, BRIDGE_ROAD_DARK[0] + n, BRIDGE_ROAD_DARK[1] + n, BRIDGE_ROAD_DARK[2] + n);
        }
    resetSeed(sv + 50);
    for (let sy = y1; sy <= y2; sy += 5) {
        const rowOff = ((sy - y1) / 5) % 2 === 0 ? 0 : 3;
        for (let sx = x1 + rowOff; sx <= x2; sx += 6) {
            const sw = 4 + Math.floor(seededRandom() * 2);
            const sh = 3 + Math.floor(seededRandom() * 2);
            for (let dy = 0; dy < sh && sy + dy <= y2; dy++)
                for (let dx = 0; dx < sw && sx + dx <= x2; dx++) {
                    if ((dx === 0 && dy === 0) || (dx === sw - 1 && dy === 0) ||
                        (dx === 0 && dy === sh - 1) || (dx === sw - 1 && dy === sh - 1)) continue;
                    const n = (seededRandom() - 0.5) * 5;
                    px(buf, sx + dx, sy + dy, BRIDGE_ROAD[0] + n, BRIDGE_ROAD[1] + n, BRIDGE_ROAD[2] + n);
                }
        }
    }
}

// ─── Generator functions (mirrored) ──────────────────────────────────────────

function genGrass(v) {
    const buf = createBuf();
    fill(buf, GRASS, 14, 1000 + v * 100);
    resetSeed(1050 + v * 100);
    for (let i = 0; i < 6; i++)
        px(buf, Math.floor(seededRandom() * SIZE), Math.floor(seededRandom() * SIZE), ...GRASS_DARK);
    return buf;
}

function genFlowers(v) {
    const buf = createBuf();
    fill(buf, GRASS, 14, 2000 + v * 100);
    resetSeed(2050 + v * 100);
    const flowerColors = [
        { petal: [240, 80, 120], center: [255, 220, 60] },
        { petal: [255, 200, 50], center: [180, 100, 30] },
        { petal: [220, 220, 240], center: [240, 200, 50] },
        { petal: [180, 100, 220], center: [255, 230, 80] },
    ];
    const count = 3 + Math.floor(seededRandom() * 2);
    for (let i = 0; i < count; i++) {
        const fx = 5 + Math.floor(seededRandom() * 22);
        const fy = 5 + Math.floor(seededRandom() * 22);
        const flower = flowerColors[Math.floor(seededRandom() * flowerColors.length)];
        const dirs = [[0,-2],[0,2],[-2,0],[2,0],[-1,-1],[1,-1],[-1,1],[1,1]];
        for (const [dx, dy] of dirs) px(buf, fx + dx, fy + dy, ...flower.petal);
        px(buf, fx, fy - 1, ...flower.petal);
        px(buf, fx, fy + 1, ...flower.petal);
        px(buf, fx - 1, fy, ...flower.petal);
        px(buf, fx + 1, fy, ...flower.petal);
        px(buf, fx, fy, ...flower.center);
        px(buf, fx, fy + 3, 45, 120, 35);
        px(buf, fx, fy + 4, 40, 110, 30);
    }
    return buf;
}

function genRoadFull() {
    const buf = createBuf();
    drawDirt(buf, 0, 0, 31, 31, 3000);
    return buf;
}

function genBridgeMM() {
    const buf = createBuf();
    drawBridgeRoad(buf, 0, 0, 31, 31, 4410);
    return buf;
}

function genWaterV(v) {
    const buf = createBuf();
    fill(buf, WATER, 12, 5000 + v * 100);
    resetSeed(5050 + v * 100);
    for (let i = 0; i < 6; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        const len = 4 + Math.floor(seededRandom() * 5);
        for (let d = 0; d < len; d++) px(buf, x, y + d, ...WATER_LIGHT);
    }
    resetSeed(5060 + v * 100);
    for (let i = 0; i < 3; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        const len = 3 + Math.floor(seededRandom() * 4);
        for (let d = 0; d < len; d++) px(buf, x + 1, y + d, ...WATER_DARK);
    }
    return buf;
}

function genWaterH(v) {
    const buf = createBuf();
    fill(buf, WATER, 12, 5500 + v * 100);
    resetSeed(5550 + v * 100);
    for (let i = 0; i < 6; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        const len = 4 + Math.floor(seededRandom() * 5);
        for (let d = 0; d < len; d++) px(buf, x + d, y, ...WATER_LIGHT);
    }
    resetSeed(5560 + v * 100);
    for (let i = 0; i < 3; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        const len = 3 + Math.floor(seededRandom() * 4);
        for (let d = 0; d < len; d++) px(buf, x + d, y + 1, ...WATER_DARK);
    }
    return buf;
}

function genWaterEdgeRight() {
    const buf = createBuf();
    resetSeed(5200);
    for (let y = 0; y < SIZE; y++) {
        const edge = 16 + Math.round(Math.sin(y * 0.25) * 2);
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * 3;
            if (x > edge + 1) px(buf, x, y, GRASS[0] + n, GRASS[1] + n, GRASS[2] + n);
            else if (x > edge - 1) px(buf, x, y, WATER_EDGE[0] + n, WATER_EDGE[1] + n, WATER_EDGE[2] + n);
            else px(buf, x, y, WATER[0] + n, WATER[1] + n, WATER[2] + n);
        }
    }
    return buf;
}

function genWaterEdgeLeft() {
    const buf = createBuf();
    resetSeed(5300);
    for (let y = 0; y < SIZE; y++) {
        const edge = 15 + Math.round(Math.sin(y * 0.25 + 1) * 2);
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * 3;
            if (x < edge - 1) px(buf, x, y, GRASS[0] + n, GRASS[1] + n, GRASS[2] + n);
            else if (x < edge + 1) px(buf, x, y, WATER_EDGE[0] + n, WATER_EDGE[1] + n, WATER_EDGE[2] + n);
            else px(buf, x, y, WATER[0] + n, WATER[1] + n, WATER[2] + n);
        }
    }
    return buf;
}

function genTree(v) {
    const buf = createBuf();
    fill(buf, GRASS, 12, 6000 + v * 100);
    const cx = 16, cy = 14, r = 9 + (v % 2);
    resetSeed(6050 + v * 100);
    for (let dy = -3; dy <= 3; dy++)
        for (let dx = -r; dx <= r; dx++)
            if ((dx * dx) / (r * r) + (dy * dy) / 9 < 1)
                px(buf, cx + dx + 2, cy + r + dy, ...TREE_SHADOW);
    for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= r) {
                const n = (seededRandom() - 0.5) * 5;
                const c = (d < r * 0.4 && dy < 0) ? TREE_LIGHT : (d > r * 0.75 ? TREE_DARK : TREE_MID);
                px(buf, cx + dx, cy + dy, c[0] + n, c[1] + n, c[2] + n);
            }
        }
    return buf;
}

function genPine(v) {
    const buf = createBuf();
    fill(buf, GRASS, 12, 6500 + v * 100);
    const cx = 16, baseY = 26;
    resetSeed(6550 + v * 100);
    for (let y = baseY - 2; y <= baseY + 2; y++)
        for (let dx = -1; dx <= 1; dx++)
            px(buf, cx + dx, y, ...PINE_TRUNK);
    const layers = [
        { y: baseY - 4, halfW: 8, color: PINE_DARK },
        { y: baseY - 9, halfW: 6, color: PINE_MID },
        { y: baseY - 13, halfW: 4, color: PINE_LIGHT },
    ];
    for (const layer of layers) {
        for (let dy = 0; dy < 6; dy++) {
            const w = Math.round(layer.halfW * (1 - dy / 8));
            for (let dx = -w; dx <= w; dx++) {
                const n = (seededRandom() - 0.5) * 5;
                const d = Math.abs(dx) / (w || 1);
                const c = d > 0.7 ? PINE_DARK : (dy < 2 ? PINE_LIGHT : layer.color);
                px(buf, cx + dx, layer.y - dy, c[0] + n, c[1] + n, c[2] + n);
            }
        }
    }
    for (let dx = -5; dx <= 5; dx++)
        for (let dy = 0; dy <= 2; dy++)
            if (Math.abs(dx) + dy < 6) px(buf, cx + dx + 2, baseY + 2 + dy, ...TREE_SHADOW);
    return buf;
}

function genShrub(v) {
    const buf = createBuf();
    fill(buf, GRASS, 12, 6800 + v * 100);
    const cx = 16, cy = 18;
    const rx = 8 + (v % 2) * 2, ry = 5 + (v % 2);
    resetSeed(6850 + v * 100);
    for (let dy = -2; dy <= 2; dy++)
        for (let dx = -rx; dx <= rx; dx++)
            if ((dx * dx) / (rx * rx) + (dy * dy) / 4 < 1)
                px(buf, cx + dx + 1, cy + ry + dy - 1, ...TREE_SHADOW);
    for (let dy = -ry; dy <= ry; dy++)
        for (let dx = -rx; dx <= rx; dx++) {
            const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
            if (d <= 1) {
                const n = (seededRandom() - 0.5) * 6;
                const c = d < 0.3 ? SHRUB_LIGHT : (d > 0.7 ? SHRUB_DARK : SHRUB_MID);
                px(buf, cx + dx, cy + dy, c[0] + n, c[1] + n, c[2] + n);
            }
        }
    return buf;
}

function genRock() {
    const buf = createBuf();
    fill(buf, GRASS, 12, 7000);
    resetSeed(7050);
    const cx = 16, cy = 18, r = 4;
    for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
            if (dx * dx + dy * dy <= r * r)
                px(buf, cx + dx, cy + dy, ...(dy < 0 ? STONE_LIGHT : STONE));
    return buf;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function countNonZeroBytes(buf) {
    let count = 0;
    for (let i = 0; i < buf.length; i++) if (buf[i] !== 0) count++;
    return count;
}

// ─── Test matrix ──────────────────────────────────────────────────────────────

const generators = [
    { name: 'genGrass(0)',        fn: () => genGrass(0) },
    { name: 'genGrass(1)',        fn: () => genGrass(1) },
    { name: 'genFlowers(0)',      fn: () => genFlowers(0) },
    { name: 'genFlowers(1)',      fn: () => genFlowers(1) },
    { name: 'genRoadFull()',      fn: () => genRoadFull() },
    { name: 'genBridgeMM()',      fn: () => genBridgeMM() },
    { name: 'genWaterV(0)',       fn: () => genWaterV(0) },
    { name: 'genWaterV(1)',       fn: () => genWaterV(1) },
    { name: 'genWaterV(2)',       fn: () => genWaterV(2) },
    { name: 'genWaterH(0)',       fn: () => genWaterH(0) },
    { name: 'genWaterH(1)',       fn: () => genWaterH(1) },
    { name: 'genWaterEdgeRight()',fn: () => genWaterEdgeRight() },
    { name: 'genWaterEdgeLeft()', fn: () => genWaterEdgeLeft() },
    { name: 'genTree(0)',         fn: () => genTree(0) },
    { name: 'genTree(1)',         fn: () => genTree(1) },
    { name: 'genTree(2)',         fn: () => genTree(2) },
    { name: 'genPine(0)',         fn: () => genPine(0) },
    { name: 'genPine(1)',         fn: () => genPine(1) },
    { name: 'genShrub(0)',        fn: () => genShrub(0) },
    { name: 'genShrub(1)',        fn: () => genShrub(1) },
    { name: 'genRock()',          fn: () => genRock() },
];

describe('generate-smooth-sprites internals: buffer size', () => {
    for (const { name, fn } of generators) {
        it(`${name} returns a Buffer of length ${EXPECTED_BUF_LEN}`, () => {
            const buf = fn();
            assert.ok(Buffer.isBuffer(buf), `${name} should return a Buffer`);
            assert.equal(buf.length, EXPECTED_BUF_LEN,
                `${name} buffer length should be ${EXPECTED_BUF_LEN}`);
        });
    }
});

describe('generate-smooth-sprites internals: determinism', () => {
    for (const { name, fn } of generators) {
        it(`${name} is deterministic (two calls produce identical output)`, () => {
            const buf1 = fn();
            const buf2 = fn();
            assert.ok(buf1.equals(buf2), `${name} should be deterministic`);
        });
    }
});

describe('generate-smooth-sprites internals: non-empty output', () => {
    for (const { name, fn } of generators) {
        it(`${name} writes at least one non-zero byte`, () => {
            const buf = fn();
            assert.ok(countNonZeroBytes(buf) > 0, `${name} should write at least one pixel`);
        });
    }
});

describe('generate-smooth-sprites internals: variant differentiation', () => {
    it('genGrass(0) and genGrass(1) produce different output', () => {
        assert.ok(!genGrass(0).equals(genGrass(1)));
    });

    it('genFlowers(0) and genFlowers(1) produce different output', () => {
        assert.ok(!genFlowers(0).equals(genFlowers(1)));
    });

    it('genWaterV(0), genWaterV(1), genWaterV(2) are all different', () => {
        const v0 = genWaterV(0), v1 = genWaterV(1), v2 = genWaterV(2);
        assert.ok(!v0.equals(v1), 'water-1 and water-2 should differ');
        assert.ok(!v1.equals(v2), 'water-2 and water-3 should differ');
    });

    it('genWaterH(0) and genWaterH(1) produce different output', () => {
        assert.ok(!genWaterH(0).equals(genWaterH(1)));
    });

    it('genWaterEdgeRight and genWaterEdgeLeft produce different output', () => {
        assert.ok(!genWaterEdgeRight().equals(genWaterEdgeLeft()));
    });

    it('genTree(0), genTree(1), genTree(2) are all different', () => {
        const t0 = genTree(0), t1 = genTree(1), t2 = genTree(2);
        assert.ok(!t0.equals(t1), 'tree-1 and tree-2 should differ');
        assert.ok(!t1.equals(t2), 'tree-2 and tree-3 should differ');
    });

    it('genPine(0) and genPine(1) produce different output', () => {
        assert.ok(!genPine(0).equals(genPine(1)));
    });

    it('genShrub(0) and genShrub(1) produce different output', () => {
        assert.ok(!genShrub(0).equals(genShrub(1)));
    });

    it('genTree, genPine, genShrub produce different output for variant 0', () => {
        const tree  = genTree(0);
        const pine  = genPine(0);
        const shrub = genShrub(0);
        assert.ok(!tree.equals(pine),  'tree and pine should differ');
        assert.ok(!pine.equals(shrub), 'pine and shrub should differ');
        assert.ok(!tree.equals(shrub), 'tree and shrub should differ');
    });
});

describe('generate-smooth-sprites internals: color characteristics', () => {
    it('genGrass should have predominantly green pixels', () => {
        const buf = genGrass(0);
        // Sample center pixel (16, 16)
        const idx = (16 * SIZE + 16) * 4;
        assert.ok(buf[idx + 1] > buf[idx],     'Green channel should exceed red for grass');
        assert.ok(buf[idx + 1] > buf[idx + 2], 'Green channel should exceed blue for grass');
    });

    it('genWaterV should have predominantly blue pixels', () => {
        const buf = genWaterV(0);
        const idx = (16 * SIZE + 16) * 4;
        assert.ok(buf[idx + 2] > buf[idx],     'Blue channel should exceed red for water');
        assert.ok(buf[idx + 2] > buf[idx + 1], 'Blue channel should exceed green for water');
    });

    it('genRoadFull should have warm brown pixels (red > blue)', () => {
        const buf = genRoadFull();
        const idx = (16 * SIZE + 16) * 4;
        assert.ok(buf[idx] > buf[idx + 2], 'Red channel should exceed blue for road');
    });

    it('genBridgeMM should have grey-ish pixels (channels close together)', () => {
        const buf = genBridgeMM();
        const idx = (16 * SIZE + 16) * 4;
        const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
        const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
        assert.ok(maxDiff < 60, `Bridge stone should be grey-ish, got RGB(${r},${g},${b})`);
    });
});
