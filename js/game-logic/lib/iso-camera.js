/**
 * Isometric Camera — handles scroll, zoom, viewpoint rotation, and projection.
 *
 * Reusable for any isometric game. Requires a canvas and tile dimensions.
 *
 * Usage:
 *   IsoCamera.init(canvas, { tileW: 64, tileH: 32 });
 *   IsoCamera.centerOn(row, col);
 *   const { x, y } = IsoCamera.gridToScreen(row, col);
 *   const { row, col } = IsoCamera.screenToGrid(mouseX, mouseY);
 */

const IsoCamera = {
    // Tile dimensions
    tileW: 64,
    tileH: 32,

    // Camera position (world pixels)
    camX: 0,
    camY: 0,

    // Zoom
    zoom: 0.7,
    zoomMin: 0.3,
    zoomMax: 4.0,
    zoomSpeed: 0.05,

    // Scroll
    scrollSpeed: 8,

    // Viewpoint: 'br-tl' or 'bl-tr'
    viewpoint: 'br-tl',

    // Map offset (set during level start)
    mapOffsetX: 0,
    mapOffsetY: 0,

    // Elevation lookup (col → px offset)
    elevation: {},

    // Canvas reference
    canvas: null,

    /**
     * Initialize camera with canvas and optional config.
     */
    init(canvas, config) {
        this.canvas = canvas;
        if (config) {
            if (config.tileW) this.tileW = config.tileW;
            if (config.tileH) this.tileH = config.tileH;
            if (config.zoom) this.zoom = config.zoom;
        }
    },

    /**
     * Set map dimensions (call when level loads).
     */
    setMapSize(width, height) {
        this.mapOffsetX = height * (this.tileW / 2) + (this.tileW / 2);
        this.mapOffsetY = (this.tileH / 2) * 2;
    },

    /**
     * Center camera on a grid position.
     */
    centerOn(row, col) {
        const halfW = this.tileW / 2;
        const halfH = this.tileH / 2;
        let worldX;
        if (this.viewpoint === 'bl-tr') {
            worldX = (row - col) * halfW + this.mapOffsetX;
        } else {
            worldX = (col - row) * halfW + this.mapOffsetX;
        }
        const worldY = (col + row) * halfH + this.mapOffsetY;
        this.camX = worldX - this.canvas.width / 2;
        this.camY = worldY - this.canvas.height / 2;
    },

    /**
     * Toggle viewpoint orientation.
     */
    toggleViewpoint() {
        this.viewpoint = (this.viewpoint === 'br-tl') ? 'bl-tr' : 'br-tl';
    },

    /**
     * Convert grid (row, col) to screen pixel position.
     */
    gridToScreen(row, col) {
        let x;
        if (this.viewpoint === 'bl-tr') {
            x = (row - col) * (this.tileW / 2) + this.mapOffsetX - this.camX;
        } else {
            x = (col - row) * (this.tileW / 2) + this.mapOffsetX - this.camX;
        }
        const y = (col + row) * (this.tileH / 2) + this.mapOffsetY - this.camY;
        const elevOffset = this.elevation[col] || 0;
        return { x, y: y + elevOffset };
    },

    /**
     * Convert screen pixel to grid (row, col) — inverse projection.
     */
    screenToGrid(screenX, screenY, levelWidth, levelHeight) {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const worldX = (screenX - cx) / this.zoom + cx + this.camX - this.mapOffsetX;
        const worldY = (screenY - cy) / this.zoom + cy + this.camY - this.mapOffsetY;

        const halfW = this.tileW / 2;
        const halfH = this.tileH / 2;

        let col, row;
        if (this.viewpoint === 'bl-tr') {
            row = Math.round((worldX / halfW + worldY / halfH) / 2);
            col = Math.round((worldY / halfH - worldX / halfW) / 2);
        } else {
            col = Math.round((worldX / halfW + worldY / halfH) / 2);
            row = Math.round((worldY / halfH - worldX / halfW) / 2);
        }

        if (row >= 0 && row < levelHeight && col >= 0 && col < levelWidth) {
            return { row, col };
        }
        return null;
    },

    /**
     * Apply scroll input.
     */
    scroll(dx, dy) {
        const speed = this.scrollSpeed / this.zoom;
        this.camX += dx * speed;
        this.camY += dy * speed;
    },

    /**
     * Apply zoom delta (positive = in, negative = out).
     */
    applyZoom(delta) {
        this.zoom = Math.max(this.zoomMin, Math.min(this.zoomMax, this.zoom + delta));
    },

    /**
     * Apply zoom transform to a canvas context (call before drawing world).
     */
    applyTransform(ctx) {
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
    }
};
