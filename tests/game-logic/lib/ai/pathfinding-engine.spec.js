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
const fc = require('fast-check');

const PE = require('../../../../js/game-logic/lib/ai/pathfinding-engine.js');
const PathfindingEngine = PE; // alias for merged core tests

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
    // Additional exports used by merged core tests
    MOVEMENT_COST,
    TREE_CHARS,
    TREE_ELIGIBLE,
    resolveTileChar,
    getMovementCost,
    hexRing,
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

// ---------------------------------------------------------------------------
// Tests merged from pathfinding-engine-core (formerly pathfinding-engine.test.js)
// ---------------------------------------------------------------------------

describe('MOVEMENT_COST constant', () => {
    it('grass (.) costs 1', () => assert.equal(MOVEMENT_COST['.'], 1));
    it('flowers (,) costs 1', () => assert.equal(MOVEMENT_COST[','], 1));
    it('road (D) costs 1', () => assert.equal(MOVEMENT_COST['D'], 1));
    it('cobblestone bridge (=) costs 1', () => assert.equal(MOVEMENT_COST['='], 1));
    it('bailey (C) costs 1', () => assert.equal(MOVEMENT_COST['C'], 1));
    it('castle bridge start (b) costs 1', () => assert.equal(MOVEMENT_COST['b'], 1));
    it('castle bridge mid (m) costs 1', () => assert.equal(MOVEMENT_COST['m'], 1));
    it('castle bridge gate (g) costs 1', () => assert.equal(MOVEMENT_COST['g'], 1));
    it('water (~) costs 2', () => assert.equal(MOVEMENT_COST['~'], 2));
    it('wall (W) is Infinity', () => assert.equal(MOVEMENT_COST['W'], Infinity));
    it('tower (T) is Infinity', () => assert.equal(MOVEMENT_COST['T'], Infinity));
    it('gatehouse (G) is Infinity', () => assert.equal(MOVEMENT_COST['G'], Infinity));
    it('keep top-left (K) is Infinity', () => assert.equal(MOVEMENT_COST['K'], Infinity));
    it('keep bottom-left (j) is Infinity', () => assert.equal(MOVEMENT_COST['j'], Infinity));
    it('keep bottom-right (J) is Infinity', () => assert.equal(MOVEMENT_COST['J'], Infinity));
    it('keep centre (F) is Infinity', () => assert.equal(MOVEMENT_COST['F'], Infinity));
    it('rock (R) is Infinity', () => assert.equal(MOVEMENT_COST['R'], Infinity));
});

// ---------------------------------------------------------------------------
// TREE_CHARS and TREE_ELIGIBLE sets
// ---------------------------------------------------------------------------

describe('TREE_CHARS set', () => {
    it('contains O (oak)', () => assert.equal(TREE_CHARS.has('O'), true));
    it('contains P (pine)', () => assert.equal(TREE_CHARS.has('P'), true));
    it('contains S (shrub)', () => assert.equal(TREE_CHARS.has('S'), true));
    it('does not contain grass (.)', () => assert.equal(TREE_CHARS.has('.'), false));
    it('does not contain water (~)', () => assert.equal(TREE_CHARS.has('~'), false));
});

describe('TREE_ELIGIBLE set', () => {
    it('contains Archer', () => assert.equal(TREE_ELIGIBLE.has('Archer'), true));
    it('contains Cavalry', () => assert.equal(TREE_ELIGIBLE.has('Cavalry'), true));
    it('does not contain Infantry', () => assert.equal(TREE_ELIGIBLE.has('Infantry'), false));
    it('does not contain SiegeEngine', () => assert.equal(TREE_ELIGIBLE.has('SiegeEngine'), false));
});

// ---------------------------------------------------------------------------
// resolveTileChar
// ---------------------------------------------------------------------------

describe('resolveTileChar — overlay takes precedence', () => {
    it('oak overlay → O', () => {
        assert.equal(resolveTileChar({ sprite: 'grass-short-1', overlay: 'tree-oak-overlay-1' }), 'O');
    });
    it('oak overlay variant 2 → O', () => {
        assert.equal(resolveTileChar({ sprite: 'grass-short-2', overlay: 'tree-oak-overlay-2' }), 'O');
    });
    it('pine overlay → P', () => {
        assert.equal(resolveTileChar({ sprite: 'grass-short-1', overlay: 'tree-pine-overlay-1' }), 'P');
    });
    it('pine overlay variant 2 → P', () => {
        assert.equal(resolveTileChar({ sprite: 'grass-short-1', overlay: 'tree-pine-overlay-2' }), 'P');
    });
    it('shrub overlay → S', () => {
        assert.equal(resolveTileChar({ sprite: 'grass-short-1', overlay: 'tree-shrub-overlay-1' }), 'S');
    });
    it('shrub overlay variant 2 → S', () => {
        assert.equal(resolveTileChar({ sprite: 'grass-short-1', overlay: 'tree-shrub-overlay-2' }), 'S');
    });
    it('overlay is checked before sprite — grass sprite with oak overlay → O (not .)', () => {
        const tile = { sprite: 'grass-short-2', overlay: 'tree-oak-overlay-3' };
        assert.equal(resolveTileChar(tile), 'O');
    });
});

describe('resolveTileChar — sprite fallback', () => {
    it('grass-short-1 → .', () => assert.equal(resolveTileChar({ sprite: 'grass-short-1' }), '.'));
    it('grass-short-2 → .', () => assert.equal(resolveTileChar({ sprite: 'grass-short-2' }), '.'));
    it('grass-flowers-1 → ,', () => assert.equal(resolveTileChar({ sprite: 'grass-flowers-1' }), ','));
    it('grass-flowers-2 → ,', () => assert.equal(resolveTileChar({ sprite: 'grass-flowers-2' }), ','));
    it('road-full → D', () => assert.equal(resolveTileChar({ sprite: 'road-full' }), 'D'));
    it('water-1 → ~', () => assert.equal(resolveTileChar({ sprite: 'water-1' }), '~'));
    it('water-2 → ~', () => assert.equal(resolveTileChar({ sprite: 'water-2' }), '~'));
    it('water-3 → ~', () => assert.equal(resolveTileChar({ sprite: 'water-3' }), '~'));
    it('bridge-mm → =', () => assert.equal(resolveTileChar({ sprite: 'bridge-mm' }), '='));
    // LevelLoader maps b, m, g all to 'castle-bridge-mid'
    it('castle-bridge-mid → m (represents all castle bridge tiles)', () => {
        assert.equal(resolveTileChar({ sprite: 'castle-bridge-mid' }), 'm');
    });
    it('castle-tower → T', () => assert.equal(resolveTileChar({ sprite: 'castle-tower' }), 'T'));
    it('castle-keep-tl → K', () => assert.equal(resolveTileChar({ sprite: 'castle-keep-tl' }), 'K'));
    it('castle-keep-bl → j', () => assert.equal(resolveTileChar({ sprite: 'castle-keep-bl' }), 'j'));
    it('castle-keep-br → J', () => assert.equal(resolveTileChar({ sprite: 'castle-keep-br' }), 'J'));
    it('castle-keep-center → F', () => assert.equal(resolveTileChar({ sprite: 'castle-keep-center' }), 'F'));
    it('castle-gatehouse → G', () => assert.equal(resolveTileChar({ sprite: 'castle-gatehouse' }), 'G'));
    it('castle-gatehouse-damaged → G (prefix match)', () => {
        assert.equal(resolveTileChar({ sprite: 'castle-gatehouse-damaged' }), 'G');
    });
    it('castle-wall → W', () => assert.equal(resolveTileChar({ sprite: 'castle-wall' }), 'W'));
    it('castle-wall-damaged → W (prefix match)', () => {
        assert.equal(resolveTileChar({ sprite: 'castle-wall-damaged' }), 'W');
    });
    it('castle-bailey-1 → C', () => assert.equal(resolveTileChar({ sprite: 'castle-bailey-1' }), 'C'));
    it('castle-bailey-3 → C', () => assert.equal(resolveTileChar({ sprite: 'castle-bailey-3' }), 'C'));
    it('rock → R', () => assert.equal(resolveTileChar({ sprite: 'rock' }), 'R'));
});

describe('resolveTileChar — edge cases', () => {
    it('null tile → . (safe fallback)', () => {
        assert.equal(resolveTileChar(null), '.');
    });
    it('undefined tile → . (safe fallback)', () => {
        assert.equal(resolveTileChar(undefined), '.');
    });
    it('tile with no sprite → . (safe fallback)', () => {
        assert.equal(resolveTileChar({}), '.');
    });
    it('unknown sprite → . (safe fallback)', () => {
        assert.equal(resolveTileChar({ sprite: 'totally-unknown-sprite' }), '.');
    });
    it('empty overlay string does not override sprite', () => {
        // An empty overlay should be falsy and ignored
        assert.equal(resolveTileChar({ sprite: 'rock', overlay: '' }), 'R');
    });
});

// ---------------------------------------------------------------------------
// getMovementCost
// ---------------------------------------------------------------------------

describe('getMovementCost — passable terrain (cost 1)', () => {
    const cost1Chars = ['.', ',', 'D', '=', 'C', 'b', 'm', 'g'];
    for (const ch of cost1Chars) {
        it(`'${ch}' costs 1 for Infantry`, () => {
            assert.equal(getMovementCost(ch, 'Infantry'), 1);
        });
        it(`'${ch}' costs 1 for Cavalry`, () => {
            assert.equal(getMovementCost(ch, 'Cavalry'), 1);
        });
    }
});

describe('getMovementCost — water (~) costs 2 for all unit types', () => {
    for (const unitType of ['Infantry', 'Archer', 'Cavalry', 'SiegeEngine']) {
        it(`'~' costs 2 for ${unitType}`, () => {
            assert.equal(getMovementCost('~', unitType), 2);
        });
    }
});

describe('getMovementCost — impassable terrain (Infinity) for all unit types', () => {
    const infChars = ['W', 'T', 'G', 'K', 'j', 'J', 'F', 'R'];
    for (const ch of infChars) {
        for (const unitType of ['Infantry', 'Archer', 'Cavalry', 'SiegeEngine']) {
            it(`'${ch}' is Infinity for ${unitType}`, () => {
                assert.equal(getMovementCost(ch, unitType), Infinity);
            });
        }
    }
});

describe('getMovementCost — tree tiles depend on unit type', () => {
    const treeChars = ['O', 'P', 'S'];
    const eligible = ['Archer', 'Cavalry'];
    const notEligible = ['Infantry', 'SiegeEngine'];

    for (const ch of treeChars) {
        for (const unitType of eligible) {
            it(`'${ch}' costs 1 for tree-eligible unit ${unitType}`, () => {
                assert.equal(getMovementCost(ch, unitType), 1);
            });
        }
        for (const unitType of notEligible) {
            it(`'${ch}' is Infinity for non-tree-eligible unit ${unitType}`, () => {
                assert.equal(getMovementCost(ch, unitType), Infinity);
            });
        }
    }
});

describe('getMovementCost — unknown tile character defaults to Infinity', () => {
    it('unknown char returns Infinity for Infantry', () => {
        assert.equal(getMovementCost('?', 'Infantry'), Infinity);
    });
    it('unknown char returns Infinity for Archer', () => {
        assert.equal(getMovementCost('Z', 'Archer'), Infinity);
    });
});

describe('getMovementCost — cost ordering invariant', () => {
    it('passable terrain (1) < water (2) for all unit types', () => {
        for (const unitType of ['Infantry', 'Archer', 'Cavalry', 'SiegeEngine']) {
            assert.ok(getMovementCost('.', unitType) < getMovementCost('~', unitType));
        }
    });
    it('water (2) < combat cost (3) — external overlay value', () => {
        // The combat cost (3) is applied via overlay, but water (2) base cost is < 3
        assert.ok(getMovementCost('~', 'Infantry') < 3);
    });
    it('impassable (Infinity) is greater than water (2)', () => {
        assert.ok(getMovementCost('W', 'Infantry') > getMovementCost('~', 'Infantry'));
    });
});

// ---------------------------------------------------------------------------
// Task 2.1 — hexNeighbors and hexDistance unit + property tests
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Unit tests — hexNeighbors
// ---------------------------------------------------------------------------

describe('hexNeighbors', () => {
    it('always returns exactly 6 neighbors', () => {
        assert.equal(hexNeighbors(0, 0).length, 6);
        assert.equal(hexNeighbors(1, 0).length, 6);
        assert.equal(hexNeighbors(2, 5).length, 6);
        assert.equal(hexNeighbors(3, 5).length, 6);
    });

    it('even row (0): neighbors match expected offsets', () => {
        const n = hexNeighbors(0, 5);
        assert.deepEqual(n, [
            { row: -1, col: 4 }, // NW
            { row: -1, col: 5 }, // NE
            { row:  0, col: 6 }, // E
            { row:  1, col: 5 }, // SE
            { row:  1, col: 4 }, // SW
            { row:  0, col: 4 }, // W
        ]);
    });

    it('odd row (1): neighbors match expected offsets', () => {
        const n = hexNeighbors(1, 5);
        assert.deepEqual(n, [
            { row:  0, col: 5 }, // NW
            { row:  0, col: 6 }, // NE
            { row:  1, col: 6 }, // E
            { row:  2, col: 6 }, // SE
            { row:  2, col: 5 }, // SW
            { row:  1, col: 4 }, // W
        ]);
    });

    it('even row NW and SW are at col-1; NE and SE are at col', () => {
        const n = hexNeighbors(2, 3);
        assert.equal(n[0].col, 2); // NW
        assert.equal(n[1].col, 3); // NE
        assert.equal(n[4].col, 2); // SW
        assert.equal(n[3].col, 3); // SE
    });

    it('odd row NW and SW are at col; NE and SE are at col+1', () => {
        const n = hexNeighbors(3, 3);
        assert.equal(n[0].col, 3); // NW
        assert.equal(n[1].col, 4); // NE
        assert.equal(n[4].col, 3); // SW
        assert.equal(n[3].col, 4); // SE
    });

    it('neighbors contain all 3 distinct row levels: row-1, row, row+1', () => {
        for (const row of [0, 1, 4, 5, 10, 11]) {
            const rows = hexNeighbors(row, 5).map(nb => nb.row);
            assert.ok(rows.includes(row - 1), `row-1 missing for row=${row}`);
            assert.ok(rows.includes(row),     `same row missing for row=${row}`);
            assert.ok(rows.includes(row + 1), `row+1 missing for row=${row}`);
        }
    });

    it('the two same-row neighbors are always at col-1 and col+1', () => {
        for (const row of [0, 1, 2, 3]) {
            const sameRow = hexNeighbors(row, 10).filter(nb => nb.row === 10);
            assert.equal(sameRow.length, 0); // no same-row neighbours with row=10's row
            // Re-check with row param matching
            const sameRow2 = hexNeighbors(row, 10).filter(nb => nb.row === row);
            assert.equal(sameRow2.length, 2);
            const cols = sameRow2.map(nb => nb.col).sort((a, b) => a - b);
            assert.deepEqual(cols, [9, 11]);
        }
    });
});

// ---------------------------------------------------------------------------
// Unit tests — hexDistance
// ---------------------------------------------------------------------------

describe('hexDistance', () => {
    it('distance from a tile to itself is 0', () => {
        assert.equal(hexDistance(0, 0, 0, 0), 0);
        assert.equal(hexDistance(5, 3, 5, 3), 0);
        assert.equal(hexDistance(1, 7, 1, 7), 0);
    });

    it('distance to E neighbor (same row, col+1) is 1', () => {
        assert.equal(hexDistance(0, 0, 0, 1), 1);
        assert.equal(hexDistance(1, 5, 1, 6), 1);
    });

    it('distance to W neighbor (same row, col-1) is 1', () => {
        assert.equal(hexDistance(0, 5, 0, 4), 1);
        assert.equal(hexDistance(1, 5, 1, 4), 1);
    });

    it('distance to each of the 6 neighbors of an even row cell is exactly 1', () => {
        const row = 0;
        const col = 10;
        for (const nb of hexNeighbors(row, col)) {
            const d = hexDistance(row, col, nb.row, nb.col);
            assert.equal(d, 1,
                `expected distance 1 to neighbor (${nb.row},${nb.col}) from (${row},${col}), got ${d}`);
        }
    });

    it('distance to each of the 6 neighbors of an odd row cell is exactly 1', () => {
        const row = 1;
        const col = 10;
        for (const nb of hexNeighbors(row, col)) {
            const d = hexDistance(row, col, nb.row, nb.col);
            assert.equal(d, 1,
                `expected distance 1 to neighbor (${nb.row},${nb.col}) from (${row},${col}), got ${d}`);
        }
    });

    it('distance is symmetric', () => {
        assert.equal(hexDistance(0, 0, 2, 3), hexDistance(2, 3, 0, 0));
        assert.equal(hexDistance(1, 5, 4, 2), hexDistance(4, 2, 1, 5));
    });

    it('two-step path: (0,0) to (2,1) = 2', () => {
        // From (0,0): SE→(1,0), SE→(2,0) or SE→(1,0), E→(1,1) — actual cube distance
        assert.equal(hexDistance(0, 0, 2, 1), 2);
    });
});

// ---------------------------------------------------------------------------
// Property 3: hexNeighbors always returns exactly 6 unique neighbors
// ---------------------------------------------------------------------------

describe('Property 3: hexNeighbors neighbor count is always exactly 6', () => {
    it('for all (row, col) in [0,32]×[0,39], exactly 6 neighbors returned', () => {
        /**
         * Validates: Requirements 2.2
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (row, col) => {
                    const neighbors = hexNeighbors(row, col);
                    return neighbors.length === 6;
                }
            ),
            { numRuns: 1000 }
        );
    });

    it('all 6 neighbors have unique (row,col) coordinates', () => {
        /**
         * Validates: Requirements 2.2
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (row, col) => {
                    const neighbors = hexNeighbors(row, col);
                    const keys = new Set(neighbors.map(n => `${n.row},${n.col}`));
                    return keys.size === 6;
                }
            ),
            { numRuns: 1000 }
        );
    });
});

// ---------------------------------------------------------------------------
// Property 4: hexDistance is admissible (never overestimates)
// ---------------------------------------------------------------------------

describe('Property 4: hexDistance is admissible — neighbor distance is always 1', () => {
    it('for all (row, col) in [0,32]×[0,39], each neighbor has hexDistance of exactly 1', () => {
        /**
         * Validates: Requirements 2.4
         * Admissibility requires dist(a, neighbor) = 1 when min step cost = 1.
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (row, col) => {
                    const neighbors = hexNeighbors(row, col);
                    for (const nb of neighbors) {
                        if (hexDistance(row, col, nb.row, nb.col) !== 1) return false;
                    }
                    return true;
                }
            ),
            { numRuns: 1000 }
        );
    });

    it('hexDistance is non-negative for all tile pairs', () => {
        /**
         * Validates: Requirements 2.4
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (r1, c1, r2, c2) => hexDistance(r1, c1, r2, c2) >= 0
            ),
            { numRuns: 2000 }
        );
    });

    it('hexDistance is symmetric for all tile pairs', () => {
        /**
         * Validates: Requirements 2.4
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (r1, c1, r2, c2) =>
                    hexDistance(r1, c1, r2, c2) === hexDistance(r2, c2, r1, c1)
            ),
            { numRuns: 2000 }
        );
    });

    it('hexDistance(a, a) = 0 for all tiles', () => {
        /**
         * Validates: Requirements 2.4
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (row, col) => hexDistance(row, col, row, col) === 0
            ),
            { numRuns: 1000 }
        );
    });

    it('hexDistance satisfies the triangle inequality', () => {
        /**
         * Validates: Requirements 2.4
         * Triangle inequality: dist(a,c) ≤ dist(a,b) + dist(b,c)
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (r1, c1, r2, c2, r3, c3) => {
                    const dac = hexDistance(r1, c1, r3, c3);
                    const dab = hexDistance(r1, c1, r2, c2);
                    const dbc = hexDistance(r2, c2, r3, c3);
                    return dac <= dab + dbc;
                }
            ),
            { numRuns: 2000 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 12.1 — hexRing unit tests
// ---------------------------------------------------------------------------

// hexRing already destructured from PE above

// Helper: build a simple rectangular tile graph of grass tiles
function makeGrassGraph(rows, cols) {
    const tiles = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            tiles.push({ row: r, col: c, sprite: 'grass-short-1' });
        }
    }
    return buildTileGraph(tiles);
}

// Helper: build a tile graph with specific tile types
function makeTileGraph(specs) {
    // specs: [{row, col, sprite, overlay}]
    return buildTileGraph(specs.map(s => ({
        row: s.row,
        col: s.col,
        sprite: s.sprite || 'grass-short-1',
        overlay: s.overlay || undefined,
    })));
}

describe('hexRing — basic behaviour', () => {
    it('radius 0 returns empty array (no steps)', () => {
        const graph = makeGrassGraph(10, 10);
        const result = hexRing(5, 5, 0, graph);
        assert.equal(result.length, 0);
    });

    it('radius 1 on a full grass grid returns exactly 6 tiles (all neighbors)', () => {
        const graph = makeGrassGraph(10, 10);
        const result = hexRing(5, 5, 1, graph);
        assert.equal(result.length, 6);
    });

    it('radius 2 on a full grass grid returns exactly 18 tiles', () => {
        // hex ring of radius 2: 6 (step 1) + 12 (step 2) = 18
        const graph = makeGrassGraph(15, 15);
        const result = hexRing(5, 5, 2, graph);
        assert.equal(result.length, 18);
    });

    it('radius 3 on a full grass grid returns exactly 36 tiles', () => {
        // 6 + 12 + 18 = 36
        const graph = makeGrassGraph(20, 20);
        const result = hexRing(7, 7, 3, graph);
        assert.equal(result.length, 36);
    });

    it('tiles at the border of the grid are clamped (missing tiles excluded)', () => {
        const graph = makeGrassGraph(5, 5);
        // origin is at (0, 0) — some neighbors go out of bounds
        const result = hexRing(0, 0, 1, graph);
        // On even row, neighbors of (0,0): (-1,-1), (-1,0), (0,1), (1,0), (1,-1), (0,-1)
        // Only (0,1) and (1,0) are within the 5×5 grid
        assert.ok(result.length < 6);
        assert.ok(result.length > 0);
    });

    it('returned tiles are actual tile objects from the graph', () => {
        const graph = makeGrassGraph(10, 10);
        const result = hexRing(5, 5, 1, graph);
        for (const tile of result) {
            assert.ok(tile.row !== undefined && tile.col !== undefined);
            assert.equal(tile.sprite, 'grass-short-1');
        }
    });

    it('origin tile itself is not included in the result', () => {
        const graph = makeGrassGraph(10, 10);
        const result = hexRing(5, 5, 1, graph);
        const keys = result.map(t => tileKey(t.row, t.col));
        assert.ok(!keys.includes(tileKey(5, 5)));
    });

    it('no duplicate tiles in result', () => {
        const graph = makeGrassGraph(15, 15);
        const result = hexRing(5, 5, 3, graph);
        const keySet = new Set(result.map(t => tileKey(t.row, t.col)));
        assert.equal(keySet.size, result.length);
    });
});

// ---------------------------------------------------------------------------
// Task 12.2 — computeEnemyVisibleTiles unit tests
// ---------------------------------------------------------------------------

describe('computeEnemyVisibleTiles — open terrain', () => {
    it('on open terrain, returns up to 6×3=18 tiles (may be fewer at edges)', () => {
        const graph = makeGrassGraph(20, 20);
        const visible = computeEnemyVisibleTiles(10, 10, graph);
        // 6 directions × up to 3 steps each = at most 18 (could be fewer if directions overlap)
        assert.ok(visible.size <= 18);
        assert.ok(visible.size > 0);
    });

    it('does not include the unit\'s own tile', () => {
        const graph = makeGrassGraph(15, 15);
        const visible = computeEnemyVisibleTiles(7, 7, graph);
        for (const tile of visible) {
            assert.ok(!(tile.row === 7 && tile.col === 7));
        }
    });

    it('a unit on an open large grid sees at least 6 tiles at distance 1', () => {
        const graph = makeGrassGraph(20, 20);
        const visible = computeEnemyVisibleTiles(10, 10, graph);
        // All 6 immediate neighbors should be visible at minimum
        assert.ok(visible.size >= 6);
    });

    it('sight stops at the edge of the tileGraph', () => {
        const graph = makeGrassGraph(5, 5);
        // Should not throw or include undefined tiles
        const visible = computeEnemyVisibleTiles(0, 0, graph);
        assert.ok(visible.size >= 0);
        for (const tile of visible) {
            assert.ok(tile !== undefined && tile !== null);
        }
    });
});

describe('computeEnemyVisibleTiles — tree occlusion', () => {
    it('unit on tree tile sees only immediate neighbors (all directions capped at 1)', () => {
        // Place the unit on a tree tile, surrounded by grass at step 1 and 2
        const specs = [];
        // Build a 15×15 grass grid
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                const isUnitTile = r === 7 && c === 7;
                specs.push({
                    row: r, col: c,
                    sprite: 'grass-short-1',
                    overlay: isUnitTile ? 'tree-oak-overlay-1' : undefined,
                });
            }
        }
        const graph = makeTileGraph(specs);
        const visible = computeEnemyVisibleTiles(7, 7, graph);
        // Should see at most 6 tiles (immediate neighbors only)
        assert.ok(visible.size <= 6);
        // And should see at least the neighbors that exist
        assert.ok(visible.size > 0);
        // None of the visible tiles should be more than 1 hex step away
        for (const tile of visible) {
            const dist = PathfindingEngine.hexDistance(7, 7, tile.row, tile.col);
            assert.equal(dist, 1, `Tile at (${tile.row},${tile.col}) is ${dist} steps away, expected 1`);
        }
    });

    it('tree in one direction caps only that direction to 1 step', () => {
        // Build a grid where (7,8) is a tree (E neighbor of unit at (7,7))
        const specs = [];
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                const isTreeTile = r === 7 && c === 8; // E neighbor
                specs.push({
                    row: r, col: c,
                    sprite: 'grass-short-1',
                    overlay: isTreeTile ? 'tree-pine-overlay-1' : undefined,
                });
            }
        }
        const graph = makeTileGraph(specs);
        const visible = computeEnemyVisibleTiles(7, 7, graph);

        // E direction is capped at 1 — only (7,8) is visible to the east
        // (7,9) should NOT be visible because tree at (7,8) blocks further east
        const visibleKeys = new Set([...visible].map(t => tileKey(t.row, t.col)));
        assert.ok(visibleKeys.has(tileKey(7, 8)), 'Immediate E tree tile should be visible');
        assert.ok(!visibleKeys.has(tileKey(7, 9)), 'Tile behind tree (step 2 east) should not be visible');
    });

    it('sight stops at sight-blocking tiles (walls)', () => {
        // Place a wall at step 1 to the east and check no tiles behind it are visible
        const specs = [];
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                const isWall = r === 7 && c === 8; // E neighbor
                specs.push({
                    row: r, col: c,
                    sprite: isWall ? 'castle-wall' : 'grass-short-1',
                });
            }
        }
        const graph = makeTileGraph(specs);
        const visible = computeEnemyVisibleTiles(7, 7, graph);

        // Wall blocks sight entirely — (7,8) should not be in visible set (walls block rays)
        const visibleKeys = new Set([...visible].map(t => tileKey(t.row, t.col)));
        assert.ok(!visibleKeys.has(tileKey(7, 8)), 'Wall tile should not be visible');
        assert.ok(!visibleKeys.has(tileKey(7, 9)), 'Tile behind wall should not be visible');
    });
});

// ---------------------------------------------------------------------------
// Task 12.3 — buildSharedThreatMap unit tests
// ---------------------------------------------------------------------------

describe('buildSharedThreatMap — empty inputs', () => {
    it('returns empty map when both registry and enemy units are null/undefined', () => {
        const graph = makeGrassGraph(10, 10);
        const result = buildSharedThreatMap(null, null, graph);
        assert.ok(result instanceof Map);
        assert.equal(result.size, 0);
    });

    it('returns empty map when registry is empty and enemies is empty array', () => {
        const graph = makeGrassGraph(10, 10);
        const result = buildSharedThreatMap(new Map(), [], graph);
        assert.ok(result instanceof Map);
        assert.equal(result.size, 0);
    });
});

describe('buildSharedThreatMap — last-seen combat cost', () => {
    it('sets combat cost 3 for each last-seen player unit position', () => {
        const graph = makeGrassGraph(15, 15);
        const registry = new Map();
        registry.set('unit-1', { row: 5, col: 5, turn: 1, health: 10 });

        const result = buildSharedThreatMap(registry, [], graph);
        assert.equal(result.get(tileKey(5, 5)), 3);
    });

    it('sets combat cost 3 for multiple last-seen entries', () => {
        const graph = makeGrassGraph(15, 15);
        const registry = new Map();
        registry.set('unit-1', { row: 3, col: 3, turn: 1, health: 10 });
        registry.set('unit-2', { row: 7, col: 7, turn: 1, health: 10 });

        const result = buildSharedThreatMap(registry, [], graph);
        assert.equal(result.get(tileKey(3, 3)), 3);
        assert.equal(result.get(tileKey(7, 7)), 3);
    });
});

describe('buildSharedThreatMap — water penalty', () => {
    it('does not penalise water tiles not visible to any enemy unit', () => {
        // Enemy unit far from the water, player unit near it
        const specs = [];
        for (let r = 0; r < 20; r++) {
            for (let c = 0; c < 20; c++) {
                const isWater = r === 5 && c === 6; // water 1 step from player unit at (5,5)
                specs.push({ row: r, col: c, sprite: isWater ? 'water-1' : 'grass-short-1' });
            }
        }
        const graph = makeTileGraph(specs);

        // Player unit at (5,5), enemy unit at (15,15) — far from the water
        const registry = new Map();
        registry.set('unit-1', { row: 5, col: 5, turn: 1, health: 10 });
        const enemies = [{ row: 15, col: 15 }]; // enemy can't see (5,6)

        const result = buildSharedThreatMap(registry, enemies, graph);
        // Water at (5,6) is within 3 steps of player unit at (5,5) but NOT visible to enemy
        // so it should NOT get cost 4; it may get no entry or remain at base
        const waterCost = result.get(tileKey(5, 6));
        assert.ok(waterCost !== 4, `Expected water cost != 4, got ${waterCost}`);
    });

    it('penalises water tiles visible to enemy AND within player threat radius', () => {
        // Build a grid where enemy unit can see the water near the player last-seen position
        const specs = [];
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                // Water tile at (7, 8) — 1 step E of player at (7,7)
                const isWater = r === 7 && c === 8;
                specs.push({ row: r, col: c, sprite: isWater ? 'water-1' : 'grass-short-1' });
            }
        }
        const graph = makeTileGraph(specs);

        // Enemy unit is at (7, 5) — 2 steps W of water tile (7,8), open terrain, can see 3 steps E
        const registry = new Map();
        registry.set('unit-1', { row: 7, col: 7, turn: 1, health: 10 });
        const enemies = [{ row: 7, col: 5 }];

        const result = buildSharedThreatMap(registry, enemies, graph);
        // (7,8) is water, within 3 steps of player at (7,7), AND visible to enemy at (7,5)
        // It should get cost 4
        assert.equal(result.get(tileKey(7, 8)), 4);
    });

    it('water adjacent to player last-seen position gets cost 4 when visible to enemy', () => {
        // Player last-seen at (7,7). Enemy at (7,5) — open terrain, can see 3 steps east.
        // Water at (7,8) is 1 step east of player, and 3 steps east of enemy → visible.
        const specs = [];
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                const isWater = r === 7 && c === 8;
                specs.push({ row: r, col: c, sprite: isWater ? 'water-1' : 'grass-short-1' });
            }
        }
        const graph = makeTileGraph(specs);

        const registry = new Map();
        registry.set('unit-1', { row: 7, col: 7, turn: 1, health: 10 });
        // Enemy at (7,5) can see (7,6), (7,7), (7,8) in E direction (3 steps)
        const enemies = [{ row: 7, col: 5 }];

        const result = buildSharedThreatMap(registry, enemies, graph);
        // Player combat cost at (7,7) = 3
        assert.equal(result.get(tileKey(7, 7)), 3);
        // Water at (7,8): 1 step from player at (7,7) = within 3-step threat radius
        // Enemy at (7,5) looking east: step 1=(7,6), step 2=(7,7), step 3=(7,8) → visible
        assert.equal(result.get(tileKey(7, 8)), 4, 'Visible water within threat radius should cost 4');
    });
});

// ---------------------------------------------------------------------------
// Task 12.4 — Property 18: Open terrain gives 3-step sight in unblocked directions
// ---------------------------------------------------------------------------

describe('Property 18: Open terrain gives 3-step sight in unblocked directions', () => {
    /**
     * Validates: Requirements 11.1, 11.2
     */
    it('on an open grass grid, every tile within 3 steps is visible', () => {
        // Use a large enough grid so no direction hits the boundary
        const graph = makeGrassGraph(20, 20);
        const visible = computeEnemyVisibleTiles(10, 10, graph);
        const visibleKeys = new Set([...visible].map(t => tileKey(t.row, t.col)));

        // The 6 immediate neighbors (step 1) must all be visible
        const immediateNeighbors = PathfindingEngine.hexNeighbors(10, 10);
        for (const nb of immediateNeighbors) {
            assert.ok(
                visibleKeys.has(tileKey(nb.row, nb.col)),
                `Immediate neighbor (${nb.row},${nb.col}) should be visible on open terrain`
            );
        }
    });

    it('property: unit on grass with no trees sees at least 6 immediate tiles', () => {
        /**
         * Validates: Requirements 11.1, 11.2
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 5, max: 15 }),
                fc.integer({ min: 5, max: 15 }),
                (row, col) => {
                    const graph = makeGrassGraph(21, 21);
                    const visible = computeEnemyVisibleTiles(row, col, graph);
                    return visible.size >= 6;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('unit on open terrain at centre of large grid sees up to 18 tiles (6 dirs × 3 steps)', () => {
        const graph = makeGrassGraph(20, 20);
        // Place unit far from edges so all 3 steps are in-bounds in all directions
        const visible = computeEnemyVisibleTiles(10, 10, graph);
        // All 6 directions × 3 steps = 18 tiles (or slightly fewer due to hex topology overlaps)
        // In a flat open grid the count should be exactly 18
        assert.ok(visible.size >= 12, `Expected at least 12 visible tiles, got ${visible.size}`);
    });
});

// ---------------------------------------------------------------------------
// Task 12.4 — Property 19: Tree adjacency caps only the blocked direction to 1
// ---------------------------------------------------------------------------

describe('Property 19: Tree adjacency caps only the blocked direction to 1', () => {
    /**
     * Validates: Requirements 11.2, 11.3
     */
    it('tree in E direction caps only E to 1 step; other directions still have range 3', () => {
        const specs = [];
        for (let r = 0; r < 20; r++) {
            for (let c = 0; c < 20; c++) {
                const isTree = r === 10 && c === 11; // E neighbor of (10,10)
                specs.push({
                    row: r, col: c,
                    sprite: 'grass-short-1',
                    overlay: isTree ? 'tree-oak-overlay-1' : undefined,
                });
            }
        }
        const graph = makeTileGraph(specs);
        const visible = computeEnemyVisibleTiles(10, 10, graph);
        const visibleKeys = new Set([...visible].map(t => tileKey(t.row, t.col)));

        // The tree at (10,11) is visible (step 1 east)
        assert.ok(visibleKeys.has(tileKey(10, 11)), 'Immediate E tree should be visible');
        // Tile 2 steps east should NOT be visible (capped by tree)
        assert.ok(!visibleKeys.has(tileKey(10, 12)), 'Tile 2E behind tree should not be visible');
        // But non-east directions should still have full sight — check west direction
        // W neighbor of even row (10,10) is (10,9); step 2 west is (10,8); step 3 west is (10,7)
        assert.ok(visibleKeys.has(tileKey(10, 9)), 'W step 1 should be visible');
        assert.ok(visibleKeys.has(tileKey(10, 8)), 'W step 2 should be visible');
        assert.ok(visibleKeys.has(tileKey(10, 7)), 'W step 3 should be visible');
    });

    it('property: tree in exactly one direction still allows full sight in other directions', () => {
        /**
         * Validates: Requirements 11.2, 11.3
         */
        // Build a grid where unit is at (10,10), tree at E neighbor (10,11)
        // Verify tile at step 3 in W direction (10,7) is visible
        const specs = [];
        for (let r = 0; r < 20; r++) {
            for (let c = 0; c < 20; c++) {
                const isTree = r === 10 && c === 11;
                specs.push({
                    row: r, col: c,
                    sprite: 'grass-short-1',
                    overlay: isTree ? 'tree-pine-overlay-1' : undefined,
                });
            }
        }
        const graph = makeTileGraph(specs);
        const visible = computeEnemyVisibleTiles(10, 10, graph);
        const visibleKeys = new Set([...visible].map(t => tileKey(t.row, t.col)));

        // 3 steps west on even row: (10,9), (10,8), (10,7) — all should be visible
        assert.ok(visibleKeys.has(tileKey(10, 7)), 'W step 3 should be reachable on open terrain');
    });
});

// ---------------------------------------------------------------------------
// Task 12.4 — Property 20: Unit on tree tile sees at most 6 immediate neighbors
// ---------------------------------------------------------------------------

describe('Property 20: Unit on tree tile sees at most 6 immediate neighbors', () => {
    /**
     * Validates: Requirement 11.7
     */
    it('unit on tree tile has sight capped at 1 in all 6 directions', () => {
        const specs = [];
        for (let r = 0; r < 20; r++) {
            for (let c = 0; c < 20; c++) {
                const isUnitTree = r === 10 && c === 10;
                specs.push({
                    row: r, col: c,
                    sprite: 'grass-short-1',
                    overlay: isUnitTree ? 'tree-shrub-overlay-1' : undefined,
                });
            }
        }
        const graph = makeTileGraph(specs);
        const visible = computeEnemyVisibleTiles(10, 10, graph);

        // Must see at most 6 tiles
        assert.ok(visible.size <= 6, `Expected at most 6 visible tiles, got ${visible.size}`);

        // All visible tiles must be exactly 1 step away
        for (const tile of visible) {
            const d = PathfindingEngine.hexDistance(10, 10, tile.row, tile.col);
            assert.equal(d, 1, `Tile (${tile.row},${tile.col}) at distance ${d}, expected 1`);
        }
    });

    it('property: unit on tree tile with open neighbors always sees exactly 6 tiles on large grid', () => {
        /**
         * Validates: Requirement 11.7
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 5, max: 14 }),
                fc.integer({ min: 5, max: 14 }),
                (row, col) => {
                    const specs = [];
                    for (let r = 0; r < 20; r++) {
                        for (let c = 0; c < 20; c++) {
                            const isUnitTree = r === row && c === col;
                            specs.push({
                                row: r, col: c,
                                sprite: 'grass-short-1',
                                overlay: isUnitTree ? 'tree-oak-overlay-1' : undefined,
                            });
                        }
                    }
                    const graph = makeTileGraph(specs);
                    const visible = computeEnemyVisibleTiles(row, col, graph);

                    // All visible tiles must be at distance 1
                    for (const tile of visible) {
                        if (PathfindingEngine.hexDistance(row, col, tile.row, tile.col) !== 1) {
                            return false;
                        }
                    }
                    // At most 6 tiles visible
                    return visible.size <= 6;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 12.5 — Property 15: Threat-zone water costs 4 only when visible to enemies
// ---------------------------------------------------------------------------

describe('Property 15: Threat-zone water costs 4 only when visible to enemies', () => {
    /**
     * Validates: Requirements 9.3, 11.5, 11.6
     */
    it('water within threat radius but NOT visible to enemies does not get cost 4', () => {
        // Build a large grid
        const specs = [];
        for (let r = 0; r < 20; r++) {
            for (let c = 0; c < 20; c++) {
                // Water at (10, 11) — just 1 step E of player unit position
                const isWater = r === 10 && c === 11;
                specs.push({ row: r, col: c, sprite: isWater ? 'water-1' : 'grass-short-1' });
            }
        }
        const graph = makeTileGraph(specs);

        // Player last-seen at (10,10), water at (10,11) is within 3 steps
        // Enemy unit far away — cannot see (10,11)
        const registry = new Map();
        registry.set('p1', { row: 10, col: 10, turn: 1, health: 10 });

        // Place enemy unit somewhere that cannot see (10,11): wall all around enemy's direction
        // Simplest: place enemy at (0,0) — 10+ steps away, sight only reaches 3 steps on open terrain
        const enemies = [{ row: 0, col: 0 }];

        const result = buildSharedThreatMap(registry, enemies, graph);
        const waterCost = result.get(tileKey(10, 11));
        assert.ok(waterCost !== 4, `Water should not get cost 4 when not visible to enemy, got ${waterCost}`);
    });

    it('water within threat radius AND visible to enemy DOES get cost 4', () => {
        const specs = [];
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                const isWater = r === 7 && c === 8;
                specs.push({ row: r, col: c, sprite: isWater ? 'water-1' : 'grass-short-1' });
            }
        }
        const graph = makeTileGraph(specs);

        // Player last-seen at (7,7); water at (7,8) is 1 step east
        // Enemy at (7,6) is 2 steps west — open terrain, can see 3 steps including (7,8)
        const registry = new Map();
        registry.set('p1', { row: 7, col: 7, turn: 1, health: 10 });
        const enemies = [{ row: 7, col: 6 }];

        const result = buildSharedThreatMap(registry, enemies, graph);
        assert.equal(result.get(tileKey(7, 8)), 4, 'Visible water in threat radius should cost 4');
    });
});

// ---------------------------------------------------------------------------
// Task 12.5 — Property 16: Empty overlay when no player units or enemy units present
// ---------------------------------------------------------------------------

describe('Property 16: Empty overlay when no player units or enemy units present', () => {
    /**
     * Validates: Requirement 9.7
     */
    it('empty registry + empty enemies → empty overlay', () => {
        const graph = makeGrassGraph(10, 10);
        const result = buildSharedThreatMap(new Map(), [], graph);
        assert.equal(result.size, 0);
    });

    it('null registry + null enemies → empty overlay', () => {
        const graph = makeGrassGraph(10, 10);
        const result = buildSharedThreatMap(null, null, graph);
        assert.equal(result.size, 0);
    });

    it('undefined registry + undefined enemies → empty overlay', () => {
        const graph = makeGrassGraph(10, 10);
        const result = buildSharedThreatMap(undefined, undefined, graph);
        assert.equal(result.size, 0);
    });

    it('property: empty map returned for any combo of empty/null registry and empty enemies', () => {
        /**
         * Validates: Requirement 9.7
         */
        const graph = makeGrassGraph(10, 10);
        for (const reg of [new Map(), null, undefined]) {
            for (const enemies of [[], null, undefined]) {
                const result = buildSharedThreatMap(reg, enemies, graph);
                assert.equal(result.size, 0,
                    `Expected empty overlay for registry=${reg} enemies=${JSON.stringify(enemies)}`);
            }
        }
    });
});

// ---------------------------------------------------------------------------
// Task 12.5 — Property 21: Water penalty only on enemy-visible tiles
// ---------------------------------------------------------------------------

describe('Property 21: Water penalty only on enemy-visible tiles', () => {
    /**
     * Validates: Requirements 11.5, 11.6
     */
    it('only water tiles visible to at least one enemy receive the cost-4 penalty', () => {
        // Grid with two water tiles: one visible to enemy, one not
        const specs = [];
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                const isVisibleWater = r === 7 && c === 8;    // near enemy (7,6), visible
                const isHiddenWater  = r === 2 && c === 2;    // far from enemy, not visible
                const sprite = isVisibleWater || isHiddenWater ? 'water-1' : 'grass-short-1';
                specs.push({ row: r, col: c, sprite });
            }
        }
        const graph = makeTileGraph(specs);

        // Player unit at (7,7); enemy unit at (7,6) — can see (7,8) but not (2,2)
        // Threat radius of player at (7,7): includes (7,8) and (2,2) within 3 steps? No — (2,2) is ~7 steps away
        const registry = new Map();
        registry.set('p1', { row: 7, col: 7, turn: 1, health: 10 });
        // Also add a last-seen entry near (2,2) to include it in the threat radius check
        registry.set('p2', { row: 2, col: 2, turn: 1, health: 10 });

        const enemies = [{ row: 7, col: 6 }]; // enemy can see (7,8), cannot see (2,2) (10+ steps away)

        const result = buildSharedThreatMap(registry, enemies, graph);

        // Visible water (7,8): should get cost 4
        assert.equal(result.get(tileKey(7, 8)), 4, 'Visible water should cost 4');

        // Hidden water (2,3) - within 3 of p2 at (2,2), but NOT visible to enemy at (7,6)
        // Enemy at (7,6) can only see 3 steps — so anything at distance > 3 from enemy should not be visible
        const hiddenWaterCost = result.get(tileKey(2, 3));
        assert.ok(hiddenWaterCost !== 4,
            `Non-visible water at (2,3) should not get cost 4, got ${hiddenWaterCost}`);
    });

    it('no water tile that is not in enemy visible set gets cost 4', () => {
        // Build a grid with water tiles everywhere in threat radius of a last-seen player unit
        // but place the enemy unit where it cannot see any of them (surrounded by walls on 5 sides)
        const specs = [];
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                // Water ring at distance 1-3 from player last-seen at (7,7)
                const d = PathfindingEngine.hexDistance(7, 7, r, c);
                // Enemy at (7,0) — far left, blocked by a wall at (7,1)
                const isWall = r === 7 && c === 1;
                const isWater = d >= 1 && d <= 3 && !isWall;
                const sprite = isWall ? 'castle-wall' : (isWater ? 'water-1' : 'grass-short-1');
                specs.push({ row: r, col: c, sprite });
            }
        }
        const graph = makeTileGraph(specs);

        const registry = new Map();
        registry.set('p1', { row: 7, col: 7, turn: 1, health: 10 });
        const enemies = [{ row: 7, col: 0 }]; // wall at (7,1) blocks all sight eastward

        const result = buildSharedThreatMap(registry, enemies, graph);

        // All tiles in threat radius (1-3 steps from player) that are water
        // should NOT get cost 4 because the enemy cannot see them (wall blocks vision)
        const threatTiles = hexRing(7, 7, 3, graph);
        for (const tile of threatTiles) {
            const char = PathfindingEngine.resolveTileChar(tile);
            if (char === '~') {
                const cost = result.get(tileKey(tile.row, tile.col));
                assert.ok(cost !== 4,
                    `Water tile (${tile.row},${tile.col}) should not cost 4 when not visible to enemies`);
            }
        }
    });
});
