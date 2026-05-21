# Game Logic Library Modules

Reusable modules extracted from the isometric game engine. Each module is self-contained and can be used in other similar games.

## Files

| Module | Purpose |
|--------|---------|
| `iso-camera.js` | Camera system: scroll, zoom, viewpoint rotation, iso projection math |
| `iso-input.js` | Input handling: keyboard, mouse, wheel events with callbacks |
| `iso-renderer.js` | Tile and unit rendering with hover/select effects |
| `hud.js` | All HUD panels: top bar, unit bar, detail panel, tile info |

## iso-camera.js — IsoCamera

Manages the isometric camera state and coordinate transformations.

**Key methods:**
- `init(canvas, config)` — set up with canvas and tile dimensions
- `setMapSize(w, h)` — calculate map offset from grid dimensions
- `centerOn(row, col)` — center camera on a grid position
- `gridToScreen(row, col)` — convert grid → screen pixels
- `screenToGrid(screenX, screenY, levelW, levelH)` — convert screen → grid
- `scroll(dx, dy)` — apply scroll movement
- `applyZoom(delta)` — adjust zoom level
- `applyTransform(ctx)` — apply zoom to canvas context
- `toggleViewpoint()` — flip between BR→TL and BL→TR

## iso-input.js — IsoInput

Decoupled input system. Tracks key state and fires callbacks.

**Callbacks:**
- `onMouseMove(x, y)` — mouse moved over canvas
- `onClick(x, y)` — left click
- `onRightClick(x, y)` — right click
- `onZoom(direction)` — mouse wheel (+1 or -1)
- `onViewpointToggle()` — spacebar pressed
- `onMouseLeave()` — mouse left canvas

**State:**
- `keys` — { up, down, left, right, zoomIn, zoomOut } booleans
- `getScrollDir()` — returns { dx, dy } from held keys

## iso-renderer.js — IsoRenderer

Draws terrain and units with visual effects.

**Methods:**
- `drawTerrain(ctx, camera, tiles, state)` — draw all tiles with hover/select
- `drawUnits(ctx, camera, units)` — draw placed units on top of terrain
- `drawDiamondOutline(ctx, x, y, w, h, color, lineWidth)` — utility

## hud.js — HUD

All UI panels rendered on top of the game world.

**Methods:**
- `renderTopBar(ctx, canvasW, text)` — level info bar
- `renderUnitBar(ctx, state)` — bottom unit selection bar
- `renderUnitDetail(ctx, unit, canvasW, barY)` — stats panel
- `renderTilePanel(ctx, state)` — tile info slide-in
- `getUnitBarClick(mouseX, mouseY, units, canvasW, canvasH)` — hit test
- `drawSheenBorder(ctx, x, y, w, h, highlight)` — metallic gradient border

## Usage in a New Game

These modules are generic enough to reuse:

```js
// 1. Include the scripts
// 2. Initialize
IsoCamera.init(canvas, { tileW: 64, tileH: 32, zoom: 0.7 });
IsoInput.init(canvas, {
    onMouseMove: (x, y) => { /* hover logic */ },
    onClick: (x, y) => { /* click logic */ },
    onViewpointToggle: () => IsoCamera.toggleViewpoint(),
    onZoom: (dir) => IsoCamera.applyZoom(dir * 0.1),
});

// 3. In your game loop
function render() {
    ctx.save();
    IsoCamera.applyTransform(ctx);
    IsoRenderer.drawTerrain(ctx, IsoCamera, myTiles, myState);
    IsoRenderer.drawUnits(ctx, IsoCamera, myUnits);
    ctx.restore();
    HUD.renderTopBar(ctx, canvas.width, 'My Game');
}
```

Replace `SpriteManager`, `LevelLoader`, and `UnitManager` with your own equivalents.
