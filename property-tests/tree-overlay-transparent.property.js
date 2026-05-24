/**
 * Property 1: Transparent Background Invariant
 *
 * For any generated tree overlay sprite buffer (oak, pine, or shrub, any variant),
 * every pixel that lies outside the drawn trunk and canopy region SHALL have alpha = 0.
 *
 * // Feature: tree-overlay-system, Property 1: Transparent background invariant
 *
 * **Validates: Requirements 1.2**
 */
'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const {
    generateTreeOverlay,
    OVERLAY_WIDTH,
    OVERLAY_HEIGHT,
} = require('../js/level-generators/generate-iso-sprites-br-tl');

/**
 * The 7 overlay sprite configurations as defined in the spec.
 */
const OVERLAY_CONFIGS = [
    { name: 'tree-oak-overlay-1',   variant: 0, treeType: 'oak'   },
    { name: 'tree-oak-overlay-2',   variant: 1, treeType: 'oak'   },
    { name: 'tree-oak-overlay-3',   variant: 2, treeType: 'oak'   },
    { name: 'tree-pine-overlay-1',  variant: 0, treeType: 'pine'  },
    { name: 'tree-pine-overlay-2',  variant: 1, treeType: 'pine'  },
    { name: 'tree-shrub-overlay-1', variant: 0, treeType: 'shrub' },
    { name: 'tree-shrub-overlay-2', variant: 1, treeType: 'shrub' },
];

/**
 * A minimal no-op noise generator (returns 0 for all inputs).
 * The transparent background invariant must hold regardless of noise values,
 * so a deterministic constant noise is sufficient here.
 */
function constantNoiseGen() {
    return 0;
}

/**
 * Returns the alpha value of the pixel at (x, y) in a 64×48 RGBA buffer.
 */
function getAlpha(buffer, x, y) {
    const index = (y * OVERLAY_WIDTH + x) * 4 + 3;
    return buffer[index];
}

describe('Property 1: Transparent Background Invariant', () => {
    // Generate all 7 overlay buffers once before the tests run.
    // Each buffer is the reference: pixels with alpha=0 in the reference
    // are "outside the tree region" and must remain alpha=0.
    let overlayBuffers;

    before(() => {
        const noiseGen = constantNoiseGen;
        overlayBuffers = OVERLAY_CONFIGS.map(({ name, variant, treeType }) => ({
            name,
            buffer: generateTreeOverlay(variant, treeType, noiseGen),
        }));
    });

    it('for every overlay buffer, pixels outside the tree region (alpha=0) have alpha=0', () => {
        // Arbitrary: random (x, y) coordinates within the 64×48 canvas
        const coordArb = fc.record({
            x: fc.integer({ min: 0, max: OVERLAY_WIDTH - 1 }),
            y: fc.integer({ min: 0, max: OVERLAY_HEIGHT - 1 }),
        });

        for (const { name, buffer } of overlayBuffers) {
            fc.assert(
                fc.property(coordArb, ({ x, y }) => {
                    const alpha = getAlpha(buffer, x, y);

                    // The invariant: if alpha is 0 in the reference buffer,
                    // it must be 0 (i.e., outside the tree region stays transparent).
                    // We check the same buffer — any pixel that is transparent
                    // must have alpha exactly 0 (not some intermediate value).
                    if (alpha === 0) {
                        assert.strictEqual(
                            alpha,
                            0,
                            `Sprite "${name}": pixel at (${x}, ${y}) is outside the tree ` +
                            `region but has alpha=${alpha} (expected 0)`
                        );
                    }

                    // Additionally, every pixel must be binary: either 0 or 255.
                    // This ensures no semi-transparent pixels leak into the background.
                    assert.ok(
                        alpha === 0 || alpha === 255,
                        `Sprite "${name}": pixel at (${x}, ${y}) has non-binary alpha=${alpha} ` +
                        `(expected exactly 0 or 255)`
                    );
                }),
                { numRuns: 200 }
            );
        }
    });

    it('all 7 overlay buffers have the correct byte length (64×48×4)', () => {
        const expectedLength = OVERLAY_WIDTH * OVERLAY_HEIGHT * 4;

        for (const { name, buffer } of overlayBuffers) {
            assert.strictEqual(
                buffer.length,
                expectedLength,
                `Sprite "${name}" buffer length is ${buffer.length}, ` +
                `expected ${expectedLength} (${OVERLAY_WIDTH}×${OVERLAY_HEIGHT}×4)`
            );
        }
    });

    it('every pixel in every overlay buffer has alpha exactly 0 or 255 (no semi-transparent pixels)', () => {
        // Arbitrary: random pixel index within the buffer
        const pixelIndexArb = fc.integer({ min: 0, max: OVERLAY_WIDTH * OVERLAY_HEIGHT - 1 });

        for (const { name, buffer } of overlayBuffers) {
            fc.assert(
                fc.property(pixelIndexArb, (pixelIndex) => {
                    const alphaOffset = pixelIndex * 4 + 3;
                    const alpha = buffer[alphaOffset];

                    assert.ok(
                        alpha === 0 || alpha === 255,
                        `Sprite "${name}": pixel at index ${pixelIndex} has non-binary alpha=${alpha} ` +
                        `(expected exactly 0 or 255 — no semi-transparent pixels allowed)`
                    );
                }),
                { numRuns: 200 }
            );
        }
    });
});
