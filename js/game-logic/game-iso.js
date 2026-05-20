/**
 * Isometric (2.5D) game renderer
 *
 * Uses the same level text files and sprites but renders them in
 * isometric projection (diamond tiles, perceived depth).
 *
 * Isometric math:
 *   screenX = (col - row) * TILE_HALF_W + offsetX
 *   screenY = (col + row) * TILE_HALF_H + offsetY
 *
 * Tiles are drawn back-to-front (painter's algorithm) so closer
 * tiles overlap farther ones, creating depth.
 */

const Game = {
    canvas: null,
    ctx: null,
    state: 'loading',

    // Isometric tile dimensions (2x scale for larger tiles)
    ISO_TILE_W: 64,
    ISO_TILE_H: 32,

    // Camera (scroll position and zoom)
    camX: 0,
    camY: 0,
    scrollSpeed: 8,
    zoom: 1.0,
    zoomMin: 0.3,
    zoomMax: 4.0,
    zoomSpeed: 0.05,

    // Viewpoint orientation: 'br-tl' (default) or 'bl-tr' (inverted)
    viewpoint: 'br-tl',

    // Tile interaction state
    hoveredTile: null,    // { row, col } of tile under mouse
    selectedTile: null,   // { row, col } of clicked tile
    selectedLift: 0,      // current lift amount (animates 0 → 3)
    selectedLiftTarget: 0,

    // HUD panel state
    hudOpen: false,
    hudWidth: 0,          // current animated width
    hudTargetWidth: 0,    // target width (0 = closed, 256 = open)
    HUD_MAX_WIDTH: 256,   // 1/4 of 1024 canvas
    HUD_HEIGHT: 180,

    // Unit bar state (bottom center HUD)
    selectedUnitIdx: -1,  // index into UnitManager.units[] (-1 = none)
    UNIT_BOX_SIZE: 56,    // each unit box size
    UNIT_BOX_PAD: 6,      // padding between boxes

    // Input state
    keys: { up: false, down: false, left: false, right: false, zoomIn: false, zoomOut: false },

    async init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Fixed viewport size
        this.canvas.width = 1024;
        this.canvas.height = 768;

        this.setupInput();

        await SpriteManager.loadAll();
        console.log('Sprites loaded:', Object.keys(SpriteManager.images).length);

        await LevelLoader.loadLevelList();
        const level = LevelLoader.getCurrentLevel();
        console.log('Level loaded:', level ? level.name : 'NONE', 'tiles:', level ? level.tiles.length : 0);

        // Load unit resources
        await UnitManager.loadResources();

        if (!level || level.tiles.length === 0) {
            console.error('No level data!');
            return;
        }

        this.startLevel();
        this.state = 'playing';
        this.loop();
    },

    setupInput() {
        window.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowUp': case 'w': case 'W': this.keys.up = true; break;
                case 'ArrowDown': case 's': case 'S': this.keys.down = true; break;
                case 'ArrowLeft': case 'a': case 'A': this.keys.left = true; break;
                case 'ArrowRight': case 'd': case 'D': this.keys.right = true; break;
                case '+': case '=': this.keys.zoomIn = true; break;
                case '-': case '_': this.keys.zoomOut = true; break;
            }
        });
        window.addEventListener('keyup', (e) => {
            switch (e.key) {
                case 'ArrowUp': case 'w': case 'W': this.keys.up = false; break;
                case 'ArrowDown': case 's': case 'S': this.keys.down = false; break;
                case 'ArrowLeft': case 'a': case 'A': this.keys.left = false; break;
                case 'ArrowRight': case 'd': case 'D': this.keys.right = false; break;
                case '+': case '=': this.keys.zoomIn = false; break;
                case '-': case '_': this.keys.zoomOut = false; break;
            }
        });
        // Mouse wheel zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -this.zoomSpeed * 2 : this.zoomSpeed * 2;
            this.zoom = Math.max(this.zoomMin, Math.min(this.zoomMax, this.zoom + delta));
        }, { passive: false });

        // Spacebar: toggle viewpoint orientation and re-center on keep flag
        window.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                this.viewpoint = (this.viewpoint === 'br-tl') ? 'bl-tr' : 'br-tl';
                this.centerOnFlag();
                console.log('Viewpoint:', this.viewpoint);
            }
        });

        // Mouse: hover detection
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            this.hoveredTile = this.screenToGrid(mouseX, mouseY);
        });

        // Mouse: click to select
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Check unit bar click (bottom center)
            const units = UnitManager.getAvailableUnits();
            if (units.length > 0) {
                const totalBarW = units.length * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD) - this.UNIT_BOX_PAD;
                const barStartX = (this.canvas.width - totalBarW) / 2;
                const barY = this.canvas.height - this.UNIT_BOX_SIZE - 28;
                if (mouseY >= barY && mouseY <= barY + this.UNIT_BOX_SIZE + 20) {
                    for (let i = 0; i < units.length; i++) {
                        const bx = barStartX + i * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD);
                        if (mouseX >= bx && mouseX <= bx + this.UNIT_BOX_SIZE) {
                            this.selectedUnitIdx = (this.selectedUnitIdx === i) ? -1 : i;
                            return;
                        }
                    }
                }
            }

            // Check if clicking the HUD close button
            if (this.hudOpen && mouseX < this.hudWidth && mouseY > this.canvas.height - this.HUD_HEIGHT) {
                // Check X button area (top-right of HUD panel)
                if (mouseX > this.hudWidth - 20 && mouseY < this.canvas.height - this.HUD_HEIGHT + 20) {
                    this.hudOpen = false;
                    this.hudTargetWidth = 0;
                    return;
                }
                return; // click inside HUD, don't select tile
            }

            const clicked = this.screenToGrid(mouseX, mouseY);
            if (clicked && this.selectedTile &&
                clicked.row === this.selectedTile.row && clicked.col === this.selectedTile.col) {
                this.selectedTile = null;
                this.selectedLiftTarget = 0;
                this.hudOpen = false;
                this.hudTargetWidth = 0;
            } else if (clicked) {
                this.selectedTile = clicked;
                this.selectedLiftTarget = 3;
                this.hudOpen = true;
                this.hudTargetWidth = this.HUD_MAX_WIDTH;
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredTile = null;
        });
    },

    /**
     * Center camera on the keep flag tile (F) using current viewpoint projection
     */
    centerOnFlag() {
        const level = LevelLoader.getCurrentLevel();
        const flagTile = level.tiles.find(t => t.sprite === 'castle-keep-center');
        if (!flagTile) return;

        const halfW = this.ISO_TILE_W / 2;
        const halfH = this.ISO_TILE_H / 2;

        let worldX;
        if (this.viewpoint === 'bl-tr') {
            worldX = (flagTile.row - flagTile.col) * halfW + this.mapOffsetX;
        } else {
            worldX = (flagTile.col - flagTile.row) * halfW + this.mapOffsetX;
        }
        const worldY = (flagTile.col + flagTile.row) * halfH + this.mapOffsetY;

        this.camX = worldX - this.canvas.width / 2;
        this.camY = worldY - this.canvas.height / 2;
    },

    /**
     * Convert screen coordinates to grid (row, col) — inverse isometric projection
     */
    screenToGrid(screenX, screenY) {
        // Undo zoom transform (zoom is from center of canvas)
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const worldX = (screenX - cx) / this.zoom + cx + this.camX - this.mapOffsetX;
        const worldY = (screenY - cy) / this.zoom + cy + this.camY - this.mapOffsetY;

        const halfW = this.ISO_TILE_W / 2;
        const halfH = this.ISO_TILE_H / 2;

        let col, row;
        if (this.viewpoint === 'bl-tr') {
            // Inverse of: x = (row-col)*halfW, y = (col+row)*halfH
            row = Math.round((worldX / halfW + worldY / halfH) / 2);
            col = Math.round((worldY / halfH - worldX / halfW) / 2);
        } else {
            // Inverse of: x = (col-row)*halfW, y = (col+row)*halfH
            col = Math.round((worldX / halfW + worldY / halfH) / 2);
            row = Math.round((worldY / halfH - worldX / halfW) / 2);
        }

        const level = LevelLoader.getCurrentLevel();
        if (row >= 0 && row < level.height && col >= 0 && col < level.width) {
            return { row, col };
        }
        return null;
    },

    startLevel() {
        const level = LevelLoader.getCurrentLevel();
        const halfW = this.ISO_TILE_W / 2;
        const halfH = this.ISO_TILE_H / 2;

        // Map origin offset (where row=0, col=0 renders before camera)
        this.mapOffsetX = level.height * halfW + halfW;
        this.mapOffsetY = halfH * 2;

        // Load elevation data
        this.elevation = level.elevation || {};

        // Find the keep flag tile (F) and center camera on it
        const flagTile = level.tiles.find(t => t.sprite === 'castle-keep-center');
        if (flagTile) {
            const worldX = (flagTile.col - flagTile.row) * halfW + this.mapOffsetX;
            const worldY = (flagTile.col + flagTile.row) * halfH + this.mapOffsetY;
            this.camX = worldX - this.canvas.width / 2;
            this.camY = worldY - this.canvas.height / 2;
        } else {
            const mapCenterX = (level.width / 2) * halfW;
            const mapCenterY = (level.width / 2 + level.height / 2) * halfH;
            this.camX = mapCenterX - this.canvas.width / 2;
            this.camY = mapCenterY - this.canvas.height / 2;
        }

        this.zoom = 0.7;
        console.log(`ISO: ${level.width}x${level.height}, elevation entries: ${Object.keys(this.elevation).length}`);
    },

    /**
     * Convert grid (row, col) to screen position.
     * Supports two viewpoints toggled by spacebar:
     *   br-tl: default — (col-row) for X
     *   bl-tr: inverted — (row-col) for X (mirrors the map)
     */
    gridToIso(row, col) {
        let x;
        if (this.viewpoint === 'bl-tr') {
            x = (row - col) * (this.ISO_TILE_W / 2) + this.mapOffsetX - this.camX;
        } else {
            x = (col - row) * (this.ISO_TILE_W / 2) + this.mapOffsetX - this.camX;
        }
        const y = (col + row) * (this.ISO_TILE_H / 2) + this.mapOffsetY - this.camY;
        const elevOffset = this.elevation[col] || 0;
        return { x, y: y + elevOffset };
    },

    loop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.loop());
    },

    update() {
        // Scroll camera with WASD / arrow keys (speed adjusts with zoom)
        const speed = this.scrollSpeed / this.zoom;
        if (this.keys.up) this.camY -= speed;
        if (this.keys.down) this.camY += speed;
        if (this.keys.left) this.camX -= speed;
        if (this.keys.right) this.camX += speed;

        // Zoom with +/- keys
        if (this.keys.zoomIn) this.zoom = Math.min(this.zoomMax, this.zoom + this.zoomSpeed);
        if (this.keys.zoomOut) this.zoom = Math.max(this.zoomMin, this.zoom - this.zoomSpeed);

        // Smooth lift animation for selected tile
        const liftSpeed = 0.3;
        if (this.selectedLift < this.selectedLiftTarget) {
            this.selectedLift = Math.min(this.selectedLiftTarget, this.selectedLift + liftSpeed);
        } else if (this.selectedLift > this.selectedLiftTarget) {
            this.selectedLift = Math.max(this.selectedLiftTarget, this.selectedLift - liftSpeed);
        }

        // Smooth HUD panel animation
        const hudSpeed = 12;
        if (this.hudWidth < this.hudTargetWidth) {
            this.hudWidth = Math.min(this.hudTargetWidth, this.hudWidth + hudSpeed);
        } else if (this.hudWidth > this.hudTargetWidth) {
            this.hudWidth = Math.max(this.hudTargetWidth, this.hudWidth - hudSpeed);
        }
    },

    render() {
        const ctx = this.ctx;

        // Clear with dark background
        ctx.fillStyle = '#1a2a12';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'loading') {
            ctx.fillStyle = '#fff';
            ctx.font = '18px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', this.canvas.width / 2, this.canvas.height / 2);
            return;
        }

        const level = LevelLoader.getCurrentLevel();

        // Apply zoom (scale from center of canvas)
        ctx.save();
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);

        // Draw tiles back-to-front (painter's algorithm)
        for (const tile of level.tiles) {
            if (tile.covered) continue;
            let { x, y } = this.gridToIso(tile.row, tile.col);

            // Apply lift if this tile is selected (smooth animated offset)
            const isSelected = this.selectedTile &&
                tile.row === this.selectedTile.row && tile.col === this.selectedTile.col;
            if (isSelected) {
                y -= this.selectedLift;
            }

            // Draw sprite
            SpriteManager.draw(ctx, tile.sprite, x - this.ISO_TILE_W/2, y - this.ISO_TILE_H/2, this.ISO_TILE_W, this.ISO_TILE_H);

            // Hover highlight: draw accented diamond border
            const isHovered = this.hoveredTile &&
                tile.row === this.hoveredTile.row && tile.col === this.hoveredTile.col;
            if (isHovered && !isSelected) {
                ctx.strokeStyle = 'rgba(255, 220, 80, 0.6)'; // warm gold accent
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x, y - this.ISO_TILE_H/2);
                ctx.lineTo(x + this.ISO_TILE_W/2, y);
                ctx.lineTo(x, y + this.ISO_TILE_H/2);
                ctx.lineTo(x - this.ISO_TILE_W/2, y);
                ctx.closePath();
                ctx.stroke();
            }

            // Selected: brighter border + glow
            if (isSelected) {
                ctx.strokeStyle = 'rgba(255, 255, 120, 0.9)'; // bright yellow
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, y - this.ISO_TILE_H/2);
                ctx.lineTo(x + this.ISO_TILE_W/2, y);
                ctx.lineTo(x, y + this.ISO_TILE_H/2);
                ctx.lineTo(x - this.ISO_TILE_W/2, y);
                ctx.closePath();
                ctx.stroke();
                // Subtle glow
                ctx.strokeStyle = 'rgba(255, 255, 180, 0.3)';
                ctx.lineWidth = 4;
                ctx.stroke();
            }
        }

        ctx.restore(); // end zoom transform

        // === Render placed units (on top of terrain, affected by zoom) ===
        ctx.save();
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
        for (const unit of UnitManager.getPlacedUnits()) {
            const { x, y } = this.gridToIso(unit.row, unit.col);
            SpriteManager.draw(ctx, unit.sprite, x - this.ISO_TILE_W/2, y - this.ISO_TILE_H/2 - 4, this.ISO_TILE_W, this.ISO_TILE_H);
        }
        ctx.restore();

        // === BOTTOM-LEFT HUD PANEL ===
        if (this.hudWidth > 0) {
            const hudX = 0;
            const hudY = this.canvas.height - this.HUD_HEIGHT;
            const w = this.hudWidth;
            const h = this.HUD_HEIGHT;

            // Panel background (dark with slight transparency)
            ctx.fillStyle = 'rgba(15, 12, 10, 0.92)';
            ctx.fillRect(hudX, hudY, w, h);

            // Top border — metallic/sword sheen gradient
            const grad = ctx.createLinearGradient(hudX, hudY, hudX + w, hudY);
            grad.addColorStop(0, '#3a3028');
            grad.addColorStop(0.3, '#8a7a60');
            grad.addColorStop(0.5, '#c8b890');  // bright sheen
            grad.addColorStop(0.7, '#8a7a60');
            grad.addColorStop(1, '#3a3028');
            ctx.fillStyle = grad;
            ctx.fillRect(hudX, hudY, w, 3);

            // Right edge border
            const gradR = ctx.createLinearGradient(hudX + w - 3, hudY, hudX + w - 3, hudY + h);
            gradR.addColorStop(0, '#8a7a60');
            gradR.addColorStop(0.5, '#c8b890');
            gradR.addColorStop(1, '#3a3028');
            ctx.fillStyle = gradR;
            ctx.fillRect(hudX + w - 3, hudY, 3, h);

            // Close button (X) — top-right corner of panel
            ctx.fillStyle = '#666';
            ctx.font = '14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✕', hudX + w - 12, hudY + 12);

            // Panel content (tile info placeholder)
            if (this.selectedTile && w > 100) {
                ctx.fillStyle = '#aaa';
                ctx.font = '11px monospace';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(`Tile [${this.selectedTile.row}, ${this.selectedTile.col}]`, hudX + 10, hudY + 16);

                // Find the tile sprite name
                const level = LevelLoader.getCurrentLevel();
                const t = level.tiles.find(t => t.row === this.selectedTile.row && t.col === this.selectedTile.col);
                if (t) {
                    ctx.fillStyle = '#ccc';
                    ctx.fillText(t.sprite, hudX + 10, hudY + 32);
                }
            }
        }

        // HUD
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, this.canvas.width, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(level.name + ' | WASD scroll | +/- zoom | SPACE rotate | ' + this.viewpoint + ' ' + Math.round(this.zoom * 100) + '%', 8, 14);

        // === BOTTOM CENTER UNIT BAR ===
        const availUnits = UnitManager.units;
        if (availUnits.length > 0) {
            const totalBarW = availUnits.length * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD) - this.UNIT_BOX_PAD;
            const barStartX = (this.canvas.width - totalBarW) / 2;
            const barY = this.canvas.height - this.UNIT_BOX_SIZE - 28;

            for (let i = 0; i < availUnits.length; i++) {
                const u = availUnits[i];
                const bx = barStartX + i * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD);
                const by = barY;
                const isSelected = (this.selectedUnitIdx === i);

                // Box background
                ctx.fillStyle = isSelected ? 'rgba(40, 35, 25, 0.95)' : 'rgba(20, 18, 15, 0.85)';
                ctx.fillRect(bx, by, this.UNIT_BOX_SIZE, this.UNIT_BOX_SIZE + 20);

                // Sword sheen border
                const grad = ctx.createLinearGradient(bx, by, bx + this.UNIT_BOX_SIZE, by);
                grad.addColorStop(0, '#3a3028');
                grad.addColorStop(0.5, isSelected ? '#e8c870' : '#8a7a60');
                grad.addColorStop(1, '#3a3028');
                ctx.strokeStyle = grad;
                ctx.lineWidth = isSelected ? 2 : 1;
                ctx.strokeRect(bx, by, this.UNIT_BOX_SIZE, this.UNIT_BOX_SIZE + 20);

                // Unit sprite (scaled into box)
                const sprite = u.sprites[0];
                SpriteManager.draw(ctx, sprite, bx + 4, by + 2, this.UNIT_BOX_SIZE - 8, (this.UNIT_BOX_SIZE - 8) / 2);

                // Unit name (above quantity)
                ctx.fillStyle = '#bbb';
                ctx.font = '7px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(u.name.split('/')[0].split('(')[0].trim().substring(0, 8), bx + this.UNIT_BOX_SIZE / 2, by + this.UNIT_BOX_SIZE - 4);

                // Quantity remaining
                ctx.fillStyle = u.qtyRemaining > 0 ? '#8f8' : '#f66';
                ctx.font = 'bold 10px monospace';
                ctx.fillText(u.qtyRemaining + '/' + u.qty, bx + this.UNIT_BOX_SIZE / 2, by + this.UNIT_BOX_SIZE + 10);
            }

            // === UNIT DETAIL PANEL (below bar, when unit selected) ===
            if (this.selectedUnitIdx >= 0 && this.selectedUnitIdx < availUnits.length) {
                const u = availUnits[this.selectedUnitIdx];
                const panelW = 280, panelH = 100;
                const panelX = (this.canvas.width - panelW) / 2;
                const panelY = barY - panelH - 8;

                // Panel bg
                ctx.fillStyle = 'rgba(15, 12, 10, 0.92)';
                ctx.fillRect(panelX, panelY, panelW, panelH);

                // Border
                const pGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
                pGrad.addColorStop(0, '#3a3028');
                pGrad.addColorStop(0.5, '#c8b890');
                pGrad.addColorStop(1, '#3a3028');
                ctx.strokeStyle = pGrad;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(panelX, panelY, panelW, panelH);

                // Sprite (left side, larger)
                SpriteManager.draw(ctx, u.sprites[0], panelX + 8, panelY + 10, 64, 32);

                // Stats (right side)
                ctx.fillStyle = '#ddd';
                ctx.font = '10px monospace';
                ctx.textAlign = 'left';
                const sx = panelX + 80;
                ctx.fillText(u.name, sx, panelY + 18);
                ctx.fillStyle = '#aaa';
                ctx.fillText(`HP: ${u.health}  ATK: ${u.attack}  Armour: ${Math.round((1 - u.defense) * 100)}%`, sx, panelY + 34);
                ctx.fillText(`Available: ${u.qtyRemaining} / ${u.qty}`, sx, panelY + 50);

                // Action buttons (centered, smaller)
                const actions = [['Q', 'Attack'], ['V', 'Defend']];
                const actionsW = actions.length * 28 + (actions.length - 1) * 10;
                const actStartX = panelX + (panelW - actionsW) / 2;
                const actY = panelY + 65;

                for (let a = 0; a < actions.length; a++) {
                    const ax = actStartX + a * 38;
                    ctx.fillStyle = 'rgba(60, 55, 45, 0.9)';
                    ctx.fillRect(ax, actY, 24, 16);
                    ctx.strokeStyle = '#8a7a60';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(ax, actY, 24, 16);
                    ctx.fillStyle = '#eee';
                    ctx.font = 'bold 9px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(actions[a][0], ax + 12, actY + 8);
                }
                ctx.fillStyle = '#888';
                ctx.font = '7px monospace';
                ctx.textBaseline = 'top';
                for (let a = 0; a < actions.length; a++) {
                    const ax = actStartX + a * 38;
                    ctx.fillText(actions[a][1], ax + 12, actY + 18);
                }
            }
        }
    }
};

window.addEventListener('load', () => Game.init());
