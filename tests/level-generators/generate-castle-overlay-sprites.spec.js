/**
 * Tests for generate-castle-overlay-sprites.js
 *
 * Covers:
 *   - CASTLE_OVERLAY_SPRITE_DEFS: completeness, shape, and entry count
 *   - OVERLAY_WIDTH constant
 *   - Each entry has: name (string), gen (function), w (number), h (number)
 *   - All names match CASTLE_OVERLAY_SPRITES registry values
 *   - No duplicate sprite names
 *   - All sprite names end with '-overlay'
 *   - Canvas dimension assignments by structure category
 *   - Keep-full entries use w=192 (wide canvas)
 *   - Bridge entries use h=64 (shortest height)
 *   - Wall/isoWall entries use h=96
 *   - Tower/keep-quadrant entries use h=128
 *   - Gatehouse entries use h=160
 *   - gen() is callable and returns a Buffer
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-castle-overlay-sprites.spec.js
 *
 * Requirements: 1.9, 9.1
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    CASTLE_OVERLAY_SPRITE_DEFS,
    OVERLAY_WIDTH,
} = require('../../js/level-generators/generate-castle-overlay-sprites');

const { CASTLE_OVERLAY_SPRITES } = require('../../js/level-generators/lib/sprite-constants');

// ─── OVERLAY_WIDTH constant ───────────────────────────────────────────────────

describe('OVERLAY_WIDTH', () => {
    it('should be 64', () => {
        assert.equal(OVERLAY_WIDTH, 64);
    });

    it('should be a number', () => {
        assert.equal(typeof OVERLAY_WIDTH, 'number');
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: basic shape ─────────────────────────────────

describe('CASTLE_OVERLAY_SPRITE_DEFS: basic shape', () => {
    it('should be an array', () => {
        assert.ok(Array.isArray(CASTLE_OVERLAY_SPRITE_DEFS));
    });

    it('should contain exactly 23 entries', () => {
        assert.equal(CASTLE_OVERLAY_SPRITE_DEFS.length, 23,
            `Expected 23 sprite definitions, got ${CASTLE_OVERLAY_SPRITE_DEFS.length}`);
    });

    it('every entry should have a non-empty string name', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.equal(typeof def.name, 'string',
                `Entry name should be a string, got ${typeof def.name}`);
            assert.ok(def.name.length > 0, 'Entry name should not be empty');
        }
    });

    it('every entry should have a gen function', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.equal(typeof def.gen, 'function',
                `Entry "${def.name}" should have a gen function, got ${typeof def.gen}`);
        }
    });

    it('every entry should have a numeric w (width)', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.equal(typeof def.w, 'number',
                `Entry "${def.name}" should have a numeric w, got ${typeof def.w}`);
            assert.ok(def.w > 0, `Entry "${def.name}" w should be positive`);
        }
    });

    it('every entry should have a numeric h (height)', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.equal(typeof def.h, 'number',
                `Entry "${def.name}" should have a numeric h, got ${typeof def.h}`);
            assert.ok(def.h > 0, `Entry "${def.name}" h should be positive`);
        }
    });

    it('entries should NOT have a structureType field (old API removed)', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.equal(def.structureType, undefined,
                `Entry "${def.name}" should not have structureType (new gen-based API)`);
        }
    });

    it('entries should NOT have a damaged field (old API removed)', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.equal(def.damaged, undefined,
                `Entry "${def.name}" should not have damaged field (new gen-based API)`);
        }
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: no duplicates ───────────────────────────────

describe('CASTLE_OVERLAY_SPRITE_DEFS: no duplicate sprite names', () => {
    it('all sprite names should be unique', () => {
        const names = CASTLE_OVERLAY_SPRITE_DEFS.map(d => d.name);
        const unique = new Set(names);
        assert.equal(unique.size, names.length,
            'Found duplicate sprite names in CASTLE_OVERLAY_SPRITE_DEFS');
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: all expected names present ──────────────────

describe('CASTLE_OVERLAY_SPRITE_DEFS: all names from CASTLE_OVERLAY_SPRITES registry are present', () => {
    const registryNames = Object.values(CASTLE_OVERLAY_SPRITES);
    const definedNames = new Set(CASTLE_OVERLAY_SPRITE_DEFS.map(d => d.name));

    it(`registry should have 23 entries`, () => {
        assert.equal(registryNames.length, 23,
            `CASTLE_OVERLAY_SPRITES should have 23 entries, got ${registryNames.length}`);
    });

    it('every registry name should have a corresponding definition', () => {
        for (const name of registryNames) {
            assert.ok(definedNames.has(name),
                `Missing sprite definition for registry entry "${name}"`);
        }
    });

    it('no definition name should be absent from the registry', () => {
        const registrySet = new Set(registryNames);
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.ok(registrySet.has(def.name),
                `Sprite "${def.name}" is in CASTLE_OVERLAY_SPRITE_DEFS but not in CASTLE_OVERLAY_SPRITES`);
        }
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: sprite name format ──────────────────────────

describe('CASTLE_OVERLAY_SPRITE_DEFS: sprite name format', () => {
    it('all sprite names should end with "-overlay"', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.ok(def.name.endsWith('-overlay'),
                `Sprite name "${def.name}" should end with "-overlay"`);
        }
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: canvas dimensions by category ───────────────

describe('CASTLE_OVERLAY_SPRITE_DEFS: canvas dimensions', () => {
    // Helper: find entry by registry key
    const byKey = (key) => {
        const name = CASTLE_OVERLAY_SPRITES[key];
        return CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.name === name);
    };

    it('isoWall entries should be w=64, h=96', () => {
        const e = byKey('isoWall');
        assert.ok(e, 'isoWall entry should exist');
        assert.equal(e.w, 64);
        assert.equal(e.h, 96);
    });

    it('isoWallDamaged entries should be w=64, h=96', () => {
        const e = byKey('isoWallDamaged');
        assert.ok(e, 'isoWallDamaged entry should exist');
        assert.equal(e.w, 64);
        assert.equal(e.h, 96);
    });

    it('wall entries should be w=64, h=96', () => {
        const e = byKey('wall');
        assert.ok(e, 'wall entry should exist');
        assert.equal(e.w, 64);
        assert.equal(e.h, 96);
    });

    it('wallDamaged entries should be w=64, h=96', () => {
        const e = byKey('wallDamaged');
        assert.ok(e, 'wallDamaged entry should exist');
        assert.equal(e.w, 64);
        assert.equal(e.h, 96);
    });

    it('tower entries should be w=64, h=128', () => {
        const e = byKey('tower');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 128);
    });

    it('towerDamaged entries should be w=64, h=128', () => {
        const e = byKey('towerDamaged');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 128);
    });

    it('keepTopLeft entries should be w=64, h=128', () => {
        const e = byKey('keepTopLeft');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 128);
    });

    it('keepTopLeftDamaged entries should be w=64, h=128', () => {
        const e = byKey('keepTopLeftDamaged');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 128);
    });

    it('keepBotLeft entries should be w=64, h=128', () => {
        const e = byKey('keepBotLeft');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 128);
    });

    it('keepBotRight entries should be w=64, h=128', () => {
        const e = byKey('keepBotRight');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 128);
    });

    it('keepCenter entries should be w=64, h=128', () => {
        const e = byKey('keepCenter');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 128);
    });

    it('keepCenterDamaged entries should be w=64, h=128', () => {
        const e = byKey('keepCenterDamaged');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 128);
    });

    it('gatehouse entries should be w=64, h=160', () => {
        const e = byKey('gatehouse');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 160);
    });

    it('gatehouseDamaged entries should be w=64, h=160', () => {
        const e = byKey('gatehouseDamaged');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 160);
    });

    it('keep (large) entries should be w=192, h=128', () => {
        const e = byKey('keep');
        assert.ok(e, 'keep entry should exist');
        assert.equal(e.w, 192);
        assert.equal(e.h, 128);
    });

    it('keepDamaged (large) entries should be w=192, h=128', () => {
        const e = byKey('keepDamaged');
        assert.ok(e);
        assert.equal(e.w, 192);
        assert.equal(e.h, 128);
    });

    it('keepDestroyed (large) entries should be w=192, h=128', () => {
        const e = byKey('keepDestroyed');
        assert.ok(e);
        assert.equal(e.w, 192);
        assert.equal(e.h, 128);
    });

    it('bridgeMm entries should be w=64, h=64', () => {
        const e = byKey('bridgeMm');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 64);
    });

    it('bridgeStart entries should be w=64, h=64', () => {
        const e = byKey('bridgeStart');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 64);
    });

    it('bridgeMid entries should be w=64, h=64', () => {
        const e = byKey('bridgeMid');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 64);
    });

    it('bridgeGate entries should be w=64, h=64', () => {
        const e = byKey('bridgeGate');
        assert.ok(e);
        assert.equal(e.w, 64);
        assert.equal(e.h, 64);
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: dimension category counts ───────────────────

describe('CASTLE_OVERLAY_SPRITE_DEFS: dimension category counts', () => {
    it('should have 4 entries with h=96 (isoWall, isoWallDamaged, wall, wallDamaged)', () => {
        const h96 = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.h === 96);
        assert.equal(h96.length, 4);
    });

    it('should have 10 entries with h=128 and w=64 (tower×2 + keep quadrants×8)', () => {
        const h128w64 = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.h === 128 && d.w === 64);
        assert.equal(h128w64.length, 10);
    });

    it('should have 3 entries with h=128 and w=192 (keep, keepDamaged, keepDestroyed)', () => {
        const h128w192 = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.h === 128 && d.w === 192);
        assert.equal(h128w192.length, 3);
    });

    it('should have 2 entries with h=160 (gatehouse, gatehouseDamaged)', () => {
        const h160 = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.h === 160);
        assert.equal(h160.length, 2);
    });

    it('should have 4 entries with h=64 (bridge entries)', () => {
        const h64 = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.h === 64);
        assert.equal(h64.length, 4);
    });

    it('should have exactly 3 entries with w=192 (large keep sprites)', () => {
        const wide = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.w === 192);
        assert.equal(wide.length, 3);
    });

    it('should have 20 entries with w=64 (all single-tile sprites)', () => {
        const standard = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.w === 64);
        assert.equal(standard.length, 20);
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: gen() returns a Buffer ──────────────────────

describe('CASTLE_OVERLAY_SPRITE_DEFS: gen() returns correct buffer', () => {
    it('gen() for each entry should return a Buffer', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            const buf = def.gen();
            assert.ok(Buffer.isBuffer(buf),
                `gen() for "${def.name}" should return a Buffer`);
        }
    });

    it('gen() for each entry should return a buffer with length w * h * 4', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            const buf = def.gen();
            const expected = def.w * def.h * 4;
            assert.equal(buf.length, expected,
                `Buffer for "${def.name}" should be ${expected} bytes (${def.w}×${def.h}×4), got ${buf.length}`);
        }
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: specific registry key–name pairs ────────────

describe('CASTLE_OVERLAY_SPRITE_DEFS: name values match CASTLE_OVERLAY_SPRITES', () => {
    const byKey = (key) => {
        const name = CASTLE_OVERLAY_SPRITES[key];
        return CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.name === name);
    };

    const checks = [
        ['isoWall',            'castle-iso-wall-overlay'],
        ['isoWallDamaged',     'castle-iso-wall-damaged-overlay'],
        ['wall',               'castle-wall-overlay'],
        ['wallDamaged',        'castle-wall-damaged-overlay'],
        ['tower',              'castle-tower-overlay'],
        ['towerDamaged',       'castle-tower-damaged-overlay'],
        ['gatehouse',          'castle-gatehouse-overlay'],
        ['gatehouseDamaged',   'castle-gatehouse-damaged-overlay'],
        ['bridgeMm',           'bridge-mm-overlay'],
        ['bridgeStart',        'castle-bridge-start-overlay'],
        ['bridgeMid',          'castle-bridge-mid-overlay'],
        ['bridgeGate',         'castle-bridge-gate-overlay'],
    ];

    for (const [key, expectedName] of checks) {
        it(`CASTLE_OVERLAY_SPRITES.${key} should be "${expectedName}"`, () => {
            assert.equal(CASTLE_OVERLAY_SPRITES[key], expectedName,
                `Registry entry "${key}" has unexpected value`);
            const entry = byKey(key);
            assert.ok(entry, `No CASTLE_OVERLAY_SPRITE_DEFS entry found for key "${key}"`);
            assert.equal(entry.name, expectedName);
        });
    }
});
