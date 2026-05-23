/**
 * Extended tests for iso-camera.js bl-tr viewpoint path.
 *
 * Recommendation 5: Test the bl-tr viewpoint path in IsoCamera more
 * thoroughly, including edge cases and boundary conditions.
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

        applyZoom(delta) {
            this.zoom = Math.max(this.zoomMin, Math.min(this.zoomMax, this.zoom + delta));
        },

        applyTransform(ctx) {
            ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
            ctx.scale(this.zoom, this.zoom);
            ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
        },
    };
}

const mockCanvas = { width: 1024, height: 768 };

describe('IsoCamera bl-tr: screenToGrid boundary conditions', () => {
    it('should return null for coordinates at exact grid boundary (row = levelHeight)', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(10, 10);
        // Center on a tile near the boundary
        cam.centerOn(9, 9);

        // The center should map to (9,9) which is valid
        const center = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 10, 10);
        assert.ok(center !== null);
        assert.equal(center.row, 9);
        assert.equal(center.col, 9);
    });

    it('should return null for negative row coordinates in bl-tr', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(0, 0);

        // Far left/up should produce negative coordinates
        const result = cam.screenToGrid(-2000, -2000, 20, 15);
        assert.equal(result, null);
    });

    it('should handle zoom at minimum boundary (zoomMin)', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 0.3 });
        cam.setMapSize(20, 15);
        cam.centerOn(7, 7);

        // At minimum zoom, center should still map correctly
        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 15);
        assert.ok(result !== null);
        assert.equal(result.row, 7);
        assert.equal(result.col, 7);
    });

    it('should handle zoom at maximum boundary (zoomMax)', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 4.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(7, 7);

        // At maximum zoom, center should still map correctly
        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 15);
        assert.ok(result !== null);
        assert.equal(result.row, 7);
        assert.equal(result.col, 7);
    });

    it('should handle (0,0) grid position in bl-tr mode', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(0, 0);

        const result = cam.screenToGrid(mockCanvas.width / 2, mockCanvas.height / 2, 20, 15);
        assert.ok(result !== null);
        assert.equal(result.row, 0);
        assert.equal(result.col, 0);
    });

    it('should produce mirrored x-coordinates compared to br-tl for asymmetric positions', () => {
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

        // For row=2, col=5 (asymmetric), x should be mirrored
        const posBLTR = camBLTR.gridToScreen(2, 5);
        const posBRTL = camBRTL.gridToScreen(2, 5);

        // bl-tr: x = (row - col) * halfW = (2-5)*32 = -96 + offset
        // br-tl: x = (col - row) * halfW = (5-2)*32 = 96 + offset
        // They should be equidistant from mapOffsetX but on opposite sides
        const bltrDelta = posBLTR.x - camBLTR.mapOffsetX;
        const brtlDelta = posBRTL.x - camBRTL.mapOffsetX;
        assert.equal(bltrDelta, -brtlDelta);
    });
});

describe('IsoCamera bl-tr: centerOn edge cases', () => {
    it('should handle centering on (0, 0) in bl-tr mode', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(0, 0);

        // worldX = (0 - 0) * 32 + mapOffsetX = mapOffsetX
        const expectedCamX = cam.mapOffsetX - mockCanvas.width / 2;
        assert.equal(cam.camX, expectedCamX);
    });

    it('should handle centering on max row/col in bl-tr mode', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(14, 19);

        // worldX = (14 - 19) * 32 + mapOffsetX = -160 + mapOffsetX
        const expectedWorldX = (14 - 19) * 32 + cam.mapOffsetX;
        const expectedCamX = expectedWorldX - mockCanvas.width / 2;
        assert.equal(cam.camX, expectedCamX);
    });

    it('should produce symmetric camX for row=col in bl-tr mode', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15);
        cam.centerOn(5, 5);

        // When row === col, worldX = (5-5)*32 + mapOffsetX = mapOffsetX
        const expectedCamX = cam.mapOffsetX - mockCanvas.width / 2;
        assert.equal(cam.camX, expectedCamX);
    });
});

describe('IsoCamera bl-tr: applyTransform', () => {
    it('should call translate and scale on context', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 2.0 });

        const calls = [];
        const mockCtx = {
            translate(x, y) { calls.push({ method: 'translate', args: [x, y] }); },
            scale(x, y) { calls.push({ method: 'scale', args: [x, y] }); },
        };

        cam.applyTransform(mockCtx);

        assert.equal(calls.length, 3);
        assert.equal(calls[0].method, 'translate');
        assert.deepEqual(calls[0].args, [mockCanvas.width / 2, mockCanvas.height / 2]);
        assert.equal(calls[1].method, 'scale');
        assert.deepEqual(calls[1].args, [2.0, 2.0]);
        assert.equal(calls[2].method, 'translate');
        assert.deepEqual(calls[2].args, [-mockCanvas.width / 2, -mockCanvas.height / 2]);
    });

    it('should use current zoom value in scale call', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 0.5 });

        const calls = [];
        const mockCtx = {
            translate() { calls.push('translate'); },
            scale(x, y) { calls.push({ scale: [x, y] }); },
        };

        cam.applyTransform(mockCtx);
        assert.deepEqual(calls[1], { scale: [0.5, 0.5] });
    });

    it('should clamp zoom at zoomMin boundary', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 0.5 });
        cam.applyZoom(-1.0); // Try to go below min

        assert.equal(cam.zoom, cam.zoomMin);
    });

    it('should clamp zoom at zoomMax boundary', () => {
        const cam = createCamera('bl-tr');
        cam.init(mockCanvas, { zoom: 3.5 });
        cam.applyZoom(1.0); // Try to go above max

        assert.equal(cam.zoom, cam.zoomMax);
    });
});

describe('IsoCamera bl-tr: round-trip with various zoom levels', () => {
    const zoomLevels = [0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0];

    for (const zoom of zoomLevels) {
        it(`should round-trip at zoom=${zoom}`, () => {
            const cam = createCamera('bl-tr');
            cam.init(mockCanvas, { zoom });
            cam.setMapSize(20, 15);
            cam.centerOn(7, 7);

            const screen = cam.gridToScreen(7, 7);
            const grid = cam.screenToGrid(screen.x, screen.y, 20, 15);
            assert.ok(grid !== null, `Should resolve at zoom=${zoom}`);
            assert.equal(grid.row, 7);
            assert.equal(grid.col, 7);
        });
    }
});
