# Implementation Plan: Defensive Phase HUD

## Overview

Implements the four-phase game state machine (`loading → briefing → placement → active`), the `GameState` functional state monad, the briefing screen and placement HUD render functions, and the `js/game-logic/lib/README.md` documentation section covering the pattern.

The work splits into three layers that must be built bottom-up: (1) the state monad primitives and transition modules, (2) the HUD render functions that read from state, (3) the `Game` orchestrator that wires them together.

## Tasks

- [x] 1. Add `GameState` typedef, `makeInitialState`, `update` primitive, and module-level helpers (`_hitTest`, `_canPlaceOn`, `_getUnitBarClick`, `PLACEMENT_DURATION_MS`) to `game-iso.js`
- [x] 2. Implement `PhaseTransitions` in `game-iso.js` (`toBriefing`, `toPlacement`, `toActive`, `toggleFurtherReading` — all guarded, all idempotent)
- [x] 3. Implement `TickTransitions` in `game-iso.js` (`tick` pipeline composing `_animateLift`, `_animateHud`, `_checkPlacementTimer`, `_checkAllPlaced`, `_advanceTurnCounter`)
- [x] 4. Implement `InputTransitions` in `game-iso.js` (`applyClick` phase dispatcher, `_briefingClick`, `_placementClick`, `_tileInteractionClick`, `_applyUnitPlacement`, `applyRightClick`, `applyMouseMove`, `applyMouseLeave`)
- [x] 5. Refactor `Game` object in `game-iso.js` to hold `_state` reference and wire all transition modules into `init()`, `loop()`, and input callbacks; remove standalone `update()`, `handleClick`, `handleRightClick` methods
- [x] 6. Implement `HUD.renderBriefingScreen(ctx, state)` in `hud.js` — collapsed and expanded Further Reading variants, Play/More bounding rects, Play button viewport clamp
- [x] 7. Implement `HUD.renderPlacementHUD(ctx, state)` in `hud.js` — top bar with label, M:SS timer (red ≤ 5 s), Ready button (gold ≤ 10 s), ReadyButton bounding rect
- [x] 8. Implement `_render(state)` phase dispatch in `game-iso.js` — per-phase canvas draw calls, returns `rectPatch`; wire `applyRenderRects` in `loop()`
- [x] 9. Update `EnemyManager.executeTurn` call site in `game-iso.js` to pass `state.placedUnits`; add `placedUnits` parameter with `UnitManager.getPlacedUnits()` default to `enemy-manager.js`
- [x] 10. Add "State Monad (GameState)" section to `js/game-logic/lib/README.md` with `update` primitive example, transition guard pattern, tick pipeline, concurrency safety note, synchrony rule, and state-vs-side-effects table

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": [1] },
    { "wave": 2, "tasks": [2, 6, 7, 10] },
    { "wave": 3, "tasks": [3, 4] },
    { "wave": 4, "tasks": [5] },
    { "wave": 5, "tasks": [8] },
    { "wave": 6, "tasks": [9] }
  ]
}
```

Wave 1 — `GameState` primitives and helpers: must land first as everything builds on `update` and `makeInitialState`.

Wave 2 — `PhaseTransitions` (depends on `update`), `renderBriefingScreen` (depends only on existing HUD helpers), `renderPlacementHUD` (same), and the README docs section (no code dependency) can all proceed in parallel.

Wave 3 — `TickTransitions` and `InputTransitions` both depend on `PhaseTransitions` from wave 2.

Wave 4 — `Game` refactor wires all three transition modules and both HUD functions together.

Wave 5 — `_render` phase dispatch and `loop()` wiring depends on the refactored `Game` (wave 4) and both HUD render functions (wave 2).

Wave 6 — `EnemyManager` call site update is the final integration step once `_render` is wired.

## Notes

### Testing approach

Tasks 1–4 are unit-testable in Node without a DOM. The transition functions are pure `GameState → GameState` — no canvas, no `requestAnimationFrame`, no `UnitManager` singleton needed. A minimal test for each:

```js
// Task 2 — PhaseTransitions guard and idempotency
const s0 = makeInitialState([]);
assert(PhaseTransitions.toBriefing(s0).phase === 'briefing');
assert(PhaseTransitions.toActive(s0) === s0);              // wrong phase → no-op

// Task 3 — TickTransitions timer
const s1 = PhaseTransitions.toPlacement(PhaseTransitions.toBriefing(s0), 1000);
const s2 = TickTransitions.tick(s1, { nowMs: 1000 + PLACEMENT_DURATION_MS });
assert(s2.phase === 'active');

// Task 4 — unit accounting invariant
// sum(qtyRemaining) + placedUnits.length for a given defName === original qty
```

Tasks 6 and 7 can be tested by calling the HUD functions with a mock canvas context (or a real offscreen canvas) and asserting the returned rect shapes and non-null values.

### Synchrony invariant

`_render` (Task 8) and every HUD render function it calls (Tasks 6, 7) must remain fully synchronous — no `await`, no `Promise` returns. Adding `async` to any of these would break the rect write-back safety guarantee. See `game-iso.js` render() comment and `.kiro/specs/defensive-phase-hud/design.md § "The shallow-merge erasure pattern"`.

### Backward compatibility

Task 9 uses a default parameter (`placedUnits = UnitManager.getPlacedUnits()`) on `EnemyManager.executeTurn` so existing callers and tests continue to work without modification during the transition.

### UnitManager after refactor

After Task 5, `UnitManager.units` and `UnitManager.placed` are no longer read at runtime — only at `init()` time to seed `makeInitialState`. `UnitManager.reset()` is still called by `startLevel()` to clear its internal array for correctness, but the values actually used by the game come exclusively from `GameState`.
