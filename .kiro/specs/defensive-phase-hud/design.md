# Design Document: Defensive Phase HUD

## Overview

This feature introduces a functional state monad — `GameState` — that becomes the single source of truth for all mutable game data. The phase machine (`'loading'` → `'briefing'` → `'placement'` → `'active'`), unit placements, placement timer, HUD open/closed state, tile selection, and every other piece of previously scattered mutable state live exclusively inside `GameState`. Nothing mutates `GameState` in place; instead every operation is a pure function `GameState → GameState` (a state transition). The game loop reads the current state, computes a new state by composing transitions, and writes the new state as the next frame's input.

This has three practical benefits:
1. **No accidental mutation** — `GameState` is a frozen plain object. Code that tries to assign a field gets a runtime error in development.
2. **Predictable tests** — every transition is `(state, input) → newState`. No mocks, no singletons, no setup beyond constructing an initial state value.
3. **Traceable bugs** — every frame transition can be logged or snapshotted because it is just a value.

The two modules that change are still `js/game-logic/game-iso.js` and `js/game-logic/lib/hud.js`. No new files are created.

---

## Architecture

```
                 ┌─────────────────────────────────────────────┐
                 │              GameState  (frozen object)      │
                 │                                              │
                 │  phase           PlacedUnit[]                │
                 │  briefingOpen    UnitDef[]  (with qty)       │
                 │  placementStart  selectedUnitIdx             │
                 │  turnCounter     selectedTile                │
                 │  hudOpen         selectedLift / Target       │
                 │  hudWidth / Target  hoveredTile              │
                 │  lastBriefingRects  lastPlacementRects       │
                 └──────────────────┬──────────────────────────┘
                                    │ read-only
          ┌─────────────────────────▼────────────────────────────┐
          │  Pure transition functions  (GameState → GameState)   │
          │                                                       │
          │  PhaseTransitions.toBriefing(s)                       │
          │  PhaseTransitions.toPlacement(s, nowMs)               │
          │  PhaseTransitions.toActive(s)                         │
          │  InputTransitions.applyClick(s, x, y, deps)           │
          │  InputTransitions.applyMouseMove(s, x, y, deps)       │
          │  TickTransitions.tick(s, nowMs, deps)                  │
          └─────────────────────────┬────────────────────────────┘
                                    │ produce new GameState
          ┌─────────────────────────▼────────────────────────────┐
          │  Game  (game-iso.js — thin orchestrator)              │
          │                                                       │
          │  _state: GameState   ← single live reference         │
          │  loop()              reads _state, calls transitions, │
          │                      writes new value back to _state  │
          │  render(_state)      pure read — no state changes     │
          └──────────────────────────────────────────────────────┘
```

`Game` is reduced to a thin shell: it owns the canvas/ctx, wires DOM events, and drives `requestAnimationFrame`. All logic lives in pure functions.

---

## `GameState` — the state monad type

### Shape

```js
/**
 * GameState — the complete, immutable snapshot of game logic state for one frame.
 *
 * Never mutated in place. All transitions return a new frozen object.
 *
 * @typedef {Readonly<{
 *   // ── Phase machine ──────────────────────────────────────────────────
 *   phase:               'loading' | 'briefing' | 'placement' | 'active',
 *   placementStartMs:    number | null,   // performance.now() at placement entry
 *   placementDone:       boolean,         // true once → 'active' has fired
 *   briefingOpen:        boolean,         // FurtherReadingPanel expanded
 *
 *   // ── Units ──────────────────────────────────────────────────────────
 *   unitDefs:            ReadonlyArray<UnitDef>,    // definitions + per-type qty tracking
 *   placedUnits:         ReadonlyArray<PlacedUnit>, // units on the map
 *
 *   // ── Tile interaction ───────────────────────────────────────────────
 *   hoveredTile:         {row:number,col:number} | null,
 *   selectedTile:        {row:number,col:number} | null,
 *   selectedLift:        number,
 *   selectedLiftTarget:  number,
 *
 *   // ── HUD chrome ─────────────────────────────────────────────────────
 *   selectedUnitIdx:     number,    // -1 = none
 *   hudOpen:             boolean,
 *   hudWidth:            number,    // animated, pixels
 *   hudTargetWidth:      number,
 *
 *   // ── Turn counter ───────────────────────────────────────────────────
 *   turnCounter:         number,
 *
 *   // ── Render output (click-target rects from last frame) ─────────────
 *   lastBriefingRects:   { playButtonRect: Rect|null, moreButtonRect: Rect|null } | null,
 *   lastPlacementRects:  { readyButtonRect: Rect|null } | null,
 * }>} GameState
 */
```

### Constructor

```js
/**
 * Returns the initial frozen GameState.
 * All fields explicitly set — no implicit undefined.
 *
 * @param {UnitDef[]} unitDefs  — loaded from UnitManager.parseCSV(), passed in at init time
 * @returns {GameState}
 */
function makeInitialState(unitDefs) {
    return Object.freeze({
        phase:              'loading',
        placementStartMs:   null,
        placementDone:      false,
        briefingOpen:       false,

        unitDefs:           Object.freeze(unitDefs.map(d => Object.freeze({ ...d }))),
        placedUnits:        Object.freeze([]),

        hoveredTile:        null,
        selectedTile:       null,
        selectedLift:       0,
        selectedLiftTarget: 0,

        selectedUnitIdx:    -1,
        hudOpen:            false,
        hudWidth:           0,
        hudTargetWidth:     0,

        turnCounter:        0,

        lastBriefingRects:  null,
        lastPlacementRects: null,
    });
}
```

### `update` — the state monad primitive

Every transition is expressed using `update`, a helper that shallow-merges a partial patch onto a frozen state and returns a new frozen object. It never writes to the input.

```js
/**
 * Produce a new GameState by merging `patch` over `state`.
 * The result is frozen. The input state is untouched.
 *
 * @param {GameState} state
 * @param {Partial<GameState>} patch
 * @returns {GameState}
 */
function update(state, patch) {
    return Object.freeze(Object.assign({}, state, patch));
}
```

Arrays inside the state (e.g. `placedUnits`, `unitDefs`) are replaced atomically — spread a new array into the patch. Individual array items are also frozen on construction.

---

## Phase transitions — `PhaseTransitions`

All phase transitions are pure functions: they take a `GameState` and return a new one. They never call side-effecting code.

```js
const PhaseTransitions = {
    /**
     * loading → briefing.
     * Called by Game.init() after all assets are loaded.
     * Guard: phase must be 'loading'.
     */
    toBriefing(state) {
        if (state.phase !== 'loading') return state; // no-op
        return update(state, { phase: 'briefing', briefingOpen: false });
    },

    /**
     * briefing → placement.
     * Called when the Play button is clicked.
     * Guard: phase must be 'briefing'.
     *
     * @param {GameState} state
     * @param {number}    nowMs   — performance.now() at click time
     */
    toPlacement(state, nowMs) {
        if (state.phase !== 'briefing') return state; // no-op
        return update(state, {
            phase:            'placement',
            placementStartMs: nowMs,
            placementDone:    false,
        });
    },

    /**
     * placement → active.
     * Called on timer expiry, full-placement detection, or ReadyButton click.
     * Guard: phase must be 'placement' AND placementDone must be false.
     * Idempotent: repeated calls return the same state unchanged.
     */
    toActive(state) {
        if (state.phase !== 'placement' || state.placementDone) return state;
        return update(state, { phase: 'active', placementDone: true });
    },

    /**
     * Toggle the FurtherReadingPanel within the briefing screen.
     * Guard: phase must be 'briefing'.
     */
    toggleFurtherReading(state) {
        if (state.phase !== 'briefing') return state;
        return update(state, { briefingOpen: !state.briefingOpen });
    },
};
```

The transition table maps every possible trigger to its transition function:

| Trigger | Guard | Transition |
|---------|-------|-----------|
| `init()` assets loaded | `phase === 'loading'` | `PhaseTransitions.toBriefing(s)` |
| Play button click | `phase === 'briefing'` | `PhaseTransitions.toPlacement(s, nowMs)` |
| More button click | `phase === 'briefing'` | `PhaseTransitions.toggleFurtherReading(s)` |
| Timer expired | `phase === 'placement' && !placementDone` | `PhaseTransitions.toActive(s)` |
| All units placed | `phase === 'placement' && !placementDone` | `PhaseTransitions.toActive(s)` |
| Ready button click | `phase === 'placement' && !placementDone` | `PhaseTransitions.toActive(s)` |

---

## Tick transitions — `TickTransitions`

`TickTransitions.tick` is the per-frame update function. It takes the current state and external read-only dependencies (`deps`), applies every per-frame transformation in sequence, and returns the new state. No mutation anywhere.

```js
/**
 * @typedef {{ scrollDir: {dx,dy}, keys: {zoomIn,zoomOut}, nowMs: number }} TickDeps
 */

const TickTransitions = {
    /**
     * Apply all per-frame logic: camera scroll, zoom, lift animation,
     * HUD width animation, placement timer check, and enemy phase gating.
     *
     * @param {GameState}  state
     * @param {TickDeps}   deps   — external read-only values (input, clock)
     * @returns {GameState}
     */
    tick(state, deps) {
        // Compose a series of pure sub-transitions
        return [
            s => TickTransitions._animateLift(s),
            s => TickTransitions._animateHud(s),
            s => TickTransitions._checkPlacementTimer(s, deps.nowMs),
            s => TickTransitions._checkAllPlaced(s),
            s => TickTransitions._advanceTurnCounter(s),
        ].reduce((s, fn) => fn(s), state);
        // Camera scroll and zoom are side-effects on IsoCamera — they remain
        // imperative in Game.loop() but do not touch GameState.
    },

    _animateLift(state) {
        const speed = 0.3;
        const lift = state.selectedLift;
        const target = state.selectedLiftTarget;
        if (lift === target) return state;
        const next = lift < target
            ? Math.min(target, lift + speed)
            : Math.max(target, lift - speed);
        return update(state, { selectedLift: next });
    },

    _animateHud(state) {
        const speed = 12;
        const w = state.hudWidth;
        const t = state.hudTargetWidth;
        if (w === t) return state;
        const next = w < t ? Math.min(t, w + speed) : Math.max(t, w - speed);
        return update(state, { hudWidth: next });
    },

    _checkPlacementTimer(state, nowMs) {
        if (state.phase !== 'placement' || state.placementDone) return state;
        const elapsed = nowMs - state.placementStartMs;
        if (elapsed >= PLACEMENT_DURATION_MS) {
            return PhaseTransitions.toActive(state);
        }
        return state;
    },

    _checkAllPlaced(state) {
        if (state.phase !== 'placement' || state.placementDone) return state;
        const allPlaced = state.unitDefs.length > 0 &&
            state.unitDefs.every(u => u.qtyRemaining <= 0);
        if (allPlaced) return PhaseTransitions.toActive(state);
        return state;
    },

    _advanceTurnCounter(state) {
        // Only increment when enemy phase is active
        if (state.phase !== 'active') return state;
        return update(state, { turnCounter: state.turnCounter + 1 });
    },
};
```

`TickTransitions.tick` is a pipeline: each sub-transition receives the output of the previous one. Adding a new per-frame behaviour is adding one more function to the array — no existing code changes.

---

## Input transitions — `InputTransitions`

Click and mouse-move handlers are pure functions that map `(state, x, y, deps) → GameState`.

```js
/**
 * @typedef {{ level, canvasW, canvasH, nowMs: number }} InputDeps
 */

const InputTransitions = {
    /**
     * Apply a left-click at (mouseX, mouseY) to the current state.
     * Dispatches based on phase, then applies the appropriate sub-transition.
     *
     * @param {GameState}  state
     * @param {number}     mouseX
     * @param {number}     mouseY
     * @param {InputDeps}  deps
     * @returns {GameState}
     */
    applyClick(state, mouseX, mouseY, deps) {
        switch (state.phase) {
            case 'briefing':
                return InputTransitions._briefingClick(state, mouseX, mouseY, deps.nowMs);
            case 'placement':
                return InputTransitions._placementClick(state, mouseX, mouseY, deps);
            case 'active':
                return InputTransitions._activeClick(state, mouseX, mouseY, deps);
            default:
                return state; // 'loading' — clicks are ignored
        }
    },

    _briefingClick(state, x, y, nowMs) {
        const rects = state.lastBriefingRects;
        if (!rects) return state;
        if (rects.playButtonRect && _hitTest(x, y, rects.playButtonRect)) {
            return PhaseTransitions.toPlacement(state, nowMs);
        }
        if (rects.moreButtonRect && _hitTest(x, y, rects.moreButtonRect)) {
            return PhaseTransitions.toggleFurtherReading(state);
        }
        return state; // no map interaction during briefing
    },

    _placementClick(state, x, y, deps) {
        // 1. Ready button
        const rects = state.lastPlacementRects;
        if (rects && rects.readyButtonRect && _hitTest(x, y, rects.readyButtonRect)) {
            return PhaseTransitions.toActive(state);
        }
        // 2. Fall through to shared tile/unit click logic
        return InputTransitions._tileInteractionClick(state, x, y, deps);
    },

    _activeClick(state, x, y, deps) {
        return InputTransitions._tileInteractionClick(state, x, y, deps);
    },

    /**
     * Shared tile-click logic used by both placement and active phases.
     * Returns a new state with updated unitDefs, placedUnits, tile selection, etc.
     */
    _tileInteractionClick(state, mouseX, mouseY, deps) {
        const { level, canvasW, canvasH } = deps;

        // Unit bar click — toggle selection
        const barIdx = _getUnitBarClick(mouseX, mouseY, state.unitDefs, canvasW, canvasH);
        if (barIdx >= 0) {
            const newIdx = state.selectedUnitIdx === barIdx ? -1 : barIdx;
            return update(state, { selectedUnitIdx: newIdx });
        }

        // Tile panel close button
        if (state.hudOpen &&
            mouseX < state.hudWidth &&
            mouseY > canvasH - HUD.HUD_HEIGHT &&
            mouseX > state.hudWidth - 20 &&
            mouseY < canvasH - HUD.HUD_HEIGHT + 20) {
            return update(state, { hudOpen: false, hudTargetWidth: 0 });
        }

        const clicked = IsoCamera.screenToGrid(mouseX, mouseY, level.width, level.height);
        if (!clicked) return state;

        // Unit placement mode
        if (state.selectedUnitIdx >= 0) {
            return InputTransitions._applyUnitPlacement(state, clicked, level);
        }

        // Normal tile selection / deselection
        const isSame = state.selectedTile &&
            clicked.row === state.selectedTile.row &&
            clicked.col === state.selectedTile.col;
        if (isSame) {
            return update(state, {
                selectedTile: null, selectedLiftTarget: 0,
                hudOpen: false, hudTargetWidth: 0,
            });
        }
        return update(state, {
            selectedTile: clicked, selectedLiftTarget: 3,
            hudOpen: true, hudTargetWidth: HUD.HUD_MAX_WIDTH,
        });
    },

    /**
     * Pure unit placement: returns new state with updated unitDefs and placedUnits.
     * No side effects, no UnitManager mutation.
     */
    _applyUnitPlacement(state, clicked, level) {
        const unitDef = state.unitDefs[state.selectedUnitIdx];
        if (!unitDef) return state;

        const tile = level.tiles.find(t => t.row === clicked.row && t.col === clicked.col);

        // Remove existing unit of same type at clicked tile
        const existingIdx = state.placedUnits.findIndex(
            u => u.row === clicked.row && u.col === clicked.col && u.defName === unitDef.name
        );
        if (existingIdx >= 0) {
            // Return the unit to the pool
            const newPlaced = state.placedUnits.filter((_, i) => i !== existingIdx);
            const newDefs = state.unitDefs.map(d =>
                d.name === unitDef.name
                    ? Object.freeze({ ...d, qtyRemaining: d.qtyRemaining + 1 })
                    : d
            );
            return update(state, {
                placedUnits: Object.freeze(newPlaced),
                unitDefs: Object.freeze(newDefs),
            });
        }

        // Place new unit
        if (unitDef.qtyRemaining <= 0) return state;
        if (!tile || !_canPlaceOn(tile.sprite)) return state;

        const sprite = unitDef.sprites[Math.floor(Math.random() * unitDef.sprites.length)];
        const newUnit = Object.freeze({
            defName: unitDef.name,
            sprite,
            row: clicked.row,
            col: clicked.col,
            currentHealth: unitDef.health,
        });
        const newPlaced = Object.freeze([...state.placedUnits, newUnit]);
        const newDefs = state.unitDefs.map(d =>
            d.name === unitDef.name
                ? Object.freeze({ ...d, qtyRemaining: d.qtyRemaining - 1 })
                : d
        );
        const newIdx = newDefs[state.selectedUnitIdx].qtyRemaining <= 0 ? -1 : state.selectedUnitIdx;
        return update(state, {
            placedUnits:    newPlaced,
            unitDefs:       Object.freeze(newDefs),
            selectedUnitIdx: newIdx,
        });
    },

    applyRightClick(state, mouseX, mouseY, deps) {
        const { level } = deps;
        const clicked = IsoCamera.screenToGrid(mouseX, mouseY, level.width, level.height);
        if (!clicked) return state;
        const existingIdx = state.placedUnits.findIndex(
            u => u.row === clicked.row && u.col === clicked.col
        );
        if (existingIdx < 0) return state;
        const removed = state.placedUnits[existingIdx];
        const newPlaced = state.placedUnits.filter((_, i) => i !== existingIdx);
        const newDefs = state.unitDefs.map(d =>
            d.name === removed.defName
                ? Object.freeze({ ...d, qtyRemaining: d.qtyRemaining + 1 })
                : d
        );
        return update(state, {
            placedUnits: Object.freeze(newPlaced),
            unitDefs:    Object.freeze(newDefs),
        });
    },

    applyMouseMove(state, x, y, deps) {
        const { level } = deps;
        const tile = IsoCamera.screenToGrid(x, y, level.width, level.height);
        if (state.hoveredTile === tile) return state; // object identity fast-path skipped; use value compare
        return update(state, { hoveredTile: tile });
    },

    applyMouseLeave(state) {
        if (state.hoveredTile === null) return state;
        return update(state, { hoveredTile: null });
    },
};
```

---

## Render output transitions

`render` reads `GameState` and returns a new state with the bounding rects written back for the next frame's hit-testing. The render function itself performs canvas draw calls (side effects), but the state transition it produces is pure in the sense that the output state is fully determined by the input.

```js
/**
 * Store the bounding rects emitted by HUD render functions back into state.
 * Called at the end of each frame's render pass.
 *
 * @param {GameState} state
 * @param {{ lastBriefingRects?, lastPlacementRects? }} rectPatch
 * @returns {GameState}
 */
function applyRenderRects(state, rectPatch) {
    return update(state, rectPatch);
}
```

This makes the click-target geometry data flow explicit: render produces rects, `applyRenderRects` stores them in state, `applyClick` reads them from state next frame.

---

## `Game` — the thin orchestrator

`Game` now holds exactly one piece of live mutable state: `_state`, the current `GameState` value. Everything else is derived.

### State initialisation

```js
const Game = {
    canvas: null,
    ctx: null,
    _state: null,   // set in init() after assets load

    async init() {
        // … canvas, IsoCamera, IsoInput, PixiJS setup unchanged …

        await SpriteManager.loadAtlas(…);
        await LevelLoader.loadLevelList();
        await UnitManager.loadResources();

        const level = LevelLoader.getCurrentLevel();
        if (!level || level.tiles.length === 0) { console.error('No level data!'); return; }

        // Build initial state from loaded data
        // unitDefs come from UnitManager after loadResources(); we copy them into
        // the frozen state so UnitManager is no longer consulted for state queries.
        this._state = makeInitialState(UnitManager.units);

        this._setupLevel();

        // Transition: loading → briefing
        this._state = PhaseTransitions.toBriefing(this._state);

        this.loop();
    },
```

### Wiring input events

Input handlers simply call the appropriate transition and assign the result back to `_state`:

```js
    _wireInput() {
        IsoInput.init(this.canvas, {
            onMouseMove: (x, y) => {
                const level = LevelLoader.getCurrentLevel();
                this._state = InputTransitions.applyMouseMove(
                    this._state, x, y, { level }
                );
            },
            onClick: (x, y) => {
                const level = LevelLoader.getCurrentLevel();
                this._state = InputTransitions.applyClick(
                    this._state, x, y,
                    { level, canvasW: this.canvas.width, canvasH: this.canvas.height,
                      nowMs: performance.now() }
                );
            },
            onRightClick: (x, y) => {
                const level = LevelLoader.getCurrentLevel();
                this._state = InputTransitions.applyRightClick(
                    this._state, x, y, { level }
                );
            },
            onViewpointToggle: () => {
                IsoCamera.toggleViewpoint();
                this._centerOnFlag();
            },
            onZoom: (dir) => IsoCamera.applyZoom(dir * IsoCamera.zoomSpeed * 2),
            onMouseLeave: () => {
                this._state = InputTransitions.applyMouseLeave(this._state);
            },
        });
    },
```

### Game loop

```js
    loop() {
        // 1. Tick: apply all per-frame pure transitions
        this._state = TickTransitions.tick(this._state, {
            nowMs: performance.now(),
        });

        // 2. Side-effecting camera update (cannot be in state monad —
        //    IsoCamera owns its own GL/DOM state)
        const { dx, dy } = IsoInput.getScrollDir();
        if (dx || dy) IsoCamera.scroll(dx, dy);
        if (IsoInput.keys.zoomIn)  IsoCamera.applyZoom(IsoCamera.zoomSpeed);
        if (IsoInput.keys.zoomOut) IsoCamera.applyZoom(-IsoCamera.zoomSpeed);

        // 3. Enemy phase — side effect, gated by phase
        if (this._state.phase === 'active') {
            try {
                EnemyManager.executeTurn(this._state.turnCounter);
            } catch (e) {
                console.warn('[Game] EnemyManager.executeTurn() failed:', e);
            }
        }

        // 4. Render — reads state, emits canvas draw calls, returns rect patch
        const rectPatch = this._render(this._state);

        // 5. Write render output (bounding rects) back into state
        this._state = applyRenderRects(this._state, rectPatch);

        requestAnimationFrame(() => this.loop());
    },
```

### `_render` — pure read of state, returns rect patch

`_render` never writes to `this._state`. It returns a partial `GameState` patch containing the rects emitted by the HUD functions this frame. `Game.loop` applies the patch.

```js
    _render(state) {
        const ctx = this.ctx;
        const { canvasW, canvasH } = { canvasW: this.canvas.width, canvasH: this.canvas.height };

        ctx.fillStyle = '#1a2a12';
        ctx.fillRect(0, 0, canvasW, canvasH);

        if (state.phase === 'loading') {
            ctx.fillStyle = '#fff'; ctx.font = '18px monospace'; ctx.textAlign = 'center';
            ctx.fillText('Loading...', canvasW / 2, canvasH / 2);
            return {};
        }

        const level = LevelLoader.getCurrentLevel();

        // Terrain (all play phases)
        ctx.save();
        IsoCamera.applyTransform(ctx);
        IsoRenderer.drawTerrain(ctx, IsoCamera, level.tiles, {
            hoveredTile:   state.hoveredTile,
            selectedTile:  state.selectedTile,
            selectedLift:  state.selectedLift,
        });
        ctx.restore();

        // Briefing overlay
        if (state.phase === 'briefing') {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, canvasW, canvasH);
            const lastBriefingRects = HUD.renderBriefingScreen(ctx, {
                furtherReadingOpen: state.briefingOpen,
                canvasW, canvasH,
            });
            return { lastBriefingRects };
        }

        // Units (placement + active)
        ctx.save();
        IsoCamera.applyTransform(ctx);
        IsoRenderer.drawUnits(ctx, IsoCamera, state.placedUnits);
        ctx.restore();

        // Placement HUD
        if (state.phase === 'placement') {
            const elapsed    = performance.now() - state.placementStartMs;
            const remaining  = Math.max(0, PLACEMENT_DURATION_MS - elapsed);
            const secsLeft   = Math.floor(remaining / 1000);

            const lastPlacementRects = HUD.renderPlacementHUD(ctx, {
                secondsRemaining: secsLeft, canvasW, canvasH,
            });
            HUD.renderTilePanel(ctx, {
                hudWidth: state.hudWidth, canvasH,
                selectedTile: state.selectedTile, level,
            });
            const barY = HUD.renderUnitBar(ctx, {
                units: state.unitDefs, selectedUnitIdx: state.selectedUnitIdx,
                canvasW, canvasH,
            });
            if (state.selectedUnitIdx >= 0) {
                HUD.renderUnitDetail(ctx, state.unitDefs[state.selectedUnitIdx], canvasW, barY);
            }
            return { lastPlacementRects };
        }

        // Active phase — unchanged from current render body
        HUD.renderTilePanel(ctx, {
            hudWidth: state.hudWidth, canvasH,
            selectedTile: state.selectedTile, level,
        });
        HUD.renderTopBar(ctx, canvasW,
            level.name + ' | WASD scroll | +/- zoom | SPACE rotate | ' +
            IsoCamera.viewpoint + ' ' + Math.round(IsoCamera.zoom * 100) + '%');
        const barY = HUD.renderUnitBar(ctx, {
            units: state.unitDefs, selectedUnitIdx: state.selectedUnitIdx,
            canvasW, canvasH,
        });
        if (state.selectedUnitIdx >= 0) {
            HUD.renderUnitDetail(ctx, state.unitDefs[state.selectedUnitIdx], canvasW, barY);
        }
        return {};
    },
```

---

## Changes to `hud.js`

`renderBriefingScreen` and `renderPlacementHUD` are unchanged from the design signatures agreed in this spec — they are pure render functions that take a plain state object, draw to canvas, and return bounding rects. The HUD functions are already stateless; no changes to the four existing render functions are needed.

Both new functions follow the same drawing conventions as the existing HUD panels:
- Background: `rgba(15, 12, 10, 0.92)`
- Border: `drawSheenBorder` with gold midpoint `#c8b890`
- Font: `monospace`
- Text colours: headline `#c8b890`, body `#aaa`, dim headings `#8a7a60`

See the mockup geometry and rendering code in the requirements document — the implementation maps directly from the mockup.

### `renderBriefingScreen(ctx, state)`

```
@param  {{ furtherReadingOpen: boolean, canvasW: number, canvasH: number }} state
@returns {{ playButtonRect: Rect|null, moreButtonRect: Rect|null }}
```

Renders the full-canvas briefing overlay. Returns `{ playButtonRect: null, moreButtonRect: null }` when `canvasW <= 0 || canvasH <= 0`.

### `renderPlacementHUD(ctx, state)`

```
@param  {{ secondsRemaining: number, canvasW: number, canvasH: number }} state
@returns {{ readyButtonRect: Rect|null }}
```

Renders the placement-phase top bar (label, M:SS timer, Ready button). Timer text turns `#f88` when `secondsRemaining <= 5`; Ready button border and text turn gold (`#c8b890`) when `secondsRemaining <= 10`. Returns `{ readyButtonRect: null }` when `canvasW <= 0 || canvasH <= 0`.

---

## Module-level helpers

These are plain functions at module scope in `game-iso.js`, not methods on `Game`. They contain no state.

```js
const PLACEMENT_DURATION_MS = 30_000;

/** Shallow-merge patch onto frozen state, return new frozen state. */
function update(state, patch) {
    return Object.freeze(Object.assign({}, state, patch));
}

/** AABB hit-test. */
function _hitTest(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w &&
           y >= rect.y && y <= rect.y + rect.h;
}

/** Tile placement allowlist — mirrors UnitManager.canPlaceOn without the singleton. */
function _canPlaceOn(sprite) {
    const blocked = ['tree-', 'water-', 'castle-wall', 'castle-keep-', 'castle-gatehouse', 'rock'];
    return !blocked.some(prefix => sprite.startsWith(prefix));
}

/** Unit-bar hit-test — mirrors HUD.getUnitBarClick without the singleton dependency. */
function _getUnitBarClick(mouseX, mouseY, unitDefs, canvasW, canvasH) {
    if (!unitDefs || unitDefs.length === 0) return -1;
    const BOX = HUD.UNIT_BOX_SIZE, PAD = HUD.UNIT_BOX_PAD;
    const totalBarW = unitDefs.length * (BOX + PAD) - PAD;
    const barStartX = (canvasW - totalBarW) / 2;
    const barY = canvasH - BOX - 28;
    if (mouseY < barY || mouseY > barY + BOX + 20) return -1;
    for (let i = 0; i < unitDefs.length; i++) {
        const bx = barStartX + i * (BOX + PAD);
        if (mouseX >= bx && mouseX <= bx + BOX) return i;
    }
    return -1;
}
```

---

## UnitManager relationship

`UnitManager` remains as a resource loader. After `init()` calls `UnitManager.loadResources()`, the parsed `UnitManager.units` array is copied into the frozen `GameState.unitDefs`. From that point on, `GameState` is the authority on quantities and placements — `UnitManager.placed` and `UnitManager.units[i].qtyRemaining` are no longer consulted at runtime. `UnitManager.reset()` is still called at level start (to clear its internal array), but the values we actually use come from `makeInitialState(UnitManager.units)`.

`EnemyManager.executeTurn()` currently reads `UnitManager.getPlacedUnits()`. After this change it must be updated to receive `state.placedUnits` as a parameter instead. This is a one-line caller change in `Game.loop()`:

```js
EnemyManager.executeTurn(state.turnCounter, state.placedUnits);
```

`EnemyManager` is updated to accept `placedUnits` as a second argument (defaulting to `UnitManager.getPlacedUnits()` for backward compatibility during the transition).

---

## Data models

### `UnitDef` (inside GameState)

```ts
interface UnitDef {
    readonly name:         string;
    readonly sprites:      readonly string[];
    readonly qty:          number;      // total from CSV — never changes
    readonly qtyRemaining: number;      // decrements on place, increments on remove
    readonly health:       number;
    readonly attack:       number;
    readonly defense:      number;
}
```

### `PlacedUnit` (inside GameState)

```ts
interface PlacedUnit {
    readonly defName:       string;  // key back to UnitDef.name
    readonly sprite:        string;  // resolved at placement time
    readonly row:           number;
    readonly col:           number;
    readonly currentHealth: number;
}
```

Placed units no longer hold a reference to `UnitDef`. They hold `defName` as a lookup key. This prevents aliasing bugs where mutating a `PlacedUnit` could corrupt a `UnitDef`.

### `Rect`

```ts
interface Rect { x: number; y: number; w: number; h: number; }
```

---

## Correctness properties

### Property 1: Immutability invariant

For any transition function `f` in `PhaseTransitions`, `TickTransitions`, or `InputTransitions`, and any `GameState s`, the value of `s` after calling `f(s)` is reference-identical to the input — i.e. `f` never writes to its argument. `Object.freeze` enforces this at runtime.

### Property 2: Phase monotonicity

`phase` advances only through `'loading' → 'briefing' → 'placement' → 'active'`. Every transition function guards on the current phase and returns the input state unchanged if the guard fails. No backward transition is reachable.

### Property 3: Single active-phase transition

`toActive` checks `!state.placementDone` before proceeding. The first call sets `placementDone: true` in the returned state. All subsequent calls return the input state unchanged.

### Property 4: Enemy gating invariant

`EnemyManager.executeTurn` is only called inside `Game.loop()` when `state.phase === 'active'`. Transition functions do not call `EnemyManager`.

### Property 5: Unit accounting invariant

For any sequence of `_applyUnitPlacement` and `applyRightClick` calls starting from a valid `GameState s`:

```
sum(unitDefs[i].qtyRemaining) + placedUnits.filter(u => u.defName === unitDefs[i].name).length
  === unitDefs[i].qty       (constant)
```

Total units are conserved: placing decrements `qtyRemaining` by 1 and adds one `PlacedUnit`; removing does the inverse.

### Property 6: No UnitManager state reads after init

After `makeInitialState(UnitManager.units)` is called in `init()`, no runtime code path reads from `UnitManager.units` or `UnitManager.placed`. All state queries go through `GameState`.

### Property 7: Null-rect graceful degradation

`InputTransitions.applyClick` checks `rects && rects.playButtonRect` before calling `_hitTest`. A `null` rect from a zero-dimension canvas never reaches hit-testing.

### Property 8: Render idempotence

Calling `_render(state)` twice with the same `state` value produces the same canvas output and returns the same rect patch. The function has no reads from `this._state` and no writes to any state — it only reads from its argument.

---

## File summary

| File | Change type | Lines added (estimate) |
|------|------------|------------------------|
| `js/game-logic/game-iso.js` | Modified | ~120 |
| `js/game-logic/lib/hud.js` | Modified | ~130 |

No new files. `level-loader.js`, `iso-renderer.js`, `sprites.js`, and generator scripts are unchanged. `enemy-manager.js` receives one one-line call-site update to accept `placedUnits` as a parameter.

---

## State Monad — Pseudocode and Practical Walkthrough

This section explains how the state monad works conceptually, what it looks like in pseudocode, and then traces exactly what happens in this codebase on a real frame.

### What a state monad is — in one paragraph

A state monad is a design pattern for threading a value — the "state" — through a sequence of operations without ever mutating it. Each operation is a function that takes the current state and returns a new state. You chain them by feeding the output of one into the input of the next. The state value itself is immutable: nothing writes to it in place. In JavaScript the simplest encoding is a frozen plain object plus a helper function (`update`) that merges a patch and returns a fresh frozen object.

### Pseudocode: the core abstraction

```
-- The state type (a plain record, frozen at runtime)
type GameState = {
    phase,
    unitDefs,
    placedUnits,
    ...allOtherFields
}

-- The primitive: shallow-merge a patch, return a new frozen state
update :: (GameState, Patch) -> GameState
update(state, patch) =
    freeze({ ...state, ...patch })

-- A transition: a function from GameState to GameState
type Transition = GameState -> GameState

-- Composing two transitions sequentially
andThen :: (Transition, Transition) -> Transition
andThen(f, g) = state -> g(f(state))

-- Composing a list of transitions (reduce is the same as piping)
pipe :: [Transition] -> Transition
pipe(fns) = state -> fns.reduce((s, fn) -> fn(s), state)
```

That is the entire pattern. `update` is the constructor. `andThen` / `pipe` is sequencing. Every other function in `PhaseTransitions`, `TickTransitions`, and `InputTransitions` is just a `Transition` built from those two primitives.

### Pseudocode: a guarded phase transition

```
-- Guard: only fire if the precondition holds; otherwise return state unchanged
toBriefing :: GameState -> GameState
toBriefing(state) =
    IF state.phase != 'loading'
        RETURN state                      -- no-op; wrong phase
    RETURN update(state, { phase: 'briefing', briefingOpen: false })
```

This is the critical property: every transition is *total* — it always returns a `GameState`. It never throws, never mutates, never returns null. If the guard fails, the input falls through unchanged. This means you can call any transition in any order without worrying about preconditions blowing up.

### Pseudocode: the tick pipeline

```
-- One frame of per-frame logic, expressed as a pipeline of transitions
tick :: (GameState, { nowMs }) -> GameState
tick(state, deps) =
    pipe([
        animateLift,
        animateHud,
        s -> checkPlacementTimer(s, deps.nowMs),
        checkAllPlaced,
        advanceTurnCounter,
    ])(state)

-- Each sub-transition is independent — output of one is input of next
animateLift :: GameState -> GameState
animateLift(state) =
    IF state.selectedLift == state.selectedLiftTarget
        RETURN state                      -- no change needed, skip allocation
    next = clamp(state.selectedLift, state.selectedLiftTarget, speed=0.3)
    RETURN update(state, { selectedLift: next })

checkPlacementTimer :: (GameState, nowMs) -> GameState
checkPlacementTimer(state, nowMs) =
    IF state.phase != 'placement' OR state.placementDone
        RETURN state
    elapsed = nowMs - state.placementStartMs
    IF elapsed >= PLACEMENT_DURATION_MS
        RETURN toActive(state)            -- delegate to the phase transition
    RETURN state
```

Adding a new per-frame behaviour is appending one more function to the `pipe` array. No other code changes.

### Pseudocode: input dispatch

```
-- Click dispatch: choose a sub-transition based on phase
applyClick :: (GameState, x, y, deps) -> GameState
applyClick(state, x, y, deps) =
    MATCH state.phase
        'briefing'  -> briefingClick(state, x, y, deps.nowMs)
        'placement' -> placementClick(state, x, y, deps)
        'active'    -> tileInteractionClick(state, x, y, deps)
        _           -> state              -- 'loading': no-op

-- Unit placement: pure computation over state arrays, no singletons
applyUnitPlacement :: (GameState, clickedTile, level) -> GameState
applyUnitPlacement(state, clicked, level) =
    unitDef = state.unitDefs[state.selectedUnitIdx]
    IF unitDef is null RETURN state

    existingIdx = state.placedUnits.findIndex(u -> u matches clicked tile + unitDef)

    IF existingIdx >= 0
        -- Remove: rebuild arrays without mutation
        newPlaced = state.placedUnits.filter(i != existingIdx)
        newDefs   = state.unitDefs.map(d -> d.name == unitDef.name
                        ? freeze({ ...d, qtyRemaining: d.qtyRemaining + 1 })
                        : d)
        RETURN update(state, { placedUnits: freeze(newPlaced), unitDefs: freeze(newDefs) })

    IF unitDef.qtyRemaining <= 0 RETURN state
    IF NOT canPlaceOn(tile.sprite) RETURN state

    -- Add: create new unit value, rebuild arrays
    newUnit   = freeze({ defName: unitDef.name, sprite, row, col, currentHealth })
    newPlaced = freeze([ ...state.placedUnits, newUnit ])
    newDefs   = state.unitDefs.map(d -> d.name == unitDef.name
                    ? freeze({ ...d, qtyRemaining: d.qtyRemaining - 1 })
                    : d)
    RETURN update(state, { placedUnits: newPlaced, unitDefs: newDefs })
```

The key thing: no `UnitManager.placed.push(...)`, no `unitDef.qtyRemaining--`. Arrays are rebuilt from scratch each time using `.filter` and `.map`, and the result is frozen before being stored.

### Pseudocode: the game loop

```
-- The entire frame, laid out as a sequence of state operations
loop :: () -> ()
loop() =
    -- 1. Pure: apply all per-frame logic
    _state = TickTransitions.tick(_state, { nowMs: performance.now() })

    -- 2. Impure: camera (owns DOM/GL state, cannot be in GameState)
    IsoCamera.scroll(IsoInput.getScrollDir())
    IsoCamera.applyZoom(IsoInput.getZoomDelta())

    -- 3. Impure: enemy AI (side-effecting singleton, gated by phase)
    IF _state.phase == 'active'
        EnemyManager.executeTurn(_state.turnCounter, _state.placedUnits)

    -- 4. Semi-pure: render reads state, draws to canvas, returns rect patch
    rectPatch = _render(_state)

    -- 5. Pure: write render output back into state
    _state = applyRenderRects(_state, rectPatch)

    requestAnimationFrame(loop)
```

The loop has a clear shape: pure transitions surround the two unavoidable side effects (camera and enemy AI). `_render` is placed late so it reads the fully-updated state.

---

### Practical trace: player clicks Play button

This traces exactly what happens in the codebase from the moment the player clicks the Play button to the moment the placement phase starts rendering.

```
Frame N (briefing rendered):
  _render(state) calls HUD.renderBriefingScreen(ctx, { ... })
  renderBriefingScreen draws the Play button at (462, 390, w=100, h=24)
  _render returns { lastBriefingRects: { playButtonRect: {x:462,y:390,w:100,h:24}, ... } }
  applyRenderRects writes that into _state
  → _state.lastBriefingRects.playButtonRect = { x:462, y:390, w:100, h:24 }

Between frames:
  Player clicks at (505, 400)
  IsoInput fires onClick(505, 400)
  Game calls:
    _state = InputTransitions.applyClick(_state, 505, 400, { nowMs: 12450.3, ... })

Inside applyClick:
  state.phase === 'briefing'  → dispatch to _briefingClick
  _briefingClick reads state.lastBriefingRects.playButtonRect = { x:462, y:390, w:100, h:24 }
  _hitTest(505, 400, { x:462, y:390, w:100, h:24 }) → true
  calls PhaseTransitions.toPlacement(state, 12450.3)

Inside toPlacement:
  guard: state.phase === 'briefing'  ✓
  returns update(state, {
      phase:            'placement',
      placementStartMs: 12450.3,
      placementDone:    false,
  })
  → new frozen GameState with phase='placement'

Back in Game._state:
  _state is now the new frozen GameState
  _state.phase === 'placement'
  _state.placementStartMs === 12450.3

Frame N+1 (first placement frame):
  TickTransitions.tick(_state, { nowMs: 12466.7 })
    _checkPlacementTimer: elapsed = 16.4ms < 30000ms  → no transition
    _checkAllPlaced: unitDefs have qtyRemaining > 0   → no transition
    → state passes through unchanged
  _render(_state):
    state.phase === 'placement'
    elapsed = performance.now() - 12450.3 = 16.4ms
    secsLeft = Math.floor((30000 - 16.4) / 1000) = 29
    HUD.renderPlacementHUD(ctx, { secondsRemaining: 29, ... })
    → top bar shows "PLACE YOUR UNITS  |  ⏱ 0:29  |  [ ✓ Ready ]"
```

The state value itself never changed in place. The old `GameState` object from frame N still exists unchanged in memory until garbage collected — nothing overwrote it.

---

### Practical trace: placement timer expires

```
Frame M (tick runs):
  TickTransitions.tick(_state, { nowMs: 42450.3 })
    _checkPlacementTimer(_state, 42450.3):
      elapsed = 42450.3 - 12450.3 = 30000ms
      30000 >= PLACEMENT_DURATION_MS (30000)  → true
      calls PhaseTransitions.toActive(state)
        guard: state.phase === 'placement' AND !state.placementDone  ✓
        returns update(state, { phase: 'active', placementDone: true })

  _state = result from tick (phase='active')

Frame M render:
  state.phase === 'active'
  renderPlacementHUD is NOT called
  renderTopBar IS called with level info text
  EnemyManager.executeTurn(_state.turnCounter, _state.placedUnits)  ← enemies now running
```

If the player had also clicked Ready at the same millisecond:

```
  applyClick fires _placementClick:
    _hitTest passes for ReadyButton
    calls PhaseTransitions.toActive(state)
      BUT state.placementDone is already true (set by tick above)
      guard fails → returns state unchanged  ← the double-transition is a no-op
```

`placementDone` is the single flag that makes the transition idempotent, regardless of how many triggers arrive at once.

---

### Where state lives vs. where side effects live

This table shows exactly what is inside `GameState` and what remains outside it, and why.

| Concern | Inside GameState? | Why |
|---------|------------------|-----|
| Game phase | ✓ yes | Pure logic; transitions are testable in isolation |
| Unit definitions + quantities | ✓ yes | Pure accounting; `UnitManager` is load-only after `init` |
| Placed units | ✓ yes | Pure placement logic; array rebuilt on each change |
| Tile selection, hover | ✓ yes | Pure UI state; no DOM involvement |
| HUD open/width | ✓ yes | Pure animation values |
| Placement timer start time | ✓ yes | Stored as a number; elapsed computed on read |
| Last render rects | ✓ yes | Plain geometry values; written back each frame |
| Canvas / ctx | ✗ no | DOM object; cannot be frozen or diffed |
| IsoCamera (scroll, zoom) | ✗ no | Owns GL transform state; mutation is intentional |
| IsoInput (key state) | ✗ no | Reads hardware events; cannot be serialised |
| EnemyManager | ✗ no | Contains AI registries; migrating is future work |
| LevelLoader tiles | ✗ no | Static after load; passed as `deps`, not stored in state |

The boundary is: anything that is pure data lives in `GameState`. Anything that owns DOM/GL/hardware state stays outside and is treated as a side effect at the loop boundary.

---

## Concurrency Model and State Erasure Analysis

### JavaScript's execution model — why classic races don't exist here

The browser's JavaScript engine is **single-threaded with a cooperative event loop**. There is no preemptive multithreading. Every callback — `requestAnimationFrame`, `addEventListener`, `setTimeout`, `Promise` microtasks — queues into the same event loop and executes to completion before the next one starts. This means:

- The game loop (`rAF callback`) and an input handler (`onClick`) can never run *at the same time*.
- `EnemyManager.executeTurn` and a click handler can never interleave mid-execution.
- Two state transitions cannot race to write `_state` simultaneously.

Classic race conditions — where two threads read a stale snapshot and one's write overwrites the other's — **do not exist** in synchronous single-threaded JS. If you're familiar with concurrent programming, this is the equivalent of every operation holding a global lock for its entire duration.

### What the event loop schedule actually looks like

```
Macrotask queue (simplified):

  [rAF callback N]          ← entire loop() runs atomically to completion
    tick(_state)             reads _state, writes _state = S1
    camera side-effects      no _state reads/writes
    EnemyManager.executeTurn no _state reads/writes
    _render(_state)          reads _state@S1, returns rectPatch
    applyRenderRects(...)    writes _state = S2
  [rAF callback N ends]

  [onClick event]           ← fires between rAF callbacks, never inside one
    applyClick(_state)       reads _state@S2, writes _state = S3
  [onClick event ends]

  [rAF callback N+1]
    tick(_state)             reads _state@S3  ← sees the click's result
    ...
```

The critical property: **once `loop()` starts executing, no event handler can interrupt it**. The rAF callback runs from `tick` through `applyRenderRects` without any interleaving. The only writes to `_state` inside the loop are sequential assignments in a single synchronous call stack.

### The one real risk: async/await in init()

`async/await` is where the single-threaded guarantee breaks down. Every `await` is a yield point — the event loop can process other events between an `await` and its continuation. `init()` has several:

```js
async init() {
    // ...
    await SpriteManager.loadAtlas(...);     // ← yields; events CAN fire here
    await LevelLoader.loadLevelList();      // ← yields; events CAN fire here
    await UnitManager.loadResources();      // ← yields; events CAN fire here

    this._state = makeInitialState(...);    // ← _state written here
    this._state = PhaseTransitions.toBriefing(this._state);
    this.loop();
}
```

If any DOM event fired between the first `await` and the `makeInitialState` call, `this._state` would be `null` and any input handler that tried to call a transition on it would crash.

**Mitigation:** Input handlers must guard against a null state. The game loop must not start (`this.loop()`) until `_state` has been fully initialised. Both are already implied by the design — `loop()` is the last line of `init()`, and input callbacks should null-check `_state` before calling any transition.

```js
// Input handler pattern — guard against uninitialized state
onClick: (x, y) => {
    if (!this._state) return;   // ← init() hasn't finished yet; ignore
    this._state = InputTransitions.applyClick(this._state, x, y, deps);
},
```

This guard is cheap and eliminates the only real window for a null-state crash.

### The shallow-merge erasure pattern — why it's safe here but fragile by assumption

`applyRenderRects` uses `update(state, rectPatch)` — a shallow merge. If `rectPatch = { lastBriefingRects: rects }`, the merge produces a new object with all fields from `_state` plus the updated rect. No other field is touched.

This is safe because steps B (render) and C (applyRenderRects) are synchronous and back-to-back:

```js
const rectPatch = this._render(this._state);    // B — synchronous
this._state = applyRenderRects(this._state, rectPatch);  // C — synchronous
```

Between B and C, no event handler can fire. `this._state` at line C is identical to `this._state` at line B — no writes happened in between.

**The fragility:** if `_render` were ever made async (e.g., if a future canvas API required awaiting a draw call), events could fire between B and C. The merge at C would then overwrite a `_state` that had already been updated by a click handler, silently losing the click's result.

The design rule that prevents this is: **`_render` must remain synchronous**. It must never contain `await`. This is explicitly documented as an invariant — see Property 8 in the Correctness Properties section.

### Multiple input events within one inter-frame gap

When the player moves the mouse quickly or makes several rapid clicks, the browser may queue multiple events between two `rAF` callbacks. These process one at a time, each reading and writing `_state` in sequence:

```
[rAF callback N ends]    _state = S2

[onMouseMove fires]      _state = InputTransitions.applyMouseMove(S2, ...) = S3
[onMouseMove fires]      _state = InputTransitions.applyMouseMove(S3, ...) = S4
[onClick fires]          _state = InputTransitions.applyClick(S4, ...) = S5

[rAF callback N+1]       tick reads S5 — sees all three events applied in order
```

Each handler reads the output of the previous one. No event's result is lost because each writes `_state` before the next one reads it. This is exactly the behaviour you want: events are serialised, state accumulates correctly, and the next frame sees the fully-updated result of all intervening input.

### Summary: what is and isn't safe

| Scenario | Safe? | Reason |
|----------|-------|--------|
| `tick` and `onClick` running simultaneously | ✓ impossible | JS is single-threaded; rAF callback runs atomically |
| Multiple clicks queued between two frames | ✓ safe | Each handler reads the previous handler's output; state accumulates |
| `EnemyManager` and a click running concurrently | ✓ impossible | Both run on the same thread; enemy AI runs inside the rAF callback |
| Click during `init()` `await` before `_state` is set | ⚠ guarded | Null-check on `_state` in every input handler prevents crash |
| `_render` made async in the future | ⚠ would break | Events could fire between `_render` and `applyRenderRects`; shallow merge would overwrite click results |
| Web Workers | ✓ isolated | Workers have no shared memory with the main thread; no access to `_state` |
| `SharedArrayBuffer` + `Atomics` | N/A | Not used; no shared memory primitives in this codebase |

### What true concurrency would require (not needed here, for reference)

If this game ever needed genuine parallelism (e.g., pathfinding in a Web Worker), the correct pattern would be to treat Worker communication as an event — the Worker sends a message, the main thread receives it in the event loop, and a transition applies the result to `_state` at that point. The immutability of `GameState` makes this straightforward: you can pass a snapshot to a Worker as a structured-clone message without worrying that the main thread will mutate it while the Worker is reading it.

Since `GameState` is a frozen plain object containing only JSON-serialisable values, it is already Worker-safe by construction.
