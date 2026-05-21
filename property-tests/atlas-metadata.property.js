/**
 * Property 11: Atlas Metadata Completeness
 *
 * For any generated atlas JSON metadata, every sprite entry SHALL contain
 * the fields: name (non-empty string), x (non-negative integer), y (non-negative
 * integer), width (positive integer), and height (positive integer).
 *
 * Feature: enhanced-pixel-art-sprites, Property 11: Atlas Metadata Completeness
 *
 * **Validates: Requirements 4.2**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { packAtlas } = require('../js/level-generators/lib/atlas-packer');

/**
 * Generates a valid sprite entry for the atlas packer.
 */
const spriteArb = (index) =>
  fc.record({
    width: fc.integer({ min: 8, max: 128 }),
    height: fc.integer({ min: 8, max: 128 }),
  }).map(({ width, height }) => ({
    name: `test-sprite-${index}`,
    width,
    height,
    buffer: Buffer.alloc(width * height * 4, 64),
  }));

/**
 * Generates a list of 1–15 unique sprites.
 */
const spritesArb = fc.integer({ min: 1, max: 15 }).chain((count) =>
  fc.tuple(...Array.from({ length: count }, (_, i) => spriteArb(i)))
);

/**
 * Generates sprites with animation frames to test multi-frame metadata.
 */
const animatedSpriteArb = (index) =>
  fc.record({
    width: fc.integer({ min: 16, max: 64 }),
    height: fc.integer({ min: 16, max: 64 }),
    frames: fc.integer({ min: 2, max: 5 }),
  }).map(({ width, height, frames }) => ({
    name: `animated-${index}`,
    width,
    height,
    frames,
    buffer: Buffer.alloc(width * height * frames * 4, 100),
  }));

/**
 * Generates a mixed list of static and animated sprites.
 */
const mixedSpritesArb = fc.integer({ min: 1, max: 8 }).chain((staticCount) =>
  fc.integer({ min: 0, max: 4 }).chain((animCount) =>
    fc.tuple(
      ...Array.from({ length: staticCount }, (_, i) => spriteArb(i)),
      ...Array.from({ length: animCount }, (_, i) => animatedSpriteArb(staticCount + i))
    )
  )
);

describe('Property 11: Atlas Metadata Completeness', () => {
  it('every sprite entry shall contain name, x, y, width, and height with correct types', () => {
    fc.assert(
      fc.property(spritesArb, (sprites) => {
        const { metadata } = packAtlas(sprites);

        // Every frame entry must have the required fields
        for (const [name, entry] of Object.entries(metadata.frames)) {
          // name is a non-empty string (the key itself)
          assert.strictEqual(typeof name, 'string', 'Frame name must be a string');
          assert.ok(name.length > 0, 'Frame name must be non-empty');

          // x is a non-negative integer
          assert.strictEqual(typeof entry.frame.x, 'number', `Frame "${name}" x must be a number`);
          assert.ok(Number.isInteger(entry.frame.x), `Frame "${name}" x must be an integer`);
          assert.ok(entry.frame.x >= 0, `Frame "${name}" x must be non-negative, got ${entry.frame.x}`);

          // y is a non-negative integer
          assert.strictEqual(typeof entry.frame.y, 'number', `Frame "${name}" y must be a number`);
          assert.ok(Number.isInteger(entry.frame.y), `Frame "${name}" y must be an integer`);
          assert.ok(entry.frame.y >= 0, `Frame "${name}" y must be non-negative, got ${entry.frame.y}`);

          // width is a positive integer
          assert.strictEqual(typeof entry.frame.w, 'number', `Frame "${name}" width must be a number`);
          assert.ok(Number.isInteger(entry.frame.w), `Frame "${name}" width must be an integer`);
          assert.ok(entry.frame.w > 0, `Frame "${name}" width must be positive, got ${entry.frame.w}`);

          // height is a positive integer
          assert.strictEqual(typeof entry.frame.h, 'number', `Frame "${name}" height must be a number`);
          assert.ok(Number.isInteger(entry.frame.h), `Frame "${name}" height must be an integer`);
          assert.ok(entry.frame.h > 0, `Frame "${name}" height must be positive, got ${entry.frame.h}`);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('animated sprites produce complete metadata for all frames', () => {
    fc.assert(
      fc.property(mixedSpritesArb, (sprites) => {
        const { metadata } = packAtlas(sprites);

        // Every frame entry must have the required fields
        for (const [name, entry] of Object.entries(metadata.frames)) {
          assert.strictEqual(typeof name, 'string');
          assert.ok(name.length > 0);
          assert.ok(Number.isInteger(entry.frame.x) && entry.frame.x >= 0);
          assert.ok(Number.isInteger(entry.frame.y) && entry.frame.y >= 0);
          assert.ok(Number.isInteger(entry.frame.w) && entry.frame.w > 0);
          assert.ok(Number.isInteger(entry.frame.h) && entry.frame.h > 0);
        }

        // Animated sprites should have entries in the animations section
        for (const sprite of sprites) {
          if (sprite.frames && sprite.frames > 1) {
            assert.ok(
              metadata.animations[sprite.name],
              `Animated sprite "${sprite.name}" should have an animations entry`
            );
            assert.strictEqual(
              metadata.animations[sprite.name].length,
              sprite.frames,
              `Animated sprite "${sprite.name}" should have ${sprite.frames} frame references`
            );
            // Each animation frame reference should exist in frames
            for (const frameName of metadata.animations[sprite.name]) {
              assert.ok(
                metadata.frames[frameName],
                `Animation frame "${frameName}" should exist in metadata.frames`
              );
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
