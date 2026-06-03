# Design Document: Enemy AI Pathfinding

## Overview

This feature adds an Enemy AI Pathfinding system to the browser-based isometric hex-grid tower defense game. Two new plain JavaScript files are introduced — `js/game-logic/pathfinding-engine.js` and `js/game-logic/enemy-manager.js` — loaded as `<script>` tags after the existing modules. No build tooling, bundler, or existing file modifications are needed beyond adding those two `<script>` tags and the single `EnemyManager.executeTurn()` call in the game loop's Enemy Phase.

The system uses A* pathfinding over the odd-row-offset hex grid defined by `hexToPixel` in `utils.js`. Enemy units follow a two-phase assault pattern: while `castleBreached` is `false` they target the CastlePerimeter ring; after breach they converge on the KeepTileSet. Terrain movement costs are unit-type-aware, tree tiles are only passable for Archer and Cavalry, and any tile occupied by a player unit is dynamically blocked.

---

## Architecture

```
game-iso.js (Game Loop)
    │  EnemyPhase: EnemyManager.executeTurn()
    │  Resolve Phase: EnemyManager.setCastleBreached(true)
    │
    ├── enemy-manager.js (EnemyManager)
    │       spawns / tracks EnemyUnit instances
    │       builds TileGraph from LevelLoader
    │       delegates path computation to PathfindingEngine
    │       moves units via PathfindingEngine output
    │
    └── pathfinding-engine.js (PathfindingEngine)
            pure A* over hex TileGraph
            MovementCostTable lookup
            hexNeighbors (odd-row-offset)
            hexDistance heuristic
```

Both new files expose singleton objects (`EnemyManager`, `PathfindingEngine`) as browser globals, matching the existing pattern used by `LevelLoader`, `UnitManager`, `AnimationController`, etc.

---

## File: `js/game-logic/pathfinding-engine.js`

### Sprite-to-Character Mapping

`LevelLoader.parseLevelText` stores sprite names on tiles, not the original map characters. `PathfindingEngine` must reverse this mapping to apply the `MovementCostTable`. The mapping table is derived directly from `level-loader.js`:

```
sprite prefix / name         → character
────────────────────────────────────────
grass-short-*                → '.'
grass-flowers-*              → ','
road-full                    → 'D'
water-*                      → '~'
bridge-mm (= tile)           → '='
castle-bridge-start (b)      → 'b'
castle-bridge-mid   (m)      → 'm'
castle-bridge-gate  (g)      → 'g'
castle-tower                 → 'T'
castle-keep-tl               → 'K'
castle-keep-bl               → 'j'
castle-keep-br               → 'J'
castle-keep-center           → 'F'
castle-gatehouse*            → 'G'
castle-wall*                 → 'W'
castle-bailey-*              → 'C'
rock                         → 'R'
grass-short-* + tree overlay → 'O' / 'P' / 'S'  (overlay name used)
```

Tree tiles in the level data are stored as `{ sprite: 'grass-short-1', overlay: 'tree-oak-overlay-1' }`. The resolver checks the `overlay` field first to detect tree tiles before falling back to the `sprite` field.

### MovementCostTable

```js
// Cost is Infinity for impassable tiles.
const MOVEMENT_COST = {
    '.': 1,  // grass
    ',': 1,  // flowers
    'D': 1,  // road
    '=': 1,  // cobblestone bridge
    'C': 1,  // bailey
    'b': 1,  // castle bridge start
    'm': 1,  // castle bridge mid
    'g': 1,  // castle bridge gate
    '~': 2,  // water
    'W': Infinity,
    'T': Infinity,
    'G': Infinity,
    'K': Infinity,
    'j': Infinity,
    'J': Infinity,
    'F': Infinity,
    'R': Infinity,
};

// Tree characters — cost depends on unit type
const TREE_CHARS = new Set(['O', 'P', 'S']);

// Tree-eligible types can pass through trees at cost 1
const TREE_ELIGIBLE = new Set(['Archer', 'Cavalry']);

function getMovementCost(tileChar, unitType) {
    if (TREE_CHARS.has(tileChar)) {
        return TREE_ELIGIBLE.has(unitType) ? 1 : Infinity;
    }
    return MOVEMENT_COST[tileChar] ?? Infinity; // unknown chars are impassable
}
```

### Hex Neighbor Computation

Odd-row-offset (pointy-top, odd rows shifted right by half a hex) — identical to `hexToPixel`:

```js
/**
 * Returns the six hex neighbors of (row, col) in odd-row-offset topology.
 * Even rows: neighbors shift left; odd rows: neighbors shift right.
 */
function hexNeighbors(row, col) {
    if (row % 2 === 0) {
        // Even row
        return [
            { row: row - 1, col: col - 1 }, // NW
            { row: row - 1, col: col },      // NE
            { row: row,     col: col + 1 },  // E
            { row: row + 1, col: col },      // SE
            { row: row + 1, col: col - 1 }, // SW
            { row: row,     col: col - 1 }, // W
        ];
    } else {
        // Odd row
        return [
            { row: row - 1, col: col },      // NW
            { row: row - 1, col: col + 1 },  // NE
            { row: row,     col: col + 1 },  // E
            { row: row + 1, col: col + 1 },  // SE
            { row: row + 1, col: col },      // SW
            { row: row,     col: col - 1 }, // W
        ];
    }
}
```

### Hex Distance Heuristic

The cube-coordinate hex distance is used as the A* heuristic. It is admissible because the minimum per-step cost is 1, so the heuristic never overestimates.

```js
/**
 * Converts offset (row, col) to cube coordinates then computes distance.
 * Admissible heuristic: hexDistance(a, b) <= actual path cost(a→b).
 */
function hexDistance(r1, c1, r2, c2) {
    // Offset → cube conversion (odd-row-offset)
    const x1 = c1 - (r1 - (r1 & 1)) / 2;
    const z1 = r1;
    const y1 = -x1 - z1;

    const x2 = c2 - (r2 - (r2 & 1)) / 2;
    const z2 = r2;
    const y2 = -x2 - z2;

    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}
```

### TileGraph

A `TileGraph` is a thin wrapper over the level tile array that builds a fast `Map<string, tile>` lookup keyed by `"row,col"` and caches the tile-character resolution. It is constructed fresh each turn (or cached and invalidated when units move).

```js
function buildTileGraph(tiles) {
    const graph = new Map();
    for (const tile of tiles) {
        graph.set(`${tile.row},${tile.col}`, tile);
    }
    return graph;
}

function tileKey(row, col) { return `${row},${col}`; }
```

### A* Implementation

```js
/**
 * PathfindingEngine.findPath(unitType, startRow, startCol,
 *                            targetSet, tileGraph, getUnitAt)
 *
 * @param {string}   unitType   - 'Infantry' | 'Archer' | 'Cavalry' | 'SiegeEngine'
 * @param {number}   startRow
 * @param {number}   startCol
 * @param {Array}    targetSet  - [{ row, col }, ...] candidate goal tiles
 * @param {Map}      tileGraph  - Map<"row,col", tile> from buildTileGraph()
 * @param {Function} getUnitAt  - (row, col) => unit | null  (from UnitManager)
 * @returns {Array}  ordered path [{row,col}, ...] from start (exclusive) to
 *                   best target (inclusive), or [] if no path exists
 */
function findPath(unitType, startRow, startCol, targetSet, tileGraph, getUnitAt) {
    const targetKeys = new Set(targetSet.map(t => tileKey(t.row, t.col)));

    // Min-heap priority queue (f-score)
    const openSet = new MinHeap();
    const gScore = new Map();
    const parent = new Map();

    const startKey = tileKey(startRow, startCol);
    gScore.set(startKey, 0);

    // Heuristic: minimum distance to any target
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
            if (!tile) continue;                          // out of bounds

            const tileChar = resolveTileChar(tile);
            const cost = getMovementCost(tileChar, unitType);
            if (cost === Infinity) continue;              // impassable terrain

            if (getUnitAt(nr, nc) !== null) continue;    // blocked by player unit

            const tentativeG = currentG + cost;
            if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
                gScore.set(nKey, tentativeG);
                parent.set(nKey, key);
                openSet.push({ f: tentativeG + h(nr, nc), row: nr, col: nc });
            }
        }
    }

    return []; // no path found
}
```

The path reconstructed by `reconstructPath` excludes the start position (current unit position) and includes the goal tile.

### MinHeap

A simple binary min-heap keyed on `f`. This keeps the A* implementation self-contained and avoids any dependency on external libraries. For a 40×33 grid (~1320 nodes) the heap operations run in O(log 1320) ≈ 11 comparisons per push/pop.

```js
class MinHeap {
    constructor() { this._data = []; }
    isEmpty() { return this._data.length === 0; }
    push(item) { /* sift-up */ }
    pop()      { /* sift-down */ }
}
```

---

## File: `js/game-logic/enemy-manager.js`

### EnemyUnit Data Shape

```js
// Each active enemy unit is a plain object:
{
    type:       'Infantry',  // 'Infantry' | 'Archer' | 'Cavalry' | 'SiegeEngine'
    row:        number,
    col:        number,
    movePts:    number,      // movement points per turn (see UNIT_DEFS)
    path:       [],          // cached path from last pathfinding call
    health:     number,
    id:         string,      // unique id for tracking
}
```

### Unit Type Definitions

```js
const UNIT_DEFS = {
    Infantry:    { movePts: 2, treeEligible: false },
    Archer:      { movePts: 2, treeEligible: true  },
    Cavalry:     { movePts: 3, treeEligible: false },
    SiegeEngine: { movePts: 1, treeEligible: false },
};
```

Note: `treeEligible` on `UNIT_DEFS` is for documentation; the authoritative lookup is `TREE_ELIGIBLE` inside `pathfinding-engine.js` which operates on the string type name.

### CastlePerimeter Computation

```js
const CASTLE_STRUCTURE_CHARS = new Set(['W', 'T', 'G', 'K', 'j', 'J', 'F']);

function computeCastlePerimeter(tiles, tileGraph, unitType) {
    const perimeter = [];
    for (const tile of tiles) {
        const ch = resolveTileChar(tile);  // shared helper from pathfinding-engine
        if (!CASTLE_STRUCTURE_CHARS.has(ch)) continue;

        for (const { row: nr, col: nc } of hexNeighbors(tile.row, tile.col)) {
            const neighbor = tileGraph.get(tileKey(nr, nc));
            if (!neighbor) continue;
            const neighborCh = resolveTileChar(neighbor);
            const cost = getMovementCost(neighborCh, unitType);
            if (cost < Infinity) {
                perimeter.push({ row: nr, col: nc });
            }
        }
    }
    // Deduplicate
    const seen = new Set();
    return perimeter.filter(p => {
        const k = tileKey(p.row, p.col);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}
```

Because `movePts` may differ per unit type but passability is what defines the perimeter, `computeCastlePerimeter` accepts a representative `unitType` or computes a union over all types depending on whether a universal perimeter is desired.

### KeepTileSet Computation

```js
const KEEP_CHARS = new Set(['K', 'j', 'J', 'F']);

function computeKeepTileSet(tiles) {
    return tiles.filter(t => KEEP_CHARS.has(resolveTileChar(t)))
                .map(t => ({ row: t.row, col: t.col }));
}
```

### SpawnPoint Identification

```js
/**
 * Spawn points are passable tiles on the row furthest from the F tile.
 * "Furthest" is measured by |spawnRow - keepRow| along the row axis.
 * At least 2 spawn points are required; they are distributed across the
 * available columns on the far edge row.
 */
function identifySpawnPoints(tiles, tileGraph) {
    const keepTile = tiles.find(t => resolveTileChar(t) === 'F');
    if (!keepTile) return [];

    // Group passable tiles by row
    const passableByRow = new Map();
    for (const tile of tiles) {
        const ch = resolveTileChar(tile);
        // Infantry is the most restrictive non-tree type; use it to find
        // universally passable spawn tiles.
        if (getMovementCost(ch, 'Infantry') < Infinity) {
            if (!passableByRow.has(tile.row)) passableByRow.set(tile.row, []);
            passableByRow.get(tile.row).push(tile);
        }
    }

    // Find the row with maximum row distance from the keep
    let maxDist = -1;
    let spawnRow = -1;
    for (const [row] of passableByRow) {
        const dist = Math.abs(row - keepTile.row);
        if (dist > maxDist) { maxDist = dist; spawnRow = row; }
    }

    const candidates = passableByRow.get(spawnRow) || [];
    // Distribute: pick evenly spaced columns across the candidates
    if (candidates.length < 2) return candidates;
    const step = Math.max(1, Math.floor(candidates.length / 4));
    const selected = [];
    for (let i = 0; i < candidates.length; i += step) {
        selected.push({ row: candidates[i].row, col: candidates[i].col });
    }
    return selected;
}
```

### EnemyManager Public API

```js
const EnemyManager = {
    _units:          [],     // active EnemyUnit instances
    _castleBreached: false,
    _tileGraph:      null,
    _spawnPoints:    [],

    /**
     * Call once after LevelLoader.loadLevelList() to pre-build the tile graph
     * and identify spawn points.
     */
    init() { ... },

    /**
     * Spawn a wave. waveConfig = [{ type, count }, ...]
     * Places units at spawn points according to wave composition.
     */
    spawnWave(waveConfig) { ... },

    /**
     * Execute the Enemy Phase: recompute paths and move all active units.
     * Call this from Game.update() during the Enemy Phase.
     */
    executeTurn() { ... },

    /**
     * Update the castleBreached flag. Called by the game loop's Resolve Phase.
     */
    setCastleBreached(value) {
        this._castleBreached = !!value;
    },

    /**
     * Clear all active enemy units and reset the breach flag.
     * Call on level restart.
     */
    reset() {
        this._units = [];
        this._castleBreached = false;
    },

    /** Returns all active enemy unit objects (for rendering). */
    getEnemyUnits() { return this._units; },

    /** Returns the enemy unit at (row, col) or null. */
    getEnemyUnitAt(row, col) {
        return this._units.find(u => u.row === row && u.col === col) || null;
    },
};
```

### executeTurn() Sequence

```
executeTurn()
  1. Build TileGraph from LevelLoader.getCurrentLevel().tiles
  2. Select targetSet:
       castleBreached === false → CastlePerimeter (re-computed from current level)
       castleBreached === true  → KeepTileSet
  3. For each EnemyUnit (in insertion order):
       a. Call PathfindingEngine.findPath(unit.type, unit.row, unit.col,
                                          targetSet, tileGraph, UnitManager.getUnitAt)
       b. Advance unit along path by 1 tile (or up to movePts tiles if design
          evolves — currently 1 tile/turn per Req 5.2)
       c. Verify destination is passable and unoccupied before committing move
       d. Update unit.row, unit.col
```

### Movement Step Detail

```js
function moveUnit(unit, path) {
    if (path.length === 0) return; // stationary (Req 5.3)
    const next = path[0];          // path excludes start, so index 0 is next tile

    // Guard: re-verify destination before committing (Req 5.5)
    const tile = tileGraph.get(tileKey(next.row, next.col));
    if (!tile) return;
    const ch = resolveTileChar(tile);
    if (getMovementCost(ch, unit.type) === Infinity) return;
    if (UnitManager.getUnitAt(next.row, next.col) !== null) return;
    if (EnemyManager.getEnemyUnitAt(next.row, next.col) !== null) return;

    unit.row = next.row;
    unit.col = next.col;
}
```

### Spawn Collision Handling

If a spawn point tile is occupied by another enemy unit at spawn time, the new unit is placed at the first unoccupied passable tile found by BFS from the spawn point (Req 4.4).

---

## Integration with `game-iso.js`

No existing code is modified. The integration requires two additions:

1. Two new `<script>` tags in `index.html` (after `unit-manager.js`, before `game-iso.js`):
   ```html
   <script src="js/game-logic/pathfinding-engine.js"></script>
   <script src="js/game-logic/enemy-manager.js"></script>
   ```

2. One call in `Game.update()` during the Enemy Phase:
   ```js
   // Enemy Phase (after Player input, before Resolve)
   EnemyManager.executeTurn();
   ```

3. `EnemyManager.init()` called once in `Game.startLevel()` after `LevelLoader` is ready.

4. `EnemyManager.reset()` called in `Game.startLevel()` on level restart.

All interactions with `LevelLoader` and `UnitManager` go through their public APIs (`getCurrentLevel()`, `getUnitAt()`). No internal fields of existing modules are read or written directly.

---

## Data Flow Diagram

```
LevelLoader.getCurrentLevel().tiles
        │
        ▼
buildTileGraph()  →  Map<"row,col", tile>
        │
        ├── computeCastlePerimeter() → [{row,col}, ...]   ← Phase 1 targets
        ├── computeKeepTileSet()     → [{row,col}, ...]   ← Phase 2 targets
        └── identifySpawnPoints()   → [{row,col}, ...]
                │
                ▼
         EnemyManager.spawnWave()
                │
                ▼
       [EnemyUnit, EnemyUnit, ...]
                │  (per-turn)
                ▼
  PathfindingEngine.findPath(unitType, row, col,
                             targetSet, tileGraph,
                             UnitManager.getUnitAt)
                │
                ▼
       path: [{row,col}, ...]
                │
                ▼
       moveUnit(unit, path)
       → update unit.row, unit.col
```

---

## Error Handling

| Situation | Behaviour |
|-----------|-----------|
| No path to target exists | `findPath` returns `[]`; unit stays stationary |
| Target tile set is empty | `findPath` returns `[]` immediately |
| `getUnitAt` throws | Wrapped in try/catch; unit treated as stationary |
| Level has no F tile | `identifySpawnPoints` returns `[]`; wave spawn no-ops |
| Level has fewer than 2 spawn candidates | Use all available candidates |
| Unknown tile character | `getMovementCost` returns `Infinity` (treat as wall) |

---

## Test File Locations

- `tests/pathfinding-engine.test.js` — unit + property tests for `pathfinding-engine.js`
- `tests/enemy-manager.test.js` — unit + property tests for `enemy-manager.js`

Both use `node:test` and `fast-check@3.23.2` (already in `devDependencies`).

Because the source files are plain browser globals (no `module.exports`), the test files use Node.js `vm` module or inline re-implementations of the logic under test, matching the pattern already used in `unit-manager.spec.js` and `utils.spec.js`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property Reflection:** After prework analysis, the following consolidations were applied:
- Properties 1.1–1.4 (impassable tiles) are consolidated into one comprehensive property covering all impassable characters rather than splitting by category.
- Properties 1.5 and 1.6 (tree tile cost) are merged into one property covering both tree-eligible and non-tree-eligible types.
- Properties 3.1 and 3.2 (target selection) are consolidated into one property covering both phases.
- Properties 8.1 (no impassable tiles in path) and 2.7 (no player-occupied tiles in path) are consolidated into one path-validity property.
- Properties 2.1 (path endpoints) and 8.5 (determinism) each provide unique validation and are kept separate.

---

### Property 1: MovementCostTable correctly classifies all terrain types

*For any* EnemyUnit type and any tile character in the impassable set (`W`, `T`, `G`, `K`, `j`, `J`, `F`, `R`), `getMovementCost` returns `Infinity`. *For any* EnemyUnit type and any tile character in the passable set (`.`, `,`, `D`, `=`, `C`, `b`, `m`, `g`), `getMovementCost` returns `1`. *For any* EnemyUnit type and the water character `~`, `getMovementCost` returns `2`.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

---

### Property 2: Tree tile cost depends on unit tree-eligibility

*For any* tree tile character (`O`, `P`, `S`), `getMovementCost` returns `1` when the unit type is Archer or Cavalry, and returns `Infinity` when the unit type is Infantry or SiegeEngine.

**Validates: Requirements 1.5, 1.6**

---

### Property 3: Hex neighbor count is always exactly 6

*For any* tile position `(row, col)` with row in `[0, 32]` and col in `[0, 39]`, `hexNeighbors(row, col)` returns exactly 6 neighbor positions (prior to bounds filtering). No two returned positions are identical.

**Validates: Requirements 2.2**

---

### Property 4: Hex distance is admissible (never overestimates)

*For any* pair of tiles `a` and `b` that are connected by a passable path, `hexDistance(a, b)` is less than or equal to the actual minimum movement cost of any path from `a` to `b` for a unit type with minimum cost 1 per step.

**Validates: Requirements 2.4**

---

### Property 5: Returned path endpoints are correct

*For any* call to `findPath` that returns a non-empty path, the first element of the path is a HexNeighbor of the start position, and the last element of the path is a member of the target tile set.

**Validates: Requirements 2.1, 2.5**

---

### Property 6: Path never traverses invalid tiles

*For any* call to `findPath` with a given `unitType` and `getUnitAt` function, every tile in the returned path satisfies both: (a) `getMovementCost(tileChar, unitType) < Infinity`, and (b) `getUnitAt(tile.row, tile.col) === null`.

**Validates: Requirements 2.7, 8.1, 8.2**

---

### Property 7: Empty path returned for unreachable targets

*For any* tile graph where the start position and all target tiles are in disconnected components (no path exists), `findPath` returns an empty array without throwing an error.

**Validates: Requirements 2.6, 8.4**

---

### Property 8: Two-phase target selection correctness

*For any* level layout, when `castleBreached` is `false`, every path computed by `executeTurn` terminates at a CastlePerimeter tile. When `castleBreached` is `true`, every path terminates at a KeepTileSet tile.

**Validates: Requirements 3.1, 3.2**

---

### Property 9: CastlePerimeter tiles are passable and adjacent to castle structure

*For any* level, every tile in the computed CastlePerimeter is: (a) passable (`getMovementCost < Infinity` for Infantry), and (b) a HexNeighbor of at least one tile whose character is in `{W, T, G, K, j, J, F}`.

**Validates: Requirements 3.3**

---

### Property 10: SpawnPoints are on the correct row

*For any* level, every identified SpawnPoint has a row value equal to the row that is furthest (by absolute row distance) from the row of the `F` tile.

**Validates: Requirements 4.1**

---

### Property 11: Enemy unit position reflects movement

*For any* EnemyUnit with a non-empty path, after one call to the movement step, the unit's `(row, col)` equals `path[0]` (the next tile in the path, which excluded the start position). After movement, `getEnemyUnitAt(newRow, newCol)` returns that unit, and `getEnemyUnitAt(oldRow, oldCol)` returns `null`.

**Validates: Requirements 5.2, 5.4**

---

### Property 12: Pathfinding is deterministic

*For any* fixed inputs `(unitType, startRow, startCol, targetSet, tileGraph, getUnitAt)`, calling `findPath` twice in succession with the same inputs returns two arrays that are deeply equal (same sequence of positions).

**Validates: Requirements 8.5**

---

### Property 13: Sprite-to-character mapping is a total function over LevelLoader output

*For any* tile produced by `LevelLoader.parseLevelText`, `resolveTileChar(tile)` returns a single character from the known tile legend (not `undefined`, not `null`, not an empty string).

**Validates: Requirements 7.2**

---

## Components and Interfaces

### `pathfinding-engine.js` — PathfindingEngine (browser global)

| Export | Signature | Description |
|--------|-----------|-------------|
| `PathfindingEngine.findPath` | `(unitType, startRow, startCol, targetSet, tileGraph, getUnitAt) → [{row,col}]` | A* pathfinding; returns ordered path excluding start, including goal. Empty array if unreachable. |
| `PathfindingEngine.buildTileGraph` | `(tiles) → Map<string, tile>` | Converts `LevelLoader` tile array into `"row,col"` keyed Map. |
| `PathfindingEngine.hexNeighbors` | `(row, col) → [{row,col}]` | Returns 6 neighbors in odd-row-offset topology. |
| `PathfindingEngine.hexDistance` | `(r1, c1, r2, c2) → number` | Cube-coordinate hex distance. Admissible A* heuristic. |
| `PathfindingEngine.getMovementCost` | `(tileChar, unitType) → number` | Returns movement cost (1, 2, or Infinity). |
| `PathfindingEngine.resolveTileChar` | `(tile) → string` | Maps a `LevelLoader` tile object to its source character. |

### `enemy-manager.js` — EnemyManager (browser global)

| Export | Signature | Description |
|--------|-----------|-------------|
| `EnemyManager.init` | `() → void` | Builds tile graph and spawn points from current level. |
| `EnemyManager.spawnWave` | `(waveConfig: [{type, count}]) → void` | Places enemy units at spawn points per wave definition. |
| `EnemyManager.executeTurn` | `() → void` | Enemy Phase: recomputes paths and advances all units. |
| `EnemyManager.setCastleBreached` | `(value: boolean) → void` | Updates `castleBreached` flag; called by Resolve Phase. |
| `EnemyManager.reset` | `() → void` | Clears all units, resets `castleBreached` to `false`. |
| `EnemyManager.getEnemyUnits` | `() → EnemyUnit[]` | Returns active units for rendering. |
| `EnemyManager.getEnemyUnitAt` | `(row, col) → EnemyUnit \| null` | Finds unit at a position. |

---

## Data Models

### EnemyUnit

```js
{
    id:       string,   // unique identifier, e.g. 'enemy-1'
    type:     string,   // 'Infantry' | 'Archer' | 'Cavalry' | 'SiegeEngine'
    row:      number,   // current hex grid row
    col:      number,   // current hex grid column
    movePts:  number,   // movement points per turn (from UNIT_DEFS)
    health:   number,   // current health points
    path:     [{row: number, col: number}],  // cached path (recomputed each turn)
}
```

### WaveConfig

```js
// Input to EnemyManager.spawnWave()
[
    { type: 'Infantry',    count: 3 },
    { type: 'Archer',      count: 2 },
    { type: 'Cavalry',     count: 1 },
    { type: 'SiegeEngine', count: 1 },
]
```

### TileGraph

```js
// Map<"row,col", tile>
// tile shape (from LevelLoader):
{
    row:     number,
    col:     number,
    x:       number,   // pixel x (not used by pathfinding)
    y:       number,   // pixel y (not used by pathfinding)
    sprite:  string,   // e.g. 'grass-short-1', 'castle-wall'
    overlay: string,   // optional, e.g. 'tree-oak-overlay-1'
}
```

### UNIT_DEFS

```js
const UNIT_DEFS = {
    Infantry:    { movePts: 2, health: 30 },
    Archer:      { movePts: 2, health: 25 },
    Cavalry:     { movePts: 3, health: 35 },
    SiegeEngine: { movePts: 1, health: 60 },
};
```

---

## Testing Strategy

Tests live in `tests/pathfinding-engine.test.js` and `tests/enemy-manager.test.js`. Both files follow the same pattern as existing tests: inline re-implementations of the pure logic (no DOM, no `fetch`), using `node:test` and `fast-check@3.23.2`.

**Unit tests** cover:
- `getMovementCost` for every tile character and all four unit types
- `hexNeighbors` offset parity for even and odd rows
- `hexDistance` for known tile pairs
- `resolveTileChar` for all sprite names produced by `LevelLoader`
- `findPath` returning correct endpoints and empty array on disconnected graph
- `EnemyManager.reset()` clearing all state
- `EnemyManager.setCastleBreached()` updating the flag
- `EnemyManager.spawnWave()` with occupied spawn point fallback
- Performance: single `findPath` call on a 40×33 all-passable grid completes within 16 ms

**Property tests** (fast-check) cover all 13 correctness properties defined above, using generators for:
- Random tile character samples from each classification set
- Random (row, col) positions within map bounds
- Random grids with a mix of passable and impassable tiles
- Random enemy unit type strings
- Random target tile sets of size 1–5

Run property tests with:
```
node --test tests/pathfinding-engine.test.js tests/enemy-manager.test.js
```
