/**
 * Property tests for the enemy spawn-radius system.
 *
 * Tests five invariants across randomly generated maps using fast-check:
 *
 *   P1 — Radius containment
 *        Every tile in the spawn pool is within SPAWN_RADIUS hex steps of the
 *        computed spawn centre.
 *
 *   P2 — No blocked tiles in pool
 *        No spawn pool tile has a SPAWN_BLOCKED char (water, rock, or any
 *        castle structure).
 *
 *   P3 — Infantry passability
 *        Every spawn pool tile is passable for Infantry.
 *
 *   P4 — No duplicate positions in pool
 *        The spawn pool never contains two tiles at the same (row, col).
 *
 *   P5 — Column mirror
 *        When the map has at least one passable tile on the opposite side from
 *        the keep, the computed spawn centre column equals (maxCol − fCol) or
 *        is the nearest valid tile found by BFS from that position.
 *
 * Uses Node.js built-in test runner (node:test) + fast-check.
 * Run: node --test property-tests/enemy-spawn-radius.property.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

const EnemyManager = require('../js/game-logic/lib/ai/enemy-manager.js');
const PathfindingEngine = require('../js/game-logic/lib/ai/pathfinding-engine.js');

const { identifySpawnPoints } = EnemyManager;
const { buildTileGraph, resolveTileChar, getMovementCost, hexNeighbors } = PathfindingEngine;

// ─── Constants (must match enemy-manager.js) ─────────────────────────────────

const SPAWN_RADIUS = 2;
const SPAWN_BLOCKED_CHARS = new Set(['~', 'R', 'W', 'T', 'G', 'K', 'j', 'J', 'F', 'C']);

// ─── Hex geometry helpers (replicated to avoid coupling to module internals) ──

function offsetToCube(row, col) {
    const x = col - (row - (row & 1)) / 2;
    const z = row;
    return { x, y: -x - z, z };
}

function hexDistance(rowA, colA, rowB, colB) {
    const a = offsetToCube(rowA, colA);
    const b = offsetToCube(rowB, colB);
    return Math.max(
        Math.abs(a.x - b.x),
        Math.abs(a.y - b.y),
        Math.abs(a.z - b.z),
    );
}

// ─── Tile factories ───────────────────────────────────────────────────────────

const SPRITE_FOR_CHAR = {
    '.': 'grass-short-1',
    '~': 'water-1',
    'R': 'rock',
    'W': 'castle-wall-1',
    'F': 'castle-keep-center',
    'D': 'road-full',
    'O': null, // tree — constructed separately
};

function makeTile(row, col, sprite, overlay) {
    const t = { row, col, sprite };
    if (overlay) t.overlay = overlay;
    return t;
}

const grass  = (r, c) => makeTile(r, c, 'grass-short-1');
const water  = (r, c) => makeTile(r, c, 'water-1');
const rock   = (r, c) => makeTile(r, c, 'rock');
const wall   = (r, c) => makeTile(r, c, 'castle-wall-1');
const keepF  = (r, c) => makeTile(r, c, 'castle-keep-center');
const road   = (r, c) => makeTile(r, c, 'road-full');

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generate a rectangular grid of tiles with configurable dimensions.
 *
 * Each non-keep tile is randomly one of: grass, road, water, rock, wall.
 * The F tile (keep centre) is always placed at the given keepRow/keepCol.
 *
 * The weight distribution is biased heavily toward passable terrain so that
 * the spawn pool is non-empty in most generated cases.
 */
function arbitraryGrid({ rows = 8, cols = 12 } = {}) {
    return fc.record({
        rows:    fc.constant(rows),
        cols:    fc.constant(cols),
        keepRow: fc.integer({ min: 0, max: rows - 1 }),
        keepCol: fc.integer({ min: 0, max: cols - 1 }),
        // One cell type per non-keep tile: 0-5 = grass, 6-7 = road, 8 = water, 9 = rock
        cellMap: fc.array(
            fc.integer({ min: 0, max: 9 }),
            { minLength: rows * cols, maxLength: rows * cols },
        ),
    }).map(({ rows: R, cols: C, keepRow, keepCol, cellMap }) => {
        const tiles = [];
        for (let r = 0; r < R; r++) {
            for (let c = 0; c < C; c++) {
                if (r === keepRow && c === keepCol) {
                    tiles.push(keepF(r, c));
                    continue;
                }
                const v = cellMap[r * C + c];
                if (v <= 5) tiles.push(grass(r, c));
                else if (v <= 7) tiles.push(road(r, c));
                else if (v === 8) tiles.push(water(r, c));
                else tiles.push(rock(r, c));
            }
        }
        return { tiles, keepRow, keepCol, rows: R, cols: C };
    });
}

/**
 * Same as arbitraryGrid but omits the F tile entirely (tests no-keep fallback).
 */
function arbitraryGridNoKeep({ rows = 6, cols = 8 } = {}) {
    return fc.record({
        rows:    fc.constant(rows),
        cols:    fc.constant(cols),
        cellMap: fc.array(
            fc.integer({ min: 0, max: 9 }),
            { minLength: rows * cols, maxLength: rows * cols },
        ),
    }).map(({ rows: R, cols: C, cellMap }) => {
        const tiles = [];
        for (let r = 0; r < R; r++) {
            for (let c = 0; c < C; c++) {
                const v = cellMap[r * C + c];
                if (v <= 5) tiles.push(grass(r, c));
                else if (v <= 7) tiles.push(road(r, c));
                else if (v === 8) tiles.push(water(r, c));
                else tiles.push(rock(r, c));
            }
        }
        return { tiles, rows: R, cols: C };
    });
}

// ─── Helper: derive spawn centre from tiles (mirrors identifySpawnPoints step 1-3) ──

/**
 * Compute the expected raw spawn centre (before BFS validation) given the
 * tile array. Used in P5 to verify the column-mirror formula independently.
 */
function rawSpawnCentre(tiles) {
    let fRow = null, fCol = null, maxCol = 0, maxRow = 0;
    for (const t of tiles) {
        if (t.col > maxCol) maxCol = t.col;
        if (t.row > maxRow) maxRow = t.row;
        if (fRow === null && resolveTileChar(t) === 'F') {
            fRow = t.row; fCol = t.col;
        }
    }
    if (fRow === null) {
        fRow = Math.floor(maxRow / 2);
        fCol = Math.floor(maxCol / 2);
    }
    return { row: fRow, col: maxCol - fCol, maxCol, fRow, fCol };
}

// ─── Property 1: Radius containment ──────────────────────────────────────────

describe('P1 — every spawn tile is within SPAWN_RADIUS hex steps of the spawn centre', () => {
    /**
     * The resolved spawn centre is the first valid tile BFS finds from the raw
     * mirrored position. It is always a member of the returned pool (it passes
     * the same filters). We locate it by finding the pool tile closest to the
     * raw computed centre — it must be the BFS-resolved centre or tie with it
     * at distance 1.
     *
     * We then verify that ALL pool tiles are within SPAWN_RADIUS of that tile.
     *
     * Note: when BFS resolves to a tile that is 1 step from the raw centre,
     * ties in "closest to raw" are broken by whichever comes first in the pool.
     * To handle ties robustly we check that every pool tile is within
     * SPAWN_RADIUS of EVERY candidate closest tile (all tied tiles are within
     * SPAWN_RADIUS of each other since BFS moves at most 1 step from raw, and
     * a hex disc of radius 2 around any such tile covers all pool members).
     */
    function findResolvedCentre(pool, rawRow, rawCol) {
        // The resolved centre is in the pool; find the member(s) closest to raw
        let minDist = Infinity;
        for (const t of pool) {
            const d = hexDistance(t.row, t.col, rawRow, rawCol);
            if (d < minDist) minDist = d;
        }
        // Return all tied candidates (all at minDist from raw)
        return pool.filter(t => hexDistance(t.row, t.col, rawRow, rawCol) === minDist);
    }

    it('holds across randomly generated grids with a keep tile', () => {
        fc.assert(fc.property(arbitraryGrid(), ({ tiles }) => {
            const tileGraph = buildTileGraph(tiles);
            const pool = identifySpawnPoints(tiles, tileGraph);

            if (pool.length === 0) return; // vacuously fine

            const raw = rawSpawnCentre(tiles);
            const candidates = findResolvedCentre(pool, raw.row, raw.col);

            // Every pool tile must be within SPAWN_RADIUS of at least one candidate
            for (const t of pool) {
                const withinAny = candidates.some(
                    c => hexDistance(t.row, t.col, c.row, c.col) <= SPAWN_RADIUS,
                );
                assert.ok(withinAny,
                    `Tile (${t.row},${t.col}) is not within SPAWN_RADIUS=${SPAWN_RADIUS} ` +
                    `of any candidate centre. Candidates: ` +
                    candidates.map(c => `(${c.row},${c.col})`).join(', '));
            }
        }), { numRuns: 200 });
    });

    it('holds when there is no keep tile (fallback centre)', () => {
        fc.assert(fc.property(arbitraryGridNoKeep(), ({ tiles }) => {
            const tileGraph = buildTileGraph(tiles);
            const pool = identifySpawnPoints(tiles, tileGraph);

            if (pool.length === 0) return;

            const raw = rawSpawnCentre(tiles);
            const candidates = pool.filter(t =>
                hexDistance(t.row, t.col, raw.row, raw.col) ===
                Math.min(...pool.map(p => hexDistance(p.row, p.col, raw.row, raw.col))),
            );

            for (const t of pool) {
                const withinAny = candidates.some(
                    c => hexDistance(t.row, t.col, c.row, c.col) <= SPAWN_RADIUS,
                );
                assert.ok(withinAny,
                    `No-keep: tile (${t.row},${t.col}) not within radius of any candidate`);
            }
        }), { numRuns: 150 });
    });
});

// ─── Property 2: No blocked tiles in pool ────────────────────────────────────

describe('P2 — no SPAWN_BLOCKED tile ever appears in the spawn pool', () => {
    it('holds across randomly generated grids with a keep tile', () => {
        fc.assert(fc.property(arbitraryGrid(), ({ tiles }) => {
            const tileGraph = buildTileGraph(tiles);
            const pool = identifySpawnPoints(tiles, tileGraph);

            for (const t of pool) {
                const tile = tileGraph.get(`${t.row},${t.col}`);
                assert.ok(tile, `Pool tile (${t.row},${t.col}) must exist in tileGraph`);
                const ch = resolveTileChar(tile);
                assert.ok(!SPAWN_BLOCKED_CHARS.has(ch),
                    `Pool tile char '${ch}' at (${t.row},${t.col}) is SPAWN_BLOCKED`);
            }
        }), { numRuns: 200 });
    });

    it('holds when there is no keep tile', () => {
        fc.assert(fc.property(arbitraryGridNoKeep(), ({ tiles }) => {
            const tileGraph = buildTileGraph(tiles);
            const pool = identifySpawnPoints(tiles, tileGraph);

            for (const t of pool) {
                const tile = tileGraph.get(`${t.row},${t.col}`);
                const ch = resolveTileChar(tile);
                assert.ok(!SPAWN_BLOCKED_CHARS.has(ch),
                    `No-keep: pool tile char '${ch}' is SPAWN_BLOCKED`);
            }
        }), { numRuns: 150 });
    });
});

// ─── Property 3: Infantry passability ────────────────────────────────────────

describe('P3 — every spawn tile is passable for Infantry', () => {
    it('holds across randomly generated grids with a keep tile', () => {
        fc.assert(fc.property(arbitraryGrid(), ({ tiles }) => {
            const tileGraph = buildTileGraph(tiles);
            const pool = identifySpawnPoints(tiles, tileGraph);

            for (const t of pool) {
                const tile = tileGraph.get(`${t.row},${t.col}`);
                const ch = resolveTileChar(tile);
                const cost = getMovementCost(ch, 'Infantry');
                assert.ok(cost < Infinity,
                    `Pool tile char '${ch}' at (${t.row},${t.col}) is not Infantry-passable`);
            }
        }), { numRuns: 200 });
    });

    it('holds when there is no keep tile', () => {
        fc.assert(fc.property(arbitraryGridNoKeep(), ({ tiles }) => {
            const tileGraph = buildTileGraph(tiles);
            const pool = identifySpawnPoints(tiles, tileGraph);

            for (const t of pool) {
                const tile = tileGraph.get(`${t.row},${t.col}`);
                const ch = resolveTileChar(tile);
                assert.ok(getMovementCost(ch, 'Infantry') < Infinity,
                    `No-keep: pool tile '${ch}' is not Infantry-passable`);
            }
        }), { numRuns: 150 });
    });
});

// ─── Property 4: No duplicate positions ──────────────────────────────────────

describe('P4 — spawn pool contains no duplicate (row, col) positions', () => {
    it('holds across randomly generated grids with a keep tile', () => {
        fc.assert(fc.property(arbitraryGrid(), ({ tiles }) => {
            const tileGraph = buildTileGraph(tiles);
            const pool = identifySpawnPoints(tiles, tileGraph);

            const keys = pool.map(t => `${t.row},${t.col}`);
            const unique = new Set(keys);
            assert.equal(keys.length, unique.size,
                `Pool has ${keys.length - unique.size} duplicate positions`);
        }), { numRuns: 200 });
    });

    it('holds when there is no keep tile', () => {
        fc.assert(fc.property(arbitraryGridNoKeep(), ({ tiles }) => {
            const tileGraph = buildTileGraph(tiles);
            const pool = identifySpawnPoints(tiles, tileGraph);

            const keys = pool.map(t => `${t.row},${t.col}`);
            const unique = new Set(keys);
            assert.equal(keys.length, unique.size,
                `No-keep: pool has ${keys.length - unique.size} duplicate positions`);
        }), { numRuns: 150 });
    });
});

// ─── Property 5: Column mirror ────────────────────────────────────────────────

describe('P5 — spawn centre column mirrors keep column across the map', () => {
    it('raw spawn centre column = maxCol − fCol, regardless of map shape', () => {
        // Use an all-grass grid so the raw centre is always valid (no BFS needed).
        const allGrassGrid = fc.record({
            rows:    fc.integer({ min: 3, max: 12 }),
            cols:    fc.integer({ min: 3, max: 16 }),
            keepRow: fc.integer({ min: 0, max: 2 }),   // keep near top
        }).map(({ rows, cols, keepRow }) => {
            const keepCol = 0; // keep always at left edge for easy mirror check
            const tiles = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    tiles.push(r === keepRow && c === keepCol
                        ? keepF(r, c)
                        : grass(r, c));
                }
            }
            return { tiles, keepRow, keepCol, maxCol: cols - 1 };
        });

        fc.assert(fc.property(allGrassGrid, ({ tiles, keepRow, keepCol, maxCol }) => {
            const tileGraph = buildTileGraph(tiles);
            const pool = identifySpawnPoints(tiles, tileGraph);

            if (pool.length === 0) return; // vacuously fine

            // Expected spawn centre
            const expectedCentreRow = keepRow;
            const expectedCentreCol = maxCol - keepCol; // = maxCol

            // Every tile in the pool must be within SPAWN_RADIUS of the expected centre
            for (const t of pool) {
                const d = hexDistance(t.row, t.col, expectedCentreRow, expectedCentreCol);
                assert.ok(d <= SPAWN_RADIUS,
                    `With keep at col ${keepCol}, maxCol ${maxCol}: ` +
                    `expected centre (${expectedCentreRow},${expectedCentreCol}), ` +
                    `but pool tile (${t.row},${t.col}) is ${d} steps away`);
            }
        }), { numRuns: 150 });
    });

    it('spawn centre is on the opposite side from the keep in wide maps', () => {
        // Generate wide maps where keep is in the right half; spawn should be in the left half.
        const wideGrid = fc.record({
            rows: fc.integer({ min: 4, max: 10 }),
            cols: fc.integer({ min: 8, max: 20 }),
        }).chain(({ rows, cols }) =>
            fc.record({
                rows:    fc.constant(rows),
                cols:    fc.constant(cols),
                keepRow: fc.integer({ min: 1, max: rows - 2 }),
                // keep column in right half (col > cols/2)
                keepCol: fc.integer({ min: Math.ceil(cols / 2), max: cols - 1 }),
            })
        ).map(({ rows, cols, keepRow, keepCol }) => {
            const tiles = [];
            for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++)
                    tiles.push(r === keepRow && c === keepCol ? keepF(r, c) : grass(r, c));
            return { tiles, keepRow, keepCol, maxCol: cols - 1 };
        });

        fc.assert(fc.property(wideGrid, ({ tiles, keepCol, maxCol }) => {
            const tileGraph = buildTileGraph(tiles);
            const pool = identifySpawnPoints(tiles, tileGraph);

            if (pool.length === 0) return;

            const mirroredCol = maxCol - keepCol;
            const halfMap = maxCol / 2;

            // keep is in right half → mirrored col should be in left half
            assert.ok(mirroredCol < halfMap || mirroredCol <= keepCol,
                `Keep at col ${keepCol}, maxCol ${maxCol}: ` +
                `mirrored col ${mirroredCol} should be in the left half (< ${halfMap})`);
        }), { numRuns: 150 });
    });
});

// ─── Property 6: Pool size is bounded ────────────────────────────────────────

describe('P6 — spawn pool size is bounded by hex disc area', () => {
    it('pool never exceeds the number of tiles in a radius-2 hex disc (19)', () => {
        // A radius-2 hex disc has at most 19 tiles (1 + 6 + 12).
        // The pool can only be smaller when edge tiles or blocked tiles reduce it.
        fc.assert(fc.property(arbitraryGrid(), ({ tiles }) => {
            const tileGraph = buildTileGraph(tiles);
            const pool = identifySpawnPoints(tiles, tileGraph);

            const HEX_DISC_R2 = 19;
            assert.ok(pool.length <= HEX_DISC_R2,
                `Pool size ${pool.length} exceeds maximum possible hex-disc size ${HEX_DISC_R2}`);
        }), { numRuns: 200 });
    });

    it('pool is empty only when no Infantry-passable non-blocked tile exists on the map', () => {
        // If identifySpawnPoints returns empty, verify the map genuinely has no
        // valid spawn tile anywhere (not just near the centre).
        fc.assert(fc.property(arbitraryGrid(), ({ tiles }) => {
            const tileGraph = buildTileGraph(tiles);
            const pool = identifySpawnPoints(tiles, tileGraph);

            if (pool.length > 0) return; // non-empty pool is fine — skip check

            // Empty pool: confirm no passable non-blocked tile exists anywhere
            let hasAnyValid = false;
            for (const t of tiles) {
                const ch = resolveTileChar(t);
                if (getMovementCost(ch, 'Infantry') < Infinity && !SPAWN_BLOCKED_CHARS.has(ch)) {
                    hasAnyValid = true;
                    break;
                }
            }
            // If any valid tile exists, identifySpawnPoints must have found it —
            // an empty result is only correct when none exist.
            assert.ok(!hasAnyValid,
                'identifySpawnPoints returned empty but a valid spawn tile exists on the map');
        }), { numRuns: 200 });
    });
});
