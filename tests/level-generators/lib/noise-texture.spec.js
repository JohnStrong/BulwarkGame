/**
 * Tests for js/level-generators/lib/noise-texture.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/noise-texture.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  terrainNoise,
  createTerrainNoiseGenerator,
  createSeededRandom,
} = require('../../../js/level-generators/lib/noise-texture');

describe('noise-texture: createSeededRandom', () => {
  it('should produce deterministic sequences for the same seed', () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    for (let i = 0; i < 10; i++) {
      assert.equal(rng1(), rng2(), `Mismatch at iteration ${i}`);
    }
  });

  it('should produce values in [0, 1)', () => {
    const rng = createSeededRandom(123);
    for (let i = 0; i < 100; i++) {
      const val = rng();
      assert.ok(val >= 0, `Value ${val} is below 0`);
      assert.ok(val < 1, `Value ${val} is >= 1`);
    }
  });

  it('should produce different sequences for different seeds', () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);
    // At least one of the first 5 values should differ
    let allSame = true;
    for (let i = 0; i < 5; i++) {
      if (rng1() !== rng2()) {
        allSame = false;
        break;
      }
    }
    assert.ok(!allSame, 'Different seeds should produce different sequences');
  });
});

describe('noise-texture: terrainNoise', () => {
  it('should return deterministic output for same seed (Requirement 1.2)', async () => {
    const v1 = await terrainNoise(10, 20, 8, 42);
    const v2 = await terrainNoise(10, 20, 8, 42);
    assert.equal(v1, v2);
  });

  it('should return values in range [-1, 1]', async () => {
    const seeds = [1, 42, 99, 1000];
    for (const seed of seeds) {
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
          const val = await terrainNoise(x * 5, y * 5, 8, seed);
          assert.ok(val >= -1, `Value ${val} below -1 at (${x},${y}) seed=${seed}`);
          assert.ok(val <= 1, `Value ${val} above 1 at (${x},${y}) seed=${seed}`);
        }
      }
    }
  });

  it('should produce different values for different seeds', async () => {
    const v1 = await terrainNoise(10, 20, 8, 42);
    const v2 = await terrainNoise(10, 20, 8, 99);
    assert.notEqual(v1, v2);
  });

  it('should produce different values for different coordinates', async () => {
    const v1 = await terrainNoise(0, 0, 8, 42);
    const v2 = await terrainNoise(50, 50, 8, 42);
    assert.notEqual(v1, v2);
  });

  it('should respect scale parameter (lower scale = more variation)', async () => {
    // With a very large scale, nearby points should be very similar
    const v1 = await terrainNoise(0, 0, 1000, 42);
    const v2 = await terrainNoise(1, 1, 1000, 42);
    const largeDiff = Math.abs(v1 - v2);

    // With a small scale, nearby points should differ more
    const v3 = await terrainNoise(0, 0, 1, 42);
    const v4 = await terrainNoise(1, 1, 1, 42);
    const smallDiff = Math.abs(v3 - v4);

    // Large scale should produce less variation between adjacent points
    assert.ok(largeDiff <= smallDiff + 0.001,
      `Large scale diff (${largeDiff}) should be <= small scale diff (${smallDiff})`);
  });
});

describe('noise-texture: createTerrainNoiseGenerator', () => {
  it('should produce same values as terrainNoise for same seed', async () => {
    const gen = await createTerrainNoiseGenerator(42);
    const v1 = gen(10, 20, 8);
    const v2 = await terrainNoise(10, 20, 8, 42);
    assert.equal(v1, v2);
  });

  it('should be deterministic across multiple calls', async () => {
    const gen1 = await createTerrainNoiseGenerator(42);
    const gen2 = await createTerrainNoiseGenerator(42);
    for (let i = 0; i < 10; i++) {
      assert.equal(gen1(i, i, 8), gen2(i, i, 8), `Mismatch at iteration ${i}`);
    }
  });

  it('should return values in range [-1, 1]', async () => {
    const gen = await createTerrainNoiseGenerator(7);
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) {
        const val = gen(x * 3, y * 3, 4);
        assert.ok(val >= -1, `Value ${val} below -1`);
        assert.ok(val <= 1, `Value ${val} above 1`);
      }
    }
  });

  it('should produce different generators for different seeds', async () => {
    const gen1 = await createTerrainNoiseGenerator(1);
    const gen2 = await createTerrainNoiseGenerator(2);
    const v1 = gen1(10, 10, 8);
    const v2 = gen2(10, 10, 8);
    assert.notEqual(v1, v2);
  });
});

describe('noise-texture: error handling', () => {
  it('should handle edge case coordinates (0, 0)', async () => {
    const val = await terrainNoise(0, 0, 8, 42);
    assert.equal(typeof val, 'number');
    assert.ok(!isNaN(val));
  });

  it('should handle negative coordinates', async () => {
    const val = await terrainNoise(-10, -20, 8, 42);
    assert.equal(typeof val, 'number');
    assert.ok(val >= -1 && val <= 1);
  });

  it('should handle large coordinates', async () => {
    const val = await terrainNoise(10000, 10000, 8, 42);
    assert.equal(typeof val, 'number');
    assert.ok(val >= -1 && val <= 1);
  });
});
