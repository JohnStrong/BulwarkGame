/**
 * Centralized constants for all sprite generators.
 *
 * This is the single source of truth for:
 *   - Tile dimensions
 *   - Output directory
 *   - All color palettes (terrain, castle, units)
 *   - Sprite name registries (for the level loader character mapping)
 *
 * To add a new sprite or change a texture tone, edit this file.
 * All generators import from here rather than defining their own colors.
 */

const path = require('path');

// ─── Tile Dimensions ────────────────────────────────────────────────────────

/** Width of every sprite tile in pixels. */
const TILE_WIDTH = 64;

/** Height of every sprite tile in pixels. */
const TILE_HEIGHT = 32;

/** Directory where generated sprite PNGs are written. */
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'assets', 'sprites');

// ─── Terrain Colors ─────────────────────────────────────────────────────────

const TERRAIN_COLORS = {
    grass:          [95, 180, 72],
    grassDark:      [75, 155, 55],
    road:           [210, 165, 110],
    water:          [45, 120, 210],
    bridgeStone:    [140, 138, 128],
    treeCanopy:     [48, 130, 42],
    treeCanopyDark: [28, 85, 25],
    treeCanopyLight:[75, 170, 60],
};

// ─── Castle Colors ──────────────────────────────────────────────────────────

const CASTLE_COLORS = {
    wall:           [175, 162, 135],
    wallLight:      [195, 182, 155],
    wallDark:       [125, 115, 95],
    wallMortar:     [145, 135, 112],
    tower:          [155, 145, 120],
    towerLight:     [178, 168, 142],
    towerDark:      [105, 98, 80],
    wood:           [120, 78, 38],
    woodLight:      [145, 98, 50],
    woodDark:       [85, 55, 25],
    iron:           [55, 55, 58],
    ironLight:      [75, 75, 78],
    straw:          [195, 175, 95],
    strawDark:      [165, 145, 70],
};

// ─── Unit Palettes ──────────────────────────────────────────────────────────
// Each unit has: body (torso/armor), cape (cloak), accent (helmet/details), skin (head)

const UNIT_PALETTES = {
    knight:        { body: [180, 180, 190], cape: [40, 60, 140], accent: [200, 170, 50], skin: [210, 175, 140] },
    heavyInfantry: { body: [140, 140, 145], cape: [100, 50, 50], accent: [160, 155, 140], skin: [200, 165, 130] },
    spearman:      { body: [130, 100, 60], cape: [90, 75, 50], accent: [170, 170, 170], skin: [195, 160, 125] },
    archer:        { body: [60, 110, 50], cape: [45, 90, 40], accent: [140, 100, 50], skin: [205, 170, 135] },
    crossbowman:   { body: [100, 75, 45], cape: [80, 60, 35], accent: [130, 130, 130], skin: [200, 165, 130] },
    skirmisher:    { body: [150, 130, 90], cape: [120, 105, 70], accent: [100, 90, 70], skin: [210, 175, 140] },
    engineer:      { body: [110, 80, 50], cape: [85, 65, 40], accent: [160, 140, 100], skin: [195, 160, 125] },
    militia:       { body: [130, 120, 100], cape: [110, 100, 80], accent: [90, 85, 75], skin: [205, 170, 135] },
    artillery:     { body: [60, 55, 50], cape: [45, 42, 38], accent: [140, 130, 110], skin: [200, 165, 130] },
};

// ─── Shared Border Color ────────────────────────────────────────────────────

/** Dark outline color used on all sprite edges. */
const BORDER_COLOR = [25, 25, 22];

// ─── Sprite Name Registry ───────────────────────────────────────────────────
// These are the canonical filenames (without .png) for each sprite.
// The level loader maps characters in the level text file to these names.

const TERRAIN_SPRITES = {
    grassShort1:   'grass-short-1',
    grassShort2:   'grass-short-2',
    grassFlowers1: 'grass-flowers-1',
    grassFlowers2: 'grass-flowers-2',
    road:          'road-full',
    water1:        'water-1',
    water2:        'water-2',
    water3:        'water-3',
    bridge:        'bridge-mm',
    tree1:         'tree-1',
    tree2:         'tree-2',
    tree3:         'tree-3',
    tree4:         'tree-4',
    tree5:         'tree-5',
    tree6:         'tree-6',
    tree7:         'tree-7',
    rock:          'rock',
};

const CASTLE_SPRITES = {
    bridgeStart:  'castle-bridge-start',
    bridgeMid:    'castle-bridge-mid',
    bridgeGate:   'castle-bridge-gate',
    tower:        'castle-tower',
    keepTopLeft:  'castle-keep-tl',
    keepBotLeft:  'castle-keep-bl',
    keepBotRight: 'castle-keep-br',
    keepCenter:   'castle-keep-center',
    gatehouse:    'castle-gatehouse',
    wall:         'castle-wall',
    bailey1:      'castle-bailey-1',
    bailey2:      'castle-bailey-2',
    bailey3:      'castle-bailey-3',
};

const UNIT_SPRITES = {
    knight:        'unit-knight',
    heavyInfantry: 'unit-heavy-infantry',
    spearman:      'unit-spearman',
    archer:        'unit-archer',
    crossbowman:   'unit-crossbowman',
    skirmisher:    'unit-skirmisher',
    engineer:      'unit-engineer',
    militia:       'unit-militia',
    artillery:     'unit-artillery',
};

module.exports = {
    TILE_WIDTH,
    TILE_HEIGHT,
    OUTPUT_DIR,
    TERRAIN_COLORS,
    CASTLE_COLORS,
    UNIT_PALETTES,
    BORDER_COLOR,
    TERRAIN_SPRITES,
    CASTLE_SPRITES,
    UNIT_SPRITES,
};
