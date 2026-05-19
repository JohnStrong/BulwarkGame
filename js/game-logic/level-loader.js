/**
 * Level loader - parses text file level descriptors
 *
 * TILE LEGEND:
 *   . = grass (2 variants)
 *   , = grass with flowers (2 variants)
 *   O = tree (3 variants, on grass)
 *   R = rock decoration (on grass)
 *
 *   D = road (full, no edges)
 *   L = road edge-left (grass left, road right)
 *   r = road edge-right (road left, grass right)
 *   U = road edge-top (grass top, road bottom)
 *   u = road edge-bottom (road top, grass bottom)
 *   1 = road corner top-left (grass in TL corner)
 *   2 = road corner top-right (grass in TR corner)
 *   3 = road corner bottom-left (grass in BL corner)
 *   4 = road corner bottom-right (grass in BR corner)
 *
 *   ~ = water (3 variants)
 *   ) = water-to-land (water right, grass left)
 *
 *   Lines starting with ; are comments.
 *   name=Level Name sets the display name.
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

        for (let row = 0; row < mapLines.length; row++) {
            for (let col = 0; col < mapLines[row].length; col++) {
                const ch = mapLines[row][col];
                const x = col * TILE_SIZE, y = row * TILE_SIZE;
                const hash = this.tileHash(row, col);

                switch (ch) {
                    case '.': level.tiles.push({ x, y, sprite: `grass-short-${hash > 0.5 ? 2 : 1}` }); break;
                    case ',': level.tiles.push({ x, y, sprite: `grass-flowers-${hash > 0.5 ? 2 : 1}` }); break;
                    case 'O': level.tiles.push({ x, y, sprite: `tree-${Math.floor(hash * 3) + 1}` }); break;
                    case 'R': level.tiles.push({ x, y, sprite: 'rock' }); break;

                    case 'D': level.tiles.push({ x, y, sprite: 'road-full' }); break;
                    case 'L': level.tiles.push({ x, y, sprite: 'road-edge-left' }); break;
                    case 'r': level.tiles.push({ x, y, sprite: 'road-edge-right' }); break;
                    case 'U': level.tiles.push({ x, y, sprite: 'road-edge-top' }); break;
                    case 'u': level.tiles.push({ x, y, sprite: 'road-edge-bottom' }); break;
                    case '1': level.tiles.push({ x, y, sprite: 'road-corner-tl' }); break;
                    case '2': level.tiles.push({ x, y, sprite: 'road-corner-tr' }); break;
                    case '3': level.tiles.push({ x, y, sprite: 'road-corner-bl' }); break;
                    case '4': level.tiles.push({ x, y, sprite: 'road-corner-br' }); break;

                    case '~': level.tiles.push({ x, y, sprite: `water-${Math.floor(hash * 3) + 1}` }); break;
                    case ')': level.tiles.push({ x, y, sprite: 'water-land-right' }); break;
                    case '(': level.tiles.push({ x, y, sprite: 'water-land-left' }); break;

                    // Bridge (3x3 grid over river)
                    case '{': level.tiles.push({ x, y, sprite: 'bridge-tl' }); break;
                    case '^': level.tiles.push({ x, y, sprite: 'bridge-tm' }); break;
                    case '}': level.tiles.push({ x, y, sprite: 'bridge-tr' }); break;
                    case '[': level.tiles.push({ x, y, sprite: 'bridge-ml' }); break;
                    case '=': level.tiles.push({ x, y, sprite: 'bridge-mm' }); break;
                    case ']': level.tiles.push({ x, y, sprite: 'bridge-mr' }); break;
                    case '<': level.tiles.push({ x, y, sprite: 'bridge-bl' }); break;
                    case '_': level.tiles.push({ x, y, sprite: 'bridge-bm' }); break;
                    case '>': level.tiles.push({ x, y, sprite: 'bridge-br' }); break;

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
