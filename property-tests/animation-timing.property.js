/**
 * Property 14: Animation Frame Rate Independence
 *
 * For any configured animation interval in the range [100, 2000] milliseconds,
 * animated sprites SHALL advance frames at the configured interval regardless
 * of the game's rendering frame rate, and all sprites of the same type SHALL
 * display the same frame index at any given time.
 *
 * Feature: enhanced-pixel-art-sprites, Property 14: Animation Frame Rate Independence
 *
 * **Validates: Requirements 5.3, 7.5**
 */
'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const AnimationController = require('../js/game-logic/animation-controller');

afterEach(() => {
    AnimationController.reset();
});

/**
 * Arbitrary for valid animation intervals within the documented range [100, 2000].
 */
const intervalArb = fc.integer({
    min: AnimationController.MIN_INTERVAL_MS,
    max: AnimationController.MAX_INTERVAL_MS,
});

/**
 * Arbitrary for frame counts (2–10 frames is a realistic range for animated sprites).
 */
const frameCountArb = fc.integer({ min: 2, max: 10 });

/**
 * Arbitrary for sprite type names — non-empty alphanumeric strings.
 */
const spriteTypeArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/);

/**
 * Returns a Promise that resolves after `ms` milliseconds.
 */
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Property 14: Animation Frame Rate Independence', () => {

    it('frames advance at the configured interval (timer-driven, not render-driven)', async () => {
        // Use a short fixed interval so the test completes quickly.
        // We register with 100ms, wait ~150ms, and expect exactly 1 advance.
        await fc.assert(
            fc.asyncProperty(frameCountArb, spriteTypeArb, async (frameCount, spriteType) => {
                AnimationController.reset();

                const intervalMs = 100; // Use minimum interval for speed
                AnimationController.registerAnimatedType(spriteType, frameCount, intervalMs);

                // Frame should start at 0
                const frameBefore = AnimationController.getCurrentFrame(spriteType);
                assert.strictEqual(frameBefore, 0, 'Frame should start at 0');

                // Wait 1.5× the interval — exactly one tick should have fired
                await delay(Math.round(intervalMs * 1.5));

                const frameAfter = AnimationController.getCurrentFrame(spriteType);
                assert.strictEqual(
                    frameAfter,
                    1 % frameCount,
                    `After ${intervalMs * 1.5}ms with interval=${intervalMs}ms, ` +
                    `expected frame 1 (mod ${frameCount}), got ${frameAfter}`
                );

                AnimationController.reset();
            }),
            { numRuns: 10 } // Fewer runs because each run takes ~150ms
        );
    });

    it('all calls to getCurrentFrame for the same type return the same value (shared timer)', () => {
        fc.assert(
            fc.property(frameCountArb, intervalArb, spriteTypeArb, (frameCount, intervalMs, spriteType) => {
                AnimationController.reset();
                AnimationController.registerAnimatedType(spriteType, frameCount, intervalMs);

                // Multiple reads at the same instant must return the same frame index
                const reads = Array.from({ length: 10 }, () =>
                    AnimationController.getCurrentFrame(spriteType)
                );

                const allSame = reads.every((v) => v === reads[0]);
                assert.ok(
                    allSame,
                    `Expected all concurrent reads to return the same frame index, got: [${reads.join(', ')}]`
                );

                AnimationController.reset();
            }),
            { numRuns: 100 }
        );
    });

    it('interval clamping invariant: values outside [100, 2000] are clamped, not rejected', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.integer({ min: -1000, max: 99 }),   // below minimum
                    fc.integer({ min: 2001, max: 10000 })  // above maximum
                ),
                frameCountArb,
                spriteTypeArb,
                (outOfRangeInterval, frameCount, spriteType) => {
                    AnimationController.reset();

                    // Must not throw — out-of-range values are clamped
                    assert.doesNotThrow(() => {
                        AnimationController.registerAnimatedType(spriteType, frameCount, outOfRangeInterval);
                    }, `registerAnimatedType should not throw for interval=${outOfRangeInterval}`);

                    // After clamping, the type must be registered and return a valid frame
                    assert.ok(
                        AnimationController.isRegistered(spriteType),
                        `Sprite type '${spriteType}' should be registered after clamped registration`
                    );

                    const frame = AnimationController.getCurrentFrame(spriteType);
                    assert.ok(
                        frame >= 0 && frame < frameCount,
                        `Frame index ${frame} should be in [0, ${frameCount - 1}]`
                    );

                    AnimationController.reset();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('frame index always stays within [0, frameCount - 1] after multiple ticks', async () => {
        await fc.assert(
            fc.asyncProperty(frameCountArb, spriteTypeArb, async (frameCount, spriteType) => {
                AnimationController.reset();

                const intervalMs = 100;
                AnimationController.registerAnimatedType(spriteType, frameCount, intervalMs);

                // Wait for several ticks to ensure wrapping is handled correctly
                const ticks = frameCount + 2; // enough to wrap around at least once
                await delay(intervalMs * ticks + Math.round(intervalMs * 0.5));

                const frame = AnimationController.getCurrentFrame(spriteType);
                assert.ok(
                    frame >= 0 && frame < frameCount,
                    `Frame index ${frame} must be in [0, ${frameCount - 1}] after ${ticks} ticks`
                );

                AnimationController.reset();
            }),
            { numRuns: 8 } // Fewer runs; each run can take up to ~1.2s for frameCount=10
        );
    });

});
