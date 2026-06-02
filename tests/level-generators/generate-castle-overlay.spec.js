/**
 * Tests for generateCastleOverlay in generate-iso-sprites-br-tl.js:
 *   - Buffer byte length matches canvas dimensions for each structure category
 *   - Undamaged and damaged variants of the same structure type are not identical
 *
 * Canvas heights (updated for epic castle scale):
 *   wall:       96 px (64 px above 32 px ground = 2 full tile heights)
 *   bridge:     48 px (16 px above ground — low parapets)
 *   tower/keep: 128 px (96 px above ground = 3 tile heights)
 *   gatehouse:  144 px (112 px above ground — tallest structure)
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-castle-overlay.spec.js
 *
 * Requirements: 1.3, 1.4, 1.5, 1.6, 1.7
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { generateCastleOverlay } = require('../../js/level-generators/generate-iso-sprites-br-tl');

// ─── Canvas dimension constants (reflect CASTLE_OVERLAY_CANVAS_HEIGHTS) ───────

const WALL_BYTES         = 64 * 96  * 4;  // 24576 — 2 tile heights of wall
const BRIDGE_BYTES       = 64 * 48  * 4;  // 12288 — low bridge parapets (unchanged)
const TOWER_KEEP_BYTES   = 64 * 128 * 4;  // 32768 — 3+ tile heights
const GATEHOUSE_BYTES    = 64 * 144 * 4;  // 36864 — tallest structure

// ─── Tests: buffer byte length per structure category ────────────────────────

describe('generateCastleOverlay: buffer byte length — wall (64×96×4 = 24576)', () => {
    it("'wall' undamaged should return a buffer of 24576 bytes", () => {
        const buf = generateCastleOverlay('wall', false);
        assert.equal(buf.length, WALL_BYTES,
            `Expected ${WALL_BYTES} bytes (64×96×4) for 'wall', got ${buf.length}`);
    });

    it("'wall' damaged should return a buffer of 24576 bytes", () => {
        const buf = generateCastleOverlay('wall', true);
        assert.equal(buf.length, WALL_BYTES,
            `Expected ${WALL_BYTES} bytes (64×96×4) for damaged 'wall', got ${buf.length}`);
    });
});

describe('generateCastleOverlay: buffer byte length — bridge types (64×48×4 = 12288)', () => {
    const bridgeTypes = ['bridge-mm', 'bridge-start', 'bridge-mid', 'bridge-gate'];

    for (const structureType of bridgeTypes) {
        it(`'${structureType}' should return a buffer of ${BRIDGE_BYTES} bytes`, () => {
            const buf = generateCastleOverlay(structureType, false);
            assert.equal(buf.length, BRIDGE_BYTES,
                `Expected ${BRIDGE_BYTES} bytes (64×48×4) for '${structureType}', got ${buf.length}`);
        });
    }
});

describe('generateCastleOverlay: buffer byte length — tower/keep types (64×128×4 = 32768)', () => {
    const towerKeepTypes = ['tower', 'keep-tl', 'keep-bl', 'keep-br', 'keep-center'];

    for (const structureType of towerKeepTypes) {
        it(`'${structureType}' undamaged should return a buffer of ${TOWER_KEEP_BYTES} bytes`, () => {
            const buf = generateCastleOverlay(structureType, false);
            assert.equal(buf.length, TOWER_KEEP_BYTES,
                `Expected ${TOWER_KEEP_BYTES} bytes (64×128×4) for '${structureType}', got ${buf.length}`);
        });
    }

    for (const structureType of ['tower', 'keep-tl', 'keep-bl', 'keep-br', 'keep-center']) {
        it(`'${structureType}' damaged should return a buffer of ${TOWER_KEEP_BYTES} bytes`, () => {
            const buf = generateCastleOverlay(structureType, true);
            assert.equal(buf.length, TOWER_KEEP_BYTES,
                `Expected ${TOWER_KEEP_BYTES} bytes (64×128×4) for damaged '${structureType}', got ${buf.length}`);
        });
    }
});

describe('generateCastleOverlay: buffer byte length — gatehouse (64×144×4 = 36864)', () => {
    it("'gatehouse' undamaged should return a buffer of 36864 bytes", () => {
        const buf = generateCastleOverlay('gatehouse', false);
        assert.equal(buf.length, GATEHOUSE_BYTES,
            `Expected ${GATEHOUSE_BYTES} bytes (64×144×4) for 'gatehouse', got ${buf.length}`);
    });

    it("'gatehouse' damaged should return a buffer of 36864 bytes", () => {
        const buf = generateCastleOverlay('gatehouse', true);
        assert.equal(buf.length, GATEHOUSE_BYTES,
            `Expected ${GATEHOUSE_BYTES} bytes (64×144×4) for damaged 'gatehouse', got ${buf.length}`);
    });
});

// ─── Tests: undamaged vs damaged variant distinctness ────────────────────────

describe('generateCastleOverlay: undamaged and damaged variants are not byte-for-byte identical', () => {
    const damagedTypes = ['wall', 'tower', 'keep-tl', 'keep-bl', 'keep-br', 'keep-center', 'gatehouse'];

    for (const structureType of damagedTypes) {
        it(`'${structureType}' undamaged and damaged should not be byte-for-byte identical`, () => {
            const undamaged = generateCastleOverlay(structureType, false);
            const damaged   = generateCastleOverlay(structureType, true);
            assert.ok(
                !undamaged.equals(damaged),
                `'${structureType}' undamaged and damaged variants should differ visually`
            );
        });
    }
});
