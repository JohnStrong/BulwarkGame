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
            const clicked = this.screenToGrid(mouseX, mouseY);
            if (clicked && this.selectedTile &&
                clicked.row === this.selectedTile.row && clicked.col === this.selectedTile.col) {
                // Deselect if clicking same tile
                this.selectedTile = null;
                this.selectedLiftTarget = 0;
            } else {
                this.selectedTile = clicked;
                this.selectedLiftTarget = 3;
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

        // HUD
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, this.canvas.width, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(level.name + ' | WASD scroll | +/- zoom | SPACE rotate | ' + this.viewpoint + ' ' + Math.round(this.zoom * 100) + '%', 8, 14);
    }
};

window.addEventListener('load', () => Game.init());
