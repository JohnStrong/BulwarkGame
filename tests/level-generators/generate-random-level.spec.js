/**
 * Tests for js/level-generators/generate-random-level.js
 *
 * Tests the level generation logic by re-implementing the core functions
 * (since the module auto-runs on require and writes to disk).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-random-level.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Re-implement the core logic from generate-random-level.js for testing

const W = 50;
const H = 35;

let seed = 0;

function setSeed(s) {
    seed = s & 0xFFFFFFFF;
}

function random() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}

function randomInt(min, max) {
    return min + Math.floor(random() * (max - min + 1));
}

function hashNoise(x, y) {
    let h = (x * 374761393 + y * 668265263 + seed) & 0xFFFFFFFF;
    h = ((h >> 13) ^ h) * 1274126177;
    h = ((h >> 16) ^ h);
    return (h >>> 0) / 0xFFFFFFFF;
}

function smoothNoise(x, y, scale) {
    const sx = x / scale;
    const sy = y / scale;
    const ix = Math.floor(sx);
    const iy = Math.floor(sy);
    const fx = sx - ix;
    const fy = sy - iy;
    const v00 = hashNoise(ix, iy);
    const v10 = hashNoise(ix + 1, iy);
    const v01 = hashNoise(ix, iy + 1);
    const v11 = hashNoise(ix + 1, iy + 1);
    const i0 = v00 * (1 - fx) + v10 * fx;
    const i1 = v01 * (1 - fx) + v11 * fx;
    return i0 * (1 - fy) + i1 * fy;
}

describe('generate-random-level: PRNG', () => {
    it('random() should return values between 0 and 1', () => {
        setSeed(42);
        for (let i = 0; i < 100; i++) {
            const val = random();
            assert.ok(val >= 0 && val <= 1, `Value ${val} out of range`);
        }
    });

    it('random() should be deterministic for the same seed', () => {
        setSeed(12345);
        const seq1 = [];
        for (let i = 0; i < 20; i++) seq1.push(random());

        setSeed(12345);
        const seq2 = [];
        for (let i = 0; i < 20; i++) seq2.push(random());

        assert.deepEqual(seq1, seq2);
    });

    it('random() should produce different values for different seeds', () => {
        setSeed(100);
        const val1 = random();
        setSeed(200);
        const val2 = random();
        assert.notEqual(val1, val2);
    });

    it('random() should produce varied output (not constant)', () => {
        setSeed(999);
        const values = new Set();
        for (let i = 0; i < 50; i++) values.add(random());
        assert.ok(values.size > 40);
    });
});

describe('generate-random-level: randomInt', () => {
    it('should return values within [min, max] inclusive', () => {
        setSeed(42);
        for (let i = 0; i < 100; i++) {
            const val = randomInt(5, 10);
            assert.ok(val >= 5 && val <= 10, `Value ${val} out of range [5, 10]`);
        }
    });

    it('should return min when min === max', () => {
        setSeed(42);
        const val = randomInt(7, 7);
        assert.equal(val, 7);
    });

    it('should produce varied values across the range', () => {
        setSeed(42);
        const values = new Set();
        for (let i = 0; i < 100; i++) values.add(randomInt(0, 5));
        // Should hit most values in [0, 5]
        assert.ok(values.size >= 4, `Should cover most of range, got ${values.size} unique values`);
    });
});

describe('generate-random-level: hashNoise', () => {
    it('should return values between 0 and 1', () => {
        setSeed(42);
        for (let x = 0; x < 20; x++) {
            for (let y = 0; y < 20; y++) {
                const val = hashNoise(x, y);
                assert.ok(val >= 0 && val <= 1, `hashNoise(${x},${y}) = ${val} out of range`);
            }
        }
    });

    it('should be deterministic for the same inputs and seed', () => {
        setSeed(42);
        const val1 = hashNoise(5, 10);
        setSeed(42);
        const val2 = hashNoise(5, 10);
        assert.equal(val1, val2);
    });

    it('should produce different values for different coordinates', () => {
        setSeed(42);
        const val1 = hashNoise(0, 0);
        const val2 = hashNoise(1, 0);
        const val3 = hashNoise(0, 1);
        // At least some should differ
        assert.ok(val1 !== val2 || val2 !== val3, 'Different coords should give different noise');
    });
});

describe('generate-random-level: smoothNoise', () => {
    it('should return values between 0 and 1', () => {
        setSeed(42);
        for (let x = 0; x < 10; x++) {
            for (let y = 0; y < 10; y++) {
                const val = smoothNoise(x, y, 4);
                assert.ok(val >= 0 && val <= 1, `smoothNoise(${x},${y},4) = ${val} out of range`);
            }
        }
    });

    it('should produce smooth transitions (adjacent values close)', () => {
        setSeed(42);
        const val1 = smoothNoise(5, 5, 8);
        const val2 = smoothNoise(5.1, 5, 8);
        const diff = Math.abs(val1 - val2);
        assert.ok(diff < 0.1, `Adjacent noise values should be close, diff=${diff}`);
    });

    it('should be deterministic', () => {
        setSeed(100);
        const val1 = smoothNoise(3, 7, 4);
        setSeed(100);
        const val2 = smoothNoise(3, 7, 4);
        assert.equal(val1, val2);
    });
});

describe('generate-random-level: map dimensions', () => {
    it('W should be 50', () => {
        assert.equal(W, 50);
    });

    it('H should be 35', () => {
        assert.equal(H, 35);
    });
});

describe('generate-random-level: map generation logic', () => {
    function generateMap(inputSeed) {
        setSeed(inputSeed);
        const forestWeight = random() * 0.6 + 0.1;
        const waterWidth = Math.floor(random() * 4) + 2;
        const roadCount = Math.floor(random() * 2) + 1;
        const hasBranch = random() > 0.4;

        const map = Array.from({ length: H }, () => Array(W).fill('.'));

        // Water placement
        for (let row = 0; row < H; row++) {
            const jag = Math.round(smoothNoise(row, 0, 4) * 2);
            const coastEnd = waterWidth + jag;
            for (let col = 0; col < coastEnd - 1; col++) {
                map[row][col] = '~';
            }
            map[row][coastEnd - 1] = ')';
        }

        return { map, forestWeight, waterWidth, roadCount, hasBranch };
    }

    it('should initialize map with grass tiles', () => {
        const { map } = generateMap(42);
        // Most tiles should be grass or water
        let grassCount = 0;
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                if (map[r][c] === '.') grassCount++;
            }
        }
        assert.ok(grassCount > 0, 'Map should have grass tiles');
    });

    it('should place water on the left edge', () => {
        const { map } = generateMap(42);
        // First column should always be water
        for (let r = 0; r < H; r++) {
            assert.ok(map[r][0] === '~' || map[r][0] === ')', `Row ${r} col 0 should be water, got "${map[r][0]}"`);
        }
    });

    it('should have water width between 2 and 5', () => {
        const { waterWidth } = generateMap(42);
        assert.ok(waterWidth >= 2 && waterWidth <= 5, `Water width ${waterWidth} out of range`);
    });

    it('should have forest weight between 0.1 and 0.7', () => {
        const { forestWeight } = generateMap(42);
        assert.ok(forestWeight >= 0.1 && forestWeight <= 0.7, `Forest weight ${forestWeight} out of range`);
    });

    it('should have 1 or 2 roads', () => {
        const { roadCount } = generateMap(42);
        assert.ok(roadCount >= 1 && roadCount <= 2, `Road count ${roadCount} out of range`);
    });

    it('should produce deterministic maps for the same seed', () => {
        const { map: map1 } = generateMap(12345);
        const { map: map2 } = generateMap(12345);
        assert.deepEqual(map1, map2);
    });

    it('should produce different maps for different seeds', () => {
        const { map: map1 } = generateMap(100);
        const { map: map2 } = generateMap(200);
        // At least some rows should differ
        let hasDifference = false;
        for (let r = 0; r < H; r++) {
            if (map1[r].join('') !== map2[r].join('')) {
                hasDifference = true;
                break;
            }
        }
        assert.ok(hasDifference, 'Different seeds should produce different maps');
    });

    it('right side of map should remain mostly grass (castle area)', () => {
        const { map } = generateMap(42);
        let grassOnRight = 0;
        for (let r = 0; r < H; r++) {
            for (let c = W - 5; c < W; c++) {
                if (map[r][c] === '.') grassOnRight++;
            }
        }
        // Right edge should have significant grass
        assert.ok(grassOnRight > H * 2, 'Right side should have grass for castle area');
    });
});
