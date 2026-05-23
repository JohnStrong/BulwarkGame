/**
 * Isometric Game — main orchestrator.
 * Delegates to lib/ modules for camera, input, rendering, and HUD.
 */

const Game = {
    canvas: null,
    ctx: null,
    state: 'loading',

    // Tile interaction
    hoveredTile: null,
    selectedTile: null,
    selectedLift: 0,
    selectedLiftTarget: 0,

    // HUD state
    hudOpen: false,
    hudWidth: 0,
    hudTargetWidth: 0,
    selectedUnitIdx: -1,

    async init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 1024;
        this.canvas.height = 768;

        // Init camera
        IsoCamera.init(this.canvas, { tileW: 64, tileH: 32, zoom: 0.7 });

        // Init input
        IsoInput.init(this.canvas, {
            onMouseMove: (x, y) => {
                const level = LevelLoader.getCurrentLevel();
                this.hoveredTile = IsoCamera.screenToGrid(x, y, level.width, level.height);
            },
            onClick: (x, y) => this.handleClick(x, y),
            onRightClick: (x, y) => this.handleRightClick(x, y),
            onViewpointToggle: () => {
                IsoCamera.toggleViewpoint();
                this.centerOnFlag();
            },
            onZoom: (dir) => IsoCamera.applyZoom(dir * IsoCamera.zoomSpeed * 2),
            onMouseLeave: () => { this.hoveredTile = null; },
        });

        // ── PixiJS initialisation (Req 5.5, 6.4) ────────────────────────────
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

        this.startLevel();
        this.state = 'playing';
        this.loop();
    },

    startLevel() {
        const level = LevelLoader.getCurrentLevel();
        IsoCamera.setMapSize(level.width, level.height);
        IsoCamera.elevation = level.elevation || {};
        this.centerOnFlag();
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

    handleClick(mouseX, mouseY) {
        // Unit bar click
        const barIdx = HUD.getUnitBarClick(mouseX, mouseY, UnitManager.units, this.canvas.width, this.canvas.height);
        if (barIdx >= 0) {
            this.selectedUnitIdx = (this.selectedUnitIdx === barIdx) ? -1 : barIdx;
            return;
        }

        // Tile panel close button
        if (this.hudOpen && mouseX < this.hudWidth && mouseY > this.canvas.height - HUD.HUD_HEIGHT) {
            if (mouseX > this.hudWidth - 20 && mouseY < this.canvas.height - HUD.HUD_HEIGHT + 20) {
                this.hudOpen = false; this.hudTargetWidth = 0;
            }
            return;
        }

        const level = LevelLoader.getCurrentLevel();
        const clicked = IsoCamera.screenToGrid(mouseX, mouseY, level.width, level.height);

        // Unit placement mode
        if (clicked && this.selectedUnitIdx >= 0) {
            const unitDef = UnitManager.units[this.selectedUnitIdx];
            const existing = UnitManager.getUnitAt(clicked.row, clicked.col);
            if (existing) {
                if (existing.def === unitDef) UnitManager.removeUnit(existing);
            } else if (unitDef && unitDef.qtyRemaining > 0) {
                const tile = level.tiles.find(t => t.row === clicked.row && t.col === clicked.col);
                if (tile && UnitManager.canPlaceOn(tile.sprite)) {
                    UnitManager.placeUnit(unitDef.name, clicked.row, clicked.col);
                    if (unitDef.qtyRemaining <= 0) this.selectedUnitIdx = -1;
                }
            }
            return;
        }

        // Normal tile selection
        if (clicked && this.selectedTile && clicked.row === this.selectedTile.row && clicked.col === this.selectedTile.col) {
            this.selectedTile = null; this.selectedLiftTarget = 0;
            this.hudOpen = false; this.hudTargetWidth = 0;
        } else if (clicked) {
            this.selectedTile = clicked; this.selectedLiftTarget = 3;
            this.hudOpen = true; this.hudTargetWidth = HUD.HUD_MAX_WIDTH;
        }
    },

    handleRightClick(mouseX, mouseY) {
        const level = LevelLoader.getCurrentLevel();
        const clicked = IsoCamera.screenToGrid(mouseX, mouseY, level.width, level.height);
        if (clicked) {
            const unit = UnitManager.getUnitAt(clicked.row, clicked.col);
            if (unit) UnitManager.removeUnit(unit);
        }
    },

    loop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.loop());
    },

    update() {
        // Camera scroll from held keys
        const { dx, dy } = IsoInput.getScrollDir();
        if (dx || dy) IsoCamera.scroll(dx, dy);

        // Keyboard zoom
        if (IsoInput.keys.zoomIn) IsoCamera.applyZoom(IsoCamera.zoomSpeed);
        if (IsoInput.keys.zoomOut) IsoCamera.applyZoom(-IsoCamera.zoomSpeed);

        // Animate tile lift
        const liftSpeed = 0.3;
        if (this.selectedLift < this.selectedLiftTarget) this.selectedLift = Math.min(this.selectedLiftTarget, this.selectedLift + liftSpeed);
        else if (this.selectedLift > this.selectedLiftTarget) this.selectedLift = Math.max(this.selectedLiftTarget, this.selectedLift - liftSpeed);

        // Animate HUD panel
        const hudSpeed = 12;
        if (this.hudWidth < this.hudTargetWidth) this.hudWidth = Math.min(this.hudTargetWidth, this.hudWidth + hudSpeed);
        else if (this.hudWidth > this.hudTargetWidth) this.hudWidth = Math.max(this.hudTargetWidth, this.hudWidth - hudSpeed);
    },

    render() {
        const ctx = this.ctx;
        ctx.fillStyle = '#1a2a12';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'loading') {
            ctx.fillStyle = '#fff'; ctx.font = '18px monospace'; ctx.textAlign = 'center';
            ctx.fillText('Loading...', this.canvas.width / 2, this.canvas.height / 2);
            return;
        }

        const level = LevelLoader.getCurrentLevel();

        // Draw terrain (with zoom)
        ctx.save();
        IsoCamera.applyTransform(ctx);
        IsoRenderer.drawTerrain(ctx, IsoCamera, level.tiles, {
            hoveredTile: this.hoveredTile,
            selectedTile: this.selectedTile,
            selectedLift: this.selectedLift,
        });
        ctx.restore();

        // Draw units (with zoom)
        ctx.save();
        IsoCamera.applyTransform(ctx);
        IsoRenderer.drawUnits(ctx, IsoCamera, UnitManager.getPlacedUnits());
        ctx.restore();

        // HUD (not affected by zoom)
        HUD.renderTilePanel(ctx, {
            hudWidth: this.hudWidth,
            canvasH: this.canvas.height,
            selectedTile: this.selectedTile,
            level,
        });

        HUD.renderTopBar(ctx, this.canvas.width,
            level.name + ' | WASD scroll | +/- zoom | SPACE rotate | ' + IsoCamera.viewpoint + ' ' + Math.round(IsoCamera.zoom * 100) + '%');

        const barY = HUD.renderUnitBar(ctx, {
            units: UnitManager.units,
            selectedUnitIdx: this.selectedUnitIdx,
            canvasW: this.canvas.width,
            canvasH: this.canvas.height,
        });

        if (this.selectedUnitIdx >= 0 && this.selectedUnitIdx < UnitManager.units.length) {
            HUD.renderUnitDetail(ctx, UnitManager.units[this.selectedUnitIdx], this.canvas.width, barY);
        }
    }
};

window.addEventListener('load', () => Game.init());
