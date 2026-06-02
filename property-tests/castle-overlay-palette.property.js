/**
 * Property 2: Palette fidelity of overlay pixels
 *
 * For any generated castle structure overlay buffer, every pixel with alpha > 0
 * SHALL have RGB values within ±15 per channel of at least one color in
 * getPaletteForCategory('castle') (PRIMARY_PALETTE + CASTLE_ACCENT_COLORS,
 * which includes BORDER_COLOR) after the quantization pass.
 *
 * // Feature: castle-structure-overlays, Property 2: Palette fidelity of overlay pixels
 *
 * **Validates: Requirements 10.2**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

const { generateCastleOverlay } = require('../js/level-generators/generate-iso-sprites-br-tl');
const { getPaletteForCategory } = require('../js/level-generators/lib/palette');

/** Tolerance per channel (±15) as specified in the design document. */
const CHANNEL_TOLERANCE = 15;

/**
 * The full castle quantization palette: PRIMARY_PALETTE + CASTLE_ACCENT_COLORS.
 * This is exactly the palette used by the quantizeToPalette pass in the generator,
 * and it includes BORDER_COLOR (the dark edge outline color).
 */
const CASTLE_PALETTE = getPaletteForCategory('castle');

/**
 * Returns true if the given [r, g, b] is within ±CHANNEL_TOLERANCE of at
 * least one color in CASTLE_PALETTE.
 */
function isWithinPaletteTolerance(r, g, b) {
    for (const [pr, pg, pb] of CASTLE_PALETTE) {
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
 * All 18 overlay variants as (structureType, damaged, name) tuples,
 * matching the CASTLE_OVERLAY_SPRITE_DEFS in generate-castle-overlay-sprites.js.
 */
const OVERLAY_VARIANTS = [
    // Walls (64×48)
    { structureType: 'wall',         damaged: false, name: 'castle-wall-overlay' },
    { structureType: 'wall',         damaged: true,  name: 'castle-wall-damaged-overlay' },
    // Towers (64×64)
    { structureType: 'tower',        damaged: false, name: 'castle-tower-overlay' },
    { structureType: 'tower',        damaged: true,  name: 'castle-tower-damaged-overlay' },
    // Keep quadrants (64×64)
    { structureType: 'keep-tl',      damaged: false, name: 'castle-keep-tl-overlay' },
    { structureType: 'keep-tl',      damaged: true,  name: 'castle-keep-tl-damaged-overlay' },
    { structureType: 'keep-bl',      damaged: false, name: 'castle-keep-bl-overlay' },
    { structureType: 'keep-bl',      damaged: true,  name: 'castle-keep-bl-damaged-overlay' },
    { structureType: 'keep-br',      damaged: false, name: 'castle-keep-br-overlay' },
    { structureType: 'keep-br',      damaged: true,  name: 'castle-keep-br-damaged-overlay' },
    { structureType: 'keep-center',  damaged: false, name: 'castle-keep-center-overlay' },
    { structureType: 'keep-center',  damaged: true,  name: 'castle-keep-center-damaged-overlay' },
    // Gatehouse (64×80)
    { structureType: 'gatehouse',    damaged: false, name: 'castle-gatehouse-overlay' },
    { structureType: 'gatehouse',    damaged: true,  name: 'castle-gatehouse-damaged-overlay' },
    // Bridge surfaces (64×48) — no damaged variants
    { structureType: 'bridge-mm',    damaged: false, name: 'bridge-mm-overlay' },
    { structureType: 'bridge-start', damaged: false, name: 'castle-bridge-start-overlay' },
    { structureType: 'bridge-mid',   damaged: false, name: 'castle-bridge-mid-overlay' },
    { structureType: 'bridge-gate',  damaged: false, name: 'castle-bridge-gate-overlay' },
];

describe('Property 2: Palette fidelity of overlay pixels', () => {
    it('every pixel with alpha > 0 in each castle overlay buffer is within ±15 per channel of a CASTLE_COLORS color', () => {
        // Build all 18 overlay buffers once (deterministic, no external seed needed)
        const overlayBuffers = OVERLAY_VARIANTS.map(({ structureType, damaged, name }) => ({
            name,
            buffer: generateCastleOverlay(structureType, damaged),
        }));

        // For each overlay buffer, use fast-check to generate random pixel indices
        // and assert palette fidelity for any pixel with alpha > 0.
        for (const { name, buffer } of overlayBuffers) {
            const numPixels = buffer.length / 4;

            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: numPixels - 1 }),
                    (pixelIndex) => {
                        const offset = pixelIndex * 4;
                        const alpha = buffer[offset + 3];

                        // Only pixels with alpha > 0 are subject to palette fidelity
                        if (alpha === 0) return true;

                        const r = buffer[offset];
                        const g = buffer[offset + 1];
                        const b = buffer[offset + 2];

                        assert.ok(
                            isWithinPaletteTolerance(r, g, b),
                            `Overlay "${name}" pixel at index ${pixelIndex} has color ` +
                            `[${r}, ${g}, ${b}] (alpha=${alpha}) which is not within ±${CHANNEL_TOLERANCE} ` +
                            `of any CASTLE_COLORS entry`
                        );

                        return true;
                    }
                ),
                { numRuns: 200 }
            );
        }
    });

    it('palette fidelity holds across all pixel indices for each castle overlay variant', () => {
        // Exhaustive check: scan every pixel in every overlay buffer to confirm
        // the property holds universally (not just for sampled indices).
        for (const { structureType, damaged, name } of OVERLAY_VARIANTS) {
            const buffer = generateCastleOverlay(structureType, damaged);
            const numPixels = buffer.length / 4;

            for (let i = 0; i < numPixels; i++) {
                const offset = i * 4;
                const alpha = buffer[offset + 3];

                if (alpha === 0) continue;

                const r = buffer[offset];
                const g = buffer[offset + 1];
                const b = buffer[offset + 2];

                const width = 64;
                assert.ok(
                    isWithinPaletteTolerance(r, g, b),
                    `Overlay "${name}" pixel at index ${i} (x=${i % width}, y=${Math.floor(i / width)}) ` +
                    `has color [${r}, ${g}, ${b}] (alpha=${alpha}) which is not within ±${CHANNEL_TOLERANCE} ` +
                    `of any CASTLE_COLORS entry`
                );
            }
        }
    });
});
