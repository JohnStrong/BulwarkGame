/**
 * Property 1: Transparent Background Invariant
 *
 * For any generated castle structure overlay sprite buffer (any of the 18
 * structure types — walls, towers, keeps, gatehouse, and bridge surfaces),
 * every pixel that lies outside the drawn structure's vertical body SHALL
 * have alpha = 0.
 *
 * // Feature: castle-structure-overlays, Property 1: Transparent background invariant
 *
 * **Validates: Requirements 10.1**
 */
'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const {
    generateCastleOverlay,
    OVERLAY_WIDTH,
} = require('../js/level-generators/generate-iso-sprites-br-tl');

/**
 * The 18 castle overlay sprite configurations as defined in the spec.
 *
 * Canvas height per structure category:
 *   wall / bridge-*  → 48 px
 *   tower / keep-*   → 64 px
 *   gatehouse        → 80 px
 */
const OVERLAY_CONFIGS = [
    // Walls (64×48)
    { name: 'castle-wall-overlay',                structureType: 'wall',         damaged: false, height: 48 },
    { name: 'castle-wall-damaged-overlay',        structureType: 'wall',         damaged: true,  height: 48 },
    // Towers (64×64)
    { name: 'castle-tower-overlay',               structureType: 'tower',        damaged: false, height: 64 },
    { name: 'castle-tower-damaged-overlay',       structureType: 'tower',        damaged: true,  height: 64 },
    // Keep quadrants (64×64)
    { name: 'castle-keep-tl-overlay',             structureType: 'keep-tl',      damaged: false, height: 64 },
    { name: 'castle-keep-tl-damaged-overlay',     structureType: 'keep-tl',      damaged: true,  height: 64 },
    { name: 'castle-keep-bl-overlay',             structureType: 'keep-bl',      damaged: false, height: 64 },
    { name: 'castle-keep-bl-damaged-overlay',     structureType: 'keep-bl',      damaged: true,  height: 64 },
    { name: 'castle-keep-br-overlay',             structureType: 'keep-br',      damaged: false, height: 64 },
    { name: 'castle-keep-br-damaged-overlay',     structureType: 'keep-br',      damaged: true,  height: 64 },
    { name: 'castle-keep-center-overlay',         structureType: 'keep-center',  damaged: false, height: 64 },
    { name: 'castle-keep-center-damaged-overlay', structureType: 'keep-center',  damaged: true,  height: 64 },
    // Gatehouse (64×80)
    { name: 'castle-gatehouse-overlay',           structureType: 'gatehouse',    damaged: false, height: 80 },
    { name: 'castle-gatehouse-damaged-overlay',   structureType: 'gatehouse',    damaged: true,  height: 80 },
    // Bridge surfaces (64×48) — no damaged variants
    { name: 'bridge-mm-overlay',                  structureType: 'bridge-mm',    damaged: false, height: 48 },
    { name: 'castle-bridge-start-overlay',        structureType: 'bridge-start', damaged: false, height: 48 },
    { name: 'castle-bridge-mid-overlay',          structureType: 'bridge-mid',   damaged: false, height: 48 },
    { name: 'castle-bridge-gate-overlay',         structureType: 'bridge-gate',  damaged: false, height: 48 },
];

/**
 * Returns the alpha value of the pixel at (x, y) in a width×height RGBA buffer.
 */
function getAlpha(buffer, width, x, y) {
    const index = (y * width + x) * 4 + 3;
    return buffer[index];
}

describe('Property 1: Transparent Background Invariant — Castle Structure Overlays', () => {
    // Generate all 18 overlay buffers once before the tests run.
    // Each buffer is the reference: pixels with alpha=0 are "outside the
    // structure region" and must remain alpha=0.
    let overlayBuffers;

    before(() => {
        overlayBuffers = OVERLAY_CONFIGS.map(({ name, structureType, damaged, height }) => ({
            name,
            height,
            buffer: generateCastleOverlay(structureType, damaged),
        }));
    });

    it('for every overlay buffer, pixels outside the structure region (alpha=0) have alpha=0', () => {
        for (const { name, height, buffer } of overlayBuffers) {
            // Arbitrary: random (x, y) coordinates within this buffer's canvas bounds
            const coordArb = fc.record({
                x: fc.integer({ min: 0, max: OVERLAY_WIDTH - 1 }),
                y: fc.integer({ min: 0, max: height - 1 }),
            });

            fc.assert(
                fc.property(coordArb, ({ x, y }) => {
                    const alpha = getAlpha(buffer, OVERLAY_WIDTH, x, y);

                    // The invariant: if alpha is 0 in the reference buffer, it must
                    // be 0 (i.e., outside the structure region stays transparent).
                    if (alpha === 0) {
                        assert.strictEqual(
                            alpha,
                            0,
                            `Sprite "${name}": pixel at (${x}, ${y}) is outside the structure ` +
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

    it('all 18 overlay buffers have the correct byte length for their canvas dimensions', () => {
        for (const { name, height, buffer } of overlayBuffers) {
            const expectedLength = OVERLAY_WIDTH * height * 4;
            assert.strictEqual(
                buffer.length,
                expectedLength,
                `Sprite "${name}" buffer length is ${buffer.length}, ` +
                `expected ${expectedLength} (${OVERLAY_WIDTH}×${height}×4)`
            );
        }
    });

    it('every pixel in every overlay buffer has alpha exactly 0 or 255 (no semi-transparent pixels)', () => {
        for (const { name, height, buffer } of overlayBuffers) {
            const totalPixels = OVERLAY_WIDTH * height;
            const pixelIndexArb = fc.integer({ min: 0, max: totalPixels - 1 });

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
