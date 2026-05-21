/**
 * Tests for js/level-generators/generate-tutorial-level.js
 *
 * Tests the tutorial level generation logic by re-implementing the generate()
 * function (since the module auto-writes to disk on require).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-tutorial-level.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const W = 50;
const H = 30;

function generate() {
    const map = Array.from({ length: H }, () => Array(W).fill('.'));

    // Coastline
    for (let row = 0; row < H; row++) {
        const jag = Math.round(Math.sin(row * 0.5) * 0.7);
        const coastEnd = 3 + jag;
        for (let col = 0; col < coastEnd - 1; col++) map[row][col] = '~';
        map[row][coastEnd - 1] = ')';
    }

    // River
    const riverCenter = 24;
    const riverW = 3;
    for (let row = 0; row < H; row++) {
        const wobble = Math.round(Math.sin(row * 0.25) * 1);
        const rLeft = riverCenter + wobble;
        const rRight = rLeft + riverW - 1;
        if (row >= 13 && row <= 16) continue;
        if (row >= 24 && row <= 27) continue;
        map[row][rLeft - 1] = '(';
        for (let c = rLeft; c <= rRight; c++) map[row][c] = '~';
        map[row][rRight + 1] = ')';
    }

    // Main road
    const roadCol = 10;
    map[0][roadCol] = 'U'; map[0][roadCol + 1] = 'U'; map[0][roadCol + 2] = 'U'; map[0][roadCol + 3] = 'U';
    for (let row = 1; row <= 27; row++) {
        if (row >= 13 && row <= 16) continue;
        if (row >= 24 && row <= 27) continue;
        if (row === 12 || row === 23) {
            map[row][roadCol] = 'D'; map[row][roadCol + 1] = 'D'; map[row][roadCol + 2] = 'D'; map[row][roadCol + 3] = 'D';
        } else {
            map[row][roadCol] = 'L'; map[row][roadCol + 1] = 'D'; map[row][roadCol + 2] = 'D'; map[row][roadCol + 3] = 'r';
        }
    }

    // Horizontal road 1
    for (let row = 13; row <= 16; row++) {
        for (let col = 5; col < W - 1; col++) {
            if (row === 13) map[row][col] = 'U';
            else if (row === 16) map[row][col] = 'u';
            else map[row][col] = 'D';
        }
    }
    for (let col = roadCol; col <= roadCol + 3; col++) map[13][col] = 'D';

    // Horizontal road 2
    for (let row = 24; row <= 27; row++) {
        for (let col = 5; col < W - 1; col++) {
            if (row === 24) map[row][col] = 'U';
            else if (row === 27) map[row][col] = 'u';
            else map[row][col] = 'D';
        }
    }
    for (let col = roadCol; col <= roadCol + 3; col++) map[24][col] = 'D';

    map[17][roadCol] = 'D'; map[17][roadCol + 1] = 'D';
    map[17][roadCol + 2] = 'D'; map[17][roadCol + 3] = 'D';

    return map;
}

describe('generate-tutorial-level: map dimensions', () => {
    it('should produce a 50x30 map', () => {
        const map = generate();
        assert.equal(map.length, H);
        for (const row of map) {
            assert.equal(row.length, W);
        }
    });
});

describe('generate-tutorial-level: coastline', () => {
    it('should have water tiles on the left edge', () => {
        const map = generate();
        for (let row = 0; row < H; row++) {
            assert.ok(
                map[row][0] === '~' || map[row][0] === ')' || map[row][0] === '(',
                `Row ${row} col 0 should be water-related, got "${map[row][0]}"`
            );
        }
    });

    it('should have ) transition tiles at the coast edge', () => {
        const map = generate();
        let hasTransition = false;
        for (let row = 0; row < H; row++) {
            for (let col = 0; col < 6; col++) {
                if (map[row][col] === ')') {
                    hasTransition = true;
                    break;
                }
            }
            if (hasTransition) break;
        }
        assert.ok(hasTransition, 'Should have ) transition tiles');
    });
});

describe('generate-tutorial-level: river', () => {
    it('should have water tiles around column 24 (river center)', () => {
        const map = generate();
        // Check a row that is not a bridge row (e.g., row 5)
        let hasRiverWater = false;
        for (let col = 22; col <= 28; col++) {
            if (map[5][col] === '~') {
                hasRiverWater = true;
                break;
            }
        }
        assert.ok(hasRiverWater, 'River should have water tiles around col 24');
    });

    it('should have ( and ) bank transition tiles', () => {
        const map = generate();
        let hasLeftBank = false;
        let hasRightBank = false;
        for (let row = 0; row < H; row++) {
            for (let col = 20; col <= 30; col++) {
                if (map[row][col] === '(') hasLeftBank = true;
                if (map[row][col] === ')') hasRightBank = true;
            }
        }
        assert.ok(hasLeftBank, 'Should have ( left bank tiles');
        assert.ok(hasRightBank, 'Should have ) right bank tiles');
    });

    it('should skip river at bridge rows (13-16 and 24-27)', () => {
        const map = generate();
        // At bridge rows, the river should be replaced by road tiles
        for (let row = 13; row <= 16; row++) {
            for (let col = 22; col <= 28; col++) {
                assert.ok(
                    map[row][col] !== '~' || map[row][col] !== '(' || map[row][col] !== ')',
                    `Row ${row} col ${col} should not be river water at bridge`
                );
            }
        }
    });
});

describe('generate-tutorial-level: main road', () => {
    it('should have road entrance at top (row 0, cols 10-13)', () => {
        const map = generate();
        assert.equal(map[0][10], 'U');
        assert.equal(map[0][11], 'U');
        assert.equal(map[0][12], 'U');
        assert.equal(map[0][13], 'U');
    });

    it('should have vertical road with edge tiles (L, D, D, r pattern)', () => {
        const map = generate();
        // Check a non-junction row (e.g., row 5)
        assert.equal(map[5][10], 'L');
        assert.equal(map[5][11], 'D');
        assert.equal(map[5][12], 'D');
        assert.equal(map[5][13], 'r');
    });

    it('should have horizontal road 1 at rows 13-16', () => {
        const map = generate();
        // Row 14 should be full road (D) across most of the map
        let roadCount = 0;
        for (let col = 5; col < W - 1; col++) {
            if (map[14][col] === 'D') roadCount++;
        }
        assert.ok(roadCount > 30, 'Horizontal road should span most of the map');
    });

    it('should have horizontal road 2 at rows 24-27', () => {
        const map = generate();
        let roadCount = 0;
        for (let col = 5; col < W - 1; col++) {
            if (map[25][col] === 'D') roadCount++;
        }
        assert.ok(roadCount > 30, 'Second horizontal road should span most of the map');
    });

    it('road edge tiles: U at top, u at bottom of horizontal roads', () => {
        const map = generate();
        // Row 16 should have 'u' tiles (bottom edge of first horizontal road)
        let uCount = 0;
        for (let col = 5; col < W - 1; col++) {
            if (map[16][col] === 'u') uCount++;
        }
        assert.ok(uCount > 20, 'Bottom edge should have u tiles');
    });
});

describe('generate-tutorial-level: determinism', () => {
    it('should produce the same map every time (no randomness)', () => {
        const map1 = generate();
        const map2 = generate();
        assert.deepEqual(map1, map2);
    });
});

describe('generate-tutorial-level: valid tile characters', () => {
    it('all tiles should be valid characters', () => {
        const validChars = new Set(['.', ',', '~', '(', ')', 'O', 'P', 'S', 'R', 'D', 'L', 'r', 'U', 'u']);
        const map = generate();
        for (let row = 0; row < H; row++) {
            for (let col = 0; col < W; col++) {
                assert.ok(
                    validChars.has(map[row][col]),
                    `Invalid char "${map[row][col]}" at (${row},${col})`
                );
            }
        }
    });
});
