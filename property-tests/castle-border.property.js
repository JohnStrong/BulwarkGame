/**
 * Property 7: Castle Outline Border
 *
 * For any generated castle sprite (wall, tower, keep, gatehouse, bailey),
 * every opaque pixel that is adjacent to a transparent pixel SHALL have
 * the BORDER_COLOR value [25, 25, 22].
 *
 * Feature: enhanced-pixel-art-sprites, Property 7: Castle Outline Border
 *
 * **Validates: Requirements 2.4**
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { TILE_WIDTH, TILE_HEIGHT } = require('../js/level-generators/lib/sprite-constants');
const { BORDER_COLOR } = require('../js/level-generators/lib/palette');
const {
  createBuffer,
  setPixel,
  isInsideDiamond,
  seededRandom,
  resetSeed,
  drawEdgeBorder,
} = require('../js/level-generators/lib/pixel-utils');
const { fillDiamond } = require('../js/level-generators/lib/fill-patterns');
const { applyFaceShading, applyShadowEdge } = require('../js/level-generators/lib/shading');
const { quantizeToPalette } = require('../js/level-generators/lib/palette-quantizer');
const { getPaletteForCategory } = require('../js/level-generators/lib/palette');
const {
  CASTLE_COLORS,
  CASTLE_SPRITES,
} = require('../js/level-generators/lib/sprite-constants');

// Castle palette for quantization
const CASTLE_PALETTE = getPaletteForCategory('castle');

// ─── Castle Sprite Generator Functions ──────────────────────────────────────
// Replicate the generation logic from generate-castle-sprites.js so we can
// test the border property across different castle sprite types with varying seeds.

/**
 * Draws enhanced stone blocks (same logic as generate-castle-sprites.js).
 */
function drawEnhancedStoneBlocks(buffer, stoneColor, stoneLightColor, mortarColor, seedValue) {
  fillDiamond(buffer, mortarColor, 4, seedValue);
  resetSeed(seedValue + 100);

  const courseHeight = 5;
  const mortarThickness = 1;
  const blockMinWidth = 6;
  const blockMaxWidth = 10;

  for (let courseIndex = 0; courseIndex < Math.floor(TILE_HEIGHT / courseHeight); courseIndex++) {
    const courseY = courseIndex * courseHeight;
    const rowOffset = (courseIndex % 2 === 0) ? 0 : 4;

    let blockX = rowOffset;
    while (blockX < TILE_WIDTH) {
      const blockWidth = blockMinWidth + Math.floor(seededRandom() * (blockMaxWidth - blockMinWidth + 1));
      const useLight = seededRandom() > 0.5;
      const baseBlockColor = useLight ? stoneLightColor : stoneColor;

      for (let py = 0; py < courseHeight - mortarThickness; py++) {
        for (let px = 0; px < blockWidth - 1; px++) {
          const x = blockX + px;
          const y = courseY + py;

          if (x >= 0 && x < TILE_WIDTH && y >= 0 && y < TILE_HEIGHT && isInsideDiamond(x, y)) {
            const variation = (seededRandom() - 0.5) * 12;
            setPixel(buffer, x, y,
              baseBlockColor[0] + variation,
              baseBlockColor[1] + variation,
              baseBlockColor[2] + variation);
          }
        }
      }

      blockX += blockWidth;
    }
  }
}

/**
 * Generates a castle wall sprite (same logic as generate-castle-sprites.js).
 */
function generateWall(seed) {
  const buffer = createBuffer();
  drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, seed);
  applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
  applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
  drawEdgeBorder(buffer);
  quantizeToPalette(buffer, CASTLE_PALETTE);
  return buffer;
}

/**
 * Generates a castle tower sprite (same logic as generate-castle-sprites.js).
 */
function generateTower(seed) {
  const buffer = createBuffer();
  fillDiamond(buffer, CASTLE_COLORS.tower, 8, seed);

  const centerX = 32;
  const centerY = 16;
  const towerRadius = 12;

  resetSeed(seed + 100);
  for (let offsetY = -towerRadius; offsetY <= towerRadius; offsetY++) {
    for (let offsetX = -towerRadius; offsetX <= towerRadius; offsetX++) {
      const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      if (distance <= towerRadius && isInsideDiamond(centerX + offsetX, centerY + offsetY)) {
        const noise = (seededRandom() - 0.5) * 8;
        let stoneColor;
        if (distance > towerRadius - 2) {
          stoneColor = CASTLE_COLORS.towerDark;
        } else if (distance > towerRadius - 4) {
          stoneColor = CASTLE_COLORS.tower;
        } else {
          stoneColor = CASTLE_COLORS.towerLight;
        }
        setPixel(buffer, centerX + offsetX, centerY + offsetY,
          stoneColor[0] + noise, stoneColor[1] + noise, stoneColor[2] + noise);
      }
    }
  }

  // Crenellation
  const merlonCount = 4;
  for (let i = 0; i < merlonCount; i++) {
    const angle = (i / merlonCount) * Math.PI * 2;
    const merlonCenterX = centerX + Math.round((towerRadius - 1) * Math.cos(angle));
    const merlonCenterY = centerY + Math.round((towerRadius - 1) * Math.sin(angle) * 0.5);
    for (let my = -1; my <= 1; my++) {
      for (let mx = -1; mx <= 1; mx++) {
        const px = merlonCenterX + mx;
        const py = merlonCenterY + my;
        if (isInsideDiamond(px, py)) {
          setPixel(buffer, px, py, ...CASTLE_COLORS.towerDark);
        }
      }
    }
    const crenelAngle = ((i + 0.5) / merlonCount) * Math.PI * 2;
    const crenelX = centerX + Math.round((towerRadius - 1) * Math.cos(crenelAngle));
    const crenelY = centerY + Math.round((towerRadius - 1) * Math.sin(crenelAngle) * 0.5);
    if (isInsideDiamond(crenelX, crenelY)) {
      setPixel(buffer, crenelX, crenelY, ...CASTLE_COLORS.towerLight);
    }
    if (isInsideDiamond(crenelX + 1, crenelY)) {
      setPixel(buffer, crenelX + 1, crenelY, ...CASTLE_COLORS.towerLight);
    }
  }

  applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
  applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
  drawEdgeBorder(buffer);
  quantizeToPalette(buffer, CASTLE_PALETTE);
  return buffer;
}

/**
 * Generates a castle keep tile (top-left variant) with window slit.
 */
function generateKeepTopLeft(seed) {
  const buffer = createBuffer();
  drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.tower, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallMortar, seed);

  // Window slit: 1×3 dark rectangle
  const slitX = 30;
  const slitY = 12;
  for (let dy = 0; dy < 3; dy++) {
    if (isInsideDiamond(slitX, slitY + dy)) {
      setPixel(buffer, slitX, slitY + dy, 25, 25, 22);
    }
  }

  applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
  applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
  drawEdgeBorder(buffer);
  quantizeToPalette(buffer, CASTLE_PALETTE);
  return buffer;
}

/**
 * Generates a castle gatehouse sprite.
 */
function generateGatehouse(seed) {
  const buffer = createBuffer();
  drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, seed);

  resetSeed(seed + 100);
  for (let y = 8; y <= 24; y++) {
    for (let x = 22; x <= 42; x++) {
      if (isInsideDiamond(x, y)) {
        setPixel(buffer, x, y, 25, 22, 20);
      }
    }
  }

  // Vertical iron bars
  for (let x = 23; x <= 41; x += 3) {
    for (let y = 9; y <= 23; y++) {
      if (isInsideDiamond(x, y)) {
        setPixel(buffer, x, y, ...CASTLE_COLORS.iron);
      }
    }
  }

  // Horizontal iron crossbars
  for (let y = 10; y <= 22; y += 3) {
    for (let x = 22; x <= 42; x++) {
      if (isInsideDiamond(x, y)) {
        setPixel(buffer, x, y, ...CASTLE_COLORS.ironLight);
      }
    }
  }

  applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
  applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
  drawEdgeBorder(buffer);
  quantizeToPalette(buffer, CASTLE_PALETTE);
  return buffer;
}

/**
 * Generates a bailey (courtyard floor) sprite.
 */
function generateBailey(seed) {
  const buffer = createBuffer();

  resetSeed(seed);
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      if (isInsideDiamond(x, y)) {
        const noise = (seededRandom() - 0.5) * 12;
        setPixel(buffer, x, y,
          200 + noise,
          155 + noise * 0.8,
          100 + noise * 0.6);
      }
    }
  }

  // Scatter straw strands
  resetSeed(seed + 50);
  for (let strandIndex = 0; strandIndex < 15; strandIndex++) {
    const startX = Math.floor(seededRandom() * TILE_WIDTH);
    const startY = Math.floor(seededRandom() * TILE_HEIGHT);
    const strandLength = 3 + Math.floor(seededRandom() * 4);
    const strandAngle = seededRandom() * Math.PI;

    for (let step = 0; step < strandLength; step++) {
      const pixelX = startX + Math.round(Math.cos(strandAngle) * step);
      const pixelY = startY + Math.round(Math.sin(strandAngle) * step);
      if (isInsideDiamond(pixelX, pixelY)) {
        setPixel(buffer, pixelX, pixelY, ...CASTLE_COLORS.straw);
      }
    }
  }

  applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
  applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
  drawEdgeBorder(buffer);
  quantizeToPalette(buffer, CASTLE_PALETTE);
  return buffer;
}

// ─── Castle Sprite Type Arbitrary ───────────────────────────────────────────

/**
 * Arbitrary that selects a castle sprite type and generates it with a random seed.
 * Covers: wall, tower, keep, gatehouse, bailey.
 */
const castleSpriteTypes = ['wall', 'tower', 'keep', 'gatehouse', 'bailey'];

const castleSpriteArb = fc.record({
  type: fc.constantFrom(...castleSpriteTypes),
  seed: fc.integer({ min: 1000, max: 100000 }),
});

/**
 * Generates a castle sprite buffer based on type and seed.
 */
function generateCastleSprite(type, seed) {
  switch (type) {
    case 'wall': return generateWall(seed);
    case 'tower': return generateTower(seed);
    case 'keep': return generateKeepTopLeft(seed);
    case 'gatehouse': return generateGatehouse(seed);
    case 'bailey': return generateBailey(seed);
    default: throw new Error(`Unknown castle sprite type: ${type}`);
  }
}

// ─── Border Verification Helper ─────────────────────────────────────────────

/**
 * Checks that every opaque pixel adjacent to a transparent pixel has
 * the BORDER_COLOR value [25, 25, 22].
 *
 * Returns an object with { valid: boolean, violations: Array } where
 * violations lists the first few pixels that violate the property.
 */
function verifyBorderProperty(buffer) {
  const violations = [];

  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      const index = (y * TILE_WIDTH + x) * 4;

      // Skip transparent pixels
      if (buffer[index + 3] === 0) continue;

      // Check if this opaque pixel is adjacent to a transparent pixel
      let adjacentToTransparent = false;

      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          if (offsetX === 0 && offsetY === 0) continue;

          const neighborX = x + offsetX;
          const neighborY = y + offsetY;

          // Out-of-bounds counts as transparent (edge of buffer)
          if (neighborX < 0 || neighborX >= TILE_WIDTH || neighborY < 0 || neighborY >= TILE_HEIGHT) {
            adjacentToTransparent = true;
            break;
          }

          const neighborIndex = (neighborY * TILE_WIDTH + neighborX) * 4;
          if (buffer[neighborIndex + 3] === 0) {
            adjacentToTransparent = true;
            break;
          }
        }
        if (adjacentToTransparent) break;
      }

      // If adjacent to transparent, this pixel must be BORDER_COLOR
      if (adjacentToTransparent) {
        const r = buffer[index];
        const g = buffer[index + 1];
        const b = buffer[index + 2];

        if (r !== BORDER_COLOR[0] || g !== BORDER_COLOR[1] || b !== BORDER_COLOR[2]) {
          violations.push({ x, y, actual: [r, g, b], expected: BORDER_COLOR });
          // Collect up to 5 violations for diagnostic purposes
          if (violations.length >= 5) {
            return { valid: false, violations };
          }
        }
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

// ─── Property Test ──────────────────────────────────────────────────────────

describe('Property 7: Castle Outline Border', () => {
  it('every opaque pixel adjacent to a transparent pixel has BORDER_COLOR [25, 25, 22]', () => {
    fc.assert(
      fc.property(castleSpriteArb, ({ type, seed }) => {
        const buffer = generateCastleSprite(type, seed);
        const result = verifyBorderProperty(buffer);

        assert.strictEqual(
          result.valid,
          true,
          `Castle sprite "${type}" (seed=${seed}) has border violations: ` +
          `${result.violations.length} pixel(s) adjacent to transparent without BORDER_COLOR. ` +
          `First violation at (${result.violations[0]?.x}, ${result.violations[0]?.y}): ` +
          `actual=[${result.violations[0]?.actual}], expected=[${BORDER_COLOR}]`
        );
      }),
      { numRuns: 100 }
    );
  });
});
