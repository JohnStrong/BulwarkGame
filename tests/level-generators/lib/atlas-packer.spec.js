/**
 * Unit tests for the atlas-packer module.
 *
 * Tests cover:
 * - Basic packing of sprites into a single atlas
 * - Power-of-two output dimensions
 * - Auto-split into multiple atlas files when exceeding 2048px
 * - JSON metadata structure (frame name, x, y, width, height, atlasIndex)
 * - Animations section mapping sprite types to frame name arrays
 * - Error: empty sprite name
 * - Error: duplicate sprite name
 * - Error: JSON serialization failure
 * - Non-overlapping frame placement with 1-pixel padding
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { packAtlas } = require('../../../js/level-generators/lib/atlas-packer.js');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSprite(name, width = 64, height = 32, frames) {
  const frameCount = frames || 1;
  const buffer = Buffer.alloc(width * height * 4 * frameCount);
  // Fill with non-zero data so we can verify composition
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 100;     // R
    buffer[i + 1] = 150; // G
    buffer[i + 2] = 200; // B
    buffer[i + 3] = 255; // A
  }
  const sprite = { name, buffer, width, height };
  if (frames) sprite.frames = frames;
  return sprite;
}

const VALID_POWER_OF_TWO = [256, 512, 1024, 2048];

function isPowerOfTwo(n) {
  return VALID_POWER_OF_TWO.includes(n);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('atlas-packer', () => {
  describe('packAtlas - basic packing', () => {
    it('packs a single sprite into an atlas', () => {
      const sprites = [makeSprite('grass-1')];
      const result = packAtlas(sprites);

      assert.equal(result.atlases.length, 1);
      assert.ok(result.metadata);
      assert.ok(result.metadata.frames['grass-1']);
    });

    it('packs multiple sprites into a single atlas', () => {
      const sprites = [
        makeSprite('grass-1'),
        makeSprite('grass-2'),
        makeSprite('road-1'),
      ];
      const result = packAtlas(sprites);

      assert.equal(result.atlases.length, 1);
      assert.equal(Object.keys(result.metadata.frames).length, 3);
      assert.ok(result.metadata.frames['grass-1']);
      assert.ok(result.metadata.frames['grass-2']);
      assert.ok(result.metadata.frames['road-1']);
    });

    it('expands multi-frame sprites into individual frame entries', () => {
      const sprites = [makeSprite('water-1', 64, 32, 3)];
      const result = packAtlas(sprites);

      assert.ok(result.metadata.frames['water-1-frame-0']);
      assert.ok(result.metadata.frames['water-1-frame-1']);
      assert.ok(result.metadata.frames['water-1-frame-2']);
      assert.equal(Object.keys(result.metadata.frames).length, 3);
    });
  });

  describe('packAtlas - power-of-two dimensions', () => {
    it('outputs atlas with power-of-two width and height', () => {
      const sprites = [makeSprite('s1'), makeSprite('s2')];
      const result = packAtlas(sprites);

      const { w, h } = result.metadata.meta.size;
      assert.ok(isPowerOfTwo(w), `Width ${w} is not power-of-two`);
      assert.ok(isPowerOfTwo(h), `Height ${h} is not power-of-two`);
    });

    it('uses smallest power-of-two that fits the content', () => {
      // Single 64x32 sprite should fit in 256x256
      const sprites = [makeSprite('tiny')];
      const result = packAtlas(sprites);

      const { w, h } = result.metadata.meta.size;
      assert.equal(w, 256);
      assert.equal(h, 256);
    });

    it('scales up dimensions for larger sprite sets', () => {
      // Many sprites should require larger atlas
      const sprites = [];
      for (let i = 0; i < 30; i++) {
        sprites.push(makeSprite(`sprite-${i}`));
      }
      const result = packAtlas(sprites);

      const { w, h } = result.metadata.meta.size;
      assert.ok(isPowerOfTwo(w));
      assert.ok(isPowerOfTwo(h));
      assert.ok(w >= 256);
      assert.ok(h >= 256);
    });
  });

  describe('packAtlas - auto-split into multiple atlases', () => {
    it('splits into multiple atlas files when exceeding 2048px', () => {
      // Create enough large sprites to exceed a single 2048x2048 atlas
      const sprites = [];
      for (let i = 0; i < 100; i++) {
        sprites.push(makeSprite(`big-${i}`, 256, 256));
      }
      const result = packAtlas(sprites);

      assert.ok(result.atlases.length > 1, `Expected multiple atlases, got ${result.atlases.length}`);
    });

    it('assigns correct atlasIndex to frames across multiple atlases', () => {
      const sprites = [];
      for (let i = 0; i < 100; i++) {
        sprites.push(makeSprite(`big-${i}`, 256, 256));
      }
      const result = packAtlas(sprites);

      const indices = new Set();
      for (const frame of Object.values(result.metadata.frames)) {
        indices.add(frame.atlasIndex);
        assert.equal(typeof frame.atlasIndex, 'number');
        assert.ok(frame.atlasIndex >= 0);
        assert.ok(frame.atlasIndex < result.atlases.length);
      }
      // Should have frames in multiple atlases
      assert.ok(indices.size > 1);
    });

    it('all frames are accounted for across atlas pages', () => {
      const sprites = [];
      for (let i = 0; i < 100; i++) {
        sprites.push(makeSprite(`big-${i}`, 256, 256));
      }
      const result = packAtlas(sprites);

      assert.equal(Object.keys(result.metadata.frames).length, 100);
    });
  });

  describe('packAtlas - JSON metadata structure', () => {
    it('includes meta section with version, image, size, and format', () => {
      const sprites = [makeSprite('test-sprite')];
      const result = packAtlas(sprites);

      assert.equal(result.metadata.meta.version, '1.0');
      assert.equal(result.metadata.meta.image, 'atlas-0.png');
      assert.equal(result.metadata.meta.format, 'RGBA8888');
      assert.ok(result.metadata.meta.size);
      assert.equal(typeof result.metadata.meta.size.w, 'number');
      assert.equal(typeof result.metadata.meta.size.h, 'number');
    });

    it('each frame has x, y, w, h in frame object', () => {
      const sprites = [makeSprite('s1'), makeSprite('s2')];
      const result = packAtlas(sprites);

      for (const [name, data] of Object.entries(result.metadata.frames)) {
        assert.ok(data.frame, `Frame ${name} missing frame object`);
        assert.equal(typeof data.frame.x, 'number', `Frame ${name} missing x`);
        assert.equal(typeof data.frame.y, 'number', `Frame ${name} missing y`);
        assert.equal(typeof data.frame.w, 'number', `Frame ${name} missing w`);
        assert.equal(typeof data.frame.h, 'number', `Frame ${name} missing h`);
        assert.ok(data.frame.x >= 0);
        assert.ok(data.frame.y >= 0);
        assert.ok(data.frame.w > 0);
        assert.ok(data.frame.h > 0);
      }
    });

    it('each frame has sourceSize with w and h', () => {
      const sprites = [makeSprite('s1', 64, 32)];
      const result = packAtlas(sprites);

      const frame = result.metadata.frames['s1'];
      assert.ok(frame.sourceSize);
      assert.equal(frame.sourceSize.w, 64);
      assert.equal(frame.sourceSize.h, 32);
    });

    it('each frame has atlasIndex field', () => {
      const sprites = [makeSprite('s1'), makeSprite('s2')];
      const result = packAtlas(sprites);

      for (const [name, data] of Object.entries(result.metadata.frames)) {
        assert.equal(typeof data.atlasIndex, 'number', `Frame ${name} missing atlasIndex`);
      }
    });

    it('frame dimensions match input sprite dimensions', () => {
      const sprites = [
        makeSprite('small', 32, 16),
        makeSprite('large', 128, 64),
      ];
      const result = packAtlas(sprites);

      assert.equal(result.metadata.frames['small'].frame.w, 32);
      assert.equal(result.metadata.frames['small'].frame.h, 16);
      assert.equal(result.metadata.frames['large'].frame.w, 128);
      assert.equal(result.metadata.frames['large'].frame.h, 64);
    });
  });

  describe('packAtlas - animations section', () => {
    it('maps multi-frame sprites to frame name arrays', () => {
      const sprites = [makeSprite('water-1', 64, 32, 4)];
      const result = packAtlas(sprites);

      assert.ok(result.metadata.animations);
      assert.ok(result.metadata.animations['water-1']);
      assert.deepEqual(result.metadata.animations['water-1'], [
        'water-1-frame-0',
        'water-1-frame-1',
        'water-1-frame-2',
        'water-1-frame-3',
      ]);
    });

    it('does not include single-frame sprites in animations', () => {
      const sprites = [
        makeSprite('grass-1'),
        makeSprite('water-1', 64, 32, 3),
      ];
      const result = packAtlas(sprites);

      assert.ok(!result.metadata.animations['grass-1']);
      assert.ok(result.metadata.animations['water-1']);
    });

    it('handles multiple animated sprites', () => {
      const sprites = [
        makeSprite('water-1', 64, 32, 3),
        makeSprite('flag-1', 64, 32, 4),
      ];
      const result = packAtlas(sprites);

      assert.equal(result.metadata.animations['water-1'].length, 3);
      assert.equal(result.metadata.animations['flag-1'].length, 4);
    });
  });

  describe('packAtlas - non-overlapping with 1-pixel padding', () => {
    it('no two frames overlap within the same atlas', () => {
      const sprites = [];
      for (let i = 0; i < 20; i++) {
        sprites.push(makeSprite(`s-${i}`));
      }
      const result = packAtlas(sprites);
      const frames = Object.values(result.metadata.frames);

      for (let i = 0; i < frames.length; i++) {
        for (let j = i + 1; j < frames.length; j++) {
          if (frames[i].atlasIndex !== frames[j].atlasIndex) continue;
          const a = frames[i].frame;
          const b = frames[j].frame;
          const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
          const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
          assert.ok(
            !(overlapX && overlapY),
            `Frames overlap: ${JSON.stringify(a)} and ${JSON.stringify(b)}`
          );
        }
      }
    });

    it('maintains at least 1-pixel gap between adjacent frames', () => {
      const sprites = [];
      for (let i = 0; i < 10; i++) {
        sprites.push(makeSprite(`s-${i}`));
      }
      const result = packAtlas(sprites);
      const frames = Object.entries(result.metadata.frames);

      // For frames on the same shelf (same y), check horizontal gap
      for (let i = 0; i < frames.length; i++) {
        for (let j = i + 1; j < frames.length; j++) {
          const [nameA, dataA] = frames[i];
          const [nameB, dataB] = frames[j];
          if (dataA.atlasIndex !== dataB.atlasIndex) continue;

          const a = dataA.frame;
          const b = dataB.frame;

          // Check if they're on the same row (overlapping y ranges)
          const sameRow = a.y < b.y + b.h && a.y + a.h > b.y;
          if (!sameRow) continue;

          // If on same row, the gap between them should be >= 1
          if (a.x + a.w <= b.x) {
            const gap = b.x - (a.x + a.w);
            assert.ok(gap >= 1, `Gap between ${nameA} and ${nameB} is ${gap}, expected >= 1`);
          } else if (b.x + b.w <= a.x) {
            const gap = a.x - (b.x + b.w);
            assert.ok(gap >= 1, `Gap between ${nameB} and ${nameA} is ${gap}, expected >= 1`);
          }
        }
      }
    });
  });

  describe('packAtlas - error handling', () => {
    it('throws Error with message "Invalid sprite name" for empty name', () => {
      assert.throws(
        () => packAtlas([{ name: '', buffer: Buffer.alloc(64 * 32 * 4), width: 64, height: 32 }]),
        { message: 'Invalid sprite name' }
      );
    });

    it('throws Error with message "Invalid sprite name" for whitespace-only name', () => {
      assert.throws(
        () => packAtlas([{ name: '   ', buffer: Buffer.alloc(64 * 32 * 4), width: 64, height: 32 }]),
        { message: 'Invalid sprite name' }
      );
    });

    it('throws Error with message "Invalid sprite name" for null/undefined name', () => {
      assert.throws(
        () => packAtlas([{ name: null, buffer: Buffer.alloc(64 * 32 * 4), width: 64, height: 32 }]),
        { message: 'Invalid sprite name' }
      );
    });

    it('throws Error with message "Invalid sprite name" for duplicate names', () => {
      assert.throws(
        () => packAtlas([
          { name: 'dup', buffer: Buffer.alloc(64 * 32 * 4), width: 64, height: 32 },
          { name: 'dup', buffer: Buffer.alloc(64 * 32 * 4), width: 64, height: 32 },
        ]),
        { message: 'Invalid sprite name' }
      );
    });

    it('logs full sprite list to stderr on invalid name error', () => {
      const originalWrite = process.stderr.write;
      let stderrOutput = '';
      process.stderr.write = (msg) => { stderrOutput += msg; };

      try {
        packAtlas([
          { name: 'valid-1', buffer: Buffer.alloc(64 * 32 * 4), width: 64, height: 32 },
          { name: '', buffer: Buffer.alloc(64 * 32 * 4), width: 64, height: 32 },
        ]);
      } catch (e) {
        // expected
      }

      process.stderr.write = originalWrite;
      assert.ok(stderrOutput.includes('Full sprite list'));
      assert.ok(stderrOutput.includes('valid-1'));
    });
  });

  describe('packAtlas - atlas buffer composition', () => {
    it('atlas buffer has correct byte length for power-of-two dimensions', () => {
      const sprites = [makeSprite('s1')];
      const result = packAtlas(sprites);

      const { w, h } = result.metadata.meta.size;
      const expectedBytes = w * h * 4; // RGBA
      assert.equal(result.atlases[0].length, expectedBytes);
    });

    it('sprite pixel data is correctly placed in atlas buffer', () => {
      // Create a sprite with known pixel data
      const width = 4;
      const height = 4;
      const buffer = Buffer.alloc(width * height * 4);
      // Set first pixel to red
      buffer[0] = 255; buffer[1] = 0; buffer[2] = 0; buffer[3] = 255;

      const sprites = [{ name: 'red-pixel', buffer, width, height }];
      const result = packAtlas(sprites);

      const atlas = result.atlases[0];
      const frame = result.metadata.frames['red-pixel'].frame;
      const atlasWidth = result.metadata.meta.size.w;

      // Read the pixel at the frame's position in the atlas
      const offset = (frame.y * atlasWidth + frame.x) * 4;
      assert.equal(atlas[offset], 255);     // R
      assert.equal(atlas[offset + 1], 0);   // G
      assert.equal(atlas[offset + 2], 0);   // B
      assert.equal(atlas[offset + 3], 255); // A
    });
  });

  describe('packAtlas - metadata is JSON-serializable', () => {
    it('metadata can be serialized to JSON without error', () => {
      const sprites = [
        makeSprite('s1'),
        makeSprite('water', 64, 32, 3),
      ];
      const result = packAtlas(sprites);

      assert.doesNotThrow(() => JSON.stringify(result.metadata));
    });

    it('serialized metadata round-trips correctly', () => {
      const sprites = [makeSprite('s1'), makeSprite('s2')];
      const result = packAtlas(sprites);

      const json = JSON.stringify(result.metadata);
      const parsed = JSON.parse(json);

      assert.deepEqual(parsed.meta, result.metadata.meta);
      assert.deepEqual(parsed.frames, result.metadata.frames);
      assert.deepEqual(parsed.animations, result.metadata.animations);
    });
  });
});
