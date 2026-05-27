/**
 * Tests for generateCastleOverlay in generate-iso-sprites-br-tl.js:
 *   - Buffer byte length matches canvas dimensions for each structure category
 *   - Undamaged and damaged variants of the same structure type are not identical
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

// ─── Canvas dimension constants ───────────────────────────────────────────────

const WALL_BRIDGE_BYTES  = 64 * 48 * 4;  // 12288
const TOWER_KEEP_BYTES   = 64 * 64 * 4;  // 16384
const GATEHOUSE_BYTES    = 64 * 80 * 4;  // 20480

// ─── Tests: buffer byte length per structure category ────────────────────────

describe('generateCastleOverlay: buffer byte length — wall/bridge types (64×48×4 = 12288)', () => {
    const wallBridgeTypes = ['wall', 'bridge-mm', 'bridge-start', 'bridge-mid', 'bridge-gate'];

    for (const structureType of wallBridgeTypes) {
        it(`'${structureType}' undamaged should return a buffer of ${WALL_BRIDGE_BYTES} bytes`, () => {
            const buf = generateCastleOverlay(structureType, false);
            assert.equal(buf.length, WALL_BRIDGE_BYTES,
                `Expected ${WALL_BRIDGE_BYTES} bytes (64×48×4) for '${structureType}', got ${buf.length}`);
        });
    }

    it("'wall' damaged should return a buffer of 12288 bytes", () => {
        const buf = generateCastleOverlay('wall', true);
        assert.equal(buf.length, WALL_BRIDGE_BYTES);
    });
});

describe('generateCastleOverlay: buffer byte length — tower/keep types (64×64×4 = 16384)', () => {
    const towerKeepTypes = ['tower', 'keep-tl', 'keep-bl', 'keep-br', 'keep-center'];

    for (const structureType of towerKeepTypes) {
        it(`'${structureType}' undamaged should return a buffer of ${TOWER_KEEP_BYTES} bytes`, () => {
            const buf = generateCastleOverlay(structureType, false);
            assert.equal(buf.length, TOWER_KEEP_BYTES,
                `Expected ${TOWER_KEEP_BYTES} bytes (64×64×4) for '${structureType}', got ${buf.length}`);
        });
    }

    for (const structureType of ['tower', 'keep-tl', 'keep-bl', 'keep-br', 'keep-center']) {
        it(`'${structureType}' damaged should return a buffer of ${TOWER_KEEP_BYTES} bytes`, () => {
            const buf = generateCastleOverlay(structureType, true);
            assert.equal(buf.length, TOWER_KEEP_BYTES,
                `Expected ${TOWER_KEEP_BYTES} bytes (64×64×4) for damaged '${structureType}', got ${buf.length}`);
        });
    }
});

describe('generateCastleOverlay: buffer byte length — gatehouse (64×80×4 = 20480)', () => {
    it("'gatehouse' undamaged should return a buffer of 20480 bytes", () => {
        const buf = generateCastleOverlay('gatehouse', false);
        assert.equal(buf.length, GATEHOUSE_BYTES,
            `Expected ${GATEHOUSE_BYTES} bytes (64×80×4) for 'gatehouse', got ${buf.length}`);
    });

    it("'gatehouse' damaged should return a buffer of 20480 bytes", () => {
        const buf = generateCastleOverlay('gatehouse', true);
        assert.equal(buf.length, GATEHOUSE_BYTES,
            `Expected ${GATEHOUSE_BYTES} bytes (64×80×4) for damaged 'gatehouse', got ${buf.length}`);
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
