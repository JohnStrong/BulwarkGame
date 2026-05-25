/**
 * Property 3: Tree tile produces ground and overlay fields
 * Property 4: Non-tree tile has no overlay field
 *
 * For each tree character (O, P, S), parse a minimal level string and assert:
 *   - tile.sprite ∈ {grass-short-1, grass-short-2}
 *   - tile.overlay ∈ Object.values(TREE_OVERLAY_SPRITES)
 *
 * For non-tree characters, assert the resulting tile has no overlay property.
 *
 * // Feature: tree-overlay-system, Property 3: Tree tile produces ground and overlay fields
 * // Feature: tree-overlay-system, Property 4: Non-tree tile has no overlay field
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 6.4**
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// ─── TREE_OVERLAY_SPRITES (from sprite-constants.js) ─────────────────────────

const TREE_OVERLAY_SPRITES = {
    treeOakOverlay1:   'tree-oak-overlay-1',
    treeOakOverlay2:   'tree-oak-overlay-2',
    treeOakOverlay3:   'tree-oak-overlay-3',
    treePineOverlay1:  'tree-pine-overlay-1',
    treePineOverlay2:  'tree-pine-overlay-2',
    treeShrubOverlay1: 'tree-shrub-overlay-1',
    treeShrubOverlay2: 'tree-shrub-overlay-2',
};

const ALL_OVERLAY_VALUES = new Set(Object.values(TREE_OVERLAY_SPRITES));
const GRASS_SPRITES = new Set(['grass-short-1', 'grass-short-2']);

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
                case '=': level.tiles.push({ row, col, x, y, sprite: 'bridge-mm' }); break;
                case 'b': level.tiles.push({ row, col, x, y, sprite: 'castle-bridge-mid' }); break;
                case 'm': level.tiles.push({ row, col, x, y, sprite: 'castle-bridge-mid' }); break;
                case 'g': level.tiles.push({ row, col, x, y, sprite: 'castle-bridge-mid' }); break;
                case 'T': level.tiles.push({ row, col, x, y, sprite: 'castle-tower' }); break;
                case 'K': level.tiles.push({ row, col, x, y, sprite: 'castle-keep-tl' }); break;
                case 'j': level.tiles.push({ row, col, x, y, sprite: 'castle-keep-bl' }); break;
                case 'J': level.tiles.push({ row, col, x, y, sprite: 'castle-keep-br' }); break;
                case 'F': level.tiles.push({ row, col, x, y, sprite: 'castle-keep-center' }); break;
                case 'G': level.tiles.push({ row, col, x, y, sprite: 'castle-gatehouse' }); break;
                case 'W': level.tiles.push({ row, col, x, y, sprite: 'castle-wall' }); break;
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
const rowArb = fc.integer({ min: 0, max: 19 });
const colArb = fc.integer({ min: 0, max: 19 });

// Non-tree characters that should produce no overlay
const nonTreeChars = ['.', ',', 'R', 'D', '~', '=', 'T', 'K', 'j', 'J', 'F', 'G', 'W', 'C'];
const nonTreeCharArb = fc.constantFrom(...nonTreeChars);

// ─── Property 3: Tree tile produces ground and overlay fields ─────────────────

describe('Property 3: Tree tile produces ground and overlay fields', () => {
    it('O tile: sprite ∈ {grass-short-1, grass-short-2} and overlay ∈ TREE_OVERLAY_SPRITES', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, 'O');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);

                assert.ok(tile, `Tile at (${row}, ${col}) should exist`);
                assert.ok(
                    GRASS_SPRITES.has(tile.sprite),
                    `O tile sprite "${tile.sprite}" should be in {grass-short-1, grass-short-2}`
                );
                assert.ok(
                    tile.overlay !== undefined,
                    `O tile at (${row}, ${col}) should have an overlay field`
                );
                assert.ok(
                    ALL_OVERLAY_VALUES.has(tile.overlay),
                    `O tile overlay "${tile.overlay}" should be in TREE_OVERLAY_SPRITES values`
                );
                assert.ok(
                    tile.overlay.startsWith('tree-oak-overlay-'),
                    `O tile overlay "${tile.overlay}" should start with tree-oak-overlay-`
                );
            }),
            { numRuns: 100 }
        );
    });

    it('P tile: sprite ∈ {grass-short-1, grass-short-2} and overlay ∈ TREE_OVERLAY_SPRITES', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, 'P');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);

                assert.ok(tile, `Tile at (${row}, ${col}) should exist`);
                assert.ok(
                    GRASS_SPRITES.has(tile.sprite),
                    `P tile sprite "${tile.sprite}" should be in {grass-short-1, grass-short-2}`
                );
                assert.ok(
                    tile.overlay !== undefined,
                    `P tile at (${row}, ${col}) should have an overlay field`
                );
                assert.ok(
                    ALL_OVERLAY_VALUES.has(tile.overlay),
                    `P tile overlay "${tile.overlay}" should be in TREE_OVERLAY_SPRITES values`
                );
                assert.ok(
                    tile.overlay.startsWith('tree-pine-overlay-'),
                    `P tile overlay "${tile.overlay}" should start with tree-pine-overlay-`
                );
            }),
            { numRuns: 100 }
        );
    });

    it('S tile: sprite ∈ {grass-short-1, grass-short-2} and overlay ∈ TREE_OVERLAY_SPRITES', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, 'S');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);

                assert.ok(tile, `Tile at (${row}, ${col}) should exist`);
                assert.ok(
                    GRASS_SPRITES.has(tile.sprite),
                    `S tile sprite "${tile.sprite}" should be in {grass-short-1, grass-short-2}`
                );
                assert.ok(
                    tile.overlay !== undefined,
                    `S tile at (${row}, ${col}) should have an overlay field`
                );
                assert.ok(
                    ALL_OVERLAY_VALUES.has(tile.overlay),
                    `S tile overlay "${tile.overlay}" should be in TREE_OVERLAY_SPRITES values`
                );
                assert.ok(
                    tile.overlay.startsWith('tree-shrub-overlay-'),
                    `S tile overlay "${tile.overlay}" should start with tree-shrub-overlay-`
                );
            }),
            { numRuns: 100 }
        );
    });

    it('O tile overlay is always one of the 3 oak variants', () => {
        const oakVariants = new Set(['tree-oak-overlay-1', 'tree-oak-overlay-2', 'tree-oak-overlay-3']);
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, 'O');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(oakVariants.has(tile.overlay), `O overlay "${tile.overlay}" not in oak variants`);
            }),
            { numRuns: 100 }
        );
    });

    it('P tile overlay is always one of the 2 pine variants', () => {
        const pineVariants = new Set(['tree-pine-overlay-1', 'tree-pine-overlay-2']);
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, 'P');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(pineVariants.has(tile.overlay), `P overlay "${tile.overlay}" not in pine variants`);
            }),
            { numRuns: 100 }
        );
    });

    it('S tile overlay is always one of the 2 shrub variants', () => {
        const shrubVariants = new Set(['tree-shrub-overlay-1', 'tree-shrub-overlay-2']);
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, 'S');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(shrubVariants.has(tile.overlay), `S overlay "${tile.overlay}" not in shrub variants`);
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 4: Non-tree tile has no overlay field ───────────────────────────

describe('Property 4: Non-tree tile has no overlay field', () => {
    it('non-tree characters produce tiles with no overlay property', () => {
        fc.assert(
            fc.property(rowArb, colArb, nonTreeCharArb, (row, col, ch) => {
                const levelText = buildMinimalLevel(row, col, ch);
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);

                assert.ok(tile, `Tile at (${row}, ${col}) should exist for char '${ch}'`);
                assert.ok(
                    !('overlay' in tile),
                    `Non-tree tile '${ch}' at (${row}, ${col}) should have no overlay property, got: ${tile.overlay}`
                );
            }),
            { numRuns: 200 }
        );
    });

    it('grass tile (.) has no overlay', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, '.');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(!('overlay' in tile), `Grass tile should have no overlay`);
            }),
            { numRuns: 50 }
        );
    });

    it('water tile (~) has no overlay', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, '~');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(!('overlay' in tile), `Water tile should have no overlay`);
            }),
            { numRuns: 50 }
        );
    });

    it('castle tiles (T, K, W, G) have no overlay', () => {
        const castleChars = ['T', 'K', 'W', 'G', 'F', 'j', 'J'];
        fc.assert(
            fc.property(rowArb, colArb, fc.constantFrom(...castleChars), (row, col, ch) => {
                const levelText = buildMinimalLevel(row, col, ch);
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(!('overlay' in tile), `Castle tile '${ch}' should have no overlay`);
            }),
            { numRuns: 100 }
        );
    });

    it('road tile (D) has no overlay', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, 'D');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(!('overlay' in tile), `Road tile should have no overlay`);
            }),
            { numRuns: 50 }
        );
    });

    it('rock tile (R) has no overlay', () => {
        fc.assert(
            fc.property(rowArb, colArb, (row, col) => {
                const levelText = buildMinimalLevel(row, col, 'R');
                const level = parseLevelText(levelText);
                const tile = level.tiles.find(t => t.row === row && t.col === col);
                assert.ok(!('overlay' in tile), `Rock tile should have no overlay`);
            }),
            { numRuns: 50 }
        );
    });
});
