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

// ─── TREE_OVERLAY_SPRITES tests (added for tree-overlay-system feature) ──────

const { TREE_OVERLAY_SPRITES } = require('../../../js/level-generators/lib/sprite-constants');

describe('sprite-constants: TREE_OVERLAY_SPRITES registry', () => {
    it('should be exported from sprite-constants', () => {
        assert.ok(TREE_OVERLAY_SPRITES !== undefined, 'TREE_OVERLAY_SPRITES should be exported');
        assert.ok(typeof TREE_OVERLAY_SPRITES === 'object' && TREE_OVERLAY_SPRITES !== null);
    });

    it('should have exactly 7 entries', () => {
        assert.equal(Object.keys(TREE_OVERLAY_SPRITES).length, 7);
    });

    it('should contain all seven canonical overlay sprite keys', () => {
        const expectedKeys = [
            'treeOakOverlay1',
            'treeOakOverlay2',
            'treeOakOverlay3',
            'treePineOverlay1',
            'treePineOverlay2',
            'treeShrubOverlay1',
            'treeShrubOverlay2',
        ];
        for (const key of expectedKeys) {
            assert.ok(key in TREE_OVERLAY_SPRITES, `Missing key: ${key}`);
        }
    });

    it('should map to the correct canonical sprite name strings', () => {
        assert.equal(TREE_OVERLAY_SPRITES.treeOakOverlay1,   'tree-oak-overlay-1');
        assert.equal(TREE_OVERLAY_SPRITES.treeOakOverlay2,   'tree-oak-overlay-2');
        assert.equal(TREE_OVERLAY_SPRITES.treeOakOverlay3,   'tree-oak-overlay-3');
        assert.equal(TREE_OVERLAY_SPRITES.treePineOverlay1,  'tree-pine-overlay-1');
        assert.equal(TREE_OVERLAY_SPRITES.treePineOverlay2,  'tree-pine-overlay-2');
        assert.equal(TREE_OVERLAY_SPRITES.treeShrubOverlay1, 'tree-shrub-overlay-1');
        assert.equal(TREE_OVERLAY_SPRITES.treeShrubOverlay2, 'tree-shrub-overlay-2');
    });

    it('all sprite name values should be non-empty strings', () => {
        for (const [key, name] of Object.entries(TREE_OVERLAY_SPRITES)) {
            assert.ok(typeof name === 'string' && name.length > 0,
                `${key} should map to a non-empty string, got: ${JSON.stringify(name)}`);
        }
    });

    it('oak overlay names should start with "tree-oak-overlay-"', () => {
        const oakKeys = ['treeOakOverlay1', 'treeOakOverlay2', 'treeOakOverlay3'];
        for (const key of oakKeys) {
            assert.ok(
                TREE_OVERLAY_SPRITES[key].startsWith('tree-oak-overlay-'),
                `${key} value "${TREE_OVERLAY_SPRITES[key]}" should start with "tree-oak-overlay-"`
            );
        }
    });

    it('pine overlay names should start with "tree-pine-overlay-"', () => {
        const pineKeys = ['treePineOverlay1', 'treePineOverlay2'];
        for (const key of pineKeys) {
            assert.ok(
                TREE_OVERLAY_SPRITES[key].startsWith('tree-pine-overlay-'),
                `${key} value "${TREE_OVERLAY_SPRITES[key]}" should start with "tree-pine-overlay-"`
            );
        }
    });

    it('shrub overlay names should start with "tree-shrub-overlay-"', () => {
        const shrubKeys = ['treeShrubOverlay1', 'treeShrubOverlay2'];
        for (const key of shrubKeys) {
            assert.ok(
                TREE_OVERLAY_SPRITES[key].startsWith('tree-shrub-overlay-'),
                `${key} value "${TREE_OVERLAY_SPRITES[key]}" should start with "tree-shrub-overlay-"`
            );
        }
    });

    it('all sprite name values should be unique (no duplicates)', () => {
        const values = Object.values(TREE_OVERLAY_SPRITES);
        const unique = new Set(values);
        assert.equal(unique.size, values.length, 'All overlay sprite names should be unique');
    });

    it('overlay sprite names should not collide with TERRAIN_SPRITES values', () => {
        const {
            TERRAIN_SPRITES: terrain,
        } = require('../../../js/level-generators/lib/sprite-constants');
        const terrainValues = new Set(Object.values(terrain));
        for (const [key, name] of Object.entries(TREE_OVERLAY_SPRITES)) {
            assert.ok(
                !terrainValues.has(name),
                `Overlay sprite "${name}" (${key}) collides with a TERRAIN_SPRITES value`
            );
        }
    });

    it('should have 3 oak variants, 2 pine variants, and 2 shrub variants', () => {
        const values = Object.values(TREE_OVERLAY_SPRITES);
        const oakCount   = values.filter(v => v.startsWith('tree-oak-overlay-')).length;
        const pineCount  = values.filter(v => v.startsWith('tree-pine-overlay-')).length;
        const shrubCount = values.filter(v => v.startsWith('tree-shrub-overlay-')).length;
        assert.equal(oakCount,   3, 'Should have 3 oak overlay variants');
        assert.equal(pineCount,  2, 'Should have 2 pine overlay variants');
        assert.equal(shrubCount, 2, 'Should have 2 shrub overlay variants');
    });
});

// ─── CASTLE_OVERLAY_SPRITES tests (added for castle-structure-overlays feature) ──

const { CASTLE_OVERLAY_SPRITES } = require('../../../js/level-generators/lib/sprite-constants');

describe('sprite-constants: CASTLE_OVERLAY_SPRITES registry', () => {
    it('should be exported from sprite-constants', () => {
        assert.ok(CASTLE_OVERLAY_SPRITES !== undefined, 'CASTLE_OVERLAY_SPRITES should be exported');
        assert.ok(typeof CASTLE_OVERLAY_SPRITES === 'object' && CASTLE_OVERLAY_SPRITES !== null);
    });

    it('should have exactly 23 entries (20 original + 3 keep-full states)', () => {
        assert.equal(Object.keys(CASTLE_OVERLAY_SPRITES).length, 23);
    });

    it('should contain all expected undamaged overlay keys', () => {
        const expectedUndamaged = [
            'wall', 'tower',
            'keepTopLeft', 'keepBotLeft', 'keepBotRight', 'keepCenter',
            'gatehouse',
            'bridgeMm', 'bridgeStart', 'bridgeMid', 'bridgeGate',
            'isoWall',
        ];
        for (const key of expectedUndamaged) {
            assert.ok(key in CASTLE_OVERLAY_SPRITES, `Missing undamaged key: ${key}`);
        }
    });

    it('should contain all expected damaged overlay keys', () => {
        const expectedDamaged = [
            'wallDamaged', 'towerDamaged',
            'keepTopLeftDamaged', 'keepBotLeftDamaged', 'keepBotRightDamaged', 'keepCenterDamaged',
            'gatehouseDamaged',
            'isoWallDamaged',
        ];
        for (const key of expectedDamaged) {
            assert.ok(key in CASTLE_OVERLAY_SPRITES, `Missing damaged key: ${key}`);
        }
    });

    it('should map to the correct canonical sprite name strings', () => {
        assert.equal(CASTLE_OVERLAY_SPRITES.wall,                   'castle-wall-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.wallDamaged,            'castle-wall-damaged-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.tower,                  'castle-tower-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.towerDamaged,           'castle-tower-damaged-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.keepTopLeft,            'castle-keep-tl-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.keepTopLeftDamaged,     'castle-keep-tl-damaged-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.keepBotLeft,            'castle-keep-bl-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.keepBotLeftDamaged,     'castle-keep-bl-damaged-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.keepBotRight,           'castle-keep-br-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.keepBotRightDamaged,    'castle-keep-br-damaged-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.keepCenter,             'castle-keep-center-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.keepCenterDamaged,      'castle-keep-center-damaged-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.gatehouse,              'castle-gatehouse-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.gatehouseDamaged,       'castle-gatehouse-damaged-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.bridgeMm,               'bridge-mm-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.bridgeStart,            'castle-bridge-start-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.bridgeMid,              'castle-bridge-mid-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.bridgeGate,             'castle-bridge-gate-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.isoWall,                'castle-iso-wall-overlay');
        assert.equal(CASTLE_OVERLAY_SPRITES.isoWallDamaged,         'castle-iso-wall-damaged-overlay');
    });

    it('all sprite name values should be non-empty strings', () => {
        for (const [key, name] of Object.entries(CASTLE_OVERLAY_SPRITES)) {
            assert.ok(
                typeof name === 'string' && name.length > 0,
                `${key} should map to a non-empty string, got: ${JSON.stringify(name)}`
            );
        }
    });

    it('all sprite name values should be unique (no duplicates)', () => {
        const values = Object.values(CASTLE_OVERLAY_SPRITES);
        const unique = new Set(values);
        assert.equal(unique.size, values.length, 'All castle overlay sprite names should be unique');
    });

    it('wall and bridge overlay names should end with "-overlay"', () => {
        const wallBridgeKeys = ['wall', 'wallDamaged', 'bridgeMm', 'bridgeStart', 'bridgeMid', 'bridgeGate'];
        for (const key of wallBridgeKeys) {
            assert.ok(
                CASTLE_OVERLAY_SPRITES[key].endsWith('-overlay'),
                `${key} value "${CASTLE_OVERLAY_SPRITES[key]}" should end with "-overlay"`
            );
        }
    });

    it('damaged overlay names should contain "-damaged-overlay"', () => {
        const damagedKeys = [
            'wallDamaged', 'towerDamaged',
            'keepTopLeftDamaged', 'keepBotLeftDamaged', 'keepBotRightDamaged', 'keepCenterDamaged',
            'gatehouseDamaged',
        ];
        for (const key of damagedKeys) {
            assert.ok(
                CASTLE_OVERLAY_SPRITES[key].includes('-damaged-overlay'),
                `${key} value "${CASTLE_OVERLAY_SPRITES[key]}" should contain "-damaged-overlay"`
            );
        }
    });

    it('bridge overlay names should have no damaged variants', () => {
        const bridgeKeys = ['bridgeMm', 'bridgeStart', 'bridgeMid', 'bridgeGate'];
        for (const key of bridgeKeys) {
            assert.ok(
                !CASTLE_OVERLAY_SPRITES[key].includes('-damaged-'),
                `Bridge overlay "${key}" should not have a damaged variant in its name`
            );
        }
        // Confirm no damagedBridge* keys exist
        const allKeys = Object.keys(CASTLE_OVERLAY_SPRITES);
        const damagedBridgeKeys = allKeys.filter(k => k.startsWith('bridge') && k.includes('Damaged'));
        assert.equal(damagedBridgeKeys.length, 0, 'Bridge overlays should have no damaged variant keys');
    });

    it('should have 8 damaged variants and 12 undamaged variants', () => {
        const values = Object.values(CASTLE_OVERLAY_SPRITES);
        const damagedCount   = values.filter(v => v.includes('-damaged-overlay')).length;
        const undamagedCount = values.filter(v => v.endsWith('-overlay') && !v.includes('-damaged-')).length;
        // 9 damaged (original 8 + keep-damaged), 14 undamaged (original 12 + keep + keep-destroyed)
        assert.equal(damagedCount,   9,  'Should have 9 damaged overlay variants');
        assert.equal(undamagedCount, 14, 'Should have 14 undamaged overlay variants');
    });

    it('should not collide with CASTLE_SPRITES values', () => {
        const {
            CASTLE_SPRITES: castleFlat,
        } = require('../../../js/level-generators/lib/sprite-constants');
        const flatValues = new Set(Object.values(castleFlat));
        for (const [key, name] of Object.entries(CASTLE_OVERLAY_SPRITES)) {
            assert.ok(
                !flatValues.has(name),
                `Castle overlay sprite "${name}" (${key}) collides with a CASTLE_SPRITES value`
            );
        }
    });

    it('should not collide with TERRAIN_SPRITES or TREE_OVERLAY_SPRITES values', () => {
        const {
            TERRAIN_SPRITES: terrain,
            TREE_OVERLAY_SPRITES: treeOverlays,
        } = require('../../../js/level-generators/lib/sprite-constants');
        const otherValues = new Set([
            ...Object.values(terrain),
            ...Object.values(treeOverlays),
        ]);
        for (const [key, name] of Object.entries(CASTLE_OVERLAY_SPRITES)) {
            assert.ok(
                !otherValues.has(name),
                `Castle overlay sprite "${name}" (${key}) collides with a terrain or tree overlay sprite name`
            );
        }
    });

    it('keep overlay names should reference the correct quadrant abbreviations', () => {
        assert.ok(CASTLE_OVERLAY_SPRITES.keepTopLeft.includes('-tl-'),    'keepTopLeft should contain "-tl-"');
        assert.ok(CASTLE_OVERLAY_SPRITES.keepBotLeft.includes('-bl-'),    'keepBotLeft should contain "-bl-"');
        assert.ok(CASTLE_OVERLAY_SPRITES.keepBotRight.includes('-br-'),   'keepBotRight should contain "-br-"');
        assert.ok(CASTLE_OVERLAY_SPRITES.keepCenter.includes('-center-'), 'keepCenter should contain "-center-"');
    });
});
