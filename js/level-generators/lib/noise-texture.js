/**
 * Noise texture generation module for terrain variation.
 *
 * Wraps the `simplex-noise` library to provide deterministic, terrain-specific
 * noise generation. Uses a seeded PRNG so that the same seed always produces
 * the same noise output.
 *
 * Requirements:
 *   1.2 - Simplex noise texture variation for grass sprites
 *   6.1 - Uses simplex-noise library (MIT license) for procedural texture generation
 */

'use strict';

// simplex-noise v4 is ESM-only. We cache the import promise so it's loaded once.
let _createNoise2D = null;

/**
 * Loads the simplex-noise module (ESM dynamic import).
 * Caches the result for subsequent calls.
 * @returns {Promise<Function>} The createNoise2D factory function
 */
async function loadSimplexNoise() {
  if (_createNoise2D) return _createNoise2D;
  try {
    const mod = await import('simplex-noise');
    _createNoise2D = mod.createNoise2D;
    return _createNoise2D;
  } catch (err) {
    throw new Error(
      `[SPRITE-BUILD-ERROR] noise-texture: simplex-noise module not found.\n` +
      `  Install with: npm install simplex-noise@4.0.3\n` +
      `  Original error: ${err.message}`
    );
  }
}

/**
 * Creates a seeded pseudo-random number generator (LCG).
 * Returns values in [0, 1) — compatible with simplex-noise's random function contract.
 *
 * @param {number} seed - Integer seed value
 * @returns {function(): number} PRNG function returning values in [0, 1)
 */
function createSeededRandom(seed) {
  let state = seed | 0;
  return function () {
    state = (state * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (state >>> 0) / 0x100000000;
  };
}

/**
 * Generates a deterministic 2D simplex noise value for terrain texturing.
 *
 * @param {number} x - Pixel x coordinate
 * @param {number} y - Pixel y coordinate
 * @param {number} scale - Noise frequency (lower = smoother patterns)
 * @param {number} seed - Seed for deterministic output
 * @returns {Promise<number>} Noise value in range [-1, 1]
 */
async function terrainNoise(x, y, scale, seed) {
  const createNoise2D = await loadSimplexNoise();
  const rng = createSeededRandom(seed);
  const noise2D = createNoise2D(rng);
  return noise2D(x / scale, y / scale);
}

/**
 * Creates a reusable noise generator for a given seed.
 * More efficient than calling terrainNoise() repeatedly since it only
 * initializes the noise function once per seed.
 *
 * @param {number} seed - Seed for deterministic output
 * @returns {Promise<function(number, number, number): number>} A function (x, y, scale) => noise value in [-1, 1]
 */
async function createTerrainNoiseGenerator(seed) {
  const createNoise2D = await loadSimplexNoise();
  const rng = createSeededRandom(seed);
  const noise2D = createNoise2D(rng);
  return function (x, y, scale) {
    return noise2D(x / scale, y / scale);
  };
}

module.exports = {
  terrainNoise,
  createTerrainNoiseGenerator,
  createSeededRandom,
  // Exposed for testing
  _loadSimplexNoise: loadSimplexNoise,
};
