# Design Document: Player Turn Timer

## Overview

This feature adds a per-turn wallclock countdown to the active phase, sequential enemy unit movement (one unit per **1 second**), and a timed resolve pause (10 s by default) before the next player turn begins.

Each enemy unit move occupies a 1-second tick — long enough for the player to track what is happening on the battlefield before the next unit steps. Future enhancements such as highlighting the currently moving unit and adding a recognisable movement sound cue are explicitly out of scope for v1 and will be addressed in a follow-up spec.

The work touches two existing files and introduces no new modules:

1. **`game-iso.js`** — new `GameState` fields, four new sub-transitions, two new named transitions, updated `loop()` branching
2. **`hud.js`** — updated `renderActiveTurnHUD()` replacing the plain top bar in the active phase

---

## Architecture

The outer `phase` field never changes once `'active'` is entered. Only `turnPhase` cycles:

```
placement → active (outer phase, permanent once entered)
                │
                ▼
         ┌──── 'player' ◄────────────────────────────────────────────┐
         │      │                                                     │
         │  timer expires OR End Turn click                           │
         │  → beginEnemyPhase(state, nowMs)                           │
         │      │                                                     │
         │      ▼                                                     │
         │    'enemy'    ← enemyUnitQueue populated, stepStartMs set  │
         │      │                                                     │
         │  _checkEnemyStep: every unitStepIntervalMs (1 000 ms)       │
         │    dequeue one unit → EnemyManager.moveUnit(id)            │
         │    when queue empty → turnPhase = 'resolve',               │
         │                       resolveTimerStartMs = nowMs          │
         │      │                                                     │
         │      ▼                                                     │
         │    'resolve'  ← 10 s configurable pause                    │
         │      │                                                     │
         │  _checkResolveTimer: when elapsed >= resolveDurationMs     │
         │    → turnPhase='player', turnTimerStartMs=nowMs,           │
         │      turnCounter++, resolveTimerStartMs=null               │
         │      │                                                     │
         └──────────────────────────────────────────────────────────►┘
```

### Loop execution order per frame (active phase)

```
Game.loop()
  1. TickTransitions.tick(state, { nowMs })
       a. _animateLift
       b. _animateHud
       c. _checkPlacementTimer      (no-op once 'active')
       d. _checkAllPlaced           (no-op once 'active')
       e. _checkTurnTimer           ← player turn expiry ONLY (no-op during 'enemy'/'resolve')
       f. _checkEnemyStep           ← dequeue one unit per interval
       g. _checkResolveTimer        ← resolve countdown expiry
       (removed: _advanceTurnCounter — replaced by _checkResolveTimer)

  2. Camera scroll / zoom

  3. Enemy step side-effects (imperative, phase === 'active' && turnPhase === 'enemy'):
       — first frame only: if !_waveSpawned → spawnWave(); _waveSpawned = true
       — if state changed (unitId dequeued by tick): EnemyManager.moveUnit(unitId)
         (the dequeued ID is communicated via a scratch field or read from the
          diff of enemyUnitQueue — see implementation notes below)

  4. _render(state) → rectPatch
  5. applyRenderRects
  6. requestAnimationFrame
```

> **Timer scoping:** `_checkTurnTimer` (the 45 s countdown) is guarded by `turnPhase === 'player'` and is a **complete no-op** during `'enemy'` and `'resolve'`. The enemy phase is driven entirely by `unitStepIntervalMs` and the unit queue — it runs for as long as it takes to process all N units (N × 1 s), regardless of how much player-turn time was used. The player timer only restarts once `_checkResolveTimer` transitions back to `'player'`.

> **Why enemy movement stays in `loop()`, not `TickTransitions`:**
> `EnemyManager.moveUnit()` mutates external state (enemy positions). The existing architecture keeps side effects in `loop()` and pure logic in `TickTransitions`. The tick pipeline signals **which** unit to move via a `pendingEnemyMoveId` scratch field on the state; `loop()` reads it and calls the side-effecting method.

---

## New GameState Fields

```js
// ── Turn sub-state (active phase only) ────────────────────────────────────
turnPhase:          'player' | 'enemy' | 'resolve',
turnTimerStartMs:   number | null,   // performance.now() when player turn started
turnDurationMs:     number,          // 45_000 ms default

// ── Enemy sequential movement ─────────────────────────────────────────────
enemyUnitQueue:     string[],        // unit IDs yet to move this turn, FIFO
unitStepIntervalMs: number,          // delay between unit moves, 1 000 ms default (1 second)
unitStepStartMs:    number | null,   // performance.now() when current step began

// ── Resolve phase ─────────────────────────────────────────────────────────
resolveDurationMs:    number,        // 10_000 ms default
resolveTimerStartMs:  number | null, // performance.now() when resolve began

// ── HUD click-target rects ────────────────────────────────────────────────
lastActiveTurnRects: { endTurnButtonRect: Object | null } | null,
```

`makeInitialState()` defaults:

```js
turnPhase:            'player',
turnTimerStartMs:     null,
turnDurationMs:       45_000,
enemyUnitQueue:       Object.freeze([]),
unitStepIntervalMs:   1_000,
unitStepStartMs:      null,
resolveDurationMs:    10_000,
resolveTimerStartMs:  null,
lastActiveTurnRects:  null,
```

Module-level constants (declared alongside `PLACEMENT_DURATION_MS`):

```js
const TURN_DURATION_MS      = 45_000;
const UNIT_STEP_INTERVAL_MS =  1_000;  // 1 second per unit move (v1 baseline)
const RESOLVE_DURATION_MS   = 10_000;
```

---

## Components and Interfaces

### `game-iso.js` — GameState, TickTransitions, TurnTransitions, Game.loop()

All new state fields, sub-transitions, and named transitions live in this existing file. See the sections below for full signatures and pseudocode.

### `hud.js` — HUD.renderActiveTurnHUD()

A new exported function added to the existing `HUD` object. Replaces the `renderTopBar()` call in the active phase render block.

---

## Data Models

### GameState — new fields (added to existing frozen object)

```js
// ── Player turn timer ──────────────────────────────────────────────────────
turnPhase:           'player' | 'enemy' | 'resolve',
turnTimerStartMs:    number | null,  // performance.now() when player turn started
turnDurationMs:      number,         // 45_000 ms default

// ── Enemy sequential movement ──────────────────────────────────────────────
enemyUnitQueue:      string[],       // unit IDs yet to move this turn (FIFO)
unitStepIntervalMs:  number,         // delay between moves, 1_000 ms default (1 second)
unitStepStartMs:     number | null,  // performance.now() when current step began
pendingMoveId:       string | null,  // transient: unit ID to move this frame

// ── Resolve phase ──────────────────────────────────────────────────────────
resolveDurationMs:   number,         // 10_000 ms default
resolveTimerStartMs: number | null,  // performance.now() when resolve began

// ── HUD click-target rects ─────────────────────────────────────────────────
lastActiveTurnRects: { endTurnButtonRect: Object | null } | null,
```

### Module-level constants (game-iso.js)

```js
const TURN_DURATION_MS      = 45_000;  // player turn length
const UNIT_STEP_INTERVAL_MS =  1_000;  // 1 second per unit move (v1 baseline)
const RESOLVE_DURATION_MS   = 10_000;  // resolve pause length
```

---

## New and Modified Transitions

### `PhaseTransitions.toActive(state, nowMs)`

**Modified** — accepts `nowMs`, initialises the first player turn:

```js
toActive(state, nowMs = performance.now()) {
    if (state.phase !== 'placement' || state.placementDone) return state;
    return update(state, {
        phase:            'active',
        placementDone:    true,
        turnPhase:        'player',
        turnTimerStartMs: nowMs,
    });
},
```

---

### `TurnTransitions` — named transitions and predicate

**New** — all turn sub-state logic lives here, including a named predicate that replaces the 4-clause inline guard in `Game.loop()`:

```js
const TurnTransitions = {
    /**
     * Returns true when the first frame of a new enemy phase has arrived and
     * the unit queue needs seeding. Used by Game.loop() to avoid a 4-clause
     * inline guard — intent is readable in plain English at the call site.
     *
     * @param {GameState} state
     * @returns {boolean}
     */
    isReadyToSeedEnemyQueue(state) {
        return state.phase === 'active'
            && state.turnPhase === 'enemy'
            && state.enemyUnitQueue.length === 0
            && state.unitStepStartMs === null;
    },

    /**
     * Transitions from player turn to enemy phase. Populates the unit queue
     * and arms the step timer.
     */
    beginEnemyPhase(state, nowMs, enemyIds) {
        if (state.phase !== 'active' || state.turnPhase !== 'player') return state;
        return update(state, {
            turnPhase:        'enemy',
            turnTimerStartMs: null,
            enemyUnitQueue:   Object.freeze([...enemyIds]),
            unitStepStartMs:  nowMs,
        });
    },

    // Convenience alias wired to End Turn button click.
    // Game.loop() injects the live enemy ID list from EnemyManager.
    endPlayerTurn(state, nowMs, enemyIds) {
        return TurnTransitions.beginEnemyPhase(state, nowMs, enemyIds);
    },
};
```

`enemyIds` is supplied by `Game.loop()` from `EnemyManager.getEnemyUnits().map(u => u.id)`.

---

### `TickTransitions._checkTurnTimer(state, nowMs)`

**New** — expires the player turn. **Scoped strictly to `turnPhase === 'player'`** — this sub-transition is a complete no-op during the enemy and resolve phases. The enemy phase is driven entirely by `unitStepIntervalMs` and the queue; it is never interrupted or bounded by `turnDurationMs`.

```js
_checkTurnTimer(state, nowMs) {
    if (state.phase !== 'active' || state.turnPhase !== 'player') return state;
    if (state.turnTimerStartMs === null) {
        return update(state, { turnTimerStartMs: nowMs }); // arm on first frame
    }
    const elapsed = nowMs - state.turnTimerStartMs;
    if (elapsed < state.turnDurationMs) return state;
    // Expiry — beginEnemyPhase is called by loop() when it reads the new turnPhase
    // to inject the live enemyIds. Set a sentinel to signal expiry:
    return update(state, { turnPhase: 'enemy', turnTimerStartMs: null });
},
```

> **Implementation note:** When `_checkTurnTimer` fires the expiry it sets `turnPhase: 'enemy'` directly (bypassing `beginEnemyPhase`) and leaves `enemyUnitQueue: []`. On the very next frame, `_checkEnemyStep` detects `turnPhase === 'enemy'` with an empty queue and expects `loop()` to have populated it. In practice, `loop()` detects the `enemy` phase and calls `beginEnemyPhase` before `tick()` on the *same* frame the expiry fires — see `Game.loop()` ordering below.

The cleaner alternative is to keep `enemyUnitQueue` population as a `loop()`-only concern: `_checkTurnTimer` simply sets `turnPhase: 'enemy'`; `loop()` sees the new phase, calls `beginEnemyPhase` to stamp `enemyUnitQueue` and `unitStepStartMs`, then calls `tick()`. Either approach is valid; the task description calls out which variant to use.

---

### `TickTransitions._checkEnemyStep(state, nowMs)`

**New** — advances the sequential enemy move queue:

```js
_checkEnemyStep(state, nowMs) {
    if (state.phase !== 'active' || state.turnPhase !== 'enemy') return state;
    if (state.enemyUnitQueue.length === 0) {
        // All units have moved — enter resolve
        return update(state, {
            turnPhase:          'resolve',
            resolveTimerStartMs: nowMs,
            unitStepStartMs:    null,
        });
    }
    if (state.unitStepStartMs === null) {
        return update(state, { unitStepStartMs: nowMs }); // arm on first frame
    }
    const elapsed = nowMs - state.unitStepStartMs;
    if (elapsed < state.unitStepIntervalMs) return state;
    // Step interval elapsed — dequeue one unit
    const [movedId, ...remaining] = state.enemyUnitQueue;
    return update(state, {
        enemyUnitQueue:  Object.freeze(remaining),
        unitStepStartMs: nowMs,
        pendingMoveId:   movedId,   // signals loop() to call moveUnit(movedId)
    });
},
```

`pendingMoveId` is a transient scratch field consumed and cleared by `loop()` in the same frame it is written. It is set to `null` in `makeInitialState()` and by `loop()` after the move call.

---

### `TickTransitions._checkResolveTimer(state, nowMs)`

**New** — closes the resolve pause and starts the next player turn:

```js
_checkResolveTimer(state, nowMs) {
    if (state.phase !== 'active' || state.turnPhase !== 'resolve') return state;
    if (state.resolveTimerStartMs === null) {
        return update(state, { resolveTimerStartMs: nowMs }); // arm on first frame
    }
    const elapsed = nowMs - state.resolveTimerStartMs;
    if (elapsed < state.resolveDurationMs) return state;
    return update(state, {
        turnPhase:          'player',
        turnTimerStartMs:   nowMs,
        resolveTimerStartMs: null,
        turnCounter:        state.turnCounter + 1,
    });
},
```

---

### `_advanceTurnCounter` — removed

Replaced by `_checkResolveTimer`, which increments `turnCounter` once per full cycle.

---

### `Game.loop()` — revised active phase block

```js
loop() {
    if (!this._state) { requestAnimationFrame(() => this.loop()); return; }

    const nowMs = performance.now();

    // ── Pre-tick: populate enemy queue if entering 'enemy' phase ────────
    // When _checkTurnTimer (or endPlayerTurn) set turnPhase='enemy' on the
    // previous frame, the queue may still be empty. Populate it here before
    // tick() runs _checkEnemyStep.
    if (TurnTransitions.isReadyToSeedEnemyQueue(this._state)) {
        // First frame of enemy phase — seed the queue and optionally spawn
        if (!this._waveSpawned) {
            this._waveSpawned = true;
            try {
                const level = LevelLoader.getCurrentLevel();
                EnemyManager.spawnWave({ units: [...] }, level.tiles);
            } catch (e) { console.warn('[Game] spawnWave failed:', e); }
        }
        const enemyIds = EnemyManager.getEnemyUnits().map(u => u.id);
        this._state = TurnTransitions.beginEnemyPhase(this._state, nowMs, enemyIds);
    }

    // ── Tick: pure state transitions ─────────────────────────────────────
    this._state = TickTransitions.tick(this._state, { nowMs });

    // ── Post-tick: execute enemy move side effect ─────────────────────────
    if (this._state.pendingMoveId) {
        try {
            EnemyManager.moveUnit(this._state.pendingMoveId);
        } catch (e) { console.warn('[Game] moveUnit failed:', e); }
        this._state = update(this._state, { pendingMoveId: null });
    }

    // ── Camera ────────────────────────────────────────────────────────────
    if (this._state.phase === 'placement' || this._state.phase === 'active') {
        const { dx, dy } = IsoInput.getScrollDir();
        if (dx || dy) IsoCamera.scroll(dx, dy);
        if (IsoInput.keys.zoomIn)  IsoCamera.applyZoom(IsoCamera.zoomSpeed);
        if (IsoInput.keys.zoomOut) IsoCamera.applyZoom(-IsoCamera.zoomSpeed);
    }

    // ── Render ────────────────────────────────────────────────────────────
    const rectPatch = this._render(this._state);
    if (rectPatch) this._state = applyRenderRects(this._state, rectPatch);

    requestAnimationFrame(() => this.loop());
},
```

---

## HUD Changes

### `HUD.renderActiveTurnHUD(ctx, state)` — three display modes

**20 px bar at y=0**, same height as placement HUD bar.

#### Player turn mode
```
┌─────────────────────────────────────────────────────────┐
│ Level name | BR→TL | 100%     ⏱ 0:45     [ ⏎ End Turn ] │
└─────────────────────────────────────────────────────────┘
  left                         centre       right
```
Timer colour: `#fff` > 10 s, `#f88` ≤ 5 s. Button: `#8a7a60` normal, `#c8b890` when ≤ 10 s.

#### Enemy turn mode
```
┌─────────────────────────────────────────────────────────┐
│ Level name | BR→TL | 100%     Enemy turn — watching 4 units move │
└─────────────────────────────────────────────────────────┘
```
Centred text, `#bbb` colour, no button. Queue count reflects remaining `state.enemyUnitQueue.length`.

#### Resolve mode
```
┌────────────────────────────────────────────────────────────────────────┐
│ Level name | BR→TL | 100%     Resolving… ⏱ 0:08 — Get ready for your next turn │
└────────────────────────────────────────────────────────────────────────┘
```
Centred. Informational text in `#aaa`; countdown `⏱ 0:SS` in `#f8c870` (warm gold). No button.

**Resolve seconds remaining** computed as:
```js
const resolveElapsed  = nowMs - state.resolveTimerStartMs;
const resolveSecsLeft = Math.ceil((state.resolveDurationMs - resolveElapsed) / 1000);
const resSecs         = Math.max(0, resolveSecsLeft);
const resMins         = Math.floor(resSecs / 60);
const resSecsStr      = (resSecs % 60) < 10 ? '0' + (resSecs % 60) : '' + (resSecs % 60);
const resolveText     = `Resolving… ⏱ ${resMins}:${resSecsStr} — Get ready for your next turn`;
```

The gold `#f8c870` segment is drawn by splitting the string and using two `fillText` calls, or by measuring the text before the timer portion and offsetting.

**Signature:**

```js
/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{
 *   turnPhase:          'player'|'enemy'|'resolve',
 *   turnTimerStartMs:   number|null,
 *   turnDurationMs:     number,
 *   enemyUnitQueue:     string[],
 *   resolveTimerStartMs: number|null,
 *   resolveDurationMs:  number,
 *   canvasW:            number,
 *   levelLabel:         string,
 * }} state
 * @returns {{ endTurnButtonRect: {x,y,w,h}|null }}
 */
renderActiveTurnHUD(ctx, state) { ... }
```

---

### `_render()` and `InputTransitions.applyClick` — unchanged pattern

```js
// _render() active phase
const lastActiveTurnRects = HUD.renderActiveTurnHUD(ctx, {
    turnPhase:           state.turnPhase,
    turnTimerStartMs:    state.turnTimerStartMs,
    turnDurationMs:      state.turnDurationMs,
    enemyUnitQueue:      state.enemyUnitQueue,
    resolveTimerStartMs: state.resolveTimerStartMs,
    resolveDurationMs:   state.resolveDurationMs,
    canvasW,
    levelLabel: level.name + ' | ' + IsoCamera.viewpoint + ' ' + Math.round(IsoCamera.zoom * 100) + '%',
});
return { lastActiveTurnRects };

// applyClick — End Turn hit-test
if (state.lastActiveTurnRects?.endTurnButtonRect) {
    const r = state.lastActiveTurnRects.endTurnButtonRect;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        const enemyIds = EnemyManager.getEnemyUnits().map(u => u.id);
        return TurnTransitions.endPlayerTurn(state, performance.now(), enemyIds);
    }
}
```

---

## Data Flow Diagram

```
performance.now() = nowMs
       │
       ├─ Pre-tick: if turnPhase==='enemy' && queue empty
       │     → beginEnemyPhase(state, nowMs, enemyIds)   [seeds queue]
       │
       ▼
TickTransitions.tick(state, { nowMs })
       ├─ _checkTurnTimer     → turnPhase 'player'→'enemy' on expiry
       ├─ _checkEnemyStep     → dequeues one unit per interval
       │                        → turnPhase 'enemy'→'resolve' when empty
       └─ _checkResolveTimer  → turnPhase 'resolve'→'player' on expiry
                                 turnCounter++
       ▼
Post-tick: if pendingMoveId
       → EnemyManager.moveUnit(pendingMoveId)
       → pendingMoveId = null
       ▼
_render(state)
       └─ HUD.renderActiveTurnHUD(...)
              player: ⏱ M:SS + End Turn button
              enemy:  "Enemy turn — watching N units move"
              resolve: "Resolving… ⏱ 0:SS — Get ready for your next turn"
```

---

## Error Handling

All `EnemyManager` calls in `Game.loop()` are wrapped in `try/catch`, consistent with the existing guards:

```js
try {
    EnemyManager.moveUnit(this._state.pendingMoveId);
} catch (e) {
    console.warn('[Game] moveUnit failed:', e);
}
```

If `moveUnit` throws, `pendingMoveId` is still cleared so the loop does not retry the same unit. If `EnemyManager.getEnemyUnits()` returns an empty array at the start of the enemy phase, `beginEnemyPhase` seeds an empty queue; `_checkEnemyStep` then immediately transitions to `'resolve'` — no units move, the resolve pause plays normally, and the next player turn begins.

---

## Testing Strategy

Unit tests (`tests/game-logic/player-turn-timer.spec.js`) cover each transition in isolation using constructed `GameState` objects with injected integer `nowMs` values — no DOM, no real clock needed.

Property tests (`property-tests/player-turn-timer.property.js`) use fast-check to verify the seven invariants across the full numeric range. Regression tests: `game-iso-enemy-spawn.spec.js` (22 tests) must continue to pass since the `_waveSpawned` path is preserved unchanged.

---

## Correctness Properties

### Property 1: Player timer expiry invariant
For any `turnTimerStartMs` and `nowMs >= turnTimerStartMs + turnDurationMs`, `_checkTurnTimer` produces `turnPhase === 'enemy'`.

**Validates: Requirements 3.2, 10.5**

### Property 2: Player timer continuity invariant
For any `nowMs < turnTimerStartMs + turnDurationMs`, `_checkTurnTimer` leaves `turnPhase === 'player'` and `turnTimerStartMs` unchanged.

**Validates: Requirements 3.3, 10.6**

### Property 3: End turn idempotence
Calling `endPlayerTurn` twice on the same state returns the same result as calling it once.

**Validates: Requirements 6.4**

### Property 4: Turn counter monotonicity
`turnCounter` never decreases. Each full `player → enemy → resolve` cycle increments it by exactly 1.

**Validates: Requirements 5.3**

### Property 5: Enemy queue drain invariant
After N `_checkEnemyStep` calls each with `elapsed >= unitStepIntervalMs`, `enemyUnitQueue.length` decreases by N (or reaches 0).

**Validates: Requirements 4.2, 10.8**

### Property 6: Resolve expiry invariant
For any `resolveTimerStartMs` and `nowMs >= resolveTimerStartMs + resolveDurationMs`, `_checkResolveTimer` produces `turnPhase === 'player'`.

**Validates: Requirements 5.3, 10.7**

### Property 7: Mutual exclusion
`EnemyManager.moveUnit()` is only called when `pendingMoveId` is non-null, which can only be set by `_checkEnemyStep` during `turnPhase === 'enemy'`.

**Validates: Requirements 4.5, 9.1**