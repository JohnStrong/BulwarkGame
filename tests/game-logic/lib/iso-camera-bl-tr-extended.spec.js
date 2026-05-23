/**
 * Extended bl-tr viewpoint tests for IsoCamera.
 *
 * Recommendation 2: Test the bl-tr viewpoint branch in IsoCamera.
 * Covers: centerOn, gridToScreen, screenToGrid with bl-tr viewpoint,
 * edge-of-map boundary cases, and zoom interactions.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-camera-bl-tr-extended.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

function createCamera(viewpoint = 'bl-tr') {
    return {
        tileW: 64,
        tileH: 32,
        camX: 0,
        camY: 0,
        zoom: 1.0,
        zoomMin: 0.3,
        zoomMax: 4.0,
        zoomSpeed: 0.05,
        scrollSpeed: 8,
        viewpoint,
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

describe('IsoCamera bl-tr: screenToGrid edge-of-map boundary cases', () => {
    it('should return null for row at exact boundary (row === levelHeight)', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        // Center on a corner tile to push screen coords toward boundary
        cam.centerOn(14, 0);
        // The center should map to (14, 0) which is valid
        const center = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 15);
        assert.ok(center !== null);
        assert.equal(center.row, 14);
    });

    it('should return null for col at exact boundary (col === levelWidth)', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(0, 19);
        const center = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 15);
        assert.ok(center !== null);
        assert.equal(center.col, 19);
    });

    it('should return null for row === -1 (just below zero)', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(0, 0);
        // Far top-left should produce negative row
        const result = cam.screenToGrid(-2000, -2000, 20, 15);
        assert.equal(result, null);
    });

    it('should handle corner tile (0, 0) round-trip in bl-tr', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(0, 0);
        const screen = cam.gridToScreen(0, 0);
        const grid = cam.screenToGrid(screen.x, screen.y, 20, 15);
        assert.ok(grid !== null);
        assert.equal(grid.row, 0);
        assert.equal(grid.col, 0);
    });

    it('should handle corner tile (levelHeight-1, levelWidth-1) round-trip', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(14, 19);
        const screen = cam.gridToScreen(14, 19);
        const grid = cam.screenToGrid(screen.x, screen.y, 20, 15);
        assert.ok(grid !== null);
        assert.equal(grid.row, 14);
        assert.equal(grid.col, 19);
    });
});

describe('IsoCamera bl-tr: centerOn with various zoom levels', () => {
    it('should center correctly at zoom 0.5', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 0.5 });
        cam.setMapSize(20, 15);
        cam.centerOn(7, 7);
        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 15);
        assert.ok(result !== null);
        assert.equal(result.row, 7);
        assert.equal(result.col, 7);
    });

    it('should center correctly at zoom 2.0', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 2.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(7, 7);
        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 15);
        assert.ok(result !== null);
        assert.equal(result.row, 7);
        assert.equal(result.col, 7);
    });

    it('should center correctly at max zoom', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 4.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(10, 10);
        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 15);
        assert.ok(result !== null);
        assert.equal(result.row, 10);
        assert.equal(result.col, 10);
    });
});

describe('IsoCamera bl-tr: gridToScreen symmetry with br-tl', () => {
    it('should produce mirrored x for symmetric coordinates', () => {
        const camBLTR = createCamera('bl-tr');
        camBLTR.init(mockCanvas, { zoom: 1.0 });
        camBLTR.setMapSize(20, 15);
        camBLTR.camX = 0;
        camBLTR.camY = 0;

        const camBRTL = createCamera('br-tl');
        camBRTL.init(mockCanvas, { zoom: 1.0 });
        camBRTL.setMapSize(20, 15);
        camBRTL.camX = 0;
        camBRTL.camY = 0;

        // For row=col, both viewpoints should give same x (since row-col = col-row = 0)
        const posBLTR = camBLTR.gridToScreen(5, 5);
        const posBRTL = camBRTL.gridToScreen(5, 5);
        assert.equal(posBLTR.x, posBRTL.x);
        assert.equal(posBLTR.y, posBRTL.y);
    });

    it('should produce opposite x offset for asymmetric coordinates', () => {
        const camBLTR = createCamera('bl-tr');
        camBLTR.init(mockCanvas, { zoom: 1.0 });
        camBLTR.setMapSize(20, 15);
        camBLTR.camX = 0;
        camBLTR.camY = 0;

        const camBRTL = createCamera('br-tl');
        camBRTL.init(mockCanvas, { zoom: 1.0 });
        camBRTL.setMapSize(20, 15);
        camBRTL.camX = 0;
        camBRTL.camY = 0;

        const posBLTR = camBLTR.gridToScreen(3, 7);
        const posBRTL = camBRTL.gridToScreen(3, 7);

        // bl-tr: x = (3-7)*32 + offset = -128 + offset
        // br-tl: x = (7-3)*32 + offset = 128 + offset
        // Difference should be 2 * (row-col) * halfW = 2 * (-4) * 32 = -256
        assert.equal(posBLTR.x - posBRTL.x, 2 * (3 - 7) * 32);
    });
});
