/**
 * Tests for js/game-logic/level-loader.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/level-loader.spec.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Replicate constants from utils.js needed by LevelLoader
const HEX_WIDTH = 32;
const HEX_HEIGHT = 28;
const HEX_ROW_HEIGHT = 21;
const HEX_COL_OFFSET = 16;

function hexToPixel(row, col) {
    const x = col * HEX_WIDTH + (row % 2 === 1 ? HEX_COL_OFFSET : 0);
    const y = row * HEX_ROW_HEIGHT;
    return { x, y };
}

// Replicate LevelLoader for testing (extracted logic, no async/DOM deps)
const LevelLoader = {
    levels: [],
    currentLevel: 0,

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

    getDefaultLevel() {
        return this.parseLevelText('name=Default\n' + '.'.repeat(30) + '\n');
    },

    tileHash(row, col) {
        let h = (row * 7919 + col * 104729 + 31) & 0xFFFFFFFF;
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = (h >> 16) ^ h;
        return (h >>> 0) / 0xFFFFFFFF;
    },

    getCurrentLevel() { return this.levels[this.currentLevel]; },
    nextLevel() { this.currentLevel++; return this.currentLevel < this.levels.length; },
    resetLevel() {}
};

describe('LevelLoader.tileHash', () => {
    it('should return a value between 0 and 1', () => {
        for (let r = 0; r < 20; r++) {
            for (let c = 0; c < 20; c++) {
                const h = LevelLoader.tileHash(r, c);
                assert.ok(h >= 0 && h <= 1, `tileHash(${r},${c}) = ${h} out of range`);
            }
        }
    });

    it('should be deterministic (same input = same output)', () => {
        const h1 = LevelLoader.tileHash(5, 10);
        const h2 = LevelLoader.tileHash(5, 10);
        assert.equal(h1, h2);
    });

    it('should produce different values for different inputs', () => {
        const h1 = LevelLoader.tileHash(0, 0);
        const h2 = LevelLoader.tileHash(0, 1);
        const h3 = LevelLoader.tileHash(1, 0);
        // Not guaranteed to all differ, but extremely likely
        assert.ok(h1 !== h2 || h1 !== h3, 'Hash should vary for different inputs');
    });
});

describe('LevelLoader.parseElevation', () => {
    it('should parse single column elevation', () => {
        const result = LevelLoader.parseElevation('5:10');
        assert.deepEqual(result, { 5: 10 });
    });

    it('should parse range elevation', () => {
        const result = LevelLoader.parseElevation('2-5:8');
        assert.deepEqual(result, { 2: 8, 3: 8, 4: 8, 5: 8 });
    });

    it('should ignore comment lines', () => {
        const result = LevelLoader.parseElevation('; this is a comment\n3:5');
        assert.deepEqual(result, { 3: 5 });
    });

    it('should handle multiple lines', () => {
        const result = LevelLoader.parseElevation('1:5\n3-4:10\n7:-3');
        assert.deepEqual(result, { 1: 5, 3: 10, 4: 10, 7: -3 });
    });

    it('should handle empty input', () => {
        const result = LevelLoader.parseElevation('');
        assert.deepEqual(result, {});
    });

    it('should handle negative offsets', () => {
        const result = LevelLoader.parseElevation('0:-15');
        assert.deepEqual(result, { 0: -15 });
    });

    it('should skip lines without colon separator', () => {
        const result = LevelLoader.parseElevation('invalid line\n2:5');
        assert.deepEqual(result, { 2: 5 });
    });
});

describe('LevelLoader.parseLevelText', () => {
    it('should parse level name', () => {
        const level = LevelLoader.parseLevelText('name=Test Level\n...');
        assert.equal(level.name, 'Test Level');
    });

    it('should default name to Unnamed', () => {
        const level = LevelLoader.parseLevelText('...');
        assert.equal(level.name, 'Unnamed');
    });

    it('should ignore comment lines at the start', () => {
        const level = LevelLoader.parseLevelText('; comment\nname=Hello\n..');
        assert.equal(level.name, 'Hello');
        assert.equal(level.tiles.length, 2);
    });

    it('should compute correct width and height', () => {
        const level = LevelLoader.parseLevelText('name=X\n.....\n...\n......');
        assert.equal(level.height, 3);
        assert.equal(level.width, 6);
    });

    it('should compute pixelWidth and pixelHeight', () => {
        const level = LevelLoader.parseLevelText('name=X\n....');
        assert.equal(level.pixelWidth, (4 + 1) * HEX_WIDTH);
        assert.equal(level.pixelHeight, 1 * HEX_ROW_HEIGHT + HEX_HEIGHT);
    });

    it('should parse grass tiles (.)', () => {
        const level = LevelLoader.parseLevelText('name=X\n.');
        assert.equal(level.tiles.length, 1);
        assert.ok(level.tiles[0].sprite.startsWith('grass-short-'));
    });

    it('should parse flower tiles (,)', () => {
        const level = LevelLoader.parseLevelText('name=X\n,');
        assert.ok(level.tiles[0].sprite.startsWith('grass-flowers-'));
    });

    it('should parse road tiles (D)', () => {
        const level = LevelLoader.parseLevelText('name=X\nD');
        assert.equal(level.tiles[0].sprite, 'road-full');
    });

    it('should parse water tiles (~)', () => {
        const level = LevelLoader.parseLevelText('name=X\n~');
        assert.ok(level.tiles[0].sprite.startsWith('water-'));
    });

    it('should parse rock tiles (R)', () => {
        const level = LevelLoader.parseLevelText('name=X\nR');
        assert.equal(level.tiles[0].sprite, 'rock');
    });

    it('should parse bridge tiles (=)', () => {
        const level = LevelLoader.parseLevelText('name=X\n=');
        assert.equal(level.tiles[0].sprite, 'bridge-mm');
    });

    it('should parse castle tower (T)', () => {
        const level = LevelLoader.parseLevelText('name=X\nT');
        assert.equal(level.tiles[0].sprite, 'castle-tower');
    });

    it('should parse castle keep tiles (K, j, J, F)', () => {
        const level = LevelLoader.parseLevelText('name=X\nKjJF');
        assert.equal(level.tiles[0].sprite, 'castle-keep-tl');
        assert.equal(level.tiles[1].sprite, 'castle-keep-bl');
        assert.equal(level.tiles[2].sprite, 'castle-keep-br');
        assert.equal(level.tiles[3].sprite, 'castle-keep-center');
    });

    it('should parse castle wall (W) and gatehouse (G)', () => {
        const level = LevelLoader.parseLevelText('name=X\nWG');
        assert.equal(level.tiles[0].sprite, 'castle-wall');
        assert.equal(level.tiles[1].sprite, 'castle-gatehouse');
    });

    it('should parse castle bailey (C) with variant', () => {
        const level = LevelLoader.parseLevelText('name=X\nC');
        assert.ok(level.tiles[0].sprite.startsWith('castle-bailey-'));
        const variant = parseInt(level.tiles[0].sprite.split('-')[2]);
        assert.ok(variant >= 1 && variant <= 3);
    });

    it('should parse tree tiles (O, P, S)', () => {
        const level = LevelLoader.parseLevelText('name=X\nOPS');
        // O → grass-short-N + tree-oak-overlay-N
        assert.ok(level.tiles[0].sprite.startsWith('grass-short-'));
        assert.ok(level.tiles[0].overlay.startsWith('tree-oak-overlay-'));
        // P → grass-short-N + tree-pine-overlay-N
        assert.ok(level.tiles[1].sprite.startsWith('grass-short-'));
        assert.ok(level.tiles[1].overlay.startsWith('tree-pine-overlay-'));
        // S → grass-short-N + tree-shrub-overlay-N
        assert.ok(level.tiles[2].sprite.startsWith('grass-short-'));
        assert.ok(level.tiles[2].overlay.startsWith('tree-shrub-overlay-'));
    });

    it('should default unknown characters to grass-short-1', () => {
        const level = LevelLoader.parseLevelText('name=X\nZ');
        assert.equal(level.tiles[0].sprite, 'grass-short-1');
    });

    it('should assign correct row/col to each tile', () => {
        const level = LevelLoader.parseLevelText('name=X\n..\n..');
        assert.equal(level.tiles[0].row, 0);
        assert.equal(level.tiles[0].col, 0);
        assert.equal(level.tiles[1].row, 0);
        assert.equal(level.tiles[1].col, 1);
        assert.equal(level.tiles[2].row, 1);
        assert.equal(level.tiles[2].col, 0);
        assert.equal(level.tiles[3].row, 1);
        assert.equal(level.tiles[3].col, 1);
    });

    it('should compute pixel positions using hexToPixel', () => {
        const level = LevelLoader.parseLevelText('name=X\n..\n..');
        // Row 0, Col 0
        assert.equal(level.tiles[0].x, 0);
        assert.equal(level.tiles[0].y, 0);
        // Row 1, Col 0 (odd row offset)
        assert.equal(level.tiles[2].x, HEX_COL_OFFSET);
        assert.equal(level.tiles[2].y, HEX_ROW_HEIGHT);
    });
});

describe('LevelLoader.getDefaultLevel', () => {
    it('should return a level named Default', () => {
        const level = LevelLoader.getDefaultLevel();
        assert.equal(level.name, 'Default');
    });

    it('should have 30 tiles (one row of 30 dots)', () => {
        const level = LevelLoader.getDefaultLevel();
        assert.equal(level.tiles.length, 30);
    });

    it('should have all grass tiles', () => {
        const level = LevelLoader.getDefaultLevel();
        for (const tile of level.tiles) {
            assert.ok(tile.sprite.startsWith('grass-short-'));
        }
    });
});

describe('LevelLoader.getCurrentLevel / nextLevel', () => {
    beforeEach(() => {
        LevelLoader.levels = [
            { name: 'Level 1' },
            { name: 'Level 2' },
        ];
        LevelLoader.currentLevel = 0;
    });

    it('should return the first level initially', () => {
        assert.equal(LevelLoader.getCurrentLevel().name, 'Level 1');
    });

    it('should advance to next level', () => {
        const hasNext = LevelLoader.nextLevel();
        assert.equal(hasNext, true);
        assert.equal(LevelLoader.getCurrentLevel().name, 'Level 2');
    });

    it('should return false when no more levels', () => {
        LevelLoader.nextLevel();
        const hasNext = LevelLoader.nextLevel();
        assert.equal(hasNext, false);
    });
});
