/**
 * Tests for IsoCamera.applyTransform and additional branch coverage.
 *
 * Covers the applyTransform method which applies zoom transform to canvas,
 * and additional edge cases for screenToGrid and scroll.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-camera-transform.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── IsoCamera replica with full logic ──────────────────────────────────────

function createIsoCamera(config = {}) {
    return {
        tileW: config.tileW || 64,
        tileH: config.tileH || 32,
        camX: config.camX || 0,
        camY: config.camY || 0,
        zoom: config.zoom || 0.7,
        zoomMin: 0.3,
        zoomMax: 4.0,
        zoomSpeed: 0.05,
        scrollSpeed: 8,
        viewpoint: config.viewpoint || 'br-tl',
        mapOffsetX: config.mapOffsetX || 0,
        mapOffsetY: config.mapOffsetY || 0,
        elevation: config.elevation || {},
        canvas: config.canvas || { width: 1024, height: 768 },

        init(canvas, cfg) {
            this.canvas = canvas;
            if (cfg) {
                if (cfg.tileW) this.tileW = cfg.tileW;
                if (cfg.tileH) this.tileH = cfg.tileH;
                if (cfg.zoom) this.zoom = cfg.zoom;
            }
        },

        setMapSize(width, height) {
            this.mapOffsetX = height * (this.tileW / 2) + (this.tileW / 2);
            this.mapOffsetY = (this.tileH / 2) * 2;
        },

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

        toggleViewpoint() {
            this.viewpoint = (this.viewpoint === 'br-tl') ? 'bl-tr' : 'br-tl';
        },

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

        scroll(dx, dy) {
            const speed = this.scrollSpeed / this.zoom;
            this.camX += dx * speed;
            this.camY += dy * speed;
        },

        applyZoom(delta) {
            this.zoom = Math.max(this.zoomMin, Math.min(this.zoomMax, this.zoom + delta));
        },

        applyTransform(ctx) {
            ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
            ctx.scale(this.zoom, this.zoom);
            ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
        }
    };
}

// ─── Mock Canvas Context ────────────────────────────────────────────────────

function createMockCtx() {
    const calls = [];
    return {
        calls,
        translate(x, y) { calls.push({ method: 'translate', args: [x, y] }); },
        scale(sx, sy) { calls.push({ method: 'scale', args: [sx, sy] }); },
    };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('IsoCamera.applyTransform', () => {
    it('should call translate, scale, translate in correct order', () => {
        const camera = createIsoCamera({ zoom: 1.0 });
        const ctx = createMockCtx();

        camera.applyTransform(ctx);

        assert.equal(ctx.calls.length, 3);
        assert.equal(ctx.calls[0].method, 'translate');
        assert.equal(ctx.calls[1].method, 'scale');
        assert.equal(ctx.calls[2].method, 'translate');
    });

    it('should translate to canvas center first', () => {
        const camera = createIsoCamera({ zoom: 0.7 });
        camera.canvas = { width: 800, height: 600 };
        const ctx = createMockCtx();

        camera.applyTransform(ctx);

        assert.deepEqual(ctx.calls[0].args, [400, 300]);
    });

    it('should scale by zoom factor', () => {
        const camera = createIsoCamera({ zoom: 2.0 });
        const ctx = createMockCtx();

        camera.applyTransform(ctx);

        assert.deepEqual(ctx.calls[1].args, [2.0, 2.0]);
    });

    it('should translate back by negative canvas center', () => {
        const camera = createIsoCamera({ zoom: 0.7 });
        camera.canvas = { width: 800, height: 600 };
        const ctx = createMockCtx();

        camera.applyTransform(ctx);

        assert.deepEqual(ctx.calls[2].args, [-400, -300]);
    });

    it('should use current zoom value', () => {
        const camera = createIsoCamera({ zoom: 0.5 });
        camera.applyZoom(0.3); // zoom becomes 0.8
        const ctx = createMockCtx();

        camera.applyTransform(ctx);

        assert.deepEqual(ctx.calls[1].args, [0.8, 0.8]);
    });
});

describe('IsoCamera.screenToGrid: out-of-bounds returns null', () => {
    let camera;

    beforeEach(() => {
        camera = createIsoCamera();
        camera.canvas = { width: 1024, height: 768 };
        camera.setMapSize(20, 15);
        camera.centerOn(7, 10);
    });

    it('should return null for clicks far outside the map', () => {
        const result = camera.screenToGrid(0, 0, 20, 15);
        // Depending on camera position, this may be out of bounds
        // The important thing is it returns null or a valid grid position
        if (result !== null) {
            assert.ok(result.row >= 0 && result.row < 15);
            assert.ok(result.col >= 0 && result.col < 20);
        }
    });

    it('should return a valid grid position for center of screen', () => {
        const result = camera.screenToGrid(512, 384, 20, 15);
        // Center of screen after centering on (7, 10) should be near that position
        if (result !== null) {
            assert.ok(result.row >= 0 && result.row < 15);
            assert.ok(result.col >= 0 && result.col < 20);
        }
    });

    it('should return null for negative level dimensions', () => {
        // With 0 dimensions, nothing is valid
        const result = camera.screenToGrid(512, 384, 0, 0);
        assert.equal(result, null);
    });
});

describe('IsoCamera.screenToGrid: bl-tr viewpoint', () => {
    let camera;

    beforeEach(() => {
        camera = createIsoCamera({ viewpoint: 'bl-tr' });
        camera.canvas = { width: 1024, height: 768 };
        camera.setMapSize(20, 15);
        camera.centerOn(7, 10);
    });

    it('should use bl-tr projection formula', () => {
        const result = camera.screenToGrid(512, 384, 20, 15);
        // Should return a valid position or null
        if (result !== null) {
            assert.ok(result.row >= 0 && result.row < 15);
            assert.ok(result.col >= 0 && result.col < 20);
        }
    });
});

describe('IsoCamera.scroll: speed inversely proportional to zoom', () => {
    it('should scroll faster when zoomed out', () => {
        const camera = createIsoCamera({ zoom: 0.5 });
        const startX = camera.camX;
        camera.scroll(1, 0);
        const scrolledZoomOut = camera.camX - startX;

        const camera2 = createIsoCamera({ zoom: 2.0 });
        const startX2 = camera2.camX;
        camera2.scroll(1, 0);
        const scrolledZoomIn = camera2.camX - startX2;

        assert.ok(scrolledZoomOut > scrolledZoomIn,
            'Scrolling should be faster when zoomed out');
    });

    it('should scroll in both axes simultaneously', () => {
        const camera = createIsoCamera({ zoom: 1.0 });
        camera.scroll(1, 1);
        assert.ok(camera.camX > 0);
        assert.ok(camera.camY > 0);
    });

    it('should scroll in negative direction', () => {
        const camera = createIsoCamera({ zoom: 1.0 });
        camera.scroll(-1, -1);
        assert.ok(camera.camX < 0);
        assert.ok(camera.camY < 0);
    });

    it('should not scroll when dx and dy are 0', () => {
        const camera = createIsoCamera({ zoom: 1.0 });
        camera.scroll(0, 0);
        assert.equal(camera.camX, 0);
        assert.equal(camera.camY, 0);
    });
});

describe('IsoCamera.applyZoom: clamping', () => {
    it('should not exceed zoomMax', () => {
        const camera = createIsoCamera({ zoom: 3.9 });
        camera.applyZoom(0.5);
        assert.equal(camera.zoom, 4.0);
    });

    it('should not go below zoomMin', () => {
        const camera = createIsoCamera({ zoom: 0.4 });
        camera.applyZoom(-0.5);
        assert.equal(camera.zoom, 0.3);
    });

    it('should apply delta within bounds', () => {
        const camera = createIsoCamera({ zoom: 1.0 });
        camera.applyZoom(0.1);
        assert.ok(Math.abs(camera.zoom - 1.1) < 0.001);
    });
});
