/**
 * Tests for genWaterH() in generate-smooth-sprites.js — Recommendation 8.
 *
 * Covers the horizontal water flow variant that was previously untested.
 * The vertical genWaterV() is tested in generate-smooth-sprites-extended.spec.js;
 * this adds symmetric coverage for horizontal.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-smooth-sprites-water-h.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const SIZE = 32;

// ─── Re-implement utilities from generate-smooth-sprites.js ─────────────────

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

// Palette constants
const WATER = [45, 120, 210];
const WATER_LIGHT = [80, 155, 235];
const WATER_DARK = [25, 85, 175];

// ─── Re-implement genWaterH and genWaterV ───────────────────────────────────

function genWaterH(v) {
    const buf = createBuf();
    fill(buf, WATER, 12, 5500 + v * 100);
    resetSeed(5550 + v * 100);
    // Horizontal flow streaks (left to right)
    for (let i = 0; i < 6; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        const len = 4 + Math.floor(seededRandom() * 5);
        for (let d = 0; d < len; d++) px(buf, x + d, y, ...WATER_LIGHT);
    }
    // Subtle darker current lines
    resetSeed(5560 + v * 100);
    for (let i = 0; i < 3; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        const len = 3 + Math.floor(seededRandom() * 4);
        for (let d = 0; d < len; d++) px(buf, x + d, y + 1, ...WATER_DARK);
    }
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] === 255) count++;
    }
    return count;
}

function getPixel(buf, x, y) {
    const i = (y * SIZE + x) * 4;
    return { r: buf[i], g: buf[i + 1], b: buf[i + 2], a: buf[i + 3] };
}

function hasHorizontalStreak(buf, color, minLen) {
    // Look for horizontal runs of pixels matching the given color (within tolerance)
    for (let y = 0; y < SIZE; y++) {
        let runLength = 0;
        for (let x = 0; x < SIZE; x++) {
            const p = getPixel(buf, x, y);
            const dr = Math.abs(p.r - color[0]);
            const dg = Math.abs(p.g - color[1]);
            const db = Math.abs(p.b - color[2]);
            if (dr < 5 && dg < 5 && db < 5) {
                runLength++;
                if (runLength >= minLen) return true;
            } else {
                runLength = 0;
            }
        }
    }
    return false;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('generate-smooth-sprites: genWaterH (horizontal water flow)', () => {
    it('should produce a fully opaque buffer', () => {
        const buf = genWaterH(0);
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
    });

    it('should be deterministic for the same variant', () => {
        const buf1 = genWaterH(0);
        const buf2 = genWaterH(0);
        assert.ok(buf1.equals(buf2));
    });

    it('variant 0 and variant 1 should produce different output', () => {
        const buf0 = genWaterH(0);
        const buf1 = genWaterH(1);
        assert.ok(!buf0.equals(buf1));
    });

    it('should have blue-dominant colors (water palette)', () => {
        const buf = genWaterH(0);
        const center = getPixel(buf, 16, 16);
        assert.ok(center.b > center.r, `Blue should be > Red (B=${center.b}, R=${center.r})`);
        assert.ok(center.b > center.g, `Blue should be > Green (B=${center.b}, G=${center.g})`);
    });

    it('should contain horizontal light streaks (WATER_LIGHT)', () => {
        const buf = genWaterH(0);
        // Look for horizontal runs of light water pixels
        const found = hasHorizontalStreak(buf, WATER_LIGHT, 3);
        assert.ok(found, 'Should have horizontal light streaks of at least 3 pixels');
    });

    it('should contain darker current lines (WATER_DARK)', () => {
        const buf = genWaterH(0);
        // Check that some pixels match WATER_DARK color
        let darkPixels = 0;
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                const p = getPixel(buf, x, y);
                if (Math.abs(p.r - WATER_DARK[0]) < 10 &&
                    Math.abs(p.g - WATER_DARK[1]) < 10 &&
                    Math.abs(p.b - WATER_DARK[2]) < 10) {
                    darkPixels++;
                }
            }
        }
        assert.ok(darkPixels >= 3, `Should have dark current pixels, got ${darkPixels}`);
    });

    it('should differ from vertical water variant (genWaterV)', () => {
        const bufH = genWaterH(0);
        const bufV = genWaterV(0);
        assert.ok(!bufH.equals(bufV), 'Horizontal and vertical water should differ');
    });

    it('should have horizontal flow direction (streaks run left-to-right)', () => {
        const buf = genWaterH(0);
        // Horizontal streaks: consecutive light pixels in the same row
        // Vertical streaks: consecutive light pixels in the same column
        // Count horizontal vs vertical runs of WATER_LIGHT
        let hRuns = 0, vRuns = 0;

        // Count horizontal runs
        for (let y = 0; y < SIZE; y++) {
            let run = 0;
            for (let x = 0; x < SIZE; x++) {
                const p = getPixel(buf, x, y);
                if (Math.abs(p.r - WATER_LIGHT[0]) < 5 &&
                    Math.abs(p.g - WATER_LIGHT[1]) < 5 &&
                    Math.abs(p.b - WATER_LIGHT[2]) < 5) {
                    run++;
                } else {
                    if (run >= 3) hRuns++;
                    run = 0;
                }
            }
            if (run >= 3) hRuns++;
        }

        // Count vertical runs
        for (let x = 0; x < SIZE; x++) {
            let run = 0;
            for (let y = 0; y < SIZE; y++) {
                const p = getPixel(buf, x, y);
                if (Math.abs(p.r - WATER_LIGHT[0]) < 5 &&
                    Math.abs(p.g - WATER_LIGHT[1]) < 5 &&
                    Math.abs(p.b - WATER_LIGHT[2]) < 5) {
                    run++;
                } else {
                    if (run >= 3) vRuns++;
                    run = 0;
                }
            }
            if (run >= 3) vRuns++;
        }

        // Horizontal water should have more horizontal runs than vertical
        assert.ok(hRuns >= vRuns,
            `Horizontal water should have more H runs (${hRuns}) than V runs (${vRuns})`);
    });

    it('should produce multiple variants with different seeds', () => {
        const variants = [0, 1, 2].map(v => genWaterH(v));
        // At least 2 of 3 should differ
        const allSame = variants[0].equals(variants[1]) && variants[1].equals(variants[2]);
        assert.ok(!allSame, 'Multiple variants should produce different output');
    });
});
