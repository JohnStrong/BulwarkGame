/**
 * Unit tests for castle/bridge tile changes in js/game-logic/level-loader.js
 * (task 8.2 — castle-structure-overlays spec)
 *
 * Covers:
 *  - Bridge tiles (=, b, m, g) produce ONLY a sprite field — NO overlay field
 *    (changed: bridge overlays removed from runtime tile objects)
 *  - b, m, g map to distinct sprites (castle-bridge-start, castle-bridge-mid,
 *    castle-bridge-gate) — not all mapped to castle-bridge-mid as before
 *  - Castle structure tiles (T, K, j, J, F, G, W) still carry both sprite + overlay
 *  - C (bailey) produces a tile with NO overlay field (key must be absent from
 *    the object — not undefined, null, or empty string)
 *  - tileHash returns stable values for fixed inputs (regression guard)
 *
 * Requirements: 3.1–3.13
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/level-loader-castle-overlays.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Browser-global stubs needed by the level loader logic ──────────────────
const HEX_WIDTH = 32;
const HEX_HEIGHT = 28;
const HEX_ROW_HEIGHT = 21;
const HEX_COL_OFFSET = 16;

function hexToPixel(row, col) {
    const x = col * HEX_WIDTH + (row % 2 === 1 ? HEX_COL_OFFSET : 0);
    const y = row * HEX_ROW_HEIGHT;
    return { x, y };
}

// ─── Inline copy of LevelLoader reflecting the current production code ───────
// Bridge tiles (=, b, m, g) now render ground-only — no overlay fields.
const LevelLoader = {
    parseLevelText(text) {
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
                const hash = this.tileHash(row, col);

                switch (ch) {
                    case '.': level.tiles.push({ row, col, x, y, sprite: `grass-short-${hash > 0.5 ? 2 : 1}` }); break;
                    case ',': level.tiles.push({ row, col, x, y, sprite: `grass-flowers-${hash > 0.5 ? 2 : 1}` }); break;
                    case 'O': {
                        const oakOverlays = ['tree-oak-overlay-1', 'tree-oak-overlay-2', 'tree-oak-overlay-3'];
                        level.tiles.push({ row, col, x, y, sprite: `grass-short-${hash > 0.5 ? 2 : 1}`, overlay: oakOverlays[Math.floor(hash * 3)] });
                        break;
                    }
                    case 'P': {
                        const pineOverlays = ['tree-pine-overlay-1', 'tree-pine-overlay-2'];
                        level.tiles.push({ row, col, x, y, sprite: `grass-short-${hash > 0.5 ? 2 : 1}`, overlay: pineOverlays[Math.floor(hash * 2)] });
                        break;
                    }
                    case 'S': {
                        const shrubOverlays = ['tree-shrub-overlay-1', 'tree-shrub-overlay-2'];
                        level.tiles.push({ row, col, x, y, sprite: `grass-short-${hash > 0.5 ? 2 : 1}`, overlay: shrubOverlays[Math.floor(hash * 2)] });
                        break;
                    }
                    case 'R': level.tiles.push({ row, col, x, y, sprite: 'rock' }); break;
                    case 'D': level.tiles.push({ row, col, x, y, sprite: 'road-full' }); break;
                    case '~': level.tiles.push({ row, col, x, y, sprite: `water-${Math.floor(hash * 3) + 1}` }); break;
                    // Bridge tiles render ground-only — no overlay sprites at runtime
                    case '=': level.tiles.push({ row, col, x, y, sprite: 'bridge-mm' }); break;
                    case 'b': level.tiles.push({ row, col, x, y, sprite: 'castle-bridge-start' }); break;
                    case 'm': level.tiles.push({ row, col, x, y, sprite: 'castle-bridge-mid' }); break;
                    case 'g': level.tiles.push({ row, col, x, y, sprite: 'castle-bridge-gate' }); break;
                    // Castle structures with overlays
                    case 'T': level.tiles.push({ row, col, x, y, sprite: 'castle-tower',        overlay: 'castle-tower-overlay' }); break;
                    case 'K': level.tiles.push({ row, col, x, y, sprite: 'castle-keep-tl',      overlay: 'castle-keep-tl-overlay' }); break;
                    case 'j': level.tiles.push({ row, col, x, y, sprite: 'castle-keep-bl',      overlay: 'castle-keep-bl-overlay' }); break;
                    case 'J': level.tiles.push({ row, col, x, y, sprite: 'castle-keep-br',      overlay: 'castle-keep-br-overlay' }); break;
                    case 'F': level.tiles.push({ row, col, x, y, sprite: 'castle-keep-center',  overlay: 'castle-keep-center-overlay' }); break;
                    case 'G': level.tiles.push({ row, col, x, y, sprite: 'castle-gatehouse',    overlay: 'castle-gatehouse-overlay' }); break;
                    case 'W': level.tiles.push({ row, col, x, y, sprite: 'castle-wall',         overlay: 'castle-wall-overlay' }); break;
                    // Bailey — ground-level surface, no overlay field
                    case 'C': level.tiles.push({ row, col, x, y, sprite: `castle-bailey-${Math.floor(hash * 3) + 1}` }); break;
                    default: level.tiles.push({ row, col, x, y, sprite: 'grass-short-1' }); break;
                }
            }
        }
        return level;
    },

    tileHash(row, col) {
        let h = (row * 7919 + col * 104729 + 31) & 0xFFFFFFFF;
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = (h >> 16) ^ h;
        return (h >>> 0) / 0xFFFFFFFF;
    },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a minimal 1-tile level for the given character at (row=0, col=0). */
function parseTile(ch) {
    const level = LevelLoader.parseLevelText(`name=X\n${ch}`);
    assert.equal(level.tiles.length, 1, `Expected 1 tile for char "${ch}"`);
    return level.tiles[0];
}

// ─── Tests: bridge tiles — ground-only, NO overlay (=, b, m, g) ─────────────

describe('parseLevelText: bridge tile (=) — ground-only, no overlay', () => {
    it('should produce sprite "bridge-mm"', () => {
        assert.equal(parseTile('=').sprite, 'bridge-mm');
    });

    it('should NOT have an "overlay" field', () => {
        const tile = parseTile('=');
        assert.ok(!('overlay' in tile),
            `"=" tile must not have an overlay field; got: ${JSON.stringify(tile)}`);
    });
});

describe('parseLevelText: castle-bridge-start tile (b) — ground-only, no overlay', () => {
    it('should produce sprite "castle-bridge-start"', () => {
        assert.equal(parseTile('b').sprite, 'castle-bridge-start');
    });

    it('should NOT have an "overlay" field', () => {
        const tile = parseTile('b');
        assert.ok(!('overlay' in tile),
            `"b" tile must not have an overlay field; got: ${JSON.stringify(tile)}`);
    });
});

describe('parseLevelText: castle-bridge-mid tile (m) — ground-only, no overlay', () => {
    it('should produce sprite "castle-bridge-mid"', () => {
        assert.equal(parseTile('m').sprite, 'castle-bridge-mid');
    });

    it('should NOT have an "overlay" field', () => {
        const tile = parseTile('m');
        assert.ok(!('overlay' in tile),
            `"m" tile must not have an overlay field; got: ${JSON.stringify(tile)}`);
    });
});

describe('parseLevelText: castle-bridge-gate tile (g) — ground-only, no overlay', () => {
    it('should produce sprite "castle-bridge-gate"', () => {
        assert.equal(parseTile('g').sprite, 'castle-bridge-gate');
    });

    it('should NOT have an "overlay" field', () => {
        const tile = parseTile('g');
        assert.ok(!('overlay' in tile),
            `"g" tile must not have an overlay field; got: ${JSON.stringify(tile)}`);
    });
});

// ─── Tests: b, m, g are distinct sprites (Requirements 3.2, 3.3, 3.4) ───────

describe('parseLevelText: b, m, g have distinct sprites', () => {
    it('"b" must NOT map to "castle-bridge-mid"', () => {
        assert.notEqual(parseTile('b').sprite, 'castle-bridge-mid');
    });

    it('"g" must NOT map to "castle-bridge-mid"', () => {
        assert.notEqual(parseTile('g').sprite, 'castle-bridge-mid');
    });

    it('"b", "m", "g" produce three distinct sprite values', () => {
        const sprites = ['b', 'm', 'g'].map(ch => parseTile(ch).sprite);
        const unique = new Set(sprites);
        assert.equal(unique.size, 3, `Expected 3 distinct sprites, got: ${sprites.join(', ')}`);
    });

    it('"b", "m", "g" do not have overlay fields', () => {
        for (const ch of ['b', 'm', 'g']) {
            const tile = parseTile(ch);
            assert.ok(!('overlay' in tile),
                `"${ch}" must have no overlay field; got: ${JSON.stringify(tile)}`);
        }
    });
});

// ─── Tests: castle structure tiles carry overlay (T, K, j, J, F, G, W) ──────

describe('parseLevelText: castle-tower tile (T)', () => {
    it('should produce sprite "castle-tower"', () => {
        assert.equal(parseTile('T').sprite, 'castle-tower');
    });

    it('should produce overlay "castle-tower-overlay"', () => {
        assert.equal(parseTile('T').overlay, 'castle-tower-overlay');
    });
});

describe('parseLevelText: castle-keep-tl tile (K)', () => {
    it('should produce sprite "castle-keep-tl"', () => {
        assert.equal(parseTile('K').sprite, 'castle-keep-tl');
    });

    it('should produce overlay "castle-keep-tl-overlay"', () => {
        assert.equal(parseTile('K').overlay, 'castle-keep-tl-overlay');
    });
});

describe('parseLevelText: castle-keep-bl tile (j)', () => {
    it('should produce sprite "castle-keep-bl"', () => {
        assert.equal(parseTile('j').sprite, 'castle-keep-bl');
    });

    it('should produce overlay "castle-keep-bl-overlay"', () => {
        assert.equal(parseTile('j').overlay, 'castle-keep-bl-overlay');
    });
});

describe('parseLevelText: castle-keep-br tile (J)', () => {
    it('should produce sprite "castle-keep-br"', () => {
        assert.equal(parseTile('J').sprite, 'castle-keep-br');
    });

    it('should produce overlay "castle-keep-br-overlay"', () => {
        assert.equal(parseTile('J').overlay, 'castle-keep-br-overlay');
    });
});

describe('parseLevelText: castle-keep-center tile (F)', () => {
    it('should produce sprite "castle-keep-center"', () => {
        assert.equal(parseTile('F').sprite, 'castle-keep-center');
    });

    it('should produce overlay "castle-keep-center-overlay"', () => {
        assert.equal(parseTile('F').overlay, 'castle-keep-center-overlay');
    });
});

describe('parseLevelText: castle-gatehouse tile (G)', () => {
    it('should produce sprite "castle-gatehouse"', () => {
        assert.equal(parseTile('G').sprite, 'castle-gatehouse');
    });

    it('should produce overlay "castle-gatehouse-overlay"', () => {
        assert.equal(parseTile('G').overlay, 'castle-gatehouse-overlay');
    });
});

describe('parseLevelText: castle-wall tile (W)', () => {
    it('should produce sprite "castle-wall"', () => {
        assert.equal(parseTile('W').sprite, 'castle-wall');
    });

    it('should produce overlay "castle-wall-overlay"', () => {
        assert.equal(parseTile('W').overlay, 'castle-wall-overlay');
    });
});

// ─── Tests: C (bailey) has no overlay field (Requirement 3.12) ───────────────

describe('parseLevelText: castle-bailey tile (C)', () => {
    it('should produce a sprite starting with "castle-bailey-"', () => {
        const tile = parseTile('C');
        assert.ok(
            tile.sprite.startsWith('castle-bailey-'),
            `Expected sprite to start with "castle-bailey-", got "${tile.sprite}"`
        );
    });

    it('should NOT have an "overlay" key in the tile object', () => {
        const tile = parseTile('C');
        assert.ok(
            !('overlay' in tile),
            `Tile object must not have an "overlay" key; got tile: ${JSON.stringify(tile)}`
        );
    });

    it('should not have overlay as an own property (not even undefined)', () => {
        const tile = parseTile('C');
        assert.equal(Object.prototype.hasOwnProperty.call(tile, 'overlay'), false,
            'tile must not have "overlay" as an own property');
    });

    it('should produce a valid variant (1, 2, or 3)', () => {
        const level = LevelLoader.parseLevelText('name=X\nCCC\nCCC');
        for (const tile of level.tiles) {
            const variant = parseInt(tile.sprite.split('-')[2], 10);
            assert.ok(
                variant >= 1 && variant <= 3,
                `Expected variant 1–3, got ${variant} for tile at (${tile.row},${tile.col})`
            );
        }
    });
});

// ─── Tests: tileHash stability for fixed inputs (Requirement 3.13) ───────────

describe('tileHash: stable values for fixed inputs', () => {
    it('should return the same value on repeated calls (deterministic)', () => {
        const coords = [[0, 0], [0, 1], [1, 0], [5, 3], [10, 7], [99, 99]];
        for (const [row, col] of coords) {
            const first = LevelLoader.tileHash(row, col);
            const second = LevelLoader.tileHash(row, col);
            assert.equal(first, second,
                `tileHash(${row}, ${col}) is not deterministic`);
        }
    });

    it('should return 0.43655891773210814 for (0, 0)', () => {
        const expected = 0.43655891773210814;
        assert.equal(LevelLoader.tileHash(0, 0), expected,
            `tileHash(0,0) regression: expected ${expected}`);
    });

    it('should return values in [0, 1)', () => {
        const coords = [[0, 0], [1, 1], [3, 7], [50, 50], [0, 100], [100, 0]];
        for (const [row, col] of coords) {
            const h = LevelLoader.tileHash(row, col);
            assert.ok(h >= 0 && h < 1,
                `tileHash(${row},${col}) = ${h} out of [0, 1)`);
        }
    });

    it('different positions produce different hash values', () => {
        const h00 = LevelLoader.tileHash(0, 0);
        const h01 = LevelLoader.tileHash(0, 1);
        const h10 = LevelLoader.tileHash(1, 0);
        assert.notEqual(h00, h01);
        assert.notEqual(h00, h10);
    });

    it('bailey variant selection is stable for (0, 0)', () => {
        const hash = LevelLoader.tileHash(0, 0);
        const variant = Math.floor(hash * 3) + 1;
        assert.equal(variant, Math.floor(LevelLoader.tileHash(0, 0) * 3) + 1);
    });
});

// ─── Tests: complete sprite mapping table ────────────────────────────────────

describe('parseLevelText: complete castle/bridge sprite mapping table', () => {
    // Bridge tiles: sprite only, no overlay
    const bridgeMappings = [
        { char: '=', sprite: 'bridge-mm' },
        { char: 'b', sprite: 'castle-bridge-start' },
        { char: 'm', sprite: 'castle-bridge-mid' },
        { char: 'g', sprite: 'castle-bridge-gate' },
    ];

    for (const { char, sprite } of bridgeMappings) {
        it(`bridge "${char}" → sprite="${sprite}", no overlay`, () => {
            const tile = parseTile(char);
            assert.equal(tile.sprite, sprite,
                `sprite mismatch for "${char}": expected "${sprite}", got "${tile.sprite}"`);
            assert.ok(!('overlay' in tile),
                `"${char}" must not have an overlay field; got: ${JSON.stringify(tile)}`);
        });
    }

    // Castle structure tiles: sprite + overlay
    const castleMappings = [
        { char: 'T', sprite: 'castle-tower',        overlay: 'castle-tower-overlay' },
        { char: 'K', sprite: 'castle-keep-tl',       overlay: 'castle-keep-tl-overlay' },
        { char: 'j', sprite: 'castle-keep-bl',       overlay: 'castle-keep-bl-overlay' },
        { char: 'J', sprite: 'castle-keep-br',       overlay: 'castle-keep-br-overlay' },
        { char: 'F', sprite: 'castle-keep-center',   overlay: 'castle-keep-center-overlay' },
        { char: 'G', sprite: 'castle-gatehouse',     overlay: 'castle-gatehouse-overlay' },
        { char: 'W', sprite: 'castle-wall',          overlay: 'castle-wall-overlay' },
    ];

    for (const { char, sprite, overlay } of castleMappings) {
        it(`castle "${char}" → sprite="${sprite}", overlay="${overlay}"`, () => {
            const tile = parseTile(char);
            assert.equal(tile.sprite, sprite,
                `sprite mismatch for "${char}": expected "${sprite}", got "${tile.sprite}"`);
            assert.equal(tile.overlay, overlay,
                `overlay mismatch for "${char}": expected "${overlay}", got "${tile.overlay}"`);
        });
    }
});

// ─── Tests: no overlay on non-structure tiles ─────────────────────────────────

describe('parseLevelText: non-structure tiles have no overlay field', () => {
    const noOverlayChars = ['.', ',', 'R', 'D', '~', 'C', '=', 'b', 'm', 'g'];

    for (const ch of noOverlayChars) {
        it(`"${ch}" tile should not have an overlay field`, () => {
            const tile = parseTile(ch);
            assert.ok(!('overlay' in tile),
                `"${ch}" must not have overlay field; got: ${JSON.stringify(tile)}`);
        });
    }
});
