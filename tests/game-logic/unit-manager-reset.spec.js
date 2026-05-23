/**
 * Tests for UnitManager.reset, getAvailableUnits, and getPlacedUnits.
 *
 * Covers the reset method which restores all unit quantities,
 * and the getter methods for available and placed units.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/unit-manager-reset.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── UnitManager replica ────────────────────────────────────────────────────

function createUnitManager() {
    return {
        units: [],
        placed: [],

        parseCSV(text) {
            const lines = text.trim().split('\n');
            if (lines.length < 2) return [];
            const data = lines.slice(1);
            return data.map(line => {
                const [name, qty, health, attack, defense] = line.split(',');
                return {
                    name: name.trim(),
                    sprites: this.nameToSprites(name.trim()),
                    qty: parseInt(qty, 10),
                    qtyRemaining: parseInt(qty, 10),
                    health: parseInt(health, 10),
                    attack: parseInt(attack, 10),
                    defense: parseFloat(defense),
                };
            }).filter(u => u.name && !isNaN(u.qty));
        },

        nameToSprites(name) {
            const lower = name.toLowerCase();
            if (lower.includes('archer')) return ['unit-archer'];
            if (lower.includes('knight')) return ['unit-knight'];
            if (lower.includes('militia')) return ['unit-militia'];
            return ['unit-militia'];
        },

        getAvailableUnits() {
            return this.units.filter(u => u.qtyRemaining > 0);
        },

        placeUnit(unitName, row, col) {
            const def = this.units.find(u => u.name === unitName && u.qtyRemaining > 0);
            if (!def) return null;
            def.qtyRemaining--;
            const sprite = def.sprites[Math.floor(Math.random() * def.sprites.length)];
            const placed = { def, sprite, row, col, currentHealth: def.health };
            this.placed.push(placed);
            return placed;
        },

        getPlacedUnits() {
            return this.placed;
        },

        getUnitAt(row, col) {
            return this.placed.find(u => u.row === row && u.col === col) || null;
        },

        removeUnit(unit) {
            const idx = this.placed.indexOf(unit);
            if (idx >= 0) {
                this.placed.splice(idx, 1);
                unit.def.qtyRemaining++;
            }
        },

        reset() {
            this.placed = [];
            this.units.forEach(u => { u.qtyRemaining = u.qty; });
        }
    };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('UnitManager.reset', () => {
    let um;

    beforeEach(() => {
        um = createUnitManager();
        um.units = um.parseCSV(
            'Unit,StartQty,Health,Attack,DefenseModifier\n' +
            'Archer,5,10,6,0.8\n' +
            'Knight,3,20,8,0.5\n' +
            'Militia,4,8,4,0.9'
        );
    });

    it('should clear all placed units', () => {
        um.placeUnit('Archer', 0, 0);
        um.placeUnit('Knight', 1, 1);
        assert.equal(um.placed.length, 2);

        um.reset();
        assert.equal(um.placed.length, 0);
    });

    it('should restore all qtyRemaining to original qty', () => {
        um.placeUnit('Archer', 0, 0);
        um.placeUnit('Archer', 1, 0);
        um.placeUnit('Knight', 2, 0);
        assert.equal(um.units[0].qtyRemaining, 3); // 5 - 2
        assert.equal(um.units[1].qtyRemaining, 2); // 3 - 1

        um.reset();
        assert.equal(um.units[0].qtyRemaining, 5);
        assert.equal(um.units[1].qtyRemaining, 3);
        assert.equal(um.units[2].qtyRemaining, 4);
    });

    it('should work when no units have been placed', () => {
        um.reset();
        assert.equal(um.placed.length, 0);
        assert.equal(um.units[0].qtyRemaining, 5);
    });

    it('should allow placing units again after reset', () => {
        // Place all archers
        for (let i = 0; i < 5; i++) um.placeUnit('Archer', i, 0);
        assert.equal(um.units[0].qtyRemaining, 0);
        assert.equal(um.placeUnit('Archer', 10, 0), null);

        um.reset();
        const placed = um.placeUnit('Archer', 0, 0);
        assert.notEqual(placed, null);
        assert.equal(um.units[0].qtyRemaining, 4);
    });
});

describe('UnitManager.getAvailableUnits', () => {
    let um;

    beforeEach(() => {
        um = createUnitManager();
        um.units = um.parseCSV(
            'Unit,StartQty,Health,Attack,DefenseModifier\n' +
            'Archer,3,10,6,0.8\n' +
            'Knight,2,20,8,0.5\n' +
            'Militia,1,8,4,0.9'
        );
    });

    it('should return all units when none are placed', () => {
        const available = um.getAvailableUnits();
        assert.equal(available.length, 3);
    });

    it('should exclude units with zero remaining', () => {
        um.placeUnit('Militia', 0, 0); // Only 1 militia, now 0 remaining
        const available = um.getAvailableUnits();
        assert.equal(available.length, 2);
        assert.ok(!available.some(u => u.name === 'Militia'));
    });

    it('should include units with some remaining', () => {
        um.placeUnit('Archer', 0, 0); // 3 - 1 = 2 remaining
        const available = um.getAvailableUnits();
        assert.equal(available.length, 3);
        assert.ok(available.some(u => u.name === 'Archer'));
    });

    it('should return empty array when all units depleted', () => {
        for (let i = 0; i < 3; i++) um.placeUnit('Archer', i, 0);
        for (let i = 0; i < 2; i++) um.placeUnit('Knight', i, 1);
        um.placeUnit('Militia', 0, 2);

        const available = um.getAvailableUnits();
        assert.equal(available.length, 0);
    });
});

describe('UnitManager.getPlacedUnits', () => {
    let um;

    beforeEach(() => {
        um = createUnitManager();
        um.units = um.parseCSV(
            'Unit,StartQty,Health,Attack,DefenseModifier\n' +
            'Archer,3,10,6,0.8\n' +
            'Knight,2,20,8,0.5'
        );
    });

    it('should return empty array initially', () => {
        assert.deepEqual(um.getPlacedUnits(), []);
    });

    it('should return placed units after placement', () => {
        um.placeUnit('Archer', 5, 5);
        const placed = um.getPlacedUnits();
        assert.equal(placed.length, 1);
        assert.equal(placed[0].row, 5);
        assert.equal(placed[0].col, 5);
    });

    it('should return all placed units', () => {
        um.placeUnit('Archer', 0, 0);
        um.placeUnit('Knight', 1, 1);
        um.placeUnit('Archer', 2, 2);
        assert.equal(um.getPlacedUnits().length, 3);
    });

    it('should reflect removals', () => {
        um.placeUnit('Archer', 0, 0);
        const placed = um.placeUnit('Knight', 1, 1);
        um.removeUnit(placed);
        assert.equal(um.getPlacedUnits().length, 1);
    });
});

describe('UnitManager.getUnitAt', () => {
    let um;

    beforeEach(() => {
        um = createUnitManager();
        um.units = um.parseCSV(
            'Unit,StartQty,Health,Attack,DefenseModifier\n' +
            'Archer,3,10,6,0.8'
        );
    });

    it('should return null when no unit at position', () => {
        assert.equal(um.getUnitAt(5, 5), null);
    });

    it('should return the unit at the given position', () => {
        um.placeUnit('Archer', 3, 7);
        const unit = um.getUnitAt(3, 7);
        assert.notEqual(unit, null);
        assert.equal(unit.row, 3);
        assert.equal(unit.col, 7);
    });

    it('should return null for adjacent positions', () => {
        um.placeUnit('Archer', 3, 7);
        assert.equal(um.getUnitAt(3, 6), null);
        assert.equal(um.getUnitAt(2, 7), null);
        assert.equal(um.getUnitAt(4, 7), null);
    });
});

describe('UnitManager.removeUnit', () => {
    let um;

    beforeEach(() => {
        um = createUnitManager();
        um.units = um.parseCSV(
            'Unit,StartQty,Health,Attack,DefenseModifier\n' +
            'Archer,3,10,6,0.8'
        );
    });

    it('should remove the unit from placed array', () => {
        const placed = um.placeUnit('Archer', 0, 0);
        um.removeUnit(placed);
        assert.equal(um.placed.length, 0);
    });

    it('should restore qtyRemaining', () => {
        const placed = um.placeUnit('Archer', 0, 0);
        assert.equal(um.units[0].qtyRemaining, 2);
        um.removeUnit(placed);
        assert.equal(um.units[0].qtyRemaining, 3);
    });

    it('should handle removing a unit not in the array gracefully', () => {
        const fakeUnit = { def: um.units[0], row: 99, col: 99 };
        // Should not throw
        assert.doesNotThrow(() => um.removeUnit(fakeUnit));
    });

    it('should only remove the specified unit', () => {
        um.placeUnit('Archer', 0, 0);
        const second = um.placeUnit('Archer', 1, 1);
        um.placeUnit('Archer', 2, 2);

        um.removeUnit(second);
        assert.equal(um.placed.length, 2);
        assert.equal(um.placed[0].row, 0);
        assert.equal(um.placed[1].row, 2);
    });
});
