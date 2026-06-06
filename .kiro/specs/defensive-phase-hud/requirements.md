# Requirements Document

## Introduction

The Defensive Phase HUD introduces the first meta-phase of the game: a structured defender experience that guides the player from an initial briefing through unit placement and into active combat. When the game loads, the player sees a full-screen briefing overlay explaining their role and available units. After dismissing the briefing, a 30-second unit placement sub-phase begins during which enemies are paused. Once the window closes — by timer expiry, full placement, or player readiness — normal gameplay resumes with enemies spawning and moving.

## Glossary

- **BriefingScreen**: The full-screen HUD overlay shown before play starts, containing the mission headline, a short description, an expandable Further Reading panel, and a Play button.
- **FurtherReadingPanel**: The expandable panel within the BriefingScreen that shows meta-goal details, per-unit strengths and weaknesses, and placement strategy hints. Default state is collapsed when the BriefingScreen first opens.
- **PlacementPhase**: The sub-phase after the BriefingScreen is dismissed, during which the player places units on the map and enemy activity is paused.
- **PlacementDuration**: The length of the PlacementPhase countdown. Currently hardcoded to 30 seconds (30 000 ms).
- **PlacementTimer**: The countdown timer (default 30 seconds, hardcoded) displayed in the HUD during the PlacementPhase.
- **ReadyButton**: The HUD button the player can click during the PlacementPhase to end placement early and start the ActivePhase.
- **ActivePhase**: Normal gameplay during which enemies spawn and execute turns, and the placement/briefing UI is hidden.
- **Game**: The `Game` singleton in `game-iso.js` that orchestrates state, update, and render.
- **HUD**: The `HUD` module in `hud.js` that renders all on-canvas UI panels.
- **UnitManager**: The `UnitManager` singleton in `unit-manager.js` that tracks unit definitions and placed units.
- **EnemyManager**: The `EnemyManager` singleton in `enemy-manager.js` whose `executeTurn()` and `spawnWave()` methods are paused during non-active phases.

---

## Visual Mockups

Canvas is 1024 × 768 px. The overlay covers the full canvas. All text uses
monospace. Borders use the existing gold-sheen gradient (`#c8b890` midpoint,
`#3a3028` edges). Backgrounds use `rgba(15, 12, 10, 0.92)` matching
`renderTilePanel`.

Legend:
```
╔══╗  gold-sheen border (existing HUD style)
║  ║  dark semi-transparent panel background
[ ]   clickable button
░░░   dimmed game map visible beneath overlay
```

---

### Mockup A — Briefing Screen (collapsed, default state)

_Shown immediately after loading completes. FurtherReadingPanel is hidden._

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░ game map (dimmed, not interactive) ░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░                                                           ░░░░░░░░░ │
│ ░░░░░   ╔══════════════════════════════════════════════════╗    ░░░░░░░░░ │
│ ░░░░░   ║                                                  ║    ░░░░░░░░░ │
│ ░░░░░   ║   ⚔  OBJECTIVE: DEFEND YOUR DYNASTY!  ⚔          ║    ░░░░░░░░░ │
│ ░░░░░   ║   ─────────────────────────────────────          ║    ░░░░░░░░░ │
│ ░░░░░   ║                                                  ║    ░░░░░░░░░ │
│ ░░░░░   ║   Enemy forces are massing beyond the tree line. ║    ░░░░░░░░░ │
│ ░░░░░   ║   They will march on your castle in waves.       ║    ░░░░░░░░░ │
│ ░░░░░   ║   Place your garrison and hold the walls.        ║    ░░░░░░░░░ │
│ ░░░░░   ║                                                  ║    ░░░░░░░░░ │
│ ░░░░░   ║   [ More ▼ ]                                     ║    ░░░░░░░░░ │
│ ░░░░░   ║                                                  ║    ░░░░░░░░░ │
│ ░░░░░   ║                       [ ▶  PLAY ]                ║    ░░░░░░░░░ │
│ ░░░░░   ║                                                  ║    ░░░░░░░░░ │
│ ░░░░░   ╚══════════════════════════════════════════════════╝    ░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└────────────────────────────────────────────────────────────────────────────┘

  ⚔  headline: ~22px monospace, gold (#c8b890)
  ─  thin gold divider line
  body text: 11px monospace, #aaa
  [ More ▼ ] button: small, #8a7a60 border, #bbb text — left-aligned
  [ ▶  PLAY ] button: larger, gold border (#c8b890), #eee text — centred
```

---

### Mockup B — Briefing Screen (FurtherReadingPanel expanded)

_After clicking "More ▼". Panel grows downward; Play button stays at bottom._

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░   ╔══════════════════════════════════════════════════╗    ░░░░░░░░░ │
│ ░░░░░   ║                                                  ║    ░░░░░░░░░ │
│ ░░░░░   ║   ⚔  OBJECTIVE: DEFEND YOUR DYNASTY!  ⚔          ║    ░░░░░░░░░ │
│ ░░░░░   ║   ─────────────────────────────────────          ║    ░░░░░░░░░ │
│ ░░░░░   ║   Enemy forces are massing beyond the tree line. ║    ░░░░░░░░░ │
│ ░░░░░   ║   Place your garrison and hold the walls.        ║    ░░░░░░░░░ │
│ ░░░░░   ║                                                  ║    ░░░░░░░░░ │
│ ░░░░░   ║   [ More ▲ ]   ← collapses on click             ║    ░░░░░░░░░ │
│ ░░░░░   ║   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   ║    ░░░░░░░░░ │
│ ░░░░░   ║   PHASE I — THE DEFENDER                         ║    ░░░░░░░░░ │
│ ░░░░░   ║   Hold off all enemy waves to win.               ║    ░░░░░░░░░ │
│ ░░░░░   ║                                                  ║    ░░░░░░░░░ │
│ ░░░░░   ║   YOUR UNITS                                     ║    ░░░░░░░░░ │
│ ░░░░░   ║   ► Archers/Crossbowmen  — ranged, forest        ║    ░░░░░░░░░ │
│ ░░░░░   ║     ambush; needs melee cover                    ║    ░░░░░░░░░ │
│ ░░░░░   ║   ► Spearmen/Heavy Inf.  — sturdy chokepoint     ║    ░░░░░░░░░ │
│ ░░░░░   ║     holders, moderate speed                      ║    ░░░░░░░░░ │
│ ░░░░░   ║   ► Men-at-arms          — armoured sorties,     ║    ░░░░░░░░░ │
│ ░░░░░   ║     breach plugging; slow                        ║    ░░░░░░░░░ │
│ ░░░░░   ║   ► Engineers/Militia    — support; operate      ║    ░░░░░░░░░ │
│ ░░░░░   ║     siege equipment                              ║    ░░░░░░░░░ │
│ ░░░░░   ║                                                  ║    ░░░░░░░░░ │
│ ░░░░░   ║   SYNERGIES                                      ║    ░░░░░░░░░ │
│ ░░░░░   ║   ► Archers need a melee shield — place          ║    ░░░░░░░░░ │
│ ░░░░░   ║     Spearmen or Men-at-arms one tile ahead       ║    ░░░░░░░░░ │
│ ░░░░░   ║     of any forested archer position              ║    ░░░░░░░░░ │
│ ░░░░░   ║   ► Engineers are fragile — keep a melee         ║    ░░░░░░░░░ │
│ ░░░░░   ║     unit nearby to stop them being overrun       ║    ░░░░░░░░░ │
│ ░░░░░   ║   ► Spearmen hold the front; Men-at-arms plug    ║    ░░░░░░░░░ │
│ ░░░░░   ║     breaches once enemies get through            ║    ░░░░░░░░░ │
│ ░░░░░   ║                                                  ║    ░░░░░░░░░ │
│ ░░░░░   ║   TIPS                                           ║    ░░░░░░░░░ │
│ ░░░░░   ║   • Ranged units prefer forests & high ground    ║    ░░░░░░░░░ │
│ ░░░░░   ║   • Melee units anchor gates & chokepoints       ║    ░░░░░░░░░ │
│ ░░░░░   ║   • Mix unit types — avoid single-type lines     ║    ░░░░░░░░░ │
│ ░░░░░   ║   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   ║    ░░░░░░░░░ │
│ ░░░░░   ║                       [ ▶  PLAY ]               ║    ░░░░░░░░░ │
│ ░░░░░   ╚══════════════════════════════════════════════════╝    ░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└────────────────────────────────────────────────────────────────────────────┘

  PHASE I header: 10px monospace, #c8b890 (gold)
  Section headers (YOUR UNITS, SYNERGIES, TIPS): 9px monospace, #8a7a60 (dim gold)
  Body text: 10px monospace, #aaa
  ┄ dotted dividers: rgba(200,184,144,0.3)
  [ ▶  PLAY ] always pinned to bottom of panel; never obscured
  Max panel height = canvasH - 80px (leaves ≥40px breathing room top & bottom)

  SYNERGIES section explains the explicit pairing relationships:
    Archers  ←protected by→  Spearmen / Men-at-arms  (melee shield, 1 tile ahead)
    Engineers ←protected by→  any melee unit          (prevent overrun)
    Spearmen  ←backed up by→  Men-at-arms             (plug breaches once line breaks)
```

---

### Mockup C — Placement Phase HUD

_BriefingScreen gone. Game map is fully interactive. Timer and Ready shown in
the top bar area._

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ██ PLACE YOUR UNITS  │  ⏱ 0:24  │  [ ✓ Ready ]                            │  ← top bar
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                                                                            │
│                  game map — fully interactive                              │
│                  (click tiles to place/remove units)                       │
│                                                                            │
│                                                                            │
│                                                                            │
│                                                                            │
│                                                                            │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│          ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                          │
│          │Archer│  │Spear │  │M-a-A │  │Engin.│   ← unit selection bar   │
│          │ 3/3  │  │ 2/2  │  │ 1/1  │  │ 1/1  │     (existing, unchanged) │
│          └──────┘  └──────┘  └──────┘  └──────┘                          │
└────────────────────────────────────────────────────────────────────────────┘

  Top bar (height 20px, rgba(0,0,0,0.5) — same as renderTopBar):
    "PLACE YOUR UNITS" label: 11px monospace, #fff, left-aligned at x=8
    "⏱ 0:24" timer:          11px monospace, #fff, centred
    "[ ✓ Ready ]" button:    11px monospace, gold border (#8a7a60), right-aligned
      — turns gold (#c8b890) when ≤10 s remain (urgency indicator)

  Timer display format:  M:SS  (e.g. "0:30", "0:09")
    — counts down each second
    — flashes or turns #f88 (red-tinted) when ≤5 s remain

  Unit bar: unchanged from existing renderUnitBar()
  Tile panel: available as normal when a tile is selected
```

---

### Mockup D — Active Phase (reference, no new UI)

_All briefing/placement chrome removed. Normal gameplay._

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Level 1 │ WASD scroll │ +/- zoom │ SPACE rotate │ top 70%                 │  ← existing top bar
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                  game map — normal interactive play                        │
│                  (enemies spawn and move each turn)                        │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│          ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                          │
│          │Archer│  │Spear │  │M-a-A │  │Engin.│   ← existing unit bar    │
│          │ 0/3  │  │ 0/2  │  │ 0/1  │  │ 0/1  │                          │
│          └──────┘  └──────┘  └──────┘  └──────┘                          │
└────────────────────────────────────────────────────────────────────────────┘

  No BriefingScreen, no PlacementTimer, no ReadyButton.
  Existing top bar text restored to level info + controls.
```

---

## Requirements

### Requirement 1: Briefing Screen Display

**User Story:** As a player, I want to see a mission briefing when the game loads, so that I understand my objective before play begins.

#### Acceptance Criteria

1. WHEN the game finishes loading and transitions out of the `'loading'` state, THE BriefingScreen SHALL be rendered as a full-canvas overlay before any game turn is processed.
2. THE BriefingScreen SHALL display the headline text "Objective: Defend your dynasty!" in a visually prominent style consistent with the existing HUD aesthetic (dark background, gold-toned border).
3. THE BriefingScreen SHALL display a short descriptive blurb explaining that enemies spawn and march on the castle and the player must hold them off.
4. THE BriefingScreen SHALL display a "More" button that, when clicked, toggles the FurtherReadingPanel between its expanded and collapsed states.
5. THE BriefingScreen SHALL display a "Play" button at all times, regardless of whether the FurtherReadingPanel is collapsed or expanded.
6. WHEN the player clicks the "Play" button while the Game is in the `'briefing'` state, THE BriefingScreen SHALL be dismissed and the Game SHALL transition to the `'placement'` state.
7. WHILE the Game is in the `'loading'` state or the `'briefing'` state, THE Game SHALL NOT call `EnemyManager.executeTurn()` or `EnemyManager.spawnWave()`.
8. WHILE the BriefingScreen is visible (Game in `'briefing'` state), THE Game SHALL NOT process tile-click or unit-placement interactions on the game map.

---

### Requirement 2: Further Reading Panel

**User Story:** As a player, I want to read more about the game's defensive meta-goal and my available units, so that I can make informed placement decisions.

#### Acceptance Criteria

1. THE FurtherReadingPanel SHALL be collapsed by default when the BriefingScreen first opens.
2. WHEN the "More" button is clicked while the FurtherReadingPanel is collapsed, THE FurtherReadingPanel SHALL expand within the BriefingScreen without navigating away from the overlay.
3. WHEN the "More" button is clicked while the FurtherReadingPanel is expanded, THE FurtherReadingPanel SHALL collapse back to the default briefing view.
4. THE FurtherReadingPanel SHALL describe the meta-goal of Phase 1: the player defends their dynasty's castle against waves of attackers and wins by holding off all enemy waves.
5. THE FurtherReadingPanel SHALL list the four available player unit types — Archers/Crossbowmen, Spearmen/Heavy Infantry, Men-at-arms, and Engineers/Militia — each with a description of no more than 40 words covering individual strengths and weaknesses:
   - Archers/Crossbowmen: high ranged damage, can ambush from inside forests, but lower armour and need protection in melee.
   - Spearmen/Heavy Infantry: sturdy frontline units effective at holding chokepoints, moderate speed.
   - Men-at-arms: heavily armoured melee fighters suited for sorties and plugging breaches, lower mobility.
   - Engineers/Militia: low combat strength but support the garrison; Engineers operate siege equipment.
6. THE FurtherReadingPanel SHALL include placement strategy hints stating that ranged units benefit from elevated or forested tiles, that melee units should anchor chokepoints near gates and walls, and that a mixed front line with ranged support is recommended over deploying a single unit type.
7. THE FurtherReadingPanel SHALL include a unit synergies section that explicitly states the following pairing relationships:
   - Spearmen/Heavy Infantry and Men-at-arms protect Archers/Crossbowmen in melee; the player should place one or more of these melee units one tile ahead of any Archer position.
   - Engineers/Militia are fragile in direct combat and require a melee unit stationed nearby to prevent them being overrun.
   - Spearmen/Heavy Infantry form the primary front line; Men-at-arms serve as a second-line reserve to plug breaches once the front line is pressed.
8. WHILE the FurtherReadingPanel is expanded, THE "Play" button SHALL be fully within the canvas viewport and not obscured by the FurtherReadingPanel content on any canvas with height ≥ 768 pixels.

---

### Requirement 3: Placement Phase Activation

**User Story:** As a player, I want a dedicated window to place my units after reading the briefing, so that I can prepare my defence before enemies arrive.

#### Acceptance Criteria

1. WHEN the Game transitions to the `'placement'` state, THE BriefingScreen overlay SHALL be hidden entirely and SHALL NOT be rendered again during the current game session.
2. WHEN the `'placement'` state is entered, THE PlacementTimer SHALL start counting down from the PlacementDuration (30 seconds).
3. WHILE the Game is in the `'placement'` state, THE HUD SHALL display the PlacementTimer as a visible countdown (seconds remaining) using the same monospace font and colour palette as the existing HUD top bar.
4. WHILE the Game is in the `'placement'` state, THE HUD SHALL display the ReadyButton labelled "Ready", which the player can click to end placement early.
5. WHILE the Game is in the `'placement'` state, THE Game SHALL allow the player to place and remove units on the map using the existing unit-bar and tile-click interactions.
6. WHILE the Game is in the `'placement'` state, THE Game SHALL NOT call `EnemyManager.executeTurn()` or `EnemyManager.spawnWave()`.

---

### Requirement 4: Placement Phase Completion Conditions

**User Story:** As a player, I want the placement phase to end automatically when I'm done or the timer runs out, so that gameplay transitions smoothly without requiring explicit action in all cases.

#### Acceptance Criteria

1. WHEN the PlacementTimer reaches zero (computed remaining time ≤ 0 ms), THE Game SHALL transition from the `'placement'` state to the `'active'` state within one rendered frame.
2. WHEN all units available in `UnitManager` have been placed on the map (every `unit.qtyRemaining` equals zero), THE Game SHALL transition from the `'placement'` state to the `'active'` state.
3. WHEN the player clicks the ReadyButton and the `'placement'`→`'active'` transition has not yet been initiated, THE Game SHALL transition from the `'placement'` state to the `'active'` state.
4. THE `'placement'`→`'active'` transition SHALL occur exactly once; after it has been initiated, any subsequent trigger (timer expiry, full-placement detection, or ReadyButton click) SHALL be ignored.
5. IF the `'placement'` state ends before any units have been placed, THEN THE Game SHALL still transition to the `'active'` state and begin normal gameplay with zero friendly units on the map.

---

### Requirement 5: Active Phase Behaviour

**User Story:** As a player, I want normal gameplay to resume after the placement window closes, so that the game proceeds without further interruption from the briefing or placement UI.

#### Acceptance Criteria

1. WHEN the Game transitions to the `'active'` state, THE HUD SHALL stop rendering the BriefingScreen overlay, the PlacementTimer, and the ReadyButton.
2. WHEN the Game transitions to the `'active'` state, THE Game SHALL begin calling `EnemyManager.spawnWave()` and `EnemyManager.executeTurn()` on their normal per-frame schedule.
3. WHILE the Game is in the `'active'` state, THE BriefingScreen overlay SHALL NOT be rendered.
4. WHILE the Game is in the `'active'` state, THE PlacementTimer SHALL NOT be rendered and SHALL NOT decrement.
5. WHILE the Game is in the `'active'` state, THE Game SHALL process all tile-click, unit-selection, and unit-movement interactions as it did before the briefing and placement phases were introduced.

---

### Requirement 6: Game State Model

**User Story:** As a developer, I want the game's phase transitions to be tracked through an explicit state machine, so that each phase's behaviour is predictable and testable.

#### Acceptance Criteria

1. THE Game SHALL initialise the phase state variable to `'loading'` on construction, before `Game.init()` is called.
2. THE Game SHALL maintain the phase state variable with exactly four valid values: `'loading'`, `'briefing'`, `'placement'`, and `'active'`.
3. IF `Game.init()` fails to complete asset loading, THE Game SHALL remain in the `'loading'` state and SHALL NOT start the render loop or advance to `'briefing'`.
4. WHEN `Game.init()` completes asset loading successfully, THE Game SHALL set the phase state to `'briefing'` before beginning the render loop.
5. WHEN the "Play" button is clicked while the Game is in the `'briefing'` state, THE Game SHALL set the phase state to `'placement'`; IF the Game is in any state other than `'briefing'`, THE Game SHALL treat the click as a no-op.
6. WHEN any placement completion condition is satisfied (timer expiry, all units placed, or ReadyButton click), THE Game SHALL set the phase state from `'placement'` to `'active'`.
7. THE phase state SHALL only advance in the sequence `'loading'` → `'briefing'` → `'placement'` → `'active'`; no backward transitions or state-skipping are permitted.
8. IF the Game is in any phase state other than `'active'`, THEN THE Game SHALL NOT call `EnemyManager.executeTurn()` or `EnemyManager.spawnWave()`.

---

### Requirement 7: HUD Rendering Integration

**User Story:** As a developer, I want the briefing and placement UI elements to be rendered through the existing HUD module, so that the visual style is consistent and the implementation stays cohesive.

#### Acceptance Criteria

1. THE HUD SHALL expose a `renderBriefingScreen(ctx, state)` function that draws the BriefingScreen overlay onto the provided canvas context.
2. THE HUD SHALL expose a `renderPlacementHUD(ctx, state)` function that draws the PlacementTimer countdown and the ReadyButton onto the provided canvas context.
3. WHEN `renderBriefingScreen` is called with `state.furtherReadingOpen` set to `true`, THE HUD SHALL render the FurtherReadingPanel content in addition to the base briefing content.
4. THE HUD SHALL render the BriefingScreen overlay with the same dark semi-transparent background and border style used by existing HUD panels (as produced by the current `renderTilePanel` and top-bar helpers).
5. THE HUD SHALL render the PlacementTimer using the same monospace font and colour palette as the existing top bar.
6. `renderBriefingScreen` SHALL return an object containing the bounding rectangles of the Play button and the More button; IF a bounding rectangle cannot be computed (e.g. canvas dimensions are zero), THE function SHALL return `null` for that element's rectangle property.
7. `renderPlacementHUD` SHALL return an object containing the bounding rectangle of the ReadyButton; IF the ReadyButton bounding rectangle cannot be computed, THE function SHALL return `null` for that property.
8. THE Game SHALL handle a `null` bounding rectangle from either render function gracefully by skipping hit-testing for the corresponding element in `Game.handleClick`.

---

### Requirement 8: PlacementTimer Accuracy

**User Story:** As a player, I want the countdown timer to reflect real elapsed time accurately, so that I can rely on the displayed value when planning my placement.

#### Acceptance Criteria

1. THE PlacementTimer SHALL decrement based on elapsed wall-clock time using `Date.now()` or `performance.now()`, not by frame count.
2. WHEN the `'placement'` state is entered, THE Game SHALL record a start timestamp and SHALL compute remaining time each frame as `PlacementDuration - (now - startTimestamp)`.
3. THE PlacementTimer SHALL display the remaining time in whole seconds, rounding down (e.g. 29 seconds when 29.8 seconds remain).
4. WHEN the computed remaining time is less than or equal to 0 milliseconds, THE Game SHALL transition to the `'active'` state within one rendered frame regardless of how large the elapsed interval is.
5. ON each rendered frame during the `'placement'` state, THE HUD SHALL update the displayed PlacementTimer value to match the currently computed remaining time, ensuring the display stays synchronised with wall-clock elapsed time.
