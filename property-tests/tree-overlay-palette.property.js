/**
 * Property 2: Palette fidelity of overlay pixels
 *
 * For any generated tree overlay buffer, every opaque pixel (alpha=255) SHALL
 * have RGB values within ±15 per channel of at least one color in PRIMARY_PALETTE
 * after the quantization pass.
 *
 * // Feature: tree-overlay-system, Property 2: Palette fidelity of overlay pixels
 *
 * **Validates: Requirements 1.4**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

const {
    generateTreeOverlay,
    OVERLAY_WIDTH,
    OVERLAY_HEIGHT,
} = require('../js/level-generators/generate-iso-sprites-br-tl');
const { PRIMARY_PALETTE } = require('../js/level-generators/lib/palette');
const { createTerrainNoiseGenerator } = require('../js/level-generators/lib/noise-texture');

/** Tolerance per channel (±15) as specified in the design document. */
const CHANNEL_TOLERANCE = 15;

/**
 * Returns true if the given [r, g, b] is within ±CHANNEL_TOLERANCE of at
 * least one color in PRIMARY_PALETTE.
 */
function isWithinPaletteTolerance(r, g, b) {
    for (const [pr, pg, pb] of PRIMARY_PALETTE) {
        if (
            Math.abs(r - pr) <= CHANNEL_TOLERANCE &&
            Math.abs(g - pg) <= CHANNEL_TOLERANCE &&
            Math.abs(b - pb) <= CHANNEL_TOLERANCE
        ) {
            return true;
        }
    }
    return false;
}

/**
 * The 7 overlay variants as (variant, treeType) pairs, matching generateAll().
 */
const OVERLAY_VARIANTS = [
    { variant: 0, treeType: 'oak',   name: 'tree-oak-overlay-1' },
    { variant: 1, treeType: 'oak',   name: 'tree-oak-overlay-2' },
    { variant: 2, treeType: 'oak',   name: 'tree-oak-overlay-3' },
    { variant: 0, treeType: 'pine',  name: 'tree-pine-overlay-1' },
    { variant: 1, treeType: 'pine',  name: 'tree-pine-overlay-2' },
    { variant: 0, treeType: 'shrub', name: 'tree-shrub-overlay-1' },
    { variant: 1, treeType: 'shrub', name: 'tree-shrub-overlay-2' },
];

const TOTAL_PIXELS = OVERLAY_WIDTH * OVERLAY_HEIGHT;

describe('Property 2: Palette fidelity of overlay pixels', () => {
    it('every opaque pixel (alpha=255) in each overlay buffer is within ±15 per channel of a PRIMARY_PALETTE color', async () => {
        // Build all 7 overlay buffers once (deterministic, seeded generator)
        const noiseGen = await createTerrainNoiseGenerator(168);
        const overlayBuffers = OVERLAY_VARIANTS.map(({ variant, treeType, name }) => ({
            name,
            buffer: generateTreeOverlay(variant, treeType, noiseGen),
        }));

        // For each overlay buffer, use fast-check to generate random pixel indices
        // and assert palette fidelity for any opaque pixel.
        for (const { name, buffer } of overlayBuffers) {
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: TOTAL_PIXELS - 1 }),
                    (pixelIndex) => {
                        const offset = pixelIndex * 4;
                        const alpha = buffer[offset + 3];

                        // Only opaque pixels are subject to palette fidelity
                        if (alpha !== 255) return true;

                        const r = buffer[offset];
                        const g = buffer[offset + 1];
                        const b = buffer[offset + 2];

                        assert.ok(
                            isWithinPaletteTolerance(r, g, b),
                            `Overlay "${name}" pixel at index ${pixelIndex} has color ` +
                            `[${r}, ${g}, ${b}] which is not within ±${CHANNEL_TOLERANCE} ` +
                            `of any PRIMARY_PALETTE color`
                        );

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        }
    });

    it('palette fidelity holds across all pixel indices for each overlay variant', async () => {
        // Exhaustive check: scan every pixel in every overlay buffer to confirm
        // the property holds universally (not just for sampled indices).
        const noiseGen = await createTerrainNoiseGenerator(168);

        for (const { variant, treeType, name } of OVERLAY_VARIANTS) {
            const buffer = generateTreeOverlay(variant, treeType, noiseGen);

            for (let i = 0; i < TOTAL_PIXELS; i++) {
                const offset = i * 4;
                const alpha = buffer[offset + 3];

                if (alpha !== 255) continue;

                const r = buffer[offset];
                const g = buffer[offset + 1];
                const b = buffer[offset + 2];

                assert.ok(
                    isWithinPaletteTolerance(r, g, b),
                    `Overlay "${name}" pixel at index ${i} (x=${i % OVERLAY_WIDTH}, y=${Math.floor(i / OVERLAY_WIDTH)}) ` +
                    `has color [${r}, ${g}, ${b}] which is not within ±${CHANNEL_TOLERANCE} ` +
                    `of any PRIMARY_PALETTE color`
                );
            }
        }
    });
});
