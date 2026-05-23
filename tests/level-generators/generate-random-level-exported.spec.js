/**
 * Tests for generate-random-level.js using actual module exports.
 *
 * Recommendation 2: Export internal functions from generator scripts.
 * Now that generateLevel, hashNoise, smoothNoise are exported, we can
 * test them directly without re-implementing.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-random-level-exported.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    generateLevel,
    hashNoise,
    smoothNoise,
    setSeed,
    random,
    randomInt,
    W,
    H,
} = require('../../js/level-generators/generate-random-level');

describe('generate-random-level (exported): generateLevel', () => {
    it('should produce a valid level string with header and map', () => {
        const output = generateLevel(42);
        assert.ok(output.includes('name='));
        const lines = output.split('\n').filter(l => l.length > 0);
        assert.ok(lines.length > 5, 'Should have header + map lines');
    });

    it('should produce deterministic output for same seed', () => {
        const out1 = generateLevel(12345);
        const out2 = generateLevel(12345);
        assert.equal(out1, out2);
    });

    it('should produce different output for different seeds', () => {
        const out1 = generateLevel(100);
        const out2 = generateLevel(200);
        assert.notEqual(out1, out2);
    });

    it('should produce a map of correct dimensions (50x35)', () => {
        const output = generateLevel(42);
        // Extract map lines (non-comment, non-name lines)
        const lines = output.split('\n');
        const mapLines = lines.filter(l => l.length > 0 && !l.startsWith(';') && !l.startsWith('name='));
        assert.equal(mapLines.length, H);
        assert.equal(mapLines[0].length, W);
    });

    it('should always have water on the left edge', () => {
        const output = generateLevel(999);
        const lines = output.split('\n');
        const mapLines = lines.filter(l => l.length > 0 && !l.startsWith(';') && !l.startsWith('name='));
        for (const line of mapLines) {
            assert.ok(
                line[0] === '~' || line[0] === ')',
                `First char should be water, got "${line[0]}"`
            );
        }
    });
});

describe('generate-random-level (exported): hashNoise concurrent seeds', () => {
    it('should produce different output for different seeds', () => {
        setSeed(100);
        const val1 = hashNoise(5, 5);
        setSeed(200);
        const val2 = hashNoise(5, 5);
        assert.notEqual(val1, val2, 'Different seeds should produce different noise');
    });

    it('should produce values in [0, 1] for large coordinate ranges', () => {
        setSeed(42);
        for (let x = -100; x <= 100; x += 20) {
            for (let y = -100; y <= 100; y += 20) {
                const val = hashNoise(x, y);
                assert.ok(val >= 0 && val <= 1, `hashNoise(${x},${y}) = ${val}`);
            }
        }
    });
});

describe('generate-random-level (exported): smoothNoise', () => {
    it('should produce different output for different seeds', () => {
        setSeed(100);
        const val1 = smoothNoise(5, 5, 4);
        setSeed(200);
        const val2 = smoothNoise(5, 5, 4);
        assert.notEqual(val1, val2, 'Different seeds should produce different smooth noise');
    });
});

describe('generate-tutorial-level (exported): generate', () => {
    const { generate, W: TW, H: TH } = require('../../js/level-generators/generate-tutorial-level');

    it('should produce a valid level string', () => {
        const output = generate();
        assert.ok(output.includes('name=Tutorial'));
        assert.ok(output.includes('~'), 'Should contain water');
        assert.ok(output.includes('D'), 'Should contain road');
    });

    it('should produce a map of correct dimensions (50x30)', () => {
        assert.equal(TW, 50);
        assert.equal(TH, 30);
        const output = generate();
        const lines = output.split('\n');
        const mapLines = lines.filter(l => l.length > 0 && !l.startsWith(';') && !l.startsWith('name='));
        assert.equal(mapLines.length, TH);
        assert.equal(mapLines[0].length, TW);
    });

    it('should be deterministic (no random elements)', () => {
        const out1 = generate();
        const out2 = generate();
        assert.equal(out1, out2);
    });

    it('should contain castle-related tiles', () => {
        const output = generate();
        // Tutorial level should have roads
        assert.ok(output.includes('D'), 'Should have road tiles');
        assert.ok(output.includes('O'), 'Should have tree tiles');
    });
});

describe('generate-random-level (exported): hasBranch branch coverage', () => {
    /**
     * Find a seed where the 4th random() call (hasBranch) returns <= 0.4.
     * Sequence after setSeed: forestWeight, waterWidth, roadCount, hasBranch.
     */
    function findNoBranchSeed() {
        for (let s = 1; s <= 10000; s++) {
            setSeed(s);
            random(); // forestWeight
            random(); // waterWidth
            random(); // roadCount
            if (random() <= 0.4) return s;
        }
        throw new Error('Could not find a no-branch seed in 1..10000');
    }

    function findBranchSeed() {
        for (let s = 1; s <= 10000; s++) {
            setSeed(s);
            random(); // forestWeight
            random(); // waterWidth
            random(); // roadCount
            if (random() > 0.4) return s;
        }
        throw new Error('Could not find a branch seed in 1..10000');
    }

    it('should include "; Roads: 1" (no "+ branch") when hasBranch is false', () => {
        const seed = findNoBranchSeed();
        const output = generateLevel(seed);
        assert.ok(
            output.includes('; Roads: 1\n') || output.includes('; Roads: 2\n'),
            `Expected header without "+ branch", got: ${output.split('\n').find(l => l.startsWith('; Roads'))}`
        );
        const roadsLine = output.split('\n').find(l => l.startsWith('; Roads'));
        assert.ok(roadsLine !== undefined, 'Should have a Roads header line');
        assert.ok(!roadsLine.includes('+ branch'), `Expected no "+ branch" in "${roadsLine}"`);
    });

    it('should include "+ branch" in header when hasBranch is true', () => {
        const seed = findBranchSeed();
        const output = generateLevel(seed);
        const roadsLine = output.split('\n').find(l => l.startsWith('; Roads'));
        assert.ok(roadsLine !== undefined, 'Should have a Roads header line');
        assert.ok(roadsLine.includes('+ branch'), `Expected "+ branch" in "${roadsLine}"`);
    });

    it('should have fewer road tiles when hasBranch is false vs true', () => {
        const noBranchSeed = findNoBranchSeed();
        const branchSeed = findBranchSeed();

        const noBranchOutput = generateLevel(noBranchSeed);
        const branchOutput = generateLevel(branchSeed);

        // Count road tiles (L, D, r, U, u characters) in map section only
        function countRoadTiles(output) {
            const lines = output.split('\n');
            const mapLines = lines.filter(l => l.length > 0 && !l.startsWith(';') && !l.startsWith('name='));
            const mapStr = mapLines.join('');
            let count = 0;
            for (const ch of mapStr) {
                if (ch === 'L' || ch === 'D' || ch === 'r' || ch === 'U' || ch === 'u') count++;
            }
            return count;
        }

        const noBranchRoads = countRoadTiles(noBranchOutput);
        const branchRoads = countRoadTiles(branchOutput);

        // The branch adds a significant number of road tiles; no-branch should have fewer
        assert.ok(
            noBranchRoads < branchRoads,
            `Expected no-branch (${noBranchRoads}) < branch (${branchRoads}) road tiles`
        );
    });
});
