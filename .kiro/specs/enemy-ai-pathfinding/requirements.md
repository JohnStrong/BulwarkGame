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
- **DirectionalSightRadius**: The per-direction view distance of an EnemyUnit. Defaults to `3` hex steps in each of the six hex directions on open terrain. Reduced to `1` in any direction where the immediate neighbor in that direction is a tree tile. If the enemy unit itself occupies a tree tile, all six directions are capped at `1`.
- **EnemyVisibleTiles**: The set of tiles an EnemyUnit can observe from its current position, computed by raycasting up to the directional view distance in each of the six hex directions. Used to determine which water tiles receive the ThreatZoneWaterPenalty in the SharedThreatMap.
- **WorldKnowledgeMap**: A static snapshot of the level's terrain taken at wave spawn time. Contains the position and type of all terrain tiles (grass, road, water, bridge, forest, castle structures). Does NOT include player unit positions, player-built defenses, or any dynamic game object. Used as the base cost graph for pathfinding.
- **LastSeenRegistry**: A `Map<playerId, { row, col, turn }>` maintained by EnemyManager. Records the last physically observed position and observation turn of every player unit that any enemy unit has ever sighted. Entries persist until a new sighting updates them, the unit is killed, or the entry expires after `SIGHTING_EXPIRY_TURNS` turns of no re-sighting. Cleared on level restart.
- **SIGHTING_EXPIRY_TURNS**: The number of cost-turns after which a `LastSeenRegistry` entry is considered stale and removed. Default: `10`. At a rate of 1 cost-turn ≈ 1 real-world second, this equals approximately 10 seconds of unconfirmed intelligence.
- **ObservedKnowledge**: The combined intelligence available to the enemy force at any point: the static WorldKnowledgeMap (terrain) plus the dynamic DynamicCostOverlay built from the LastSeenRegistry (observed player unit positions) and the enemy visible tile set (threat-zone water penalties).
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

---

### Requirement 11: Directional Enemy View Distance — Tree Occlusion

**User Story:** As a player, I want enemy units to have reduced visibility when moving near woodland, so that I can set up ambushes in and around forests to surprise and pick off enemies before they can react.

#### Acceptance Criteria

1. EACH EnemyUnit SHALL have a base view distance of `3` hex steps in all six hex directions when on open terrain (grass, road, bridge, water, bailey, flowers).
2. FOR each of the six hex directions from an EnemyUnit's current position, THE view distance in that direction SHALL be reduced to `1` hex step IF the immediate neighbor tile in that direction is a tree tile (overlay character `O`, `P`, or `S`).
3. THE directional view distance SHALL be computed per direction independently — a unit surrounded by trees on three sides has view distance `3` in the remaining three open directions and view distance `1` in the three blocked directions.
4. AN EnemyUnit's visible tile set SHALL be computed as the union of all tiles reachable within the allowed view distance along each of the six hex directions, stopping at the first impassable tile (wall, keep, rock) in that direction.
5. THE visible tile set IS USED SOLELY to determine which tiles the enemy unit contributes to the SharedThreatMap — specifically, which water tiles receive the ThreatZoneWaterPenalty (cost `4`). The enemy unit's own combat-cost tile (cost `3`) is always added to the overlay regardless of view distance.
6. WHEN `buildSharedThreatMap` is called, it SHALL compute the directional visible tile set for each enemy unit's current position and use those sets — rather than a uniform 3-step BFS ring — to determine which water tiles are penalised.

   > **Clarification on direction of application:** The ThreatSightRadius defined in Requirement 9 models what *player units* can see and threaten (affecting where enemies are afraid to swim). Requirement 11 models what *enemy units* can see — specifically, which tiles they are *aware* of and can react to. In `buildSharedThreatMap`, the visible tiles of player units (Req 9) and the visible tiles of enemy units (Req 11) combine: a water tile is penalised only if it is both within a *player unit's* threat radius AND visible to at least one enemy unit. This prevents enemies from fearing player units they genuinely cannot see.

7. IF an EnemyUnit is itself positioned on a tree tile (tree-eligible units may enter tree tiles), THE view distance SHALL be `1` in ALL six directions — the unit is fully inside woodland and moving effectively blind.
8. THE directional view occlusion applies only to tree tiles. Other terrain types (water, road, grass, rock, walls) do not reduce view distance in adjacent directions.
9. THE `buildSharedThreatMap` function SHALL accept the list of active EnemyUnit positions in addition to placed player units, so it can compute the combined threat map that reflects what enemies can collectively observe.


---

### Requirement 12: World Knowledge Map — Static Terrain Briefing

**User Story:** As a game developer, I want enemy units to begin each wave with awareness of the battlefield's static terrain layout, so that they can navigate purposefully toward the castle from the outset rather than wandering blind into unknown territory.

#### Acceptance Criteria

1. THE EnemyManager SHALL initialise a `WorldKnowledgeMap` at the start of each wave (when `spawnWave` is called), derived from the current level's tile array via `LevelLoader`.
2. THE `WorldKnowledgeMap` SHALL encode the position and type of every static terrain tile — grass, flowers, road, water, cobblestone bridge, castle bridge tiles (`b`, `m`, `g`), forest tiles (`O`, `P`, `S`), bailey tiles (`C`), and all castle structure tiles (`W`, `T`, `G`, `K`, `j`, `J`, `F`) — exactly as they appear in the level file.
3. THE `WorldKnowledgeMap` SHALL NOT include the position, presence, or type of any player unit, player-built defense, player-placed battlement, or any dynamic game object. Enemy units start with zero knowledge of player deployments.
4. THE `WorldKnowledgeMap` SHALL NOT be updated during gameplay to reflect player actions such as placing or moving units — it is a static snapshot of the terrain taken at wave spawn time and never modified.
5. THE PathfindingEngine `findPath` SHALL use the `WorldKnowledgeMap` as its base TileGraph for computing paths when no enemy-observed information overrides a tile. This replaces the previous model where `findPath` received the full live tile array (which included player unit positions).
6. THE `WorldKnowledgeMap` SHALL treat all bridge tiles (`=`, `b`, `m`, `g`) as passable with cost `1` — the enemy force knows bridges exist and are crossable. It has no knowledge of whether a bridge is currently blocked by a player unit.
7. THE `WorldKnowledgeMap` SHALL be accessible via `EnemyManager.getWorldKnowledgeMap()` for debugging and testing purposes.

---

### Requirement 13: Last-Seen Registry — Dynamic Player Unit Intelligence

**User Story:** As a player, I want enemy units to remember where they last saw my units but lose track when units move out of sight, so that repositioning defenders mid-battle is a meaningful tactical option.

#### Acceptance Criteria

1. THE EnemyManager SHALL maintain a `LastSeenRegistry` — a `Map<playerId, { row, col, turn }>` — storing the last observed position and observation turn for every player unit that has ever been sighted by any enemy unit.
2. WHEN any active EnemyUnit's `computeEnemyVisibleTiles` set contains a tile occupied by a player unit (cross-referenced against `UnitManager.getPlacedUnits()`), THE EnemyManager SHALL immediately update the `LastSeenRegistry` entry for that player unit with the current position and current turn number.
3. THE update in Requirement 13.2 SHALL occur at the start of each enemy unit's movement step, before pathfinding is computed, so fresh sightings inform the current turn's routing.
4. THE `LastSeenRegistry` SHALL be shared across ALL active enemy units — a sighting by any one enemy unit is immediately known to the entire enemy force via the manager. This is consistent with the SharedThreatMap broadcast established in Requirement 10.
5. WHEN building the `DynamicCostOverlay` for pathfinding, THE EnemyManager SHALL incorporate `LastSeenRegistry` entries: a tile recorded in the registry SHALL receive the CombatCostTile penalty (cost `3`) in the overlay, regardless of whether any enemy currently has line of sight to that tile.
6. IF a player unit moves away from its last-seen position between turns, THE `LastSeenRegistry` entry SHALL NOT be automatically updated — it retains the last physically observed position until a new sighting occurs or the entry expires.
7. IF a player unit is killed (removed from `UnitManager.getPlacedUnits()`), THE EnemyManager SHALL remove that unit's entry from the `LastSeenRegistry` on the next `executeTurn()` call, preventing the enemy force from permanently routing around a ghost position.
8. THE `LastSeenRegistry` SHALL be cleared (reset to empty) when `EnemyManager.reset()` is called on level restart.
9. THE `LastSeenRegistry` SHALL be accessible via `EnemyManager.getLastSeenRegistry()` for debugging and testing purposes.
10. IF a player unit that was previously sighted has since moved away from its last-seen position, the overlay entry for that position SHALL still be present in the `DynamicCostOverlay` (cost `3`) until: (a) a new sighting updates the position, (b) the unit is killed and its registry entry is cleared, or (c) the sighting has expired per Requirement 13.11.
11. A `LastSeenRegistry` entry SHALL expire and be removed when the current turn number exceeds the entry's recorded observation turn by more than `SIGHTING_EXPIRY_TURNS` (default: `10`). Expiry is checked at the start of each `executeTurn()` call, before the sight pass and before the overlay is built. An expired entry is treated as if the sighting never occurred — the tile reverts to its base terrain cost in the overlay and enemies will no longer avoid it.
12. THE `SIGHTING_EXPIRY_TURNS` constant SHALL be `10`, representing 10 cost-turns. Because one cost-turn corresponds to one unit movement step at cost `1` (≈ 1 real-world second at the intended game speed), this means stale intelligence expires after approximately 10 seconds of no re-sighting.
13. IF a sighting is refreshed (the same player unit is re-sighted within the expiry window), THE observation turn in the registry entry SHALL be updated to the current turn, resetting the expiry clock.
14. THE expiry mechanism SHALL be independent of the dead-unit purge — both checks run at the start of each `executeTurn()`, but they are separate operations: dead-unit purge removes entries for killed units regardless of how recent the sighting was; expiry removes entries for any unit (alive or not yet confirmed dead) whose last sighting is stale.

---

### Requirement 14: Separation of Static and Dynamic Knowledge in Pathfinding

**User Story:** As a game developer, I want the pathfinding system to cleanly separate what enemies know about the terrain from what they have observed about player deployments, so the two knowledge layers can evolve independently without coupling.

#### Acceptance Criteria

1. THE `findPath` function SHALL accept a `WorldKnowledgeMap` (static terrain) and a `DynamicCostOverlay` (observed player unit positions + terrain threat penalties) as separate parameters, applying them in that order: base costs from `WorldKnowledgeMap`, then overlay costs from `DynamicCostOverlay`.
2. THE `WorldKnowledgeMap` SHALL define passability for static terrain (grass, water, bridge, forest for eligible units, castle structures). It SHALL NOT contain any player unit data.
3. THE `DynamicCostOverlay` SHALL encode observed player unit positions from the `LastSeenRegistry` as cost `3`, and threat-zone water visible to enemies as cost `4`, as defined in Requirements 9 and 13.
4. WHEN a player unit has been sighted and its position is in the `LastSeenRegistry`, the tile at that position SHALL appear as cost `3` in the `DynamicCostOverlay`, even if no enemy currently has line of sight to it — the last-seen position persists until updated or cleared.
5. WHEN a tile's key appears in both the `WorldKnowledgeMap` and the `DynamicCostOverlay`, THE `DynamicCostOverlay` value SHALL take precedence, EXCEPT for tiles with base cost `Infinity` (walls, keep, rock) — impassable terrain cannot be overridden by the overlay.
6. A tile that is passable in the `WorldKnowledgeMap` but blocked by a player unit the enemies have never observed SHALL appear with its normal base terrain cost in `findPath` — enemies route toward it as if it were clear, and discover the blockade only when they gain line of sight.
