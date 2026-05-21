/**
 * Tests for js/level-generators/lib/palette.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/palette.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  PRIMARY_PALETTE,
  ENEMY_PALETTE,
  CASTLE_ACCENT_COLORS,
  BORDER_COLOR,
  ANIMATION_CONFIG,
  getPaletteForCategory,
} = require('../../../js/level-generators/lib/palette');

describe('palette: PRIMARY_PALETTE', () => {
  it('should contain exactly 16 colors (Requirement 10.1)', () => {
    assert.equal(PRIMARY_PALETTE.length, 16);
  });

  it('each color should be an array of 3 numbers in [0, 255]', () => {
    for (let i = 0; i < PRIMARY_PALETTE.length; i++) {
      const color = PRIMARY_PALETTE[i];
      assert.ok(Array.isArray(color), `Index ${i} should be an array`);
      assert.equal(color.length, 3, `Index ${i} should have 3 channels`);
      for (const channel of color) {
        assert.ok(typeof channel === 'number', `Channel should be a number`);
        assert.ok(channel >= 0 && channel <= 255, `Channel ${channel} out of range`);
      }
    }
  });
});

describe('palette: ENEMY_PALETTE', () => {
  it('should contain exactly 8 colors', () => {
    assert.equal(ENEMY_PALETTE.length, 8);
  });

  it('each color should be an array of 3 numbers in [0, 255]', () => {
    for (let i = 0; i < ENEMY_PALETTE.length; i++) {
      const color = ENEMY_PALETTE[i];
      assert.ok(Array.isArray(color), `Index ${i} should be an array`);
      assert.equal(color.length, 3, `Index ${i} should have 3 channels`);
      for (const channel of color) {
        assert.ok(typeof channel === 'number', `Channel should be a number`);
        assert.ok(channel >= 0 && channel <= 255, `Channel ${channel} out of range`);
      }
    }
  });

  it('should share no more than 2 colors with PRIMARY_PALETTE (Requirement 8.1)', () => {
    let sharedCount = 0;
    for (const enemyColor of ENEMY_PALETTE) {
      for (const primaryColor of PRIMARY_PALETTE) {
        if (
          enemyColor[0] === primaryColor[0] &&
          enemyColor[1] === primaryColor[1] &&
          enemyColor[2] === primaryColor[2]
        ) {
          sharedCount++;
          break;
        }
      }
    }
    assert.ok(sharedCount <= 2, `Enemy palette shares ${sharedCount} colors with primary (max 2)`);
  });
});

describe('palette: CASTLE_ACCENT_COLORS', () => {
  it('should contain no more than 4 accent colors (Requirement 2.5)', () => {
    assert.ok(CASTLE_ACCENT_COLORS.length <= 4, `Has ${CASTLE_ACCENT_COLORS.length} accent colors (max 4)`);
  });

  it('each color should be an array of 3 numbers in [0, 255]', () => {
    for (let i = 0; i < CASTLE_ACCENT_COLORS.length; i++) {
      const color = CASTLE_ACCENT_COLORS[i];
      assert.ok(Array.isArray(color), `Index ${i} should be an array`);
      assert.equal(color.length, 3, `Index ${i} should have 3 channels`);
      for (const channel of color) {
        assert.ok(typeof channel === 'number', `Channel should be a number`);
        assert.ok(channel >= 0 && channel <= 255, `Channel ${channel} out of range`);
      }
    }
  });
});

describe('palette: BORDER_COLOR', () => {
  it('should be [25, 25, 22] matching PRIMARY_PALETTE index 10', () => {
    assert.deepEqual(BORDER_COLOR, [25, 25, 22]);
    assert.deepEqual(BORDER_COLOR, PRIMARY_PALETTE[10]);
  });
});

describe('palette: ANIMATION_CONFIG', () => {
  it('should define water animation config', () => {
    assert.ok('water' in ANIMATION_CONFIG);
    assert.equal(ANIMATION_CONFIG.water.frameCount, 4);
    assert.equal(ANIMATION_CONFIG.water.intervalMs, 500);
    assert.equal(ANIMATION_CONFIG.water.minFrames, 3);
    assert.equal(ANIMATION_CONFIG.water.maxFrames, 8);
  });

  it('should define flag animation config', () => {
    assert.ok('flag' in ANIMATION_CONFIG);
    assert.equal(ANIMATION_CONFIG.flag.frameCount, 3);
    assert.equal(ANIMATION_CONFIG.flag.intervalMs, 600);
    assert.equal(ANIMATION_CONFIG.flag.minFrames, 2);
    assert.equal(ANIMATION_CONFIG.flag.maxFrames, 6);
  });

  it('water minFrames should be >= 3 and maxFrames <= 8', () => {
    assert.ok(ANIMATION_CONFIG.water.minFrames >= 3);
    assert.ok(ANIMATION_CONFIG.water.maxFrames <= 8);
  });
});

describe('palette: getPaletteForCategory', () => {
  it('should return PRIMARY_PALETTE for terrain', () => {
    const result = getPaletteForCategory('terrain');
    assert.deepEqual(result, PRIMARY_PALETTE);
  });

  it('should return PRIMARY_PALETTE for unit', () => {
    const result = getPaletteForCategory('unit');
    assert.deepEqual(result, PRIMARY_PALETTE);
  });

  it('should return PRIMARY_PALETTE + CASTLE_ACCENT_COLORS for castle', () => {
    const result = getPaletteForCategory('castle');
    assert.equal(result.length, PRIMARY_PALETTE.length + CASTLE_ACCENT_COLORS.length);
    // First 16 should be primary palette
    for (let i = 0; i < PRIMARY_PALETTE.length; i++) {
      assert.deepEqual(result[i], PRIMARY_PALETTE[i]);
    }
    // Remaining should be castle accent colors
    for (let i = 0; i < CASTLE_ACCENT_COLORS.length; i++) {
      assert.deepEqual(result[PRIMARY_PALETTE.length + i], CASTLE_ACCENT_COLORS[i]);
    }
  });

  it('should return ENEMY_PALETTE for enemy', () => {
    const result = getPaletteForCategory('enemy');
    assert.deepEqual(result, ENEMY_PALETTE);
  });

  it('should throw for unknown category', () => {
    assert.throws(
      () => getPaletteForCategory('invalid'),
      /Unknown palette category/
    );
  });
});
