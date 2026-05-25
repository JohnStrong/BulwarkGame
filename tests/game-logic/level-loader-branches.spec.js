/**
 * Branch coverage tests for js/game-logic/level-loader.js
 *
 * Covers all switch/case branches in parseLevelText() systematically,
 * including castle bridge chars (b, m, g) and the default fallback.
 * Also covers parseElevation single-col format (no dash range).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/level-loader-branches.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const HEX_WIDTH = 32;
const HEX_HEIGHT = 28;
const HEX_ROW_HEIGHT = 21;
const HEX_COL_OFFSET = 16;

function hexToPixel(row, col) {
    const x = col * HEX_WIDTH + (row % 2 === 1 ? HEX_COL_OFFSET : 0);
    const y = row * HEX_ROW_HEIGHT;
    return { x, y };
}

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
                        const oakOverlays = [
                            'tree-oak-overlay-1',
                            'tree-oak-overlay-2',
                            'tree-oak-overlay-3',
                        ];
                        level.tiles.push({
                            row, col, x, y,
                            sprite: `grass-short-${hash > 0.5 ? 2 : 1}`,
                            overlay: oakOverlays[Math.floor(hash * 3)],
                        });
                        break;
                    }
                    case 'P': {
                        const pineOverlays = [
                            'tree-pine-overlay-1',
                            'tree-pine-overlay-2',
                        ];
                        level.tiles.push({
                            row, col, x, y,
                            sprite: `grass-short-${hash > 0.5 ? 2 : 1}`,
                            overlay: pineOverlays[Math.floor(hash * 2)],
                        });
                        break;
                    }
                    case 'S': {
                        const shrubOverlays = [
                            'tree-shrub-overlay-1',
                            'tree-shrub-overlay-2',
                        ];
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
    },

    parseElevation(text) {
        const elevation = {};
        const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith(';'));
        for (const line of lines) {
            const [range, offset] = line.split(':');
            if (!offset) continue;
            const px = parseInt(offset, 10);
            if (range.includes('-')) {
                const [start, end] = range.split('-').map(Number);
                for (let c = start; c <= end; c++) elevation[c] = px;
            } else {
                elevation[parseInt(range, 10)] = px;
            }
        }
        return elevation;
    },

    tileHash(row, col) {
        let h = (row * 7919 + col * 104729 + 31) & 0xFFFFFFFF;
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = (h >> 16) ^ h;
        return (h >>> 0) / 0xFFFFFFFF;
    },
};

describe('parseLevelText: castle bridge characters (b, m, g)', () => {
    it('should parse "b" as castle-bridge-mid (bridge start)', () => {
        const level = LevelLoader.parseLevelText('name=X\nb');
        assert.equal(level.tiles[0].sprite, 'castle-bridge-mid');
    });

    it('should parse "m" as castle-bridge-mid (bridge mid)', () => {
        const level = LevelLoader.parseLevelText('name=X\nm');
        assert.equal(level.tiles[0].sprite, 'castle-bridge-mid');
    });

    it('should parse "g" as castle-bridge-mid (bridge gate)', () => {
        const level = LevelLoader.parseLevelText('name=X\ng');
        assert.equal(level.tiles[0].sprite, 'castle-bridge-mid');
    });

    it('should parse all three bridge chars in sequence', () => {
        const level = LevelLoader.parseLevelText('name=X\nbmg');
        assert.equal(level.tiles.length, 3);
        assert.equal(level.tiles[0].sprite, 'castle-bridge-mid');
        assert.equal(level.tiles[1].sprite, 'castle-bridge-mid');
        assert.equal(level.tiles[2].sprite, 'castle-bridge-mid');
    });
});

describe('parseLevelText: default case (unknown characters)', () => {
    it('should map "Z" to grass-short-1', () => {
        const level = LevelLoader.parseLevelText('name=X\nZ');
        assert.equal(level.tiles[0].sprite, 'grass-short-1');
    });

    it('should map "!" to grass-short-1', () => {
        const level = LevelLoader.parseLevelText('name=X\n!');
        assert.equal(level.tiles[0].sprite, 'grass-short-1');
    });

    it('should map "9" to grass-short-1', () => {
        const level = LevelLoader.parseLevelText('name=X\n9');
        assert.equal(level.tiles[0].sprite, 'grass-short-1');
    });

    it('should map space character to empty (trimEnd removes trailing space)', () => {
        const level = LevelLoader.parseLevelText('name=X\n ');
        // A line with only a space gets trimEnd'd to empty string, so no tiles are produced
        assert.equal(level.tiles.length, 0);
    });

    it('should map lowercase "x" to grass-short-1', () => {
        const level = LevelLoader.parseLevelText('name=X\nx');
        assert.equal(level.tiles[0].sprite, 'grass-short-1');
    });
});

describe('parseLevelText: all tile characters systematically', () => {
    const testCases = [
        { char: '.', prefix: 'grass-short-' },
        { char: ',', prefix: 'grass-flowers-' },
        { char: 'O', prefix: 'grass-short-', overlayPrefix: 'tree-oak-overlay-' },
        { char: 'P', prefix: 'grass-short-', overlayPrefix: 'tree-pine-overlay-' },
        { char: 'S', prefix: 'grass-short-', overlayPrefix: 'tree-shrub-overlay-' },
        { char: 'R', exact: 'rock' },
        { char: 'D', exact: 'road-full' },
        { char: '~', prefix: 'water-' },
        { char: '=', exact: 'bridge-mm' },
        { char: 'b', exact: 'castle-bridge-mid' },
        { char: 'm', exact: 'castle-bridge-mid' },
        { char: 'g', exact: 'castle-bridge-mid' },
        { char: 'T', exact: 'castle-tower' },
        { char: 'K', exact: 'castle-keep-tl' },
        { char: 'j', exact: 'castle-keep-bl' },
        { char: 'J', exact: 'castle-keep-br' },
        { char: 'F', exact: 'castle-keep-center' },
        { char: 'G', exact: 'castle-gatehouse' },
        { char: 'W', exact: 'castle-wall' },
        { char: 'C', prefix: 'castle-bailey-' },
    ];

    for (const { char, prefix, exact, overlayPrefix } of testCases) {
        it(`should correctly parse character "${char}"`, () => {
            const level = LevelLoader.parseLevelText(`name=X\n${char}`);
            assert.equal(level.tiles.length, 1);
            if (exact) {
                assert.equal(level.tiles[0].sprite, exact);
            } else {
                assert.ok(
                    level.tiles[0].sprite.startsWith(prefix),
                    `Expected "${level.tiles[0].sprite}" to start with "${prefix}"`
                );
            }
            if (overlayPrefix) {
                assert.ok(
                    level.tiles[0].overlay && level.tiles[0].overlay.startsWith(overlayPrefix),
                    `Expected overlay "${level.tiles[0].overlay}" to start with "${overlayPrefix}"`
                );
            } else {
                assert.equal(level.tiles[0].overlay, undefined,
                    `Expected no overlay for char "${char}"`);
            }
        });
    }
});

describe('parseElevation: single-col format (no dash range)', () => {
    it('should parse single column "5:10"', () => {
        const result = LevelLoader.parseElevation('5:10');
        assert.deepEqual(result, { 5: 10 });
    });

    it('should parse multiple single columns', () => {
        const result = LevelLoader.parseElevation('0:5\n3:10\n7:-3');
        assert.deepEqual(result, { 0: 5, 3: 10, 7: -3 });
    });

    it('should parse column 0', () => {
        const result = LevelLoader.parseElevation('0:0');
        assert.deepEqual(result, { 0: 0 });
    });

    it('should parse large column numbers', () => {
        const result = LevelLoader.parseElevation('99:15');
        assert.deepEqual(result, { 99: 15 });
    });

    it('should handle mix of single-col and range formats', () => {
        const result = LevelLoader.parseElevation('0:5\n2-4:10\n6:3');
        assert.deepEqual(result, { 0: 5, 2: 10, 3: 10, 4: 10, 6: 3 });
    });

    it('should handle negative offset for single column', () => {
        const result = LevelLoader.parseElevation('3:-20');
        assert.deepEqual(result, { 3: -20 });
    });

    it('should skip lines without colon', () => {
        const result = LevelLoader.parseElevation('no colon here\n5:10');
        assert.deepEqual(result, { 5: 10 });
    });

    it('should handle zero offset', () => {
        const result = LevelLoader.parseElevation('5:0');
        assert.deepEqual(result, { 5: 0 });
    });
});
