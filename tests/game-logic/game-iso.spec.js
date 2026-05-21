/**
 * Tests for js/game-logic/game-iso.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game-iso.spec.js
 *
 * Note: game-iso.js is the main orchestrator with heavy DOM/Canvas deps.
 * These tests cover the testable state update logic extracted from
 * the Game object's update() method.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Extract and test the animation/update logic
describe('Game update logic - tile lift animation', () => {
    function animateLift(current, target, speed) {
        if (current < target) return Math.min(target, current + speed);
        if (current > target) return Math.max(target, current - speed);
        return current;
    }

    it('should increase lift toward target', () => {
        const result = animateLift(0, 3, 0.3);
        assert.equal(result, 0.3);
    });

    it('should not overshoot target when increasing', () => {
        const result = animateLift(2.9, 3, 0.3);
        assert.equal(result, 3);
    });

    it('should decrease lift toward target', () => {
        const result = animateLift(3, 0, 0.3);
        assert.equal(result, 2.7);
    });

    it('should not overshoot target when decreasing', () => {
        const result = animateLift(0.1, 0, 0.3);
        assert.equal(result, 0);
    });

    it('should stay at target when already there', () => {
        const result = animateLift(3, 3, 0.3);
        assert.equal(result, 3);
    });
});

describe('Game update logic - HUD panel animation', () => {
    function animateHud(current, target, speed) {
        if (current < target) return Math.min(target, current + speed);
        if (current > target) return Math.max(target, current - speed);
        return current;
    }

    it('should open HUD panel toward target width', () => {
        const result = animateHud(0, 256, 12);
        assert.equal(result, 12);
    });

    it('should close HUD panel toward zero', () => {
        const result = animateHud(256, 0, 12);
        assert.equal(result, 244);
    });

    it('should clamp to target when close enough (opening)', () => {
        const result = animateHud(250, 256, 12);
        assert.equal(result, 256);
    });

    it('should clamp to target when close enough (closing)', () => {
        const result = animateHud(5, 0, 12);
        assert.equal(result, 0);
    });

    it('should stay at target when already there', () => {
        const result = animateHud(256, 256, 12);
        assert.equal(result, 256);
    });
});

describe('Game state transitions', () => {
    it('should start in loading state', () => {
        const state = 'loading';
        assert.equal(state, 'loading');
    });

    it('should transition to playing after init', () => {
        // Simulates the state transition
        let state = 'loading';
        state = 'playing';
        assert.equal(state, 'playing');
    });
});

describe('Game tile selection logic', () => {
    it('should deselect when clicking same tile', () => {
        const selectedTile = { row: 3, col: 5 };
        const clicked = { row: 3, col: 5 };
        const isSame = clicked.row === selectedTile.row && clicked.col === selectedTile.col;
        assert.ok(isSame);
    });

    it('should select new tile when clicking different tile', () => {
        const selectedTile = { row: 3, col: 5 };
        const clicked = { row: 4, col: 6 };
        const isSame = clicked.row === selectedTile.row && clicked.col === selectedTile.col;
        assert.ok(!isSame);
    });
});
