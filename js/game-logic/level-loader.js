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
 *   D   dirt road
 *
 * WATER:
 *   ~   water (3 variants)
 *
 * BRIDGE (cobblestone):
 *   =   cobblestone bridge surface
 *
 * CASTLE BRIDGE (drawbridge):
 *   b   bridge-start (road transitioning to wood)
 *   m   bridge-mid (wooden planks over moat)
 *   g   bridge-gate (wood meeting gatehouse stone)
 *
 * CASTLE STRUCTURES:
 *   T   tower (round stone, top-down)
 *   K   keep top-left
 *   j   keep bottom-left    J   keep bottom-right
 *   F   keep center (flag — protect this!)
 *   G   gatehouse (portcullis)
 *   W   wall (full stone)
 *   C   bailey (dirt+hay floor, 3 variants)
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
                const levelData = this.parseLevelText(await loadTextFile(`levels/${file}`));
                // Try to load elevation file
                const elevFile = file.replace('.txt', '.elevation.txt');
                try {
                    const elevText = await loadTextFile(`levels/${elevFile}`);
                    levelData.elevation = this.parseElevation(elevText);
                } catch (e) {
                    levelData.elevation = {};
                }
                this.levels.push(levelData);
            }
        } catch (e) {
            console.warn('Could not load levels, using default');
            this.levels.push(this.getDefaultLevel());
        }
    },

    /**
     * Parse elevation file.
     * Format: "startCol-endCol:offset" per line (or "col:offset")
     * Returns { colNumber: pixelOffset, ... }
     */
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
        // Pixel dimensions for hex grid (extra space for odd-row offset)
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
                    case 'O': level.tiles.push({ row, col, x, y, sprite: `tree-${Math.floor(hash * 3) + 1}` }); break;
                    case 'P': level.tiles.push({ row, col, x, y, sprite: `tree-${Math.floor(hash * 2) + 4}` }); break;
                    case 'S': level.tiles.push({ row, col, x, y, sprite: `tree-${Math.floor(hash * 2) + 6}` }); break;
                    case 'R': level.tiles.push({ row, col, x, y, sprite: 'rock' }); break;
                    case 'D': level.tiles.push({ row, col, x, y, sprite: 'road-full' }); break;
                    case '~': level.tiles.push({ row, col, x, y, sprite: `water-${Math.floor(hash * 3) + 1}` }); break;
                    case '=': level.tiles.push({ row, col, x, y, sprite: 'bridge-mm' }); break;

                    // Castle structures
                    case 'b': level.tiles.push({ row, col, x, y, sprite: 'castle-bridge-start' }); break;
                    case 'm': level.tiles.push({ row, col, x, y, sprite: 'castle-bridge-mid' }); break;
                    case 'g': level.tiles.push({ row, col, x, y, sprite: 'castle-bridge-gate' }); break;
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
