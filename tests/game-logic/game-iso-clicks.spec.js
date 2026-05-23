/**
 * Tests for game-iso.js click handling logic.
 *
 * Covers handleClick unit placement branches and handleRightClick
 * unit removal logic extracted from the Game orchestrator.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game-iso-clicks.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Extracted logic from game-iso.js handleClick / handleRightClick ────────

/**
 * Simulates the unit placement logic from handleClick.
 * Returns the action taken: 'removed', 'placed', 'no-action', or 'deselected'.
 */
function handleUnitPlacement(clicked, selectedUnitIdx, units, placedUnits, tiles) {
    if (!clicked || selectedUnitIdx < 0) return 'no-action';

    const unitDef = units[selectedUnitIdx];
    if (!unitDef) return 'no-action';

    const existing = placedUnits.find(u => u.row === clicked.row && u.col === clicked.col);

    if (existing) {
        if (existing.def === unitDef) {
            // Remove own unit
            const idx = placedUnits.indexOf(existing);
            placedUnits.splice(idx, 1);
            existing.def.qtyRemaining++;
            return 'removed';
        }
        return 'no-action';
    }

    if (unitDef.qtyRemaining > 0) {
        const tile = tiles.find(t => t.row === clicked.row && t.col === clicked.col);
        if (tile && canPlaceOn(tile.sprite)) {
            unitDef.qtyRemaining--;
            const sprite = unitDef.sprites[0];
            placedUnits.push({ def: unitDef, sprite, row: clicked.row, col: clicked.col, currentHealth: unitDef.health });
            return 'placed';
        }
    }

    return 'no-action';
}

/**
 * Simulates handleRightClick unit removal logic.
 * Returns true if a unit was removed, false otherwise.
 */
function handleRightClickRemoval(clicked, placedUnits) {
    if (!clicked) return false;
    const unit = placedUnits.find(u => u.row === clicked.row && u.col === clicked.col);
    if (unit) {
        const idx = placedUnits.indexOf(unit);
        placedUnits.splice(idx, 1);
        unit.def.qtyRemaining++;
        return true;
    }
    return false;
}

/**
 * Simplified canPlaceOn from unit-manager.js
 */
function canPlaceOn(sprite) {
    const blocked = ['tree-', 'water-', 'castle-wall', 'castle-keep-', 'castle-gatehouse', 'rock'];
    for (const prefix of blocked) {
        if (sprite.startsWith(prefix)) return false;
    }
    return true;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Game handleClick: unit placement mode', () => {
    let units, placedUnits, tiles;

    beforeEach(() => {
        units = [
            { name: 'Archer', sprites: ['unit-archer'], qty: 3, qtyRemaining: 3, health: 10, attack: 5, defense: 0.8 },
            { name: 'Knight', sprites: ['unit-knight'], qty: 2, qtyRemaining: 2, health: 20, attack: 8, defense: 0.5 },
        ];
        placedUnits = [];
        tiles = [
            { row: 0, col: 0, sprite: 'grass-short-1' },
            { row: 1, col: 1, sprite: 'grass-short-2' },
            { row: 2, col: 2, sprite: 'tree-1' },
            { row: 3, col: 3, sprite: 'castle-wall' },
            { row: 4, col: 4, sprite: 'road-full' },
        ];
    });

    it('should place a unit on a valid grass tile', () => {
        const result = handleUnitPlacement({ row: 0, col: 0 }, 0, units, placedUnits, tiles);
        assert.equal(result, 'placed');
        assert.equal(placedUnits.length, 1);
        assert.equal(placedUnits[0].sprite, 'unit-archer');
        assert.equal(units[0].qtyRemaining, 2);
    });

    it('should not place a unit on a tree tile', () => {
        const result = handleUnitPlacement({ row: 2, col: 2 }, 0, units, placedUnits, tiles);
        assert.equal(result, 'no-action');
        assert.equal(placedUnits.length, 0);
        assert.equal(units[0].qtyRemaining, 3);
    });

    it('should not place a unit on a castle-wall tile', () => {
        const result = handleUnitPlacement({ row: 3, col: 3 }, 0, units, placedUnits, tiles);
        assert.equal(result, 'no-action');
    });

    it('should place a unit on a road tile', () => {
        const result = handleUnitPlacement({ row: 4, col: 4 }, 0, units, placedUnits, tiles);
        assert.equal(result, 'placed');
        assert.equal(placedUnits.length, 1);
    });

    it('should remove own unit when clicking occupied tile with same unit type', () => {
        // Place a unit first
        handleUnitPlacement({ row: 0, col: 0 }, 0, units, placedUnits, tiles);
        assert.equal(placedUnits.length, 1);
        assert.equal(units[0].qtyRemaining, 2);

        // Click same tile with same unit type selected
        const result = handleUnitPlacement({ row: 0, col: 0 }, 0, units, placedUnits, tiles);
        assert.equal(result, 'removed');
        assert.equal(placedUnits.length, 0);
        assert.equal(units[0].qtyRemaining, 3);
    });

    it('should not remove unit when clicking occupied tile with different unit type', () => {
        // Place an archer
        handleUnitPlacement({ row: 0, col: 0 }, 0, units, placedUnits, tiles);
        assert.equal(placedUnits.length, 1);

        // Click same tile with knight selected
        const result = handleUnitPlacement({ row: 0, col: 0 }, 1, units, placedUnits, tiles);
        assert.equal(result, 'no-action');
        assert.equal(placedUnits.length, 1);
    });

    it('should not place when no units remaining', () => {
        units[0].qtyRemaining = 0;
        const result = handleUnitPlacement({ row: 1, col: 1 }, 0, units, placedUnits, tiles);
        assert.equal(result, 'no-action');
        assert.equal(placedUnits.length, 0);
    });

    it('should return no-action when clicked is null', () => {
        const result = handleUnitPlacement(null, 0, units, placedUnits, tiles);
        assert.equal(result, 'no-action');
    });

    it('should return no-action when selectedUnitIdx is -1', () => {
        const result = handleUnitPlacement({ row: 0, col: 0 }, -1, units, placedUnits, tiles);
        assert.equal(result, 'no-action');
    });

    it('should return no-action when selectedUnitIdx is out of bounds', () => {
        const result = handleUnitPlacement({ row: 0, col: 0 }, 99, units, placedUnits, tiles);
        assert.equal(result, 'no-action');
    });

    it('should decrement qtyRemaining on successful placement', () => {
        handleUnitPlacement({ row: 0, col: 0 }, 1, units, placedUnits, tiles);
        assert.equal(units[1].qtyRemaining, 1);
        handleUnitPlacement({ row: 1, col: 1 }, 1, units, placedUnits, tiles);
        assert.equal(units[1].qtyRemaining, 0);
    });
});

describe('Game handleRightClick: unit removal', () => {
    let placedUnits, unitDef;

    beforeEach(() => {
        unitDef = { name: 'Archer', sprites: ['unit-archer'], qty: 3, qtyRemaining: 2, health: 10 };
        placedUnits = [
            { def: unitDef, sprite: 'unit-archer', row: 5, col: 5, currentHealth: 10 },
        ];
    });

    it('should remove a unit at the clicked position', () => {
        const result = handleRightClickRemoval({ row: 5, col: 5 }, placedUnits);
        assert.equal(result, true);
        assert.equal(placedUnits.length, 0);
        assert.equal(unitDef.qtyRemaining, 3);
    });

    it('should return false when no unit at clicked position', () => {
        const result = handleRightClickRemoval({ row: 0, col: 0 }, placedUnits);
        assert.equal(result, false);
        assert.equal(placedUnits.length, 1);
    });

    it('should return false when clicked is null', () => {
        const result = handleRightClickRemoval(null, placedUnits);
        assert.equal(result, false);
    });

    it('should restore qtyRemaining when removing a unit', () => {
        assert.equal(unitDef.qtyRemaining, 2);
        handleRightClickRemoval({ row: 5, col: 5 }, placedUnits);
        assert.equal(unitDef.qtyRemaining, 3);
    });

    it('should only remove the unit at the exact position', () => {
        const unitDef2 = { name: 'Knight', sprites: ['unit-knight'], qty: 2, qtyRemaining: 1, health: 20 };
        placedUnits.push({ def: unitDef2, sprite: 'unit-knight', row: 6, col: 6, currentHealth: 20 });

        handleRightClickRemoval({ row: 5, col: 5 }, placedUnits);
        assert.equal(placedUnits.length, 1);
        assert.equal(placedUnits[0].row, 6);
    });
});

describe('canPlaceOn: tile placement rules', () => {
    it('should allow placement on grass tiles', () => {
        assert.ok(canPlaceOn('grass-short-1'));
        assert.ok(canPlaceOn('grass-short-2'));
        assert.ok(canPlaceOn('grass-flowers-1'));
    });

    it('should allow placement on road tiles', () => {
        assert.ok(canPlaceOn('road-full'));
    });

    it('should allow placement on bridge tiles', () => {
        assert.ok(canPlaceOn('bridge-mm'));
    });

    it('should allow placement on bailey tiles', () => {
        assert.ok(canPlaceOn('castle-bailey-1'));
        assert.ok(canPlaceOn('castle-bailey-2'));
        assert.ok(canPlaceOn('castle-bailey-3'));
    });

    it('should block placement on tree tiles', () => {
        assert.ok(!canPlaceOn('tree-1'));
        assert.ok(!canPlaceOn('tree-2'));
        assert.ok(!canPlaceOn('tree-oak'));
    });

    it('should block placement on water tiles', () => {
        assert.ok(!canPlaceOn('water-1'));
        assert.ok(!canPlaceOn('water-2'));
    });

    it('should block placement on castle-wall', () => {
        assert.ok(!canPlaceOn('castle-wall'));
    });

    it('should block placement on castle-keep tiles', () => {
        assert.ok(!canPlaceOn('castle-keep-tl'));
        assert.ok(!canPlaceOn('castle-keep-center'));
    });

    it('should block placement on castle-gatehouse', () => {
        assert.ok(!canPlaceOn('castle-gatehouse'));
    });

    it('should block placement on rock', () => {
        assert.ok(!canPlaceOn('rock'));
    });

    it('should allow placement on castle-tower', () => {
        assert.ok(canPlaceOn('castle-tower'));
    });
});
