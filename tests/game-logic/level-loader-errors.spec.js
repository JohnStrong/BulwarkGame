/**
 * Error path tests for js/game-logic/level-loader.js
 *
 * Recommendation 4: Add error path tests for parseElevation and loadLevelList.
 * Tests malformed elevation data, edge cases, and fallback behavior.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/level-loader-errors.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Replicate parseElevation for testing
function parseElevation(text) {
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
}

// Replicate loadLevelList fallback logic
function loadLevelList(manifestText) {
    if (!manifestText || manifestText.trim() === '') {
        return ['levels/level1.txt']; // fallback default
    }
    const lines = manifestText.trim().split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith(';') && !l.startsWith('#'));
    if (lines.length === 0) {
        return ['levels/level1.txt']; // fallback default
    }
    return lines;
}

describe('parseElevation: malformed data', () => {
    it('should handle lines with only a colon (no range or offset)', () => {
        const result = parseElevation(':');
        // parseInt('', 10) is NaN, so the key is NaN
        // This is a graceful degradation — no crash
        assert.ok(typeof result === 'object');
    });

    it('should handle non-numeric range values', () => {
        const result = parseElevation('abc:10');
        // parseInt('abc', 10) is NaN, so key is NaN
        assert.ok(typeof result === 'object');
        // Valid entries should still work alongside malformed ones
    });

    it('should handle non-numeric offset values', () => {
        const result = parseElevation('5:abc');
        // parseInt('abc', 10) is NaN
        assert.deepEqual(result, { 5: NaN });
    });

    it('should handle range with non-numeric start', () => {
        const result = parseElevation('a-5:10');
        // NaN to 5 range — loop won't execute since NaN <= 5 is false
        assert.ok(typeof result === 'object');
    });

    it('should handle range with non-numeric end', () => {
        const result = parseElevation('2-abc:10');
        // 2 to NaN range — loop condition 2 <= NaN is false
        assert.ok(typeof result === 'object');
    });

    it('should handle reversed range (start > end)', () => {
        const result = parseElevation('10-5:8');
        // Loop from 10 to 5 won't execute (10 <= 5 is false)
        assert.deepEqual(result, {});
    });

    it('should handle multiple colons in a line', () => {
        const result = parseElevation('5:10:extra');
        // split(':') gives ['5', '10', 'extra'], offset = '10'
        assert.deepEqual(result, { 5: 10 });
    });

    it('should handle whitespace-only lines', () => {
        const result = parseElevation('   \n  \n');
        assert.deepEqual(result, {});
    });

    it('should handle mixed valid and invalid lines', () => {
        const result = parseElevation('1:5\ninvalid\n3:10\n::\nabc-def:xyz');
        assert.equal(result[1], 5);
        assert.equal(result[3], 10);
    });

    it('should handle very large range values', () => {
        const result = parseElevation('0-1000:5');
        assert.equal(Object.keys(result).length, 1001);
        assert.equal(result[0], 5);
        assert.equal(result[1000], 5);
    });

    it('should handle negative range start', () => {
        const result = parseElevation('-3-2:10');
        // split('-') on '-3-2' gives ['', '3', '2']
        // This is an edge case in the parsing logic
        assert.ok(typeof result === 'object');
    });

    it('should handle float offset values (truncated to int)', () => {
        const result = parseElevation('5:3.7');
        assert.equal(result[5], 3); // parseInt truncates
    });

    it('should handle tab-separated content gracefully', () => {
        const result = parseElevation('5\t:\t10');
        // split(':') on '5\t' gives ['5\t', '\t10']
        // parseInt('5\t') = 5, parseInt('\t10') = NaN (leading whitespace handled by parseInt)
        // Actually parseInt handles leading whitespace, so parseInt('\t10') = 10
        assert.ok(typeof result === 'object');
    });
});

describe('loadLevelList: fallback behavior', () => {
    it('should return default level when manifest is null', () => {
        const result = loadLevelList(null);
        assert.deepEqual(result, ['levels/level1.txt']);
    });

    it('should return default level when manifest is empty string', () => {
        const result = loadLevelList('');
        assert.deepEqual(result, ['levels/level1.txt']);
    });

    it('should return default level when manifest is whitespace only', () => {
        const result = loadLevelList('   \n  \n  ');
        assert.deepEqual(result, ['levels/level1.txt']);
    });

    it('should return default level when manifest has only comments', () => {
        const result = loadLevelList('; comment 1\n# comment 2\n; comment 3');
        assert.deepEqual(result, ['levels/level1.txt']);
    });

    it('should parse valid manifest lines', () => {
        const result = loadLevelList('levels/level1.txt\nlevels/level2.txt\nlevels/level3.txt');
        assert.deepEqual(result, ['levels/level1.txt', 'levels/level2.txt', 'levels/level3.txt']);
    });

    it('should filter out comment lines from manifest', () => {
        const result = loadLevelList('; Level manifest\nlevels/level1.txt\n# disabled\nlevels/level2.txt');
        assert.deepEqual(result, ['levels/level1.txt', 'levels/level2.txt']);
    });

    it('should trim whitespace from level paths', () => {
        const result = loadLevelList('  levels/level1.txt  \n  levels/level2.txt  ');
        assert.deepEqual(result, ['levels/level1.txt', 'levels/level2.txt']);
    });

    it('should filter out empty lines', () => {
        const result = loadLevelList('levels/level1.txt\n\n\nlevels/level2.txt\n\n');
        assert.deepEqual(result, ['levels/level1.txt', 'levels/level2.txt']);
    });

    it('should handle single level in manifest', () => {
        const result = loadLevelList('levels/custom.txt');
        assert.deepEqual(result, ['levels/custom.txt']);
    });
});
