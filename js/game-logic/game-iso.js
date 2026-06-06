/**
 * Isometric Game — main orchestrator.
 * Delegates to lib/ modules for camera, input, rendering, and HUD.
 *
 * ─── Concurrency model ───────────────────────────────────────────────────────
 * JavaScript is single-threaded. The browser event loop runs one callback at a
 * time to completion before the next starts. This means:
 *
 *   • The rAF game loop (loop/update/render) runs atomically — no DOM event
 *     handler can interrupt it mid-execution.
 *   • EnemyManager.executeTurn() and an onClick handler can never interleave.
 *   • Multiple clicks queued between two frames execute serially; each handler
 *     reads the output of the previous one, so all updates accumulate correctly.
 *
 * Classic multi-thread race conditions therefore do not exist here.
 *
 * Two narrower risks DO exist and are mitigated below — see the inline comments
 * on init() and render() / _render() for details, and the full analysis in:
 *   .kiro/specs/defensive-phase-hud/design.md
 *   § "Concurrency Model and State Erasure Analysis"
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── GameState — the state monad type ────────────────────────────────────────

/**
 * GameState — the complete, immutable snapshot of game logic state for one frame.
 *
 * Never mutated in place. All transitions return a new frozen object via `update`.
 *
 * @typedef {Readonly<{
 *   // ── Phase machine ──────────────────────────────────────────────────
 *   phase:               'loading' | 'briefing' | 'placement' | 'active',
 *   placementStartMs:    number | null,   // performance.now() at placement entry
 *   placementDone:       boolean,         // true once → 'active' has fired
 *   briefingOpen:        boolean,         // FurtherReadingPanel expanded
 *
 *   // ── Units ──────────────────────────────────────────────────────────
 *   unitDefs:            ReadonlyArray<Object>,    // definitions + per-type qty tracking
 *   placedUnits:         ReadonlyArray<Object>,    // units on the map
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
 *   lastBriefingRects:   { playButtonRect: Object|null, moreButtonRect: Object|null } | null,
 *   lastPlacementRects:  { readyButtonRect: Object|null } | null,
 * }>} GameState
 */

/**
 * Returns the initial frozen GameState.
 * All fields explicitly set — no implicit undefined.
 *
 * @param {Object[]} unitDefs  — loaded from UnitManager.parseCSV(), passed in at init time
 * @returns {GameState}
 */
function makeInitialState(unitDefs) {
    return Object.freeze({
        phase:              'loading',
        placementStartMs:   null,
        placementDone:      false,
        briefingOpen:       false,

        unitDefs:           Object.freeze((unitDefs || []).map(d => Object.freeze({ ...d }))),
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

/** Placement phase duration in milliseconds (30 seconds). */
const PLACEMENT_DURATION_MS = 30_000;

/**
 * AABB hit-test — returns true if (x, y) is inside rect.
 *
 * @param {number} x
 * @param {number} y
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @returns {boolean}
 */
function _hitTest(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w &&
           y >= rect.y && y <= rect.y + rect.h;
}

/**
 * Tile placement allowlist — mirrors UnitManager.canPlaceOn without the singleton.
 * Blocked tile prefixes: tree-, water-, castle-wall, castle-keep-, castle-gatehouse, rock.
 *
 * @param {string} sprite  — tile sprite name
 * @returns {boolean}  true if a unit may be placed on this tile
 */
function _canPlaceOn(sprite) {
    const blocked = ['tree-', 'water-', 'castle-wall', 'castle-keep-', 'castle-gatehouse', 'rock'];
    return !blocked.some(prefix => sprite.startsWith(prefix));
}

/**
 * Unit-bar hit-test — mirrors HUD.getUnitBarClick without the singleton dependency.
 * Returns the index of the clicked unit bar slot, or -1 if no slot was hit.
 *
 * @param {number}   mouseX
 * @param {number}   mouseY
 * @param {Object[]} unitDefs  — array of unit definitions from GameState
 * @param {number}   canvasW
 * @param {number}   canvasH
 * @returns {number}  slot index, or -1
 */
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

// ─── Phase transitions ────────────────────────────────────────────────────────

/**
 * Pure phase-transition functions — each is a `GameState → GameState` mapping.
 * All guards are explicit: if the guard is not met the input state is returned
 * unchanged (no-op / idempotent).
 */
const PhaseTransitions = {
    /**
     * loading → briefing.
     * Called by Game.init() after all assets are loaded.
     * Guard: phase must be 'loading'.
     *
     * @param {GameState} state
     * @returns {GameState}
     */
    toBriefing(state) {
        if (state.phase !== 'loading') return state;
        return update(state, { phase: 'briefing', briefingOpen: false });
    },

    /**
     * briefing → placement.
     * Called when the Play button is clicked.
     * Guard: phase must be 'briefing'.
     *
     * @param {GameState} state
     * @param {number}    nowMs   — performance.now() at click time
     * @returns {GameState}
     */
    toPlacement(state, nowMs) {
        if (state.phase !== 'briefing') return state;
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
     *
     * @param {GameState} state
     * @returns {GameState}
     */
    toActive(state) {
        if (state.phase !== 'placement' || state.placementDone) return state;
        return update(state, { phase: 'active', placementDone: true });
    },

    /**
     * Toggle the FurtherReadingPanel within the briefing screen.
     * Guard: phase must be 'briefing'.
     *
     * @param {GameState} state
     * @returns {GameState}
     */
    toggleFurtherReading(state) {
        if (state.phase !== 'briefing') return state;
        return update(state, { briefingOpen: !state.briefingOpen });
    },
};

// ─── Tick transitions ─────────────────────────────────────────────────────────

/**
 * Per-frame pure state transitions — applied every game loop iteration.
 * Each sub-transition receives the output of the previous one (pipeline).
 *
 * Camera scroll and zoom are side-effects on IsoCamera; they remain
 * imperative in Game.loop() and are NOT part of TickTransitions.
 */
const TickTransitions = {
    /**
     * Apply all per-frame logic: lift animation, HUD width animation,
     * placement timer check, all-placed check, and turn counter advance.
     *
     * @param {GameState}            state
     * @param {{ nowMs: number }}    deps   — external read-only values (clock)
     * @returns {GameState}
     */
    tick(state, deps) {
        return [
            s => TickTransitions._animateLift(s),
            s => TickTransitions._animateHud(s),
            s => TickTransitions._checkPlacementTimer(s, deps.nowMs),
            s => TickTransitions._checkAllPlaced(s),
            s => TickTransitions._advanceTurnCounter(s),
        ].reduce((s, fn) => fn(s), state);
    },

    /**
     * Animate selectedLift toward selectedLiftTarget at a fixed speed per frame.
     *
     * @param {GameState} state
     * @returns {GameState}
     */
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

    /**
     * Animate hudWidth toward hudTargetWidth at a fixed speed per frame.
     *
     * @param {GameState} state
     * @returns {GameState}
     */
    _animateHud(state) {
        const speed = 12;
        const w = state.hudWidth;
        const t = state.hudTargetWidth;
        if (w === t) return state;
        const next = w < t ? Math.min(t, w + speed) : Math.max(t, w - speed);
        return update(state, { hudWidth: next });
    },

    /**
     * Check whether the placement timer has expired; if so, transition to active.
     * Guard: phase must be 'placement' and placementDone must be false.
     *
     * @param {GameState} state
     * @param {number}    nowMs  — current timestamp (performance.now())
     * @returns {GameState}
     */
    _checkPlacementTimer(state, nowMs) {
        if (state.phase !== 'placement' || state.placementDone) return state;
        const elapsed = nowMs - state.placementStartMs;
        if (elapsed >= PLACEMENT_DURATION_MS) {
            return PhaseTransitions.toActive(state);
        }
        return state;
    },

    /**
     * Check whether all units have been placed; if so, transition to active.
     * Guard: phase must be 'placement', placementDone must be false,
     *        and unitDefs must be non-empty with all qtyRemaining <= 0.
     *
     * @param {GameState} state
     * @returns {GameState}
     */
    _checkAllPlaced(state) {
        if (state.phase !== 'placement' || state.placementDone) return state;
        const allPlaced = state.unitDefs.length > 0 &&
            state.unitDefs.every(u => u.qtyRemaining <= 0);
        if (allPlaced) return PhaseTransitions.toActive(state);
        return state;
    },

    /**
     * Increment the turn counter each frame while in the active phase.
     * Guard: phase must be 'active'.
     *
     * @param {GameState} state
     * @returns {GameState}
     */
    _advanceTurnCounter(state) {
        if (state.phase !== 'active') return state;
        return update(state, { turnCounter: state.turnCounter + 1 });
    },
};

// ─── Input transitions ────────────────────────────────────────────────────────

/**
 * Pure input-event transitions — each maps `(GameState, x, y, deps) → GameState`.
 * Click and mouse-move handlers never mutate state directly; they return a new
 * frozen GameState produced via `update`.
 */
const InputTransitions = {
    /**
     * Apply a left-click at (mouseX, mouseY) to the current state.
     * Dispatches based on phase, then applies the appropriate sub-transition.
     *
     * @param {GameState}  state
     * @param {number}     mouseX
     * @param {number}     mouseY
     * @param {{ level, canvasW: number, canvasH: number, nowMs: number }} deps
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

    /**
     * Handle a click while in the briefing phase.
     * Checks Play button and More button rects from the last rendered frame.
     *
     * @param {GameState} state
     * @param {number}    x
     * @param {number}    y
     * @param {number}    nowMs
     * @returns {GameState}
     */
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

    /**
     * Handle a click while in the placement phase.
     * Checks Ready button first, then falls through to shared tile/unit interaction.
     *
     * @param {GameState} state
     * @param {number}    x
     * @param {number}    y
     * @param {{ level, canvasW: number, canvasH: number, nowMs: number }} deps
     * @returns {GameState}
     */
    _placementClick(state, x, y, deps) {
        // 1. Ready button
        const rects = state.lastPlacementRects;
        if (rects && rects.readyButtonRect && _hitTest(x, y, rects.readyButtonRect)) {
            return PhaseTransitions.toActive(state);
        }
        // 2. Fall through to shared tile/unit click logic
        return InputTransitions._tileInteractionClick(state, x, y, deps);
    },

    /**
     * Handle a click while in the active phase.
     * Delegates entirely to shared tile/unit click logic.
     *
     * @param {GameState} state
     * @param {number}    x
     * @param {number}    y
     * @param {{ level, canvasW: number, canvasH: number }} deps
     * @returns {GameState}
     */
    _activeClick(state, x, y, deps) {
        return InputTransitions._tileInteractionClick(state, x, y, deps);
    },

    /**
     * Shared tile-click logic used by both placement and active phases.
     * Handles: unit-bar toggle, tile-panel close button, unit placement, tile selection.
     *
     * @param {GameState} state
     * @param {number}    mouseX
     * @param {number}    mouseY
     * @param {{ level, canvasW: number, canvasH: number }} deps
     * @returns {GameState}
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
     * Handles toggle (remove if same type already placed at tile) and place-new.
     * No side effects, no UnitManager mutation.
     *
     * @param {GameState}                  state
     * @param {{ row: number, col: number }} clicked
     * @param {Object}                     level
     * @returns {GameState}
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
            placedUnits:     newPlaced,
            unitDefs:        Object.freeze(newDefs),
            selectedUnitIdx: newIdx,
        });
    },

    /**
     * Apply a right-click: remove the top-most unit at the clicked tile
     * and return its quantity to the pool.
     *
     * @param {GameState} state
     * @param {number}    mouseX
     * @param {number}    mouseY
     * @param {{ level }} deps
     * @returns {GameState}
     */
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

    /**
     * Apply a mouse-move event: update hoveredTile.
     * Value-compares the new tile against the current one to avoid allocating
     * a new state object if the hovered tile hasn't changed.
     *
     * @param {GameState} state
     * @param {number}    x
     * @param {number}    y
     * @param {{ level }} deps
     * @returns {GameState}
     */
    applyMouseMove(state, x, y, deps) {
        const { level } = deps;
        const tile = IsoCamera.screenToGrid(x, y, level.width, level.height);
        // Value compare: avoid allocating if same tile coords
        if (state.hoveredTile && tile &&
            tile.row === state.hoveredTile.row &&
            tile.col === state.hoveredTile.col) return state;
        if (!state.hoveredTile && !tile) return state;
        return update(state, { hoveredTile: tile });
    },

    /**
     * Apply a mouse-leave event: clear hoveredTile.
     * No-op if hoveredTile is already null.
     *
     * @param {GameState} state
     * @returns {GameState}
     */
    applyMouseLeave(state) {
        if (state.hoveredTile === null) return state;
        return update(state, { hoveredTile: null });
    },
};

// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

const Game = {
    canvas: null,
    ctx: null,
    _state: null,

    async init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 1024;
        this.canvas.height = 768;

        // Init camera
        IsoCamera.init(this.canvas, { tileW: 64, tileH: 32, zoom: 0.7 });

        // ── RISK: async gap — input handlers registered before _state is ready ──
        // IsoInput is wired here, before any await, so the DOM event listeners are
        // live from this point on. Every await below is a yield point where the
        // browser can process queued events (clicks, mouse moves) before _state has
        // been initialised. If a handler fires during that window it will read
        // this._state as null and crash.
        //
        // MITIGATION: every input callback below must null-check this._state before
        // calling any transition. Handlers that fire before _state is set are silently
        // dropped — the player hasn't seen the game yet, so no input is meaningful.
        //
        // See: .kiro/specs/defensive-phase-hud/design.md
        //      § "The one real risk: async/await in init()"
        IsoInput.init(this.canvas, {
            onMouseMove: (x, y) => {
                if (!this._state) return;
                const level = LevelLoader.getCurrentLevel();
                this._state = InputTransitions.applyMouseMove(this._state, x, y, { level });
            },
            onClick: (x, y) => {
                if (!this._state) return;
                const level = LevelLoader.getCurrentLevel();
                this._state = InputTransitions.applyClick(
                    this._state, x, y,
                    { level, canvasW: this.canvas.width, canvasH: this.canvas.height, nowMs: performance.now() }
                );
            },
            onRightClick: (x, y) => {
                if (!this._state) return;
                const level = LevelLoader.getCurrentLevel();
                this._state = InputTransitions.applyRightClick(this._state, x, y, { level });
            },
            onViewpointToggle: () => {
                IsoCamera.toggleViewpoint();
                this.centerOnFlag();
            },
            onZoom: (dir) => {
                // Zoom is disabled during loading and briefing — map is non-interactive.
                if (!this._state) return;
                if (this._state.phase === 'placement' || this._state.phase === 'active') {
                    IsoCamera.applyZoom(dir * IsoCamera.zoomSpeed * 2);
                }
            },
            onMouseLeave: () => {
                if (!this._state) return;
                this._state = InputTransitions.applyMouseLeave(this._state);
            },
        });

        // ── PixiJS initialisation (Req 5.5, 6.4) ────────────────────────────
        // Each await below is a yield point. Input events queued by the browser
        // during these awaits will be processed when control returns to the event
        // loop — but the null-guards above ensure they are dropped safely.
        //
        // Step 1: Initialise PixiJS with the existing canvas element.
        const pixiRenderer = await PixiRenderer.initPixiRenderer(this.canvas);

        // Step 2: Wire the PixiJS renderer into SpriteManager so draw() delegates
        //         to PixiJS when the atlas is loaded (Req 5.4).
        SpriteManager.usePixiRenderer(pixiRenderer);

        // Step 3: Load the sprite atlas (Req 6.6). Falls back to individual PNGs
        //         automatically if the atlas or JSON fails to load (Req 5.1, 6.7).
        await SpriteManager.loadAtlas(
            'assets/sprites/atlas-0.png',
            'assets/sprites/atlas.json'
        );

        // Step 4: Register animated sprite types with AnimationController (Req 5.3).
        // water-anim: 4 frames at 500 ms/frame (matches atlas.json animations section).
        AnimationController.registerAnimatedType('water-anim', 4, 500);
        // flag: 3 frames at 600 ms/frame (ANIMATION_CONFIG from design doc).
        AnimationController.registerAnimatedType('flag', 3, 600);

        // Step 5: Visual integration test — draw a damaged castle sprite on startup
        //         to confirm damaged sprites load and display correctly (Req 9.7).
        this._renderDamagedCastleIntegrationTest();

        // Load remaining assets
        await LevelLoader.loadLevelList();
        await UnitManager.loadResources();

        const level = LevelLoader.getCurrentLevel();
        if (!level || level.tiles.length === 0) { console.error('No level data!'); return; }

        // Build initial state from loaded unit definitions
        this._state = makeInitialState(UnitManager.units);

        // Set up the level (camera, enemy AI, etc.)
        this._setupLevel();

        // Transition: loading → briefing
        this._state = PhaseTransitions.toBriefing(this._state);

        this.loop();
    },

    _setupLevel() {
        // Reset enemy state for level restart before loading new level data.
        try {
            EnemyManager.reset();
        } catch (e) {
            console.warn('[Game] EnemyManager.reset() failed:', e);
        }

        const level = LevelLoader.getCurrentLevel();
        IsoCamera.setMapSize(level.width, level.height);
        IsoCamera.elevation = level.elevation || {};
        this.centerOnFlag();

        // Initialise enemy AI after level data is ready.
        try {
            EnemyManager.init();
        } catch (e) {
            console.warn('[Game] EnemyManager.init() failed:', e);
        }
    },

    centerOnFlag() {
        const level = LevelLoader.getCurrentLevel();
        const flag = level.tiles.find(t => t.sprite === 'castle-keep-center');
        if (flag) IsoCamera.centerOn(flag.row, flag.col);
    },

    /**
     * Visual integration test: draws a damaged castle sprite at a fixed position
     * on startup to confirm the damaged sprites load and display correctly from
     * the atlas without rendering errors (Req 9.7).
     *
     * The sprite is drawn in the top-left corner of the canvas and will be
     * overwritten by the first game render frame.
     */
    _renderDamagedCastleIntegrationTest() {
        try {
            // Draw castle-wall-damaged as the integration test sprite.
            // Position it at (8, 8) — visible but out of the way.
            SpriteManager.draw(this.ctx, 'castle-wall-damaged', 8, 8, 64, 32);
            console.log('[Game] Visual integration test: castle-wall-damaged rendered successfully');
        } catch (err) {
            console.error('[Game] Visual integration test failed for castle-wall-damaged:', err);
        }
    },

    loop() {
        if (!this._state) { requestAnimationFrame(() => this.loop()); return; }

        // 1. Tick: pure state transitions
        this._state = TickTransitions.tick(this._state, { nowMs: performance.now() });

        // 2. Side-effecting camera update — only during interactive phases
        // Camera scroll and zoom are disabled in 'loading' and 'briefing' phases;
        // the map is non-interactive until the player clicks Play.
        if (this._state.phase === 'placement' || this._state.phase === 'active') {
            const { dx, dy } = IsoInput.getScrollDir();
            if (dx || dy) IsoCamera.scroll(dx, dy);
            if (IsoInput.keys.zoomIn)  IsoCamera.applyZoom(IsoCamera.zoomSpeed);
            if (IsoInput.keys.zoomOut) IsoCamera.applyZoom(-IsoCamera.zoomSpeed);
        }

        // 3. Enemy phase — gated by phase
        if (this._state.phase === 'active') {
            try {
                EnemyManager.executeTurn(this._state.turnCounter, this._state.placedUnits);
            } catch (e) {
                console.warn('[Game] EnemyManager.executeTurn() failed:', e);
            }
        }

        // 4. Render — reads state, emits canvas draw calls, returns rect patch
        const rectPatch = this._render(this._state);

        // 5. Write render output back into state
        if (rectPatch) this._state = applyRenderRects(this._state, rectPatch);

        requestAnimationFrame(() => this.loop());
    },

    /**
     * Read-only render pass — draws the current frame to canvas and returns a
     * rect patch for click-target geometry.
     *
     * ── INVARIANT: _render() must remain fully synchronous ────────────────────
     * _render() reads game state and returns bounding rects produced by HUD
     * functions. loop() immediately applies those rects back to state via
     * applyRenderRects(). Both steps execute back-to-back in the same synchronous
     * call stack, so no event handler can fire between them and no state write can
     * be lost.
     *
     * If _render() were ever made async (e.g. by adding an await inside it or
     * inside any HUD render function it calls), that guarantee breaks: a click
     * could fire between the render call and the rect write-back, and the
     * shallow-merge would silently overwrite the click's state changes with a
     * stale snapshot.
     *
     * DO NOT add await to this function or to any function it calls
     * synchronously. If a genuinely async canvas operation is needed in future,
     * the rect write-back must be moved to happen BEFORE the await, not after.
     *
     * See: .kiro/specs/defensive-phase-hud/design.md
     *      § "The shallow-merge erasure pattern — why it's safe here but fragile by assumption"
     *      § "Property 8: Render idempotence"
     *
     * @param {GameState} state
     * @returns {{ lastBriefingRects?: Object, lastPlacementRects?: Object }}
     */
    _render(state) {
        const ctx = this.ctx;
        const canvasW = this.canvas.width;
        const canvasH = this.canvas.height;

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
                unitDefs: state.unitDefs,
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
    }
};

window.addEventListener('load', () => Game.init());
