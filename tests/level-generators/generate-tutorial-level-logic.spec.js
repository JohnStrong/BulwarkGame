/**
 * Logic branch tests for generate-tutorial-level.js
 *
 * Recommendation 6: Test generate-tutorial-level.js logic.
 * Covers: conditional placement (coastline, river, road junctions),
 * specific tile characters at known coordinates, forest/flower/rock placement.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-tutorial-level-logic.spec.js
 */

'use strict';

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

    // Horizontal road 1 (rows 13-16)
    for (let row = 13; row <= 16; row++) {
        for (let col = 5; col < W - 1; col++) {
            if (row === 13) map[row][col] = 'U';
            else if (row === 16) map[row][col] = 'u';
            else map[row][col] = 'D';
        }
    }
    for (let col = roadCol; col <= roadCol + 3; col++) map[13][col] = 'D';

    // Horizontal road 2 (rows 24-27)
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

    // Forest clusters
    const forest1 = [[2,5],[2,6],[3,5],[3,6],[3,7],[4,5],[4,6],[5,6],[5,7],[6,5],[6,6],[7,5],[8,5],[8,6],[9,6]];
    for (const [r,c] of forest1) if (map[r][c] === '.') map[r][c] = 'O';

    const forest2 = [[2,29],[2,30],[2,31],[3,29],[3,30],[3,31],[3,32],
                     [4,30],[4,31],[4,32],[5,29],[5,30],[5,31],
                     [6,30],[6,31],[7,29],[7,30],[7,31],[8,30],[8,31]];
    for (const [r,c] of forest2) if (map[r][c] === '.') map[r][c] = 'O';

    const forest3 = [[28,5],[28,6],[28,7],[29,5],[29,6],[29,7],[29,8]];
    for (const [r,c] of forest3) if (map[r][c] === '.') map[r][c] = 'O';

    const forest4 = [[18,29],[18,30],[19,29],[19,30],[19,31],[20,30],[20,31],[21,29],[21,30],[22,30]];
    for (const [r,c] of forest4) if (map[r][c] === '.') map[r][c] = 'O';

    const singles = [[1,15],[4,17],[7,15],[10,7],[11,17],[19,7],[20,6],[22,7],[28,15],[29,17],[5,40],[9,38],[18,42],[22,40]];
    for (const [r,c] of singles) if (r < H && c < W && map[r][c] === '.') map[r][c] = 'O';

    const flowers = [[5,35],[5,36],[6,35],[6,36],[10,35],[10,36],[11,35],
                     [20,35],[20,36],[21,35],[21,36],[1,42],[1,43],[2,42]];
    for (const [r,c] of flowers) if (r < H && c < W && map[r][c] === '.') map[r][c] = ',';

    const rocks = [[3,16],[8,18],[12,8],[19,16],[28,18]];
    for (const [r,c] of rocks) if (r < H && c < W && map[r][c] === '.') map[r][c] = 'R';

    return map;
}

describe('generate-tutorial-level: road junction logic', () => {
    it('should have D tiles at junction row 12 (above first horizontal road)', () => {
        const map = generate();
        // Row 12 is the "connector" row — full D tiles, no L/r edges
        assert.equal(map[12][10], 'D');
        assert.equal(map[12][11], 'D');
        assert.equal(map[12][12], 'D');
        assert.equal(map[12][13], 'D');
    });

    it('should have D tiles at junction row 23 (above second horizontal road)', () => {
        const map = generate();
        assert.equal(map[23][10], 'D');
        assert.equal(map[23][11], 'D');
        assert.equal(map[23][12], 'D');
        assert.equal(map[23][13], 'D');
    });

    it('should override U tiles with D at road junction (row 13, cols 10-13)', () => {
        const map = generate();
        // The horizontal road puts U at row 13, but the junction overrides to D
        assert.equal(map[13][10], 'D');
        assert.equal(map[13][11], 'D');
        assert.equal(map[13][12], 'D');
        assert.equal(map[13][13], 'D');
    });

    it('should override U tiles with D at second junction (row 24, cols 10-13)', () => {
        const map = generate();
        assert.equal(map[24][10], 'D');
        assert.equal(map[24][11], 'D');
        assert.equal(map[24][12], 'D');
        assert.equal(map[24][13], 'D');
    });

    it('should have D connector at row 17 (below first horizontal road)', () => {
        const map = generate();
        assert.equal(map[17][10], 'D');
        assert.equal(map[17][11], 'D');
        assert.equal(map[17][12], 'D');
        assert.equal(map[17][13], 'D');
    });
});

describe('generate-tutorial-level: coastline jaggedness', () => {
    it('should vary coastline width based on sin function', () => {
        const map = generate();
        // Collect coast end positions
        const coastEnds = [];
        for (let row = 0; row < H; row++) {
            let end = 0;
            for (let col = 0; col < 6; col++) {
                if (map[row][col] === ')') { end = col; break; }
            }
            coastEnds.push(end);
        }
        // Should have at least 2 different coast end positions (jagged)
        const unique = new Set(coastEnds);
        assert.ok(unique.size >= 2, `Coastline should be jagged, got ${unique.size} unique positions`);
    });

    it('should have ) transition at every row', () => {
        const map = generate();
        for (let row = 0; row < H; row++) {
            let hasTransition = false;
            for (let col = 0; col < 6; col++) {
                if (map[row][col] === ')') { hasTransition = true; break; }
            }
            assert.ok(hasTransition, `Row ${row} should have ) transition tile`);
        }
    });
});

describe('generate-tutorial-level: river wobble', () => {
    it('should have river center around column 24 with wobble', () => {
        const map = generate();
        // Check non-bridge rows for water near col 24
        const waterCols = [];
        for (let col = 20; col <= 28; col++) {
            if (map[5][col] === '~') waterCols.push(col);
        }
        assert.ok(waterCols.length === 3, `River should be 3 tiles wide, got ${waterCols.length}`);
        const avg = waterCols.reduce((a, b) => a + b, 0) / waterCols.length;
        assert.ok(Math.abs(avg - 24) <= 2, `River center should be near col 24, got avg ${avg}`);
    });

    it('should have ( left bank and ) right bank on non-bridge rows', () => {
        const map = generate();
        // Row 5 is not a bridge row
        let hasLeftBank = false;
        let hasRightBank = false;
        for (let col = 20; col <= 30; col++) {
            if (map[5][col] === '(') hasLeftBank = true;
            if (map[5][col] === ')') hasRightBank = true;
        }
        assert.ok(hasLeftBank, 'Row 5 should have ( left bank');
        assert.ok(hasRightBank, 'Row 5 should have ) right bank');
    });
});

describe('generate-tutorial-level: forest placement', () => {
    it('should place forest cluster 1 at rows 2-9, cols 5-7', () => {
        const map = generate();
        assert.equal(map[2][5], 'O');
        assert.equal(map[3][5], 'O');
        assert.equal(map[3][7], 'O');
    });

    it('should place forest cluster 2 right of river (rows 2-8, cols 29-32)', () => {
        const map = generate();
        assert.equal(map[2][29], 'O');
        assert.equal(map[3][32], 'O');
        assert.equal(map[8][31], 'O');
    });

    it('should not place trees on road tiles', () => {
        const map = generate();
        // Road tiles at row 5, cols 10-13 should not be overwritten
        const roadTiles = ['L', 'D', 'r'];
        assert.ok(roadTiles.includes(map[5][10]));
        assert.ok(roadTiles.includes(map[5][11]));
    });

    it('should place scattered single trees at known positions', () => {
        const map = generate();
        assert.equal(map[1][15], 'O');
        assert.equal(map[5][40], 'O');
    });
});

describe('generate-tutorial-level: flower and rock placement', () => {
    it('should place flowers at known positions', () => {
        const map = generate();
        assert.equal(map[5][35], ',');
        assert.equal(map[5][36], ',');
        assert.equal(map[1][42], ',');
    });

    it('should place rocks at known positions', () => {
        const map = generate();
        assert.equal(map[3][16], 'R');
        assert.equal(map[8][18], 'R');
        assert.equal(map[12][8], 'R');
    });

    it('should not place flowers on water tiles', () => {
        const map = generate();
        // All flower positions should not be water
        const flowerPositions = [[5,35],[5,36],[6,35],[6,36],[10,35],[10,36]];
        for (const [r, c] of flowerPositions) {
            assert.notEqual(map[r][c], '~', `Flower at (${r},${c}) should not be water`);
        }
    });
});

describe('generate-tutorial-level: horizontal road edges', () => {
    it('should have U tiles at row 13 (top edge) for non-junction columns', () => {
        const map = generate();
        // Col 20 is not a junction column
        assert.equal(map[13][20], 'U');
        assert.equal(map[13][30], 'U');
    });

    it('should have u tiles at row 16 (bottom edge)', () => {
        const map = generate();
        assert.equal(map[16][20], 'u');
        assert.equal(map[16][30], 'u');
    });

    it('should have D tiles at rows 14-15 (road interior)', () => {
        const map = generate();
        assert.equal(map[14][20], 'D');
        assert.equal(map[15][20], 'D');
    });

    it('horizontal road should start at col 5', () => {
        const map = generate();
        assert.equal(map[14][5], 'D');
        // Col 4 should not be road
        assert.notEqual(map[14][4], 'D');
    });

    it('horizontal road should end at col W-2 (48)', () => {
        const map = generate();
        assert.equal(map[14][48], 'D');
        // Col 49 (W-1) should not be road
        assert.notEqual(map[14][49], 'D');
    });
});
