/**
 * Tests for js/level-generators/lib/sprite-constants.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/sprite-constants.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('../../../js/level-generators/lib/sprite-constants');

describe('sprite-constants: tile dimensions', () => {
    it('TILE_WIDTH should be 64', () => {
        assert.equal(TILE_WIDTH, 64);
    });

    it('TILE_HEIGHT should be 32', () => {
        assert.equal(TILE_HEIGHT, 32);
    });
});

describe('sprite-constants: OUTPUT_DIR', () => {
    it('should be a string ending with assets/sprites', () => {
        assert.ok(typeof OUTPUT_DIR === 'string');
        assert.ok(OUTPUT_DIR.endsWith('assets/sprites') || OUTPUT_DIR.endsWith('assets\\sprites'));
    });
});

describe('sprite-constants: TERRAIN_COLORS', () => {
    it('should have all expected terrain color keys', () => {
        const expectedKeys = ['grass', 'grassDark', 'road', 'water', 'bridgeStone', 'treeCanopy', 'treeCanopyDark', 'treeCanopyLight'];
        for (const key of expectedKeys) {
            assert.ok(key in TERRAIN_COLORS, `Missing key: ${key}`);
        }
    });

    it('each color should be an array of 3 numbers (RGB)', () => {
        for (const [key, color] of Object.entries(TERRAIN_COLORS)) {
            assert.ok(Array.isArray(color), `${key} should be an array`);
            assert.equal(color.length, 3, `${key} should have 3 channels`);
            for (const channel of color) {
                assert.ok(typeof channel === 'number', `${key} channels should be numbers`);
                assert.ok(channel >= 0 && channel <= 255, `${key} channel ${channel} out of range`);
            }
        }
    });
});

describe('sprite-constants: CASTLE_COLORS', () => {
    it('should have all expected castle color keys', () => {
        const expectedKeys = ['wall', 'wallLight', 'wallDark', 'wallMortar', 'tower', 'towerLight', 'towerDark', 'wood', 'woodLight', 'woodDark', 'iron', 'ironLight', 'straw', 'strawDark'];
        for (const key of expectedKeys) {
            assert.ok(key in CASTLE_COLORS, `Missing key: ${key}`);
        }
    });

    it('each color should be an array of 3 numbers (RGB)', () => {
        for (const [key, color] of Object.entries(CASTLE_COLORS)) {
            assert.ok(Array.isArray(color), `${key} should be an array`);
            assert.equal(color.length, 3, `${key} should have 3 channels`);
        }
    });
});

describe('sprite-constants: UNIT_PALETTES', () => {
    it('should have all 9 unit types', () => {
        const expectedUnits = ['knight', 'heavyInfantry', 'spearman', 'archer', 'crossbowman', 'skirmisher', 'engineer', 'militia', 'artillery'];
        for (const unit of expectedUnits) {
            assert.ok(unit in UNIT_PALETTES, `Missing unit: ${unit}`);
        }
    });

    it('each palette should have body, cape, accent, skin properties', () => {
        for (const [unit, palette] of Object.entries(UNIT_PALETTES)) {
            assert.ok(Array.isArray(palette.body), `${unit}.body should be an array`);
            assert.ok(Array.isArray(palette.cape), `${unit}.cape should be an array`);
            assert.ok(Array.isArray(palette.accent), `${unit}.accent should be an array`);
            assert.ok(Array.isArray(palette.skin), `${unit}.skin should be an array`);
            assert.equal(palette.body.length, 3, `${unit}.body should have 3 channels`);
            assert.equal(palette.cape.length, 3, `${unit}.cape should have 3 channels`);
            assert.equal(palette.accent.length, 3, `${unit}.accent should have 3 channels`);
            assert.equal(palette.skin.length, 3, `${unit}.skin should have 3 channels`);
        }
    });
});

describe('sprite-constants: BORDER_COLOR', () => {
    it('should be a dark RGB array', () => {
        assert.ok(Array.isArray(BORDER_COLOR));
        assert.equal(BORDER_COLOR.length, 3);
        for (const channel of BORDER_COLOR) {
            assert.ok(channel < 50, `Border color channel ${channel} should be dark`);
        }
    });
});

describe('sprite-constants: TERRAIN_SPRITES registry', () => {
    it('should have all expected terrain sprite names', () => {
        const expectedKeys = ['grassShort1', 'grassShort2', 'grassFlowers1', 'grassFlowers2', 'road', 'water1', 'water2', 'water3', 'bridge', 'tree1', 'tree2', 'tree3', 'tree4', 'tree5', 'tree6', 'tree7', 'rock'];
        for (const key of expectedKeys) {
            assert.ok(key in TERRAIN_SPRITES, `Missing sprite: ${key}`);
        }
    });

    it('all sprite names should be non-empty strings', () => {
        for (const [key, name] of Object.entries(TERRAIN_SPRITES)) {
            assert.ok(typeof name === 'string' && name.length > 0, `${key} should be a non-empty string`);
        }
    });
});

describe('sprite-constants: CASTLE_SPRITES registry', () => {
    it('should have all expected castle sprite names', () => {
        const expectedKeys = ['bridgeStart', 'bridgeMid', 'bridgeGate', 'tower', 'keepTopLeft', 'keepBotLeft', 'keepBotRight', 'keepCenter', 'gatehouse', 'wall', 'bailey1', 'bailey2', 'bailey3'];
        for (const key of expectedKeys) {
            assert.ok(key in CASTLE_SPRITES, `Missing sprite: ${key}`);
        }
    });

    it('all sprite names should be non-empty strings', () => {
        for (const [key, name] of Object.entries(CASTLE_SPRITES)) {
            assert.ok(typeof name === 'string' && name.length > 0, `${key} should be a non-empty string`);
        }
    });
});

describe('sprite-constants: UNIT_SPRITES registry', () => {
    it('should have all expected unit sprite names', () => {
        const expectedKeys = ['knight', 'heavyInfantry', 'spearman', 'archer', 'crossbowman', 'skirmisher', 'engineer', 'militia', 'artillery'];
        for (const key of expectedKeys) {
            assert.ok(key in UNIT_SPRITES, `Missing sprite: ${key}`);
        }
    });

    it('all sprite names should start with "unit-"', () => {
        for (const [key, name] of Object.entries(UNIT_SPRITES)) {
            assert.ok(name.startsWith('unit-'), `${key} sprite name "${name}" should start with "unit-"`);
        }
    });
});
