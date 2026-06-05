/**
 * PathfindingEngine — A* pathfinding over the hex grid for enemy AI units.
 *
 * Exposed as a browser global: window.PathfindingEngine
 *
 * This file has NO dependencies on DOM, fetch, or other browser globals — all
 * pure data-structure logic — making it fully unit-testable in Node.js by
 * inlining / re-implementing the small helpers it uses.
 *
 * ═══════════════════════════════════════════════════
 * SPRITE → CHARACTER MAPPING
 * ═══════════════════════════════════════════════════
 * Derived from LevelLoader.parseLevelText. The level data stores sprite names
 * on tiles rather than the original map characters. This mapping reverses that
 * translation so the MovementCostTable can be applied.
 *
 * sprite prefix / name         → character
 * ────────────────────────────────────────
 * grass-short-*                → '.'
 * grass-flowers-*              → ','
 * road-full                    → 'D'
 * water-*                      → '~'
 * bridge-mm                    → '='
 * castle-bridge-mid            → 'm'  (b, m, g all stored as castle-bridge-mid)
 * castle-tower                 → 'T'
 * castle-keep-tl               → 'K'
 * castle-keep-bl               → 'j'
 * castle-keep-br               → 'J'
 * castle-keep-center           → 'F'
 * castle-gatehouse*            → 'G'
 * castle-wall*                 → 'W'
 * castle-bailey-*              → 'C'
 * rock                         → 'R'
 * tree-oak-overlay-*   (overlay) → 'O'
 * tree-pine-overlay-*  (overlay) → 'P'
 * tree-shrub-overlay-* (overlay) → 'S'
 *
 * NOTE: In LevelLoader, characters b, m, and g all resolve to the sprite
 * 'castle-bridge-mid'. Since all three have identical movement cost (1),
 * resolveTileChar maps 'castle-bridge-mid' → 'm' — a cost-equivalent
 * representative. The distinction between b/m/g is not needed for pathfinding.
 * ═══════════════════════════════════════════════════
 */

// ---------------------------------------------------------------------------
// MovementCostTable — base terrain costs, unit-type-independent (except trees)
// ---------------------------------------------------------------------------

/** @type {Object.<string, number>} Base movement cost per tile character. */
const MOVEMENT_COST = {
    '.': 1,        // grass
    ',': 1,        // flowers
    'D': 1,        // road
    '=': 1,        // cobblestone bridge
    'C': 1,        // bailey
    'b': 1,        // castle bridge start
    'm': 1,        // castle bridge mid
    'g': 1,        // castle bridge gate
    '~': 2,        // water
    'W': Infinity, // castle wall
    'T': Infinity, // castle tower
    'G': Infinity, // gatehouse
    'K': Infinity, // keep top-left
    'j': Infinity, // keep bottom-left
    'J': Infinity, // keep bottom-right
    'F': Infinity, // keep centre (flag)
    'R': Infinity, // rock
};

/** Tree tile characters — movement cost depends on unit type. */
const TREE_CHARS = new Set(['O', 'P', 'S']);

/**
 * Unit types that can pass through tree tiles at cost 1.
 * Non-eligible types (Infantry, SiegeEngine) treat trees as impassable.
 */
const TREE_ELIGIBLE = new Set(['Archer', 'Cavalry']);

// ---------------------------------------------------------------------------
// Sprite-to-character mapping helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a tile object (as stored by LevelLoader) to a single map character.
 *
 * The overlay field is checked FIRST — tree tiles are stored as
 * { sprite: 'grass-short-*', overlay: 'tree-oak-overlay-*' } so the overlay
 * must take precedence over the sprite name.
 *
 * @param {Object} tile - A tile from LevelLoader tiles array.
 * @param {string} [tile.sprite] - The sprite name.
 * @param {string} [tile.overlay] - Optional overlay sprite name (tree tiles).
 * @returns {string} A single map character representing the tile type.
 */
function resolveTileChar(tile) {
    if (!tile) return '.';

    // Check overlay first — tree tiles are stored as grass + tree overlay
    const overlay = tile.overlay;
    if (overlay) {
        if (overlay.startsWith('tree-oak-overlay-'))   return 'O';
        if (overlay.startsWith('tree-pine-overlay-'))  return 'P';
        if (overlay.startsWith('tree-shrub-overlay-')) return 'S';
    }

    // Fall back to sprite name
    const sprite = tile.sprite || '';

    if (sprite.startsWith('grass-short-'))    return '.';
    if (sprite.startsWith('grass-flowers-'))  return ',';
    if (sprite === 'road-full')               return 'D';
    if (sprite.startsWith('water-'))          return '~';
    if (sprite === 'bridge-mm')               return '=';
    // b, m, g all stored as 'castle-bridge-mid' by LevelLoader
    if (sprite === 'castle-bridge-mid')       return 'm';
    if (sprite === 'castle-tower')            return 'T';
    if (sprite === 'castle-keep-tl')          return 'K';
    if (sprite === 'castle-keep-bl')          return 'j';
    if (sprite === 'castle-keep-br')          return 'J';
    if (sprite === 'castle-keep-center')      return 'F';
    if (sprite.startsWith('castle-gatehouse')) return 'G';
    if (sprite.startsWith('castle-wall'))     return 'W';
    if (sprite.startsWith('castle-bailey-'))  return 'C';
    if (sprite === 'rock')                    return 'R';

    // Unknown sprite → treat as grass (passable, cost 1)
    return '.';
}

/**
 * Return the movement cost for a given tile character and enemy unit type.
 *
 * For tree tiles (O, P, S) the cost is unit-type-dependent:
 *   - Tree-eligible units (Archer, Cavalry): cost 1
 *   - All other units: Infinity (impassable)
 *
 * For all other tile characters the MOVEMENT_COST table is consulted.
 * Unknown characters default to Infinity (treat as impassable).
 *
 * @param {string} tileChar - Single map character returned by resolveTileChar.
 * @param {string} unitType - 'Infantry' | 'Archer' | 'Cavalry' | 'SiegeEngine'
 * @returns {number} Movement cost (1, 2, or Infinity).
 */
function getMovementCost(tileChar, unitType) {
    if (TREE_CHARS.has(tileChar)) {
        return TREE_ELIGIBLE.has(unitType) ? 1 : Infinity;
    }
    return MOVEMENT_COST[tileChar] ?? Infinity;
}

// ---------------------------------------------------------------------------
// TileGraph helpers
// ---------------------------------------------------------------------------

/**
 * Build a fast tile lookup map keyed by "row,col".
 *
 * @param {Array} tiles - Array of tile objects (as returned by LevelLoader).
 * @returns {Map<string, Object>} Map from "row,col" key to tile object.
 */
function buildTileGraph(tiles) {
    const graph = new Map();
    for (const tile of tiles) {
        graph.set(`${tile.row},${tile.col}`, tile);
    }
    return graph;
}

/**
 * Return the canonical string key for a tile position.
 *
 * @param {number} row
 * @param {number} col
 * @returns {string}
 */
function tileKey(row, col) {
    return `${row},${col}`;
}

// ---------------------------------------------------------------------------
// Hex topology helpers
// ---------------------------------------------------------------------------

/**
 * Return the six hex neighbours of (row, col) using odd-row-offset topology
 * (pointy-top, odd rows shifted right by half a hex), identical to hexToPixel
 * in utils.js.
 *
 * @param {number} row
 * @param {number} col
 * @returns {Array<{row:number, col:number}>} Six neighbour positions.
 */
function hexNeighbors(row, col) {
    if (row % 2 === 0) {
        // Even row: neighbours shift left relative to odd rows
        return [
            { row: row - 1, col: col - 1 }, // NW
            { row: row - 1, col: col },      // NE
            { row: row,     col: col + 1 },  // E
            { row: row + 1, col: col },      // SE
            { row: row + 1, col: col - 1 },  // SW
            { row: row,     col: col - 1 },  // W
        ];
    } else {
        // Odd row: neighbours shift right
        return [
            { row: row - 1, col: col },      // NW
            { row: row - 1, col: col + 1 },  // NE
            { row: row,     col: col + 1 },  // E
            { row: row + 1, col: col + 1 },  // SE
            { row: row + 1, col: col },      // SW
            { row: row,     col: col - 1 },  // W
        ];
    }
}

/**
 * Compute the cube-coordinate hex distance between two offset positions.
 * This is the admissible A* heuristic: hexDistance(a, b) ≤ actual path cost(a→b)
 * because the minimum per-step cost is 1.
 *
 * Conversion: offset (row, col) → cube (x, y, z) using odd-row-offset.
 *
 * @param {number} r1 @param {number} c1  Start position.
 * @param {number} r2 @param {number} c2  End position.
 * @returns {number} Integer hex distance (≥ 0).
 */
function hexDistance(r1, c1, r2, c2) {
    const x1 = c1 - (r1 - (r1 & 1)) / 2;
    const z1 = r1;
    const y1 = -x1 - z1;

    const x2 = c2 - (r2 - (r2 & 1)) / 2;
    const z2 = r2;
    const y2 = -x2 - z2;

    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

// ---------------------------------------------------------------------------
// MinHeap — binary min-heap keyed on item.f (A* f-score)
// ---------------------------------------------------------------------------

class MinHeap {
    constructor() {
        this._data = [];
    }

    isEmpty() {
        return this._data.length === 0;
    }

    /**
     * Insert an item, maintaining the heap invariant (sift-up).
     * @param {{ f: number }} item
     */
    push(item) {
        this._data.push(item);
        this._siftUp(this._data.length - 1);
    }

    /**
     * Remove and return the item with the lowest f-score (sift-down).
     * @returns {{ f: number }}
     */
    pop() {
        const top = this._data[0];
        const last = this._data.pop();
        if (this._data.length > 0) {
            this._data[0] = last;
            this._siftDown(0);
        }
        return top;
    }

    _siftUp(i) {
        const data = this._data;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (data[parent].f <= data[i].f) break;
            [data[parent], data[i]] = [data[i], data[parent]];
            i = parent;
        }
    }

    _siftDown(i) {
        const data = this._data;
        const n = data.length;
        for (;;) {
            let smallest = i;
            const l = 2 * i + 1;
            const r = 2 * i + 2;
            if (l < n && data[l].f < data[smallest].f) smallest = l;
            if (r < n && data[r].f < data[smallest].f) smallest = r;
            if (smallest === i) break;
            [data[smallest], data[i]] = [data[i], data[smallest]];
            i = smallest;
        }
    }
}

// ---------------------------------------------------------------------------
// A* pathfinding
// ---------------------------------------------------------------------------

/**
 * Reconstruct the path from start to goal by following parent pointers.
 * The start tile is excluded from the returned path; the goal tile is included.
 *
 * @param {Map<string,string>} parent  Parent map built during A*.
 * @param {string}             goalKey  Tile key of the goal.
 * @param {string}             startKey Tile key of the start.
 * @returns {Array<{row:number,col:number}>}
 */
function reconstructPath(parent, goalKey, startKey) {
    const path = [];
    let current = goalKey;
    while (current !== startKey) {
        const [r, c] = current.split(',').map(Number);
        path.push({ row: r, col: c });
        current = parent.get(current);
    }
    path.reverse();
    return path;
}

/**
 * A* pathfinding over the hex tile graph.
 *
 * @param {string}   unitType           - 'Infantry' | 'Archer' | 'Cavalry' | 'SiegeEngine'
 * @param {number}   startRow
 * @param {number}   startCol
 * @param {Array<{row:number,col:number}>} targetSet  - Candidate goal tiles.
 * @param {Map}      tileGraph          - Map<"row,col", tile> from buildTileGraph().
 * @param {Map|null} dynamicCostOverlay - Map<"row,col", number>; pass null/undefined
 *                                        or an empty Map when no overlay is needed.
 * @returns {Array<{row:number,col:number}>} Ordered path from start (exclusive)
 *          to best reachable target (inclusive), or [] if no path exists.
 */
function findPath(unitType, startRow, startCol, targetSet, tileGraph, dynamicCostOverlay) {
    if (!targetSet || targetSet.length === 0) return [];

    const overlay = dynamicCostOverlay || new Map();
    const targetKeys = new Set(targetSet.map(t => tileKey(t.row, t.col)));

    const openSet = new MinHeap();
    const gScore = new Map();
    const parent = new Map();

    const startKey = tileKey(startRow, startCol);
    gScore.set(startKey, 0);

    // Heuristic: minimum hex distance to any target tile
    const h = (r, c) => Math.min(...targetSet.map(t => hexDistance(r, c, t.row, t.col)));

    openSet.push({ f: h(startRow, startCol), row: startRow, col: startCol });

    while (!openSet.isEmpty()) {
        const { row, col } = openSet.pop();
        const key = tileKey(row, col);

        if (targetKeys.has(key)) {
            return reconstructPath(parent, key, startKey);
        }

        const currentG = gScore.get(key);

        for (const { row: nr, col: nc } of hexNeighbors(row, col)) {
            const nKey = tileKey(nr, nc);
            const tile = tileGraph.get(nKey);
            if (!tile) continue; // out of bounds

            const tileChar = resolveTileChar(tile);
            const baseCost = getMovementCost(tileChar, unitType);
            if (baseCost === Infinity) continue; // impassable terrain

            // Apply dynamic overlay cost if present (combat tiles, threat-zone water)
            const effectiveCost = overlay.has(nKey) ? overlay.get(nKey) : baseCost;

            const tentativeG = currentG + effectiveCost;
            if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
                gScore.set(nKey, tentativeG);
                parent.set(nKey, key);
                openSet.push({ f: tentativeG + h(nr, nc), row: nr, col: nc });
            }
        }
    }

    return []; // no path found
}

// ---------------------------------------------------------------------------
// hexRing — BFS within radius steps
// ---------------------------------------------------------------------------

/**
 * Return all tile objects reachable from (row, col) in 1..radius hex steps,
 * using the tileGraph as the bounds check (out-of-bounds tiles are skipped).
 *
 * @param {number} row
 * @param {number} col
 * @param {number} radius
 * @param {Map}    tileGraph
 * @returns {Array<Object>} Array of tile objects within the ring.
 */
function hexRing(row, col, radius, tileGraph) {
    const visited = new Set();
    const result = [];
    const queue = [{ row, col, dist: 0 }];
    visited.add(tileKey(row, col));

    while (queue.length > 0) {
        const { row: cr, col: cc, dist } = queue.shift();
        if (dist >= radius) continue;

        for (const { row: nr, col: nc } of hexNeighbors(cr, cc)) {
            const k = tileKey(nr, nc);
            if (visited.has(k)) continue;
            visited.add(k);

            const tile = tileGraph.get(k);
            if (!tile) continue; // out of bounds — skip

            result.push(tile);
            queue.push({ row: nr, col: nc, dist: dist + 1 });
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// computeEnemyVisibleTiles — directional sight with tree occlusion
// ---------------------------------------------------------------------------

/** Tile characters that block sight rays (impassable structures). */
const SIGHT_BLOCKING_CHARS = new Set(['W', 'T', 'G', 'K', 'j', 'J', 'F', 'R']);

/**
 * Compute the set of tiles visible from an enemy unit at (row, col).
 *
 * Rules:
 * - Base sight: 3 hex steps in each of 6 directions.
 * - If the immediate neighbour in a direction is a tree tile (O/P/S), that
 *   direction is capped at 1 step.
 * - If the unit itself is on a tree tile, all directions are capped at 1.
 * - Sight rays stop at impassable structure tiles (W, T, G, K, j, J, F, R).
 * - The unit's own tile is NOT included in the result.
 *
 * @param {number} row
 * @param {number} col
 * @param {Map}    tileGraph
 * @returns {Set<Object>} Set of visible tile objects (not the unit's own tile).
 */
function computeEnemyVisibleTiles(row, col, tileGraph) {
    const visibleTiles = new Set();

    // Check if unit itself is on a tree tile
    const unitTile = tileGraph.get(tileKey(row, col));
    const unitChar = unitTile ? resolveTileChar(unitTile) : '.';
    const unitInTree = TREE_CHARS.has(unitChar);

    // The 6 directional neighbours (order matches hexNeighbors output):
    // NW, NE, E, SE, SW, W
    const directions = hexNeighbors(row, col);

    for (const immediateNeighbour of directions) {
        const immTile = tileGraph.get(tileKey(immediateNeighbour.row, immediateNeighbour.col));
        const immChar = immTile ? resolveTileChar(immTile) : null;

        // Determine sight distance for this direction
        let sightDistance;
        if (unitInTree) {
            sightDistance = 1; // fully inside woodland — all directions capped at 1
        } else if (immChar !== null && TREE_CHARS.has(immChar)) {
            sightDistance = 1; // trees in this direction block after 1 step
        } else {
            sightDistance = 3; // open terrain — full sight
        }

        // Raycast: step along this direction up to sightDistance tiles.
        // We derive the per-step offset from the immediate neighbour position.
        const dRow = immediateNeighbour.row - row;
        const dCol = immediateNeighbour.col - col;

        // To continue in the same hex direction beyond step 1, we use
        // hexNeighbors of the current tile and pick the neighbour that is
        // closest to the target direction vector. For a straight hex ray
        // in offset grids the direction offset changes on even vs. odd rows,
        // so we iterate step-by-step using hexNeighbors to stay on-grid.
        let prevRow = row;
        let prevCol = col;

        for (let step = 1; step <= sightDistance; step++) {
            const stepNeighbours = hexNeighbors(prevRow, prevCol);

            // Find the neighbour that best continues in the same direction.
            // On step 1 it is simply the immediateNeighbour.
            let nextRow, nextCol;
            if (step === 1) {
                nextRow = immediateNeighbour.row;
                nextCol = immediateNeighbour.col;
            } else {
                // Pick the hexNeighbors entry that minimises deviation from
                // (prevRow + dRow, prevCol + dCol) expected direction.
                // For straight rays across even/odd rows the expected target
                // shifts, so we find the neighbour with smallest manhattan dist
                // to the naively extrapolated position.
                const expectedRow = prevRow + dRow;
                const expectedCol = prevCol + dCol;
                let best = stepNeighbours[0];
                let bestDist = Math.abs(best.row - expectedRow) + Math.abs(best.col - expectedCol);
                for (let n = 1; n < stepNeighbours.length; n++) {
                    const nd = Math.abs(stepNeighbours[n].row - expectedRow)
                             + Math.abs(stepNeighbours[n].col - expectedCol);
                    if (nd < bestDist) { bestDist = nd; best = stepNeighbours[n]; }
                }
                nextRow = best.row;
                nextCol = best.col;
            }

            const nTile = tileGraph.get(tileKey(nextRow, nextCol));
            if (!nTile) break; // out of bounds

            const nChar = resolveTileChar(nTile);
            if (SIGHT_BLOCKING_CHARS.has(nChar)) break; // sight blocked

            visibleTiles.add(nTile);

            prevRow = nextRow;
            prevCol = nextCol;
        }
    }

    return visibleTiles;
}

// ---------------------------------------------------------------------------
// buildSharedThreatMap
// ---------------------------------------------------------------------------

/** Combat cost applied to a tile occupied by a last-seen player unit. */
const COMBAT_COST = 3;

/** Penalty applied to water tiles within player threat radius when enemy-visible. */
const THREAT_WATER_COST = 4;

/**
 * Build the shared threat overlay map for a single turn.
 *
 * Steps:
 * 1. Mark each last-seen player unit position with COMBAT_COST (3).
 * 2. Compute the union of tiles visible to all active enemy units.
 * 3. For each last-seen player unit, expand a 3-hex ring; any water tile
 *    in that ring that is also enemy-visible receives THREAT_WATER_COST (4).
 * 4. Apply zone overlay penalties additively on top of existing costs.
 *    Infinity base costs are never overridden (walls, keep, rock remain walls).
 *
 * The overlay never overrides Infinity base costs (walls, keep, rock remain walls).
 *
 * @param {Map}        lastSeenRegistry      - Map<stableKey, { row, col, turn, health }>
 * @param {Array}      activeEnemyUnits      - Array of enemy unit objects with { row, col }
 * @param {Map}        tileGraph             - Map<"row,col", tile>
 * @param {Map|null}   [zoneOverlayPenalties] - Optional Map<tileKey, number> of additive
 *                                              zone avoidance penalties from
 *                                              _evaluateZoneStrategies. When provided,
 *                                              each penalty is added on top of the
 *                                              existing cost (steps 1–3). Tiles with
 *                                              Infinity base costs are never modified.
 * @returns {Map<string, number>} Overlay map.
 */
function buildSharedThreatMap(lastSeenRegistry, activeEnemyUnits, tileGraph, zoneOverlayPenalties) {
    const overlay = new Map();

    const registry = lastSeenRegistry || new Map();
    const enemies = activeEnemyUnits || [];
    const zonePenalties = zoneOverlayPenalties || new Map();

    if (registry.size === 0 && enemies.length === 0 && zonePenalties.size === 0) return overlay;

    // Step 1: last-seen player unit positions → combat cost 3
    for (const entry of registry.values()) {
        overlay.set(tileKey(entry.row, entry.col), COMBAT_COST);
    }

    // Step 2: build collective enemy visible tile set
    const enemyVisibleSet = new Set();
    for (const enemyUnit of enemies) {
        for (const tile of computeEnemyVisibleTiles(enemyUnit.row, enemyUnit.col, tileGraph)) {
            enemyVisibleSet.add(tileKey(tile.row, tile.col));
        }
    }

    // Step 3: threat-zone water penalty for enemy-visible tiles in player threat radii
    for (const entry of registry.values()) {
        const threatTiles = hexRing(entry.row, entry.col, 3, tileGraph);
        for (const tile of threatTiles) {
            const tk = tileKey(tile.row, tile.col);
            const tChar = resolveTileChar(tile);
            if (tChar === '~' && enemyVisibleSet.has(tk)) {
                const current = overlay.get(tk) ?? 0;
                if (THREAT_WATER_COST > current) {
                    overlay.set(tk, THREAT_WATER_COST);
                }
            }
        }
    }

    // Step 4: zone avoidance penalties — additive on top of steps 1–3 costs.
    // Never override Infinity base costs (walls, keep, rock remain impassable).
    for (const [key, penalty] of zonePenalties) {
        // Check the base terrain cost to ensure we never modify Infinity tiles
        const tile = tileGraph.get(key);
        if (tile) {
            const tChar = resolveTileChar(tile);
            const baseCost = getMovementCost(tChar, 'Infantry'); // Infantry = most restrictive non-tree
            if (baseCost === Infinity) continue; // impassable terrain — never override
        }
        const existingCost = overlay.get(key) ?? 0;
        overlay.set(key, existingCost + penalty);
    }

    return overlay;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const PathfindingEngine = {
    // Constants
    MOVEMENT_COST,
    TREE_CHARS,
    TREE_ELIGIBLE,
    COMBAT_COST,
    THREAT_WATER_COST,

    // Tile resolution
    resolveTileChar,
    getMovementCost,

    // Graph construction
    buildTileGraph,
    tileKey,

    // Hex topology
    hexNeighbors,
    hexDistance,
    hexRing,

    // A* pathfinding
    findPath,

    // Sight and threat
    computeEnemyVisibleTiles,
    buildSharedThreatMap,

    // Exposed for testing
    MinHeap,
    reconstructPath,
};

// Expose as browser global (no module.exports — matches existing browser-global
// pattern used by LevelLoader, UnitManager, AnimationController, etc.)
if (typeof window !== 'undefined') {
    window.PathfindingEngine = PathfindingEngine;
}

// Also support Node.js require() for test files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PathfindingEngine;
}
