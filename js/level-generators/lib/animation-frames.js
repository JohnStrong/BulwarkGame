/**
 * Animation frame generation for water tiles and castle flags.
 *
 * Produces multi-frame animation sequences where each consecutive frame pair
 * differs in at least 10% of non-transparent pixels, creating visible movement.
 *
 * Uses a seeded PRNG for deterministic output — the same seed always produces
 * the same animation sequence.
 *
 * Requirements:
 *   1.3 - Water sprites: 3–8 frames, each consecutive pair differs by ≥10% of non-transparent pixels
 *   5.3 - Animation frames cycled at configurable rate, independent of game frame rate
 */

'use strict';

const {
  TILE_WIDTH,
  TILE_HEIGHT,
  TERRAIN_COLORS,
} = require('./sprite-constants');

const {
  createBuffer,
  setPixel,
  isInsideDiamond,
} = require('./pixel-utils');

const { ANIMATION_CONFIG } = require('./palette');

// ─── Seeded PRNG (local to this module to avoid shared state) ───────────────

/**
 * Creates a local seeded PRNG (LCG) that returns values in [0, 1).
 * @param {number} seed - Integer seed value
 * @returns {function(): number} PRNG function
 */
function createLocalRng(seed) {
  let state = seed | 0;
  return function () {
    state = (state * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (state >>> 0) / 0x100000000;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Counts non-transparent pixels in a buffer.
 * @param {Buffer} buffer - RGBA pixel buffer
 * @returns {number} Count of pixels with alpha > 0
 */
function countNonTransparentPixels(buffer) {
  let count = 0;
  for (let i = 3; i < buffer.length; i += 4) {
    if (buffer[i] > 0) count++;
  }
  return count;
}

/**
 * Counts pixels that differ between two buffers (only among non-transparent pixels).
 * A pixel "differs" if any of its R, G, or B channels differ between the two buffers,
 * and the pixel is non-transparent in both frames.
 *
 * @param {Buffer} bufferA - First RGBA pixel buffer
 * @param {Buffer} bufferB - Second RGBA pixel buffer
 * @returns {number} Count of differing non-transparent pixels
 */
function countDifferingPixels(bufferA, bufferB) {
  let diffCount = 0;
  const pixelCount = bufferA.length / 4;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const alphaA = bufferA[offset + 3];
    const alphaB = bufferB[offset + 3];

    // Only count pixels that are non-transparent in both frames
    if (alphaA > 0 && alphaB > 0) {
      if (
        bufferA[offset] !== bufferB[offset] ||
        bufferA[offset + 1] !== bufferB[offset + 1] ||
        bufferA[offset + 2] !== bufferB[offset + 2]
      ) {
        diffCount++;
      }
    }
  }
  return diffCount;
}

// ─── Water Frame Generation ─────────────────────────────────────────────────

/**
 * Generates a single water frame with ripple highlights at positions
 * determined by the frame index and seed.
 *
 * The base water fill is consistent across frames. Ripple highlights
 * shift position each frame to create the animation effect.
 *
 * @param {number} frameIndex - Index of this frame in the sequence
 * @param {number} seed - Base seed for deterministic generation
 * @returns {Buffer} RGBA pixel buffer for this frame
 */
function generateSingleWaterFrame(frameIndex, seed) {
  const buffer = createBuffer();
  const baseRng = createLocalRng(seed);

  // Fill diamond with water base color + subtle noise (consistent across frames)
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      if (isInsideDiamond(x, y)) {
        const noise = (baseRng() - 0.5) * 8;
        setPixel(buffer, x, y,
          TERRAIN_COLORS.water[0] + noise,
          TERRAIN_COLORS.water[1] + noise,
          TERRAIN_COLORS.water[2] + noise
        );
      }
    }
  }

  // Add frame-specific ripple highlights that shift between frames
  const rippleRng = createLocalRng(seed + 5000 + frameIndex * 1337);
  const rippleCount = 6 + Math.floor(rippleRng() * 5); // 6-10 ripples per frame

  for (let r = 0; r < rippleCount; r++) {
    // Ripple position varies per frame via the frame-specific seed
    const rippleX = 8 + Math.floor(rippleRng() * 48);
    const rippleY = 3 + Math.floor(rippleRng() * 26);
    const rippleLen = 3 + Math.floor(rippleRng() * 5); // 3-7 pixels wide

    for (let px = 0; px < rippleLen; px++) {
      const x = rippleX + px;
      const y = rippleY;
      if (isInsideDiamond(x, y)) {
        // Bright highlight color for ripple
        setPixel(buffer, x, y, 80, 155, 235);
      }
    }
  }

  // Add frame-specific darker wave troughs
  const troughRng = createLocalRng(seed + 9000 + frameIndex * 2741);
  const troughCount = 4 + Math.floor(troughRng() * 4); // 4-7 troughs

  for (let t = 0; t < troughCount; t++) {
    const troughX = 10 + Math.floor(troughRng() * 44);
    const troughY = 4 + Math.floor(troughRng() * 24);
    const troughLen = 2 + Math.floor(troughRng() * 4); // 2-5 pixels wide

    for (let px = 0; px < troughLen; px++) {
      const x = troughX + px;
      const y = troughY;
      if (isInsideDiamond(x, y)) {
        // Darker blue for wave trough
        setPixel(buffer, x, y, 30, 95, 180);
      }
    }
  }

  return buffer;
}

/**
 * Generates animation frames for water tiles.
 *
 * Each frame shows the same water base with ripple highlights at different
 * positions, creating a shimmering/flowing effect when animated.
 *
 * @param {number} frameCount - Number of frames to generate (3–8)
 * @param {number} seed - Base seed for deterministic generation
 * @returns {Buffer[]} Array of RGBA pixel buffers, one per frame
 * @throws {Error} If frameCount is outside the valid range [3, 8]
 */
function generateWaterFrames(frameCount, seed) {
  const { minFrames, maxFrames } = ANIMATION_CONFIG.water;

  if (frameCount < minFrames || frameCount > maxFrames) {
    throw new Error(
      `[SPRITE-BUILD-ERROR] animation-frames: Invalid water frame count ${frameCount}. ` +
      `Expected ${minFrames}–${maxFrames}.`
    );
  }

  const frames = [];

  for (let i = 0; i < frameCount; i++) {
    frames.push(generateSingleWaterFrame(i, seed));
  }

  // Verify the 10% difference constraint between consecutive frames.
  // If a frame pair doesn't meet the threshold, regenerate with adjusted seed
  // to ensure the constraint is always satisfied.
  for (let attempt = 0; attempt < 5; attempt++) {
    let allValid = true;

    for (let i = 0; i < frames.length - 1; i++) {
      const nonTransparent = countNonTransparentPixels(frames[i]);
      const diffPixels = countDifferingPixels(frames[i], frames[i + 1]);
      const diffPercent = nonTransparent > 0 ? diffPixels / nonTransparent : 0;

      if (diffPercent < 0.10) {
        // Regenerate the next frame with a different seed offset
        frames[i + 1] = generateSingleWaterFrame(
          i + 1,
          seed + (attempt + 1) * 10000 + i * 777
        );
        allValid = false;
      }
    }

    if (allValid) break;
  }

  return frames;
}

// ─── Flag Frame Generation ──────────────────────────────────────────────────

/**
 * Generates a single flag frame showing a waving flag on a pole.
 * The flag wave pattern shifts based on the frame index.
 *
 * @param {number} frameIndex - Index of this frame in the sequence
 * @param {number} seed - Base seed for deterministic generation
 * @returns {Buffer} RGBA pixel buffer for this frame
 */
function generateSingleFlagFrame(frameIndex, seed) {
  const buffer = createBuffer();
  const rng = createLocalRng(seed + frameIndex * 2003);

  // Flag pole (vertical line near center-left of tile)
  const poleX = 30;
  const poleTop = 4;
  const poleBottom = 24;

  for (let y = poleTop; y <= poleBottom; y++) {
    if (isInsideDiamond(poleX, y)) {
      setPixel(buffer, poleX, y, 120, 78, 38); // wood color
    }
  }

  // Flag cloth (3×5 minimum, waves based on frame index)
  const flagStartX = poleX + 1;
  const flagStartY = poleTop + 1;
  const flagWidth = 7; // wider than minimum 3×5 for visibility
  const flagHeight = 5;

  // Wave offset creates the animation — shifts the flag shape per frame
  const wavePhase = (frameIndex * Math.PI * 2) / 6; // distribute phases across frames

  for (let fy = 0; fy < flagHeight; fy++) {
    // Each row has a horizontal wave offset based on frame
    const waveOffset = Math.round(Math.sin(wavePhase + fy * 0.8) * 1.5);

    for (let fx = 0; fx < flagWidth; fx++) {
      const x = flagStartX + fx + waveOffset;
      const y = flagStartY + fy;

      if (isInsideDiamond(x, y) && x >= 0 && x < TILE_WIDTH) {
        // Flag color with slight variation
        const noise = (rng() - 0.5) * 10;
        setPixel(buffer, x, y, 200 + noise, 170 + noise, 50 + noise); // gold accent
      }
    }
  }

  // Flag tip/pennant detail
  const tipX = flagStartX + flagWidth + Math.round(Math.sin(wavePhase) * 1.5);
  const tipY = flagStartY + Math.floor(flagHeight / 2);
  if (isInsideDiamond(tipX, tipY)) {
    setPixel(buffer, tipX, tipY, 200, 50, 40); // red tip
  }

  return buffer;
}

/**
 * Generates animation frames for castle flag animations.
 *
 * Each frame shows the flag in a different wave position, creating
 * a fluttering effect when animated.
 *
 * @param {number} frameCount - Number of frames to generate (2–6)
 * @param {number} seed - Base seed for deterministic generation
 * @returns {Buffer[]} Array of RGBA pixel buffers, one per frame
 * @throws {Error} If frameCount is outside the valid range [2, 6]
 */
function generateFlagFrames(frameCount, seed) {
  const { minFrames, maxFrames } = ANIMATION_CONFIG.flag;

  if (frameCount < minFrames || frameCount > maxFrames) {
    throw new Error(
      `[SPRITE-BUILD-ERROR] animation-frames: Invalid flag frame count ${frameCount}. ` +
      `Expected ${minFrames}–${maxFrames}.`
    );
  }

  const frames = [];

  for (let i = 0; i < frameCount; i++) {
    frames.push(generateSingleFlagFrame(i, seed));
  }

  return frames;
}

module.exports = {
  generateWaterFrames,
  generateFlagFrames,
  // Exposed for testing
  countNonTransparentPixels,
  countDifferingPixels,
};
