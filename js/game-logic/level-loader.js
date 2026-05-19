/**
 * Level loader - parses text file level descriptors
 *
 * ═══════════════════════════════════════════════════
 * TILE LEGEND
 * ═══════════════════════════════════════════════════
 *
 * TERRAIN:
 *   .   grass (green meadow, 2 variants)
 *   ,   grass with flowers (2 variants)
 *   O   tree (dark green canopy on grass, 3 variants)
 *   R   rock (grey stone decoration on grass)
 *
 * ROAD (straw/sandy orange dirt, jagged grass edges):
 *   D   road full (pure dirt, no edges)
 *   L   road left-edge (grass left | road right)
 *   r   road right-edge (road left | grass right)
 *   U   road top-edge (grass above | road below)
 *   u   road bottom-edge (road above | grass below)
 *   1   road corner top-left (grass in TL quadrant)
 *   2   road corner top-right (grass in TR quadrant)
 *   3   road corner bottom-left (grass in BL quadrant)
 *   4   road corner bottom-right (grass in BR quadrant)
 *
 * WATER:
 *   ~   water vertical flow (tidal marks top-to-bottom, 3 variants)
 *   w   water horizontal flow (tidal marks left-to-right, 3 variants)
 *   )   right bank (water left | grass right)
 *   (   left bank (grass left | water right)
 *
 * BRIDGE (stone, 3 rows tall x N cols wide):
 *   {   top-left (dirt | wall+road)
 *   ^   top-mid (narrow wall top, cobblestone road below)
 *   }   top-right (wall+road | dirt)
 *   [   mid-left (dirt | full cobblestone)
 *   =   mid-mid (full cobblestone road surface)
 *   ]   mid-right (full cobblestone | dirt)
 *   <   bot-left (dirt | road+wall)
 *   _   bot-mid (cobblestone road top, narrow wall bottom)
 *   >   bot-right (road+wall | dirt)
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
                    case 'w': level.tiles.push({ x, y, sprite: `water-h-${Math.floor(hash * 3) + 1}` }); break;
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
