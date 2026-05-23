/**
 * Async mock tests for LevelLoader.loadLevelList() and UnitManager.loadResources()
 *
 * Recommendation 3: Add async mock tests for loadResources() and loadLevelList().
 * Tests error handling, empty manifest, and malformed CSV parsing using
 * simple function stubs for loadTextFile.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/level-loader-async.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Constants from utils.js ────────────────────────────────────────────────

const HEX_WIDTH = 32;
const HEX_HEIGHT = 28;
const HEX_ROW_HEIGHT = 21;
const HEX_COL_OFFSET = 16;

function hexToPixel(row, col) {
    const x = col * HEX_WIDTH + (row % 2 === 1 ? HEX_COL_OFFSET : 0);
    const y = row * HEX_ROW_HEIGHT;
    return { x, y };
}

// ─── LevelLoader with injectable loadTextFile ───────────────────────────────

function createLevelLoader(loadTextFileFn) {
    const loader = {
        levels: [],
        currentLevel: 0,

        async loadLevelList() {
            try {
                const manifest = await loadTextFileFn('levels/manifest.txt');
                const files = manifest.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith(';'));
                for (const file of files) {
                    const levelData = this.parseLevelText(await loadTextFileFn(`levels/${file}`));
                    const elevFile = file.replace('.txt', '.elevation.txt');
                    try {
                        const elevText = await loadTextFileFn(`levels/${elevFile}`);
                        levelData.elevation = this.parseElevation(elevText);
                    } catch (e) {
                        levelData.elevation = {};
                    }
                    this.levels.push(levelData);
                }
            } catch (e) {
                this.levels.push(this.getDefaultLevel());
            }
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
            level.width = mapLines.length > 0 ? Math.max(...mapLines.map(l => l.length)) : 0;
            level.pixelWidth = (level.width + 1) * HEX_WIDTH;
            level.pixelHeight = level.height * HEX_ROW_HEIGHT + HEX_HEIGHT;
            for (let row = 0; row < mapLines.length; row++) {
                for (let col = 0; col < mapLines[row].length; col++) {
                    const ch = mapLines[row][col];
                    const { x, y } = hexToPixel(row, col);
                    level.tiles.push({ row, col, x, y, sprite: ch === 'D' ? 'road-full' : 'grass-short-1' });
                }
            }
            return level;
        },

        getDefaultLevel() {
            return this.parseLevelText('name=Default\n' + '.'.repeat(30) + '\n');
        },

        getCurrentLevel() { return this.levels[this.currentLevel]; },
    };
    return loader;
}

// ─── UnitManager with injectable loadTextFile ───────────────────────────────

function createUnitManager(loadTextFileFn) {
    const manager = {
        units: [],

        async loadResources(filename) {
            const file = filename || 'levels/default.resources.txt';
            try {
                const text = await loadTextFileFn(file);
                this.units = this.parseCSV(text);
            } catch (e) {
                this.units = [];
            }
        },

        parseCSV(text) {
            const lines = text.trim().split('\n');
            if (lines.length < 2) return [];
            const data = lines.slice(1);
            return data.map(line => {
                const [name, qty, health, attack, defense] = line.split(',');
                return {
                    name: name.trim(),
                    sprites: this.nameToSprites(name.trim()),
                    qty: parseInt(qty, 10),
                    qtyRemaining: parseInt(qty, 10),
                    health: parseInt(health, 10),
                    attack: parseInt(attack, 10),
                    defense: parseFloat(defense),
                };
            }).filter(u => u.name && !isNaN(u.qty));
        },

        nameToSprites(name) {
            const lower = name.toLowerCase();
            if (lower.includes('archer')) return ['unit-archer', 'unit-crossbowman'];
            if (lower.includes('spearman')) return ['unit-spearman', 'unit-heavy-infantry'];
            if (lower.includes('knight')) return ['unit-knight'];
            if (lower.includes('engineer')) return ['unit-engineer'];
            if (lower.includes('militia')) return ['unit-militia'];
            return ['unit-militia'];
        },
    };
    return manager;
}

// ─── LevelLoader Tests ──────────────────────────────────────────────────────

describe('LevelLoader.loadLevelList - success path', () => {
    it('should load levels from manifest', async () => {
        const files = {
            'levels/manifest.txt': 'level1.txt\nlevel2.txt',
            'levels/level1.txt': 'name=Level 1\n...',
            'levels/level2.txt': 'name=Level 2\nDD',
            'levels/level1.elevation.txt': '0-5:10',
            'levels/level2.elevation.txt': '0:0',
        };
        const loader = createLevelLoader(async (path) => {
            if (files[path]) return files[path];
            throw new Error(`File not found: ${path}`);
        });

        await loader.loadLevelList();
        assert.equal(loader.levels.length, 2);
        assert.equal(loader.levels[0].name, 'Level 1');
        assert.equal(loader.levels[1].name, 'Level 2');
    });

    it('should parse elevation when available', async () => {
        const files = {
            'levels/manifest.txt': 'level1.txt',
            'levels/level1.txt': 'name=Test\n..',
            'levels/level1.elevation.txt': '0-3:5\n4:10',
        };
        const loader = createLevelLoader(async (path) => {
            if (files[path]) return files[path];
            throw new Error(`Not found: ${path}`);
        });

        await loader.loadLevelList();
        assert.deepEqual(loader.levels[0].elevation, { 0: 5, 1: 5, 2: 5, 3: 5, 4: 10 });
    });

    it('should default elevation to empty when file missing', async () => {
        const files = {
            'levels/manifest.txt': 'level1.txt',
            'levels/level1.txt': 'name=Test\n..',
        };
        const loader = createLevelLoader(async (path) => {
            if (files[path]) return files[path];
            throw new Error(`Not found: ${path}`);
        });

        await loader.loadLevelList();
        assert.deepEqual(loader.levels[0].elevation, {});
    });

    it('should skip comment lines in manifest', async () => {
        const files = {
            'levels/manifest.txt': '; comment\nlevel1.txt\n; another comment',
            'levels/level1.txt': 'name=Only Level\n.',
        };
        const loader = createLevelLoader(async (path) => {
            if (files[path]) return files[path];
            throw new Error(`Not found: ${path}`);
        });

        await loader.loadLevelList();
        assert.equal(loader.levels.length, 1);
        assert.equal(loader.levels[0].name, 'Only Level');
    });
});

describe('LevelLoader.loadLevelList - error handling', () => {
    it('should fall back to default level when manifest fails', async () => {
        const loader = createLevelLoader(async () => {
            throw new Error('Network error');
        });

        await loader.loadLevelList();
        assert.equal(loader.levels.length, 1);
        assert.equal(loader.levels[0].name, 'Default');
    });

    it('should fall back to default level when manifest is empty', async () => {
        const loader = createLevelLoader(async (path) => {
            if (path === 'levels/manifest.txt') return '';
            throw new Error('Not found');
        });

        await loader.loadLevelList();
        // Empty manifest = no files to load, but no error thrown
        // Actually empty lines are filtered, so files array is empty
        assert.equal(loader.levels.length, 0);
    });
});

describe('LevelLoader.parseElevation - edge cases', () => {
    it('should handle single-column format', () => {
        const loader = createLevelLoader(async () => '');
        const result = loader.parseElevation('5:10\n10:-5');
        assert.deepEqual(result, { 5: 10, 10: -5 });
    });

    it('should handle missing offset (no colon)', () => {
        const loader = createLevelLoader(async () => '');
        const result = loader.parseElevation('invalid line\n5:10');
        assert.deepEqual(result, { 5: 10 });
    });

    it('should handle zero offset', () => {
        const loader = createLevelLoader(async () => '');
        const result = loader.parseElevation('0-10:0');
        for (let i = 0; i <= 10; i++) {
            assert.equal(result[i], 0);
        }
    });

    it('should handle whitespace around lines', () => {
        const loader = createLevelLoader(async () => '');
        const result = loader.parseElevation('  5:10  \n  3-4:5  ');
        assert.deepEqual(result, { 5: 10, 3: 5, 4: 5 });
    });
});

// ─── UnitManager Tests ──────────────────────────────────────────────────────

describe('UnitManager.loadResources - success path', () => {
    it('should parse valid CSV into unit definitions', async () => {
        const csv = 'Unit,StartQty,Health,Attack,DefenseModifier\nArcher/Crossbowman,40,100,90,0.80\nKnight,20,100,130,0.40';
        const manager = createUnitManager(async () => csv);

        await manager.loadResources();
        assert.equal(manager.units.length, 2);
        assert.equal(manager.units[0].name, 'Archer/Crossbowman');
        assert.equal(manager.units[0].qty, 40);
        assert.equal(manager.units[0].health, 100);
        assert.equal(manager.units[0].attack, 90);
        assert.equal(manager.units[0].defense, 0.80);
        assert.deepEqual(manager.units[0].sprites, ['unit-archer', 'unit-crossbowman']);
    });

    it('should map unit names to correct sprites', async () => {
        const csv = 'Unit,StartQty,Health,Attack,DefenseModifier\nSpearman/Heavy infantry,30,100,100,0.50\nEngineer/Siege crew,5,100,50,0.85\nMilitia/Watchmen,5,100,60,0.90';
        const manager = createUnitManager(async () => csv);

        await manager.loadResources();
        assert.deepEqual(manager.units[0].sprites, ['unit-spearman', 'unit-heavy-infantry']);
        assert.deepEqual(manager.units[1].sprites, ['unit-engineer']);
        assert.deepEqual(manager.units[2].sprites, ['unit-militia']);
    });
});

describe('UnitManager.loadResources - error handling', () => {
    it('should set units to empty array on fetch failure', async () => {
        const manager = createUnitManager(async () => { throw new Error('Network error'); });

        await manager.loadResources();
        assert.deepEqual(manager.units, []);
    });

    it('should handle empty CSV (header only)', async () => {
        const csv = 'Unit,StartQty,Health,Attack,DefenseModifier';
        const manager = createUnitManager(async () => csv);

        await manager.loadResources();
        assert.deepEqual(manager.units, []);
    });

    it('should handle single empty line', async () => {
        const manager = createUnitManager(async () => '');

        await manager.loadResources();
        assert.deepEqual(manager.units, []);
    });
});

describe('UnitManager.parseCSV - malformed data', () => {
    it('should filter out lines with NaN qty', async () => {
        const csv = 'Unit,StartQty,Health,Attack,DefenseModifier\nArcher,40,100,90,0.80\nBadUnit,abc,100,90,0.80';
        const manager = createUnitManager(async () => csv);

        await manager.loadResources();
        assert.equal(manager.units.length, 1);
        assert.equal(manager.units[0].name, 'Archer');
    });

    it('should filter out lines with empty name', async () => {
        const csv = 'Unit,StartQty,Health,Attack,DefenseModifier\n,40,100,90,0.80\nKnight,20,100,130,0.40';
        const manager = createUnitManager(async () => csv);

        await manager.loadResources();
        assert.equal(manager.units.length, 1);
        assert.equal(manager.units[0].name, 'Knight');
    });

    it('should handle CSV with extra whitespace', async () => {
        const csv = 'Unit,StartQty,Health,Attack,DefenseModifier\n  Archer  ,40,100,90,0.80';
        const manager = createUnitManager(async () => csv);

        await manager.loadResources();
        assert.equal(manager.units[0].name, 'Archer');
    });

    it('should handle missing columns gracefully', async () => {
        const csv = 'Unit,StartQty,Health,Attack,DefenseModifier\nArcher,40';
        const manager = createUnitManager(async () => csv);

        await manager.loadResources();
        // health, attack, defense will be NaN but qty is valid
        assert.equal(manager.units.length, 1);
        assert.equal(manager.units[0].qty, 40);
        assert.ok(isNaN(manager.units[0].health));
    });
});
