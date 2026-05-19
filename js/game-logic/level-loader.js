/**
 * Level loader - parses text file level descriptors (hexagonal grid)
 *
 * ═══════════════════════════════════════════════════
 * TILE LEGEND
 * ═══════════════════════════════════════════════════
 *
 * TERRAIN:
 *   .   grass (2 variants)
 *   ,   flowers (2 variants)
 *   O   oak tree (3 variants)
 *   P   pine tree (2 variants)
 *   S   shrub (2 variants)
 *   R   rock
 *
 * ROAD:
 *   D   dirt road (also L, r, U, u — all render the same)
 *
 * WATER:
 *   ~   water (also w, ), ( — all render the same)
 *
 * BRIDGE:
 *   =   cobblestone (also {, ^, }, [, ], <, _, >)
 *
 * GRID: Hexagonal (pointy-top, odd rows offset right)
 * Positioning uses hexToPixel(row, col) from utils.js
 *
 * METADATA:
 *   Lines starting with ; are comments (ignored)
 *   name=Level Name sets the in-game display name
 *
 * ═══════════════════════════════════════════════════
 */

const LevelLoader = {
    levels: [],
    currentLevel: 0,

    async loadLevelList() {
        try {
            const manifest = await loadTextFile('levels/manifest.txt');
            const files = manifest.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith(';'));
            for (const file of files) {
                this.levels.push(this.parseLevelText(await loadTextFile(`levels/${file}`)));
            }
        } catch (e) {
            console.warn('Could not load levels, using default');
            this.levels.push(this.getDefaultLevel());
        }
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
        // Pixel dimensions for hex grid (extra space for odd-row offset)
        level.pixelWidth = (level.width + 1) * HEX_WIDTH;
        level.pixelHeight = level.height * HEX_ROW_HEIGHT + HEX_HEIGHT;

        for (let row = 0; row < mapLines.length; row++) {
            for (let col = 0; col < mapLines[row].length; col++) {
                const ch = mapLines[row][col];
                const { x, y } = hexToPixel(row, col);
                const hash = this.tileHash(row, col);

                switch (ch) {
                    case '.': level.tiles.push({ x, y, sprite: `grass-short-${hash > 0.5 ? 2 : 1}` }); break;
                    case ',': level.tiles.push({ x, y, sprite: `grass-flowers-${hash > 0.5 ? 2 : 1}` }); break;
                    case 'O': level.tiles.push({ x, y, sprite: `tree-${Math.floor(hash * 3) + 1}` }); break;
                    case 'P': level.tiles.push({ x, y, sprite: `tree-${Math.floor(hash * 2) + 4}` }); break;
                    case 'S': level.tiles.push({ x, y, sprite: `tree-${Math.floor(hash * 2) + 6}` }); break;
                    case 'R': level.tiles.push({ x, y, sprite: 'rock' }); break;
                    case 'D': level.tiles.push({ x, y, sprite: 'road-full' }); break;
                    case '~': level.tiles.push({ x, y, sprite: `water-${Math.floor(hash * 3) + 1}` }); break;
                    case '=': level.tiles.push({ x, y, sprite: 'bridge-mm' }); break;
                    default: level.tiles.push({ x, y, sprite: 'grass-short-1' }); break;
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
