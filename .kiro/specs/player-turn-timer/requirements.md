# Requirements Document

## Introduction

The player turn timer introduces a per-turn wallclock countdown for the active phase of play. Once the game enters `'active'`, the player has a fixed number of seconds each turn to issue commands — move units, queue attacks, interact with structures. When the timer reaches zero (or the player clicks **End Turn**), the enemy phase begins.

During the enemy phase, each enemy unit moves **one at a time** with a short configurable inter-unit delay, so the player can track what is happening on the battlefield before issuing their next set of commands. Once all enemy units have moved, a **resolve phase** begins — a configurable 10-second countdown during which the HUD displays a clear message telling the player the current turn is closing and the next player turn is approaching. When the resolve timer expires the player turn timer resets and the cycle repeats.

This is distinct from the existing placement timer, which is a one-shot pre-game window. The player turn timer recurs every turn for the lifetime of the active phase and is visible as a prominent HUD element throughout gameplay.

## Glossary

- **PlayerTurn**: The portion of each game turn during which the player may act. Begins at the start of each active-phase turn; ends when the timer expires or the player clicks End Turn.
- **TurnDuration**: The fixed length of the PlayerTurn countdown. Default: **45 seconds**.
- **TurnTimer**: The per-turn wallclock countdown displayed in the HUD during the active phase. Resets to TurnDuration at the start of each new PlayerTurn.
- **TurnTimerStartMs**: The `performance.now()` value recorded when the current PlayerTurn began. Stored in `GameState`.
- **EndTurnButton**: The HUD button the player may click during the PlayerTurn to close it early and begin the enemy phase immediately.
- **EnemyPhase**: The portion of each turn during which enemy units move, one unit at a time. Spans from when `turnPhase` enters `'enemy'` until all units in the `enemyUnitQueue` have been processed.
- **EnemyUnitQueue**: An ordered list of enemy unit IDs to be moved this turn, consumed one entry per `UnitStepIntervalMs`. Stored in `GameState`.
- **UnitStepIntervalMs**: The configurable wallclock delay between successive enemy unit moves during the EnemyPhase. Default: **800 ms**. Stored in `GameState`.
- **UnitStepStartMs**: The `performance.now()` value when the current unit step began. Stored in `GameState`.
- **ResolvePhase**: A timed pause after all enemy units have moved, during which damage is applied and the HUD displays a message telling the player the turn is closing. Duration is `ResolveDurationMs`.
- **ResolveDurationMs**: The configurable length of the ResolvePhase countdown. Default: **10 seconds** (10 000 ms). Stored in `GameState`.
- **ResolveTimerStartMs**: The `performance.now()` value when the ResolvePhase began. Stored in `GameState`.
- **ActivePhase**: The `'active'` game phase in which turns cycle between PlayerTurn, EnemyPhase, and ResolvePhase.
- **TurnPhase**: A sub-state of the active phase — `'player'`, `'enemy'`, or `'resolve'`.
- **GameState**: The frozen immutable state object defined in `game-iso.js`.
- **TickTransitions**: The per-frame pure state pipeline in `game-iso.js`.
- **PhaseTransitions**: Named transition helpers in `game-iso.js`.
- **TurnTransitions**: New named transitions for the turn sub-state machine in `game-iso.js`.
- **HUD**: The `HUD` module in `hud.js` responsible for on-canvas UI rendering.

---

## Requirements

### Requirement 1: TurnTimer State Fields

**User Story:** As a developer, I want the GameState to carry all turn timer data as first-class fields, so that timer logic is pure, testable, and consistent with the existing state monad pattern.

#### Acceptance Criteria

1. THE `GameState` type SHALL include the following new fields, all set to their defaults by `makeInitialState()`:
   - `turnPhase: 'player' | 'enemy' | 'resolve'` — sub-state of the active phase
   - `turnTimerStartMs: number | null` — `performance.now()` when the current player turn began; `null` when inactive
   - `turnDurationMs: number` — player turn duration in ms; defaults to `45_000`
   - `enemyUnitQueue: string[]` — ordered list of enemy unit IDs yet to move this EnemyPhase; empty outside the enemy phase
   - `unitStepIntervalMs: number` — delay between successive enemy unit moves in ms; defaults to `800`
   - `unitStepStartMs: number | null` — `performance.now()` when the current unit step began; `null` when no step is in progress
   - `resolveDurationMs: number` — duration of the ResolvePhase countdown in ms; defaults to `10_000`
   - `resolveTimerStartMs: number | null` — `performance.now()` when the ResolvePhase began; `null` when inactive
   - `lastActiveTurnRects: { endTurnButtonRect: Object | null } | null` — click-target rects from the last rendered active-phase HUD frame

2. `makeInitialState()` SHALL initialise the new fields as:
   - `turnPhase: 'player'`
   - `turnTimerStartMs: null`
   - `turnDurationMs: 45_000`
   - `enemyUnitQueue: []`
   - `unitStepIntervalMs: 800`
   - `unitStepStartMs: null`
   - `resolveDurationMs: 10_000`
   - `resolveTimerStartMs: null`
   - `lastActiveTurnRects: null`

3. All new fields SHALL be included in the frozen object returned by `makeInitialState()` and in every `update(state, patch)` call that sets them.

---

### Requirement 2: Entering the Active Phase Starts the First Player Turn

**User Story:** As a developer, I want the transition into `'active'` to immediately initialise the turn timer, so that the player turn begins on the same frame the placement phase ends.

#### Acceptance Criteria

1. WHEN `PhaseTransitions.toActive(state, nowMs)` is called, the returned state SHALL set `turnTimerStartMs` to the provided `nowMs` value.
2. WHEN `PhaseTransitions.toActive(state, nowMs)` is called, the returned state SHALL set `turnPhase` to `'player'`.
3. `PhaseTransitions.toActive` SHALL accept a `nowMs` parameter (defaulting to `performance.now()` if omitted) rather than reading the clock directly, to remain a pure function testable without real time.
4. THE `TickTransitions._checkPlacementTimer` sub-transition (which calls `toActive`) SHALL pass `deps.nowMs` as the `nowMs` argument so the transition timestamp is consistent with the frame's clock snapshot.

---

### Requirement 3: TurnTimer Countdown and Expiry

**User Story:** As a player, I want the turn timer to count down visibly and transition to the enemy phase automatically when it expires, so that turns progress at a defined pace even if I am idle.

#### Acceptance Criteria

1. WHEN `state.phase === 'active'` AND `state.turnPhase === 'player'` AND `state.turnTimerStartMs` is not null, THE `TickTransitions.tick` pipeline SHALL include a `_checkTurnTimer` sub-transition that computes `elapsed = nowMs - state.turnTimerStartMs`.
2. IF `elapsed >= state.turnDurationMs`, THEN `_checkTurnTimer` SHALL transition to the enemy phase by calling `TurnTransitions.beginEnemyPhase(state, nowMs)`.
3. IF `elapsed < state.turnDurationMs`, THEN `_checkTurnTimer` SHALL leave the state unchanged.
4. `_checkTurnTimer` SHALL only run when `phase === 'active'` and `turnPhase === 'player'`; it SHALL be a no-op for all other phases and sub-states.
5. `_checkTurnTimer` SHALL be inserted into the `TickTransitions.tick` pipeline after `_checkAllPlaced`.

---

### Requirement 4: Enemy Phase — Sequential Unit Movement

**User Story:** As a player, I want to watch enemy units move one at a time during the enemy phase, so that I can track what is happening on the battlefield and make informed decisions for my next turn.

#### Acceptance Criteria

1. WHEN `turnPhase` transitions to `'enemy'`, `GameState.enemyUnitQueue` SHALL be populated with the IDs of all currently active enemy units in the order `EnemyManager.getEnemyUnits()` returns them. `unitStepStartMs` SHALL be set to `nowMs`.
2. ON each frame while `turnPhase === 'enemy'` and `enemyUnitQueue` is non-empty, THE `TickTransitions._checkEnemyStep` sub-transition SHALL check whether `nowMs - unitStepStartMs >= unitStepIntervalMs`. IF the interval has elapsed, it SHALL dequeue the first unit ID from `enemyUnitQueue`, call `EnemyManager.moveUnit(unitId)` as a side effect (in `Game.loop()`), and set `unitStepStartMs` to `nowMs`.
3. WHEN `enemyUnitQueue` becomes empty (all units have moved), THE `TickTransitions._checkEnemyStep` sub-transition SHALL transition `turnPhase` to `'resolve'` and set `resolveTimerStartMs` to `nowMs`.
4. THE `unitStepIntervalMs` default of **800 ms** SHALL be declared as a module-level constant `UNIT_STEP_INTERVAL_MS` in `game-iso.js`, separate from `turnDurationMs`, so it can be tuned independently.
5. `EnemyManager.moveUnit(unitId)` SHALL move exactly one unit one step along its path. It is called once per dequeue, not once per full-turn `executeTurn`. The existing `EnemyManager.executeTurn()` is **not called** during this phase; sequential movement replaces it for visual purposes.
6. WHILE `turnPhase === 'enemy'`, THE HUD SHALL display `"Enemy turn — watching N units move"` (where N is the remaining queue length) centred in the active-phase top bar, with no End Turn button.

---

### Requirement 5: Resolve Phase — Timed Pause with HUD Message

**User Story:** As a player, I want a clearly labelled pause after the enemy has moved, with a visible countdown, so that I can assess the battlefield state before my next turn begins.

#### Acceptance Criteria

1. WHEN `turnPhase` enters `'resolve'`, `resolveTimerStartMs` SHALL be set to the `nowMs` value at the moment of transition.
2. THE `TickTransitions._checkResolveTimer` sub-transition SHALL compute `elapsed = nowMs - state.resolveTimerStartMs` each frame while `turnPhase === 'resolve'`.
3. IF `elapsed >= state.resolveDurationMs`, THEN `_checkResolveTimer` SHALL transition `turnPhase` to `'player'`, set `turnTimerStartMs` to `nowMs`, set `resolveTimerStartMs` to `null`, and increment `turnCounter` by 1.
4. IF `elapsed < state.resolveDurationMs`, THEN `_checkResolveTimer` SHALL leave state unchanged.
5. WHILE `turnPhase === 'resolve'`, THE HUD SHALL display the following message centred in the active-phase top bar:
   `"Resolving… ⏱ 0:SS — Get ready for your next turn"`
   where `SS` is the seconds remaining in the resolve countdown (e.g. `0:10`, `0:05`).
6. THE resolve countdown seconds SHALL be computed as `Math.ceil((state.resolveDurationMs - elapsed) / 1000)`, giving a value that counts down from `resolveDurationMs / 1000` to `1` before the phase ends.
7. THE resolve message text SHALL use `#aaa` colour for the informational part and `#f8c870` (warm gold) for the countdown portion, making the timer visually distinct from the message.
8. WHILE `turnPhase === 'resolve'`, THE End Turn button SHALL NOT be rendered and SHALL NOT be clickable.
9. THE `resolveDurationMs` default of **10 000 ms** SHALL be declared as a module-level constant `RESOLVE_DURATION_MS` in `game-iso.js`.

---

### Requirement 6: End Turn Button

**User Story:** As a player, I want to be able to end my turn early by clicking an End Turn button, so that I don't have to wait for the timer if I have finished issuing commands.

#### Acceptance Criteria

1. WHILE `state.phase === 'active'` AND `state.turnPhase === 'player'`, THE HUD SHALL render an **End Turn** button in the active-phase top bar, right-aligned, using the same style as the `[ ✓ Ready ]` button in the placement HUD.
2. THE End Turn button text SHALL read `"[ ⏎ End Turn ]"`.
3. WHEN the player clicks the End Turn button, THE `InputTransitions.applyClick` handler SHALL call `TurnTransitions.beginEnemyPhase(state, nowMs)` which sets `turnPhase` to `'enemy'`, populates `enemyUnitQueue`, sets `unitStepStartMs` to `nowMs`, and clears `turnTimerStartMs`.
4. THE `beginEnemyPhase` transition SHALL be guarded: it SHALL be a no-op if `phase !== 'active'` or `turnPhase !== 'player'`.
5. THE click-target rect for the End Turn button SHALL be stored in `state.lastActiveTurnRects.endTurnButtonRect` using the same rect-writeback pattern as `lastPlacementRects`.
6. WHILE `state.turnPhase === 'enemy'` or `state.turnPhase === 'resolve'`, THE End Turn button SHALL NOT be rendered and SHALL NOT be clickable.

---

### Requirement 7: TurnTimer HUD Display

**User Story:** As a player, I want to see the remaining time for my turn clearly in the HUD at all times, so that I can manage my actions and understand the game state.

#### Acceptance Criteria

1. WHILE `state.phase === 'active'` AND `state.turnPhase === 'player'`, THE HUD SHALL render a `TurnTimer` display in the active-phase top bar, centred horizontally, in `"⏱ M:SS"` format.
2. THE seconds remaining SHALL be computed as `Math.floor((state.turnDurationMs - elapsed) / 1000)` where `elapsed = performance.now() - state.turnTimerStartMs`, clamped to a minimum of `0`.
3. THE timer text colour SHALL be `#fff` when seconds remaining > 10, `#f88` (red-tinted) when seconds remaining ≤ 5, matching the urgency styling of the placement timer.
4. THE active-phase top bar SHALL display: left-aligned level info text, centred `⏱ M:SS` timer, and right-aligned `"[ ⏎ End Turn ]"` button — during the player turn.
5. WHILE `state.turnPhase === 'enemy'`, THE active-phase top bar SHALL display `"Enemy turn — watching N units move"` (N = `state.enemyUnitQueue.length`) centred, with no End Turn button.
6. WHILE `state.turnPhase === 'resolve'`, THE active-phase top bar SHALL display the resolve countdown message from Requirement 5.5, centred, with no End Turn button.
7. A new `HUD.renderActiveTurnHUD(ctx, state)` function SHALL own the active-phase top bar render; it SHALL return `{ endTurnButtonRect }` following the same rect-return pattern as `renderPlacementHUD`.

---

### Requirement 8: Timer Persistence and Reset

**User Story:** As a developer, I want the turn timer to reset cleanly at the start of every player turn, so that every turn starts with the full allotted time regardless of how the previous turn ended.

#### Acceptance Criteria

1. WHEN a new PlayerTurn begins (transition from `'resolve'` → `'player'`), `turnTimerStartMs` SHALL be set to `deps.nowMs` from the current frame's `TickTransitions.tick` call.
2. WHEN `_setupLevel()` is called (level load or restart), `turnPhase` SHALL be reset to `'player'`, `turnTimerStartMs` to `null`, `enemyUnitQueue` to `[]`, `unitStepStartMs` to `null`, and `resolveTimerStartMs` to `null`.
3. THE `turnDurationMs`, `unitStepIntervalMs`, and `resolveDurationMs` values SHALL NOT be modified by any transition; they are fixed constants for the session.
4. IF `turnTimerStartMs` is `null` and `phase === 'active'` and `turnPhase === 'player'`, THE `_checkTurnTimer` sub-transition SHALL arm the timer by setting `turnTimerStartMs` to `deps.nowMs` rather than triggering expiry.

---

### Requirement 9: Backward Compatibility with Existing Wave Spawn

**User Story:** As a developer, I want the existing `_waveSpawned` one-shot enemy wave spawn to continue working correctly alongside the new turn sub-state machine.

#### Acceptance Criteria

1. THE `_waveSpawned` flag SHALL be checked at the moment `TurnTransitions.beginEnemyPhase` is triggered — specifically inside the `turnPhase === 'enemy'` block of `Game.loop()` on the first frame of each enemy phase — immediately before the first `EnemyManager.moveUnit()` call.
2. `EnemyManager.spawnWave()` SHALL be called at most once per game session, controlled by the existing `_waveSpawned` flag; the new turn sub-state machine SHALL NOT introduce a second spawn guard.
3. THE `_waveSpawned` flag SHALL be reset to `false` by `_setupLevel()` as it is today.

---

### Requirement 10: Correctness Properties

**User Story:** As a developer, I want property-based and unit tests covering the turn timer and resolve phase, so that correctness invariants hold across all valid inputs.

#### Acceptance Criteria

1. THE `_checkTurnTimer` sub-transition SHALL be covered by unit tests asserting:
   - With `elapsed < turnDurationMs`, state is returned unchanged.
   - With `elapsed >= turnDurationMs`, `turnPhase` becomes `'enemy'` and `enemyUnitQueue` is populated.
   - With `phase !== 'active'`, the transition is a no-op.

2. THE `beginEnemyPhase` transition SHALL be covered by unit tests asserting:
   - When `phase === 'active'` and `turnPhase === 'player'`, sets `turnPhase` to `'enemy'` and populates `enemyUnitQueue`.
   - When `phase !== 'active'` or `turnPhase !== 'player'`, returns state unchanged.

3. THE `_checkEnemyStep` sub-transition SHALL be covered by unit tests asserting:
   - When `elapsed < unitStepIntervalMs`, state is unchanged.
   - When `elapsed >= unitStepIntervalMs` and queue is non-empty, the first unit ID is dequeued and `unitStepStartMs` is reset.
   - When queue becomes empty, `turnPhase` transitions to `'resolve'` and `resolveTimerStartMs` is set.

4. THE `_checkResolveTimer` sub-transition SHALL be covered by unit tests asserting:
   - When `turnPhase === 'resolve'` and `elapsed < resolveDurationMs`, state is unchanged.
   - When `elapsed >= resolveDurationMs`, transitions to `'player'`, sets `turnTimerStartMs`, clears `resolveTimerStartMs`, increments `turnCounter`.
   - When `turnPhase !== 'resolve'`, is a no-op.

5. A **property test** SHALL verify the player timer expiry invariant: for any `turnTimerStartMs` and `nowMs >= turnTimerStartMs + turnDurationMs`, `_checkTurnTimer` SHALL produce `turnPhase === 'enemy'`.

6. A **property test** SHALL verify the player timer continuity invariant: for any `nowMs < turnTimerStartMs + turnDurationMs`, `_checkTurnTimer` SHALL leave `turnPhase === 'player'` and `turnTimerStartMs` unchanged.

7. A **property test** SHALL verify the resolve expiry invariant: for any `resolveTimerStartMs` and `nowMs >= resolveTimerStartMs + resolveDurationMs`, `_checkResolveTimer` SHALL produce `turnPhase === 'player'`.

8. A **property test** SHALL verify the enemy queue drain invariant: after N `_checkEnemyStep` calls each with `elapsed >= unitStepIntervalMs`, the `enemyUnitQueue` length SHALL have decreased by N (or reached 0, whichever comes first).
