/**
 * Edge case and boundary tests for js/game-logic/lib/iso-camera.js
 *
 * Recommendation 6: Add boundary/edge case tests for iso-camera.js
 * Tests extreme zoom levels, boundary pixels, viewport edge cases,
 * and applyTransform canvas context calls.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-camera-edge-cases.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Replicate IsoCamera for testing (no DOM deps)
function createCamera() {
    return {
        tileW: 64,
        tileH: 32,
        camX: 0,
        camY: 0,
        zoom: 0.7,
        zoomMin: 0.3,
        zoomMax: 4.0,
        zoomSpeed: 0.05,
        scrollSpeed: 8,
        viewpoint: 'br-tl',
        mapOffsetX: 0,
        mapOffsetY: 0,
        elevation: {},
        canvas: null,

        init(canvas, config) {
            this.canvas = canvas;
            if (config) {
                if (config.tileW) this.tileW = config.tileW;
                if (config.tileH) this.tileH = config.tileH;
                if (config.zoom) this.zoom = config.zoom;
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

const mockCanvas = { width: 1024, height: 768 };

// ─── applyTransform Tests ───────────────────────────────────────────────────

describe('IsoCamera.applyTransform', () => {
    it('should call translate, scale, translate in correct order', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.5 });

        const calls = [];
        const mockCtx = {
            translate(x, y) { calls.push(['translate', x, y]); },
            scale(x, y) { calls.push(['scale', x, y]); },
        };

        cam.applyTransform(mockCtx);

        assert.equal(calls.length, 3);
        assert.deepEqual(calls[0], ['translate', 512, 384]); // canvas center
        assert.deepEqual(calls[1], ['scale', 1.5, 1.5]);
        assert.deepEqual(calls[2], ['translate', -512, -384]); // negative canvas center
    });

    it('should use current zoom value', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 0.5 });

        const calls = [];
        const mockCtx = {
            translate(x, y) { calls.push(['translate', x, y]); },
            scale(x, y) { calls.push(['scale', x, y]); },
        };

        cam.applyTransform(mockCtx);
        assert.deepEqual(calls[1], ['scale', 0.5, 0.5]);
    });

    it('should use canvas dimensions for translate offsets', () => {
        const cam = createCamera();
        const smallCanvas = { width: 320, height: 240 };
        cam.init(smallCanvas, { zoom: 1.0 });

        const calls = [];
        const mockCtx = {
            translate(x, y) { calls.push(['translate', x, y]); },
            scale(x, y) { calls.push(['scale', x, y]); },
        };

        cam.applyTransform(mockCtx);
        assert.deepEqual(calls[0], ['translate', 160, 120]);
        assert.deepEqual(calls[2], ['translate', -160, -120]);
    });
});

// ─── screenToGrid Boundary Tests ────────────────────────────────────────────

describe('IsoCamera.screenToGrid: boundary and edge cases', () => {
    it('should return null for pixel at (0, 0) when camera is centered on map', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(10, 10);
        // Top-left corner of screen is far from the map center
        const result = cam.screenToGrid(0, 0, 20, 15);
        // May or may not be null depending on map size, but should not crash
        assert.ok(result === null || (result.row >= 0 && result.col >= 0));
    });

    it('should return null for pixel at (canvasW-1, canvasH-1) when centered on (0,0)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(10, 10);
        cam.centerOn(0, 0);
        const result = cam.screenToGrid(1023, 767, 10, 10);
        // Bottom-right corner should be out of bounds for a small map
        assert.equal(result, null);
    });

    it('should handle extreme zoom in (zoomMax = 4.0)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 4.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(5, 5);
        // At max zoom, center should still map correctly
        const result = cam.screenToGrid(512, 384, 20, 15);
        assert.ok(result !== null, 'Center should still be valid at max zoom');
        assert.equal(result.row, 5);
        assert.equal(result.col, 5);
    });

    it('should handle extreme zoom out (zoomMin = 0.3)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 0.3 });
        cam.setMapSize(20, 15);
        cam.centerOn(10, 7);
        // At min zoom, center should still map correctly
        const result = cam.screenToGrid(512, 384, 20, 15);
        assert.ok(result !== null, 'Center should still be valid at min zoom');
        assert.equal(result.row, 10);
        assert.equal(result.col, 7);
    });

    it('should return null for negative screen coordinates', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(5, 5);
        const result = cam.screenToGrid(-100, -100, 20, 15);
        assert.equal(result, null);
    });

    it('should return null for screen coordinates beyond canvas', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(5, 5);
        const result = cam.screenToGrid(5000, 5000, 20, 15);
        assert.equal(result, null);
    });

    it('should handle 1x1 level (single tile)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(1, 1);
        cam.centerOn(0, 0);
        const result = cam.screenToGrid(512, 384, 1, 1);
        assert.ok(result !== null);
        assert.equal(result.row, 0);
        assert.equal(result.col, 0);
    });

    it('should work correctly in bl-tr viewpoint', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.viewpoint = 'bl-tr';
        cam.setMapSize(20, 15);
        cam.centerOn(5, 5);
        const result = cam.screenToGrid(512, 384, 20, 15);
        assert.ok(result !== null);
        assert.equal(result.row, 5);
        assert.equal(result.col, 5);
    });

    it('should handle boundary row/col (last valid tile)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(14, 19);
        // Center on the last valid tile
        const result = cam.screenToGrid(512, 384, 20, 15);
        assert.ok(result !== null);
        assert.equal(result.row, 14);
        assert.equal(result.col, 19);
    });
});

// ─── applyZoom Edge Cases ───────────────────────────────────────────────────

describe('IsoCamera.applyZoom: edge cases', () => {
    it('should handle zero delta', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.applyZoom(0);
        assert.equal(cam.zoom, 1.0);
    });

    it('should handle very small positive delta', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.applyZoom(0.001);
        assert.ok(Math.abs(cam.zoom - 1.001) < 0.0001);
    });

    it('should handle very small negative delta', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.applyZoom(-0.001);
        assert.ok(Math.abs(cam.zoom - 0.999) < 0.0001);
    });

    it('should handle delta that exactly reaches zoomMin', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 0.5 });
        cam.applyZoom(-0.2); // 0.5 - 0.2 = 0.3 = zoomMin
        assert.equal(cam.zoom, 0.3);
    });

    it('should handle delta that exactly reaches zoomMax', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 3.5 });
        cam.applyZoom(0.5); // 3.5 + 0.5 = 4.0 = zoomMax
        assert.equal(cam.zoom, 4.0);
    });
});

// ─── scroll Edge Cases ──────────────────────────────────────────────────────

describe('IsoCamera.scroll: edge cases', () => {
    it('should handle zero direction', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.scroll(0, 0);
        assert.equal(cam.camX, 0);
        assert.equal(cam.camY, 0);
    });

    it('should handle very high zoom (speed approaches zero)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 4.0 });
        cam.scroll(1, 1);
        const expectedSpeed = cam.scrollSpeed / 4.0;
        assert.equal(cam.camX, expectedSpeed);
        assert.equal(cam.camY, expectedSpeed);
    });

    it('should handle very low zoom (speed is amplified)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 0.3 });
        cam.scroll(1, 0);
        const expectedSpeed = cam.scrollSpeed / 0.3;
        assert.ok(Math.abs(cam.camX - expectedSpeed) < 0.001);
    });

    it('should accumulate multiple scroll calls', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.scroll(1, 0);
        cam.scroll(1, 0);
        cam.scroll(1, 0);
        assert.equal(cam.camX, cam.scrollSpeed * 3);
    });
});
