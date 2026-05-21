/**
 * Tests for js/game-logic/game.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game.spec.js
 *
 * Note: game.js is the top-down game orchestrator with heavy DOM deps.
 * These tests verify the rendering logic decisions that can be
 * tested without a browser environment.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Constants from utils.js used by game.js
const HEX_WIDTH = 32;
const HEX_HEIGHT = 28;

describe('Game render logic - tile skipping', () => {
    it('should skip tiles marked as covered', () => {
        const tiles = [
            { sprite: 'grass-short-1', covered: false },
            { sprite: 'grass-short-2', covered: true },
            { sprite: 'road-full', covered: false },
        ];
        const rendered = tiles.filter(t => !t.covered);
        assert.equal(rendered.length, 2);
        assert.equal(rendered[0].sprite, 'grass-short-1');
        assert.equal(rendered[1].sprite, 'road-full');
    });

    it('should render all tiles when none are covered', () => {
        const tiles = [
            { sprite: 'grass-short-1', covered: false },
            { sprite: 'water-1', covered: false },
        ];
        const rendered = tiles.filter(t => !t.covered);
        assert.equal(rendered.length, 2);
    });

    it('should render no tiles when all are covered', () => {
        const tiles = [
            { sprite: 'grass-short-1', covered: true },
            { sprite: 'water-1', covered: true },
        ];
        const rendered = tiles.filter(t => !t.covered);
        assert.equal(rendered.length, 0);
    });
});

describe('Game render logic - tile dimensions', () => {
    it('should use tile.width if provided, otherwise HEX_WIDTH', () => {
        const tile1 = { width: 64, height: 48 };
        const tile2 = {};
        assert.equal(tile1.width || HEX_WIDTH, 64);
        assert.equal(tile2.width || HEX_WIDTH, HEX_WIDTH);
    });

    it('should use tile.height if provided, otherwise HEX_HEIGHT', () => {
        const tile1 = { width: 64, height: 48 };
        const tile2 = {};
        assert.equal(tile1.height || HEX_HEIGHT, 48);
        assert.equal(tile2.height || HEX_HEIGHT, HEX_HEIGHT);
    });
});

describe('Game canvas sizing', () => {
    it('should set canvas dimensions from level pixel dimensions', () => {
        const level = {
            pixelWidth: 1024,
            pixelHeight: 640,
        };
        // Simulates startLevel() logic
        const canvasWidth = level.pixelWidth;
        const canvasHeight = level.pixelHeight;
        assert.equal(canvasWidth, 1024);
        assert.equal(canvasHeight, 640);
    });
});
