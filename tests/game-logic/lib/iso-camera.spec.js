/**
 * Tests for js/game-logic/lib/iso-camera.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-camera.spec.js
 */

const { describe, it, beforeEach } = require('node:test');
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
    };
}

const mockCanvas = { width: 1024, height: 768 };

describe('IsoCamera.init', () => {
    it('should set canvas reference', () => {
        const cam = createCamera();
        cam.init(mockCanvas, {});
        assert.equal(cam.canvas, mockCanvas);
    });

    it('should apply config overrides', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { tileW: 128, tileH: 64, zoom: 1.5 });
        assert.equal(cam.tileW, 128);
        assert.equal(cam.tileH, 64);
        assert.equal(cam.zoom, 1.5);
    });

    it('should keep defaults when config is empty', () => {
        const cam = createCamera();
        cam.init(mockCanvas, {});
        assert.equal(cam.tileW, 64);
        assert.equal(cam.tileH, 32);
        assert.equal(cam.zoom, 0.7);
    });
});

describe('IsoCamera.setMapSize', () => {
    it('should compute mapOffsetX from height and tileW', () => {
        const cam = createCamera();
        cam.init(mockCanvas, {});
        cam.setMapSize(20, 15);
        // mapOffsetX = height * (tileW/2) + (tileW/2) = 15 * 32 + 32 = 512
        assert.equal(cam.mapOffsetX, 15 * 32 + 32);
    });

    it('should compute mapOffsetY from tileH', () => {
        const cam = createCamera();
        cam.init(mockCanvas, {});
        cam.setMapSize(20, 15);
        // mapOffsetY = (tileH/2) * 2 = 32
        assert.equal(cam.mapOffsetY, 32);
    });
});

describe('IsoCamera.toggleViewpoint', () => {
    it('should toggle from br-tl to bl-tr', () => {
        const cam = createCamera();
        cam.toggleViewpoint();
        assert.equal(cam.viewpoint, 'bl-tr');
    });

    it('should toggle back from bl-tr to br-tl', () => {
        const cam = createCamera();
        cam.viewpoint = 'bl-tr';
        cam.toggleViewpoint();
        assert.equal(cam.viewpoint, 'br-tl');
    });
});

describe('IsoCamera.applyZoom', () => {
    it('should increase zoom with positive delta', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.applyZoom(0.1);
        assert.equal(cam.zoom, 1.1);
    });

    it('should decrease zoom with negative delta', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.applyZoom(-0.2);
        assert.ok(Math.abs(cam.zoom - 0.8) < 0.001);
    });

    it('should clamp zoom to zoomMin', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 0.5 });
        cam.applyZoom(-10);
        assert.equal(cam.zoom, cam.zoomMin);
    });

    it('should clamp zoom to zoomMax', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 3.5 });
        cam.applyZoom(10);
        assert.equal(cam.zoom, cam.zoomMax);
    });
});

describe('IsoCamera.scroll', () => {
    it('should move camX and camY based on direction and speed', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.scroll(1, 0);
        assert.equal(cam.camX, cam.scrollSpeed);
        assert.equal(cam.camY, 0);
    });

    it('should scale speed inversely with zoom', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 2.0 });
        cam.scroll(1, 1);
        const expectedSpeed = cam.scrollSpeed / 2.0;
        assert.equal(cam.camX, expectedSpeed);
        assert.equal(cam.camY, expectedSpeed);
    });

    it('should handle negative directions', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.scroll(-1, -1);
        assert.equal(cam.camX, -cam.scrollSpeed);
        assert.equal(cam.camY, -cam.scrollSpeed);
    });
});

describe('IsoCamera.gridToScreen', () => {
    it('should return screen position for grid coordinates', () => {
        const cam = createCamera();
        cam.init(mockCanvas, {});
        cam.setMapSize(20, 15);
        cam.camX = 0;
        cam.camY = 0;
        const pos = cam.gridToScreen(0, 0);
        assert.equal(pos.x, cam.mapOffsetX);
        assert.equal(pos.y, cam.mapOffsetY);
    });

    it('should apply elevation offset to y', () => {
        const cam = createCamera();
        cam.init(mockCanvas, {});
        cam.setMapSize(20, 15);
        cam.camX = 0;
        cam.camY = 0;
        cam.elevation = { 3: -10 };
        const pos = cam.gridToScreen(0, 3);
        const posNoElev = cam.gridToScreen(0, 2);
        // Col 3 should have -10 offset vs col 2
        assert.equal(pos.y, posNoElev.y + (3 - 2) * (cam.tileH / 2) - 10);
    });
});

describe('IsoCamera.screenToGrid', () => {
    it('should return null for out-of-bounds coordinates', () => {
        const cam = createCamera();
        cam.init(mockCanvas, {});
        cam.setMapSize(20, 15);
        cam.centerOn(7, 10);
        const result = cam.screenToGrid(-9999, -9999, 20, 15);
        assert.equal(result, null);
    });

    it('should return valid grid coords for center of screen after centering', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(5, 5);
        // Center of screen should map back to approximately (5, 5)
        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 15);
        assert.ok(result !== null);
        assert.equal(result.row, 5);
        assert.equal(result.col, 5);
    });
});
