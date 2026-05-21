/**
 * Palette definitions and category-based palette lookup for the enhanced
 * pixel art sprite pipeline.
 *
 * This module defines the constrained color palettes that enforce visual
 * coherence across all sprite categories. The palette quantizer uses these
 * arrays as the target color set for its final-pass enforcement.
 *
 * Requirements:
 *   10.1 - Primary palette of no more than 16 colors shared across terrain, castle, and unit sprites
 *   8.1  - Enemy palette shares no more than 2 colors with player unit palette
 *   2.5  - CASTLE_COLORS palette + max 4 accent colors
 *   10.4 - Consistent light source direction (upper-left) across all sprite categories
 */

'use strict';

// ─── Primary Palette (16 colors) ───────────────────────────────────────────
// Shared across all terrain, castle, and unit sprites.
// Requirement 10.1: no more than 16 colors.

const PRIMARY_PALETTE = [
  [95, 180, 72],    // 0  grass green
  [75, 155, 55],    // 1  grass dark
  [210, 165, 110],  // 2  road tan
  [45, 120, 210],   // 3  water blue
  [48, 130, 42],    // 4  tree canopy
  [175, 162, 135],  // 5  castle wall
  [155, 145, 120],  // 6  castle tower
  [120, 78, 38],    // 7  wood
  [55, 55, 58],     // 8  iron
  [195, 175, 95],   // 9  straw
  [25, 25, 22],     // 10 border/outline
  [210, 175, 140],  // 11 skin tone
  [180, 180, 190],  // 12 armor silver
  [40, 60, 140],    // 13 cape blue
  [200, 170, 50],   // 14 gold accent
  [140, 138, 128],  // 15 bridge stone
];

// ─── Enemy Palette (8 colors) ──────────────────────────────────────────────
// Distinct from player palette. Requirement 8.1: shares no more than 2 colors
// with the player unit palette.

const ENEMY_PALETTE = [
  [80, 30, 30],     // 0  dark crimson body
  [120, 40, 35],    // 1  blood red accent
  [45, 40, 50],     // 2  shadow purple
  [60, 55, 45],     // 3  dark olive
  [150, 50, 40],    // 4  bright red highlight
  [35, 30, 28],     // 5  near-black armor
  [100, 85, 70],    // 6  weathered leather
  [170, 60, 50],    // 7  banner red
];

// ─── Castle Accent Colors (max 4) ─────────────────────────────────────────
// Requirement 2.5: extends CASTLE_COLORS by no more than 4 accent colors
// for weathering and highlight effects beyond the primary palette castle colors.

const CASTLE_ACCENT_COLORS = [
  [195, 182, 155],  // wall highlight (weathered light)
  [125, 115, 95],   // wall shadow (deep mortar)
  [145, 135, 112],  // mortar line
  [178, 168, 142],  // tower highlight
];

// ─── Border Color ──────────────────────────────────────────────────────────
// Dark outline used on all sprite edges. Matches PRIMARY_PALETTE index 10.

const BORDER_COLOR = [25, 25, 22];

// ─── Animation Configuration ───────────────────────────────────────────────
// Frame counts and timing for animated sprite types.

const ANIMATION_CONFIG = {
  water: { frameCount: 4, intervalMs: 500, minFrames: 3, maxFrames: 8 },
  flag:  { frameCount: 3, intervalMs: 600, minFrames: 2, maxFrames: 6 },
};

// ─── Palette Lookup ────────────────────────────────────────────────────────

/**
 * Returns the combined palette array for a given sprite category.
 *
 * - 'terrain': PRIMARY_PALETTE (16 colors)
 * - 'castle':  PRIMARY_PALETTE + CASTLE_ACCENT_COLORS (up to 20 colors)
 * - 'unit':    PRIMARY_PALETTE (16 colors)
 * - 'enemy':   ENEMY_PALETTE (8 colors, distinct from player palette)
 *
 * @param {'terrain'|'castle'|'unit'|'enemy'} category
 * @returns {number[][]} Combined palette as array of [r, g, b] tuples
 */
function getPaletteForCategory(category) {
  switch (category) {
    case 'terrain':
      return PRIMARY_PALETTE;
    case 'castle':
      return [...PRIMARY_PALETTE, ...CASTLE_ACCENT_COLORS];
    case 'unit':
      return PRIMARY_PALETTE;
    case 'enemy':
      return ENEMY_PALETTE;
    default:
      throw new Error(`Unknown palette category: "${category}". Expected one of: terrain, castle, unit, enemy`);
  }
}

module.exports = {
  PRIMARY_PALETTE,
  ENEMY_PALETTE,
  CASTLE_ACCENT_COLORS,
  BORDER_COLOR,
  ANIMATION_CONFIG,
  getPaletteForCategory,
};
