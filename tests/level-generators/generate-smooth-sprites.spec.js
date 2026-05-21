/**
 * Tests for js/level-generators/generate-smooth-sprites.js
 *
 * Tests the 32×32 pixel art sprite generation logic (hex-based sprites).
 * Since the module auto-runs generateAll() on require, we re-implement
 * the core utility functions and test them directly.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-smooth-sprites.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Re-implement the local utilities from generate-smooth-sprites.js

const SIZE = 32;

let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }

function createBuf() { return Buffer.alloc(SIZE * SIZE * 4); }

function px(buf, x, y, r, g, b) {
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    const i = (y * SIZE + x) * 4;
    buf[i] = Math.max(0, Math.min(255, Math.round(r)));
    buf[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[i + 3] = 255;
}

function fill(buf, color, noise, sv) {
    resetSeed(sv);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * noise;
            const dither = seededRandom() > 0.92 ? 15 : (seededRandom() < 0.08 ? -12 : 0);
            px(buf, x, y, color[0] + n + dither, color[1] + n + dither, color[2] + n + dither);
        }
}

function pointInHex(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x, yi = pts[i].y;
        const xj = pts[j].x, yj = pts[j].y;
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

function getHexPoints() {
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        points.push({ x: cx + (SIZE / 2) * Math.cos(angle), y: cy + (SIZE / 2) * Math.sin(angle) });
    }
    return points;
}

function drawHexBorder(buf) {
    const points = getHexPoints();
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (!pointInHex(x, y, points)) {
                const idx = (y * SIZE + x) * 4;
                buf[idx] = 0; buf[idx + 1] = 0; buf[idx + 2] = 0; buf[idx + 3] = 0;
            }
        }
    }
}

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] === 255) count++;
    }
    return count;
}

describe('generate-smooth-sprites: seededRandom', () => {
    it('should return values between 0 and 1', () => {
        resetSeed(42);
        for (let i = 0; i < 100; i++) {
            const val = seededRandom();
            assert.ok(val >= 0 && val <= 1);
        }
    });

    it('should be deterministic', () => {
        resetSeed(100);
        const seq1 = [];
        for (let i = 0; i < 10; i++) seq1.push(seededRandom());

        resetSeed(100);
        const seq2 = [];
        for (let i = 0; i < 10; i++) seq2.push(seededRandom());

        assert.deepEqual(seq1, seq2);
    });
});

describe('generate-smooth-sprites: createBuf', () => {
    it('should create a buffer of SIZE*SIZE*4 bytes', () => {
        const buf = createBuf();
        assert.equal(buf.length, SIZE * SIZE * 4);
    });

    it('should be initialized to zeros', () => {
        const buf = createBuf();
        for (let i = 0; i < buf.length; i++) {
            assert.equal(buf[i], 0);
        }
    });
});

describe('generate-smooth-sprites: px (setPixel)', () => {
    it('should write RGBA at correct offset', () => {
        const buf = createBuf();
        px(buf, 5, 3, 100, 150, 200);
        const idx = (3 * SIZE + 5) * 4;
        assert.equal(buf[idx], 100);
        assert.equal(buf[idx + 1], 150);
        assert.equal(buf[idx + 2], 200);
        assert.equal(buf[idx + 3], 255);
    });

    it('should clamp values to 0-255', () => {
        const buf = createBuf();
        px(buf, 0, 0, -10, 300, 128);
        assert.equal(buf[0], 0);
        assert.equal(buf[1], 255);
        assert.equal(buf[2], 128);
    });

    it('should ignore out-of-bounds coordinates', () => {
        const buf = createBuf();
        px(buf, -1, 0, 255, 0, 0);
        px(buf, SIZE, 0, 255, 0, 0);
        px(buf, 0, -1, 255, 0, 0);
        px(buf, 0, SIZE, 255, 0, 0);
        // Buffer should remain all zeros
        for (let i = 0; i < 16; i++) {
            assert.equal(buf[i], 0);
        }
    });
});

describe('generate-smooth-sprites: fill', () => {
    it('should fill entire buffer with opaque pixels', () => {
        const buf = createBuf();
        fill(buf, [100, 150, 200], 10, 1000);
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
    });

    it('should be deterministic for the same seed', () => {
        const buf1 = createBuf();
        fill(buf1, [100, 150, 200], 10, 1000);

        const buf2 = createBuf();
        fill(buf2, [100, 150, 200], 10, 1000);

        assert.ok(buf1.equals(buf2));
    });

    it('should produce different output for different seeds', () => {
        const buf1 = createBuf();
        fill(buf1, [100, 150, 200], 10, 1000);

        const buf2 = createBuf();
        fill(buf2, [100, 150, 200], 10, 2000);

        assert.ok(!buf1.equals(buf2));
    });
});

describe('generate-smooth-sprites: pointInHex', () => {
    const points = getHexPoints();

    it('center of tile should be inside hex', () => {
        assert.ok(pointInHex(16, 16, points));
    });

    it('corners of tile should be outside hex', () => {
        assert.ok(!pointInHex(0, 0, points));
        assert.ok(!pointInHex(31, 0, points));
        assert.ok(!pointInHex(0, 31, points));
        assert.ok(!pointInHex(31, 31, points));
    });

    it('points near center should be inside', () => {
        assert.ok(pointInHex(10, 16, points));
        assert.ok(pointInHex(22, 16, points));
        assert.ok(pointInHex(16, 10, points));
        assert.ok(pointInHex(16, 22, points));
    });
});

describe('generate-smooth-sprites: drawHexBorder', () => {
    it('should make pixels outside hex transparent', () => {
        const buf = createBuf();
        fill(buf, [100, 100, 100], 0, 5000);
        drawHexBorder(buf);

        // Corner should be transparent
        const cornerIdx = (0 * SIZE + 0) * 4;
        assert.equal(buf[cornerIdx + 3], 0);
    });

    it('should keep pixels inside hex opaque', () => {
        const buf = createBuf();
        fill(buf, [100, 100, 100], 0, 5000);
        drawHexBorder(buf);

        // Center should remain opaque
        const centerIdx = (16 * SIZE + 16) * 4;
        assert.equal(buf[centerIdx + 3], 255);
    });

    it('should result in fewer opaque pixels than a full square', () => {
        const buf = createBuf();
        fill(buf, [100, 100, 100], 0, 5000);
        drawHexBorder(buf);

        const opaqueCount = countOpaquePixels(buf);
        assert.ok(opaqueCount < SIZE * SIZE, 'Hex should clip some pixels');
        assert.ok(opaqueCount > SIZE * SIZE * 0.5, 'Hex should keep most pixels');
    });
});

describe('generate-smooth-sprites: sprite generation integration', () => {
    const GRASS = [95, 180, 72];
    const WATER = [45, 120, 210];

    it('grass sprite should have green-dominant colors', () => {
        const buf = createBuf();
        fill(buf, GRASS, 14, 1000);
        drawHexBorder(buf);

        // Sample center pixel
        const centerIdx = (16 * SIZE + 16) * 4;
        assert.ok(buf[centerIdx + 1] > buf[centerIdx], 'Green > Red for grass');
        assert.ok(buf[centerIdx + 1] > buf[centerIdx + 2], 'Green > Blue for grass');
    });

    it('water sprite should have blue-dominant colors', () => {
        const buf = createBuf();
        fill(buf, WATER, 12, 5000);
        drawHexBorder(buf);

        const centerIdx = (16 * SIZE + 16) * 4;
        assert.ok(buf[centerIdx + 2] > buf[centerIdx], 'Blue > Red for water');
        assert.ok(buf[centerIdx + 2] > buf[centerIdx + 1], 'Blue > Green for water');
    });
});
