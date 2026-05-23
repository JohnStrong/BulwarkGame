/**
 * Property 13: Integer Pixel Alignment
 *
 * For any draw call made by the Sprite_Renderer, the x and y coordinates
 * passed to the underlying rendering API SHALL be integer values (equivalent
 * to applying Math.floor to any fractional input).
 *
 * Feature: enhanced-pixel-art-sprites, Property 13: Integer Pixel Alignment
 *
 * **Validates: Requirements 5.2**
 */
'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

/**
 * Load a fresh copy of pixi-renderer, bypassing the module cache to avoid
 * state leakage between property runs.
 */
function freshPixiRenderer() {
    const modulePath = require.resolve('../js/game-logic/pixi-renderer');
    delete require.cache[modulePath];
    return require('../js/game-logic/pixi-renderer');
}

describe('Property 13: Integer Pixel Alignment', () => {
    it('drawSprite floors fractional x and y coordinates before passing to SpriteManager', () => {
        fc.assert(
            fc.property(
                // Generate arbitrary floating-point x and y coordinates
                fc.float({ min: -1000, max: 1000, noNaN: true }),
                fc.float({ min: -1000, max: 1000, noNaN: true }),
                (x, y) => {
                    // Load a fresh module instance to avoid state leakage
                    const { drawSprite, _reset } = freshPixiRenderer();

                    // Force canvas2d mode so drawSprite delegates to SpriteManager
                    _reset();

                    // Capture the coordinates passed to SpriteManager.draw
                    let capturedX = null;
                    let capturedY = null;

                    global.SpriteManager = {
                        draw: (ctx, name, ix, iy, width, height) => {
                            capturedX = ix;
                            capturedY = iy;
                        },
                    };

                    try {
                        drawSprite(null, 'test-sprite', x, y, 64, 32, 'ground');

                        // SpriteManager.draw must have been called
                        assert.notStrictEqual(capturedX, null, 'SpriteManager.draw was not called');
                        assert.notStrictEqual(capturedY, null, 'SpriteManager.draw was not called');

                        const expectedX = Math.floor(x);
                        const expectedY = Math.floor(y);

                        // Coordinates must be integers
                        assert.strictEqual(
                            Number.isInteger(capturedX),
                            true,
                            `x coordinate ${capturedX} is not an integer (input was ${x})`
                        );
                        assert.strictEqual(
                            Number.isInteger(capturedY),
                            true,
                            `y coordinate ${capturedY} is not an integer (input was ${y})`
                        );

                        // Coordinates must equal Math.floor of the input
                        assert.strictEqual(
                            capturedX,
                            expectedX,
                            `x: expected Math.floor(${x}) = ${expectedX}, got ${capturedX}`
                        );
                        assert.strictEqual(
                            capturedY,
                            expectedY,
                            `y: expected Math.floor(${y}) = ${expectedY}, got ${capturedY}`
                        );
                    } finally {
                        // Clean up global stub
                        delete global.SpriteManager;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('drawSprite floors integer x and y coordinates unchanged', () => {
        fc.assert(
            fc.property(
                // Integer inputs should pass through unchanged
                fc.integer({ min: -1000, max: 1000 }),
                fc.integer({ min: -1000, max: 1000 }),
                (x, y) => {
                    const { drawSprite, _reset } = freshPixiRenderer();
                    _reset();

                    let capturedX = null;
                    let capturedY = null;

                    global.SpriteManager = {
                        draw: (ctx, name, ix, iy) => {
                            capturedX = ix;
                            capturedY = iy;
                        },
                    };

                    try {
                        drawSprite(null, 'test-sprite', x, y, 64, 32, 'ground');

                        assert.strictEqual(capturedX, x, `Integer x ${x} should pass through unchanged, got ${capturedX}`);
                        assert.strictEqual(capturedY, y, `Integer y ${y} should pass through unchanged, got ${capturedY}`);
                    } finally {
                        delete global.SpriteManager;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
