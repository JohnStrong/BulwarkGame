/**
 * Tests for js/level-generators/lib/animation-frames.js
 *
 * Validates the animation frame generation module that produces multi-frame
 * sequences for water tiles and castle flags.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/animation-frames.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  generateWaterFrames,
  generateFlagFrames,
  countNonTransparentPixels,
  countDifferingPixels,
} = require('../../../js/level-generators/lib/animation-frames');

const { TILE_WIDTH, TILE_HEIGHT } = require('../../../js/level-generators/lib/sprite-constants');

const BUFFER_SIZE = TILE_WIDTH * TILE_HEIGHT * 4; // 64×32×4 = 8192

describe('animation-frames: generateWaterFrames', () => {
  it('should produce the requested number of frames', () => {
    const frames = generateWaterFrames(4, 12345);
    assert.equal(frames.length, 4);
  });

  it('should produce frames with correct buffer size (64×32×4)', () => {
    const frames = generateWaterFrames(3, 42);
    for (const frame of frames) {
      assert.equal(frame.length, BUFFER_SIZE);
    }
  });

  it('should produce frames within valid range (3–8)', () => {
    for (let count = 3; count <= 8; count++) {
      const frames = generateWaterFrames(count, 100 + count);
      assert.equal(frames.length, count);
    }
  });

  it('should throw for frameCount below minimum (< 3)', () => {
    assert.throws(
      () => generateWaterFrames(2, 100),
      /Invalid water frame count/
    );
  });

  it('should throw for frameCount above maximum (> 8)', () => {
    assert.throws(
      () => generateWaterFrames(9, 100),
      /Invalid water frame count/
    );
  });

  it('should produce deterministic output for the same seed', () => {
    const frames1 = generateWaterFrames(4, 12345);
    const frames2 = generateWaterFrames(4, 12345);
    for (let i = 0; i < frames1.length; i++) {
      assert.ok(
        Buffer.compare(frames1[i], frames2[i]) === 0,
        `Frame ${i} should be identical for same seed`
      );
    }
  });

  it('should produce different output for different seeds', () => {
    const frames1 = generateWaterFrames(4, 11111);
    const frames2 = generateWaterFrames(4, 22222);
    // At least one frame should differ
    let anyDiff = false;
    for (let i = 0; i < frames1.length; i++) {
      if (Buffer.compare(frames1[i], frames2[i]) !== 0) {
        anyDiff = true;
        break;
      }
    }
    assert.ok(anyDiff, 'Different seeds should produce different frames');
  });

  it('should have at least 10% pixel difference between consecutive frames', () => {
    const frames = generateWaterFrames(4, 54321);
    for (let i = 0; i < frames.length - 1; i++) {
      const nonTransparent = countNonTransparentPixels(frames[i]);
      const diff = countDifferingPixels(frames[i], frames[i + 1]);
      const pct = nonTransparent > 0 ? diff / nonTransparent : 0;
      assert.ok(
        pct >= 0.10,
        `Frames ${i}→${i + 1}: diff ${(pct * 100).toFixed(1)}% < 10% required`
      );
    }
  });

  it('should have non-transparent pixels (frames are not empty)', () => {
    const frames = generateWaterFrames(4, 99999);
    for (let i = 0; i < frames.length; i++) {
      const count = countNonTransparentPixels(frames[i]);
      assert.ok(count > 0, `Frame ${i} should have non-transparent pixels`);
    }
  });

  it('should produce frames with only alpha 0 or 255', () => {
    const frames = generateWaterFrames(4, 77777);
    for (let fi = 0; fi < frames.length; fi++) {
      for (let i = 3; i < frames[fi].length; i += 4) {
        const alpha = frames[fi][i];
        assert.ok(
          alpha === 0 || alpha === 255,
          `Frame ${fi}: pixel has alpha ${alpha}, expected 0 or 255`
        );
      }
    }
  });
});

describe('animation-frames: generateFlagFrames', () => {
  it('should produce the requested number of frames', () => {
    const frames = generateFlagFrames(3, 12345);
    assert.equal(frames.length, 3);
  });

  it('should produce frames with correct buffer size (64×32×4)', () => {
    const frames = generateFlagFrames(3, 42);
    for (const frame of frames) {
      assert.equal(frame.length, BUFFER_SIZE);
    }
  });

  it('should produce frames within valid range (2–6)', () => {
    for (let count = 2; count <= 6; count++) {
      const frames = generateFlagFrames(count, 200 + count);
      assert.equal(frames.length, count);
    }
  });

  it('should throw for frameCount below minimum (< 2)', () => {
    assert.throws(
      () => generateFlagFrames(1, 100),
      /Invalid flag frame count/
    );
  });

  it('should throw for frameCount above maximum (> 6)', () => {
    assert.throws(
      () => generateFlagFrames(7, 100),
      /Invalid flag frame count/
    );
  });

  it('should produce deterministic output for the same seed', () => {
    const frames1 = generateFlagFrames(3, 54321);
    const frames2 = generateFlagFrames(3, 54321);
    for (let i = 0; i < frames1.length; i++) {
      assert.ok(
        Buffer.compare(frames1[i], frames2[i]) === 0,
        `Frame ${i} should be identical for same seed`
      );
    }
  });

  it('should produce different frames within the same sequence', () => {
    const frames = generateFlagFrames(3, 12345);
    let anyDiff = false;
    for (let i = 0; i < frames.length - 1; i++) {
      if (Buffer.compare(frames[i], frames[i + 1]) !== 0) {
        anyDiff = true;
        break;
      }
    }
    assert.ok(anyDiff, 'Consecutive flag frames should differ');
  });

  it('should have non-transparent pixels (frames are not empty)', () => {
    const frames = generateFlagFrames(3, 99999);
    for (let i = 0; i < frames.length; i++) {
      const count = countNonTransparentPixels(frames[i]);
      assert.ok(count > 0, `Frame ${i} should have non-transparent pixels`);
    }
  });
});

describe('animation-frames: countNonTransparentPixels', () => {
  it('should return 0 for a fully transparent buffer', () => {
    const buffer = Buffer.alloc(BUFFER_SIZE, 0);
    assert.equal(countNonTransparentPixels(buffer), 0);
  });

  it('should count all pixels in a fully opaque buffer', () => {
    const buffer = Buffer.alloc(BUFFER_SIZE);
    for (let i = 0; i < TILE_WIDTH * TILE_HEIGHT; i++) {
      buffer[i * 4 + 3] = 255;
    }
    assert.equal(countNonTransparentPixels(buffer), TILE_WIDTH * TILE_HEIGHT);
  });
});

describe('animation-frames: countDifferingPixels', () => {
  it('should return 0 for identical buffers', () => {
    const buffer = Buffer.alloc(BUFFER_SIZE);
    for (let i = 0; i < TILE_WIDTH * TILE_HEIGHT; i++) {
      buffer[i * 4] = 100;
      buffer[i * 4 + 1] = 150;
      buffer[i * 4 + 2] = 200;
      buffer[i * 4 + 3] = 255;
    }
    assert.equal(countDifferingPixels(buffer, Buffer.from(buffer)), 0);
  });

  it('should count pixels that differ in color', () => {
    const bufferA = Buffer.alloc(16); // 1 pixel
    const bufferB = Buffer.alloc(16);
    // Pixel 0: same in both
    bufferA[0] = 100; bufferA[1] = 100; bufferA[2] = 100; bufferA[3] = 255;
    bufferB[0] = 100; bufferB[1] = 100; bufferB[2] = 100; bufferB[3] = 255;
    // Pixel 1: different
    bufferA[4] = 100; bufferA[5] = 100; bufferA[6] = 100; bufferA[7] = 255;
    bufferB[4] = 200; bufferB[5] = 100; bufferB[6] = 100; bufferB[7] = 255;
    // Pixel 2: transparent in A
    bufferA[8] = 0; bufferA[9] = 0; bufferA[10] = 0; bufferA[11] = 0;
    bufferB[8] = 200; bufferB[9] = 200; bufferB[10] = 200; bufferB[11] = 255;
    // Pixel 3: different
    bufferA[12] = 50; bufferA[13] = 50; bufferA[14] = 50; bufferA[15] = 255;
    bufferB[12] = 60; bufferB[13] = 50; bufferB[14] = 50; bufferB[15] = 255;

    assert.equal(countDifferingPixels(bufferA, bufferB), 2);
  });

  it('should not count transparent pixels as differing', () => {
    const bufferA = Buffer.alloc(8); // 2 pixels, both transparent
    const bufferB = Buffer.alloc(8);
    assert.equal(countDifferingPixels(bufferA, bufferB), 0);
  });
});
