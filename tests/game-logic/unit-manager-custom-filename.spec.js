/**
 * Tests for UnitManager.loadResources() with a custom filename (Recommendation 8).
 *
 * Verifies that the `filename` parameter is used correctly when provided,
 * and that the default path is used when omitted.
 *
 * Since loadResources() uses the browser global `loadTextFile`, we test the
 * logic by simulating the loadResources behavior with a mock loadTextFile.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/unit-manager-custom-filename.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Replicate UnitManager with injectable loadTextFile ───────────────────────

/**
 * Creates a UnitManager instance with an injectable file loader.
 * This allows testing the filename parameter without DOM/fetch dependencies.
 */
function createUnitManager(mockLoadTextFile) {
    return {
        units: [],
        placed: [],
        _loadTextFile: mockLoadTextFile,

        async loadResources(filename) {
            const file = filename || 'levels/default.resources.txt';
            try {
                const text = await this._loadTextFile(file);
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
            if (lower.includes('archer') || lower.includes('crossbow')) {
                return ['unit-archer', 'unit-crossbowman'];
            }
            if (lower.includes('militia') || lower.includes('watch')) {
                return ['unit-militia'];
            }
            return ['unit-militia'];
        },
    };
}

const SAMPLE_CSV = `Unit,StartQty,Health,Attack,DefenseModifier
Archer/Crossbowman,4,30,15,0.9
Militia/Watchmen,6,25,10,0.85`;

const CUSTOM_CSV = `Unit,StartQty,Health,Attack,DefenseModifier
Militia/Watchmen,10,20,8,0.9`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UnitManager.loadResources: default filename', () => {
    it('should use default path when no filename is provided', async () => {
        const requestedFiles = [];
        const mockLoader = async (file) => {
            requestedFiles.push(file);
            return SAMPLE_CSV;
        };

        const um = createUnitManager(mockLoader);
        await um.loadResources();

        assert.equal(requestedFiles.length, 1, 'Should make exactly one file request');
        assert.equal(requestedFiles[0], 'levels/default.resources.txt',
            'Should use the default path when no filename given');
    });

    it('should use default path when filename is undefined', async () => {
        const requestedFiles = [];
        const mockLoader = async (file) => {
            requestedFiles.push(file);
            return SAMPLE_CSV;
        };

        const um = createUnitManager(mockLoader);
        await um.loadResources(undefined);

        assert.equal(requestedFiles[0], 'levels/default.resources.txt');
    });

    it('should use default path when filename is null', async () => {
        const requestedFiles = [];
        const mockLoader = async (file) => {
            requestedFiles.push(file);
            return SAMPLE_CSV;
        };

        const um = createUnitManager(mockLoader);
        await um.loadResources(null);

        assert.equal(requestedFiles[0], 'levels/default.resources.txt');
    });

    it('should parse units from the default file', async () => {
        const um = createUnitManager(async () => SAMPLE_CSV);
        await um.loadResources();

        assert.equal(um.units.length, 2, 'Should parse 2 units from default file');
        assert.equal(um.units[0].name, 'Archer/Crossbowman');
    });
});

describe('UnitManager.loadResources: custom filename', () => {
    it('should use the provided custom filename', async () => {
        const requestedFiles = [];
        const mockLoader = async (file) => {
            requestedFiles.push(file);
            return CUSTOM_CSV;
        };

        const um = createUnitManager(mockLoader);
        await um.loadResources('levels/level2.resources.txt');

        assert.equal(requestedFiles.length, 1, 'Should make exactly one file request');
        assert.equal(requestedFiles[0], 'levels/level2.resources.txt',
            'Should use the custom filename');
    });

    it('should parse units from the custom file', async () => {
        const um = createUnitManager(async () => CUSTOM_CSV);
        await um.loadResources('levels/custom.resources.txt');

        assert.equal(um.units.length, 1, 'Should parse 1 unit from custom file');
        assert.equal(um.units[0].name, 'Militia/Watchmen');
        assert.equal(um.units[0].qty, 10);
    });

    it('should use a different file than the default when custom path given', async () => {
        const requestedFiles = [];
        const mockLoader = async (file) => {
            requestedFiles.push(file);
            if (file === 'levels/level3.resources.txt') return CUSTOM_CSV;
            return SAMPLE_CSV;
        };

        const um = createUnitManager(mockLoader);
        await um.loadResources('levels/level3.resources.txt');

        assert.equal(requestedFiles[0], 'levels/level3.resources.txt');
        assert.notEqual(requestedFiles[0], 'levels/default.resources.txt',
            'Custom filename should not fall back to default');
    });

    it('should handle absolute-style paths', async () => {
        const requestedFiles = [];
        const mockLoader = async (file) => {
            requestedFiles.push(file);
            return SAMPLE_CSV;
        };

        const um = createUnitManager(mockLoader);
        await um.loadResources('assets/data/units.csv');

        assert.equal(requestedFiles[0], 'assets/data/units.csv');
    });

    it('should handle paths with subdirectories', async () => {
        const requestedFiles = [];
        const mockLoader = async (file) => {
            requestedFiles.push(file);
            return SAMPLE_CSV;
        };

        const um = createUnitManager(mockLoader);
        await um.loadResources('levels/campaign/mission1.resources.txt');

        assert.equal(requestedFiles[0], 'levels/campaign/mission1.resources.txt');
    });
});

describe('UnitManager.loadResources: error handling with custom filename', () => {
    it('should set units to empty array when custom file load fails', async () => {
        const mockLoader = async (file) => {
            throw new Error(`File not found: ${file}`);
        };

        const um = createUnitManager(mockLoader);
        await um.loadResources('levels/nonexistent.resources.txt');

        assert.deepEqual(um.units, [],
            'Should set units to empty array on load failure');
    });

    it('should set units to empty array when default file load fails', async () => {
        const mockLoader = async () => {
            throw new Error('Network error');
        };

        const um = createUnitManager(mockLoader);
        await um.loadResources();

        assert.deepEqual(um.units, []);
    });

    it('should not throw when file load fails', async () => {
        const mockLoader = async () => {
            throw new Error('File not found');
        };

        const um = createUnitManager(mockLoader);
        await assert.doesNotReject(
            () => um.loadResources('bad-path.txt'),
            'loadResources should not throw on file load failure'
        );
    });

    it('should recover from failure — subsequent call with valid file works', async () => {
        let callCount = 0;
        const mockLoader = async (file) => {
            callCount++;
            if (callCount === 1) throw new Error('First call fails');
            return SAMPLE_CSV;
        };

        const um = createUnitManager(mockLoader);

        // First call fails
        await um.loadResources('bad.txt');
        assert.deepEqual(um.units, []);

        // Second call succeeds
        await um.loadResources('good.txt');
        assert.equal(um.units.length, 2, 'Should load units on second call');
    });
});

describe('UnitManager.loadResources: filename vs default interaction', () => {
    it('should load different data from different filenames', async () => {
        const fileContents = {
            'levels/default.resources.txt': SAMPLE_CSV,
            'levels/custom.resources.txt': CUSTOM_CSV,
        };

        const mockLoader = async (file) => {
            if (fileContents[file]) return fileContents[file];
            throw new Error(`Unknown file: ${file}`);
        };

        const um1 = createUnitManager(mockLoader);
        await um1.loadResources();
        assert.equal(um1.units.length, 2, 'Default file should have 2 units');

        const um2 = createUnitManager(mockLoader);
        await um2.loadResources('levels/custom.resources.txt');
        assert.equal(um2.units.length, 1, 'Custom file should have 1 unit');
    });

    it('should not share state between separate UnitManager instances', async () => {
        const um1 = createUnitManager(async () => SAMPLE_CSV);
        const um2 = createUnitManager(async () => CUSTOM_CSV);

        await um1.loadResources();
        await um2.loadResources('custom.txt');

        assert.equal(um1.units.length, 2);
        assert.equal(um2.units.length, 1);
        // Verify they are independent
        assert.notEqual(um1.units, um2.units);
    });
});
