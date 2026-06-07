# Enemy AI System

Two files power everything. Read them in order:

1. **`pathfinding-engine.js`** — pure maths: map reading, A\* search, sight lines
2. **`enemy-manager.js`** — the brain: spawning, memory, tactics, movement

---

## Table of Contents

- [Big Picture](#big-picture)
- [Hex Grid Basics](#hex-grid-basics)
- [Turn Lifecycle](#turn-lifecycle)
- [Pathfinding — A\* on a Hex Grid](#pathfinding--a-on-a-hex-grid)
- [Movement Costs](#movement-costs)
- [Dynamic Cost Overlay](#dynamic-cost-overlay)
- [Enemy Vision](#enemy-vision)
- [Last-Seen Registry](#last-seen-registry)
- [Engagement Zones](#engagement-zones)
- [Unit Types](#unit-types)
- [Spawn System](#spawn-system)
- [Two-Phase Target Selection](#two-phase-target-selection)
- [Data Flow Diagram](#data-flow-diagram)

---

## Big Picture

```
Game Loop (game-iso.js)
   │
   └─► EnemyManager.executeTurn(currentTurn)
            │
            ├─ 1. Purge dead units from memory
            ├─ 2. Expire stale sightings (> 10 turns old)
            ├─ 3. Sight pass — each enemy looks for player units
            ├─ 4. Update engagement zones
            ├─ 5. Evaluate zone strategies (AVOID / ENGAGE / MONITOR)
            ├─ 6. Build SharedThreatMap  ◄── PathfindingEngine.buildSharedThreatMap()
            ├─ 7. Select target (castle perimeter OR keep tiles)
            └─ 8. Move each unit  ◄── PathfindingEngine.findPath()
```

Plain English: Every game tick the manager sweeps through what the enemies
know, figures out which areas are dangerous, then tells each unit where to walk.

---

## Hex Grid Basics

The map uses **odd-row-offset** hex topology — the same system as `hexToPixel`
in `utils.js`. Every tile has exactly **6 neighbours**.

```
Even row (row 0, 2, 4 …)       Odd row (row 1, 3, 5 …)

     NW  NE                        NW  NE
   (-1,-1)(-1, 0)               (-1, 0)(-1,+1)
 W ( 0,-1)  [X]  ( 0,+1) E   W ( 0,-1)  [X]  ( 0,+1) E
   (+1,-1)(+1, 0)               (+1, 0)(+1,+1)
     SW  SE                        SW  SE
```

**Code location:** `pathfinding-engine.js` → `hexNeighbors(row, col)`

```js
// Even row: neighbours shift left
{ row: row-1, col: col-1 },  // NW
{ row: row-1, col: col   },  // NE
{ row: row,   col: col+1 },  // E
{ row: row+1, col: col   },  // SE  ← plain english: one row down, same column
{ row: row+1, col: col-1 },  // SW
{ row: row,   col: col-1 },  // W
```

**Hex distance** converts to cube coordinates then takes the max axis delta —
this is the A\* heuristic and is always admissible (never overestimates):

```js
// pathfinding-engine.js → hexDistance()
const x = col - (row - (row & 1)) / 2;   // cube-x from offset col
const z = row;                             // cube-z is just the row
const y = -x - z;                         // cube-y derived
distance = Math.max(|Δx|, |Δy|, |Δz|);   // Chebyshev on cube coords
```

---

## Turn Lifecycle

```
executeTurn(currentTurn)                      enemy-manager.js ~line 500
│
├── _safetyPurgeDead(placedUnits)             Remove registry entries for
│      │                                      dead player units (fallback
│      └── cross-ref registry vs alive list   if notifyUnitKilled() wasn't called)
│
├── _expireStale(currentTurn)                 Delete sightings older than
│      │                                      SIGHTING_EXPIRY_TURNS (= 10)
│      └── currentTurn - entry.turn > 10?
│
├── sight pass ─────────────────────────────  For every enemy unit:
│      │   computeEnemyVisibleTiles()          cast rays in 6 directions
│      └── cross-ref with UnitManager          if player unit is visible →
│          .getPlacedUnits()                   _recordSighting()
│
├── _updateEngagementZones()                  Cluster sightings into zones
│
├── _evaluateZoneStrategies()                 AVOID / ENGAGE / MONITOR
│
├── buildSharedThreatMap()  ◄── PE            Build overlay (combat tiles,
│                                             water penalties, zone penalties)
│
├── compute targetSet                         perimeter (phase 1) or keep (phase 2)
│
└── movement loop                             findPath() → move 1 tile
```

---

## Pathfinding — A\* on a Hex Grid

**Code location:** `pathfinding-engine.js` → `findPath()`

```
findPath(unitType, startRow, startCol, targetSet, tileGraph, overlay)
                                                                │
       ┌───────────────────────────────────────────────────────┘
       │ overlay = Map<"row,col" → cost number>
       │ This is how threats (player units, zones) make tiles expensive
       │ without making them impassable.
       ▼
MinHeap (priority queue ordered by f = g + h)
   │
   ├── g = actual cost accumulated so far
   ├── h = hexDistance to nearest target tile  (heuristic — never overestimates)
   └── effectiveCost = overlay.has(tile) ? overlay.get(tile) : baseCost
                                                         │
                              baseCost comes from ───────┘
                              MOVEMENT_COST table (see below)
```

The path returned is **start-exclusive, goal-inclusive**. `executeTurn` takes
only `path[0]` (one tile per turn).

---

## Movement Costs

**Code location:** `pathfinding-engine.js` → `MOVEMENT_COST` constant + `getMovementCost()`

| Tile | Character | Cost | Notes |
|------|-----------|------|-------|
| Grass | `.` | 1 | |
| Flowers | `,` | 1 | |
| Road | `D` | 1 | |
| Bailey | `C` | 1 | castle courtyard |
| Bridge | `=` `b` `m` `g` | 1 | |
| Water | `~` | 2 | passable but slow |
| Wall | `W` | ∞ | impassable |
| Tower | `T` | ∞ | |
| Gatehouse | `G` | ∞ | |
| Keep | `K` `j` `J` `F` | ∞ | |
| Rock | `R` | ∞ | |
| Trees | `O` `P` `S` | 1 or ∞ | depends on unit type |

```js
// getMovementCost() — two-liner logic
if (TREE_CHARS.has(tileChar))
    return TREE_ELIGIBLE.has(unitType) ? 1 : Infinity;
// ↑ Archers and Cavalry can enter forests; Infantry and Siege cannot
return MOVEMENT_COST[tileChar] ?? Infinity;
```

Tile sprites are stored by LevelLoader, not raw characters. `resolveTileChar()`
maps them back — it checks the `overlay` field first (trees are grass + overlay):

```js
// grass tile with a tree overlay → character 'O' (oak)
if (overlay.startsWith('tree-oak-overlay-')) return 'O';
// then falls back to sprite name
if (sprite.startsWith('grass-short-'))      return '.';
```

---

## Dynamic Cost Overlay

Rather than blocking tiles, player units raise the **cost** of moving through
their position and nearby water. Enemies can choose to fight when no cheaper
route exists.

```
Cost ordering  (enemies prefer lower numbers)
─────────────────────────────────────────────
  1  open terrain
  2  water
  3  tile occupied by a player unit  ← "fight or go around"
  4  water tile under player fire    ← risky swim
  5+ zone avoidance penalty          ← known danger area
  ∞  wall / keep / rock              ← never
```

**Code location:** `pathfinding-engine.js` → `buildSharedThreatMap()`

```js
// Step 1 — mark last-seen player positions
for (entry of lastSeenRegistry.values())
    overlay.set(tileKey(entry.row, entry.col), 3);
//  ^ cost 3: "there was a fighter here"

// Step 2 — collect everything each enemy can see
enemyVisibleSet = union of computeEnemyVisibleTiles for all enemies

// Step 3 — penalise water near player threats, but ONLY if enemies can see it
for (entry of registry.values()) {
    threatTiles = hexRing(entry.row, entry.col, radius=3, tileGraph)
    for (tile of threatTiles)
        if (tile is water AND enemyVisibleSet.has(tile))
            overlay.set(tile, 4);  // "dangerous water"
}

// Step 4 — add zone avoidance penalties additively
for ([key, penalty] of zoneOverlayPenalties)
    overlay.set(key, existing + penalty);  // never overrides ∞
```

---

## Enemy Vision

Each enemy has **directional sight** — not a simple radius bubble.

```
Default: 3 steps in each of 6 directions

If the immediate neighbour in direction D is a tree:
    sight in direction D = 1 step   (forest blocks view)

If the enemy itself stands on a tree tile:
    all 6 directions = 1 step       (inside woodland, effectively blind)

Sight rays stop early at: W T G K j J F R  (walls, keep, rock)
```

```
Example — enemy at (★), tree at (T):

     . . . . .
    . . T . . .          East ray: ★ → T (visible, dist 1) → STOP
   . . . ★ . . .         West ray: ★ → . → . → .  (3 steps, open)
    . . . . . .
```

**Code location:** `pathfinding-engine.js` → `computeEnemyVisibleTiles()`

```js
for (direction of hexNeighbors(row, col)) {
    immChar = resolveTileChar(immediateNeighbour)
    
    sightDistance = unitInTree      ? 1   // blind in woodland
                  : immChar is tree ? 1   // trees block this ray
                  :                   3;  // open terrain

    // raycast along direction up to sightDistance
    for (step = 1..sightDistance) {
        if (tile is wall/keep/rock) break;  // hard stop
        visibleTiles.add(tile);
    }
}
```

This matters for the threat map: water is only penalised when at least one
enemy can actually *see* it near a player unit.

---

## Last-Seen Registry

Enemies don't cheat. They only know where player units **were last spotted**.

```
_lastSeenRegistry: Map<stableUnitKey, { row, col, turn, health }>
                               │
                  ┌────────────┘
                  │  Key is stable across moves — never "row,col"
                  │  Priority: unit.id → def.name:index → unit-idx-N
                  └─► same unit moving from A to B → updates same entry
```

```
Timeline example:

Turn 5:  Enemy spots player unit P at (3,4)
         → registry.set('soldier-1', { row:3, col:4, turn:5, health:20 })
         → overlay costs 3 at (3,4) next turn

Turn 8:  P moves to (6,7) out of sight
         → registry still shows (3,4) — last known position persists
         → enemies still route around (3,4)

Turn 16: currentTurn(16) - entry.turn(5) = 11 > 10 → EXPIRED
         → registry entry deleted, cost 3 removed
         → enemies no longer fear (3,4)

Kill:    Resolve Phase calls EnemyManager.notifyUnitKilled(P)
         → immediate deletion — no ghost tile for even 1 turn
```

**Code location:** `enemy-manager.js` → `_recordSighting()`, `notifyUnitKilled()`, `_expireStale()`

```js
_recordSighting(playerUnit, unitIndex, currentTurn) {
    const key = this._stableKeyFor(playerUnit, unitIndex);
    // Map.set always overwrites — no duplicate entries, ever
    this._lastSeenRegistry.set(key, {
        row:    playerUnit.row,
        col:    playerUnit.col,
        turn:   currentTurn,
        health: playerUnit.currentHealth ?? playerUnit.def?.health ?? 0,
    });
}
```

---

## Engagement Zones

When enemies keep spotting player units in the same area, that area becomes an
**EngagementZone** and influences routing for the whole army.

```
Zone lifecycle:

  First sighting in area  →  zone created (strategy: MONITOR)
  ─────────────────────────────────────────────────────────
  Each subsequent sighting within ZONE_CLUSTER_RADIUS (6) hexes:
      observationCount++
      lastObservedTurn = currentTurn
      estimatedThreatHP = sum of known HP within 6 hexes

  Each turn the zone is Active (age ≤ 10 turns):
      Strategy evaluation (see below)

  Zone goes Dormant (age > 10):
      strategy = MONITOR, no pathfinding effect
```

### Strategy Evaluation

**Code location:** `enemy-manager.js` → `_evaluateZoneStrategies()`

```
For each ACTIVE zone:

  Step 1 — Can we go AROUND?
  ──────────────────────────
  Apply ZONE_AVOIDANCE_COST (+5) to all tiles within zone radius.
  Run A* probe for Infantry from zone centre → castle perimeter.
  
  If path found AND path avoids zone tiles → strategy = AVOID ✓
  (Army routes around the danger area automatically via higher costs)

  Step 2 — Should we ENGAGE?
  ──────────────────────────
  requiredHP     = zone.estimatedThreatHP × ENGAGE_HP_RATIO (1.5)
  remainingBudget = totalArmyHP × MAX_ARMY_COMMIT_FRACTION (0.40) - already committed

  If requiredHP ≤ remainingBudget:
      Pick highest-HP available units until requiredHP met
      → strategy = ENGAGE
      → those units target the zone centre instead of castle

  Step 3 — Fallback
  ─────────────────
  Neither avoidable nor enough HP → strategy = AVOID anyway
  (best effort; zone penalty still applied)
```

```
Constants (enemy-manager.js top):

  ZONE_CLUSTER_RADIUS      = 6    hexes — sightings this close merge into one zone
  ZONE_AVOIDANCE_COST      = 5    added to tile cost inside AVOID zones
  ENGAGE_HP_RATIO          = 1.5  need 50% more HP than the defender to engage
  MAX_ARMY_COMMIT_FRACTION = 0.40 at most 40% of army can be in strike forces
```

---

## Unit Types

**Code location:** `enemy-manager.js` → `UNIT_DEFS`

| Type | Move pts/turn | Health | Tree-eligible |
|------|:---:|:---:|:---:|
| Infantry | 2 | 30 | ✗ |
| Archer | 2 | 25 | ✓ |
| Cavalry | 3 | 35 | ✓ |
| SiegeEngine | 1 | 60 | ✗ |

"Tree-eligible" means the unit can move through forest tiles (O, P, S) at
cost 1. Non-eligible units treat those tiles as impassable walls.

---

## Spawn System

**Code location:** `enemy-manager.js` → `identifySpawnPoints()`, `spawnWave()`

### Spawn Centre Derivation

Enemies don't spawn across the whole edge of the map. They enter through a
**single concentrated entry zone** on the side of the map opposite the keep.

```
Map layout (simplified):

  col 0                              col maxCol
      ┌──────────────────────────────────────┐
      │                                      │
      │  [SPAWN ZONE]          [KEEP]        │
      │   centre col ≈         F tile        │
      │   maxCol − fCol        fRow, fCol    │
      │                                      │
      └──────────────────────────────────────┘

Spawn centre = (fRow, maxCol − fCol)
             = same row as the keep, mirrored column
```

**Step-by-step algorithm in `identifySpawnPoints()`:**

1. **Find the `F` tile** (keep centre). Its `(fRow, fCol)` is the keep anchor.
   Falls back to the map centre if no `F` tile exists.

2. **Mirror the column.** `spawnCentreCol = maxCol − fCol`. The spawn centre
   sits on the opposite horizontal side of the map at the same row as the keep.

3. **Validate the centre.** If the computed centre lands on a blocked or
   out-of-bounds tile, BFS outward until a valid tile is found.

4. **Collect the spawn pool.** Every tile within **2 hex steps** of the centre
   that passes all three filters is added to the spawn pool:
   - Infantry-passable (`getMovementCost < Infinity`)
   - Not water (`~`)
   - Not rock (`R`) or any castle/keep structure (`W T G K j J F C`)

5. **Return the pool.** `spawnWave()` round-robins units across the entire pool.
   If no valid tiles are found an empty array is returned (caller handles this).

```
Spawn pool example (radius = 2, × = valid spawn tile):

      . . . . . .
      . × × × . .
      . × C × . .     C = spawn centre
      . × × × . .     × = valid spawn tiles within 2 hex steps
      . . . . . .
      (tiles that are water / rock / castle are silently excluded)
```

### Wave Placement

```
spawnPoints = identifySpawnPoints()   ← the radius pool above

unit[0] → spawnPoints[0]
unit[1] → spawnPoints[1]
unit[2] → spawnPoints[2 % pool.length]   (round-robin across pool)
…

If the designated tile is already occupied:
  BFS outward until an unoccupied passable tile is found
```

The `WorldKnowledgeMap` built at wave start is a **static snapshot** of terrain
only — no player units. This means enemies start knowing the map layout but
have no knowledge of where defenders are placed.

---

## Two-Phase Target Selection

**Code location:** `enemy-manager.js` → `executeTurn()` → target set selection

```
Phase 1 (castleBreached = false)
─────────────────────────────────
Target = CastlePerimeter
       = all passable tiles adjacent to any W/T/G/K/j/J/F tile

  . . . . . .
  . W W W . .
  . W [F] W . .    The [.] tiles surrounding the W/F ring
  . W W W . .      are the Phase 1 targets.
  . . . . . .

Enemies crowd the walls from outside — the castle must be breached
before they can go for the keep.

Phase 2 (castleBreached = true)
────────────────────────────────
Target = KeepTileSet
       = all tiles with characters K, j, J, F

Enemies now path directly to the inner keep tiles.

Transition: game's Resolve Phase calls EnemyManager.setCastleBreached(true)
```

---

## Data Flow Diagram

```
LevelLoader                 UnitManager              game-iso.js
     │                           │                       │
     │ tiles[]                   │ getPlacedUnits()      │ executeTurn(turn)
     ▼                           ▼                       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                       EnemyManager                           │
  │                                                              │
  │  _worldKnowledgeMap ◄── buildTileGraph(tiles)  (at spawn)   │
  │  _spawnPoints       ◄── identifySpawnPoints()  (at spawn)   │
  │  _units[]           ◄── spawnWave()            (at spawn)   │
  │                                                              │
  │  Each turn:                                                  │
  │  _safetyPurgeDead()                                          │
  │  _expireStale()                                              │
  │                                                              │
  │  computeEnemyVisibleTiles() ──► PathfindingEngine            │
  │  _recordSighting()                                           │
  │                                                              │
  │  _updateEngagementZones(_lastSeenRegistry)                   │
  │  _evaluateZoneStrategies() ──► zoneOverlayPenalties          │
  │                                                              │
  │  buildSharedThreatMap(registry, units, tileGraph, zones)     │
  │            │                                                 │
  │            └──► PathfindingEngine.buildSharedThreatMap()     │
  │                        │                                     │
  │                        ▼                                     │
  │            _sharedThreatMap (Map<key, cost>)                 │
  │                                                              │
  │  For each unit:                                              │
  │    targetSet = perimeter OR keep (phase 1 / phase 2)         │
  │    if unit in strikeForce → targetSet = zone centre          │
  │    path = PathfindingEngine.findPath(                        │
  │               unitType, row, col,                            │
  │               targetSet, worldKnowledgeMap, threatMap)       │
  │    unit.row = path[0].row                                    │
  │    unit.col = path[0].col                                    │
  └──────────────────────────────────────────────────────────────┘
              │
              ▼
        combatEvents[]  →  Resolve Phase
```

---

## Running the Tests

```bash
node --test tests/game-logic/lib/ai/pathfinding-engine.test.js \
            tests/game-logic/lib/ai/enemy-manager.test.js
```

337 tests cover movement costs, hex topology, A\* correctness, sight
occlusion, registry expiry, zone clustering, strategy evaluation, and
full `executeTurn` integration.
