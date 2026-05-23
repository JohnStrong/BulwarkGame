/**
 * Unit tests for js/game-logic/animation-controller.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/animation-controller.spec.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const AnimationController = require('../../js/game-logic/animation-controller');

// Reset state between tests to avoid timer/state leakage
beforeEach(() => {
    AnimationController.reset();
});

afterEach(() => {
    AnimationController.reset();
});

// ---------------------------------------------------------------------------
// registerAnimatedType
// ---------------------------------------------------------------------------

describe('AnimationController.registerAnimatedType', () => {
    it('should register a sprite type so isRegistered returns true', () => {
        AnimationController.registerAnimatedType('water', 4);
        assert.ok(AnimationController.isRegistered('water'));
    });

    it('should start currentFrame at 0 after registration', () => {
        AnimationController.registerAnimatedType('water', 4);
        assert.equal(AnimationController.getCurrentFrame('water'), 0);
    });

    it('should use default interval of 500ms when not specified', () => {
        // We cannot directly inspect the interval, but we can verify the type registers
        // without error and starts at frame 0.
        AnimationController.registerAnimatedType('flag', 3);
        assert.equal(AnimationController.getCurrentFrame('flag'), 0);
    });

    it('should clamp interval below 100ms to 100ms', (t) => {
        // Capture console.warn to verify the warning is emitted
        const warnings = [];
        const origWarn = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));

        AnimationController.registerAnimatedType('water', 4, 50);

        console.warn = origWarn;

        // Should still register successfully
        assert.ok(AnimationController.isRegistered('water'));
        // Should have emitted a warning
        assert.ok(warnings.length > 0, 'Expected a clamping warning');
        assert.ok(warnings[0].includes('50'), 'Warning should mention original value');
        assert.ok(warnings[0].includes('100'), 'Warning should mention clamped value');
    });

    it('should clamp interval above 2000ms to 2000ms', () => {
        const warnings = [];
        const origWarn = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));

        AnimationController.registerAnimatedType('water', 4, 9999);

        console.warn = origWarn;

        assert.ok(AnimationController.isRegistered('water'));
        assert.ok(warnings.length > 0, 'Expected a clamping warning');
        assert.ok(warnings[0].includes('9999'), 'Warning should mention original value');
        assert.ok(warnings[0].includes('2000'), 'Warning should mention clamped value');
    });

    it('should not warn when interval is exactly at the lower bound (100ms)', () => {
        const warnings = [];
        const origWarn = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));

        AnimationController.registerAnimatedType('water', 4, 100);

        console.warn = origWarn;
        assert.equal(warnings.length, 0, 'No warning expected for valid interval');
    });

    it('should not warn when interval is exactly at the upper bound (2000ms)', () => {
        const warnings = [];
        const origWarn = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));

        AnimationController.registerAnimatedType('water', 4, 2000);

        console.warn = origWarn;
        assert.equal(warnings.length, 0, 'No warning expected for valid interval');
    });

    it('should replace an existing registration without leaking timers', () => {
        AnimationController.registerAnimatedType('water', 4, 500);
        // Re-register with different frame count — should not throw
        AnimationController.registerAnimatedType('water', 6, 300);
        assert.ok(AnimationController.isRegistered('water'));
        assert.equal(AnimationController.getCurrentFrame('water'), 0);
    });

    it('should support multiple independent sprite types', () => {
        AnimationController.registerAnimatedType('water', 4);
        AnimationController.registerAnimatedType('flag', 3);
        assert.ok(AnimationController.isRegistered('water'));
        assert.ok(AnimationController.isRegistered('flag'));
    });
});

// ---------------------------------------------------------------------------
// getCurrentFrame
// ---------------------------------------------------------------------------

describe('AnimationController.getCurrentFrame', () => {
    it('should return 0 for an unregistered sprite type', () => {
        assert.equal(AnimationController.getCurrentFrame('nonexistent'), 0);
    });

    it('should return 0 immediately after registration', () => {
        AnimationController.registerAnimatedType('water', 4);
        assert.equal(AnimationController.getCurrentFrame('water'), 0);
    });

    it('should advance frame after the configured interval elapses', async () => {
        // Use a short interval so the test completes quickly
        AnimationController.registerAnimatedType('water', 4, 100);

        // Wait slightly longer than one interval
        await new Promise((resolve) => setTimeout(resolve, 150));

        const frame = AnimationController.getCurrentFrame('water');
        assert.equal(frame, 1, `Expected frame 1 after one interval, got ${frame}`);
    });

    it('should wrap frame index back to 0 after the last frame', async () => {
        // 2 frames, 100ms interval — after 2 ticks we should be back at 0
        AnimationController.registerAnimatedType('water', 2, 100);

        await new Promise((resolve) => setTimeout(resolve, 250));

        const frame = AnimationController.getCurrentFrame('water');
        assert.equal(frame, 0, `Expected frame 0 after wrapping, got ${frame}`);
    });

    it('should keep independent frame counters for different sprite types', async () => {
        // Register two types with different frame counts
        AnimationController.registerAnimatedType('water', 4, 100);
        AnimationController.registerAnimatedType('flag', 3, 100);

        await new Promise((resolve) => setTimeout(resolve, 150));

        // Both should have advanced to frame 1 independently
        assert.equal(AnimationController.getCurrentFrame('water'), 1);
        assert.equal(AnimationController.getCurrentFrame('flag'), 1);
    });

    it('all calls to getCurrentFrame for the same type return the same value (shared timer)', async () => {
        AnimationController.registerAnimatedType('water', 4, 100);

        await new Promise((resolve) => setTimeout(resolve, 150));

        const frame1 = AnimationController.getCurrentFrame('water');
        const frame2 = AnimationController.getCurrentFrame('water');
        assert.equal(frame1, frame2, 'All sprites of the same type must share the same frame');
    });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe('AnimationController.reset', () => {
    it('should clear all registrations', () => {
        AnimationController.registerAnimatedType('water', 4);
        AnimationController.registerAnimatedType('flag', 3);
        AnimationController.reset();
        assert.equal(AnimationController.isRegistered('water'), false);
        assert.equal(AnimationController.isRegistered('flag'), false);
    });

    it('should return 0 for any type after reset', () => {
        AnimationController.registerAnimatedType('water', 4);
        AnimationController.reset();
        assert.equal(AnimationController.getCurrentFrame('water'), 0);
    });
});

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

describe('AnimationController constants', () => {
    it('should export MIN_INTERVAL_MS as 100', () => {
        assert.equal(AnimationController.MIN_INTERVAL_MS, 100);
    });

    it('should export MAX_INTERVAL_MS as 2000', () => {
        assert.equal(AnimationController.MAX_INTERVAL_MS, 2000);
    });

    it('should export DEFAULT_INTERVAL_MS as 500', () => {
        assert.equal(AnimationController.DEFAULT_INTERVAL_MS, 500);
    });
});
