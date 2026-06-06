# Implementation Plan: Player Turn Timer

## Overview

Add a per-turn 45-second player countdown, sequential enemy unit movement (one unit per 800 ms), and a 10-second resolve pause before the next player turn. Work flows through: `GameState` (new fields), `TickTransitions` (three new sub-transitions + one removed), `TurnTransitions` (two new named transitions), `Game.loop()` (pre-tick queue seeding + post-tick move side effect), and `HUD` (three-mode active-phase top bar). All changes are in existing files.

## Tasks

- [ ] 1. Add turn timer, enemy queue, and resolve fields to GameState
  - Add all nine new fields to the `@typedef` comment for `GameState` in `game-iso.js`
  - Add all nine fields to `makeInitialState()` with correct defaults (see design.md § New GameState Fields)
  - Declare module-level constants: `TURN_DURATION_MS = 45_000`, `UNIT_STEP_INTERVAL_MS = 800`, `RESOLVE_DURATION_MS = 10_000`
  - Add `pendingMoveId: null` to `makeInitialState()` as the transient scratch field
  - _Requirements: 1.1, 1.2, 1.3, 4.4, 5.9_

- [ ] 2. Update `PhaseTransitions.toActive` to accept and forward `nowMs`
  - Add `nowMs = performance.now()` parameter
  - Set `turnPhase: 'player'` and `turnTimerStartMs: nowMs` in the returned state
  - Update the `_checkPlacementTimer` call to pass `nowMs` through
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 3. Write unit tests for updated `PhaseTransitions.toActive`
  - Depends on: task 2
  - Assert sets `turnPhase: 'player'` and `turnTimerStartMs` to the provided `nowMs`
  - Assert is still a no-op when `phase !== 'placement'` or `placementDone` is true
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 4. Implement `TurnTransitions.beginEnemyPhase` and `endPlayerTurn`
  - Depends on: task 1
  - Add `TurnTransitions` object to `game-iso.js`
  - `beginEnemyPhase(state, nowMs, enemyIds)`: no-op if not active/player; otherwise sets `turnPhase: 'enemy'`, `turnTimerStartMs: null`, `enemyUnitQueue: Object.freeze([...enemyIds])`, `unitStepStartMs: nowMs`
  - `endPlayerTurn(state, nowMs, enemyIds)`: delegates to `beginEnemyPhase` — convenience alias for the End Turn button click path
  - _Requirements: 6.3, 6.4, 9.2_

- [ ] 5. Write unit tests for `TurnTransitions.beginEnemyPhase` and `endPlayerTurn`
  - Depends on: task 4
  - Assert `beginEnemyPhase` sets `turnPhase: 'enemy'` and `enemyUnitQueue` to the provided IDs
  - Assert `beginEnemyPhase` is a no-op when `phase !== 'active'` or `turnPhase !== 'player'`
  - Assert `endPlayerTurn` delegates correctly and is idempotent
  - _Requirements: 9.2_

- [ ] 6. Implement `TickTransitions._checkTurnTimer`
  - Depends on: task 1
  - Add `_checkTurnTimer(state, nowMs)` to `TickTransitions`
  - No-op when `phase !== 'active'` or `turnPhase !== 'player'`
  - If `turnTimerStartMs === null`, arm it: `update(state, { turnTimerStartMs: nowMs })`
  - If `elapsed >= turnDurationMs`, set `turnPhase: 'enemy'`, `turnTimerStartMs: null` (queue seeded by loop pre-tick)
  - Insert into `tick()` pipeline after `_checkAllPlaced`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.4_

- [ ] 7. Write unit tests for `_checkTurnTimer`
  - Depends on: task 6
  - Assert no-op when `phase !== 'active'`; no-op when `turnPhase !== 'player'`
  - Assert arms timer when `turnTimerStartMs === null`
  - Assert sets `turnPhase: 'enemy'` when `elapsed >= turnDurationMs`
  - Assert no change when `elapsed < turnDurationMs`
  - _Requirements: 10.1_

- [ ] 8. Implement `TickTransitions._checkEnemyStep`
  - Depends on: task 1
  - Add `_checkEnemyStep(state, nowMs)` to `TickTransitions`
  - No-op when `phase !== 'active'` or `turnPhase !== 'enemy'`
  - If `enemyUnitQueue` is empty: transition to `'resolve'`, set `resolveTimerStartMs: nowMs`, `unitStepStartMs: null`
  - If `unitStepStartMs === null`: arm it (`update(state, { unitStepStartMs: nowMs })`)
  - If `elapsed >= unitStepIntervalMs`: dequeue first ID, set `pendingMoveId`, reset `unitStepStartMs: nowMs`
  - Insert into `tick()` pipeline after `_checkTurnTimer`
  - _Requirements: 4.2, 4.3, 9.3_

- [ ] 9. Write unit tests for `_checkEnemyStep`
  - Depends on: task 8
  - Assert no-op when `turnPhase !== 'enemy'`
  - Assert arms step timer when `unitStepStartMs === null`
  - Assert dequeues one unit and sets `pendingMoveId` when `elapsed >= unitStepIntervalMs`
  - Assert transitions to `'resolve'` when queue is empty, setting `resolveTimerStartMs`
  - Assert no change when `elapsed < unitStepIntervalMs` and queue non-empty
  - _Requirements: 10.3_

- [ ] 10. Implement `TickTransitions._checkResolveTimer` and remove `_advanceTurnCounter`
  - Depends on: task 1
  - Add `_checkResolveTimer(state, nowMs)` to `TickTransitions`
  - No-op when `phase !== 'active'` or `turnPhase !== 'resolve'`
  - If `resolveTimerStartMs === null`: arm it
  - If `elapsed >= resolveDurationMs`: set `turnPhase: 'player'`, `turnTimerStartMs: nowMs`, `resolveTimerStartMs: null`, `turnCounter: state.turnCounter + 1`
  - Insert into `tick()` pipeline after `_checkEnemyStep`
  - Remove `_advanceTurnCounter` from the pipeline
  - _Requirements: 5.2, 5.3, 5.4, 8.1, 9.4_

- [ ] 11. Write unit tests for `_checkResolveTimer`
  - Depends on: task 10
  - Assert no-op when `turnPhase !== 'resolve'`
  - Assert arms timer when `resolveTimerStartMs === null`
  - Assert transitions to `'player'`, resets resolve fields, increments `turnCounter` when `elapsed >= resolveDurationMs`
  - Assert no change when `elapsed < resolveDurationMs`
  - _Requirements: 10.4_

- [ ] 12. Update `Game.loop()` — pre-tick queue seeding and post-tick move execution
  - Depends on: tasks 4, 6, 8, 10
  - Add a **pre-tick block**: if `phase === 'active'`, `turnPhase === 'enemy'`, `enemyUnitQueue.length === 0`, and `unitStepStartMs === null` → call `beginEnemyPhase` (and `spawnWave` on first time via `_waveSpawned`)
  - Move the `nowMs = performance.now()` snapshot to the top of `loop()` so both pre-tick and `tick()` receive the same clock value
  - Add a **post-tick block**: if `state.pendingMoveId` → call `EnemyManager.moveUnit(pendingMoveId)` then clear `pendingMoveId`
  - Remove the existing `if (phase === 'active')` enemy executeTurn block entirely
  - _Requirements: 4.1, 4.5, 9.1, 9.2, 9.3_

- [ ] 13. Implement `HUD.renderActiveTurnHUD` — three-mode top bar
  - Depends on: task 1
  - Add `renderActiveTurnHUD(ctx, state)` to `hud.js`
  - **Player turn mode**: left level label, centred `⏱ M:SS`, right `[ ⏎ End Turn ]` (timer colour `#fff`→`#f88`; button `#8a7a60`→`#c8b890` when ≤ 10 s)
  - **Enemy turn mode**: centred `"Enemy turn — watching N units move"` in `#bbb`, no button
  - **Resolve mode**: centred two-colour text — `#aaa` for `"Resolving…"` and `"— Get ready for your next turn"`, `#f8c870` for `"⏱ 0:SS"` — no button
  - Return `{ endTurnButtonRect }` (null when not in player turn)
  - _Requirements: 4.6, 5.5, 5.6, 5.7, 5.8, 6.1, 6.2, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 14. Write unit tests for `HUD.renderActiveTurnHUD`
  - Depends on: task 13
  - Assert returns `{ endTurnButtonRect: null }` when `turnPhase !== 'player'`
  - Assert returns a non-null rect when `turnPhase === 'player'`
  - Assert does not throw for enemy or resolve mode
  - _Requirements: 7.7_

- [ ] 15. Wire `renderActiveTurnHUD` into `_render()` and update click handler
  - Depends on: tasks 4, 13
  - In `_render()`, replace `HUD.renderTopBar(...)` with `HUD.renderActiveTurnHUD(ctx, { ... })` for the active phase
  - Return `{ lastActiveTurnRects }` from the active phase branch
  - In `applyRenderRects`, handle `lastActiveTurnRects`
  - In `InputTransitions.applyClick`, add End Turn button hit-test calling `TurnTransitions.endPlayerTurn(state, performance.now(), enemyIds)`
  - _Requirements: 6.1, 6.2, 6.5, 6.6_

- [ ] 16. Update `_setupLevel()` to reset all turn sub-state fields
  - Depends on: task 1
  - Reset `turnPhase: 'player'`, `turnTimerStartMs: null`, `enemyUnitQueue: []`, `unitStepStartMs: null`, `resolveTimerStartMs: null`, `pendingMoveId: null` after the existing reset logic
  - _Requirements: 8.2_

- [ ] 17. Write property tests
  - Depends on: tasks 6, 8, 10
  - File: `property-tests/player-turn-timer.property.js`
  - **Property 1** (player timer expiry): `nowMs >= startMs + duration` → `turnPhase === 'enemy'`
  - **Property 2** (player timer continuity): `nowMs < startMs + duration` → state unchanged
  - **Property 3** (resolve expiry): `nowMs >= resolveStart + resolveDuration` → `turnPhase === 'player'`
  - **Property 4** (queue drain): N steps with `elapsed >= interval` → queue shrinks by N
  - Tag: `// Feature: player-turn-timer`
  - _Requirements: 10.5, 10.6, 10.7, 10.8_

- [ ] 18. Final checkpoint — ensure all tests pass
  - Run `npm test` and `npm run test:properties`
  - Fix regressions from `_advanceTurnCounter` removal (update tests that asserted frame-by-frame counter increment)
  - Ensure `game-iso-enemy-spawn.spec.js` (22 tests) still passes — `_waveSpawned` logic is preserved

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "4", "6", "8", "10"] },
    { "id": 2, "tasks": ["3", "5", "7", "9", "11"] },
    { "id": 3, "tasks": ["12", "13", "16"] },
    { "id": 4, "tasks": ["14", "15"] },
    { "id": 5, "tasks": ["17"] },
    { "id": 6, "tasks": ["18"] }
  ]
}
```

## Notes

- `EnemyManager.moveUnit(id)` is a new method that needs to be added to `EnemyManager` — it moves one unit one step along its path. The existing `executeTurn()` (which moves all units at once) is no longer called during the active gameplay loop; `moveUnit()` replaces it for per-unit sequential animation.
- `pendingMoveId` is a transient scratch field. It is always `null` by the time `_render()` runs — it is written by `tick()` and cleared by `loop()` in the same synchronous call stack, so it never appears in a rendered frame.
- The resolve HUD message uses two colours on a single line. The simplest implementation measures the text prefix width, draws it in `#aaa`, then draws the timer segment offset by that width in `#f8c870`.
- `resolveDurationMs` defaults to `10_000` ms but is stored in `GameState` so a future difficulty-scaling feature can vary it by level without changing the transition logic.
- `unitStepIntervalMs = 800` gives roughly one unit move per second at 60 fps, which is legible without feeling sluggish. It can be tuned by adjusting the constant.
