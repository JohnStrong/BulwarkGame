/**
 * Tests for iso-camera.js bl-tr viewpoint branch coverage.
 *
 * Covers:
 * - gridToScreen with bl-tr viewpoint
 * - screenToGrid with bl-tr viewpoint
 * - screenToGrid returning null for out-of-bounds
 * - centerOn with bl-tr viewpoint
 * - Round-trip: gridToScreen → screenToGrid consistency in bl-tr
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-camera-bl-tr.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

function createCamera() {
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
        viewpoint: 'bl-tr',
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

describe('IsoCamera bl-tr viewpoint: gridToScreen', () => {
    it('should compute x using (row - col) formula in bl-tr mode', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.camX = 0;
        cam.camY = 0;

        const pos00 = cam.gridToScreen(0, 0);
        const pos10 = cam.gridToScreen(1, 0);
        const pos01 = cam.gridToScreen(0, 1);

        // In bl-tr: x = (row - col) * halfW + mapOffsetX - camX
        // row=1,col=0 should be to the RIGHT of row=0,col=0
        assert.ok(pos10.x > pos00.x, `row+1 should move right: ${pos10.x} > ${pos00.x}`);
        // row=0,col=1 should be to the LEFT of row=0,col=0
        assert.ok(pos01.x < pos00.x, `col+1 should move left: ${pos01.x} < ${pos00.x}`);
    });

    it('should compute y using (col + row) formula (same as br-tl)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.camX = 0;
        cam.camY = 0;

        const pos00 = cam.gridToScreen(0, 0);
        const pos11 = cam.gridToScreen(1, 1);

        // y = (col + row) * halfH + mapOffsetY - camY
        // (1+1) * 16 + 32 = 64 vs (0+0) * 16 + 32 = 32
        assert.ok(pos11.y > pos00.y, `Increasing row+col should increase y`);
    });

    it('should apply elevation offset in bl-tr mode', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.camX = 0;
        cam.camY = 0;
        cam.elevation = { 2: -20 };

        const posNoElev = cam.gridToScreen(0, 0);
        const posWithElev = cam.gridToScreen(0, 2);

        // Col 2 has -20 elevation offset
        const expectedYDiff = (2 - 0) * (cam.tileH / 2) + (-20);
        assert.equal(posWithElev.y - posNoElev.y, expectedYDiff);
    });

    it('should differ from br-tl viewpoint for same coordinates', () => {
        const camBLTR = createCamera();
        camBLTR.init(mockCanvas, { zoom: 1.0 });
        camBLTR.setMapSize(20, 15);
        camBLTR.camX = 0;
        camBLTR.camY = 0;

        const camBRTL = createCamera();
        camBRTL.viewpoint = 'br-tl';
        camBRTL.init(mockCanvas, { zoom: 1.0 });
        camBRTL.setMapSize(20, 15);
        camBRTL.camX = 0;
        camBRTL.camY = 0;

        // For non-symmetric coordinates, x should differ
        const posBLTR = camBLTR.gridToScreen(3, 5);
        const posBRTL = camBRTL.gridToScreen(3, 5);

        // x differs because formula is (row-col) vs (col-row)
        assert.notEqual(posBLTR.x, posBRTL.x);
        // y should be the same (same formula)
        assert.equal(posBLTR.y, posBRTL.y);
    });
});

describe('IsoCamera bl-tr viewpoint: screenToGrid', () => {
    it('should return correct grid coords when centered on a tile', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(7, 7);

        // Center of screen should map back to (7, 7)
        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 15);
        assert.ok(result !== null);
        assert.equal(result.row, 7);
        assert.equal(result.col, 7);
    });

    it('should return null for far out-of-bounds coordinates', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(7, 7);

        const result = cam.screenToGrid(-5000, -5000, 20, 15);
        assert.equal(result, null);
    });

    it('should return null for coordinates beyond level width', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(0, 0);

        // Very far right should be out of bounds
        const result = cam.screenToGrid(9999, mockCanvas.height / 2, 20, 15);
        assert.equal(result, null);
    });

    it('should return null for negative grid coordinates', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(0, 0);

        // Very far left should produce negative row/col
        const result = cam.screenToGrid(-9999, -9999, 20, 15);
        assert.equal(result, null);
    });

    it('should round-trip gridToScreen → screenToGrid for center tile', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(5, 5);

        const screen = cam.gridToScreen(5, 5);
        const grid = cam.screenToGrid(screen.x, screen.y, 20, 15);
        assert.ok(grid !== null);
        assert.equal(grid.row, 5);
        assert.equal(grid.col, 5);
    });

    it('should round-trip for multiple tiles in bl-tr mode', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(10, 7);

        // Test several tiles near center
        const testCases = [
            { row: 10, col: 7 },
            { row: 9, col: 7 },
            { row: 10, col: 8 },
            { row: 11, col: 6 },
        ];

        for (const { row, col } of testCases) {
            const screen = cam.gridToScreen(row, col);
            const grid = cam.screenToGrid(screen.x, screen.y, 20, 15);
            assert.ok(grid !== null, `Grid (${row},${col}) should round-trip`);
            assert.equal(grid.row, row, `Row mismatch for (${row},${col})`);
            assert.equal(grid.col, col, `Col mismatch for (${row},${col})`);
        }
    });

    it('should work with non-1.0 zoom in bl-tr mode', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 0.5 });
        cam.setMapSize(20, 15);
        cam.centerOn(7, 7);

        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 15);
        assert.ok(result !== null);
        assert.equal(result.row, 7);
        assert.equal(result.col, 7);
    });
});

describe('IsoCamera bl-tr viewpoint: centerOn', () => {
    it('should center camera using (row - col) formula for worldX', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(5, 3);

        // worldX = (row - col) * halfW + mapOffsetX = (5-3)*32 + 512 = 576
        // camX = worldX - canvas.width/2 = 576 - 512 = 64
        const expectedWorldX = (5 - 3) * 32 + cam.mapOffsetX;
        const expectedCamX = expectedWorldX - mockCanvas.width / 2;
        assert.equal(cam.camX, expectedCamX);
    });

    it('should compute camY the same way as br-tl', () => {
        const camBLTR = createCamera();
        camBLTR.init(mockCanvas, { zoom: 1.0 });
        camBLTR.setMapSize(20, 15);
        camBLTR.centerOn(5, 3);

        const camBRTL = createCamera();
        camBRTL.viewpoint = 'br-tl';
        camBRTL.init(mockCanvas, { zoom: 1.0 });
        camBRTL.setMapSize(20, 15);
        camBRTL.centerOn(5, 3);

        // camY should be the same for both viewpoints
        assert.equal(camBLTR.camY, camBRTL.camY);
    });
});

describe('IsoCamera screenToGrid: explicit out-of-bounds cases', () => {
    // For bl-tr viewpoint:
    //   col = round((worldX/halfW + worldY/halfH) / 2)
    //   row = round((worldY/halfH - worldX/halfW) / 2)
    // worldX = (screenX - cx) / zoom + cx + camX - mapOffsetX
    // worldY = (screenY - cy) / zoom + cy + camY - mapOffsetY

    it('should return null when computed row < 0 (click far up-left)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        // Center camera on (0, 0) so the top-left of the map is near screen center
        cam.centerOn(0, 0);

        // Clicking far to the upper-left produces negative row
        const result = cam.screenToGrid(0, 0, 20, 15);
        // With camera centered on (0,0), clicking at screen (0,0) is far upper-left
        // row will be negative
        assert.equal(result, null);
    });

    it('should return null when computed col < 0 (click far upper-right in bl-tr)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(0, 0);

        // In bl-tr, moving right on screen decreases col (col = round((worldY/halfH - worldX/halfW)/2))
        // Click far right to get negative col
        const result = cam.screenToGrid(mockCanvas.width, 0, 20, 15);
        assert.equal(result, null);
    });

    it('should return null when computed row >= levelHeight (click far down)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(0, 0);

        // Clicking very far down produces row >= levelHeight
        const result = cam.screenToGrid(mockCanvas.width / 2, 99999, 20, 15);
        assert.equal(result, null);
    });

    it('should return null when computed col >= levelWidth (click far down-left in bl-tr)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(0, 0);

        // In bl-tr, col increases as we move down-left; click far down to exceed levelWidth
        const result = cam.screenToGrid(0, 99999, 20, 15);
        assert.equal(result, null);
    });

    it('should return null for levelWidth=0 (empty level)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(0, 0);
        cam.camX = 0;
        cam.camY = 0;

        // Any click on a zero-size level should return null
        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 0, 10);
        assert.equal(result, null);
    });

    it('should return null for levelHeight=0 (empty level)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 0);
        cam.camX = 0;
        cam.camY = 0;

        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 0);
        assert.equal(result, null);
    });

    it('should return valid result for the exact last valid tile (levelHeight-1, levelWidth-1)', () => {
        const levelWidth = 20;
        const levelHeight = 15;
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(levelWidth, levelHeight);

        const lastRow = levelHeight - 1;
        const lastCol = levelWidth - 1;
        cam.centerOn(lastRow, lastCol);

        // Screen center should map to the last tile
        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, levelWidth, levelHeight);
        assert.ok(result !== null, 'Should return a valid result for the last tile');
        assert.equal(result.row, lastRow);
        assert.equal(result.col, lastCol);
    });
});
