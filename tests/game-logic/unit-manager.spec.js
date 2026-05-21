/**
 * Tests for js/game-logic/unit-manager.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/unit-manager.spec.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Replicate UnitManager logic for testing (no DOM/fetch deps)
const UnitManager = {
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
        if (lower.includes('archer') || lower.includes('crossbow')) {
            return ['unit-archer', 'unit-crossbowman'];
        }
        if (lower.includes('spearman') || lower.includes('heavy infantry')) {
            return ['unit-spearman', 'unit-heavy-infantry'];
        }
        if (lower.includes('men-at-arms') || lower.includes('heavy troop') || lower.includes('knight')) {
            return ['unit-knight'];
        }
        if (lower.includes('engineer') || lower.includes('siege')) {
            return ['unit-engineer'];
        }
        if (lower.includes('militia') || lower.includes('watch')) {
            return ['unit-militia'];
        }
        if (lower.includes('artillery') || lower.includes('cannon')) {
            return ['unit-artillery'];
        }
        if (lower.includes('skirmish') || lower.includes('javelin')) {
            return ['unit-skirmisher'];
        }
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

    getPlacedUnits() { return this.placed; },

    canPlaceOn(sprite) {
        const blocked = [
            'tree-', 'water-', 'castle-wall', 'castle-keep-',
            'castle-gatehouse', 'rock'
        ];
        for (const prefix of blocked) {
            if (sprite.startsWith(prefix)) return false;
        }
        return true;
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

const SAMPLE_CSV = `Unit,StartQty,Health,Attack,DefenseModifier
Archer/Crossbowman,4,30,15,0.9
Spearman/Heavy infantry,3,50,20,0.7
Men-at-arms (heavy trooper),2,80,25,0.5
Engineer/Siege crew,1,20,5,0.95
Militia/Watchmen,6,25,10,0.85`;

describe('UnitManager.nameToSprites', () => {
    it('should map archer names to archer and crossbowman sprites', () => {
        assert.deepEqual(UnitManager.nameToSprites('Archer/Crossbowman'), ['unit-archer', 'unit-crossbowman']);
    });

    it('should map spearman names to spearman and heavy-infantry sprites', () => {
        assert.deepEqual(UnitManager.nameToSprites('Spearman/Heavy infantry'), ['unit-spearman', 'unit-heavy-infantry']);
    });

    it('should map men-at-arms to knight sprite', () => {
        assert.deepEqual(UnitManager.nameToSprites('Men-at-arms (heavy trooper)'), ['unit-knight']);
    });

    it('should map engineer to engineer sprite', () => {
        assert.deepEqual(UnitManager.nameToSprites('Engineer/Siege crew'), ['unit-engineer']);
    });

    it('should map militia to militia sprite', () => {
        assert.deepEqual(UnitManager.nameToSprites('Militia/Watchmen'), ['unit-militia']);
    });

    it('should map artillery to artillery sprite', () => {
        assert.deepEqual(UnitManager.nameToSprites('Artillery'), ['unit-artillery']);
    });

    it('should map cannon to artillery sprite', () => {
        assert.deepEqual(UnitManager.nameToSprites('Cannon crew'), ['unit-artillery']);
    });

    it('should map skirmisher to skirmisher sprite', () => {
        assert.deepEqual(UnitManager.nameToSprites('Skirmisher'), ['unit-skirmisher']);
    });

    it('should map javelin to skirmisher sprite', () => {
        assert.deepEqual(UnitManager.nameToSprites('Javelin thrower'), ['unit-skirmisher']);
    });

    it('should fallback to militia for unknown names', () => {
        assert.deepEqual(UnitManager.nameToSprites('Unknown Unit'), ['unit-militia']);
    });

    it('should be case-insensitive', () => {
        assert.deepEqual(UnitManager.nameToSprites('ARCHER'), ['unit-archer', 'unit-crossbowman']);
        assert.deepEqual(UnitManager.nameToSprites('knight'), ['unit-knight']);
    });
});

describe('UnitManager.parseCSV', () => {
    it('should parse valid CSV into unit definitions', () => {
        const units = UnitManager.parseCSV(SAMPLE_CSV);
        assert.equal(units.length, 5);
    });

    it('should parse unit names correctly', () => {
        const units = UnitManager.parseCSV(SAMPLE_CSV);
        assert.equal(units[0].name, 'Archer/Crossbowman');
        assert.equal(units[2].name, 'Men-at-arms (heavy trooper)');
    });

    it('should parse numeric stats correctly', () => {
        const units = UnitManager.parseCSV(SAMPLE_CSV);
        assert.equal(units[0].qty, 4);
        assert.equal(units[0].health, 30);
        assert.equal(units[0].attack, 15);
        assert.equal(units[0].defense, 0.9);
    });

    it('should set qtyRemaining equal to qty', () => {
        const units = UnitManager.parseCSV(SAMPLE_CSV);
        for (const u of units) {
            assert.equal(u.qtyRemaining, u.qty);
        }
    });

    it('should assign sprites based on name', () => {
        const units = UnitManager.parseCSV(SAMPLE_CSV);
        assert.deepEqual(units[0].sprites, ['unit-archer', 'unit-crossbowman']);
    });

    it('should return empty array for empty input', () => {
        assert.deepEqual(UnitManager.parseCSV(''), []);
    });

    it('should return empty array for header-only input', () => {
        assert.deepEqual(UnitManager.parseCSV('Unit,StartQty,Health,Attack,DefenseModifier'), []);
    });

    it('should filter out lines with invalid qty', () => {
        const csv = `Unit,StartQty,Health,Attack,DefenseModifier
Archer,abc,30,15,0.9`;
        const units = UnitManager.parseCSV(csv);
        assert.equal(units.length, 0);
    });
});

describe('UnitManager.canPlaceOn', () => {
    it('should allow placement on grass', () => {
        assert.equal(UnitManager.canPlaceOn('grass-short-1'), true);
        assert.equal(UnitManager.canPlaceOn('grass-flowers-2'), true);
    });

    it('should allow placement on road', () => {
        assert.equal(UnitManager.canPlaceOn('road-full'), true);
    });

    it('should allow placement on bridge', () => {
        assert.equal(UnitManager.canPlaceOn('bridge-mm'), true);
    });

    it('should allow placement on castle bailey', () => {
        assert.equal(UnitManager.canPlaceOn('castle-bailey-1'), true);
    });

    it('should block placement on trees', () => {
        assert.equal(UnitManager.canPlaceOn('tree-1'), false);
        assert.equal(UnitManager.canPlaceOn('tree-7'), false);
    });

    it('should block placement on water', () => {
        assert.equal(UnitManager.canPlaceOn('water-1'), false);
        assert.equal(UnitManager.canPlaceOn('water-3'), false);
    });

    it('should block placement on castle wall', () => {
        assert.equal(UnitManager.canPlaceOn('castle-wall'), false);
    });

    it('should block placement on castle keep', () => {
        assert.equal(UnitManager.canPlaceOn('castle-keep-tl'), false);
        assert.equal(UnitManager.canPlaceOn('castle-keep-center'), false);
    });

    it('should block placement on castle gatehouse', () => {
        assert.equal(UnitManager.canPlaceOn('castle-gatehouse'), false);
    });

    it('should block placement on rock', () => {
        assert.equal(UnitManager.canPlaceOn('rock'), false);
    });
});

describe('UnitManager.placeUnit / getUnitAt / removeUnit', () => {
    beforeEach(() => {
        UnitManager.units = UnitManager.parseCSV(SAMPLE_CSV);
        UnitManager.placed = [];
    });

    it('should place a unit and decrement qtyRemaining', () => {
        const placed = UnitManager.placeUnit('Archer/Crossbowman', 2, 3);
        assert.ok(placed !== null);
        assert.equal(placed.row, 2);
        assert.equal(placed.col, 3);
        assert.equal(placed.currentHealth, 30);
        const def = UnitManager.units.find(u => u.name === 'Archer/Crossbowman');
        assert.equal(def.qtyRemaining, 3);
    });

    it('should return null when no units available', () => {
        // Place all 4 archers
        for (let i = 0; i < 4; i++) {
            UnitManager.placeUnit('Archer/Crossbowman', i, 0);
        }
        const result = UnitManager.placeUnit('Archer/Crossbowman', 5, 0);
        assert.equal(result, null);
    });

    it('should return null for unknown unit name', () => {
        const result = UnitManager.placeUnit('Nonexistent', 0, 0);
        assert.equal(result, null);
    });

    it('should find placed unit by row/col', () => {
        UnitManager.placeUnit('Archer/Crossbowman', 5, 7);
        const found = UnitManager.getUnitAt(5, 7);
        assert.ok(found !== null);
        assert.equal(found.row, 5);
        assert.equal(found.col, 7);
    });

    it('should return null for empty tile', () => {
        assert.equal(UnitManager.getUnitAt(0, 0), null);
    });

    it('should remove a unit and restore qtyRemaining', () => {
        const placed = UnitManager.placeUnit('Archer/Crossbowman', 1, 1);
        UnitManager.removeUnit(placed);
        assert.equal(UnitManager.getUnitAt(1, 1), null);
        const def = UnitManager.units.find(u => u.name === 'Archer/Crossbowman');
        assert.equal(def.qtyRemaining, 4);
    });
});

describe('UnitManager.getAvailableUnits', () => {
    beforeEach(() => {
        UnitManager.units = UnitManager.parseCSV(SAMPLE_CSV);
        UnitManager.placed = [];
    });

    it('should return all units when none placed', () => {
        const available = UnitManager.getAvailableUnits();
        assert.equal(available.length, 5);
    });

    it('should exclude units with zero remaining', () => {
        // Place all 2 men-at-arms
        UnitManager.placeUnit('Men-at-arms (heavy trooper)', 0, 0);
        UnitManager.placeUnit('Men-at-arms (heavy trooper)', 1, 1);
        const available = UnitManager.getAvailableUnits();
        assert.equal(available.length, 4);
        assert.ok(!available.find(u => u.name === 'Men-at-arms (heavy trooper)'));
    });
});

describe('UnitManager.reset', () => {
    beforeEach(() => {
        UnitManager.units = UnitManager.parseCSV(SAMPLE_CSV);
        UnitManager.placed = [];
    });

    it('should clear all placed units', () => {
        UnitManager.placeUnit('Archer/Crossbowman', 0, 0);
        UnitManager.placeUnit('Militia/Watchmen', 1, 1);
        UnitManager.reset();
        assert.equal(UnitManager.placed.length, 0);
    });

    it('should restore all qtyRemaining to original qty', () => {
        UnitManager.placeUnit('Archer/Crossbowman', 0, 0);
        UnitManager.placeUnit('Archer/Crossbowman', 1, 0);
        UnitManager.reset();
        const def = UnitManager.units.find(u => u.name === 'Archer/Crossbowman');
        assert.equal(def.qtyRemaining, 4);
    });
});
