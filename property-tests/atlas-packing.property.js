/**
 * Property 10: Atlas Non-Overlapping Packing
 *
 * For any generated sprite atlas metadata, no two sprite frame rectangles
 * SHALL overlap (intersection area = 0), and the minimum distance between
 * any two adjacent frame edges SHALL be at least 1 pixel.
 *
 * Feature: enhanced-pixel-art-sprites, Property 10: Atlas Non-Overlapping Packing
 *
 * **Validates: Requirements 4.1**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { packAtlas } = require('../js/level-generators/lib/atlas-packer');

/**
 * Generates a valid sprite entry for the atlas packer.
 * Constrains dimensions to reasonable sizes that fit within atlas limits.
 */
const spriteArb = (index) =>
  fc.record({
    name: fc.constant(`sprite-${index}`),
    width: fc.integer({ min: 8, max: 128 }),
    height: fc.integer({ min: 8, max: 128 }),
  }).map(({ name, width, height }) => ({
    name,
    width,
    height,
    buffer: Buffer.alloc(width * height * 4, 128),
  }));

/**
 * Generates a list of 2–20 unique sprites with valid dimensions.
 */
const spritesArb = fc.integer({ min: 2, max: 20 }).chain((count) =>
  fc.tuple(...Array.from({ length: count }, (_, i) => spriteArb(i)))
);

/**
 * Checks whether two rectangles overlap (intersection area > 0).
 */
function rectanglesOverlap(a, b) {
  const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return overlapX > 0 && overlapY > 0;
}

/**
 * Computes the minimum edge distance between two non-overlapping rectangles.
 * Returns Infinity if they don't share an axis-aligned adjacency.
 */
function minEdgeDistance(a, b) {
  // Horizontal gap (if they are separated horizontally)
  const hGap = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  // Vertical gap (if they are separated vertically)
  const vGap = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));

  // If separated on both axes, the distance is the Chebyshev-like gap
  if (hGap > 0 && vGap > 0) {
    return Math.min(hGap, vGap);
  }
  // If separated on one axis only, that's the gap
  if (hGap > 0) return hGap;
  if (vGap > 0) return vGap;
  // They touch or overlap (overlap should not happen per the first check)
  return 0;
}

describe('Property 10: Atlas Non-Overlapping Packing', () => {
  it('no two sprite frame rectangles shall overlap and minimum 1-pixel padding between adjacent frames', () => {
    fc.assert(
      fc.property(spritesArb, (sprites) => {
        const { metadata } = packAtlas(sprites);
        const frameEntries = Object.entries(metadata.frames);

        // Check all pairs of frames for overlap and minimum distance
        for (let i = 0; i < frameEntries.length; i++) {
          for (let j = i + 1; j < frameEntries.length; j++) {
            const [nameA, dataA] = frameEntries[i];
            const [nameB, dataB] = frameEntries[j];

            // Only compare frames on the same atlas page
            if (dataA.atlasIndex !== dataB.atlasIndex) continue;

            const rectA = { x: dataA.frame.x, y: dataA.frame.y, w: dataA.frame.w, h: dataA.frame.h };
            const rectB = { x: dataB.frame.x, y: dataB.frame.y, w: dataB.frame.w, h: dataB.frame.h };

            // No overlap
            assert.strictEqual(
              rectanglesOverlap(rectA, rectB),
              false,
              `Frames "${nameA}" and "${nameB}" overlap on atlas ${dataA.atlasIndex}`
            );

            // Minimum 1-pixel distance between adjacent frames
            const dist = minEdgeDistance(rectA, rectB);
            assert.ok(
              dist >= 1,
              `Frames "${nameA}" and "${nameB}" have edge distance ${dist} (minimum 1 required) on atlas ${dataA.atlasIndex}`
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
