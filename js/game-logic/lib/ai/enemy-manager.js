/**
 * EnemyManager — Spawns, tracks, and moves all enemy AI units each turn.
 *
 * Exposed as a browser global: window.EnemyManager
 *
 * This file has NO dependencies on DOM, fetch, or other browser globals — all
 * pure data-structure logic — making it fully unit-testable in Node.js by
 * inlining / re-implementing the small helpers it uses.
 *
 * Depends on: PathfindingEngine (must be loaded first as a browser global or
 * required in Node.js tests).
 */

'use strict';

// ---------------------------------------------------------------------------
// PathfindingEngine dependency resolution
// ---------------------------------------------------------------------------

// In Node.js test environments, PathfindingEngine is required directly.
// In the browser, it is available as window.PathfindingEngine.
let _PE;
if (typeof module !== 'undefined' && module.exports) {
    try {
        _PE = require('./pathfinding-engine.js');
    } catch (_) {
        _PE = null;
    }
}
function getPathfindingEngine() {
    if (_PE) return _PE;
    if (typeof window !== 'undefined' && window.PathfindingEngine) {
        return window.PathfindingEngine;
    }
    throw new Error('PathfindingEngine is not available. Load pathfinding-engine.js first.');
}

// ---------------------------------------------------------------------------
// Unit type definitions
// ---------------------------------------------------------------------------

/**
 * Defines the four enemy unit types with movement points and health.
 *
 * Note on treeEligible: this field is informational only. The authoritative
 * source for tree passability is PathfindingEngine.TREE_ELIGIBLE which is
 * keyed by unit type name (string). Infantry and SiegeEngine are NOT
 * tree-eligible; Archer and Cavalry ARE.
 */
const UNIT_DEFS = {
    Infantry:    { name: 'Infantry',    movePts: 2, health:  30, treeEligible: false },
    Archer:      { name: 'Archer',      movePts: 2, health:  25, treeEligible: true  },
    Cavalry:     { name: 'Cavalry',     movePts: 3, health:  35, treeEligible: true  },
    SiegeEngine: { name: 'SiegeEngine', movePts: 1, health:  60, treeEligible: false },
};

/** @type {string[]} All valid enemy unit type names. */
const UNIT_TYPES = Object.keys(UNIT_DEFS);

/**
 * Factory — create a plain EnemyUnit object.
 *
 * @param {string} type  - One of the UNIT_TYPES keys.
 * @param {number} row
 * @param {number} col
 * @param {string} [id] - Optional stable ID; auto-generated if omitted.
 * @returns {{ type, row, col, id, health, movePts }}
 */
function createUnit(type, row, col, id) {
    const def = UNIT_DEFS[type];
    if (!def) throw new Error(`Unknown unit type: ${type}`);
    return {
        id:            id ?? null,
        type:          type,
        def:           def,
        row:           row,
        col:           col,
        health:        def.health,
        currentHealth: def.health,
        movePts:       def.movePts,
    };
}

// ---------------------------------------------------------------------------
// Castle tile character sets
// ---------------------------------------------------------------------------

/** Characters that are castle structure tiles (impassable terrain). */
const CASTLE_STRUCTURE_CHARS = new Set(['W', 'T', 'G', 'K', 'j', 'J', 'F']);

/** Keep tile characters (Phase 2 target). */
const KEEP_CHARS = new Set(['K', 'j', 'J', 'F']);

// ---------------------------------------------------------------------------
// Map analysis helpers
// ---------------------------------------------------------------------------

/**
 * Compute the CastlePerimeter — the set of passable tiles adjacent to any
 * castle structure tile. These are the Phase 1 pathfinding targets.
 *
 * Infantry is used as the representative unit type for passability — it is
 * the most route-constrained non-tree type, so any tile passable for Infantry
 * is passable for all non-tree-eligible units. Tree-eligible units (Archer,
 * Cavalry) can additionally enter tree tiles, but trees are not on the
 * perimeter of the castle.
 *
 * @param {Array}  tiles     - Array of tile objects from LevelLoader.
 * @param {Map}    tileGraph - Map<"row,col", tile> from buildTileGraph().
 * @returns {Array<{row:number, col:number}>} Deduplicated perimeter tile positions.
 */
function computeCastlePerimeter(tiles, tileGraph) {
    const PE = getPathfindingEngine();
    const perimeterKeys = new Set();
    const result = [];

    for (const tile of tiles) {
        const tileChar = PE.resolveTileChar(tile);
        if (!CASTLE_STRUCTURE_CHARS.has(tileChar)) continue;

        // This tile is a castle structure — check all 6 hex neighbours
        for (const { row: nr, col: nc } of PE.hexNeighbors(tile.row, tile.col)) {
            const key = PE.tileKey(nr, nc);
            if (perimeterKeys.has(key)) continue; // already included

            const neighbour = tileGraph.get(key);
            if (!neighbour) continue; // out of bounds

            const nChar = PE.resolveTileChar(neighbour);
            // Only include if passable for Infantry AND not a castle structure tile itself
            if (PE.getMovementCost(nChar, 'Infantry') < Infinity && !CASTLE_STRUCTURE_CHARS.has(nChar)) {
                perimeterKeys.add(key);
                result.push(neighbour); // return actual tile object
            }
        }
    }

    return result;
}

/**
 * Compute the KeepTileSet — all tiles with characters K, j, J, F.
 * These are the Phase 2 pathfinding targets (after castle breach).
 *
 * @param {Array} tiles - Array of tile objects from LevelLoader.
 * @returns {Array<{row:number, col:number}>} Keep tile positions.
 */
function computeKeepTileSet(tiles) {
    const PE = getPathfindingEngine();
    const result = [];
    for (const tile of tiles) {
        if (KEEP_CHARS.has(PE.resolveTileChar(tile))) {
            result.push(tile); // return actual tile object
        }
    }
    return result;
}

/**
 * Identify spawn point tiles on the enemy-side edge of the map.
 *
 * Algorithm:
 * 1. Find the F tile (castle keep centre). Use row 0 as fallback if not found.
 * 2. Determine which edge row (0 or maxRow) is furthest from the F tile by
 *    absolute row distance.
 * 3. Collect all tiles on farthestRow that are passable for Infantry
 *    (getMovementCost < Infinity).
 * 4. Sort passable tiles by column, then select up to 4 evenly-spaced
 *    candidates, always including first and last. Minimum 2 spawn points.
 *    - If only 1 passable tile exists, that tile is returned twice (duplicate)
 *      so that the caller always receives at least 2 entries.
 *    - If exactly 2: return both.
 *    - If 3+: pick indices [0, floor((n-1)/3), floor(2*(n-1)/3), n-1],
 *      deduplicate while preserving order.
 *
 * @param {Array} tiles     - Array of tile objects from LevelLoader.
 * @param {Map}   tileGraph - Map<"row,col", tile> from buildTileGraph().
 * @returns {Array<Object>} Spawn-point tile objects (at least 2 entries).
 */
function identifySpawnPoints(tiles, tileGraph) {
    const PE = getPathfindingEngine();

    // Step 1: Find the F tile row
    let fRow = 0; // fallback if no F tile found
    for (const tile of tiles) {
        if (PE.resolveTileChar(tile) === 'F') {
            fRow = tile.row;
            break;
        }
    }

    // Step 2: Determine farthest edge row
    let maxRow = 0;
    for (const tile of tiles) {
        if (tile.row > maxRow) maxRow = tile.row;
    }

    const farthestRow = Math.abs(0 - fRow) > Math.abs(maxRow - fRow) ? 0 : maxRow;

    // Step 3: Collect Infantry-passable tiles on farthestRow
    const passable = [];
    for (const tile of tiles) {
        if (tile.row !== farthestRow) continue;
        const tileChar = PE.resolveTileChar(tile);
        if (PE.getMovementCost(tileChar, 'Infantry') < Infinity) {
            passable.push(tile);
        }
    }

    // Sort by column
    passable.sort((a, b) => a.col - b.col);

    const n = passable.length;

    // Step 4: Select evenly-spaced spawn points (minimum 2)
    if (n === 0) {
        // No passable tiles found — return empty (caller must handle)
        return [];
    }

    if (n === 1) {
        // Only one passable tile; return it twice to satisfy min-2 requirement
        return [passable[0], passable[0]];
    }

    if (n === 2) {
        return [passable[0], passable[1]];
    }

    // 3+ passable tiles: pick up to 4 evenly-spaced indices, deduplicated
    const rawIndices = [
        0,
        Math.floor((n - 1) / 3),
        Math.floor(2 * (n - 1) / 3),
        n - 1,
    ];

    // Deduplicate while preserving order
    const seen = new Set();
    const chosenIndices = [];
    for (const idx of rawIndices) {
        if (!seen.has(idx)) {
            seen.add(idx);
            chosenIndices.push(idx);
        }
    }

    return chosenIndices.map(i => passable[i]);
}

// ---------------------------------------------------------------------------
// Spawn helpers
// ---------------------------------------------------------------------------

/**
 * BFS outward from (startRow, startCol) to find the nearest tile that is:
 *   - Present in the tile graph (in-bounds)
 *   - Passable for the given unitType (getMovementCost < Infinity)
 *   - Not in occupiedSet
 *
 * @param {number} startRow
 * @param {number} startCol
 * @param {string} unitType
 * @param {Map}    tileGraph   - Map<"row,col", tile>
 * @param {Set}    occupiedSet - Set of "row,col" keys already occupied
 * @param {Object} PE          - PathfindingEngine reference
 * @returns {{ row: number, col: number }|null}
 */
function _findNearestUnoccupied(startRow, startCol, unitType, tileGraph, occupiedSet, PE) {
    const queue = [{ row: startRow, col: startCol }];
    const visited = new Set([PE.tileKey(startRow, startCol)]);

    while (queue.length) {
        const { row, col } = queue.shift();
        const k = PE.tileKey(row, col);
        const tile = tileGraph.get(k);
        if (!tile) continue;

        const char = PE.resolveTileChar(tile);
        if (PE.getMovementCost(char, unitType) < Infinity && !occupiedSet.has(k)) {
            return { row, col };
        }

        for (const nb of PE.hexNeighbors(row, col)) {
            const nk = PE.tileKey(nb.row, nb.col);
            if (!visited.has(nk)) {
                visited.add(nk);
                queue.push(nb);
            }
        }
    }

    return null; // no valid position found
}

// ---------------------------------------------------------------------------
// EnemyManager singleton
// ---------------------------------------------------------------------------

const EnemyManager = {
    // Internal state
    _units:              [],
    _castleBreached:     false,
    _worldKnowledgeMap:  null,
    _lastSeenRegistry:   new Map(),   // Map<stableUnitKey, { row, col, turn, health }>
    _unitKeyCache:       new Map(),   // Map<unitIndex, stableKey>
    _sharedThreatMap:    null,
    _spawnPoints:        [],
    _engagementZoneRegistry: [],

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    /**
     * Initialise EnemyManager from the current level's tile data.
     * Builds the world knowledge map and identifies spawn points.
     *
     * @param {Array} [tilesOverride] - Optional tile array; if omitted, reads
     *   from LevelLoader.getCurrentLevel().tiles (browser usage).
     */
    init(tilesOverride) {
        const tiles = tilesOverride ?? this._getLevelTiles();
        const PE = getPathfindingEngine();
        const tileGraph = PE.buildTileGraph(tiles);

        this._worldKnowledgeMap = tileGraph;
        this._spawnPoints = identifySpawnPoints(tiles, tileGraph);
    },

    /**
     * Reset all mutable state. Call on level restart.
     */
    reset() {
        this._units              = [];
        this._castleBreached     = false;
        this._worldKnowledgeMap  = null;
        this._lastSeenRegistry   = new Map();
        this._unitKeyCache       = new Map();
        this._sharedThreatMap    = null;
        this._spawnPoints        = [];
        this._engagementZoneRegistry = [];
    },

    /**
     * Spawn a wave of enemy units onto the map.
     *
     * Algorithm:
     * 1. Build (or re-use) the world knowledge map from terrain tiles.
     * 2. Identify spawn points if not already known.
     * 3. Flatten waveConfig.units into an ordered list of unit types.
     * 4. Assign unit types to spawn points in round-robin order.
     * 5. For each (unitType, spawnPoint): place at spawnPoint if unoccupied,
     *    otherwise BFS outward to find nearest unoccupied passable tile.
     * 6. Create each unit via createUnit and push to _units.
     *
     * @param {{ units: Array<{ type: string, count: number }> }} waveConfig
     *   Wave composition definition.
     * @param {Array} [tilesOverride] - Optional tile array for Node.js testability
     *   (bypasses LevelLoader). When provided the world knowledge map is rebuilt
     *   from this array regardless of any cached map.
     */
    spawnWave(waveConfig, tilesOverride) {
        const PE = getPathfindingEngine();

        // Step 1: Build world knowledge map from tiles
        let tiles;
        if (tilesOverride) {
            tiles = tilesOverride;
            // Always rebuild when tiles are explicitly provided (test compatibility)
            this._worldKnowledgeMap = PE.buildTileGraph(tiles);
        } else {
            tiles = this._getLevelTiles();
            if (!this._worldKnowledgeMap) {
                this._worldKnowledgeMap = PE.buildTileGraph(tiles);
            }
        }
        const tileGraph = this._worldKnowledgeMap;

        // Step 2: Identify spawn points if not yet done (or reset after tilesOverride)
        if (this._spawnPoints.length === 0 || tilesOverride) {
            this._spawnPoints = identifySpawnPoints(tiles, tileGraph);
        }
        const spawnPoints = this._spawnPoints;

        if (spawnPoints.length === 0) {
            // No valid spawn points — nothing to place
            return;
        }

        // Step 3: Flatten waveConfig.units into an ordered unit-type list
        const unitTypeList = [];
        for (const entry of (waveConfig.units || [])) {
            for (let i = 0; i < entry.count; i++) {
                unitTypeList.push(entry.type);
            }
        }

        if (unitTypeList.length === 0) return;

        // Track which tiles have been occupied this wave (by newly placed units)
        const occupiedSet = new Set(
            this._units.map(u => PE.tileKey(u.row, u.col))
        );

        // Step 4 + 5: Round-robin assignment and placement
        let unitIdCounter = this._units.length;

        for (let i = 0; i < unitTypeList.length; i++) {
            const unitType = unitTypeList[i];
            const spawnPoint = spawnPoints[i % spawnPoints.length];

            const startKey = PE.tileKey(spawnPoint.row, spawnPoint.col);

            let placedRow, placedCol;

            if (!occupiedSet.has(startKey)) {
                // Spawn point is free — place here
                placedRow = spawnPoint.row;
                placedCol = spawnPoint.col;
            } else {
                // BFS to find nearest unoccupied passable tile
                const found = _findNearestUnoccupied(
                    spawnPoint.row, spawnPoint.col, unitType, tileGraph, occupiedSet, PE
                );
                if (!found) {
                    // No valid position found — skip this unit
                    continue;
                }
                placedRow = found.row;
                placedCol = found.col;
            }

            const unitId = `enemy-${unitIdCounter++}`;
            const unit = createUnit(unitType, placedRow, placedCol, unitId);
            this._units.push(unit);
            occupiedSet.add(PE.tileKey(placedRow, placedCol));
        }
    },

    /**
     * Update the castle-breached flag. Called by the game loop's Resolve Phase
     * when the castle perimeter has been breached by enemy units.
     *
     * @param {boolean} value
     */
    setCastleBreached(value) {
        this._castleBreached = Boolean(value);
    },

    // ------------------------------------------------------------------
    // Accessors (for debugging and testing)
    // ------------------------------------------------------------------

    getEnemyUnits()           { return this._units; },
    getWorldKnowledgeMap()    { return this._worldKnowledgeMap; },
    getLastSeenRegistry()     { return this._lastSeenRegistry; },
    getSharedThreatMap()      { return this._sharedThreatMap; },
    getSpawnPoints()          { return this._spawnPoints; },
    getEngagementZoneRegistry() { return this._engagementZoneRegistry; },

    /**
     * Return the EnemyUnit at (row, col), or null if none.
     *
     * @param {number} row
     * @param {number} col
     * @returns {Object|null}
     */
    getEnemyUnitAt(row, col) {
        return this._units.find(u => u.row === row && u.col === col) ?? null;
    },

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    _getLevelTiles() {
        if (typeof LevelLoader !== 'undefined' && LevelLoader.getCurrentLevel) {
            return LevelLoader.getCurrentLevel().tiles;
        }
        throw new Error('LevelLoader is not available');
    },
};

// ---------------------------------------------------------------------------
// Expose module-level functions on EnemyManager for testing
// ---------------------------------------------------------------------------

EnemyManager.identifySpawnPoints    = identifySpawnPoints;
EnemyManager.computeCastlePerimeter = computeCastlePerimeter;
EnemyManager.computeKeepTileSet     = computeKeepTileSet;
EnemyManager.createUnit             = createUnit;
EnemyManager.UNIT_DEFS              = UNIT_DEFS;
EnemyManager.UNIT_TYPES             = UNIT_TYPES;
EnemyManager.CASTLE_STRUCTURE_CHARS = CASTLE_STRUCTURE_CHARS;
EnemyManager.KEEP_CHARS             = KEEP_CHARS;

// ---------------------------------------------------------------------------
// Public API exposure
// ---------------------------------------------------------------------------

// Expose as browser global
if (typeof window !== 'undefined') {
    window.EnemyManager = EnemyManager;
}

// Support Node.js require() for test files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnemyManager;
}
