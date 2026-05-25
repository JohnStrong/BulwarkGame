/**
 * Tests for IsoCamera.centerOn interaction with setMapSize.
 *
 * Recommendation 8: Test IsoCamera.centerOn with setMapSize interaction.
 * Validates that camX/camY match the expected formula after calling
 * setMapSize then centerOn.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-camera-center-on-map-size.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Replicate IsoCamera for testing (no DOM deps)
function createCamera() {
    return {
        tileW: 64,
        tileH: 32,
        camX: 0,
        camY: 0,
        zoom: 1.0,
        zoomMin: 0.3,
        zoomMax: 4.0,
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
    };
}

const mockCanvas = { width: 1024, height: 768 };

describe('IsoCamera.centerOn with setMapSize interaction', () => {
    it('should produce correct camX after setMapSize then centerOn (br-tl)', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });

        const mapWidth = 20;
        const mapHeight = 15;
        cam.setMapSize(mapWidth, mapHeight);

        const row = 5;
        const col = 7;
        cam.centerOn(row, col);

        // Expected formula (br-tl viewpoint):
        // mapOffsetX = height * (tileW/2) + (tileW/2) = 15 * 32 + 32 = 512
        // worldX = (col - row) * halfW + mapOffsetX = (7 - 5) * 32 + 512 = 576
        // camX = worldX - canvas.width / 2 = 576 - 512 = 64
        const halfW = cam.tileW / 2;
        const expectedCamX = (col - row) * halfW + cam.mapOffsetX - mockCanvas.width / 2;
        assert.equal(cam.camX, expectedCamX, `camX should be ${expectedCamX}, got ${cam.camX}`);
    });

    it('should produce correct camY after setMapSize then centerOn', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });

        const mapWidth = 20;
        const mapHeight = 15;
        cam.setMapSize(mapWidth, mapHeight);

        const row = 5;
        const col = 7;
        cam.centerOn(row, col);

        // Expected formula:
        // mapOffsetY = (tileH/2) * 2 = 32
        // worldY = (col + row) * halfH + mapOffsetY = (7 + 5) * 16 + 32 = 224
        // camY = worldY - canvas.height / 2 = 224 - 384 = -160
        const halfH = cam.tileH / 2;
        const expectedCamY = (col + row) * halfH + cam.mapOffsetY - mockCanvas.height / 2;
        assert.equal(cam.camY, expectedCamY, `camY should be ${expectedCamY}, got ${cam.camY}`);
    });

    it('should use non-zero mapOffsetX from setMapSize in camX calculation', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });

        // Without setMapSize, mapOffsetX = 0
        cam.centerOn(0, 0);
        const camXWithoutOffset = cam.camX;

        // With setMapSize, mapOffsetX > 0
        cam.setMapSize(20, 15);
        cam.centerOn(0, 0);
        const camXWithOffset = cam.camX;

        assert.notEqual(
            camXWithOffset,
            camXWithoutOffset,
            'camX should differ when mapOffsetX is set by setMapSize'
        );
        // mapOffsetX = 15 * 32 + 32 = 512, so camX should be 512 - 512 = 0
        assert.equal(camXWithOffset, cam.mapOffsetX - mockCanvas.width / 2);
    });

    it('should use non-zero mapOffsetY from setMapSize in camY calculation', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });

        // Without setMapSize, mapOffsetY = 0
        cam.centerOn(0, 0);
        const camYWithoutOffset = cam.camY;

        // With setMapSize, mapOffsetY = 32
        cam.setMapSize(20, 15);
        cam.centerOn(0, 0);
        const camYWithOffset = cam.camY;

        assert.notEqual(
            camYWithOffset,
            camYWithoutOffset,
            'camY should differ when mapOffsetY is set by setMapSize'
        );
        // mapOffsetY = 32, worldY = 0 + 32 = 32, camY = 32 - 384 = -352
        assert.equal(camYWithOffset, cam.mapOffsetY - mockCanvas.height / 2);
    });

    it('should produce correct camX for bl-tr viewpoint after setMapSize', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.viewpoint = 'bl-tr';

        cam.setMapSize(20, 15);

        const row = 3;
        const col = 8;
        cam.centerOn(row, col);

        // bl-tr formula: worldX = (row - col) * halfW + mapOffsetX
        const halfW = cam.tileW / 2;
        const expectedCamX = (row - col) * halfW + cam.mapOffsetX - mockCanvas.width / 2;
        assert.equal(cam.camX, expectedCamX, `bl-tr camX should be ${expectedCamX}, got ${cam.camX}`);
    });

    it('should produce correct camX for different map sizes', () => {
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });

        // Small map
        cam.setMapSize(5, 5);
        const smallMapOffsetX = cam.mapOffsetX; // 5 * 32 + 32 = 192

        cam.centerOn(2, 2);
        const halfW = cam.tileW / 2;
        const expectedCamX = (2 - 2) * halfW + smallMapOffsetX - mockCanvas.width / 2;
        assert.equal(cam.camX, expectedCamX);

        // Large map
        cam.setMapSize(50, 40);
        const largeMapOffsetX = cam.mapOffsetX; // 40 * 32 + 32 = 1312

        cam.centerOn(10, 10);
        const expectedCamXLarge = (10 - 10) * halfW + largeMapOffsetX - mockCanvas.width / 2;
        assert.equal(cam.camX, expectedCamXLarge);
    });

    it('should produce camX = 0 when centering on origin of a map where mapOffsetX = canvas.width/2', () => {
        // mapOffsetX = height * (tileW/2) + (tileW/2) = canvas.width/2
        // For canvas.width=1024, tileW=64: height * 32 + 32 = 512 → height = 15
        const cam = createCamera();
        cam.init(mockCanvas, { zoom: 1.0 });
        cam.setMapSize(20, 15); // mapOffsetX = 15*32+32 = 512 = canvas.width/2

        cam.centerOn(0, 0);
        // worldX = (0 - 0) * 32 + 512 = 512
        // camX = 512 - 512 = 0
        assert.equal(cam.camX, 0);
    });

    it('should work correctly with different canvas sizes', () => {
        const smallCanvas = { width: 800, height: 600 };
        const cam = createCamera();
        cam.init(smallCanvas, { zoom: 1.0 });

        cam.setMapSize(20, 15);
        const row = 5;
        const col = 5;
        cam.centerOn(row, col);

        const halfW = cam.tileW / 2;
        const halfH = cam.tileH / 2;
        const expectedCamX = (col - row) * halfW + cam.mapOffsetX - smallCanvas.width / 2;
        const expectedCamY = (col + row) * halfH + cam.mapOffsetY - smallCanvas.height / 2;

        assert.equal(cam.camX, expectedCamX);
        assert.equal(cam.camY, expectedCamY);
    });
});
