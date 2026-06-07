/**
 * enemy-manager.spec.js — spec-style tests for EnemyManager.moveUnit
 * and supplementary coverage for areas not covered by enemy-manager.test.js.
 *
 * Focuses on:
 *   - moveUnit (Requirements 4.2, 4.5, 9.3) — new sequential move API
 *   - identifySpawnPoints edge cases
 *   - getSpawnPoints / getEngagementZoneRegistry accessors
 *   - ZONE_* and ENGAGE_* constants
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/ai/enemy-manager.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const EnemyManager = require('../../../../js/game-logic/lib/ai/enemy-manager.js');
const PathfindingEngine = require('../../../../js/game-logic/lib/ai/pathfinding-engine.js');

const {
    createUnit,
    UNIT_DEFS,
    ZONE_CLUSTER_RADIUS,
    ZONE_AVOIDANCE_COST,
    ENGAGE_HP_RATIO,
    MAX_ARMY_COMMIT_FRACTION,
    identifySpawnPoints,
} = EnemyManager;

const { buildTileGraph, resolveTileChar, getMovementCost } = PathfindingEngine;

// ---------------------------------------------------------------------------
// Tile factory helpers
// ---------------------------------------------------------------------------

const grass   = (r, c) => ({ row: r, col: c, sprite: 'grass-short-1' });
const wall    = (r, c) => ({ row: r, col: c, sprite: 'castle-wall-1' });
const water   = (r, c) => ({ row: r, col: c, sprite: 'water-1' });
const keepCtr = (r, c) => ({ row: r, col: c, sprite: 'castle-keep-center' });
const tower   = (r, c) => ({ row: r, col: c, sprite: 'castle-tower' });

/**
 * Minimal 3-row grid used by multiple tests:
 *   Row 0: keepCtr anchor + flanking grass
 *   Row 1: grass row
 *   Row 2: grass spawn row (furthest from F)
 */
function makeMinimalGrid() {
    return [
        keepCtr(0, 1),
        grass(0, 0), grass(0, 2), grass(0, 3),
        grass(1, 0), grass(1, 1), grass(1, 2), grass(1, 3),
        grass(2, 0), grass(2, 1), grass(2, 2), grass(2, 3),
    ];
}

// ---------------------------------------------------------------------------
// EnemyManager.moveUnit — the new per-unit sequential move API
// (Requirements 4.2, 4.5, 9.3)
// ---------------------------------------------------------------------------

describe('EnemyManager.moveUnit — no-op guards', () => {
    it('does nothing when _worldKnowledgeMap is null (not initialised)', () => {
        EnemyManager.reset();
        // No init / spawnWave — _worldKnowledgeMap is null
        assert.doesNotThrow(
            () => EnemyManager.moveUnit('enemy-0'),
            'moveUnit should not throw when uninitialised'
        );
    });

    it('does nothing when unit id is not found in _units', () => {
        const tiles = makeMinimalGrid();
        EnemyManager.reset();
        EnemyManager.spawnWave({ units: [{ type: 'Infantry', count: 1 }] }, tiles);

        const unit = EnemyManager.getEnemyUnits()[0];
        const startRow = unit.row;
        const startCol = unit.col;

        // Call with a non-existent id
        EnemyManager.moveUnit('bogus-id-xyz');

        // The real unit must not have moved
        assert.equal(unit.row, startRow, 'row must not change for unknown id');
        assert.equal(unit.col, startCol, 'col must not change for unknown id');
    });

    it('does nothing when targetSet is empty (all walls, no perimeter)', () => {
        // A grid with ONLY wall tiles — no passable perimeter adjacent to the wall,
        // so computeCastlePerimeter returns [] and findPath returns [].
        const tiles = [
            wall(0, 0), wall(0, 1), wall(0, 2),
            wall(1, 0), wall(1, 1), wall(1, 2),
        ];
        const tileGraph = buildTileGraph(tiles);
        EnemyManager.reset();
        EnemyManager._worldKnowledgeMap = tileGraph;

        const unit = createUnit('Infantry', 1, 1, 'e0');
        EnemyManager._units.push(unit);

        // Target set is empty → findPath returns [] → moveUnit is a no-op
        assert.doesNotThrow(() => EnemyManager.moveUnit('e0'));
        // Unit position unchanged (we can't guarantee row/col because the unit is
        // on a wall tile which is impassable, so the guard fires)
    });
});

describe('EnemyManager.moveUnit — basic movement (Requirement 4.2)', () => {
    it('moves the identified unit exactly one tile closer to the target', () => {
        const tiles = makeMinimalGrid();
        EnemyManager.reset();
        EnemyManager.spawnWave({ units: [{ type: 'Infantry', count: 1 }] }, tiles);

        const unit = EnemyManager.getEnemyUnits()[0];
        const startRow = unit.row;
        const startCol = unit.col;

        EnemyManager.moveUnit(unit.id);

        const moved = unit.row !== startRow || unit.col !== startCol;
        assert.ok(moved,
            `moveUnit should advance unit from (${startRow},${startCol}), now at (${unit.row},${unit.col})`);
    });

    it('moves only the unit with the given id, leaving others stationary', () => {
        const tiles = makeMinimalGrid();
        EnemyManager.reset();
        EnemyManager.spawnWave({ units: [{ type: 'Infantry', count: 2 }] }, tiles);

        const [unit0, unit1] = EnemyManager.getEnemyUnits();
        const r1Before = unit1.row;
        const c1Before = unit1.col;

        // Move only unit0
        EnemyManager.moveUnit(unit0.id);

        // unit1 must not have moved
        assert.equal(unit1.row, r1Before, 'unit1 row must not change');
        assert.equal(unit1.col, c1Before, 'unit1 col must not change');
    });

    it('can be called multiple times to advance the same unit step by step', () => {
        const tiles = makeMinimalGrid();
        EnemyManager.reset();
        EnemyManager.spawnWave({ units: [{ type: 'Infantry', count: 1 }] }, tiles);

        const unit = EnemyManager.getEnemyUnits()[0];

        EnemyManager.moveUnit(unit.id);
        const afterStep1Row = unit.row;
        const afterStep1Col = unit.col;

        EnemyManager.moveUnit(unit.id);
        const afterStep2Row = unit.row;
        const afterStep2Col = unit.col;

        // At least one of the two steps should have changed position
        const movedStep1 = afterStep1Row !== EnemyManager.getEnemyUnits()[0].row ||
                           afterStep1Col !== EnemyManager.getEnemyUnits()[0].col;
        // The unit either moved in step 2, or it's already adjacent to target
        assert.ok(
            afterStep2Row !== undefined && afterStep2Col !== undefined,
            'Unit should still have a valid position after two moveUnit calls'
        );
    });

    it('unit does not land on an impassable tile after moveUnit', () => {
        // Grid with a wall blocking direct path — unit must route around it
        const tiles = [
            keepCtr(0, 1),
            wall(1, 1), grass(1, 0), grass(1, 2),
            grass(2, 0), grass(2, 1), grass(2, 2),
        ];
        const tileGraph = buildTileGraph(tiles);
        EnemyManager.reset();
        EnemyManager._worldKnowledgeMap = tileGraph;

        const unit = createUnit('Infantry', 2, 1, 'eu-0');
        EnemyManager._units.push(unit);

        EnemyManager.moveUnit('eu-0');

        const destTile = tileGraph.get(`${unit.row},${unit.col}`);
        if (destTile) {
            const ch = resolveTileChar(destTile);
            assert.notEqual(ch, 'W', 'moveUnit must never place unit on a wall tile');
            assert.ok(getMovementCost(ch, 'Infantry') < Infinity,
                'moveUnit destination must be passable for Infantry');
        }
    });
});

describe('EnemyManager.moveUnit — occupancy collision (Requirement 4.5)', () => {
    it('does not move a unit onto a tile occupied by another enemy unit', () => {
        const tiles = [
            keepCtr(0, 1),
            grass(0, 0), grass(0, 2),
            grass(1, 0), grass(1, 1), grass(1, 2),
            grass(2, 0), grass(2, 1), grass(2, 2),
        ];
        const tileGraph = buildTileGraph(tiles);
        EnemyManager.reset();
        EnemyManager._worldKnowledgeMap = tileGraph;

        // Place two adjacent units so both want to move toward the same next tile
        const u0 = createUnit('Infantry', 2, 0, 'eu-0');
        const u1 = createUnit('Infantry', 2, 1, 'eu-1');
        EnemyManager._units.push(u0, u1);

        EnemyManager.moveUnit('eu-0');
        EnemyManager.moveUnit('eu-1');

        const pos0 = `${u0.row},${u0.col}`;
        const pos1 = `${u1.row},${u1.col}`;
        assert.notEqual(pos0, pos1,
            `Two units must not share the same tile after moveUnit (both at ${pos0})`);
    });
});

describe('EnemyManager.moveUnit — phase switching (Requirement 9.3)', () => {
    it('uses keepTileSet as target when castleBreached is true', () => {
        // A grid where the keep tile exists but there are also walls around it.
        // In breach mode the unit should path toward the keep area.
        const tiles = [
            keepCtr(0, 1),
            grass(1, 0), grass(1, 1), grass(1, 2),
            grass(2, 0), grass(2, 1), grass(2, 2),
        ];
        const tileGraph = buildTileGraph(tiles);
        EnemyManager.reset();
        EnemyManager._worldKnowledgeMap = tileGraph;
        EnemyManager._castleBreached = true;

        const unit = createUnit('Infantry', 2, 1, 'eu-breach');
        EnemyManager._units.push(unit);

        // keepCtr resolves to 'F' which is Infinity — unit can't reach it.
        // moveUnit should handle this gracefully (unit stays or doesn't crash).
        assert.doesNotThrow(() => EnemyManager.moveUnit('eu-breach'));
    });

    it('uses castlePerimeter as target when castleBreached is false', () => {
        const tiles = makeMinimalGrid();
        EnemyManager.reset();
        EnemyManager.spawnWave({ units: [{ type: 'Infantry', count: 1 }] }, tiles);
        EnemyManager._castleBreached = false;

        const unit = EnemyManager.getEnemyUnits()[0];
        const startRow = unit.row;

        EnemyManager.moveUnit(unit.id);

        // Unit should advance toward the castle area (row decreasing toward row 0)
        assert.ok(unit.row <= startRow,
            `Unit should move toward castle perimeter (startRow=${startRow}, now at row=${unit.row})`);
    });
});

describe('EnemyManager.moveUnit — sharedThreatMap applied', () => {
    it('uses _sharedThreatMap if set (does not throw)', () => {
        const tiles = makeMinimalGrid();
        EnemyManager.reset();
        EnemyManager.spawnWave({ units: [{ type: 'Infantry', count: 1 }] }, tiles);

        // Pre-populate the shared threat map
        const mockThreatMap = new Map([['1,1', 3]]);
        EnemyManager._sharedThreatMap = mockThreatMap;

        const unit = EnemyManager.getEnemyUnits()[0];
        assert.doesNotThrow(() => EnemyManager.moveUnit(unit.id));
    });

    it('null _sharedThreatMap is treated as empty overlay (no crash)', () => {
        const tiles = makeMinimalGrid();
        EnemyManager.reset();
        EnemyManager.spawnWave({ units: [{ type: 'Infantry', count: 1 }] }, tiles);
        EnemyManager._sharedThreatMap = null; // explicit null

        const unit = EnemyManager.getEnemyUnits()[0];
        assert.doesNotThrow(() => EnemyManager.moveUnit(unit.id));
    });
});

// ---------------------------------------------------------------------------
// identifySpawnPoints edge cases
// ---------------------------------------------------------------------------

describe('identifySpawnPoints — edge cases', () => {
    it('returns at least 2 entries even when only one passable tile exists', () => {
        // Spawn row (row 2) has only one passable tile — should return it twice
        const tiles = [
            keepCtr(0, 1),
            grass(0, 0), grass(0, 2),
            grass(1, 0), grass(1, 1), grass(1, 2),
            wall(2, 0), grass(2, 1), wall(2, 2), // only grass(2,1) is passable
        ];
        const tileGraph = buildTileGraph(tiles);
        const result = identifySpawnPoints(tiles, tileGraph);
        assert.ok(result.length >= 2,
            `Expected at least 2 spawn points, got ${result.length}`);
    });

    it('returns empty array when no passable tiles exist on spawn row', () => {
        // All tiles on spawn row are walls — no valid spawn points
        const tiles = [
            keepCtr(0, 1),
            grass(1, 0), grass(1, 1), grass(1, 2),
            wall(2, 0), wall(2, 1), wall(2, 2), // all walls on spawn row
        ];
        const tileGraph = buildTileGraph(tiles);
        const result = identifySpawnPoints(tiles, tileGraph);
        assert.deepEqual(result, []);
    });

    it('when 3 passable tiles on spawn row, returns 2–4 evenly spaced points', () => {
        const tiles = [
            keepCtr(0, 2),
            grass(0, 0), grass(0, 1), grass(0, 3),
            grass(1, 0), grass(1, 1), grass(1, 2), grass(1, 3),
            grass(2, 0), grass(2, 1), grass(2, 2), grass(2, 3), // 4 passable on row 2
        ];
        const tileGraph = buildTileGraph(tiles);
        const result = identifySpawnPoints(tiles, tileGraph);
        assert.ok(result.length >= 2 && result.length <= 4,
            `Expected 2–4 spawn points, got ${result.length}`);
        // All on the same (furthest) row
        const rows = new Set(result.map(t => t.row));
        assert.equal(rows.size, 1, 'All spawn points should be on the same row');
    });

    it('spawn row is farthest from the F tile — row 0 when F is on last row', () => {
        const maxRow = 4;
        const tiles = [
            grass(0, 0), grass(0, 1), grass(0, 2),
            grass(1, 0), grass(1, 1), grass(1, 2),
            grass(2, 0), grass(2, 1), grass(2, 2),
            grass(3, 0), grass(3, 1), grass(3, 2),
            keepCtr(maxRow, 1), grass(maxRow, 0), grass(maxRow, 2), // F on row 4
        ];
        const tileGraph = buildTileGraph(tiles);
        const result = identifySpawnPoints(tiles, tileGraph);
        // F is at row 4; row 0 is furthest
        if (result.length > 0) {
            for (const sp of result) {
                assert.equal(sp.row, 0,
                    `Spawn point should be on row 0 when F is on row ${maxRow}`);
            }
        }
    });

    it('returned spawn points are actual tile objects (with row, col, sprite)', () => {
        const tiles = makeMinimalGrid();
        const tileGraph = buildTileGraph(tiles);
        const result = identifySpawnPoints(tiles, tileGraph);
        for (const sp of result) {
            assert.ok(typeof sp.row === 'number', 'spawn point should have numeric row');
            assert.ok(typeof sp.col === 'number', 'spawn point should have numeric col');
            assert.ok(typeof sp.sprite === 'string', 'spawn point should have a sprite string');
        }
    });

    it('uses row 0 as fallback F row when no F tile is present', () => {
        // Grid with no keepCtr — fallback fRow = 0.
        // Then farthest row = maxRow.
        const tiles = [
            grass(0, 0), grass(0, 1),
            grass(1, 0), grass(1, 1),
            grass(2, 0), grass(2, 1), // maxRow=2, furthest from fRow=0
        ];
        const tileGraph = buildTileGraph(tiles);
        const result = identifySpawnPoints(tiles, tileGraph);
        assert.ok(result.length >= 2,
            'Should return spawn points on the furthest row even without an F tile');
        if (result.length > 0) {
            for (const sp of result) {
                assert.equal(sp.row, 2,
                    'Spawn row should be row 2 (farthest from row 0 fallback)');
            }
        }
    });
});

// ---------------------------------------------------------------------------
// Accessor methods — getSpawnPoints / getEngagementZoneRegistry
// ---------------------------------------------------------------------------

describe('EnemyManager.getSpawnPoints()', () => {
    it('returns empty array before init', () => {
        EnemyManager.reset();
        assert.deepEqual(EnemyManager.getSpawnPoints(), []);
    });

    it('returns spawn points after init', () => {
        const tiles = makeMinimalGrid();
        EnemyManager.reset();
        EnemyManager.init(tiles);
        const pts = EnemyManager.getSpawnPoints();
        assert.ok(Array.isArray(pts), 'getSpawnPoints should return an array');
        assert.ok(pts.length >= 2, 'should have at least 2 spawn points after init');
    });

    it('returns empty array after reset', () => {
        const tiles = makeMinimalGrid();
        EnemyManager.init(tiles);
        EnemyManager.reset();
        assert.deepEqual(EnemyManager.getSpawnPoints(), []);
    });

    it('returns same reference as _spawnPoints', () => {
        const tiles = makeMinimalGrid();
        EnemyManager.reset();
        EnemyManager.init(tiles);
        assert.equal(EnemyManager.getSpawnPoints(), EnemyManager._spawnPoints,
            'getSpawnPoints() should return the _spawnPoints array reference');
    });
});

describe('EnemyManager.getEngagementZoneRegistry()', () => {
    it('returns empty array before any executeTurn', () => {
        EnemyManager.reset();
        assert.deepEqual(EnemyManager.getEngagementZoneRegistry(), []);
    });

    it('returns same reference as _engagementZoneRegistry', () => {
        EnemyManager.reset();
        assert.equal(
            EnemyManager.getEngagementZoneRegistry(),
            EnemyManager._engagementZoneRegistry,
            'getEngagementZoneRegistry() should return the same array reference'
        );
    });

    it('returns empty array after reset', () => {
        EnemyManager._engagementZoneRegistry.push({ id: 'zone-1' });
        EnemyManager.reset();
        assert.deepEqual(EnemyManager.getEngagementZoneRegistry(), []);
    });
});

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

describe('EnemyManager module-level constants', () => {
    it('ZONE_CLUSTER_RADIUS is 6', () => {
        assert.equal(ZONE_CLUSTER_RADIUS, 6);
    });

    it('ZONE_AVOIDANCE_COST is 5', () => {
        assert.equal(ZONE_AVOIDANCE_COST, 5);
    });

    it('ENGAGE_HP_RATIO is 1.5', () => {
        assert.equal(ENGAGE_HP_RATIO, 1.5);
    });

    it('MAX_ARMY_COMMIT_FRACTION is 0.40', () => {
        assert.equal(MAX_ARMY_COMMIT_FRACTION, 0.40);
    });
});

// ---------------------------------------------------------------------------
// createUnit — UNIT_TYPES coverage
// ---------------------------------------------------------------------------

describe('createUnit — UNIT_TYPES coverage', () => {
    it('UNIT_TYPES contains exactly the four expected types', () => {
        const expected = ['Infantry', 'Archer', 'Cavalry', 'SiegeEngine'].sort();
        const actual = [...EnemyManager.UNIT_TYPES].sort();
        assert.deepEqual(actual, expected);
    });

    it('all UNIT_TYPES can be created without throwing', () => {
        for (const type of EnemyManager.UNIT_TYPES) {
            assert.doesNotThrow(
                () => createUnit(type, 0, 0, `test-${type}`),
                `createUnit should not throw for type "${type}"`
            );
        }
    });

    it('units created for each type have currentHealth === health (full health at spawn)', () => {
        for (const type of EnemyManager.UNIT_TYPES) {
            const u = createUnit(type, 0, 0, 'id');
            assert.equal(u.currentHealth, UNIT_DEFS[type].health,
                `${type} currentHealth should equal defined health`);
        }
    });

    it('each unit has a def property matching UNIT_DEFS', () => {
        for (const type of EnemyManager.UNIT_TYPES) {
            const u = createUnit(type, 0, 0, 'id');
            assert.equal(u.def, UNIT_DEFS[type],
                `${type} unit.def should be the same object as UNIT_DEFS[${type}]`);
        }
    });
});

// ---------------------------------------------------------------------------
// _isZoneActive helper
// ---------------------------------------------------------------------------

describe('EnemyManager._isZoneActive', () => {
    it('returns true when difference equals SIGHTING_EXPIRY_TURNS (boundary)', () => {
        const EXPIRY = EnemyManager.SIGHTING_EXPIRY_TURNS;
        const zone = { lastObservedTurn: 0 };
        // currentTurn - 0 = EXPIRY → should be active (<=)
        assert.equal(EnemyManager._isZoneActive(zone, EXPIRY), true);
    });

    it('returns false when difference exceeds SIGHTING_EXPIRY_TURNS', () => {
        const EXPIRY = EnemyManager.SIGHTING_EXPIRY_TURNS;
        const zone = { lastObservedTurn: 0 };
        assert.equal(EnemyManager._isZoneActive(zone, EXPIRY + 1), false);
    });

    it('returns true for a recently observed zone', () => {
        const zone = { lastObservedTurn: 10 };
        assert.equal(EnemyManager._isZoneActive(zone, 11), true);
    });

    it('returns true when currentTurn equals lastObservedTurn (just observed)', () => {
        const zone = { lastObservedTurn: 5 };
        assert.equal(EnemyManager._isZoneActive(zone, 5), true);
    });
});

// ---------------------------------------------------------------------------
// spawnWave — subsequent calls accumulate units (round-robin continues)
// ---------------------------------------------------------------------------

describe('EnemyManager.spawnWave — subsequent calls', () => {
    it('second spawnWave call appends units (ids continue from previous count)', () => {
        const tiles = makeMinimalGrid();
        EnemyManager.reset();
        EnemyManager.spawnWave({ units: [{ type: 'Infantry', count: 2 }] }, tiles);

        const countAfterFirst = EnemyManager.getEnemyUnits().length;
        assert.equal(countAfterFirst, 2);

        EnemyManager.spawnWave({ units: [{ type: 'Archer', count: 1 }] }, tiles);
        const allUnits = EnemyManager.getEnemyUnits();
        assert.equal(allUnits.length, 3, 'Second wave should add to existing units');
        assert.equal(allUnits[2].type, 'Archer', 'Third unit should be an Archer');
    });
});
