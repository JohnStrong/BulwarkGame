# Implementation Plan: Enemy AI Pathfinding

## Overview

Implement the enemy AI pathfinding system as two new plain JavaScript files (`js/game-logic/pathfinding-engine.js` and `js/game-logic/enemy-manager.js`) loaded as browser globals, then wire them into the existing game loop via two `<script>` tags in `index.html` and one call to `EnemyManager.executeTurn()` in `game-iso.js`. No existing files require structural changes.

## Tasks

- [ ] 1. Create `js/game-logic/pathfinding-engine.js` — core data structures and helpers
  - [ ] 1.1 Implement `resolveTileChar(tile)` and `getMovementCost(tileChar, unitType)`
    - Write the sprite-to-character mapping table derived from `LevelLoader.parseLevelText`
    - Handle the `overlay` field first (tree detection) before falling back to `sprite`
    - Implement `MOVEMENT_COST`, `TREE_CHARS`, `TREE_ELIGIBLE` constants and `getMovementCost`
    - Expose both functions on the `PathfindingEngine` global object
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.2_

  - [ ]* 1.2 Write property tests for `getMovementCost` (Properties 1 & 2)
    - **Property 1: MovementCostTable correctly classifies all terrain types**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
    - **Property 2: Tree tile cost depends on unit tree-eligibility**
    - **Validates: Requirements 1.5, 1.6**
    - Use `fast-check` arbitrary for tile char and unit type; assert costs match spec
    - _File: `tests/pathfinding-engine.test.js`_

  - [ ]* 1.3 Write property test for `resolveTileChar` (Property 13)
    - **Property 13: Sprite-to-character mapping is a total function over LevelLoader output**
    - **Validates: Requirements 7.2**
    - Generate arbitrary tile objects matching LevelLoader output shape; assert non-empty single char
    - _File: `tests/pathfinding-engine.test.js`_

- [ ] 2. Implement hex topology helpers in `pathfinding-engine.js`
  - [ ] 2.1 Implement `hexNeighbors(row, col)` and `hexDistance(r1, c1, r2, c2)`
    - Use odd-row-offset topology identical to `hexToPixel` in `utils.js`
    - Implement cube-coordinate conversion for `hexDistance` (admissible heuristic)
    - Expose both on `PathfindingEngine`
    - _Requirements: 2.2, 2.4_

  - [ ]* 2.2 Write property tests for `hexNeighbors` and `hexDistance` (Properties 3 & 4)
    - **Property 3: Hex neighbor count is always exactly 6**
    - **Validates: Requirements 2.2**
    - **Property 4: Hex distance is admissible (never overestimates)**
    - **Validates: Requirements 2.4**
    - Generate random (row, col) within [0,32]×[0,39]; assert 6 unique neighbors
    - Generate random tile pairs; assert hexDistance ≤ actual path cost for unit with min-cost-1 steps
    - _File: `tests/pathfinding-engine.test.js`_

- [ ] 3. Implement `buildTileGraph` and `MinHeap` in `pathfinding-engine.js`
  - [ ] 3.1 Implement `buildTileGraph(tiles)` returning `Map<"row,col", tile>`
    - Expose on `PathfindingEngine`
    - _Requirements: 1.7, 7.1_

  - [ ] 3.2 Implement `MinHeap` class (binary min-heap keyed on `f`)
    - Implement `push(item)` (sift-up) and `pop()` (sift-down) and `isEmpty()`
    - Keep self-contained inside `pathfinding-engine.js`
    - _Requirements: 2.1, 8.3_

- [ ] 4. Implement A* `findPath` in `pathfinding-engine.js`
  - [ ] 4.1 Implement `PathfindingEngine.findPath(unitType, startRow, startCol, targetSet, tileGraph, getUnitAt)`
    - Use `MinHeap` for the open set, `Map` for gScore and parent
    - Compute heuristic as minimum `hexDistance` to any target tile
    - Skip tiles where `getMovementCost === Infinity` or `getUnitAt !== null`
    - Call `reconstructPath` to return ordered path from start (exclusive) to goal (inclusive)
    - Return `[]` when no path exists (no error thrown)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 4.2 Write property tests for `findPath` endpoints and validity (Properties 5, 6, 7, 12)
    - **Property 5: Returned path endpoints are correct**
    - **Validates: Requirements 2.1, 2.5**
    - **Property 6: Path never traverses invalid tiles**
    - **Validates: Requirements 2.7, 8.1, 8.2**
    - **Property 7: Empty path returned for unreachable targets**
    - **Validates: Requirements 2.6, 8.4**
    - **Property 12: Pathfinding is deterministic**
    - **Validates: Requirements 8.5**
    - Generate random grids with mixed passable/impassable tiles and random target sets
    - _File: `tests/pathfinding-engine.test.js`_

- [ ] 5. Checkpoint — validate `pathfinding-engine.js` in isolation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Create `js/game-logic/enemy-manager.js` — unit definitions and map analysis
  - [ ] 6.1 Implement `UNIT_DEFS` and `EnemyUnit` factory in `enemy-manager.js`
    - Define `Infantry`, `Archer`, `Cavalry`, `SiegeEngine` with `movePts` and `health`
    - Write `createUnit(type, row, col, id)` returning a plain EnemyUnit object
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 6.2 Implement `computeCastlePerimeter(tiles, tileGraph)` and `computeKeepTileSet(tiles)`
    - Use `CASTLE_STRUCTURE_CHARS` and `KEEP_CHARS` sets from the design
    - Deduplicate perimeter results; use `getMovementCost` (Infantry as representative type) to filter passable neighbors
    - Expose helpers internally; used by `executeTurn`
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 6.3 Write property test for `computeCastlePerimeter` (Property 9)
    - **Property 9: CastlePerimeter tiles are passable and adjacent to castle structure**
    - **Validates: Requirements 3.3**
    - Generate random level tile arrays; assert every perimeter tile is passable and has a castle-structure neighbor
    - _File: `tests/enemy-manager.test.js`_

  - [ ] 6.4 Implement `identifySpawnPoints(tiles, tileGraph)`
    - Find the row furthest from the `F` tile by absolute row distance
    - Filter to Infantry-passable tiles on that row; select evenly spaced columns (min 2)
    - _Requirements: 4.1, 4.2_

  - [ ]* 6.5 Write property test for `identifySpawnPoints` (Property 10)
    - **Property 10: SpawnPoints are on the correct row**
    - **Validates: Requirements 4.1**
    - Generate level grids with F tile at varying rows; assert all spawn points share the furthest row
    - _File: `tests/enemy-manager.test.js`_

- [ ] 7. Implement `EnemyManager` spawn and state API in `enemy-manager.js`
  - [ ] 7.1 Implement `EnemyManager.init()`, `EnemyManager.reset()`, and `EnemyManager.setCastleBreached(value)`
    - `init()` builds `_tileGraph` from `LevelLoader.getCurrentLevel().tiles` and calls `identifySpawnPoints`
    - `reset()` clears `_units` array and sets `_castleBreached = false`
    - `setCastleBreached(value)` coerces to boolean and stores on `_castleBreached`
    - Expose `getEnemyUnits()` and `getEnemyUnitAt(row, col)` for rendering and collision checks
    - _Requirements: 3.5, 7.3, 7.6_

  - [ ] 7.2 Implement `EnemyManager.spawnWave(waveConfig)`
    - Place units at spawn points in round-robin order per wave composition
    - If designated spawn point is occupied, BFS to find nearest unoccupied passable tile (Req 4.4)
    - _Requirements: 4.3, 4.4, 4.5, 6.5_

- [ ] 8. Implement `EnemyManager.executeTurn()` — pathfinding and movement
  - [ ] 8.1 Implement the `executeTurn()` movement loop
    - Rebuild `_tileGraph` from current level tiles each turn
    - Select `targetSet`: `computeCastlePerimeter` when `_castleBreached === false`, `computeKeepTileSet` when `true`
    - For each unit, call `PathfindingEngine.findPath` then advance unit by 1 tile via `moveUnit`
    - Re-verify destination passability and occupancy before committing each move (Req 5.5)
    - Update `unit.row` and `unit.col`; leave unit stationary when path is empty (Req 5.3)
    - Wrap `getUnitAt` calls in try/catch; treat errors as blocked (design error-handling table)
    - _Requirements: 2.8, 3.1, 3.2, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5, 7.3, 7.4, 7.5_

  - [ ]* 8.2 Write property tests for `executeTurn` two-phase targeting and unit movement (Properties 8 & 11)
    - **Property 8: Two-phase target selection correctness**
    - **Validates: Requirements 3.1, 3.2**
    - **Property 11: Enemy unit position reflects movement**
    - **Validates: Requirements 5.2, 5.4**
    - Construct minimal tile graphs with known perimeter/keep tiles; assert path terminations per phase
    - Assert unit row/col equals `path[0]` after move; assert `getEnemyUnitAt` lookups are consistent
    - _File: `tests/enemy-manager.test.js`_

- [ ] 9. Checkpoint — validate `enemy-manager.js` in isolation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Wire both files into the game and add integration test scaffolding
  - [ ] 10.1 Add `<script>` tags to `index.html` and the `executeTurn` call to `game-iso.js`
    - Insert `<script src="js/game-logic/pathfinding-engine.js"></script>` and `<script src="js/game-logic/enemy-manager.js"></script>` after `unit-manager.js` in `index.html`
    - Add `EnemyManager.init()` call inside `Game.startLevel()` after `LevelLoader` is ready
    - Add `EnemyManager.reset()` call inside `Game.startLevel()` for level restarts
    - Add `EnemyManager.executeTurn()` call inside `Game.update()` during the Enemy Phase (after player input, before resolve)
    - _Requirements: 7.1, 7.3, 7.5, 7.6_

  - [ ]* 10.2 Write integration unit tests confirming game-loop wiring contracts
    - Test that `EnemyManager.getEnemyUnits()` is populated after `spawnWave`
    - Test that `EnemyManager.reset()` leaves `getEnemyUnits()` empty
    - Test that `setCastleBreached(true)` followed by `executeTurn()` targets KeepTileSet
    - _File: `tests/enemy-manager.test.js`_

- [ ] 11. Final checkpoint — full test suite passes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All 13 correctness properties from the design are covered by property test sub-tasks
- Both new files follow the existing browser-global singleton pattern (no `module.exports`)
- Test files use `node:test` + `fast-check@3.23.2` and inline re-implementations of pure logic (no DOM, no `fetch`), matching the pattern in existing `unit-manager.spec.js` and `utils.spec.js`
- Run tests with: `node --test tests/pathfinding-engine.test.js tests/enemy-manager.test.js`
- Cavalry is classified as tree-eligible in `TREE_ELIGIBLE` but `UNIT_DEFS` shows `treeEligible: false` — the authoritative source is `TREE_ELIGIBLE` inside `pathfinding-engine.js` (see design note)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "3.2"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "4.1"] },
    { "id": 2, "tasks": ["4.2", "6.1", "6.2"] },
    { "id": 3, "tasks": ["6.3", "6.4", "7.1"] },
    { "id": 4, "tasks": ["6.5", "7.2"] },
    { "id": 5, "tasks": ["8.1"] },
    { "id": 6, "tasks": ["8.2", "10.1"] },
    { "id": 7, "tasks": ["10.2"] }
  ]
}
```
