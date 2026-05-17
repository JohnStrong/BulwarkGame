/**
 * Level loader - parses text file level descriptors
 *
 * ═══════════════════════════════════════════════════════════════
 * TILE LEGEND (all major elements are 2x2 tiles = 64x64px)
 * ═══════════════════════════════════════════════════════════════
 *
 * TERRAIN:
 *   . = open meadow / short grass (2 variants)
 *   , = meadow with wildflowers (2 variants)
 *
 * NATURE:
 *   P = oak tree top-left (2x2, 3 variants)
 *   p = oak tree continuation
 *
 * STRUCTURES:
 *   W = wall horizontal (curtain wall)
 *   | = wall vertical
 *   T = tower (corner guard tower)
 *   K = keep top-left (4x4 tiles, main castle tower)
 *   k = keep continuation (renders bailey underneath)
 *   G = portcullis top-left (2x2, gatehouse)
 *   g = portcullis continuation
 *   L = wall-gate-left (connects wall to gate)
 *   R = wall-gate-right (connects wall to gate)
 *   H = hut top-left (2x2, thatched dwelling)
 *   h = hut continuation
 *   C = bailey (cobblestone courtyard)
 *
 * ROAD:
 *   D = dirt road top-left (2x2)
 *   d = road continuation
 *
 * WATER:
 *   ~ = water (3 variants, blocks movement)
 *   ) = water-to-land: water right, grass left
 *   > = water-to-land: bottom-right corner
 *
 * BORDER:
 *   # = rocky border (auto-detects variant by position)
 *
 * COMMENTS & METADATA:
 *   Lines starting with ; before map data are comments.
 *   name=Level Name sets the display name.
 *
 * ═══════════════════════════════════════════════════════════════
 */

const LevelLoader = {
    levels: [],
    currentLevel: 0,

    async loadLevelList() {
        try {
            const manifest = await loadTextFile('levels/manifest.txt');
            const files = manifest
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith(';'));

            for (const file of files) {
                const levelData = await this.parseLevel(`levels/${file}`);
                this.levels.push(levelData);
            }
        } catch (e) {
            console.warn('Could not load level manifest, using built-in level');
            this.levels.push(this.getDefaultLevel());
        }
    },

    async parseLevel(path) {
        const text = await loadTextFile(path);
        return this.parseLevelText(text);
    },

    parseLevelText(text) {
        const lines = text.split('\n');
        const level = {
            name: 'Unnamed Level',
            tiles: [],
            walls: [],
            width: 0,
            height: 0
        };

        const mapLines = [];

        for (const line of lines) {
            const trimmed = line.trimEnd();
            if (trimmed.startsWith(';') && mapLines.length === 0) continue;
            if (trimmed.startsWith('name=')) {
                level.name = trimmed.substring(5);
                continue;
            }
            if (trimmed.length > 0 && !trimmed.startsWith(';')) {
                mapLines.push(trimmed);
            }
        }

        level.height = mapLines.length;
        level.width = Math.max(...mapLines.map(l => l.length));

        for (let row = 0; row < mapLines.length; row++) {
            for (let col = 0; col < mapLines[row].length; col++) {
                const char = mapLines[row][col];
                const x = col * TILE_SIZE;
                const y = row * TILE_SIZE;
                const hash = this.tileHash(row, col);

                switch (char) {
                    // === TERRAIN ===
                    case '.': {
                        const variant = (hash > 0.5) ? 2 : 1;
                        level.tiles.push({ x, y, sprite: `grass-short-${variant}` });
                        break;
                    }
                    case ',': {
                        const variant = (hash > 0.5) ? 2 : 1;
                        level.tiles.push({ x, y, sprite: `grass-flowers-${variant}` });
                        break;
                    }

                    // === BORDER ===
                    case '#':
                        level.tiles.push({ x, y, sprite: this.getBorderSprite(row, col, mapLines) });
                        level.walls.push({ x, y, width: TILE_SIZE, height: TILE_SIZE });
                        break;

                    // === WATER ===
                    case '~': {
                        const variant = Math.floor(hash * 3) + 1;
                        level.tiles.push({ x, y, sprite: `water-${variant}` });
                        level.walls.push({ x, y, width: TILE_SIZE, height: TILE_SIZE });
                        break;
                    }
                    case ')':
                        level.tiles.push({ x, y, sprite: 'water-land-right' });
                        break;
                    case '>':
                        level.tiles.push({ x, y, sprite: 'water-land-br' });
                        break;

                    // === OAK TREES (2x2) ===
                    case 'P': {
                        const variant = Math.floor(hash * 3) + 1;
                        level.tiles.push({ x, y, sprite: `oak-large-${variant}`, width: TILE_SIZE * 2, height: TILE_SIZE * 2 });
                        level.walls.push({ x, y, width: TILE_SIZE * 2, height: TILE_SIZE * 2 });
                        break;
                    }
                    case 'p':
                        level.tiles.push({ x, y, sprite: 'grass-short-1', covered: true });
                        break;

                    // === STRUCTURES ===
                    case 'W':
                        level.tiles.push({ x, y, sprite: 'wall-h' });
                        level.walls.push({ x, y, width: TILE_SIZE, height: TILE_SIZE });
                        break;
                    case '|':
                        level.tiles.push({ x, y, sprite: 'wall-v' });
                        level.walls.push({ x, y, width: TILE_SIZE, height: TILE_SIZE });
                        break;
                    case 'T':
                        level.tiles.push({ x, y, sprite: 'tower' });
                        level.walls.push({ x, y, width: TILE_SIZE, height: TILE_SIZE });
                        break;
                    case 'G':
                        level.tiles.push({ x, y, sprite: 'portcullis-large', width: TILE_SIZE * 2, height: TILE_SIZE * 2 });
                        break;
                    case 'g':
                        level.tiles.push({ x, y, sprite: 'grass-short-1', covered: true });
                        break;
                    case 'L':
                        level.tiles.push({ x, y, sprite: 'wall-gate-left' });
                        level.walls.push({ x, y, width: TILE_SIZE, height: TILE_SIZE });
                        break;
                    case 'R':
                        level.tiles.push({ x, y, sprite: 'wall-gate-right' });
                        level.walls.push({ x, y, width: TILE_SIZE, height: TILE_SIZE });
                        break;
                    case 'H': {
                        const hVariant = (hash > 0.5) ? 2 : 1;
                        level.tiles.push({ x, y, sprite: `hut-${hVariant}`, width: TILE_SIZE * 2, height: TILE_SIZE * 2 });
                        level.walls.push({ x, y, width: TILE_SIZE * 2, height: TILE_SIZE * 2 });
                        break;
                    }
                    case 'h':
                        level.tiles.push({ x, y, sprite: 'grass-short-1', covered: true });
                        break;
                    case 'C':
                        level.tiles.push({ x, y, sprite: 'bailey' });
                        break;
                    case 'K':
                        level.tiles.push({ x, y, sprite: 'keep', width: TILE_SIZE * 4, height: TILE_SIZE * 4 });
                        level.walls.push({ x, y, width: TILE_SIZE * 4, height: TILE_SIZE * 4 });
                        break;
                    case 'k':
                        level.tiles.push({ x, y, sprite: 'bailey', covered: true });
                        break;

                    // === ROAD (2x2) ===
                    case 'D':
                        level.tiles.push({ x, y, sprite: 'road', width: TILE_SIZE * 2, height: TILE_SIZE * 2 });
                        break;
                    case 'd':
                        level.tiles.push({ x, y, sprite: 'grass-short-1', covered: true });
                        break;

                    // === DEFAULT ===
                    default:
                        level.tiles.push({ x, y, sprite: 'grass-short-1' });
                        break;
                }
            }
        }

        return level;
    },

    getDefaultLevel() {
        return this.parseLevelText('name=Default\n' + '#'.repeat(40) + '\n' + ('#' + '.'.repeat(38) + '#\n').repeat(38) + '#'.repeat(40));
    },

    tileHash(row, col) {
        let h = (row * 7919 + col * 104729 + 31) & 0xFFFFFFFF;
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = (h >> 16) ^ h;
        return (h >>> 0) / 0xFFFFFFFF;
    },

    getBorderSprite(row, col, mapLines) {
        const maxRow = mapLines.length - 1;
        const maxCol = mapLines[0].length - 1;

        const isTop = (row === 0);
        const isBottom = (row === maxRow);
        const isLeft = (col === 0);
        const isRight = (col === maxCol);

        if (isTop && isLeft) return 'border-corner-tl';
        if (isTop && isRight) return 'border-corner-tr';
        if (isBottom && isLeft) return 'border-corner-bl';
        if (isBottom && isRight) return 'border-corner-br';
        if (isTop) return 'border-top';
        if (isBottom) return 'border-bottom';
        if (isLeft) return 'border-left';
        if (isRight) return 'border-right';

        const hasTopNeighbor = (row > 0 && mapLines[row - 1][col] === '#');
        const hasBottomNeighbor = (row < maxRow && mapLines[row + 1][col] === '#');
        const hasLeftNeighbor = (col > 0 && mapLines[row][col - 1] === '#');
        const hasRightNeighbor = (col < maxCol && mapLines[row][col + 1] === '#');

        if (!hasTopNeighbor && !hasLeftNeighbor) return 'border-corner-tl';
        if (!hasTopNeighbor && !hasRightNeighbor) return 'border-corner-tr';
        if (!hasBottomNeighbor && !hasLeftNeighbor) return 'border-corner-bl';
        if (!hasBottomNeighbor && !hasRightNeighbor) return 'border-corner-br';
        if (!hasTopNeighbor) return 'border-top';
        if (!hasBottomNeighbor) return 'border-bottom';
        if (!hasLeftNeighbor) return 'border-left';
        if (!hasRightNeighbor) return 'border-right';

        return 'hill-border';
    },

    getCurrentLevel() {
        return this.levels[this.currentLevel];
    },

    nextLevel() {
        this.currentLevel++;
        if (this.currentLevel >= this.levels.length) {
            this.currentLevel = 0;
            return false;
        }
        return true;
    },

    resetLevel() {
        // Reserved for future game state reset
    }
};
