/**
 * Tests for the Phase 4 retry loop in applyDamage() and related helpers.
 *
 * The Phase 4 loop runs when Phases 1-3 produce fewer than MIN_DAMAGE_PERCENT
 * (15%) of damaged pixels. It retries up to 10 extra passes.
 *
 * Strategy for forcing Phase 4:
 *   Pass a very large `totalOpaquePixels` value so that
 *   targetDamagePixels = ceil(totalOpaquePixels * 0.15) far exceeds what
 *   Phases 1-3 can achieve (~200-400 pixels on a normal buffer), forcing
 *   Phase 4 to iterate.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-damaged-castle-phase4.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    applyDamage,
    countOpaquePixels,
    applyCracks,
    applyMissingBlocks,
    applyRubbleDebris,
    MIN_DAMAGE_PERCENT,
} = require('../../js/level-generators/generate-damaged-castle-sprites');

const { TILE_WIDTH, TILE_HEIGHT } = require('../../js/level-generators/lib/sprite-constants');
const { createBuffer, isInsideDiamond } = require('../../js/level-generators/lib/pixel-utils');
const { fillDiamond } = require('../../js/level-generators/lib/fill-patterns');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Creates a fully opaque diamond buffer (all pixels inside diamond are opaque). */
function createFilledBuffer(seed) {
    const buf = createBuffer();
    fillDiamond(buf, [150, 150, 150], 0, seed || 12345);
    return buf;
}

/** Counts pixels that differ between two same-length buffers (by RGBA pixel). */
function countChangedPixels(original, modified) {
    let changed = 0;
    for (let i = 0; i < original.length; i += 4) {
        if (original[i] !== modified[i] ||
            original[i + 1] !== modified[i + 1] ||
            original[i + 2] !== modified[i + 2] ||
            original[i + 3] !== modified[i + 3]) {
            changed++;
        }
    }
    return changed;
}

// ─── countOpaquePixels ────────────────────────────────────────────────────────

describe('generate-damaged-castle-phase4: countOpaquePixels', () => {
    it('returns 0 for an all-transparent buffer', () => {
        const buf = createBuffer(); // all zeros
        assert.equal(countOpaquePixels(buf), 0);
    });

    it('returns the correct count for a buffer with known opaque pixels', () => {
        const buf = createBuffer();
        // Manually set 5 pixels inside the diamond to opaque
        let set = 0;
        for (let y = 0; y < TILE_HEIGHT && set < 5; y++) {
            for (let x = 0; x < TILE_WIDTH && set < 5; x++) {
                if (isInsideDiamond(x, y)) {
                    const idx = (y * TILE_WIDTH + x) * 4;
                    buf[idx] = 100;
                    buf[idx + 1] = 100;
                    buf[idx + 2] = 100;
                    buf[idx + 3] = 255;
                    set++;
                }
            }
        }
        assert.equal(countOpaquePixels(buf), 5);
    });

    it('counts only pixels inside the diamond (ignores outside pixels)', () => {
        const buf = createBuffer();
        // Set every pixel in the buffer to opaque, including outside the diamond
        buf.fill(255);
        const insideDiamondCount = countOpaquePixels(buf);

        // Count manually for comparison
        let manual = 0;
        for (let y = 0; y < TILE_HEIGHT; y++) {
            for (let x = 0; x < TILE_WIDTH; x++) {
                if (isInsideDiamond(x, y)) manual++;
            }
        }
        assert.equal(insideDiamondCount, manual);
    });

    it('returns a positive count for a filled diamond buffer', () => {
        const buf = createFilledBuffer();
        const count = countOpaquePixels(buf);
        assert.ok(count > 0, `Expected positive opaque pixel count, got ${count}`);
        // A 64×32 diamond has roughly 1024 pixels inside
        assert.ok(count > 500, `Expected at least 500 opaque pixels in a filled diamond, got ${count}`);
    });
});

// ─── applyDamage: threshold guarantee ────────────────────────────────────────

describe('generate-damaged-castle-phase4: applyDamage threshold guarantee', () => {
    it('always modifies at least MIN_DAMAGE_PERCENT of opaque pixels (seed 12345)', () => {
        const buf = createFilledBuffer(12345);
        const original = Buffer.from(buf);
        const opaqueCount = countOpaquePixels(buf);

        applyDamage(buf, 12345, opaqueCount);

        const changed = countChangedPixels(original, buf);
        const ratio = changed / opaqueCount;
        assert.ok(ratio >= MIN_DAMAGE_PERCENT,
            `Expected >= ${MIN_DAMAGE_PERCENT * 100}% damage, got ${(ratio * 100).toFixed(2)}%`);
    });

    it('always modifies at least MIN_DAMAGE_PERCENT of opaque pixels (seed 99999)', () => {
        const buf = createFilledBuffer(99999);
        const original = Buffer.from(buf);
        const opaqueCount = countOpaquePixels(buf);

        applyDamage(buf, 99999, opaqueCount);

        const changed = countChangedPixels(original, buf);
        const ratio = changed / opaqueCount;
        assert.ok(ratio >= MIN_DAMAGE_PERCENT,
            `Expected >= ${MIN_DAMAGE_PERCENT * 100}% damage, got ${(ratio * 100).toFixed(2)}%`);
    });

    it('always modifies at least MIN_DAMAGE_PERCENT of opaque pixels (seed 1)', () => {
        const buf = createFilledBuffer(1);
        const original = Buffer.from(buf);
        const opaqueCount = countOpaquePixels(buf);

        applyDamage(buf, 1, opaqueCount);

        const changed = countChangedPixels(original, buf);
        const ratio = changed / opaqueCount;
        assert.ok(ratio >= MIN_DAMAGE_PERCENT,
            `Expected >= ${MIN_DAMAGE_PERCENT * 100}% damage, got ${(ratio * 100).toFixed(2)}%`);
    });

    it('always modifies at least MIN_DAMAGE_PERCENT of opaque pixels (seed 50000)', () => {
        const buf = createFilledBuffer(50000);
        const original = Buffer.from(buf);
        const opaqueCount = countOpaquePixels(buf);

        applyDamage(buf, 50000, opaqueCount);

        const changed = countChangedPixels(original, buf);
        const ratio = changed / opaqueCount;
        assert.ok(ratio >= MIN_DAMAGE_PERCENT,
            `Expected >= ${MIN_DAMAGE_PERCENT * 100}% damage, got ${(ratio * 100).toFixed(2)}%`);
    });

    it('always modifies at least MIN_DAMAGE_PERCENT of opaque pixels (seed 77777)', () => {
        const buf = createFilledBuffer(77777);
        const original = Buffer.from(buf);
        const opaqueCount = countOpaquePixels(buf);

        applyDamage(buf, 77777, opaqueCount);

        const changed = countChangedPixels(original, buf);
        const ratio = changed / opaqueCount;
        assert.ok(ratio >= MIN_DAMAGE_PERCENT,
            `Expected >= ${MIN_DAMAGE_PERCENT * 100}% damage, got ${(ratio * 100).toFixed(2)}%`);
    });
});

// ─── Phase 4 forced: large totalOpaquePixels ─────────────────────────────────

describe('generate-damaged-castle-phase4: Phase 4 retry loop', () => {
    it('terminates when totalOpaquePixels is very large (forces Phase 4)', () => {
        // Phases 1-3 modify roughly 200-400 pixels on a normal buffer.
        // Setting totalOpaquePixels = 10000 means targetDamagePixels = 1500,
        // which forces Phase 4 to iterate multiple times.
        const buf = createFilledBuffer(12345);

        // Should complete without hanging or throwing
        assert.doesNotThrow(() => {
            applyDamage(buf, 12345, 10000);
        }, 'applyDamage should terminate even when Phase 4 is forced');
    });

    it('terminates in reasonable time with totalOpaquePixels = 50000', () => {
        // targetDamagePixels = 7500 — well beyond what 10 extra passes can achieve,
        // so the loop exits at extraPass === 10 (the cap).
        const buf = createFilledBuffer(55555);
        const start = Date.now();

        assert.doesNotThrow(() => {
            applyDamage(buf, 55555, 50000);
        });

        const elapsed = Date.now() - start;
        // Should complete in well under 5 seconds even with 10 extra passes
        assert.ok(elapsed < 5000, `applyDamage took too long: ${elapsed}ms`);
    });

    it('Phase 4 loop cap (extraPass < 10) prevents infinite loop', () => {
        // With an impossibly large target, the loop must exit after 10 passes.
        // We verify this by checking the function returns (doesn't hang).
        const buf = createFilledBuffer(11111);

        const start = Date.now();
        applyDamage(buf, 11111, 1_000_000); // target = 150,000 — unreachable
        const elapsed = Date.now() - start;

        assert.ok(elapsed < 10000, `Phase 4 loop should cap at 10 passes, took ${elapsed}ms`);
    });

    it('buffer is modified even when Phase 4 is triggered', () => {
        const buf = createFilledBuffer(22222);
        const original = Buffer.from(buf);

        applyDamage(buf, 22222, 10000);

        // Buffer must have changed
        assert.ok(!buf.equals(original), 'Buffer should be modified after applyDamage with Phase 4');
    });

    it('applyDamage with large totalOpaquePixels still produces valid alpha values', () => {
        const buf = createFilledBuffer(33333);
        applyDamage(buf, 33333, 10000);

        // All alpha values must remain 0 or 255 (binary alpha)
        for (let i = 3; i < buf.length; i += 4) {
            const alpha = buf[i];
            assert.ok(alpha === 0 || alpha === 255,
                `Pixel at byte ${i - 3} has alpha ${alpha}, expected 0 or 255`);
        }
    });
});

// ─── Individual damage functions ──────────────────────────────────────────────

describe('generate-damaged-castle-phase4: individual damage function behavior', () => {
    it('applyCracks returns 0 on an empty buffer (no opaque pixels to crack)', () => {
        const buf = createBuffer();
        const modified = applyCracks(buf, 12345, 6);
        assert.equal(modified, 0);
    });

    it('applyMissingBlocks returns 0 on an empty buffer', () => {
        const buf = createBuffer();
        const modified = applyMissingBlocks(buf, 12345, 4);
        assert.equal(modified, 0);
    });

    it('applyRubbleDebris returns 0 on an empty buffer', () => {
        const buf = createBuffer();
        const modified = applyRubbleDebris(buf, 12345, 5);
        assert.equal(modified, 0);
    });

    it('applyCracks modifies pixels on a filled buffer', () => {
        const buf = createFilledBuffer();
        const modified = applyCracks(buf, 12345, 6);
        assert.ok(modified > 0, `applyCracks should modify pixels, got ${modified}`);
    });

    it('applyMissingBlocks modifies pixels on a filled buffer', () => {
        const buf = createFilledBuffer();
        const modified = applyMissingBlocks(buf, 12345, 4);
        assert.ok(modified > 0, `applyMissingBlocks should modify pixels, got ${modified}`);
    });

    it('applyRubbleDebris modifies pixels on a filled buffer', () => {
        const buf = createFilledBuffer();
        const modified = applyRubbleDebris(buf, 12345, 5);
        assert.ok(modified > 0, `applyRubbleDebris should modify pixels, got ${modified}`);
    });

    it('cumulative damage from Phases 1-3 is positive', () => {
        const buf = createFilledBuffer(12345);
        let total = 0;
        total += applyCracks(buf, 12345 + 1000, 6);
        total += applyMissingBlocks(buf, 12345 + 2000, 4);
        total += applyRubbleDebris(buf, 12345 + 3000, 5);
        assert.ok(total > 0, `Phases 1-3 combined should modify pixels, got ${total}`);
    });
});
