/**
 * Tests for generate-castle-overlay-sprites.js
 *
 * Covers:
 *   - CASTLE_OVERLAY_SPRITE_DEFS: completeness, shape, and correctness of each entry
 *   - OVERLAY_WIDTH constant
 *   - All 18 expected sprite names are present
 *   - structureType values are valid (accepted by generateCastleOverlay)
 *   - damaged flag is a boolean on every entry
 *   - Bridge entries have damaged=false (no damaged bridge variants)
 *   - Damaged entries exist for the 7 expected structure types
 *   - No duplicate sprite names in the definitions list
 *   - Each entry's name matches the corresponding CASTLE_OVERLAY_SPRITES registry value
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

    it('should contain exactly 18 entries', () => {
        assert.equal(CASTLE_OVERLAY_SPRITE_DEFS.length, 18,
            `Expected 18 sprite definitions, got ${CASTLE_OVERLAY_SPRITE_DEFS.length}`);
    });

    it('every entry should have a non-empty string name', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.equal(typeof def.name, 'string',
                `Entry name should be a string, got ${typeof def.name}`);
            assert.ok(def.name.length > 0, 'Entry name should not be empty');
        }
    });

    it('every entry should have a non-empty string structureType', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.equal(typeof def.structureType, 'string',
                `structureType should be a string for entry "${def.name}"`);
            assert.ok(def.structureType.length > 0,
                `structureType should not be empty for entry "${def.name}"`);
        }
    });

    it('every entry should have a boolean damaged flag', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.equal(typeof def.damaged, 'boolean',
                `damaged should be a boolean for entry "${def.name}", got ${typeof def.damaged}`);
        }
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: no duplicates ───────────────────────────────

describe('CASTLE_OVERLAY_SPRITE_DEFS: no duplicate sprite names', () => {
    it('all sprite names should be unique', () => {
        const names = CASTLE_OVERLAY_SPRITE_DEFS.map(d => d.name);
        const unique = new Set(names);
        assert.equal(unique.size, names.length,
            `Found duplicate sprite names in CASTLE_OVERLAY_SPRITE_DEFS`);
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: all 18 expected names present ───────────────

describe('CASTLE_OVERLAY_SPRITE_DEFS: all 18 expected sprite names are present', () => {
    const expectedNames = Object.values(CASTLE_OVERLAY_SPRITES);
    const definedNames = new Set(CASTLE_OVERLAY_SPRITE_DEFS.map(d => d.name));

    it(`should contain all ${expectedNames.length} names from CASTLE_OVERLAY_SPRITES`, () => {
        assert.equal(expectedNames.length, 18,
            `CASTLE_OVERLAY_SPRITES should have 18 entries, got ${expectedNames.length}`);
        for (const name of expectedNames) {
            assert.ok(definedNames.has(name),
                `Missing sprite definition for "${name}"`);
        }
    });

    it('should not contain any names absent from CASTLE_OVERLAY_SPRITES', () => {
        const registryNames = new Set(expectedNames);
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.ok(registryNames.has(def.name),
                `Sprite "${def.name}" is in CASTLE_OVERLAY_SPRITE_DEFS but not in CASTLE_OVERLAY_SPRITES`);
        }
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: valid structureType values ──────────────────

describe('CASTLE_OVERLAY_SPRITE_DEFS: structureType values are valid', () => {
    const validStructureTypes = new Set([
        'wall', 'tower',
        'keep-tl', 'keep-bl', 'keep-br', 'keep-center',
        'gatehouse',
        'bridge-mm', 'bridge-start', 'bridge-mid', 'bridge-gate',
    ]);

    it('every structureType should be one of the known valid types', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
            assert.ok(validStructureTypes.has(def.structureType),
                `Unknown structureType "${def.structureType}" for sprite "${def.name}"`);
        }
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: bridge entries have no damaged variants ─────

describe('CASTLE_OVERLAY_SPRITE_DEFS: bridge entries have damaged=false', () => {
    const bridgeTypes = ['bridge-mm', 'bridge-start', 'bridge-mid', 'bridge-gate'];

    for (const bridgeType of bridgeTypes) {
        it(`'${bridgeType}' entry should have damaged=false`, () => {
            const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === bridgeType);
            assert.ok(entry, `No entry found for structureType "${bridgeType}"`);
            assert.equal(entry.damaged, false,
                `Bridge type "${bridgeType}" should not have a damaged variant`);
        });
    }

    it('no bridge structureType should appear with damaged=true', () => {
        const damagedBridges = CASTLE_OVERLAY_SPRITE_DEFS.filter(
            d => bridgeTypes.includes(d.structureType) && d.damaged === true
        );
        assert.equal(damagedBridges.length, 0,
            `Found unexpected damaged bridge entries: ${damagedBridges.map(d => d.name).join(', ')}`);
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: damaged variants exist for the 7 expected types

describe('CASTLE_OVERLAY_SPRITE_DEFS: damaged variants exist for the 7 expected structure types', () => {
    const damagedStructureTypes = ['wall', 'tower', 'keep-tl', 'keep-bl', 'keep-br', 'keep-center', 'gatehouse'];

    for (const structureType of damagedStructureTypes) {
        it(`'${structureType}' should have exactly one damaged=true entry`, () => {
            const damagedEntries = CASTLE_OVERLAY_SPRITE_DEFS.filter(
                d => d.structureType === structureType && d.damaged === true
            );
            assert.equal(damagedEntries.length, 1,
                `Expected exactly 1 damaged entry for "${structureType}", found ${damagedEntries.length}`);
        });

        it(`'${structureType}' should have exactly one damaged=false entry`, () => {
            const undamagedEntries = CASTLE_OVERLAY_SPRITE_DEFS.filter(
                d => d.structureType === structureType && d.damaged === false
            );
            assert.equal(undamagedEntries.length, 1,
                `Expected exactly 1 undamaged entry for "${structureType}", found ${undamagedEntries.length}`);
        });
    }
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: name matches CASTLE_OVERLAY_SPRITES registry ─

describe('CASTLE_OVERLAY_SPRITE_DEFS: each entry name matches CASTLE_OVERLAY_SPRITES registry', () => {
    it('wall undamaged name should match CASTLE_OVERLAY_SPRITES.wall', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'wall' && !d.damaged);
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.wall);
    });

    it('wall damaged name should match CASTLE_OVERLAY_SPRITES.wallDamaged', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'wall' && d.damaged);
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.wallDamaged);
    });

    it('tower undamaged name should match CASTLE_OVERLAY_SPRITES.tower', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'tower' && !d.damaged);
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.tower);
    });

    it('tower damaged name should match CASTLE_OVERLAY_SPRITES.towerDamaged', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'tower' && d.damaged);
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.towerDamaged);
    });

    it('gatehouse undamaged name should match CASTLE_OVERLAY_SPRITES.gatehouse', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'gatehouse' && !d.damaged);
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.gatehouse);
    });

    it('gatehouse damaged name should match CASTLE_OVERLAY_SPRITES.gatehouseDamaged', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'gatehouse' && d.damaged);
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.gatehouseDamaged);
    });

    it('bridge-mm name should match CASTLE_OVERLAY_SPRITES.bridgeMm', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'bridge-mm');
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.bridgeMm);
    });

    it('bridge-start name should match CASTLE_OVERLAY_SPRITES.bridgeStart', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'bridge-start');
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.bridgeStart);
    });

    it('bridge-mid name should match CASTLE_OVERLAY_SPRITES.bridgeMid', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'bridge-mid');
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.bridgeMid);
    });

    it('bridge-gate name should match CASTLE_OVERLAY_SPRITES.bridgeGate', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'bridge-gate');
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.bridgeGate);
    });

    it('keep-tl undamaged name should match CASTLE_OVERLAY_SPRITES.keepTopLeft', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'keep-tl' && !d.damaged);
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.keepTopLeft);
    });

    it('keep-tl damaged name should match CASTLE_OVERLAY_SPRITES.keepTopLeftDamaged', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'keep-tl' && d.damaged);
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.keepTopLeftDamaged);
    });

    it('keep-center undamaged name should match CASTLE_OVERLAY_SPRITES.keepCenter', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'keep-center' && !d.damaged);
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.keepCenter);
    });

    it('keep-center damaged name should match CASTLE_OVERLAY_SPRITES.keepCenterDamaged', () => {
        const entry = CASTLE_OVERLAY_SPRITE_DEFS.find(d => d.structureType === 'keep-center' && d.damaged);
        assert.ok(entry);
        assert.equal(entry.name, CASTLE_OVERLAY_SPRITES.keepCenterDamaged);
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

    it('damaged sprite names should contain "-damaged-overlay"', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.damaged)) {
            assert.ok(def.name.includes('-damaged-overlay'),
                `Damaged sprite name "${def.name}" should contain "-damaged-overlay"`);
        }
    });

    it('undamaged sprite names should not contain "-damaged"', () => {
        for (const def of CASTLE_OVERLAY_SPRITE_DEFS.filter(d => !d.damaged)) {
            assert.ok(!def.name.includes('-damaged'),
                `Undamaged sprite name "${def.name}" should not contain "-damaged"`);
        }
    });
});

// ─── CASTLE_OVERLAY_SPRITE_DEFS: structure category counts ───────────────────

describe('CASTLE_OVERLAY_SPRITE_DEFS: structure category entry counts', () => {
    it('should have 2 wall entries (1 undamaged + 1 damaged)', () => {
        const wallEntries = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.structureType === 'wall');
        assert.equal(wallEntries.length, 2);
    });

    it('should have 2 tower entries (1 undamaged + 1 damaged)', () => {
        const towerEntries = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.structureType === 'tower');
        assert.equal(towerEntries.length, 2);
    });

    it('should have 2 gatehouse entries (1 undamaged + 1 damaged)', () => {
        const gatehouseEntries = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.structureType === 'gatehouse');
        assert.equal(gatehouseEntries.length, 2);
    });

    it('should have 1 bridge-mm entry (no damaged variant)', () => {
        const entries = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.structureType === 'bridge-mm');
        assert.equal(entries.length, 1);
    });

    it('should have 1 bridge-start entry (no damaged variant)', () => {
        const entries = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.structureType === 'bridge-start');
        assert.equal(entries.length, 1);
    });

    it('should have 1 bridge-mid entry (no damaged variant)', () => {
        const entries = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.structureType === 'bridge-mid');
        assert.equal(entries.length, 1);
    });

    it('should have 1 bridge-gate entry (no damaged variant)', () => {
        const entries = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.structureType === 'bridge-gate');
        assert.equal(entries.length, 1);
    });

    it('should have 4 bridge entries total (bridge-mm, bridge-start, bridge-mid, bridge-gate)', () => {
        const bridgeEntries = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.structureType.startsWith('bridge-'));
        assert.equal(bridgeEntries.length, 4);
    });

    it('should have 8 keep entries total (4 quadrants × 2 variants each)', () => {
        const keepEntries = CASTLE_OVERLAY_SPRITE_DEFS.filter(d => d.structureType.startsWith('keep-'));
        assert.equal(keepEntries.length, 8);
    });
});
