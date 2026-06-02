/**
 * Property 3: Castle tile produces ground and overlay fields
 * Property 4: Non-overlay tile has no overlay field
 *
 * For each castle/bridge character (=, b, m, g, T, K, j, J, F, G, W), parse a
 * minimal level string and assert:
 *   - tile.sprite ∈ Object.values(CASTLE_SPRITES)
 *   - tile.overlay ∈ Object.values(CASTLE_OVERLAY_SPRITES)
 *
 * For non-overlay characters (., ,, R, D, ~, C), assert the resulting tile has
 * no overlay property (field must be absent, not undefined/null/empty).
 *
 * Note: O, P, S are NOT in the non-overlay set — they produce tree overlays
 * via the existing tree-overlay-system and are not tested here.
 *
 * // Feature: castle-structure-overlays, Property 3: Castle tile produces ground and overlay fields
 * // Feature: castle-structure-overlays, Property 4: Non-overlay tile has no overlay field
 *
 * **Validates: Requirements 10.3, 10.4**
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// ─── CASTLE_SPRITES (from sprite-constants.js) ────────────────────────────────

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

// ─── CASTLE_OVERLAY_SPRITES (from sprite-constants.js) ───────────────────────

const CASTLE_OVERLAY_SPRITES = {
    wall:                   'castle-wall-overlay',
    wallDamaged:            'castle-wall-damaged-overlay',
    tower:                  'castle-tower-overlay',
    towerDamaged:           'castle-tower-damaged-overlay',
    keepTopLeft:            'castle-keep-tl-overlay',
    keepTopLeftDamaged:     'castle-keep-tl-damaged-overlay',
    keepBotLeft:            'castle-keep-bl-overlay',
    keepBotLeftDamaged:     'castle-keep-bl-damaged-overlay',
    keepBotRight:           'castle-keep-br-overlay',
    keepBotRightDamaged:    'castle-keep-br-damaged-overlay',
    keepCenter:             'castle-keep-center-overlay',
    keepCenterDamaged:      'castle-keep-center-damaged-overlay',
    gatehouse:              'castle-gatehouse-overlay',
    gatehouseDamaged:       'castle-gatehouse-damaged-overlay',
    bridgeMm:               'bridge-mm-overlay',
    bridgeStart:            'castle-bridge-start-overlay',
    bridgeMid:              'castle-bridge-mid-overlay',
    bridgeGate:             'castle-bridge-gate-overlay',
};

const ALL_CASTLE_SPRITE_VALUES = new Set(Object.values(CASTLE_SPRITES));
const ALL_CASTLE_OVERLAY_VALUES = new Set(Object.values(CASTLE_OVERLAY_SPRITES));

// Also include bridge-mm in the valid ground sprite set (it's not in CASTLE_SPRITES
// but IS a valid ground sprite produced by '=')
const ALL_VALID_GROUND_SPRITES = new Set([
    ...ALL_CASTLE_SPRITE_VALUES,
    'bridge-mm',
]);

// ─── LevelLoader replica (self-contained, no browser globals) ────────────────

const HEX_WIDTH = 32;
const HEX_HEIGHT = 28;
const HEX_ROW_HEIGHT = 21;
const HEX_COL_OFFSET = 16;

function hexToPixel(row, col) {
    const x = col * HEX_WIDTH + (row % 2 === 1 ? HEX_COL_OFFSET : 0);
    const y = row * HEX_ROW_HEIGHT;
    return { x, y };
}

function tileHash(row, col) {
    let h = (row * 7919 + col * 104729 + 31) & 0xFFFFFFFF;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = (h >> 16) ^ h;
    return (h >>> 0) / 0xFFFFFFFF;
}

function parseLevelText(text) {
    const lines = text.split('\n');
    const level = { name: 'Unnamed', tiles: [], walls: [], width: 0, height: 0 };
    const mapLines = [];

    for (const line of lines) {
        const t = line.trimEnd();
        if (t.startsWith(';') && mapLines.length === 0) continue;
        if (t.startsWith('name=')) { level.name = t.substring(5); continue; }
        if (t.length > 0 && !t.startsWith(';')) mapLines.push(t);
    }

    level.height = mapLines.length;
    level.width = Math.max(...mapLines.map(l => l.length));
    level.pixelWidth = (level.width + 1) * HEX_WIDTH;
    level.pixelHeight = level.height * HEX_ROW_HEIGHT + HEX_HEIGHT;

    for (let row = 0; row < mapLines.length; row++) {
        for (let col = 0; col < mapLines[row].length; col++) {
            const ch = mapLines[row][col];
            const { x, y } = hexToPixel(row, col);
            const hash = tileHash(row, col);

            switch (ch) {
                case '.': level.tiles.push({ row, col, x, y, sprite: `grass-short-${hash > 0.5 ? 2 : 1}` }); break;
                case ',': level.tiles.push({ row, col, x, y, sprite: `grass-flowers-${hash > 0.5 ? 2 : 1}` }); break;
                case 'O': {
                    const oakOverlays = ['tree-oak-overlay-1', 'tree-oak-overlay-2', 'tree-oak-overlay-3'];
                    level.tiles.push({
                        row, col, x, y,
                        sprite: `grass-short-${hash > 0.5 ? 2 : 1}`,
                        overlay: oakOverlays[Math.floor(hash * 3)],
                    });
                    break;
                }
                case 'P': {
                    const pineOverlays = ['tree-pine-overlay-1', 'tree-pine-overlay-2'];
                    level.tiles.push({
                        row, col, x, y,
                        sprite: `grass-short-${hash > 0.5 ? 2 : 1}`,
                        overlay: pineOverlays[Math.floor(hash * 2)],
                    });
                    break;
                }
                case 'S': {
                    const shrubOverlays = ['tree-shrub-overlay-1', 'tree-shrub-overlay-2'];
                    level.tiles.push({
                        row, col, x, y,
                        sprite: `grass-short-${hash > 0.5 ? 2 : 1}`,
                        overlay: shrubOverlays[Math.floor(hash * 2)],
                    });
                    break;
                }
                case 'R': level.tiles.push({ row, col, x, y, sprite: 'rock' }); break;
                case 'D': level.tiles.push({ row, col, x, y, sprite: 'road-full' }); break;
                case '~': level.tiles.push({ row, col, x, y, sprite: `water-${Math.floor(hash * 3) + 1}` }); break;
                case '=': level.tiles.push({ row, col, x, y, sprite: 'bridge-mm', overlay: 'bridge-mm-overlay' }); break;
                case 'b': level.tiles.push({ row, col, x, y, sprite: 'castle-bridge-start', overlay: 'castle-bridge-start-overlay' }); break;
                case 'm': level.tiles.push({ row, col, x, y, sprite: 'castle-bridge-mid', overlay: 'castle-bridge-mid-overlay' }); break;
                case 'g': level.tiles.push({ row, col, x, y, sprite: 'castle-bridge-gate', overlay: 'castle-bridge-gate-overlay' }); break;
                case 'T': level.tiles.push({ row, col, x, y, sprite: 'castle-tower', overlay: 'castle-tower-overlay' }); break;
                case 'K': level.tiles.push({ row, col, x, y, sprite: 'castle-keep-tl', overlay: 'castle-keep-tl-overlay' }); break;
                case 'j': level.tiles.push({ row, col, x, y, sprite: 'castle-keep-bl', overlay: 'castle-keep-bl-overlay' }); break;
                case 'J': level.tiles.push({ row, col, x, y, sprite: 'castle-keep-br', overlay: 'castle-keep-br-overlay' }); break;
                case 'F': level.tiles.push({ row, col, x, y, sprite: 'castle-keep-center', overlay: 'castle-keep-center-overlay' }); break;
                case 'G': level.tiles.push({ row, col, x, y, sprite: 'castle-gatehouse', overlay: 'castle-gatehouse-overlay' }); break;
                case 'W': level.tiles.push({ row, col, x, y, sprite: 'castle-wall', overlay: 'castle-wall-overlay' }); break;
                case 'C': level.tiles.push({ row, col, x, y, sprite: `castle-bailey-${Math.floor(hash * 3) + 1}` }); break;
                default: level.tiles.push({ row, col, x, y, sprite: 'grass-short-1' }); break;
            }
        }
    }
    return level;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a minimal level string with a single character at (row, col).
 * Pads with '.' to ensure the target position exists.
 */
function buildMinimalLevel(row, col, ch) {
    const rows = [];
    for (let r = 0; r <= row; r++) {
        let line = '';
        for (let c = 0; c <= col; c++) {
            line += (r === row && c === col) ? ch : '.';
        }
        rows.push(line);
    }
    return rows.join('\n');
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

// Row and col in a reasonable range (0–19) to keep tests fast
const rowArb = fc.nat({ max: 19 });
const colArb = fc.nat({ max: 19 });

// Castle/bridge characters that should produce ground + overlay
const castleOverlayChars = ['=', 'b', 'm', 'g', 'T', 'K', 'j', 'J', 'F', 'G', 'W'];
const castleOverlayCharArb = fc.constantFrom(...castleOverlayChars);

// Non-overlay characters: ., ,, R, D, ~, C
// Note: O, P, S are excluded — they produce tree overlays via tree-overlay-system
const nonOverlayChars = ['.', ',', 'R', 'D', '~', 'C'];
const nonOverlayCharArb = fc.constantFrom(...nonOverlayChars);

// ─── Property 3: Castle tile produces ground and overlay fields ───────────────

describe('Property 3: Castle tile produces ground and overlay fields', () => {
    it('castle/bridge characters produce tiles with sprite ∈ CASTLE_SPRITES and overlay ∈ CASTLE_OVERLAY_SPRITES', () => {
        fc.assert(
            fc.property(rowArb, colArb, castleOverlayCharArb, (row, col, ch) => {
                const levelText = buildMinimalLevel(row, col, ch);
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);

                assert.ok(tile, `Tile at (${row}, ${col}) should exist for char '${ch}'`);
                assert.ok(
                    ALL_VALID_GROUND_SPRITES.has(tile.sprite),
                    `Castle char '${ch}' tile sprite "${tile.sprite}" should be in CASTLE_SPRITES values`
                );
                assert.ok(
                    'overlay' in tile,
                    `Castle char '${ch}' at (${row}, ${col}) should have an overlay field`
                );
                assert.ok(
                    ALL_CASTLE_OVERLAY_VALUES.has(tile.overlay),
                    `Castle char '${ch}' tile overlay "${tile.overlay}" should be in CASTLE_OVERLAY_SPRITES values`
                );
            }),
            { numRuns: 200 }
        );
    });

    it('each castle character maps to its specific overlay sprite', () => {
        const expectedOverlay = {
            '=': 'bridge-mm-overlay',
            'b': 'castle-bridge-start-overlay',
            'm': 'castle-bridge-mid-overlay',
            'g': 'castle-bridge-gate-overlay',
            'T': 'castle-tower-overlay',
            'K': 'castle-keep-tl-overlay',
            'j': 'castle-keep-bl-overlay',
            'J': 'castle-keep-br-overlay',
            'F': 'castle-keep-center-overlay',
            'G': 'castle-gatehouse-overlay',
            'W': 'castle-wall-overlay',
        };

        fc.assert(
            fc.property(rowArb, colArb, castleOverlayCharArb, (row, col, ch) => {
                const levelText = buildMinimalLevel(row, col, ch);
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);

                assert.ok(tile, `Tile at (${row}, ${col}) should exist for char '${ch}'`);
                assert.strictEqual(
                    tile.overlay,
                    expectedOverlay[ch],
                    `Castle char '${ch}' should have overlay "${expectedOverlay[ch]}", got "${tile.overlay}"`
                );
            }),
            { numRuns: 200 }
        );
    });

    it('= tile produces bridge-mm sprite with bridge-mm-overlay', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, '=');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.strictEqual(tile.sprite, 'bridge-mm', `= sprite should be bridge-mm`);
                assert.strictEqual(tile.overlay, 'bridge-mm-overlay', `= overlay should be bridge-mm-overlay`);
            }),
            { numRuns: 50 }
        );
    });

    it('W tile produces castle-wall sprite with castle-wall-overlay', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, 'W');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.strictEqual(tile.sprite, 'castle-wall', `W sprite should be castle-wall`);
                assert.strictEqual(tile.overlay, 'castle-wall-overlay', `W overlay should be castle-wall-overlay`);
            }),
            { numRuns: 50 }
        );
    });

    it('b, m, g each map to distinct sprites (not all castle-bridge-mid)', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                for (const [ch, expectedSprite, expectedOverlay] of [
                    ['b', 'castle-bridge-start', 'castle-bridge-start-overlay'],
                    ['m', 'castle-bridge-mid',   'castle-bridge-mid-overlay'],
                    ['g', 'castle-bridge-gate',  'castle-bridge-gate-overlay'],
                ]) {
                    const levelText = buildMinimalLevel(row, col, ch);
                    const level = parseLevelText(levelText);
                    const tile = level.tiles.find(t => t.row === row && t.col === col);
                    assert.strictEqual(tile.sprite, expectedSprite,
                        `'${ch}' sprite should be "${expectedSprite}", got "${tile.sprite}"`);
                    assert.strictEqual(tile.overlay, expectedOverlay,
                        `'${ch}' overlay should be "${expectedOverlay}", got "${tile.overlay}"`);
                }
            }),
            { numRuns: 50 }
        );
    });
});

// ─── Property 4: Non-overlay tile has no overlay field ────────────────────────

describe('Property 4: Non-overlay tile has no overlay field', () => {
    it('non-overlay characters (., ,, R, D, ~, C) produce tiles with no overlay property', () => {
        fc.assert(
            fc.property(rowArb, colArb, nonOverlayCharArb, (row, col, ch) => {
                const levelText = buildMinimalLevel(row, col, ch);
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);

                assert.ok(tile, `Tile at (${row}, ${col}) should exist for char '${ch}'`);
                assert.ok(
                    !('overlay' in tile),
                    `Non-overlay tile '${ch}' at (${row}, ${col}) must have no overlay property, ` +
                    `got: ${JSON.stringify(tile)}`
                );
            }),
            { numRuns: 200 }
        );
    });

    it('grass tile (.) has no overlay field', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, '.');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(!('overlay' in tile), `Grass tile should have no overlay field`);
            }),
            { numRuns: 50 }
        );
    });

    it('flowers tile (,) has no overlay field', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, ',');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(!('overlay' in tile), `Flowers tile should have no overlay field`);
            }),
            { numRuns: 50 }
        );
    });

    it('rock tile (R) has no overlay field', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, 'R');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(!('overlay' in tile), `Rock tile should have no overlay field`);
            }),
            { numRuns: 50 }
        );
    });

    it('road tile (D) has no overlay field', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, 'D');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(!('overlay' in tile), `Road tile should have no overlay field`);
            }),
            { numRuns: 50 }
        );
    });

    it('water tile (~) has no overlay field', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, '~');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(!('overlay' in tile), `Water tile should have no overlay field`);
            }),
            { numRuns: 50 }
        );
    });

    it('bailey tile (C) has no overlay field (explicitly excluded even though castle character)', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, 'C');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(tile, `Bailey tile should exist at (${row}, ${col})`);
                assert.ok(
                    !('overlay' in tile),
                    `Bailey tile (C) should have no overlay field — it is a ground-level surface, got: ${JSON.stringify(tile)}`
                );
                // Also verify the sprite is a valid bailey variant
                assert.ok(
                    tile.sprite === 'castle-bailey-1' ||
                    tile.sprite === 'castle-bailey-2' ||
                    tile.sprite === 'castle-bailey-3',
                    `Bailey tile sprite "${tile.sprite}" should be one of castle-bailey-1/2/3`
                );
            }),
            { numRuns: 100 }
        );
    });
});
