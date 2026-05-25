/**
 * Tests for UnitManager.loadResources() using a loadTextFile mock.
 *
 * loadResources() is the only untested async method in unit-manager.js.
 * Because the production code calls the global `loadTextFile`, we inject
 * a mock via the same dependency-injection pattern used in
 * sprites-dom-mock.spec.js (loadAll(loadImageFn)).
 *
 * The UnitManager replica here adds an optional `loadFn` parameter to
 * loadResources() so it can be tested without a real network/filesystem.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/unit-manager-load-resources.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── UnitManager replica with injectable loadFn ───────────────────────────────

function createUnitManager() {
    return {
        units: [],
        placed: [],

        /**
         * Load and parse the resources CSV file.
         * @param {string} [filename] - Override the default filename.
         * @param {Function} [loadFn] - Injectable async text-loader (defaults to global loadTextFile).
         */
        async loadResources(filename, loadFn) {
            const file = filename || 'levels/default.resources.txt';
            const loader = loadFn || (typeof loadTextFile !== 'undefined' ? loadTextFile : null);
            if (!loader) throw new Error('No loadTextFile available');
            try {
                const text = await loader(file);
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
            if (lower.includes('archer') || lower.includes('crossbow')) return ['unit-archer', 'unit-crossbowman'];
            if (lower.includes('spearman') || lower.includes('heavy infantry')) return ['unit-spearman', 'unit-heavy-infantry'];
            if (lower.includes('men-at-arms') || lower.includes('heavy troop') || lower.includes('knight')) return ['unit-knight'];
            if (lower.includes('engineer') || lower.includes('siege')) return ['unit-engineer'];
            if (lower.includes('militia') || lower.includes('watch')) return ['unit-militia'];
            if (lower.includes('artillery') || lower.includes('cannon')) return ['unit-artillery'];
            if (lower.includes('skirmish') || lower.includes('javelin')) return ['unit-skirmisher'];
            return ['unit-militia'];
        },

        canPlaceOn(sprite) {
            const blocked = [
                'tree-', 'water-', 'castle-wall', 'castle-keep-',
                'castle-gatehouse', 'rock'
            ];
            for (const prefix of blocked) {
                if (sprite.startsWith(prefix)) return false;
            }
            return true;
        },
    };
}

// ─── Sample CSV data ──────────────────────────────────────────────────────────

const SAMPLE_CSV = `Unit,StartQty,Health,Attack,DefenseModifier
Archer/Crossbowman,4,30,15,0.9
Spearman/Heavy infantry,3,50,20,0.7
Men-at-arms (heavy trooper),2,80,25,0.5
Engineer/Siege crew,1,20,5,0.95
Militia/Watchmen,6,25,10,0.85`;

// ─── Tests: successful load ───────────────────────────────────────────────────

describe('UnitManager.loadResources() — successful load', () => {
    let um;

    beforeEach(() => {
        um = createUnitManager();
    });

    it('should populate units from the CSV text', async () => {
        const loadFn = async (_file) => SAMPLE_CSV;
        await um.loadResources('levels/default.resources.txt', loadFn);
        assert.equal(um.units.length, 5, 'Should parse 5 unit types from sample CSV');
    });

    it('should parse unit names correctly', async () => {
        const loadFn = async () => SAMPLE_CSV;
        await um.loadResources(undefined, loadFn);
        assert.equal(um.units[0].name, 'Archer/Crossbowman');
        assert.equal(um.units[2].name, 'Men-at-arms (heavy trooper)');
    });

    it('should parse numeric stats correctly', async () => {
        const loadFn = async () => SAMPLE_CSV;
        await um.loadResources(undefined, loadFn);
        assert.equal(um.units[0].qty, 4);
        assert.equal(um.units[0].health, 30);
        assert.equal(um.units[0].attack, 15);
        assert.equal(um.units[0].defense, 0.9);
    });

    it('should set qtyRemaining equal to qty on load', async () => {
        const loadFn = async () => SAMPLE_CSV;
        await um.loadResources(undefined, loadFn);
        for (const u of um.units) {
            assert.equal(u.qtyRemaining, u.qty, `${u.name}: qtyRemaining should equal qty`);
        }
    });

    it('should assign sprites based on unit name', async () => {
        const loadFn = async () => SAMPLE_CSV;
        await um.loadResources(undefined, loadFn);
        assert.deepEqual(um.units[0].sprites, ['unit-archer', 'unit-crossbowman']);
        assert.deepEqual(um.units[2].sprites, ['unit-knight']);
    });
});

// ─── Tests: custom filename ───────────────────────────────────────────────────

describe('UnitManager.loadResources() — custom filename', () => {
    it('should pass the custom filename to the loader', async () => {
        const um = createUnitManager();
        let loadedFile = null;
        const loadFn = async (file) => {
            loadedFile = file;
            return SAMPLE_CSV;
        };

        await um.loadResources('levels/custom.resources.txt', loadFn);

        assert.equal(loadedFile, 'levels/custom.resources.txt',
            'loadFn should be called with the custom filename');
    });

    it('should use default filename when none is provided', async () => {
        const um = createUnitManager();
        let loadedFile = null;
        const loadFn = async (file) => {
            loadedFile = file;
            return SAMPLE_CSV;
        };

        await um.loadResources(undefined, loadFn);

        assert.equal(loadedFile, 'levels/default.resources.txt',
            'Default filename should be levels/default.resources.txt');
    });

    it('should use default filename when null is passed', async () => {
        const um = createUnitManager();
        let loadedFile = null;
        const loadFn = async (file) => {
            loadedFile = file;
            return SAMPLE_CSV;
        };

        await um.loadResources(null, loadFn);

        assert.equal(loadedFile, 'levels/default.resources.txt');
    });
});

// ─── Tests: error handling ────────────────────────────────────────────────────

describe('UnitManager.loadResources() — error handling', () => {
    it('should set units to [] when the loader throws', async () => {
        const um = createUnitManager();
        const loadFn = async () => { throw new Error('Network error'); };

        await um.loadResources(undefined, loadFn);

        assert.deepEqual(um.units, [], 'units should be empty array on load failure');
    });

    it('should not throw when the loader rejects', async () => {
        const um = createUnitManager();
        const loadFn = async () => { throw new Error('File not found'); };

        await assert.doesNotReject(
            () => um.loadResources(undefined, loadFn),
            'loadResources should not propagate the error'
        );
    });

    it('should set units to [] when CSV has only a header row', async () => {
        const um = createUnitManager();
        const loadFn = async () => 'Unit,StartQty,Health,Attack,DefenseModifier';

        await um.loadResources(undefined, loadFn);

        assert.deepEqual(um.units, [], 'Header-only CSV should produce empty units array');
    });

    it('should set units to [] when CSV is empty', async () => {
        const um = createUnitManager();
        const loadFn = async () => '';

        await um.loadResources(undefined, loadFn);

        assert.deepEqual(um.units, []);
    });

    it('should filter out rows with invalid qty (NaN)', async () => {
        const um = createUnitManager();
        const csv = `Unit,StartQty,Health,Attack,DefenseModifier
Archer,abc,30,15,0.9
Militia,5,25,10,0.85`;
        const loadFn = async () => csv;

        await um.loadResources(undefined, loadFn);

        assert.equal(um.units.length, 1, 'Row with invalid qty should be filtered out');
        assert.equal(um.units[0].name, 'Militia');
    });

    it('should overwrite previously loaded units on a second call', async () => {
        const um = createUnitManager();
        const csv1 = `Unit,StartQty,Health,Attack,DefenseModifier\nArcher,4,30,15,0.9`;
        const csv2 = `Unit,StartQty,Health,Attack,DefenseModifier\nMilitia,6,25,10,0.85\nKnight,2,80,25,0.5`;

        await um.loadResources(undefined, async () => csv1);
        assert.equal(um.units.length, 1);

        await um.loadResources(undefined, async () => csv2);
        assert.equal(um.units.length, 2, 'Second load should replace first load');
        assert.equal(um.units[0].name, 'Militia');
    });
});

// ─── Tests: canPlaceOn — missing coverage for castle-bridge-mid ───────────────

describe('UnitManager.canPlaceOn() — castle bridge tiles (previously untested)', () => {
    const um = createUnitManager();

    it('should allow placement on castle-bridge-mid', () => {
        assert.equal(um.canPlaceOn('castle-bridge-mid'), true,
            'castle-bridge-mid does not match any blocked prefix');
    });

    it('should allow placement on castle-bridge-start', () => {
        assert.equal(um.canPlaceOn('castle-bridge-start'), true);
    });

    it('should allow placement on castle-bridge-gate', () => {
        assert.equal(um.canPlaceOn('castle-bridge-gate'), true);
    });

    it('should block placement on castle-wall-damaged (starts with castle-wall)', () => {
        assert.equal(um.canPlaceOn('castle-wall-damaged'), false,
            'castle-wall-damaged starts with castle-wall prefix');
    });

    it('should block placement on castle-keep-tl-damaged (starts with castle-keep-)', () => {
        assert.equal(um.canPlaceOn('castle-keep-tl-damaged'), false);
    });

    it('should allow placement on castle-bailey-1-damaged (bailey is not blocked)', () => {
        assert.equal(um.canPlaceOn('castle-bailey-1-damaged'), true,
            'castle-bailey prefix is not in the blocked list');
    });

    it('should allow placement on tree-oak-overlay-1 (starts with tree-)', () => {
        // tree- prefix IS blocked — overlay sprites should also be blocked
        assert.equal(um.canPlaceOn('tree-oak-overlay-1'), false,
            'tree-oak-overlay-1 starts with tree- and should be blocked');
    });
});
