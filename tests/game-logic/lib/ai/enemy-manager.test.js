/**
 * Tests for js/game-logic/lib/ai/enemy-manager.js
 *
 * Tasks 6.1 and 6.2:
 *   - UNIT_DEFS, createUnit factory
 *   - computeCastlePerimeter, computeKeepTileSet
 *   - EnemyManager singleton API
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/ai/enemy-manager.test.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const PathfindingEngine = require('../../../../js/game-logic/lib/ai/pathfinding-engine.js');
const EnemyManager = require('../../../../js/game-logic/lib/ai/enemy-manager.js');

// EnemyManager exports itself as the module; helpers are attached to it.
const {
    UNIT_DEFS,
    CASTLE_STRUCTURE_CHARS,
    KEEP_CHARS,
    createUnit,
    computeCastlePerimeter,
    computeKeepTileSet,
} = EnemyManager;

const { buildTileGraph, resolveTileChar, getMovementCost } = PathfindingEngine;

// ---------------------------------------------------------------------------
// Helpers: minimal tile grid factories
// ---------------------------------------------------------------------------

/**
 * Create a tile object matching the shape expected by PathfindingEngine.
 * Sprite names follow LevelLoader.parseLevelText conventions.
 */
function makeTile(row, col, sprite, overlay) {
    const tile = { row, col, sprite };
    if (overlay) tile.overlay = overlay;
    return tile;
}

// Shorthand tile constructors
const grass   = (row, col) => makeTile(row, col, 'grass-short-1');
const water   = (row, col) => makeTile(row, col, 'water-1');
const wall    = (row, col) => makeTile(row, col, 'castle-wall-1');
const tower   = (row, col) => makeTile(row, col, 'castle-tower');
const gate    = (row, col) => makeTile(row, col, 'castle-gatehouse');
const keepTL  = (row, col) => makeTile(row, col, 'castle-keep-tl');       // K
const keepBL  = (row, col) => makeTile(row, col, 'castle-keep-bl');       // j
const keepBR  = (row, col) => makeTile(row, col, 'castle-keep-br');       // J
const keepCtr = (row, col) => makeTile(row, col, 'castle-keep-center');   // F
const oak     = (row, col) => makeTile(row, col, 'grass-short-1', 'tree-oak-overlay-1');
const road    = (row, col) => makeTile(row, col, 'road-full');

// ---------------------------------------------------------------------------
// UNIT_DEFS (Requirements 6.1, 6.2, 6.3, 6.4)
// Health values from design doc: Infantry 30, Archer 25, Cavalry 35, SiegeEngine 60
// ---------------------------------------------------------------------------

describe('UNIT_DEFS', () => {
    it('defines Infantry with movePts 2 and health 30', () => {
        assert.equal(UNIT_DEFS.Infantry.movePts, 2);
        assert.equal(UNIT_DEFS.Infantry.health, 30);
    });
    it('defines Archer with movePts 2 and health 25', () => {
        assert.equal(UNIT_DEFS.Archer.movePts, 2);
        assert.equal(UNIT_DEFS.Archer.health, 25);
    });
    it('defines Cavalry with movePts 3 and health 35', () => {
        assert.equal(UNIT_DEFS.Cavalry.movePts, 3);
        assert.equal(UNIT_DEFS.Cavalry.health, 35);
    });
    it('defines SiegeEngine with movePts 1 and health 60', () => {
        assert.equal(UNIT_DEFS.SiegeEngine.movePts, 1);
        assert.equal(UNIT_DEFS.SiegeEngine.health, 60);
    });
});

// ---------------------------------------------------------------------------
// createUnit
// ---------------------------------------------------------------------------

describe('createUnit', () => {
    it('returns an object with correct type, row, col, id', () => {
        const u = createUnit('Infantry', 5, 3, 'u-1');
        assert.equal(u.type, 'Infantry');
        assert.equal(u.row, 5);
        assert.equal(u.col, 3);
        assert.equal(u.id, 'u-1');
    });
    it('populates movePts, health, and currentHealth from UNIT_DEFS', () => {
        const u = createUnit('Cavalry', 0, 0, 'c-1');
        assert.equal(u.movePts, 3);
        assert.equal(u.health, 35);
        assert.equal(u.currentHealth, 35);
    });
    it('throws for unknown unit types', () => {
        assert.throws(() => createUnit('Dragon', 0, 0, 'x'), /Unknown unit type/);
    });
});

// ---------------------------------------------------------------------------
// CASTLE_STRUCTURE_CHARS and KEEP_CHARS constants
// ---------------------------------------------------------------------------

describe('CASTLE_STRUCTURE_CHARS', () => {
    it('contains W, T, G, K, j, J, F', () => {
        for (const ch of ['W', 'T', 'G', 'K', 'j', 'J', 'F']) {
            assert.ok(CASTLE_STRUCTURE_CHARS.has(ch), `Expected ${ch} in CASTLE_STRUCTURE_CHARS`);
        }
    });
    it('does not contain grass or road chars', () => {
        for (const ch of ['.', ',', 'D', '~']) {
            assert.ok(!CASTLE_STRUCTURE_CHARS.has(ch), `Did not expect ${ch} in CASTLE_STRUCTURE_CHARS`);
        }
    });
});

describe('KEEP_CHARS', () => {
    it('contains K, j, J, F', () => {
        for (const ch of ['K', 'j', 'J', 'F']) {
            assert.ok(KEEP_CHARS.has(ch), `Expected ${ch} in KEEP_CHARS`);
        }
    });
    it('does not contain wall (W) or tower (T)', () => {
        assert.ok(!KEEP_CHARS.has('W'));
        assert.ok(!KEEP_CHARS.has('T'));
    });
});

// ---------------------------------------------------------------------------
// computeKeepTileSet (Requirement 3.2)
// ---------------------------------------------------------------------------

describe('computeKeepTileSet', () => {
    it('returns only keep tiles from a mixed tile array', () => {
        const tiles = [
            grass(0, 0),
            wall(0, 1),
            keepTL(1, 1),   // K
            keepBL(2, 1),   // j
            keepBR(1, 2),   // J
            keepCtr(2, 2),  // F
            road(3, 0),
            tower(0, 2),
        ];
        const result = computeKeepTileSet(tiles);
        assert.equal(result.length, 4);
        const chars = result.map(t => resolveTileChar(t));
        for (const ch of ['K', 'j', 'J', 'F']) {
            assert.ok(chars.includes(ch), `Keep tile ${ch} missing from result`);
        }
    });

    it('returns empty array when no keep tiles present', () => {
        const tiles = [grass(0, 0), wall(0, 1), tower(0, 2)];
        assert.deepEqual(computeKeepTileSet(tiles), []);
    });

    it('returns all tiles when all are keep chars', () => {
        const tiles = [keepTL(0, 0), keepBL(0, 1), keepBR(1, 0), keepCtr(1, 1)];
        const result = computeKeepTileSet(tiles);
        assert.equal(result.length, 4);
    });

    it('does not include walls or towers even though they are CASTLE_STRUCTURE_CHARS', () => {
        const tiles = [wall(0, 0), tower(0, 1), keepCtr(1, 0)];
        const result = computeKeepTileSet(tiles);
        assert.equal(result.length, 1);
        assert.equal(resolveTileChar(result[0]), 'F');
    });

    it('returned tiles are the actual tile objects, not just positions', () => {
        const f = keepCtr(2, 3);
        const result = computeKeepTileSet([grass(0, 0), f]);
        assert.equal(result.length, 1);
        assert.equal(result[0], f); // same object reference
    });
});

// ---------------------------------------------------------------------------
// computeCastlePerimeter (Requirements 3.1, 3.3)
// ---------------------------------------------------------------------------

describe('computeCastlePerimeter — basic adjacency', () => {
    /**
     * Minimal grid (even-row offset topology):
     *   Row 0: grass(0,0)  wall(0,1)  grass(0,2)
     *   Row 1: grass(1,0)  grass(1,1) grass(1,2)
     *
     * Hex neighbours of wall(0,1) in even-row topology:
     *   NW: (-1,0) — out of bounds
     *   NE: (-1,1) — out of bounds
     *   E:  (0,2)  — grass ← perimeter candidate
     *   SE: (1,1)  — grass ← perimeter candidate
     *   SW: (1,0)  — grass ← perimeter candidate
     *   W:  (0,0)  — grass ← perimeter candidate
     */
    it('finds passable grass tiles adjacent to a wall tile', () => {
        const tiles = [
            grass(0, 0), wall(0, 1), grass(0, 2),
            grass(1, 0), grass(1, 1), grass(1, 2),
        ];
        const tileGraph = buildTileGraph(tiles);
        const perimeter = computeCastlePerimeter(tiles, tileGraph);

        const perimeterKeys = new Set(perimeter.map(t => `${t.row},${t.col}`));
        assert.ok(perimeterKeys.has('0,0'), 'grass(0,0) should be in perimeter');
        assert.ok(perimeterKeys.has('0,2'), 'grass(0,2) should be in perimeter');
        assert.ok(perimeterKeys.has('1,0'), 'grass(1,0) should be in perimeter');
        assert.ok(perimeterKeys.has('1,1'), 'grass(1,1) should be in perimeter');
    });

    it('does not include the castle structure tile itself in the perimeter', () => {
        const tiles = [grass(0, 0), wall(0, 1)];
        const tileGraph = buildTileGraph(tiles);
        const perimeter = computeCastlePerimeter(tiles, tileGraph);
        const chars = perimeter.map(t => resolveTileChar(t));
        assert.ok(!chars.includes('W'), 'Wall tile itself must not be in perimeter');
    });

    it('does not include impassable tiles (trees for Infantry) in the perimeter', () => {
        const tiles = [
            wall(0, 1),
            oak(0, 0),   // O — impassable for Infantry
            grass(0, 2),
        ];
        const tileGraph = buildTileGraph(tiles);
        const perimeter = computeCastlePerimeter(tiles, tileGraph);
        const perimeterKeys = new Set(perimeter.map(t => `${t.row},${t.col}`));

        assert.ok(!perimeterKeys.has('0,0'), 'Tree tile must not be in perimeter');
        assert.ok(perimeterKeys.has('0,2'), 'grass(0,2) should be in perimeter');
    });

    it('deduplicates tiles adjacent to multiple castle structures', () => {
        /**
         * Two adjacent wall tiles: wall(0,1) and wall(0,2).
         * grass(1,1) is a neighbour of BOTH wall tiles — should appear only once.
         */
        const tiles = [
            grass(0, 0), wall(0, 1), wall(0, 2), grass(0, 3),
            grass(1, 0), grass(1, 1), grass(1, 2), grass(1, 3),
        ];
        const tileGraph = buildTileGraph(tiles);
        const perimeter = computeCastlePerimeter(tiles, tileGraph);
        const perimeterKeys = perimeter.map(t => `${t.row},${t.col}`);

        // No duplicates
        const uniqueKeys = new Set(perimeterKeys);
        assert.equal(perimeterKeys.length, uniqueKeys.size, 'Perimeter must not contain duplicate tiles');
    });

    it('returns empty array when no castle structure tiles are present', () => {
        const tiles = [grass(0, 0), grass(0, 1), road(1, 0)];
        const tileGraph = buildTileGraph(tiles);
        assert.deepEqual(computeCastlePerimeter(tiles, tileGraph), []);
    });

    it('returns empty array when all castle neighbour tiles are out of bounds', () => {
        const tiles = [wall(0, 0)];
        const tileGraph = buildTileGraph(tiles);
        assert.deepEqual(computeCastlePerimeter(tiles, tileGraph), []);
    });

    it('does not include another castle structure tile adjacent to a wall', () => {
        const tiles = [
            wall(0, 1), tower(0, 2), grass(0, 3),
            grass(1, 0), grass(1, 1), grass(1, 2),
        ];
        const tileGraph = buildTileGraph(tiles);
        const perimeter = computeCastlePerimeter(tiles, tileGraph);
        const chars = perimeter.map(t => resolveTileChar(t));
        assert.ok(!chars.includes('T'), 'Tower must not appear in perimeter');
        assert.ok(!chars.includes('W'), 'Wall must not appear in perimeter');
        assert.ok(chars.includes('.'), 'Grass tiles should be in the perimeter');
    });

    it('includes water tiles adjacent to castle (water passable for Infantry, cost 2)', () => {
        const tiles = [
            wall(0, 1), water(0, 0), water(0, 2),
        ];
        const tileGraph = buildTileGraph(tiles);
        const perimeter = computeCastlePerimeter(tiles, tileGraph);
        const chars = perimeter.map(t => resolveTileChar(t));
        assert.ok(chars.includes('~'), 'Water tile should be in perimeter (passable for Infantry)');
    });

    it('works with all CASTLE_STRUCTURE_CHARS types as sources', () => {
        const castleTypes = [
            wall(2, 1), tower(2, 3), gate(2, 5),
            keepTL(2, 7), keepBL(2, 9), keepBR(2, 11), keepCtr(2, 13),
        ];
        // Even-row 2, SE neighbor = (3, col)
        const grassTiles = castleTypes.map(t => grass(3, t.col));
        const tiles = [...castleTypes, ...grassTiles];
        const tileGraph = buildTileGraph(tiles);
        const perimeter = computeCastlePerimeter(tiles, tileGraph);

        const perimeterKeys = new Set(perimeter.map(t => `${t.row},${t.col}`));
        for (const g of grassTiles) {
            assert.ok(perimeterKeys.has(`${g.row},${g.col}`), `grass(${g.row},${g.col}) should be in perimeter`);
        }
    });

    it('all perimeter tiles are passable for Infantry', () => {
        const tiles = [
            grass(0, 0), wall(0, 1), oak(0, 2), grass(0, 3),
            grass(1, 0), grass(1, 1), oak(1, 2), grass(1, 3),
        ];
        const tileGraph = buildTileGraph(tiles);
        const perimeter = computeCastlePerimeter(tiles, tileGraph);

        for (const tile of perimeter) {
            const ch = resolveTileChar(tile);
            const cost = getMovementCost(ch, 'Infantry');
            assert.ok(cost < Infinity, `Perimeter tile ${ch} must be passable for Infantry`);
        }
    });

    it('all perimeter tiles are adjacent to at least one castle structure tile', () => {
        const tiles = [
            grass(0, 0), wall(0, 1), grass(0, 2),
            grass(1, 0), grass(1, 1), grass(1, 2),
            grass(2, 0), grass(2, 1), grass(2, 2),
        ];
        const tileGraph = buildTileGraph(tiles);
        const perimeter = computeCastlePerimeter(tiles, tileGraph);

        const { hexNeighbors: hexN } = PathfindingEngine;

        for (const perimTile of perimeter) {
            const neighbours = hexN(perimTile.row, perimTile.col);
            const hasCastleNeighbour = neighbours.some(({ row, col }) => {
                const nTile = tileGraph.get(`${row},${col}`);
                if (!nTile) return false;
                return CASTLE_STRUCTURE_CHARS.has(resolveTileChar(nTile));
            });
            assert.ok(
                hasCastleNeighbour,
                `Perimeter tile (${perimTile.row},${perimTile.col}) must be adjacent to a castle structure`
            );
        }
    });

    it('returned tiles are actual tile objects from tileGraph', () => {
        const g = grass(0, 0);
        const w = wall(0, 1);
        const tiles = [g, w];
        const tileGraph = buildTileGraph(tiles);
        const perimeter = computeCastlePerimeter(tiles, tileGraph);

        // The perimeter tile should be the same object reference as in tiles/tileGraph
        assert.equal(perimeter.length, 1);
        assert.equal(perimeter[0], g); // same object reference
    });
});

// ---------------------------------------------------------------------------
// EnemyManager — setCastleBreached
// ---------------------------------------------------------------------------

describe('EnemyManager.setCastleBreached', () => {
    it('coerces truthy values to true', () => {
        EnemyManager.setCastleBreached(1);
        assert.equal(EnemyManager._castleBreached, true);
    });
    it('coerces falsy values to false', () => {
        EnemyManager.setCastleBreached(0);
        assert.equal(EnemyManager._castleBreached, false);
    });
    it('accepts boolean true', () => {
        EnemyManager.setCastleBreached(true);
        assert.equal(EnemyManager._castleBreached, true);
        EnemyManager.setCastleBreached(false); // reset
    });
});

// ---------------------------------------------------------------------------
// EnemyManager.reset
// ---------------------------------------------------------------------------

describe('EnemyManager.reset', () => {
    it('clears units, resets breached flag, and clears registries', () => {
        // Set up some state
        EnemyManager._units = [createUnit('Infantry', 0, 0, 'x')];
        EnemyManager._castleBreached = true;
        EnemyManager._lastSeenRegistry.set('k1', { row: 0, col: 0, turn: 1, health: 5 });
        EnemyManager._unitKeyCache.set(0, 'k1');
        EnemyManager._sharedThreatMap = new Map();
        EnemyManager._engagementZoneRegistry.push({ id: 'z1' });

        EnemyManager.reset();

        assert.deepEqual(EnemyManager._units, []);
        assert.equal(EnemyManager._castleBreached, false);
        assert.equal(EnemyManager._lastSeenRegistry.size, 0);
        assert.equal(EnemyManager._unitKeyCache.size, 0);
        assert.equal(EnemyManager._sharedThreatMap, null);
        assert.deepEqual(EnemyManager._engagementZoneRegistry, []);
    });
});

// ---------------------------------------------------------------------------
// EnemyManager.getEnemyUnitAt
// ---------------------------------------------------------------------------

describe('EnemyManager.getEnemyUnitAt', () => {
    it('returns null when no units present', () => {
        EnemyManager.reset();
        assert.equal(EnemyManager.getEnemyUnitAt(0, 0), null);
    });
    it('finds a unit at its position', () => {
        EnemyManager.reset();
        const u = createUnit('Infantry', 3, 4, 'u1');
        EnemyManager._units.push(u);
        assert.equal(EnemyManager.getEnemyUnitAt(3, 4), u);
        assert.equal(EnemyManager.getEnemyUnitAt(3, 5), null);
    });
});

// ---------------------------------------------------------------------------
// EnemyManager — delegates to module-level functions
// ---------------------------------------------------------------------------

describe('EnemyManager.computeCastlePerimeter delegates correctly', () => {
    it('returns same result as calling computeCastlePerimeter directly', () => {
        const tiles = [grass(0, 0), wall(0, 1), grass(0, 2)];
        const tileGraph = buildTileGraph(tiles);
        const direct = computeCastlePerimeter(tiles, tileGraph);
        const viaManager = EnemyManager.computeCastlePerimeter(tiles, tileGraph);
        assert.deepEqual(
            direct.map(t => `${t.row},${t.col}`).sort(),
            viaManager.map(t => `${t.row},${t.col}`).sort()
        );
    });
});

describe('EnemyManager.computeKeepTileSet delegates correctly', () => {
    it('returns same result as calling computeKeepTileSet directly', () => {
        const tiles = [grass(0, 0), keepCtr(1, 1), keepTL(2, 2)];
        const direct = computeKeepTileSet(tiles);
        const viaManager = EnemyManager.computeKeepTileSet(tiles);
        assert.deepEqual(
            direct.map(t => `${t.row},${t.col}`).sort(),
            viaManager.map(t => `${t.row},${t.col}`).sort()
        );
    });
});

// ---------------------------------------------------------------------------
// EnemyManager.reset — comprehensive state verification (Req 7.6, 12.7, 13.8, 13.9)
// ---------------------------------------------------------------------------

describe('EnemyManager.reset — comprehensive state clearing', () => {
    it('clears _worldKnowledgeMap to null', () => {
        EnemyManager._worldKnowledgeMap = new Map([['0,0', grass(0, 0)]]);
        EnemyManager.reset();
        assert.equal(EnemyManager._worldKnowledgeMap, null);
    });

    it('clears _spawnPoints to empty array', () => {
        EnemyManager._spawnPoints = [grass(0, 0), grass(0, 1)];
        EnemyManager.reset();
        assert.deepEqual(EnemyManager._spawnPoints, []);
    });

    it('resets all state fields in one call', () => {
        // Populate every tracked field
        EnemyManager._units = [createUnit('Cavalry', 2, 2, 'c1')];
        EnemyManager._castleBreached = true;
        EnemyManager._worldKnowledgeMap = new Map([['0,0', grass(0, 0)]]);
        EnemyManager._lastSeenRegistry.set('key1', { row: 0, col: 0, turn: 5, health: 20 });
        EnemyManager._unitKeyCache.set(0, 'key1');
        EnemyManager._sharedThreatMap = new Map([['1,1', 3]]);
        EnemyManager._spawnPoints = [grass(9, 0)];
        EnemyManager._engagementZoneRegistry.push({ id: 'zone-1' });

        EnemyManager.reset();

        assert.deepEqual(EnemyManager._units, [], '_units');
        assert.equal(EnemyManager._castleBreached, false, '_castleBreached');
        assert.equal(EnemyManager._worldKnowledgeMap, null, '_worldKnowledgeMap');
        assert.equal(EnemyManager._lastSeenRegistry.size, 0, '_lastSeenRegistry');
        assert.equal(EnemyManager._unitKeyCache.size, 0, '_unitKeyCache');
        assert.equal(EnemyManager._sharedThreatMap, null, '_sharedThreatMap');
        assert.deepEqual(EnemyManager._spawnPoints, [], '_spawnPoints');
        assert.deepEqual(EnemyManager._engagementZoneRegistry, [], '_engagementZoneRegistry');
    });
});

// ---------------------------------------------------------------------------
// EnemyManager.init (Req 3.5, 7.3)
// ---------------------------------------------------------------------------

describe('EnemyManager.init', () => {
    it('builds _worldKnowledgeMap from tile array', () => {
        const tiles = [
            grass(0, 0), grass(0, 1), grass(0, 2),
            grass(1, 0), keepCtr(1, 1), grass(1, 2),   // F tile for spawn logic
            grass(2, 0), grass(2, 1), grass(2, 2),
        ];
        EnemyManager.reset();
        EnemyManager.init(tiles);

        const wkm = EnemyManager._worldKnowledgeMap;
        assert.ok(wkm instanceof Map, '_worldKnowledgeMap should be a Map');
        assert.ok(wkm.size > 0, '_worldKnowledgeMap should not be empty');
        // Every tile should be reachable by key
        for (const tile of tiles) {
            assert.ok(wkm.has(`${tile.row},${tile.col}`),
                `tile (${tile.row},${tile.col}) should be in worldKnowledgeMap`);
        }
    });

    it('populates _spawnPoints with at least 2 entries', () => {
        // F tile at row 0; spawn points should be on the furthest row (row 2)
        const tiles = [
            keepCtr(0, 2),                              // F tile at row 0
            grass(0, 0), grass(0, 1), grass(0, 3),
            grass(1, 0), grass(1, 1), grass(1, 2), grass(1, 3),
            grass(2, 0), grass(2, 1), grass(2, 2), grass(2, 3), // furthest row from F
        ];
        EnemyManager.reset();
        EnemyManager.init(tiles);

        assert.ok(EnemyManager._spawnPoints.length >= 2,
            `Expected at least 2 spawn points, got ${EnemyManager._spawnPoints.length}`);
    });

    it('spawn points are all on the same (furthest) row', () => {
        // F tile at row 0 → furthest row is row 3
        const tiles = [
            keepCtr(0, 1),
            grass(0, 0), grass(0, 2),
            grass(1, 0), grass(1, 1), grass(1, 2),
            grass(2, 0), grass(2, 1), grass(2, 2),
            grass(3, 0), grass(3, 1), grass(3, 2),
        ];
        EnemyManager.reset();
        EnemyManager.init(tiles);

        const spawnRow = EnemyManager._spawnPoints[0].row;
        for (const sp of EnemyManager._spawnPoints) {
            assert.equal(sp.row, spawnRow,
                `All spawn points should share the same row (${spawnRow})`);
        }
    });
});

// ---------------------------------------------------------------------------
// EnemyManager accessor methods (Req 7.6, 10.6, 12.7, 13.9)
// ---------------------------------------------------------------------------

describe('EnemyManager accessor methods', () => {
    it('getEnemyUnits() returns the _units array', () => {
        EnemyManager.reset();
        const u = createUnit('Archer', 1, 1, 'a1');
        EnemyManager._units.push(u);
        assert.equal(EnemyManager.getEnemyUnits(), EnemyManager._units);
        assert.equal(EnemyManager.getEnemyUnits().length, 1);
        assert.equal(EnemyManager.getEnemyUnits()[0], u);
    });

    it('getEnemyUnits() returns empty array after reset', () => {
        EnemyManager.reset();
        assert.deepEqual(EnemyManager.getEnemyUnits(), []);
    });

    it('getLastSeenRegistry() returns the _lastSeenRegistry Map', () => {
        EnemyManager.reset();
        const reg = EnemyManager.getLastSeenRegistry();
        assert.ok(reg instanceof Map, 'should return a Map');
        assert.equal(reg.size, 0, 'should be empty after reset');

        // Mutate via internal state and verify accessor reflects change
        EnemyManager._lastSeenRegistry.set('u1', { row: 2, col: 3, turn: 1, health: 10 });
        assert.equal(EnemyManager.getLastSeenRegistry().size, 1);
        assert.equal(EnemyManager.getLastSeenRegistry(), EnemyManager._lastSeenRegistry,
            'should be the same Map reference');
    });

    it('getLastSeenRegistry() is cleared after reset', () => {
        EnemyManager._lastSeenRegistry.set('u1', { row: 0, col: 0, turn: 1, health: 5 });
        EnemyManager.reset();
        assert.equal(EnemyManager.getLastSeenRegistry().size, 0);
    });

    it('getWorldKnowledgeMap() returns null before init', () => {
        EnemyManager.reset();
        assert.equal(EnemyManager.getWorldKnowledgeMap(), null);
    });

    it('getWorldKnowledgeMap() returns the Map after init', () => {
        const tiles = [
            keepCtr(0, 1), grass(0, 0), grass(0, 2),
            grass(1, 0), grass(1, 1), grass(1, 2),
        ];
        EnemyManager.reset();
        EnemyManager.init(tiles);
        const wkm = EnemyManager.getWorldKnowledgeMap();
        assert.ok(wkm instanceof Map, 'should be a Map after init');
        assert.ok(wkm.size > 0, 'should have entries');
    });

    it('getWorldKnowledgeMap() is null after reset', () => {
        const tiles = [grass(0, 0), keepCtr(1, 0), grass(2, 0)];
        EnemyManager.init(tiles);
        EnemyManager.reset();
        assert.equal(EnemyManager.getWorldKnowledgeMap(), null);
    });

    it('getSharedThreatMap() returns null before any executeTurn call', () => {
        EnemyManager.reset();
        assert.equal(EnemyManager.getSharedThreatMap(), null);
    });

    it('getSharedThreatMap() returns null after reset', () => {
        EnemyManager._sharedThreatMap = new Map([['0,0', 3]]);
        EnemyManager.reset();
        assert.equal(EnemyManager.getSharedThreatMap(), null);
    });

    it('getSharedThreatMap() reflects the stored _sharedThreatMap', () => {
        EnemyManager.reset();
        const mockMap = new Map([['2,3', 3], ['4,5', 4]]);
        EnemyManager._sharedThreatMap = mockMap;
        assert.equal(EnemyManager.getSharedThreatMap(), mockMap);
    });
});
