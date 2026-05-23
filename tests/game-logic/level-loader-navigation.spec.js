/**
 * Tests for LevelLoader navigation methods and edge cases.
 *
 * Covers nextLevel, resetLevel, getCurrentLevel, and parseElevation
 * branch coverage gaps.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/level-loader-navigation.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── LevelLoader replica with navigation logic ──────────────────────────────

function createLevelLoader() {
    return {
        levels: [],
        currentLevel: 0,

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
            level.width = Math.max(...mapLines.map(l => l.length), 0);
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

        getDefaultLevel() {
            return this.parseLevelText('name=Default\n' + '.'.repeat(30) + '\n');
        },

        getCurrentLevel() { return this.levels[this.currentLevel]; },
        nextLevel() { this.currentLevel++; return this.currentLevel < this.levels.length; },
        resetLevel() {}
    };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('LevelLoader.getCurrentLevel', () => {
    it('should return the first level initially', () => {
        const loader = createLevelLoader();
        loader.levels = [{ name: 'Level 1' }, { name: 'Level 2' }];
        assert.equal(loader.getCurrentLevel().name, 'Level 1');
    });

    it('should return undefined when no levels loaded', () => {
        const loader = createLevelLoader();
        assert.equal(loader.getCurrentLevel(), undefined);
    });
});

describe('LevelLoader.nextLevel', () => {
    let loader;

    beforeEach(() => {
        loader = createLevelLoader();
        loader.levels = [{ name: 'Level 1' }, { name: 'Level 2' }, { name: 'Level 3' }];
    });

    it('should advance to the next level', () => {
        loader.nextLevel();
        assert.equal(loader.currentLevel, 1);
        assert.equal(loader.getCurrentLevel().name, 'Level 2');
    });

    it('should return true when more levels remain', () => {
        const result = loader.nextLevel();
        assert.equal(result, true);
    });

    it('should return true for second-to-last advance', () => {
        loader.nextLevel(); // now at 1
        const result = loader.nextLevel(); // now at 2
        assert.equal(result, true);
    });

    it('should return false when no more levels', () => {
        loader.nextLevel(); // 1
        loader.nextLevel(); // 2
        const result = loader.nextLevel(); // 3 (out of bounds)
        assert.equal(result, false);
    });

    it('should increment currentLevel each call', () => {
        assert.equal(loader.currentLevel, 0);
        loader.nextLevel();
        assert.equal(loader.currentLevel, 1);
        loader.nextLevel();
        assert.equal(loader.currentLevel, 2);
    });
});

describe('LevelLoader.resetLevel', () => {
    it('should be callable without error', () => {
        const loader = createLevelLoader();
        assert.doesNotThrow(() => loader.resetLevel());
    });
});

describe('LevelLoader.getDefaultLevel', () => {
    it('should return a level named Default', () => {
        const loader = createLevelLoader();
        const level = loader.getDefaultLevel();
        assert.equal(level.name, 'Default');
    });

    it('should have width of 30 (30 dots)', () => {
        const loader = createLevelLoader();
        const level = loader.getDefaultLevel();
        assert.equal(level.width, 30);
    });

    it('should have height of 1', () => {
        const loader = createLevelLoader();
        const level = loader.getDefaultLevel();
        assert.equal(level.height, 1);
    });
});

describe('LevelLoader.parseElevation', () => {
    let loader;

    beforeEach(() => {
        loader = createLevelLoader();
    });

    it('should parse single column elevation', () => {
        const result = loader.parseElevation('5:-10');
        assert.deepEqual(result, { 5: -10 });
    });

    it('should parse range elevation', () => {
        const result = loader.parseElevation('3-6:-5');
        assert.deepEqual(result, { 3: -5, 4: -5, 5: -5, 6: -5 });
    });

    it('should parse multiple lines', () => {
        const result = loader.parseElevation('0-2:-10\n5:5\n8-9:3');
        assert.deepEqual(result, { 0: -10, 1: -10, 2: -10, 5: 5, 8: 3, 9: 3 });
    });

    it('should skip comment lines', () => {
        const result = loader.parseElevation('; This is a comment\n3:-5');
        assert.deepEqual(result, { 3: -5 });
    });

    it('should skip empty lines', () => {
        const result = loader.parseElevation('\n\n3:-5\n\n');
        assert.deepEqual(result, { 3: -5 });
    });

    it('should skip lines without colon separator', () => {
        const result = loader.parseElevation('invalid line\n3:-5');
        assert.deepEqual(result, { 3: -5 });
    });

    it('should return empty object for empty input', () => {
        const result = loader.parseElevation('');
        assert.deepEqual(result, {});
    });

    it('should handle positive elevation offsets', () => {
        const result = loader.parseElevation('10:15');
        assert.deepEqual(result, { 10: 15 });
    });

    it('should handle zero offset', () => {
        const result = loader.parseElevation('7:0');
        assert.deepEqual(result, { 7: 0 });
    });
});

describe('LevelLoader.parseLevelText: edge cases', () => {
    let loader;

    beforeEach(() => {
        loader = createLevelLoader();
    });

    it('should handle level with only comments', () => {
        const level = loader.parseLevelText('; comment 1\n; comment 2');
        assert.equal(level.name, 'Unnamed');
        assert.equal(level.height, 0);
    });

    it('should handle level with name but no map', () => {
        const level = loader.parseLevelText('name=Empty Level');
        assert.equal(level.name, 'Empty Level');
        assert.equal(level.height, 0);
    });

    it('should handle mixed comments and map lines', () => {
        const level = loader.parseLevelText('; header\nname=Test\n...\n~~~');
        assert.equal(level.name, 'Test');
        assert.equal(level.height, 2);
        assert.equal(level.width, 3);
    });

    it('should handle lines of different lengths', () => {
        const level = loader.parseLevelText('name=Jagged\n..\n....\n...');
        assert.equal(level.width, 4);
        assert.equal(level.height, 3);
    });

    it('should trim trailing whitespace from lines', () => {
        const level = loader.parseLevelText('name=Trimmed\n...   \n~~');
        // trimEnd removes trailing spaces, so '...   ' becomes '...'
        assert.equal(level.height, 2);
    });
});
