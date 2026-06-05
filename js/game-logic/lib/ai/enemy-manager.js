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
// Registry constants
// ---------------------------------------------------------------------------

/**
 * Number of turns after which a LastSeenRegistry entry is considered stale
 * and expired. Default: 10 turns (~10 real-world seconds at 1 turn/sec).
 */
const SIGHTING_EXPIRY_TURNS = 10;

// ---------------------------------------------------------------------------
// Engagement Zone constants
// ---------------------------------------------------------------------------

/**
 * Hex-step radius within which sightings are clustered into a single
 * EngagementZone. If a new sighting falls within this radius of an existing
 * zone centre, it is merged into that zone rather than creating a new one.
 * Value: 6 hex steps.
 */
const ZONE_CLUSTER_RADIUS = 6;

/**
 * Extra movement-cost penalty applied to every tile inside an AVOID zone
 * via the DynamicCostOverlay. Additive on top of base terrain cost and any
 * existing last-seen combat-cost entries. Enemies will prefer routes that
 * bypass the zone when the detour is cheaper than passing through.
 * Value: +5 cost per tile.
 */
const ZONE_AVOIDANCE_COST = 5;

/**
 * HP ratio that determines whether an ENGAGE strategy is viable for a zone.
 * The strike force's total committed HP must be at least this multiplier
 * times the zone's estimatedThreatHP before ENGAGE is selected.
 * Value: 1.5× — enemy must commit 50% more HP than the estimated defender HP.
 */
const ENGAGE_HP_RATIO = 1.5;

/**
 * Maximum fraction of the total active enemy-army HP that may be allocated
 * to strike forces across all ENGAGE zones in a single turn. Prevents the AI
 * from committing its entire force to detached engagements while leaving the
 * main advance under-strength.
 * Value: 0.40 — at most 40% of total active enemy HP in strike forces.
 */
const MAX_ARMY_COMMIT_FRACTION = 0.40;

/**
 * EngagementZone shape (documentation only — plain objects are used at runtime):
 * {
 *   id:               string,   // stable identifier, e.g. 'zone-1'
 *   centreRow:        number,   // row of the zone centre tile
 *   centreCol:        number,   // col of the zone centre tile
 *   observationCount: number,   // total sighting events accumulated within this zone
 *   lastObservedTurn: number,   // turn of the most recent sighting within the cluster radius
 *   estimatedThreatHP: number,  // sum of health of last-seen player units within cluster radius
 *   strategy:         string,   // 'MONITOR' | 'AVOID' | 'ENGAGE' — assigned each turn
 * }
 */

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
        this._zoneIdCounter      = 0;
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
    // executeTurn — sighting, registry, pathfinding, and movement
    // (Requirements: 2.8, 3.1, 3.2, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5,
    //  7.3, 7.4, 7.5, 9.4, 10.1, 10.3, 10.4, 13.2, 13.3, 13.4,
    //  13.7, 14.1)
    // ------------------------------------------------------------------

    /**
     * Execute one full AI turn for all enemy units.
     *
     * Steps:
     *  1. Safety fallback purge — remove any dead player units from registry.
     *  2. Expiry pass — remove stale registry entries.
     *  3. Sight pass — each enemy looks for player units; record sightings.
     *  4. Build SharedThreatMap once for the turn.
     *  5. Select target set (CastlePerimeter or KeepTileSet).
     *  6. For each unit: find path, advance 1 tile (or stay), flag combat.
     *
     * @param {number} [currentTurn=0] - Turn counter for registry timestamps.
     * @returns {{ combatEvents: Array<{enemy, playerUnit}> }}
     */
    executeTurn(currentTurn = 0) {
        const PE = getPathfindingEngine();
        const tileGraph = this._worldKnowledgeMap;

        if (!tileGraph) {
            // Not initialised — nothing to do
            return { combatEvents: [] };
        }

        // ----------------------------------------------------------------
        // Step 1: Safety fallback purge
        // ----------------------------------------------------------------
        let placedUnits = [];
        try {
            if (typeof UnitManager !== 'undefined' && UnitManager.getPlacedUnits) {
                placedUnits = UnitManager.getPlacedUnits();
            }
        } catch (_) {
            // UnitManager unavailable (tests) — treat as empty
        }

        if (typeof this._safetyPurgeDead === 'function') {
            this._safetyPurgeDead(placedUnits);
        }

        // ----------------------------------------------------------------
        // Step 2: Expire stale registry entries
        // ----------------------------------------------------------------
        if (typeof this._expireStale === 'function') {
            this._expireStale(currentTurn);
        }

        // ----------------------------------------------------------------
        // Step 3: Sight pass — compute visible tiles for each enemy unit
        //         and record sightings of any player units in those tiles
        // ----------------------------------------------------------------
        try {
            for (const enemyUnit of this._units) {
                let visibleTiles;
                try {
                    visibleTiles = PE.computeEnemyVisibleTiles(
                        enemyUnit.row, enemyUnit.col, tileGraph
                    );
                } catch (_) {
                    visibleTiles = new Set();
                }

                // Build a set of visible tile keys for fast lookup
                const visibleKeys = new Set();
                for (const tile of visibleTiles) {
                    visibleKeys.add(PE.tileKey(tile.row, tile.col));
                }

                // Cross-reference against placed player units
                for (let i = 0; i < placedUnits.length; i++) {
                    const pUnit = placedUnits[i];
                    if (visibleKeys.has(PE.tileKey(pUnit.row, pUnit.col))) {
                        if (typeof this._recordSighting === 'function') {
                            this._recordSighting(pUnit, i, currentTurn);
                        }
                    }
                }
            }
        } catch (_) {
            // Treat errors in the sight pass as empty sightings (Req 13.3 / notes)
        }

        // ----------------------------------------------------------------
        // Step 3b: Update engagement zones from latest sightings
        //          (Req 15.2) — must happen AFTER sight pass
        // ----------------------------------------------------------------
        if (typeof this._updateEngagementZones === 'function') {
            this._updateEngagementZones(this._lastSeenRegistry, currentTurn);
        }

        // ----------------------------------------------------------------
        // Step 3c: Evaluate zone strategies — get overlay penalties and
        //          strike-force assignments (Req 16.7, 16.10)
        // ----------------------------------------------------------------
        let zoneOverlayPenalties  = new Map();
        let strikeForceAssignments = new Map();

        if (typeof this._evaluateZoneStrategies === 'function') {
            const result = this._evaluateZoneStrategies(
                currentTurn,
                this._units,
                tileGraph,
                this._sharedThreatMap || new Map()
            );
            zoneOverlayPenalties   = result.zoneOverlayPenalties   || new Map();
            strikeForceAssignments = result.strikeForceAssignments  || new Map();
        }

        // ----------------------------------------------------------------
        // Step 4: Build SharedThreatMap ONCE for this turn (Req 10.1, 10.3)
        //         Pass zoneOverlayPenalties as 4th argument (Req 16.3, 16.10)
        // ----------------------------------------------------------------
        this._sharedThreatMap = PE.buildSharedThreatMap(
            this._lastSeenRegistry,
            this._units,
            tileGraph,
            zoneOverlayPenalties
        );

        // ----------------------------------------------------------------
        // Step 5: Select target set (Req 3.1, 3.2)
        // ----------------------------------------------------------------
        // We need the raw tiles array to compute targets. Derive from tileGraph.
        const tiles = Array.from(tileGraph.values());
        const targetSet = this._castleBreached
            ? computeKeepTileSet(tiles)
            : computeCastlePerimeter(tiles, tileGraph);

        // Build a reverse lookup: unit → zoneId for strike force overrides
        // Map<unit, { centreRow, centreCol }> — computed from strikeForceAssignments
        const unitToZone = new Map();
        for (const [zoneId, forceUnits] of strikeForceAssignments.entries()) {
            const zone = this._engagementZoneRegistry.find(z => z.id === zoneId);
            if (zone) {
                for (const u of forceUnits) {
                    unitToZone.set(u, zone);
                }
            }
        }

        // ----------------------------------------------------------------
        // Step 6: Movement loop
        // ----------------------------------------------------------------

        // Build occupied-enemy-positions set BEFORE movement starts
        // (refreshed after each unit moves so subsequent units see updated positions)
        const combatEvents = [];

        for (const unit of this._units) {
            // For strike force units, override targetSet with zone centre (Req 16.7, 16.10)
            const assignedZone = unitToZone.get(unit);
            const effectiveTargetSet = assignedZone
                ? [{ row: assignedZone.centreRow, col: assignedZone.centreCol }]
                : targetSet;

            // Find path for this unit (Req 2.8, 5.1)
            const path = PE.findPath(
                unit.type,
                unit.row,
                unit.col,
                effectiveTargetSet,
                tileGraph,
                this._sharedThreatMap
            );

            // No path → unit stays stationary (Req 5.3)
            if (!path || path.length === 0) {
                continue;
            }

            const dest = path[0]; // advance 1 tile per turn

            // ----------------------------------------------------------
            // Re-verify terrain passability (Req 5.5, walls/keep/rock
            // must remain Infinity regardless of overlay)
            // ----------------------------------------------------------
            const destTile = tileGraph.get(PE.tileKey(dest.row, dest.col));
            if (!destTile) continue; // out of bounds

            const destChar = PE.resolveTileChar(destTile);
            const baseCost = PE.getMovementCost(destChar, unit.type);
            if (baseCost === Infinity) {
                // Impassable terrain — do not move (Req 5.5)
                continue;
            }

            // ----------------------------------------------------------
            // Block if another enemy unit is already on the destination
            // (Req 5.5 — "not occupied by another unit")
            // ----------------------------------------------------------
            const destKey = PE.tileKey(dest.row, dest.col);
            const blockedByEnemy = this._units.some(
                other => other !== unit &&
                         PE.tileKey(other.row, other.col) === destKey
            );
            if (blockedByEnemy) {
                continue;
            }

            // ----------------------------------------------------------
            // Check for player unit on destination (combat cost tile)
            // Allow movement; flag for Resolve Phase (Req 9.1, 5.4)
            // ----------------------------------------------------------
            let playerUnitAtDest = null;
            try {
                if (typeof UnitManager !== 'undefined' && UnitManager.getUnitAt) {
                    playerUnitAtDest = UnitManager.getUnitAt(dest.row, dest.col);
                }
            } catch (_) {
                // UnitManager unavailable — no combat flagging
            }

            // Move the unit (Req 5.2)
            unit.row = dest.row;
            unit.col = dest.col;

            // Flag combat event if a player unit was on the destination
            if (playerUnitAtDest) {
                combatEvents.push({ enemy: unit, playerUnit: playerUnitAtDest });
            }
        }

        return { combatEvents };
    },

    // ------------------------------------------------------------------
    // LastSeenRegistry helpers (stubs — fully implemented in task 16.2)
    // Called defensively via typeof checks in executeTurn, but also
    // available here so they can be tested directly.
    // ------------------------------------------------------------------

    /**
     * Derive a stable key for a player unit that does NOT depend on position.
     * Priority: unit.id → unit.def.name+':'+index → cached index-based key.
     *
     * @param {Object} playerUnit
     * @param {number} unitIndex
     * @returns {string}
     */
    _stableKeyFor(playerUnit, unitIndex) {
        if (playerUnit.id) return String(playerUnit.id);
        if (playerUnit.def && playerUnit.def.name) {
            return `${playerUnit.def.name}:${unitIndex}`;
        }
        if (!this._unitKeyCache.has(unitIndex)) {
            this._unitKeyCache.set(unitIndex, `unit-idx-${unitIndex}`);
        }
        return this._unitKeyCache.get(unitIndex);
    },

    /**
     * Record or update a player unit sighting in the LastSeenRegistry.
     * Always upserts the SAME registry entry — never creates a duplicate.
     *
     * @param {Object} playerUnit
     * @param {number} unitIndex
     * @param {number} currentTurn
     */
    _recordSighting(playerUnit, unitIndex, currentTurn) {
        const key = this._stableKeyFor(playerUnit, unitIndex);
        this._lastSeenRegistry.set(key, {
            row:    playerUnit.row,
            col:    playerUnit.col,
            turn:   currentTurn,
            health: playerUnit.currentHealth ?? playerUnit.def?.health ?? 0,
        });
    },

    /**
     * Called by the Resolve Phase immediately when a player unit is killed.
     * Removes the unit's entry from the registry and the key cache.
     *
     * @param {Object} killedUnit
     * @param {number} unitIndex
     */
    notifyUnitKilled(killedUnit, unitIndex) {
        const key = this._stableKeyFor(killedUnit, unitIndex);
        this._lastSeenRegistry.delete(key);
        this._unitKeyCache.delete(unitIndex);
    },

    /**
     * Safety-net fallback: cross-references registry against alive units
     * and removes orphaned entries. No-op once notifyUnitKilled is wired.
     *
     * @param {Array} placedUnits
     */
    _safetyPurgeDead(placedUnits) {
        const aliveKeys = new Set(
            placedUnits.map((u, i) => this._stableKeyFor(u, i))
        );
        for (const key of this._lastSeenRegistry.keys()) {
            if (!aliveKeys.has(key)) {
                this._lastSeenRegistry.delete(key);
            }
        }
    },

    /**
     * Expire stale registry entries older than SIGHTING_EXPIRY_TURNS.
     *
     * @param {number} currentTurn
     */
    _expireStale(currentTurn) {
        for (const [key, entry] of this._lastSeenRegistry.entries()) {
            if (currentTurn - entry.turn > SIGHTING_EXPIRY_TURNS) {
                this._lastSeenRegistry.delete(key);
            }
        }
    },

    // ------------------------------------------------------------------
    // EngagementZoneRegistry helpers (Requirements: 15.1–15.3, 17.1, 17.2)
    // ------------------------------------------------------------------

    /** Internal counter used to generate stable zone IDs. */
    _zoneIdCounter: 0,

    /**
     * Update the EngagementZoneRegistry from the current LastSeenRegistry.
     *
     * Algorithm:
     *   1. For each sighting in lastSeenRegistry:
     *      - Search for an existing zone whose centre is within
     *        ZONE_CLUSTER_RADIUS hex steps of the sighting position.
     *      - If found: increment observationCount and update lastObservedTurn.
     *      - If not found: create a new zone centred on the sighting position
     *        with observationCount=1 and lastObservedTurn=currentTurn.
     *   2. Recompute estimatedThreatHP for every zone from the current
     *      lastSeenRegistry: sum health of all entries within ZONE_CLUSTER_RADIUS
     *      of each zone centre.
     *
     * @param {Map}    lastSeenRegistry - Map<stableKey, {row, col, turn, health}>
     * @param {number} currentTurn
     * (Requirements: 15.2, 15.3)
     */
    _updateEngagementZones(lastSeenRegistry, currentTurn) {
        const PE = getPathfindingEngine();

        // Step 1: cluster each sighting into an existing zone or create a new one
        for (const entry of lastSeenRegistry.values()) {
            // Find first zone whose centre is within cluster radius of this sighting
            const existingZone = this._engagementZoneRegistry.find(zone =>
                PE.hexDistance(zone.centreRow, zone.centreCol, entry.row, entry.col)
                    <= ZONE_CLUSTER_RADIUS
            );

            if (existingZone) {
                existingZone.observationCount += 1;
                existingZone.lastObservedTurn = currentTurn;
            } else {
                // Create a new zone centred on this sighting position
                this._zoneIdCounter += 1;
                this._engagementZoneRegistry.push({
                    id:                `zone-${this._zoneIdCounter}`,
                    centreRow:         entry.row,
                    centreCol:         entry.col,
                    observationCount:  1,
                    lastObservedTurn:  currentTurn,
                    estimatedThreatHP: 0,   // computed in step 2
                    strategy:          'MONITOR',
                });
            }
        }

        // Step 2: recompute estimatedThreatHP for every zone from the
        // current snapshot of lastSeenRegistry
        for (const zone of this._engagementZoneRegistry) {
            let totalHP = 0;
            for (const entry of lastSeenRegistry.values()) {
                const dist = PE.hexDistance(
                    zone.centreRow, zone.centreCol,
                    entry.row, entry.col
                );
                if (dist <= ZONE_CLUSTER_RADIUS) {
                    totalHP += entry.health;
                }
            }
            zone.estimatedThreatHP = totalHP;
        }
    },

    // ------------------------------------------------------------------
    // EngagementZone strategy evaluation helpers
    // (Requirements: 15.4, 16.1–16.10)
    // ------------------------------------------------------------------

    /**
     * Return true when the zone has been observed recently enough to be
     * considered active (i.e. still influences pathfinding this turn).
     *
     * Active:  currentTurn - zone.lastObservedTurn <= SIGHTING_EXPIRY_TURNS
     * Dormant: currentTurn - zone.lastObservedTurn >  SIGHTING_EXPIRY_TURNS
     *
     * @param {{ lastObservedTurn: number }} zone
     * @param {number} currentTurn
     * @returns {boolean}
     * (Requirements: 15.4, 16.9)
     */
    _isZoneActive(zone, currentTurn) {
        return (currentTurn - zone.lastObservedTurn) <= SIGHTING_EXPIRY_TURNS;
    },

    /**
     * Evaluate and assign a strategy (AVOID / ENGAGE / MONITOR) to every
     * zone in the EngagementZoneRegistry for the current turn.
     *
     * Algorithm (per the design document):
     *
     *  For ACTIVE zones:
     *   1. Probe AVOID — add zone tile penalty to a temp overlay and run A*
     *      with Infantry from the zone centre to castlePerimeter. If the
     *      resulting path does NOT pass through any zone tile, the zone is
     *      avoidable. Set strategy = 'AVOID'; retain the penalty tiles in
     *      zoneOverlayPenalties.
     *   2. If not avoidable, check ENGAGE viability:
     *        requiredHP     = zone.estimatedThreatHP * ENGAGE_HP_RATIO
     *        remainingBudget = (totalEnemyHP * MAX_ARMY_COMMIT_FRACTION) - committedHP
     *      If requiredHP <= remainingBudget, pick the highest-HP unassigned
     *      units until the required HP is met. If successful, set strategy =
     *      'ENGAGE', store the assignment, and accumulate committedHP.
     *   3. Fall back to AVOID (no further penalty added — zone is already in
     *      zoneOverlayPenalties from the probe in step 1).
     *
     *  For DORMANT zones (isActive returns false):
     *   Set strategy = 'MONITOR'; do NOT add any overlay penalty.
     *
     * @param {number}          currentTurn
     * @param {Array}           activeEnemyUnits  — EnemyUnit array for this turn
     * @param {Map}             worldKnowledgeMap — static terrain TileGraph
     * @param {Map}             overlay           — current DynamicCostOverlay (not mutated)
     * @returns {{ strikeForceAssignments: Map<string, Array>, zoneOverlayPenalties: Map<string, number> }}
     * (Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10)
     */
    _evaluateZoneStrategies(currentTurn, activeEnemyUnits, worldKnowledgeMap, overlay) {
        const PE = getPathfindingEngine();

        // Aggregate HP budget
        const totalEnemyHP = activeEnemyUnits.reduce((sum, u) => sum + (u.health ?? 0), 0);
        let committedHP = 0;

        const strikeForceAssignments = new Map();   // Map<zoneId, EnemyUnit[]>
        const zoneOverlayPenalties   = new Map();   // Map<tileKey, number>

        // Pre-compute castle perimeter once (Infantry probe target)
        const tiles = Array.from(worldKnowledgeMap.values());
        const castlePerimeter = computeCastlePerimeter(tiles, worldKnowledgeMap);

        for (const zone of this._engagementZoneRegistry) {
            // ----------------------------------------------------------------
            // Dormant zones: strategy = MONITOR, no overlay effect
            // ----------------------------------------------------------------
            if (!this._isZoneActive(zone, currentTurn)) {
                zone.strategy = 'MONITOR';
                continue;
            }

            // ----------------------------------------------------------------
            // Step 1: Probe AVOID
            //   - Collect tiles within ZONE_CLUSTER_RADIUS of zone centre
            //   - Add ZONE_AVOIDANCE_COST to each in zoneOverlayPenalties (temp)
            //   - Build tempOverlay = current overlay merged with penalties so far
            //   - Run A* for Infantry from zone centre to castle perimeter
            //   - If the path avoids all zone tiles → AVOID
            // ----------------------------------------------------------------
            const zoneTiles = PE.hexRing(
                zone.centreRow, zone.centreCol, ZONE_CLUSTER_RADIUS, worldKnowledgeMap
            );
            const zoneTileKeys = new Set();
            for (const tile of zoneTiles) {
                const key = PE.tileKey(tile.row, tile.col);
                zoneTileKeys.add(key);
                // Accumulate additive penalty on top of any existing penalty
                zoneOverlayPenalties.set(
                    key,
                    (zoneOverlayPenalties.get(key) ?? 0) + ZONE_AVOIDANCE_COST
                );
            }

            // Build tempOverlay = base overlay + all accumulated zone penalties
            const tempOverlay = new Map(overlay);
            for (const [key, penalty] of zoneOverlayPenalties.entries()) {
                const existing = tempOverlay.get(key) ?? 0;
                tempOverlay.set(key, existing + penalty);
            }

            // Run A* probe: Infantry routing from zone centre to castle perimeter
            const probePath = PE.findPath(
                'Infantry',
                zone.centreRow, zone.centreCol,
                castlePerimeter,
                worldKnowledgeMap,
                tempOverlay
            );

            // Zone is avoidable if a path was found AND that path stays clear of zone tiles
            const avoidable = probePath.length > 0 &&
                !probePath.some(step => zoneTileKeys.has(PE.tileKey(step.row, step.col)));

            if (avoidable) {
                zone.strategy = 'AVOID';
                continue;
            }

            // ----------------------------------------------------------------
            // Step 2: AVOID not viable — try ENGAGE
            // ----------------------------------------------------------------
            const requiredHP      = zone.estimatedThreatHP * ENGAGE_HP_RATIO;
            const remainingBudget = (totalEnemyHP * MAX_ARMY_COMMIT_FRACTION) - committedHP;

            if (requiredHP <= remainingBudget) {
                // Collect units already committed to other strike forces
                const alreadyAssigned = new Set(
                    Array.from(strikeForceAssignments.values()).flat()
                );

                // Sort candidates by health descending, skip already-assigned units
                const candidates = activeEnemyUnits
                    .filter(u => !alreadyAssigned.has(u))
                    .slice()
                    .sort((a, b) => (b.health ?? 0) - (a.health ?? 0));

                const strikeForce = [];
                let allocatedHP = 0;

                for (const candidate of candidates) {
                    if (allocatedHP >= requiredHP) break;
                    strikeForce.push(candidate);
                    allocatedHP += candidate.health ?? 0;
                }

                if (allocatedHP >= requiredHP) {
                    zone.strategy = 'ENGAGE';
                    strikeForceAssignments.set(zone.id, strikeForce);
                    committedHP += allocatedHP;
                    continue;
                }
            }

            // ----------------------------------------------------------------
            // Step 3: Fall back to AVOID (penalty already in zoneOverlayPenalties
            //         from Step 1 probe — enemies will try to route around the
            //         zone even though they could not avoid it with Infantry)
            // ----------------------------------------------------------------
            zone.strategy = 'AVOID';
        }

        return { strikeForceAssignments, zoneOverlayPenalties };
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
EnemyManager.SIGHTING_EXPIRY_TURNS  = SIGHTING_EXPIRY_TURNS;
EnemyManager.ZONE_CLUSTER_RADIUS    = ZONE_CLUSTER_RADIUS;
EnemyManager.ZONE_AVOIDANCE_COST    = ZONE_AVOIDANCE_COST;
EnemyManager.ENGAGE_HP_RATIO        = ENGAGE_HP_RATIO;
EnemyManager.MAX_ARMY_COMMIT_FRACTION = MAX_ARMY_COMMIT_FRACTION;

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
