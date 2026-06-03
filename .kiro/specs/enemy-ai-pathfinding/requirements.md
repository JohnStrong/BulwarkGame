# Requirements Document

## Introduction

This feature implements the Enemy AI Pathfinding system for the browser-based isometric hex-grid tower defense game. Enemy units spawn on the far edge of the map and navigate toward the castle in two phases: first breaching the outer castle perimeter (walls, towers, gatehouse), then targeting the keep interior once the castle has been breached. Pathfinding uses A* over a hex grid with terrain-weighted movement costs and unit-type-specific passability rules. The system integrates with the existing `LevelLoader`, `UnitManager`, and game-loop architecture.

---

## Glossary

- **EnemyUnit**: An AI-controlled unit with a type (Infantry, Archer, Cavalry, SiegeEngine), position (row, col), movement points, and pathfinding state.
- **EnemyManager**: The subsystem responsible for spawning, tracking, and executing turns for all active EnemyUnit instances.
- **PathfindingEngine**: The A* implementation that computes optimal hex-grid paths for a given EnemyUnit from its current position to a target tile set.
- **MovementCostTable**: A lookup structure mapping tile character codes to movement cost values for each EnemyUnit type.
- **TileGraph**: The runtime graph of passable hex tiles built from the current level's tile array, used as input to PathfindingEngine.
- **DynamicCostOverlay**: A `Map<"row,col", number>` of additional movement cost penalties computed each turn from the positions of all player units. Layered on top of the base MovementCostTable inside the A* edge-weight calculation.
- **ThreatSightRadius**: The set of hex tiles within 3 hex steps of a player unit's position — representing that unit's visible threat area. Defined as all tiles reachable from the player unit in exactly 1, 2, or 3 hex steps (the 18-tile hex ring surrounding the unit, matching the "immediate 18 pixels" intent expressed in hex-grid terms).
- **CombatCostTile**: A tile occupied by a player unit. These tiles are no longer treated as impassable but instead carry a movement cost of `3`, allowing the pathfinder to route through them when no lower-cost alternative exists. Moving onto a CombatCostTile represents the enemy choosing to engage and fight.
- **ThreatZoneWaterPenalty**: Water tiles (`~`) whose position falls within the ThreatSightRadius of any player unit receive an additional cost of `+2` (total cost `4`), making water under fire less desirable than open water (cost `2`) and less desirable than fighting through a player unit (cost `3`) in isolation.
- **SharedThreatMap**: A per-turn `Map<"row,col", number>` built by EnemyManager once from all known player unit positions and broadcast to PathfindingEngine for every unit's pathfinding call that turn. Represents the collective intelligence of the enemy force — any unit's observation is shared with all others.
- **SpawnPoint**: A tile on the enemy-side edge of the map designated as a valid origin for EnemyUnit placement at the start of a wave.
- **CastlePerimeter**: The set of tiles adjacent to castle structure tiles (W, T, G characters) that are themselves passable — the Phase 1 target ring.
- **KeepTileSet**: The set of tiles with characters K, j, J, F — the Phase 2 target for enemies after the castle has been breached.
- **castleBreached**: A boolean game-state flag. When `false`, enemies path to the CastlePerimeter. When `true`, enemies path to the KeepTileSet.
- **TreeEligible**: A property of EnemyUnit types (Archer, Cavalry) that allows passage through tree tiles (O, P, S characters). Non-tree-eligible types (Infantry, SiegeEngine) treat tree tiles as impassable.
- **HexNeighbors**: The six adjacent tiles in the offset hex grid topology as computed by the `hexToPixel` coordinate system (pointy-top, odd rows offset right).
- **EnemyPhase**: The game-loop phase during which all EnemyUnit instances execute their movement and attack actions for the current turn.

---

## Requirements

### Requirement 1: Tile Passability and Movement Cost Classification

**User Story:** As a game developer, I want each tile character to have a defined passability and movement cost per enemy unit type, so that pathfinding produces terrain-aware, unit-appropriate routes.

#### Acceptance Criteria

1. THE MovementCostTable SHALL assign a movement cost of `1` to grass tiles (`.`), flower tiles (`,`), road tiles (`D`), cobblestone bridge tiles (`=`), bailey tiles (`C`), and castle bridge tiles (`b`, `m`, `g`).
2. THE MovementCostTable SHALL assign a movement cost of `2` to water tiles (`~`).
3. THE MovementCostTable SHALL classify wall tiles (`W`), tower tiles (`T`), gatehouse tiles (`G`), and keep tiles (`K`, `j`, `J`, `F`) as impassable (infinite cost) for all EnemyUnit types.
4. THE MovementCostTable SHALL classify rock tiles (`R`) as impassable for all EnemyUnit types.
5. WHEN an EnemyUnit is tree-eligible (Archer or Cavalry type), THE MovementCostTable SHALL assign a movement cost of `1` to oak tiles (`O`), pine tiles (`P`), and shrub tiles (`S`).
6. WHEN an EnemyUnit is not tree-eligible (Infantry or SiegeEngine type), THE MovementCostTable SHALL classify oak tiles (`O`), pine tiles (`P`), and shrub tiles (`S`) as impassable.
7. THE TileGraph SHALL derive tile passability for a given EnemyUnit by applying the MovementCostTable to every tile in the level's tile array.

---

### Requirement 2: A* Pathfinding Engine

**User Story:** As a game developer, I want a correct A* pathfinding implementation over the hex grid, so that enemy units find optimal weighted paths to their targets each turn.

#### Acceptance Criteria

1. THE PathfindingEngine SHALL accept an EnemyUnit, a TileGraph, and a set of target tiles as inputs and return an ordered list of (row, col) positions representing the path from the EnemyUnit's current position to the nearest reachable target tile.
2. THE PathfindingEngine SHALL use the six HexNeighbors of each tile as the graph edges, computed using the same odd-row-offset topology as `hexToPixel` in `utils.js`.
3. THE PathfindingEngine SHALL compute edge weights using the MovementCostTable value for the destination tile and the EnemyUnit's type.
4. THE PathfindingEngine SHALL use the hex distance (minimum number of hex steps) between the current tile and the nearest target tile as the A* heuristic.
5. WHEN multiple target tiles exist in the target set, THE PathfindingEngine SHALL return the path to the nearest reachable target tile by accumulated movement cost.
6. IF no reachable path exists from the EnemyUnit's current position to any target tile, THEN THE PathfindingEngine SHALL return an empty path.
7. THE PathfindingEngine SHALL treat any tile occupied by a player unit (as reported by `UnitManager.getUnitAt(row, col)`) as a **CombatCostTile** with a movement cost of `3`, rather than as impassable. This allows enemy units to choose to engage when no lower-cost path exists.
8. THE PathfindingEngine SHALL run once per EnemyUnit per turn, immediately before that unit's movement step in the EnemyPhase.

---

### Requirement 3: Two-Phase Pathfinding Target Selection

**User Story:** As a player, I want enemy units to first assault the castle walls and only advance on the keep after the castle is breached, so that the castle structure serves as a meaningful defensive barrier.

#### Acceptance Criteria

1. WHILE `castleBreached` is `false`, THE PathfindingEngine SHALL use the CastlePerimeter as the target tile set for all EnemyUnit path computations.
2. WHILE `castleBreached` is `true`, THE PathfindingEngine SHALL use the KeepTileSet (all tiles with characters K, j, J, F) as the target tile set for all EnemyUnit path computations.
3. THE EnemyManager SHALL define CastlePerimeter as the collection of passable tiles that are HexNeighbors of at least one castle structure tile (W, T, G, K, j, J, F) in the current level.
4. WHEN `castleBreached` transitions from `false` to `true`, THE EnemyManager SHALL immediately recalculate the target tile set for all active EnemyUnit instances on their next movement step.
5. THE EnemyManager SHALL expose a `setCastleBreached(value)` method that updates the `castleBreached` flag and is callable by the game-loop's Resolve Phase.

---

### Requirement 4: Enemy Spawn System

**User Story:** As a player, I want enemy units to spawn from multiple points on the far edge of the map, so that the castle is threatened from several directions and the defense challenge is varied.

#### Acceptance Criteria

1. THE EnemyManager SHALL identify SpawnPoints as tiles located on the row furthest from the castle keep (F tile row) along the map's row axis, restricted to passable terrain types (grass, flowers, road, water).
2. THE EnemyManager SHALL support a minimum of two SpawnPoints per level, distributed across the enemy-side edge columns.
3. WHEN a wave begins, THE EnemyManager SHALL place each EnemyUnit at an assigned SpawnPoint tile, provided that SpawnPoint tile is not already occupied by another EnemyUnit.
4. IF a designated SpawnPoint tile is occupied at spawn time, THEN THE EnemyManager SHALL place the new EnemyUnit at the nearest unoccupied passable tile adjacent to that SpawnPoint.
5. THE EnemyManager SHALL assign EnemyUnit types to SpawnPoints according to the wave's unit composition definition, distributing unit types across available SpawnPoints.

---

### Requirement 5: Enemy Movement Execution

**User Story:** As a player, I want to see enemy units physically advance across the map each turn along their computed paths, so that the enemy threat is visually clear and the game feels dynamic.

#### Acceptance Criteria

1. WHEN the EnemyPhase begins, THE EnemyManager SHALL iterate over all active EnemyUnit instances in a defined order and execute each unit's movement step.
2. WHEN an EnemyUnit executes its movement step, THE EnemyManager SHALL move the EnemyUnit along the path returned by PathfindingEngine by one tile per turn.
3. IF PathfindingEngine returns an empty path for an EnemyUnit, THEN THE EnemyManager SHALL leave that EnemyUnit stationary for the current turn.
4. THE EnemyManager SHALL update each EnemyUnit's (row, col) position after movement and ensure `UnitManager.getUnitAt` reflects the new position for subsequent pathfinding calls within the same turn.
5. WHILE an EnemyUnit is moving, THE EnemyManager SHALL enforce that the destination tile is passable for that unit's type and is not occupied by another unit before completing the move.

---

### Requirement 6: Enemy Unit Type Definitions

**User Story:** As a game developer, I want each enemy unit type to have defined movement, tree eligibility, and classification properties, so that unit-specific pathfinding rules are consistently applied.

#### Acceptance Criteria

1. THE EnemyManager SHALL define four enemy unit types: Infantry, Archer, Cavalry, and SiegeEngine.
2. THE EnemyManager SHALL classify Archer and Cavalry as tree-eligible unit types, permitting passage through tree tiles (O, P, S).
3. THE EnemyManager SHALL classify Infantry and SiegeEngine as non-tree-eligible unit types, treating tree tiles as impassable.
4. THE EnemyManager SHALL associate each enemy unit type with a movement-points-per-turn value: Infantry `2`, Archer `2`, Cavalry `3`, SiegeEngine `1`.
5. WHERE a level's wave definition specifies a unit type composition, THE EnemyManager SHALL spawn EnemyUnit instances matching that composition.

---

### Requirement 7: Integration with Game Loop and Level Data

**User Story:** As a game developer, I want the pathfinding system to integrate cleanly with the existing LevelLoader tile data and game-loop phases, so that no existing systems require breaking changes.

#### Acceptance Criteria

1. THE TileGraph SHALL be constructed from `LevelLoader.getCurrentLevel().tiles`, reading each tile's `sprite` property to determine terrain type and using the tile's `row` and `col` for graph node identity.
2. THE PathfindingEngine SHALL derive tile character classification by mapping tile sprite names back to their source characters using the same mapping defined in `LevelLoader.parseLevelText`.
3. THE EnemyManager SHALL be invoked during the EnemyPhase of the game loop, after the Player Phase completes and before the Resolve Phase begins.
4. WHEN `UnitManager.getUnitAt(row, col)` returns a non-null value for a tile, THE PathfindingEngine SHALL treat that tile as blocked for pathfinding regardless of terrain type.
5. THE EnemyManager SHALL not modify any existing `LevelLoader`, `UnitManager`, or `IsoRenderer` internal state directly; all interactions SHALL occur through their documented public APIs.
6. THE EnemyManager SHALL expose a `reset()` method that clears all active EnemyUnit instances and resets `castleBreached` to `false`, callable on level restart.

---

### Requirement 8: Pathfinding Correctness and Performance Constraints

**User Story:** As a player, I want enemy pathfinding to be correct and responsive each turn, so that the game does not stall and enemy behavior is predictable.

#### Acceptance Criteria

1. THE PathfindingEngine SHALL produce paths that never traverse impassable tiles as defined by the MovementCostTable for the given EnemyUnit type.
2. THE PathfindingEngine SHALL produce paths that are optimal (lowest total movement cost) among all paths to the target tile set, for the given EnemyUnit type.
3. WHEN the hex grid contains up to 40 columns and 33 rows (matching `level1.txt` dimensions), THE PathfindingEngine SHALL complete path computation for a single EnemyUnit within a single synchronous execution frame without perceptible frame-rate impact.
4. THE PathfindingEngine SHALL handle disconnected graphs (island tiles with no valid path to the target) by returning an empty path rather than throwing an error.
5. THE PathfindingEngine SHALL produce consistent results for identical inputs across multiple invocations within the same game state.

---

### Requirement 9: Dynamic Cost Overlay — Player Unit Combat Cost and Threat Zones

**User Story:** As a player, I want enemy units to weigh up fighting through my troops versus routing around them through dangerous terrain, so that unit placement creates genuine tactical decisions rather than hard walls.

#### Acceptance Criteria

1. THE PathfindingEngine SHALL apply a movement cost of `3` to any tile occupied by a player unit, replacing the previous impassable classification. This cost represents the enemy choosing to fight rather than route around.
2. THE PathfindingEngine SHALL compute a ThreatSightRadius of 3 hex steps around each player unit's position each turn, producing the set of all tiles within that radius.
3. WHEN a water tile (`~`) falls within the ThreatSightRadius of any player unit, THE PathfindingEngine SHALL assign it a total movement cost of `4` (base water cost `2` + threat zone penalty `+2`).
4. THE DynamicCostOverlay SHALL be computed by EnemyManager once per turn before any unit's `findPath` call, by iterating over all player unit positions from `UnitManager.getPlacedUnits()`.
5. THE DynamicCostOverlay SHALL be a `Map<"row,col", number>` containing only tiles whose effective cost differs from the base MovementCostTable value — that is, only CombatCostTiles and threat-zone water tiles.
6. THE PathfindingEngine SHALL accept the DynamicCostOverlay as a parameter in `findPath` and apply it as a final cost modifier after the base MovementCostTable lookup: `effectiveCost = overlay.has(key) ? overlay.get(key) : baseCost`.
7. WHEN no player units are placed on the map, THE DynamicCostOverlay SHALL be empty and `findPath` SHALL behave identically to the base MovementCostTable rules.
8. THE cost ordering SHALL satisfy: passable terrain (cost `1`) < water (cost `2`) < fighting a player unit (cost `3`) < water under fire (cost `4`). This ordering ensures enemies prefer open routes, tolerate water, choose combat over running through fire, and avoid contested water as a last resort.

---

### Requirement 10: Shared Enemy Intelligence via EnemyManager

**User Story:** As a player, I want enemy units to act as a coordinated force — sharing knowledge of player unit positions — so that individually blocking one unit doesn't neutralise an entire wave.

#### Acceptance Criteria

1. THE EnemyManager SHALL build the SharedThreatMap once per turn at the start of `executeTurn()`, before any individual enemy unit's pathfinding call.
2. THE SharedThreatMap SHALL incorporate the positions of all player units currently on the map, as returned by `UnitManager.getPlacedUnits()`, regardless of which enemy unit can physically see them.
3. THE EnemyManager SHALL pass the same SharedThreatMap to every `PathfindingEngine.findPath` call within that turn, ensuring all active enemy units use identical cost information.
4. WHEN a player unit is placed or removed between turns, THE EnemyManager SHALL rebuild the SharedThreatMap from scratch at the start of the next `executeTurn()` call, ensuring it always reflects the current game state.
5. THE SharedThreatMap SHALL be the sole source of player unit position data for pathfinding cost computation — individual enemy units SHALL NOT query `UnitManager.getUnitAt` independently during path computation.
6. THE EnemyManager SHALL expose the current SharedThreatMap via a `getSharedThreatMap()` method for debugging and testing purposes.
