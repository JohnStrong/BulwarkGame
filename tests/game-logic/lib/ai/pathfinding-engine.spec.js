/**
 * pathfinding-engine.spec.js — spec-style tests for PathfindingEngine.
 *
 * Complements pathfinding-engine.test.js by adding coverage for:
 *   - findPath end-to-end scenarios
 *   - MinHeap correctness
 *   - reconstructPath
 *   - buildSharedThreatMap zone overlay penalties (step 4)
 *   - COMBAT_COST / THREAT_WATER_COST constants
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/ai/pathfinding-engine.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const PE = require('../../../../js/game-logic/lib/ai/pathfinding-engine.js');

const {
    buildTileGraph,
    tileKey,
    hexNeighbors,
    hexDistance,
    findPath,
    MinHeap,
    reconstructPath,
    buildSharedThreatMap,
    computeEnemyVisibleTiles,
    COMBAT_COST,
    THREAT_WATER_COST,
} = PE;

// ---------------------------------------------------------------------------
// Tile factory helpers
// ---------------------------------------------------------------------------

const grass   = (r, c) => ({ row: r, col: c, sprite: 'grass-short-1' });
const water   = (r, c) => ({ row: r, col: c, sprite: 'water-1' });
const wall    = (r, c) => ({ row: r, col: c, sprite: 'castle-wall-1' });
const keepCtr = (r, c) => ({ row: r, col: c, sprite: 'castle-keep-center' });

function makeGrassGrid(rows, cols) {
    const tiles = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            tiles.push(grass(r, c));
        }
    }
    return tiles;
}

// ---------------------------------------------------------------------------
// COMBAT_COST / THREAT_WATER_COST constants
// ---------------------------------------------------------------------------

describe('PathfindingEngine cost constants', () => {
    it('COMBAT_COST is 3', () => {
        assert.equal(COMBAT_COST, 3);
    });

    it('THREAT_WATER_COST is 4', () => {
        assert.equal(THREAT_WATER_COST, 4);
    });

    it('THREAT_WATER_COST > COMBAT_COST (water near player is costlier than bare combat)', () => {
        assert.ok(THREAT_WATER_COST > COMBAT_COST);
    });
});

// ---------------------------------------------------------------------------
// buildTileGraph
// ---------------------------------------------------------------------------

describe('buildTileGraph', () => {
    it('creates a Map keyed by "row,col"', () => {
        const tiles = [grass(0, 0), grass(0, 1), grass(1, 0)];
        const graph = buildTileGraph(tiles);
        assert.ok(graph instanceof Map);
        assert.equal(graph.size, 3);
        assert.ok(graph.has('0,0'));
        assert.ok(graph.has('0,1'));
        assert.ok(graph.has('1,0'));
    });

    it('later tiles overwrite earlier ones at the same key', () => {
        const tile1 = { row: 0, col: 0, sprite: 'grass-short-1' };
        const tile2 = { row: 0, col: 0, sprite: 'water-1' };
        const graph = buildTileGraph([tile1, tile2]);
        assert.equal(graph.get('0,0'), tile2);
    });

    it('stores the exact tile object reference', () => {
        const t = grass(3, 7);
        const graph = buildTileGraph([t]);
        assert.equal(graph.get('3,7'), t);
    });

    it('empty input returns empty Map', () => {
        const graph = buildTileGraph([]);
        assert.equal(graph.size, 0);
    });
});

// ---------------------------------------------------------------------------
// tileKey
// ---------------------------------------------------------------------------

describe('tileKey', () => {
    it('returns "row,col" string', () => {
        assert.equal(tileKey(0, 0), '0,0');
        assert.equal(tileKey(5, 3), '5,3');
        assert.equal(tileKey(10, 20), '10,20');
    });

    it('matches the key format used by buildTileGraph', () => {
        const t = grass(4, 9);
        const graph = buildTileGraph([t]);
        assert.ok(graph.has(tileKey(4, 9)));
    });
});

// ---------------------------------------------------------------------------
// MinHeap
// ---------------------------------------------------------------------------

describe('MinHeap — basic operations', () => {
    it('isEmpty() returns true for empty heap', () => {
        const h = new MinHeap();
        assert.equal(h.isEmpty(), true);
    });

    it('isEmpty() returns false after push', () => {
        const h = new MinHeap();
        h.push({ f: 1 });
        assert.equal(h.isEmpty(), false);
    });

    it('pop() returns the only item from a single-item heap', () => {
        const h = new MinHeap();
        const item = { f: 5, row: 1, col: 2 };
        h.push(item);
        assert.equal(h.pop(), item);
        assert.equal(h.isEmpty(), true);
    });

    it('pop() returns items in ascending f-score order', () => {
        const h = new MinHeap();
        h.push({ f: 10 });
        h.push({ f: 2 });
        h.push({ f: 7 });
        h.push({ f: 1 });
        h.push({ f: 4 });

        const order = [];
        while (!h.isEmpty()) {
            order.push(h.pop().f);
        }
        assert.deepEqual(order, [1, 2, 4, 7, 10]);
    });

    it('handles duplicate f-scores without losing items', () => {
        const h = new MinHeap();
        for (let i = 0; i < 5; i++) {
            h.push({ f: 3, id: i });
        }
        let count = 0;
        while (!h.isEmpty()) {
            h.pop();
            count++;
        }
        assert.equal(count, 5);
    });

    it('single item: push then pop leaves heap empty', () => {
        const h = new MinHeap();
        h.push({ f: 0 });
        h.pop();
        assert.equal(h.isEmpty(), true);
    });

    it('heap invariant: first item always has the smallest f-score', () => {
        const h = new MinHeap();
        const values = [15, 3, 8, 1, 6, 12, 4];
        for (const v of values) h.push({ f: v });

        let prev = -Infinity;
        while (!h.isEmpty()) {
            const { f } = h.pop();
            assert.ok(f >= prev, `f-score ${f} should be >= previous ${prev}`);
            prev = f;
        }
    });
});

// ---------------------------------------------------------------------------
// reconstructPath
// ---------------------------------------------------------------------------

describe('reconstructPath', () => {
    it('returns empty array when start equals goal', () => {
        const parent = new Map();
        const path = reconstructPath(parent, '0,0', '0,0');
        assert.deepEqual(path, []);
    });

    it('reconstructs a two-node path', () => {
        const parent = new Map([['1,0', '0,0']]);
        const path = reconstructPath(parent, '1,0', '0,0');
        assert.deepEqual(path, [{ row: 1, col: 0 }]);
    });

    it('reconstructs a three-node path in correct order', () => {
        const parent = new Map([
            ['1,0', '0,0'],
            ['2,0', '1,0'],
        ]);
        const path = reconstructPath(parent, '2,0', '0,0');
        assert.deepEqual(path, [
            { row: 1, col: 0 },
            { row: 2, col: 0 },
        ]);
    });

    it('excludes the start tile, includes the goal tile', () => {
        const parent = new Map([
            ['0,1', '0,0'],
            ['0,2', '0,1'],
            ['0,3', '0,2'],
        ]);
        const path = reconstructPath(parent, '0,3', '0,0');
        const keys = path.map(p => `${p.row},${p.col}`);
        assert.ok(!keys.includes('0,0'), 'start tile must not be in path');
        assert.ok(keys.includes('0,3'), 'goal tile must be in path');
        assert.deepEqual(keys[0], '0,1', 'first step should be the tile after start');
    });
});

// ---------------------------------------------------------------------------
// findPath — end-to-end scenarios
// ---------------------------------------------------------------------------

describe('findPath — basic scenarios', () => {
    it('returns empty array when targetSet is empty', () => {
        const tiles = makeGrassGrid(5, 5);
        const graph = buildTileGraph(tiles);
        const path = findPath('Infantry', 4, 4, [], graph, null);
        assert.deepEqual(path, []);
    });

    it('returns empty array when already at target', () => {
        const tiles = makeGrassGrid(5, 5);
        const graph = buildTileGraph(tiles);
        const target = [{ row: 2, col: 2 }];
        const path = findPath('Infantry', 2, 2, target, graph, null);
        assert.deepEqual(path, []);
    });

    it('finds a direct single-step path to an adjacent tile', () => {
        const tiles = makeGrassGrid(5, 5);
        const graph = buildTileGraph(tiles);
        const target = [{ row: 2, col: 3 }];
        const path = findPath('Infantry', 2, 2, target, graph, null);
        assert.equal(path.length, 1);
        assert.deepEqual(path[0], { row: 2, col: 3 });
    });

    it('returns empty array when target is surrounded by walls (unreachable)', () => {
        const tiles = [
            grass(0, 0), grass(0, 2),
            wall(1, 0), wall(1, 1), wall(1, 2),
            grass(2, 0), grass(2, 1), grass(2, 2),
        ];
        const graph = buildTileGraph(tiles);
        const target = [{ row: 0, col: 1 }]; // walled off on south side, no tile at (0,1)
        const path = findPath('Infantry', 2, 1, target, graph, null);
        // (0,1) is not in the graph so it can't be reached
        assert.deepEqual(path, []);
    });

    it('routes around a wall obstacle', () => {
        // Row 0: grass(0,0) — target
        // Row 1: wall(1,0), grass(1,1)
        // Row 2: grass(2,0), grass(2,1) — start at (2,0)
        const tiles = [
            grass(0, 0), grass(0, 1),
            wall(1, 0), grass(1, 1),
            grass(2, 0), grass(2, 1),
        ];
        const graph = buildTileGraph(tiles);
        const path = findPath('Infantry', 2, 0, [{ row: 0, col: 0 }], graph, null);

        // Path must not go through the wall at (1,0)
        for (const step of path) {
            const tile = graph.get(tileKey(step.row, step.col));
            const ch = PE.resolveTileChar(tile);
            assert.notEqual(ch, 'W', `Path step (${step.row},${step.col}) must not be a wall`);
        }
    });

    it('path first step is the immediate next tile (not the start)', () => {
        const tiles = makeGrassGrid(5, 5);
        const graph = buildTileGraph(tiles);
        const path = findPath('Infantry', 4, 4, [{ row: 0, col: 0 }], graph, null);
        assert.ok(path.length > 0, 'A path should exist on open terrain');
        // First step must be adjacent to (4,4)
        const neighbours = hexNeighbors(4, 4).map(n => `${n.row},${n.col}`);
        const firstStepKey = `${path[0].row},${path[0].col}`;
        assert.ok(neighbours.includes(firstStepKey),
            `First path step (${firstStepKey}) must be adjacent to start (4,4)`);
    });

    it('Cavalry can traverse tree tiles; Infantry cannot', () => {
        const oakTile = { row: 1, col: 0, sprite: 'grass-short-1', overlay: 'tree-oak-overlay-1' };
        const tiles = [
            grass(0, 0),
            oakTile,
            grass(2, 0),
        ];
        const graph = buildTileGraph(tiles);
        const target = [{ row: 0, col: 0 }];

        // Cavalry can use the oak tile
        const cavalryPath = findPath('Cavalry', 2, 0, target, graph, null);
        assert.ok(cavalryPath.length > 0, 'Cavalry should find a path through the oak tile');

        // Infantry cannot pass through it — only a path that avoids row 1, col 0 is valid
        // With no other route, Infantry path will be empty
        const infantryPath = findPath('Infantry', 2, 0, target, graph, null);
        // Infantry path should either be empty or not pass through the oak tile
        for (const step of infantryPath) {
            assert.ok(!(step.row === 1 && step.col === 0),
                'Infantry path must not pass through an oak tree tile');
        }
    });

    it('uses dynamic cost overlay to prefer cheaper routes', () => {
        // Row 0: target grass(0,2)
        // Row 1: grass(1,1) with high overlay cost, grass(1,2) with no overlay
        // Row 2: start at grass(2,2)
        const tiles = [
            grass(0, 1), grass(0, 2),
            grass(1, 1), grass(1, 2),
            grass(2, 1), grass(2, 2),
        ];
        const graph = buildTileGraph(tiles);
        // Penalise the direct route step
        const overlay = new Map([['1,2', 100]]); // huge penalty on the direct route
        const target = [{ row: 0, col: 2 }];

        const pathWithOverlay = findPath('Infantry', 2, 2, target, graph, overlay);
        const pathNoOverlay   = findPath('Infantry', 2, 2, target, graph, null);

        // Both should find a path
        assert.ok(pathWithOverlay.length > 0);
        assert.ok(pathNoOverlay.length > 0);
        // With the huge overlay cost, the path should NOT go through (1,2)
        const withOverlayKeys = pathWithOverlay.map(s => `${s.row},${s.col}`);
        assert.ok(!withOverlayKeys.includes('1,2'),
            'Path with high overlay cost should avoid the penalised tile');
    });

    it('multiple targets: picks the nearest one', () => {
        const tiles = makeGrassGrid(10, 10);
        const graph = buildTileGraph(tiles);
        // Two targets at different distances from (5,5)
        const near  = { row: 5, col: 6 };  // 1 step away
        const far   = { row: 0, col: 0 };  // many steps away
        const path = findPath('Infantry', 5, 5, [near, far], graph, null);
        // Path should lead to the nearer target
        assert.equal(path.length, 1);
        assert.deepEqual(path[0], near);
    });
});

describe('findPath — SiegeEngine (movePts=1, slowest)', () => {
    it('SiegeEngine finds a path on open terrain', () => {
        const tiles = makeGrassGrid(5, 5);
        const graph = buildTileGraph(tiles);
        const path = findPath('SiegeEngine', 4, 4, [{ row: 0, col: 0 }], graph, null);
        assert.ok(path.length > 0, 'SiegeEngine should find a path on open terrain');
    });
});

// ---------------------------------------------------------------------------
// buildSharedThreatMap — zone overlay penalties (step 4)
// ---------------------------------------------------------------------------

describe('buildSharedThreatMap — zone overlay penalties', () => {
    it('returns empty Map when all inputs are null/empty', () => {
        const graph = buildTileGraph(makeGrassGrid(5, 5));
        const result = buildSharedThreatMap(null, null, graph, null);
        assert.ok(result instanceof Map);
        assert.equal(result.size, 0);
    });

    it('applies zone overlay penalties additively on top of base cost', () => {
        const tiles = makeGrassGrid(5, 5);
        const graph = buildTileGraph(tiles);
        const zonePenalties = new Map([['2,2', 5]]);

        // Empty registry and enemies — only zone penalties
        const result = buildSharedThreatMap(new Map(), [], graph, zonePenalties);
        assert.ok(result.has('2,2'), 'Zone penalty tile should be in overlay');
        assert.equal(result.get('2,2'), 5, 'Zone penalty should be 5');
    });

    it('zone penalty stacks on top of existing combat cost', () => {
        const tiles = makeGrassGrid(5, 5);
        const graph = buildTileGraph(tiles);

        // Simulate a player unit sighting at (2,2) → COMBAT_COST = 3
        const registry = new Map([
            ['pu-1', { row: 2, col: 2, turn: 1, health: 10 }],
        ]);
        const zonePenalties = new Map([['2,2', 5]]);

        const result = buildSharedThreatMap(registry, [], graph, zonePenalties);
        // Combat cost 3 is set first; then zone penalty +5 → expected 3+5 = 8
        assert.equal(result.get('2,2'), 8,
            'Zone penalty should stack on top of combat cost (3 + 5 = 8)');
    });

    it('zone penalties do not override Infinity base cost (walls remain walls)', () => {
        const tiles = [
            grass(0, 0), wall(1, 0), grass(2, 0),
        ];
        const graph = buildTileGraph(tiles);
        const zonePenalties = new Map([['1,0', 5]]);

        const result = buildSharedThreatMap(new Map(), [], graph, zonePenalties);
        // Wall tile (1,0) should NOT appear in overlay because base cost is Infinity
        assert.ok(!result.has('1,0'),
            'Zone penalty must not be applied to impassable (Infinity) tiles');
    });

    it('null zoneOverlayPenalties treated as empty (no crash)', () => {
        const tiles = makeGrassGrid(3, 3);
        const graph = buildTileGraph(tiles);
        assert.doesNotThrow(
            () => buildSharedThreatMap(new Map(), [], graph, null)
        );
    });

    it('combat cost (step 1) sets COMBAT_COST for each registry entry position', () => {
        const tiles = makeGrassGrid(5, 5);
        const graph = buildTileGraph(tiles);
        const registry = new Map([
            ['u1', { row: 1, col: 1, turn: 1, health: 25 }],
            ['u2', { row: 3, col: 3, turn: 1, health: 30 }],
        ]);

        const result = buildSharedThreatMap(registry, [], graph, null);
        assert.equal(result.get('1,1'), COMBAT_COST, 'Position of u1 should have COMBAT_COST');
        assert.equal(result.get('3,3'), COMBAT_COST, 'Position of u2 should have COMBAT_COST');
    });
});

// ---------------------------------------------------------------------------
// computeEnemyVisibleTiles — supplementary specs
// ---------------------------------------------------------------------------

describe('computeEnemyVisibleTiles — supplementary', () => {
    it('returns a Set', () => {
        const graph = buildTileGraph(makeGrassGrid(10, 10));
        const result = computeEnemyVisibleTiles(5, 5, graph);
        assert.ok(result instanceof Set);
    });

    it('all returned tiles are objects with row, col, and sprite', () => {
        const graph = buildTileGraph(makeGrassGrid(10, 10));
        const visible = computeEnemyVisibleTiles(5, 5, graph);
        for (const tile of visible) {
            assert.ok(tile !== null && tile !== undefined);
            assert.ok(typeof tile.row === 'number');
            assert.ok(typeof tile.col === 'number');
            assert.ok(typeof tile.sprite === 'string');
        }
    });

    it('unit on open grid sees tiles at distance 1, 2, and 3', () => {
        const graph = buildTileGraph(makeGrassGrid(15, 15));
        const visible = computeEnemyVisibleTiles(7, 7, graph);
        const distances = new Set([...visible].map(t => hexDistance(7, 7, t.row, t.col)));
        assert.ok(distances.has(1), 'Should see tiles at distance 1');
        assert.ok(distances.has(2), 'Should see tiles at distance 2');
        assert.ok(distances.has(3), 'Should see tiles at distance 3');
    });

    it('no tile at distance > 3 on open terrain', () => {
        const graph = buildTileGraph(makeGrassGrid(20, 20));
        const visible = computeEnemyVisibleTiles(10, 10, graph);
        for (const tile of visible) {
            const d = hexDistance(10, 10, tile.row, tile.col);
            assert.ok(d <= 3,
                `No tile beyond distance 3 should be visible (got distance ${d})`);
        }
    });
});

// ---------------------------------------------------------------------------
// hexDistance — additional invariants
// ---------------------------------------------------------------------------

describe('hexDistance — additional invariants', () => {
    it('distance from origin (0,0) to (0,3) is 3 (same row)', () => {
        assert.equal(hexDistance(0, 0, 0, 3), 3);
    });

    it('distance is always a non-negative integer', () => {
        const pairs = [
            [0, 0, 5, 5],
            [3, 7, 0, 0],
            [10, 10, 10, 10],
            [1, 0, 0, 1],
        ];
        for (const [r1, c1, r2, c2] of pairs) {
            const d = hexDistance(r1, c1, r2, c2);
            assert.ok(Number.isInteger(d), `Expected integer distance, got ${d}`);
            assert.ok(d >= 0, `Expected non-negative distance, got ${d}`);
        }
    });
});
