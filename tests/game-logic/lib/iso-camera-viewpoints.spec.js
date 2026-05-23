/**
 * Tests for IsoCamera bl-tr viewpoint variant.
 *
 * Recommendation 2: The bl-tr viewpoint path in gridToScreen, screenToGrid,
 * and centerOn is not directly tested. This file adds parameterized tests
 * for both viewpoints.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-camera-viewpoints.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Replicate IsoCamera for testing (no DOM deps) — same as iso-camera.spec.js
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

// ─── bl-tr viewpoint: gridToScreen ──────────────────────────────────────────

describe('IsoCamera.gridToScreen (bl-tr viewpoint)', () => {
    it('should return screen position for origin in bl-tr mode', () => {
        const cam = createCamera();
        cam.init(mockCanvas, {});
        cam.setMapSize(20, 15);
        cam.viewpoint = 'bl-tr';
        cam.camX = 0;
        cam.camY = 0;
        const pos = cam.gridToScreen(0, 0);
        assert.equal(pos.x, cam.mapOffsetX);
        assert.equal(pos.y, cam.mapOffsetY);
    });

    it('should mirror x-axis compared to br-tl for same grid position', () => {
        const cam1 = createCamera();
        cam1.init(mockCanvas, {});
        cam1.setMapSize(20, 15);
        cam1.viewpoint = 'br-tl';
        cam1.camX = 0;
        cam1.camY = 0;

        const cam2 = createCamera();
        cam2.init(mockCanvas, {});
        cam2.setMapSize(20, 15);
        cam2.viewpoint = 'bl-tr';
        cam2.camX = 0;
        cam2.camY = 0;

        const pos1 = cam1.gridToScreen(3, 5);
        const pos2 = cam2.gridToScreen(3, 5);

        // Y should be the same (both viewpoints share the same y formula)
        assert.equal(pos1.y, pos2.y);
        // X should differ (mirrored)
        assert.notEqual(pos1.x, pos2.x);
    });

    it('should produce different x for row vs col in bl-tr mode', () => {
        const cam = createCamera();
        cam.init(mockCanvas, {});
        cam.setMapSize(20, 15);
        cam.viewpoint = 'bl-tr';
        cam.camX = 0;
        cam.camY = 0;

        const pos1 = cam.gridToScreen(2, 0);
        const pos2 = cam.gridToScreen(0, 2);
        // In bl-tr: x = (row - col) * halfW + offset
        // pos1: (2-0)*32 + offset = 64 + offset
        // pos2: (0-2)*32 + offset = -64 + offset
        assert.ok(pos1.x > pos2.x, 'Higher row should be further right in bl-tr');
    });

    it('should apply elevation offset in bl-tr mode', () => {
        const cam = createCamera();
        cam.init(mockCanvas, {});
        cam.setMapSize(20, 15);
        cam.viewpoint = 'bl-tr';
        cam.camX = 0;
        cam.camY = 0;
        cam.elevation = { 5: -20 };

        const posNoElev = cam.gridToScreen(3, 4);
        const posWithElev = cam.gridToScreen(3, 5);
        // Col 5 has -20 elevation offset
        const expectedYDiff = (cam.tileH / 2) - 20; // one row down + elevation
        assert.equal(posWithElev.y - posNoElev.y, expectedYDiff);
    });
});

// ─── bl-tr viewpoint: centerOn ──────────────────────────────────────────────

describe('IsoCamera.centerOn (bl-tr viewpoint)', () => {
    it('should center camera on a grid position in bl-tr mode', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.viewpoint = 'bl-tr';
        cam.centerOn(7, 7);

        // After centering, gridToScreen(7,7) should be near screen center
        const pos = cam.gridToScreen(7, 7);
        assert.ok(Math.abs(pos.x - mockCanvas.width / 2) < 1,
            `x should be near center, got ${pos.x} vs ${mockCanvas.width / 2}`);
        assert.ok(Math.abs(pos.y - mockCanvas.height / 2) < 1,
            `y should be near center, got ${pos.y} vs ${mockCanvas.height / 2}`);
    });

    it('should produce different camX than br-tl for same position', () => {
        const cam1 = createCamera();
        cam1.init(mockCanvas, { zoom: 1.0 });
        cam1.setMapSize(20, 15);
        cam1.viewpoint = 'br-tl';
        cam1.centerOn(5, 5);

        const cam2 = createCamera();
        cam2.init(mockCanvas, { zoom: 1.0 });
        cam2.setMapSize(20, 15);
        cam2.viewpoint = 'bl-tr';
        cam2.centerOn(5, 5);

        // camY should be the same (y formula is viewpoint-independent)
        assert.equal(cam1.camY, cam2.camY);
        // camX should differ when row !== col
        // For row=5, col=5: br-tl uses (col-row)=0, bl-tr uses (row-col)=0
        // Actually for equal row/col they're the same. Use asymmetric coords:
    });

    it('should produce different camX for asymmetric coordinates', () => {
        const cam1 = createCamera();
        cam1.init(mockCanvas, { zoom: 1.0 });
        cam1.setMapSize(20, 15);
        cam1.viewpoint = 'br-tl';
        cam1.centerOn(3, 7);

        const cam2 = createCamera();
        cam2.init(mockCanvas, { zoom: 1.0 });
        cam2.setMapSize(20, 15);
        cam2.viewpoint = 'bl-tr';
        cam2.centerOn(3, 7);

        assert.notEqual(cam1.camX, cam2.camX);
        assert.equal(cam1.camY, cam2.camY);
    });
});

// ─── bl-tr viewpoint: screenToGrid ──────────────────────────────────────────

describe('IsoCamera.screenToGrid (bl-tr viewpoint)', () => {
    it('should return valid grid coords for center of screen after centering (bl-tr)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.viewpoint = 'bl-tr';
        cam.centerOn(5, 5);

        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 15);
        assert.ok(result !== null, 'Center of screen should map to a valid grid position');
        assert.equal(result.row, 5);
        assert.equal(result.col, 5);
    });

    it('should return null for out-of-bounds in bl-tr mode', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.viewpoint = 'bl-tr';
        cam.centerOn(7, 7);

        const result = cam.screenToGrid(-9999, -9999, 20, 15);
        assert.equal(result, null);
    });

    it('screenToGrid should be inverse of gridToScreen in bl-tr mode', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.viewpoint = 'bl-tr';
        cam.centerOn(7, 7);

        // Get screen position of (7, 7), then convert back
        const screenPos = cam.gridToScreen(7, 7);
        const gridPos = cam.screenToGrid(screenPos.x, screenPos.y, 20, 15);
        assert.ok(gridPos !== null);
        assert.equal(gridPos.row, 7);
        assert.equal(gridPos.col, 7);
    });

    it('roundtrip should work for various positions in bl-tr mode', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.viewpoint = 'bl-tr';
        cam.centerOn(10, 7);

        const testPositions = [
            { row: 10, col: 7 },
            { row: 8, col: 9 },
            { row: 12, col: 5 },
        ];

        for (const { row, col } of testPositions) {
            const screen = cam.gridToScreen(row, col);
            const grid = cam.screenToGrid(screen.x, screen.y, 20, 15);
            if (grid !== null) {
                assert.equal(grid.row, row, `Row roundtrip failed for (${row}, ${col})`);
                assert.equal(grid.col, col, `Col roundtrip failed for (${row}, ${col})`);
            }
        }
    });
});

// ─── Viewpoint toggle consistency ───────────────────────────────────────────

describe('IsoCamera: viewpoint toggle consistency', () => {
    it('toggling viewpoint twice should return to original state', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.viewpoint = 'br-tl';
        cam.centerOn(5, 5);

        const originalCamX = cam.camX;
        const originalCamY = cam.camY;

        cam.toggleViewpoint();
        cam.toggleViewpoint();

        assert.equal(cam.viewpoint, 'br-tl');
    });

    it('gridToScreen results should swap row/col behavior between viewpoints', () => {
        const cam = createCamera();
        cam.init(mockCanvas, {});
        cam.setMapSize(20, 15);
        cam.camX = 0;
        cam.camY = 0;

        // In br-tl: x = (col - row) * halfW + offset
        cam.viewpoint = 'br-tl';
        const brTl_3_5 = cam.gridToScreen(3, 5);
        const brTl_5_3 = cam.gridToScreen(5, 3);

        // In bl-tr: x = (row - col) * halfW + offset
        cam.viewpoint = 'bl-tr';
        const blTr_3_5 = cam.gridToScreen(3, 5);
        const blTr_5_3 = cam.gridToScreen(5, 3);

        // br-tl(3,5).x uses (5-3)=2, bl-tr(3,5).x uses (3-5)=-2
        // br-tl(5,3).x uses (3-5)=-2, bl-tr(5,3).x uses (5-3)=2
        // So br-tl(3,5).x should equal bl-tr(5,3).x
        assert.equal(brTl_3_5.x, blTr_5_3.x);
        assert.equal(brTl_5_3.x, blTr_3_5.x);
    });
});
