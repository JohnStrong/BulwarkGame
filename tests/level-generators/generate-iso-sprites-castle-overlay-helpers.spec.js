/**
 * Tests for the castle overlay buffer helpers in generate-iso-sprites-br-tl.js:
 *   - createCastleOverlayBuffer(width, height) — allocates a fully-transparent RGBA buffer
 *   - setCastleOverlayPixel(buffer, width, x, y, r, g, b) — writes one opaque pixel, ignores OOB
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-iso-sprites-castle-overlay-helpers.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    createCastleOverlayBuffer,
    setCastleOverlayPixel,
} = require('../../js/level-generators/generate-iso-sprites-br-tl');

// ─── Tests: createCastleOverlayBuffer ────────────────────────────────────────

describe('createCastleOverlayBuffer', () => {
    it('should return a buffer of length width × height × 4 for 64×48', () => {
        const buf = createCastleOverlayBuffer(64, 48);
        assert.equal(buf.length, 64 * 48 * 4);
        assert.equal(buf.length, 12288);
    });

    it('should return a buffer of length width × height × 4 for 64×64', () => {
        const buf = createCastleOverlayBuffer(64, 64);
        assert.equal(buf.length, 64 * 64 * 4);
    });

    it('should return a buffer of length width × height × 4 for 64×80', () => {
        const buf = createCastleOverlayBuffer(64, 80);
        assert.equal(buf.length, 64 * 80 * 4);
    });

    it('should be fully transparent — all bytes zero (64×48)', () => {
        const buf = createCastleOverlayBuffer(64, 48);
        for (let i = 0; i < buf.length; i++) {
            assert.equal(buf[i], 0, `byte ${i} should be 0`);
        }
    });

    it('should be fully transparent — all bytes zero (64×64)', () => {
        const buf = createCastleOverlayBuffer(64, 64);
        for (let i = 0; i < buf.length; i++) {
            assert.equal(buf[i], 0, `byte ${i} should be 0`);
        }
    });

    it('should return a new independent buffer each call', () => {
        const a = createCastleOverlayBuffer(64, 48);
        const b = createCastleOverlayBuffer(64, 48);
        a[0] = 42;
        assert.equal(b[0], 0, 'modifying one buffer should not affect the other');
    });

    it('should return a Buffer instance', () => {
        const buf = createCastleOverlayBuffer(64, 48);
        assert.ok(Buffer.isBuffer(buf), 'should be a Buffer');
    });
});

// ─── Tests: setCastleOverlayPixel ─────────────────────────────────────────────

describe('setCastleOverlayPixel', () => {
    it('should write correct RGBA bytes at position (5, 3) in a 64×48 buffer', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 48);
        setCastleOverlayPixel(buf, width, 5, 3, 255, 0, 0);
        const idx = (3 * width + 5) * 4;
        assert.equal(buf[idx],     255, 'R should be 255');
        assert.equal(buf[idx + 1],   0, 'G should be 0');
        assert.equal(buf[idx + 2],   0, 'B should be 0');
        assert.equal(buf[idx + 3], 255, 'A should be 255 (fully opaque)');
    });

    it('should write correct RGBA bytes at position (0, 0)', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 48);
        setCastleOverlayPixel(buf, width, 0, 0, 10, 20, 30);
        assert.equal(buf[0], 10);
        assert.equal(buf[1], 20);
        assert.equal(buf[2], 30);
        assert.equal(buf[3], 255);
    });

    it('should write correct RGBA bytes at the last valid pixel (63, 47)', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 48);
        setCastleOverlayPixel(buf, width, 63, 47, 100, 150, 200);
        const idx = (47 * width + 63) * 4;
        assert.equal(buf[idx],     100);
        assert.equal(buf[idx + 1], 150);
        assert.equal(buf[idx + 2], 200);
        assert.equal(buf[idx + 3], 255);
    });

    it('should always set alpha to 255 (fully opaque)', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 48);
        setCastleOverlayPixel(buf, width, 10, 10, 0, 0, 0);
        const idx = (10 * width + 10) * 4;
        assert.equal(buf[idx + 3], 255);
    });

    it('should write correct pixel in a 64×64 buffer', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 64);
        setCastleOverlayPixel(buf, width, 32, 32, 50, 100, 150);
        const idx = (32 * width + 32) * 4;
        assert.equal(buf[idx],     50);
        assert.equal(buf[idx + 1], 100);
        assert.equal(buf[idx + 2], 150);
        assert.equal(buf[idx + 3], 255);
    });

    it('should write correct pixel in a 64×80 buffer', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 80);
        setCastleOverlayPixel(buf, width, 0, 79, 1, 2, 3);
        const idx = (79 * width + 0) * 4;
        assert.equal(buf[idx],     1);
        assert.equal(buf[idx + 1], 2);
        assert.equal(buf[idx + 2], 3);
        assert.equal(buf[idx + 3], 255);
    });

    it('should not modify any other pixels when writing one pixel', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 48);
        setCastleOverlayPixel(buf, width, 5, 3, 255, 0, 0);
        const idx = (3 * width + 5) * 4;
        // Check that surrounding pixels are still zero
        if (idx > 0) assert.equal(buf[idx - 1], 0, 'byte before pixel should be 0');
        if (idx + 4 < buf.length) assert.equal(buf[idx + 4], 0, 'byte after pixel should be 0');
    });

    // ── Out-of-bounds: silently ignore ────────────────────────────────────────

    it('should silently ignore x = -1 (out-of-bounds, no throw)', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 48);
        assert.doesNotThrow(() => setCastleOverlayPixel(buf, width, -1, 0, 255, 0, 0));
        // Buffer should remain all zeros
        for (let i = 0; i < buf.length; i++) {
            assert.equal(buf[i], 0, `byte ${i} should remain 0 after OOB write`);
        }
    });

    it('should silently ignore y = 100 on a 64×48 buffer (out-of-bounds, no throw)', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 48);
        assert.doesNotThrow(() => setCastleOverlayPixel(buf, width, 0, 100, 255, 0, 0));
        // Buffer should remain all zeros
        for (let i = 0; i < buf.length; i++) {
            assert.equal(buf[i], 0, `byte ${i} should remain 0 after OOB write`);
        }
    });

    it('should silently ignore x = width (out-of-bounds)', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 48);
        assert.doesNotThrow(() => setCastleOverlayPixel(buf, width, width, 0, 255, 0, 0));
    });

    it('should silently ignore y < 0 (out-of-bounds)', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 48);
        assert.doesNotThrow(() => setCastleOverlayPixel(buf, width, 0, -1, 255, 0, 0));
    });

    it('should silently ignore both x and y out-of-bounds simultaneously', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 48);
        assert.doesNotThrow(() => setCastleOverlayPixel(buf, width, -1, 100, 255, 0, 0));
        for (let i = 0; i < buf.length; i++) {
            assert.equal(buf[i], 0, `byte ${i} should remain 0`);
        }
    });

    it('should accept x = width - 1 (last valid column)', () => {
        const width = 64;
        const buf = createCastleOverlayBuffer(width, 48);
        assert.doesNotThrow(() => setCastleOverlayPixel(buf, width, width - 1, 0, 1, 2, 3));
        const idx = (0 * width + (width - 1)) * 4;
        assert.equal(buf[idx + 3], 255, 'last column pixel should be opaque');
    });
});
