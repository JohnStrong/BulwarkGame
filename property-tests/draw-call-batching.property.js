/**
 * Property 18: Draw Call Batching Bound
 *
 * For any visible tile set rendered by the Runtime_Renderer, the number of
 * draw calls issued per tile layer (ground, structure, unit, overlay) SHALL
 * not exceed 10.
 *
 * Feature: enhanced-pixel-art-sprites, Property 18: Draw Call Batching Bound
 *
 * **Validates: Requirements 7.4**
 */
'use strict';

const { describe, it } = require('node:test');
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

/** The four tile layers defined by the renderer. */
const LAYERS = ['ground', 'structure', 'unit', 'overlay'];

describe('Property 18: Draw Call Batching Bound', () => {
    it('trackDrawCall returns false once the 10-call budget is exceeded for any layer', () => {
        fc.assert(
            fc.property(
                // Generate a tile count between 1 and 50 for a single layer
                fc.integer({ min: 1, max: 50 }),
                fc.constantFrom(...LAYERS),
                (tileCount, layer) => {
                    const { trackDrawCall, resetDrawCallCounters, getDrawCallCount, MAX_DRAW_CALLS_PER_LAYER } = freshPixiRenderer();

                    resetDrawCallCounters();

                    const results = [];
                    for (let i = 0; i < tileCount; i++) {
                        results.push(trackDrawCall(layer));
                    }

                    // The first MAX_DRAW_CALLS_PER_LAYER calls must return true
                    const expectedTrueCount = Math.min(tileCount, MAX_DRAW_CALLS_PER_LAYER);
                    for (let i = 0; i < expectedTrueCount; i++) {
                        assert.strictEqual(
                            results[i],
                            true,
                            `Call ${i + 1} for layer "${layer}" should be within budget (returned ${results[i]})`
                        );
                    }

                    // Any calls beyond the budget must return false
                    for (let i = MAX_DRAW_CALLS_PER_LAYER; i < tileCount; i++) {
                        assert.strictEqual(
                            results[i],
                            false,
                            `Call ${i + 1} for layer "${layer}" should exceed budget (returned ${results[i]})`
                        );
                    }

                    // The counter must reflect actual accepted calls (capped at MAX_DRAW_CALLS_PER_LAYER)
                    const finalCount = getDrawCallCount(layer);
                    const expectedCount = Math.min(tileCount, MAX_DRAW_CALLS_PER_LAYER);
                    assert.strictEqual(
                        finalCount,
                        expectedCount,
                        `Draw call count for "${layer}" should be ${expectedCount} (min(${tileCount}, ${MAX_DRAW_CALLS_PER_LAYER})), got ${finalCount}`
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it('each layer is tracked independently — exceeding budget on one layer does not affect others', () => {
        fc.assert(
            fc.property(
                // Generate tile counts for all four layers independently
                fc.integer({ min: 1, max: 50 }),
                fc.integer({ min: 1, max: 50 }),
                fc.integer({ min: 1, max: 50 }),
                fc.integer({ min: 1, max: 50 }),
                (groundCount, structureCount, unitCount, overlayCount) => {
                    const { trackDrawCall, resetDrawCallCounters, getDrawCallCount, MAX_DRAW_CALLS_PER_LAYER } = freshPixiRenderer();

                    resetDrawCallCounters();

                    const counts = {
                        ground: groundCount,
                        structure: structureCount,
                        unit: unitCount,
                        overlay: overlayCount,
                    };

                    // Issue draw calls for each layer
                    for (const layer of LAYERS) {
                        for (let i = 0; i < counts[layer]; i++) {
                            trackDrawCall(layer);
                        }
                    }

                    // Each layer's counter must be independently capped
                    for (const layer of LAYERS) {
                        const expected = Math.min(counts[layer], MAX_DRAW_CALLS_PER_LAYER);
                        const actual = getDrawCallCount(layer);
                        assert.strictEqual(
                            actual,
                            expected,
                            `Layer "${layer}": expected count ${expected} (from ${counts[layer]} calls), got ${actual}`
                        );
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('resetDrawCallCounters resets all layer counters to zero', () => {
        fc.assert(
            fc.property(
                // Generate tile counts that will exceed the budget on all layers
                fc.integer({ min: 11, max: 50 }),
                (tileCount) => {
                    const { trackDrawCall, resetDrawCallCounters, getDrawCallCount } = freshPixiRenderer();

                    // Fill all layers past the budget
                    for (const layer of LAYERS) {
                        for (let i = 0; i < tileCount; i++) {
                            trackDrawCall(layer);
                        }
                    }

                    // Reset counters
                    resetDrawCallCounters();

                    // All counters must be zero after reset
                    for (const layer of LAYERS) {
                        const count = getDrawCallCount(layer);
                        assert.strictEqual(
                            count,
                            0,
                            `Layer "${layer}" counter should be 0 after reset, got ${count}`
                        );
                    }

                    // After reset, the first call on each layer must be within budget again
                    for (const layer of LAYERS) {
                        const result = trackDrawCall(layer);
                        assert.strictEqual(
                            result,
                            true,
                            `First call after reset on layer "${layer}" should be within budget`
                        );
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
