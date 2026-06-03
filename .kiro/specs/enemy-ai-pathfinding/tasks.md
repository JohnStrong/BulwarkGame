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
  - [ ] 4.1 Implement `PathfindingEngine.findPath(unitType, startRow, startCol, targetSet, tileGraph, dynamicCostOverlay)`
    - Use `MinHeap` for the open set, `Map` for gScore and parent
    - Compute heuristic as minimum `hexDistance` to any target tile
    - Skip tiles where base `getMovementCost === Infinity` (walls, rock, keep)
    - Apply `dynamicCostOverlay`: `effectiveCost = overlay.has(key) ? overlay.get(key) : baseCost`
    - Player-occupied tiles are no longer skipped — they carry overlay cost 3 and are traversable
    - Call `reconstructPath` to return ordered path from start (exclusive) to goal (inclusive)
    - Return `[]` when no path exists (no error thrown); treat `null`/`undefined` overlay as empty Map
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7 (revised), 8.1, 8.2, 8.3, 8.4, 8.5, 9.6_

  - [ ]* 4.2 Write property tests for `findPath` endpoints, validity, and cost ordering (Properties 5, 6, 7, 12)
    - **Property 5: Returned path endpoints are correct**
    - **Validates: Requirements 2.1, 2.5**
    - **Property 6 (revised): Path cost ordering is respected**
    - **Validates: Requirements 2.7 (revised), 9.1, 9.8**
    - **Property 7: Empty path returned for unreachable targets**
    - **Validates: Requirements 2.6, 8.4**
    - **Property 12: Pathfinding is deterministic**
    - **Validates: Requirements 8.5**
    - Generate random grids; verify A* picks the lower-cost route when a combat tile (cost 3) and an open route (cost 1) both lead to the target
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
    - `init()` builds tile graph from level tiles and calls `identifySpawnPoints`
    - `reset()` clears `_units`, sets `_castleBreached = false`, clears `_lastSeenRegistry`, clears `_worldKnowledgeMap`
    - `setCastleBreached(value)` coerces to boolean and stores on `_castleBreached`
    - Expose `getEnemyUnits()`, `getEnemyUnitAt(row, col)`, `getLastSeenRegistry()`, `getWorldKnowledgeMap()`, `getSharedThreatMap()`
    - _Requirements: 3.5, 7.3, 7.6, 12.7, 13.8, 13.9_

  - [ ] 7.2 Implement `EnemyManager.spawnWave(waveConfig)`
    - Build `_worldKnowledgeMap` from `LevelLoader.getCurrentLevel().tiles` (terrain only — no player unit data)
    - Place units at spawn points in round-robin order per wave composition
    - If designated spawn point is occupied, BFS to find nearest unoccupied passable tile (Req 4.4)
    - _Requirements: 4.3, 4.4, 4.5, 6.5, 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 8. Implement `EnemyManager.executeTurn()` — sighting, registry, pathfinding and movement
  - [ ] 8.1 Implement the `executeTurn(currentTurn)` movement loop
    - Purge dead player units from `_lastSeenRegistry` by cross-referencing `UnitManager.getPlacedUnits()`
    - Sight pass: for each EnemyUnit, compute `computeEnemyVisibleTiles` and call `_recordSighting` for any player unit in visible tiles
    - Call `PathfindingEngine.buildSharedThreatMap(_lastSeenRegistry, this._units, _worldKnowledgeMap)` ONCE per turn; store as `_sharedThreatMap`
    - Select `targetSet`: `computeCastlePerimeter` when `_castleBreached === false`, `computeKeepTileSet` when `true`
    - For each unit, call `PathfindingEngine.findPath(unit.type, unit.row, unit.col, targetSet, _worldKnowledgeMap, _sharedThreatMap)`
    - Advance unit by 1 tile via `moveUnit`; leave unit stationary when path is empty (Req 5.3)
    - Re-verify terrain passability (walls/keep/rock still `Infinity`) before committing move
    - Allow movement onto player-occupied tiles (combat cost 3); flag for Resolve Phase
    - Block movement onto tiles occupied by another enemy unit
    - Wrap `getPlacedUnits` and sight pass in try/catch; treat errors as empty sighting
    - _Requirements: 2.8, 3.1, 3.2, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5, 7.3, 7.4, 7.5, 9.4, 10.1, 10.3, 10.4, 13.2, 13.3, 13.4, 13.7, 14.1_

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

- [ ] 12. Implement `PathfindingEngine.hexRing`, `computeEnemyVisibleTiles`, and `buildSharedThreatMap`
  - [ ] 12.1 Implement `hexRing(row, col, radius, tileGraph)` in `pathfinding-engine.js`
    - BFS from `(row, col)` up to `radius` hex steps using `hexNeighbors`
    - Skip tiles not present in `tileGraph` (out-of-bounds guard)
    - Return array of tile objects within the ring (all steps 1 through `radius`)
    - Expose on `PathfindingEngine`
    - _Requirements: 9.2_

  - [ ] 12.2 Implement `PathfindingEngine.computeEnemyVisibleTiles(row, col, tileGraph)`
    - Check if the enemy unit's own tile is a tree (`O`, `P`, `S`) — if so, all 6 directions capped at 1
    - For each of the 6 hex directions: check if immediate neighbor is a tree tile; if so, cap that direction at 1; otherwise use 3
    - Raycast along each direction up to its sight distance, stopping at impassable tiles (W, T, G, K, j, J, F, R)
    - Return Set of visible tile objects (excluding the unit's own tile)
    - Expose on `PathfindingEngine`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.7, 11.8_

  - [ ] 12.3 Implement `PathfindingEngine.buildSharedThreatMap(lastSeenRegistry, activeEnemyUnits, tileGraph)`
    - For each entry in `lastSeenRegistry.values()`: set `overlay.set(tileKey(entry.row, entry.col), 3)` (last-seen combat cost)
    - Build collective enemy visible set: union of `computeEnemyVisibleTiles` for all `activeEnemyUnits`
    - Expand `hexRing(entry.row, entry.col, 3, tileGraph)` for each last-seen entry
    - For each water tile in ring: only apply cost `4` if tile key is in enemy visible set
    - Never lower an existing overlay entry; never override `Infinity` base costs
    - Return empty Map when both `lastSeenRegistry` and `activeEnemyUnits` are empty/null
    - Expose on `PathfindingEngine`
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.7, 10.2, 11.5, 11.6, 13.5, 14.3, 14.4, 14.5_

  - [ ]* 12.4 Write property tests for `computeEnemyVisibleTiles` (Properties 18, 19, 20)
    - **Property 18: Open terrain gives 3-step sight in unblocked directions**
    - **Validates: Requirements 11.1, 11.2**
    - **Property 19: Tree adjacency caps only the blocked direction to 1**
    - **Validates: Requirements 11.2, 11.3**
    - **Property 20: Unit on tree tile sees at most 6 immediate neighbors**
    - **Validates: Requirement 11.7**
    - Build minimal tile graphs with known tree positions; assert returned tile sets match expected sight cones
    - _File: `tests/pathfinding-engine.test.js`_

  - [ ]* 12.5 Write property tests for updated `buildSharedThreatMap` (Properties 15, 16, 21)
    - **Property 15 (updated): Threat-zone water costs 4 only when visible to enemies**
    - **Validates: Requirements 9.3, 11.5, 11.6**
    - **Property 16: Empty overlay when no player units or enemy units are present**
    - **Validates: Requirement 9.7**
    - **Property 21: Water penalty only on enemy-visible tiles**
    - **Validates: Requirements 11.5, 11.6**
    - Generate grids where player unit threat radius overlaps water both inside and outside enemy sight; assert only visible water gets cost 4
    - _File: `tests/pathfinding-engine.test.js`_

- [ ] 13. Checkpoint — validate `computeEnemyVisibleTiles`, `buildSharedThreatMap`, and updated `findPath` in isolation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Add `getSharedThreatMap()` to EnemyManager and write SharedThreatMap integration tests
  - [ ] 14.1 Add `EnemyManager.getSharedThreatMap()` returning `_sharedThreatMap` (the Map built during last `executeTurn`)
    - Returns `null` before the first `executeTurn` call
    - _Requirements: 10.6_

  - [ ]* 14.2 Write property and integration tests for SharedThreatMap broadcast (Property 17)
    - **Property 17: SharedThreatMap is identical for all units in the same turn**
    - **Validates: Requirements 10.3, 10.5**
    - Spy on `PathfindingEngine.findPath` calls within one `executeTurn`; assert all receive the same overlay Map reference
    - Assert `getSharedThreatMap()` reflects the most recent turn's player unit positions
    - _File: `tests/enemy-manager.test.js`_

- [ ] 15. Final checkpoint — full test suite passes with all new overlay and threat-map tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Implement `WorldKnowledgeMap` and `LastSeenRegistry` in `enemy-manager.js`
  - [ ] 16.1 Implement `buildWorldKnowledgeMap(tiles)` as a static terrain-only TileGraph
    - Copy all terrain tiles from `LevelLoader.getCurrentLevel().tiles` into a `Map<"row,col", tile>`
    - Include grass, road, water, bridge, forest, castle structures — no filtering needed since tiles never contain player unit data directly
    - Store as `EnemyManager._worldKnowledgeMap`; expose via `getWorldKnowledgeMap()`
    - Called inside `spawnWave()` before units are placed
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ] 16.2 Implement `_lastSeenRegistry`, `_recordSighting(playerUnit, currentTurn)`, `_purgeDead(placedUnits)`, and `_expireStale(currentTurn)`
    - `_lastSeenRegistry`: `Map<string, { row, col, turn }>` — keyed by `unit.id ?? tileKey(unit.row, unit.col)`
    - `_recordSighting`: upserts `{ row, col, turn }` for the given player unit; refreshes expiry clock for re-sightings
    - `_purgeDead`: removes any registry entries whose key is not present in the alive-unit key set from `UnitManager.getPlacedUnits()`
    - `_expireStale(currentTurn)`: removes any entry where `currentTurn - entry.turn > SIGHTING_EXPIRY_TURNS` (default `10`)
    - Define `SIGHTING_EXPIRY_TURNS = 10` as a named constant — not a magic number
    - Expose `getLastSeenRegistry()` returning the Map directly for testing
    - Clear `_lastSeenRegistry` inside `reset()`
    - _Requirements: 13.1, 13.2, 13.4, 13.7, 13.8, 13.9, 13.11, 13.12, 13.13_

  - [ ]* 16.3 Write unit and property tests for `WorldKnowledgeMap`, `LastSeenRegistry`, and sighting expiry (Properties 22, 23, 24, 25, 26)
    - **Property 22: WorldKnowledgeMap contains no player unit data**
    - **Validates: Requirements 12.2, 12.3**
    - **Property 23: Pathfinding ignores unseen player units**
    - **Validates: Requirements 12.6, 14.6**
    - **Property 24: LastSeenRegistry persists last-seen position after player unit moves**
    - **Validates: Requirements 13.6, 13.10**
    - **Property 25: LastSeenRegistry clears dead player units**
    - **Validates: Requirement 13.7**
    - **Property 26: LastSeenRegistry entries expire after SIGHTING_EXPIRY_TURNS**
    - **Validates: Requirements 13.11, 13.12, 13.13**
    - Test: `findPath` routes through a player-unit tile at base terrain cost when no registry entry exists
    - Test: `findPath` applies cost 3 to that tile after a sighting is recorded
    - Test: after player unit is removed, cost 3 is no longer applied to its last-seen tile
    - Test: entry with `turn=0` is expired at `currentTurn=11`, not at `currentTurn=10`
    - Test: re-sighting a unit on the same turn it would expire resets the clock to current turn
    - _File: `tests/enemy-manager.test.js`_

- [ ] 17. Wire sight pass and LastSeenRegistry into `executeTurn` and validate integration
  - [ ] 17.1 Integrate sight pass, expiry, and LastSeenRegistry into `executeTurn(currentTurn)`
    - Call `_purgeDead(UnitManager.getPlacedUnits())` at the start of each turn
    - Call `_expireStale(currentTurn)` after purge, before sight pass
    - For each EnemyUnit, call `computeEnemyVisibleTiles` and cross-reference with `UnitManager.getPlacedUnits()` to find sightings
    - Call `_recordSighting` for each spotted player unit
    - Pass `_lastSeenRegistry` to `buildSharedThreatMap` instead of `placedUnits`
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.7, 13.11, 13.14, 14.1_

  - [ ]* 17.2 Write integration tests for the full sight→registry→expiry→overlay→pathfinding pipeline
    - Test: enemy on open terrain with player unit in sight → registry updated → overlay gets cost 3 → path routes around
    - Test: player unit moves out of sight → registry retains old position → overlay still shows cost 3 at last-seen tile
    - Test: player unit killed → purge removes registry entry → overlay no longer penalises that tile
    - Test: enemy in woodland (all directions capped at 1) → player unit 2 hex away → NOT sighted → registry NOT updated
    - Test: sighting recorded at turn 5 → not re-sighted → at turn 16 (`5 + 10 + 1`) entry is expired → overlay reverts to base cost
    - Test: sighting at turn 5, re-sighted at turn 14 → expiry clock resets to turn 14 → not expired until turn 25
    - _File: `tests/enemy-manager.test.js`_

- [ ] 18. Final checkpoint — full test suite passes including knowledge/sighting integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Implement `EngagementZoneRegistry` and zone clustering in `enemy-manager.js`
  - [ ] 19.1 Define zone constants and `EngagementZone` data shape
    - Define `ZONE_CLUSTER_RADIUS = 6`, `ZONE_AVOIDANCE_COST = 5`, `ENGAGE_HP_RATIO = 1.5`, `MAX_ARMY_COMMIT_FRACTION = 0.40` as named constants with comments
    - Document each constant's tactical meaning
    - Define `EngagementZone` shape: `{ id, centreRow, centreCol, observationCount, lastObservedTurn, estimatedThreatHP, strategy }`
    - Initialise `_engagementZoneRegistry = []` in EnemyManager
    - Expose `getEngagementZoneRegistry()` returning the array
    - Clear `_engagementZoneRegistry` in `reset()`
    - _Requirements: 15.1, 15.5, 15.6, 17.1, 17.2_

  - [ ] 19.2 Implement `_updateEngagementZones(lastSeenRegistry, currentTurn)`
    - For each entry in `lastSeenRegistry`: find existing zone within `ZONE_CLUSTER_RADIUS` via `hexDistance`
    - If found: increment `observationCount`, update `lastObservedTurn`
    - If not found: create new zone centred on sighting position with `observationCount=1`
    - Recompute `estimatedThreatHP` for all zones from current `lastSeenRegistry` entries within each zone's radius
    - _Requirements: 15.2, 15.3_

  - [ ]* 19.3 Write property tests for zone clustering (Property 27)
    - **Property 27: EngagementZone cluster radius is respected**
    - **Validates: Requirement 15.2**
    - Generate random sighting pairs with known hex distances; assert same-zone vs separate-zone outcomes match ZONE_CLUSTER_RADIUS boundary
    - _File: `tests/enemy-manager.test.js`_

- [ ] 20. Implement zone strategy evaluation in `enemy-manager.js`
  - [ ] 20.1 Implement `_isZoneActive(zone, currentTurn)` helper
    - Returns `true` if `currentTurn - zone.lastObservedTurn <= SIGHTING_EXPIRY_TURNS`
    - _Requirements: 15.4, 16.9_

  - [ ] 20.2 Implement `_evaluateZoneStrategies(currentTurn, activeEnemyUnits, worldKnowledgeMap, overlay)`
    - For each Active zone: apply AVOID zone penalty probe to temp overlay; run A* probe with Infantry to test if zone is avoidable
    - If avoidable: set `zone.strategy = 'AVOID'`; add zone penalty to `zoneOverlayPenalties`
    - If not avoidable: check `ENGAGE_HP_RATIO` and `MAX_ARMY_COMMIT_FRACTION` conditions; assign strike force if viable; else fall back to `AVOID`
    - Dormant zones: set `zone.strategy = 'MONITOR'`; no overlay penalty
    - Return `strikeForceAssignments: Map<zoneId, EnemyUnit[]>` and `zoneOverlayPenalties: Map<tileKey, number>`
    - Guard against assigning all units to strike forces; standard pathfinding must retain at least some units
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10_

  - [ ]* 20.3 Write property tests for zone strategy selection (Properties 28, 29, 30)
    - **Property 28: Dormant zones produce no overlay penalty**
    - **Validates: Requirements 15.4, 16.9**
    - **Property 29: AVOID always preferred when clear route exists**
    - **Validates: Requirements 16.2, 16.4b**
    - **Property 30: MAX_ARMY_COMMIT_FRACTION cap never exceeded**
    - **Validates: Requirements 16.6, 16.8**
    - Test: dormant zone (last observed 15 turns ago) → no penalty in overlay
    - Test: zone with alternate clear route → AVOID strategy selected regardless of available HP
    - Test: three simultaneous ENGAGE-eligible zones → total committed HP stays below 40% of army HP
    - _File: `tests/enemy-manager.test.js`_

- [ ] 21. Wire zone system into `executeTurn` and update `buildSharedThreatMap`
  - [ ] 21.1 Update `executeTurn(currentTurn)` to call zone update and strategy evaluation
    - After sight pass, call `_updateEngagementZones(_lastSeenRegistry, currentTurn)`
    - Call `_evaluateZoneStrategies(...)` to get `zoneOverlayPenalties` and `strikeForceAssignments`
    - Pass `zoneOverlayPenalties` to `buildSharedThreatMap`
    - For each unit in a `strikeForceAssignment`: override `targetSet` with zone centre for that unit's `findPath` call
    - _Requirements: 15.2, 16.7, 16.10_

  - [ ] 21.2 Update `PathfindingEngine.buildSharedThreatMap` signature to accept `zoneOverlayPenalties`
    - Add Step 3 to overlay build: for each `[key, penalty]` in `zoneOverlayPenalties`, add penalty to existing cost (additive on top of base and last-seen costs); never override `Infinity`
    - _Requirements: 16.3, 16.10_

  - [ ]* 21.3 Write integration tests for full zone strategy → pathfinding pipeline
    - Test: repeated sightings at same location → zone created with observationCount > 1
    - Test: Active AVOID zone → enemy path routes around zone tiles
    - Test: zone with no alternative route + sufficient HP → ENGAGE strategy selected → strike force unit targets zone centre
    - Test: zone with no alternative route + insufficient HP → falls back to AVOID
    - Test: multiple ENGAGE zones competing for budget → cap enforced, later zones fall back to AVOID
    - _File: `tests/enemy-manager.test.js`_

- [ ] 22. Final checkpoint — full test suite passes including zone strategy integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All 30 correctness properties from the design are covered by property test sub-tasks
- Both new files follow the existing browser-global singleton pattern (no `module.exports`)
- Test files use `node:test` + `fast-check@3.23.2` and inline re-implementations of pure logic (no DOM, no `fetch`), matching the pattern in existing `unit-manager.spec.js` and `utils.spec.js`
- Run tests with: `node --test tests/pathfinding-engine.test.js tests/enemy-manager.test.js`
- Cavalry is classified as tree-eligible in `TREE_ELIGIBLE` but `UNIT_DEFS` shows `treeEligible: false` — the authoritative source is `TREE_ELIGIBLE` inside `pathfinding-engine.js` (see design note)
- **Key behavioural change from original spec**: player-occupied tiles are no longer impassable (cost ∞). They carry a combat cost of `3` via the DynamicCostOverlay, allowing enemies to choose to fight when routing is costlier. The `findPath` signature changed from `getUnitAt` callback to `dynamicCostOverlay` Map — update any existing test stubs accordingly.
- ThreatSightRadius is defined as 3 hex steps (BFS radius = 3), producing up to 18 surrounding tiles — matching the "immediate 18 pixels" intent expressed in hex-grid terms.
- Enemy directional sight: base 3 hex steps per direction; reduced to 1 in any direction where the immediate neighbor is a tree tile; all directions reduced to 1 when the enemy itself is on a tree tile. Water penalty is only applied to tiles visible to at least one enemy unit.
- `buildSharedThreatMap` signature updated: now takes `(lastSeenRegistry, activeEnemyUnits, tileGraph)` — replaces previous `placedUnits` parameter. Update all call sites and test stubs.
- `SIGHTING_EXPIRY_TURNS = 10` constant defined in `enemy-manager.js`. After 10 cost-turns with no re-sighting, a registry entry is expired and the tile reverts to base terrain cost. The expiry runs before the sight pass each turn, so a unit re-sighted on the expiry turn gets a fresh entry.
- `WorldKnowledgeMap` replaces the live tile array as the pathfinding base graph. Static snapshot built at `spawnWave()`. Never contains player unit positions.
- `executeTurn` now takes a `currentTurn` parameter for registry timestamping.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "3.2"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "4.1"] },
    { "id": 2, "tasks": ["4.2", "6.1", "6.2"] },
    { "id": 3, "tasks": ["6.3", "6.4", "7.1"] },
    { "id": 4, "tasks": ["6.5", "7.2", "12.1", "12.2", "16.1"] },
    { "id": 5, "tasks": ["8.1", "12.3", "16.2", "19.1"] },
    { "id": 6, "tasks": ["8.2", "10.1", "12.4", "12.5", "16.3", "19.2"] },
    { "id": 7, "tasks": ["10.2", "14.1", "17.1", "19.3", "20.1", "20.2"] },
    { "id": 8, "tasks": ["14.2", "17.2", "20.3", "21.1", "21.2"] },
    { "id": 9, "tasks": ["21.3"] }
  ]
}
```
- `LastSeenRegistry` is the single source of truth for enemy knowledge of player units. Persists last-seen position across turns; entries expire after `SIGHTING_EXPIRY_TURNS=10` turns of no re-sighting; cleared on kill or level restart.
