/**
 * Tests for js/game-logic/lib/ai/pathfinding-engine.js
 *
 * Task 1.1 — unit tests for resolveTileChar, getMovementCost, constants.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/ai/pathfinding-engine.test.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fc = require('fast-check');

const PathfindingEngine = require('../../../../js/game-logic/lib/ai/pathfinding-engine.js');
const {
    MOVEMENT_COST,
    TREE_CHARS,
    TREE_ELIGIBLE,
    resolveTileChar,
    getMovementCost,
} = PathfindingEngine;

// ---------------------------------------------------------------------------
// MOVEMENT_COST constant
// ---------------------------------------------------------------------------

describe('MOVEMENT_COST constant', () => {
    it('grass (.) costs 1', () => assert.equal(MOVEMENT_COST['.'], 1));
    it('flowers (,) costs 1', () => assert.equal(MOVEMENT_COST[','], 1));
    it('road (D) costs 1', () => assert.equal(MOVEMENT_COST['D'], 1));
    it('cobblestone bridge (=) costs 1', () => assert.equal(MOVEMENT_COST['='], 1));
    it('bailey (C) costs 1', () => assert.equal(MOVEMENT_COST['C'], 1));
    it('castle bridge start (b) costs 1', () => assert.equal(MOVEMENT_COST['b'], 1));
    it('castle bridge mid (m) costs 1', () => assert.equal(MOVEMENT_COST['m'], 1));
    it('castle bridge gate (g) costs 1', () => assert.equal(MOVEMENT_COST['g'], 1));
    it('water (~) costs 2', () => assert.equal(MOVEMENT_COST['~'], 2));
    it('wall (W) is Infinity', () => assert.equal(MOVEMENT_COST['W'], Infinity));
    it('tower (T) is Infinity', () => assert.equal(MOVEMENT_COST['T'], Infinity));
    it('gatehouse (G) is Infinity', () => assert.equal(MOVEMENT_COST['G'], Infinity));
    it('keep top-left (K) is Infinity', () => assert.equal(MOVEMENT_COST['K'], Infinity));
    it('keep bottom-left (j) is Infinity', () => assert.equal(MOVEMENT_COST['j'], Infinity));
    it('keep bottom-right (J) is Infinity', () => assert.equal(MOVEMENT_COST['J'], Infinity));
    it('keep centre (F) is Infinity', () => assert.equal(MOVEMENT_COST['F'], Infinity));
    it('rock (R) is Infinity', () => assert.equal(MOVEMENT_COST['R'], Infinity));
});

// ---------------------------------------------------------------------------
// TREE_CHARS and TREE_ELIGIBLE sets
// ---------------------------------------------------------------------------

describe('TREE_CHARS set', () => {
    it('contains O (oak)', () => assert.equal(TREE_CHARS.has('O'), true));
    it('contains P (pine)', () => assert.equal(TREE_CHARS.has('P'), true));
    it('contains S (shrub)', () => assert.equal(TREE_CHARS.has('S'), true));
    it('does not contain grass (.)', () => assert.equal(TREE_CHARS.has('.'), false));
    it('does not contain water (~)', () => assert.equal(TREE_CHARS.has('~'), false));
});

describe('TREE_ELIGIBLE set', () => {
    it('contains Archer', () => assert.equal(TREE_ELIGIBLE.has('Archer'), true));
    it('contains Cavalry', () => assert.equal(TREE_ELIGIBLE.has('Cavalry'), true));
    it('does not contain Infantry', () => assert.equal(TREE_ELIGIBLE.has('Infantry'), false));
    it('does not contain SiegeEngine', () => assert.equal(TREE_ELIGIBLE.has('SiegeEngine'), false));
});

// ---------------------------------------------------------------------------
// resolveTileChar
// ---------------------------------------------------------------------------

describe('resolveTileChar — overlay takes precedence', () => {
    it('oak overlay → O', () => {
        assert.equal(resolveTileChar({ sprite: 'grass-short-1', overlay: 'tree-oak-overlay-1' }), 'O');
    });
    it('oak overlay variant 2 → O', () => {
        assert.equal(resolveTileChar({ sprite: 'grass-short-2', overlay: 'tree-oak-overlay-2' }), 'O');
    });
    it('pine overlay → P', () => {
        assert.equal(resolveTileChar({ sprite: 'grass-short-1', overlay: 'tree-pine-overlay-1' }), 'P');
    });
    it('pine overlay variant 2 → P', () => {
        assert.equal(resolveTileChar({ sprite: 'grass-short-1', overlay: 'tree-pine-overlay-2' }), 'P');
    });
    it('shrub overlay → S', () => {
        assert.equal(resolveTileChar({ sprite: 'grass-short-1', overlay: 'tree-shrub-overlay-1' }), 'S');
    });
    it('shrub overlay variant 2 → S', () => {
        assert.equal(resolveTileChar({ sprite: 'grass-short-1', overlay: 'tree-shrub-overlay-2' }), 'S');
    });
    it('overlay is checked before sprite — grass sprite with oak overlay → O (not .)', () => {
        const tile = { sprite: 'grass-short-2', overlay: 'tree-oak-overlay-3' };
        assert.equal(resolveTileChar(tile), 'O');
    });
});

describe('resolveTileChar — sprite fallback', () => {
    it('grass-short-1 → .', () => assert.equal(resolveTileChar({ sprite: 'grass-short-1' }), '.'));
    it('grass-short-2 → .', () => assert.equal(resolveTileChar({ sprite: 'grass-short-2' }), '.'));
    it('grass-flowers-1 → ,', () => assert.equal(resolveTileChar({ sprite: 'grass-flowers-1' }), ','));
    it('grass-flowers-2 → ,', () => assert.equal(resolveTileChar({ sprite: 'grass-flowers-2' }), ','));
    it('road-full → D', () => assert.equal(resolveTileChar({ sprite: 'road-full' }), 'D'));
    it('water-1 → ~', () => assert.equal(resolveTileChar({ sprite: 'water-1' }), '~'));
    it('water-2 → ~', () => assert.equal(resolveTileChar({ sprite: 'water-2' }), '~'));
    it('water-3 → ~', () => assert.equal(resolveTileChar({ sprite: 'water-3' }), '~'));
    it('bridge-mm → =', () => assert.equal(resolveTileChar({ sprite: 'bridge-mm' }), '='));
    // LevelLoader maps b, m, g all to 'castle-bridge-mid'
    it('castle-bridge-mid → m (represents all castle bridge tiles)', () => {
        assert.equal(resolveTileChar({ sprite: 'castle-bridge-mid' }), 'm');
    });
    it('castle-tower → T', () => assert.equal(resolveTileChar({ sprite: 'castle-tower' }), 'T'));
    it('castle-keep-tl → K', () => assert.equal(resolveTileChar({ sprite: 'castle-keep-tl' }), 'K'));
    it('castle-keep-bl → j', () => assert.equal(resolveTileChar({ sprite: 'castle-keep-bl' }), 'j'));
    it('castle-keep-br → J', () => assert.equal(resolveTileChar({ sprite: 'castle-keep-br' }), 'J'));
    it('castle-keep-center → F', () => assert.equal(resolveTileChar({ sprite: 'castle-keep-center' }), 'F'));
    it('castle-gatehouse → G', () => assert.equal(resolveTileChar({ sprite: 'castle-gatehouse' }), 'G'));
    it('castle-gatehouse-damaged → G (prefix match)', () => {
        assert.equal(resolveTileChar({ sprite: 'castle-gatehouse-damaged' }), 'G');
    });
    it('castle-wall → W', () => assert.equal(resolveTileChar({ sprite: 'castle-wall' }), 'W'));
    it('castle-wall-damaged → W (prefix match)', () => {
        assert.equal(resolveTileChar({ sprite: 'castle-wall-damaged' }), 'W');
    });
    it('castle-bailey-1 → C', () => assert.equal(resolveTileChar({ sprite: 'castle-bailey-1' }), 'C'));
    it('castle-bailey-3 → C', () => assert.equal(resolveTileChar({ sprite: 'castle-bailey-3' }), 'C'));
    it('rock → R', () => assert.equal(resolveTileChar({ sprite: 'rock' }), 'R'));
});

describe('resolveTileChar — edge cases', () => {
    it('null tile → . (safe fallback)', () => {
        assert.equal(resolveTileChar(null), '.');
    });
    it('undefined tile → . (safe fallback)', () => {
        assert.equal(resolveTileChar(undefined), '.');
    });
    it('tile with no sprite → . (safe fallback)', () => {
        assert.equal(resolveTileChar({}), '.');
    });
    it('unknown sprite → . (safe fallback)', () => {
        assert.equal(resolveTileChar({ sprite: 'totally-unknown-sprite' }), '.');
    });
    it('empty overlay string does not override sprite', () => {
        // An empty overlay should be falsy and ignored
        assert.equal(resolveTileChar({ sprite: 'rock', overlay: '' }), 'R');
    });
});

// ---------------------------------------------------------------------------
// getMovementCost
// ---------------------------------------------------------------------------

describe('getMovementCost — passable terrain (cost 1)', () => {
    const cost1Chars = ['.', ',', 'D', '=', 'C', 'b', 'm', 'g'];
    for (const ch of cost1Chars) {
        it(`'${ch}' costs 1 for Infantry`, () => {
            assert.equal(getMovementCost(ch, 'Infantry'), 1);
        });
        it(`'${ch}' costs 1 for Cavalry`, () => {
            assert.equal(getMovementCost(ch, 'Cavalry'), 1);
        });
    }
});

describe('getMovementCost — water (~) costs 2 for all unit types', () => {
    for (const unitType of ['Infantry', 'Archer', 'Cavalry', 'SiegeEngine']) {
        it(`'~' costs 2 for ${unitType}`, () => {
            assert.equal(getMovementCost('~', unitType), 2);
        });
    }
});

describe('getMovementCost — impassable terrain (Infinity) for all unit types', () => {
    const infChars = ['W', 'T', 'G', 'K', 'j', 'J', 'F', 'R'];
    for (const ch of infChars) {
        for (const unitType of ['Infantry', 'Archer', 'Cavalry', 'SiegeEngine']) {
            it(`'${ch}' is Infinity for ${unitType}`, () => {
                assert.equal(getMovementCost(ch, unitType), Infinity);
            });
        }
    }
});

describe('getMovementCost — tree tiles depend on unit type', () => {
    const treeChars = ['O', 'P', 'S'];
    const eligible = ['Archer', 'Cavalry'];
    const notEligible = ['Infantry', 'SiegeEngine'];

    for (const ch of treeChars) {
        for (const unitType of eligible) {
            it(`'${ch}' costs 1 for tree-eligible unit ${unitType}`, () => {
                assert.equal(getMovementCost(ch, unitType), 1);
            });
        }
        for (const unitType of notEligible) {
            it(`'${ch}' is Infinity for non-tree-eligible unit ${unitType}`, () => {
                assert.equal(getMovementCost(ch, unitType), Infinity);
            });
        }
    }
});

describe('getMovementCost — unknown tile character defaults to Infinity', () => {
    it('unknown char returns Infinity for Infantry', () => {
        assert.equal(getMovementCost('?', 'Infantry'), Infinity);
    });
    it('unknown char returns Infinity for Archer', () => {
        assert.equal(getMovementCost('Z', 'Archer'), Infinity);
    });
});

describe('getMovementCost — cost ordering invariant', () => {
    it('passable terrain (1) < water (2) for all unit types', () => {
        for (const unitType of ['Infantry', 'Archer', 'Cavalry', 'SiegeEngine']) {
            assert.ok(getMovementCost('.', unitType) < getMovementCost('~', unitType));
        }
    });
    it('water (2) < combat cost (3) — external overlay value', () => {
        // The combat cost (3) is applied via overlay, but water (2) base cost is < 3
        assert.ok(getMovementCost('~', 'Infantry') < 3);
    });
    it('impassable (Infinity) is greater than water (2)', () => {
        assert.ok(getMovementCost('W', 'Infantry') > getMovementCost('~', 'Infantry'));
    });
});

// ---------------------------------------------------------------------------
// Task 2.1 — hexNeighbors and hexDistance unit + property tests
// ---------------------------------------------------------------------------

const {
    hexNeighbors,
    hexDistance,
} = PathfindingEngine;

// ---------------------------------------------------------------------------
// Unit tests — hexNeighbors
// ---------------------------------------------------------------------------

describe('hexNeighbors', () => {
    it('always returns exactly 6 neighbors', () => {
        assert.equal(hexNeighbors(0, 0).length, 6);
        assert.equal(hexNeighbors(1, 0).length, 6);
        assert.equal(hexNeighbors(2, 5).length, 6);
        assert.equal(hexNeighbors(3, 5).length, 6);
    });

    it('even row (0): neighbors match expected offsets', () => {
        const n = hexNeighbors(0, 5);
        assert.deepEqual(n, [
            { row: -1, col: 4 }, // NW
            { row: -1, col: 5 }, // NE
            { row:  0, col: 6 }, // E
            { row:  1, col: 5 }, // SE
            { row:  1, col: 4 }, // SW
            { row:  0, col: 4 }, // W
        ]);
    });

    it('odd row (1): neighbors match expected offsets', () => {
        const n = hexNeighbors(1, 5);
        assert.deepEqual(n, [
            { row:  0, col: 5 }, // NW
            { row:  0, col: 6 }, // NE
            { row:  1, col: 6 }, // E
            { row:  2, col: 6 }, // SE
            { row:  2, col: 5 }, // SW
            { row:  1, col: 4 }, // W
        ]);
    });

    it('even row NW and SW are at col-1; NE and SE are at col', () => {
        const n = hexNeighbors(2, 3);
        assert.equal(n[0].col, 2); // NW
        assert.equal(n[1].col, 3); // NE
        assert.equal(n[4].col, 2); // SW
        assert.equal(n[3].col, 3); // SE
    });

    it('odd row NW and SW are at col; NE and SE are at col+1', () => {
        const n = hexNeighbors(3, 3);
        assert.equal(n[0].col, 3); // NW
        assert.equal(n[1].col, 4); // NE
        assert.equal(n[4].col, 3); // SW
        assert.equal(n[3].col, 4); // SE
    });

    it('neighbors contain all 3 distinct row levels: row-1, row, row+1', () => {
        for (const row of [0, 1, 4, 5, 10, 11]) {
            const rows = hexNeighbors(row, 5).map(nb => nb.row);
            assert.ok(rows.includes(row - 1), `row-1 missing for row=${row}`);
            assert.ok(rows.includes(row),     `same row missing for row=${row}`);
            assert.ok(rows.includes(row + 1), `row+1 missing for row=${row}`);
        }
    });

    it('the two same-row neighbors are always at col-1 and col+1', () => {
        for (const row of [0, 1, 2, 3]) {
            const sameRow = hexNeighbors(row, 10).filter(nb => nb.row === 10);
            assert.equal(sameRow.length, 0); // no same-row neighbours with row=10's row
            // Re-check with row param matching
            const sameRow2 = hexNeighbors(row, 10).filter(nb => nb.row === row);
            assert.equal(sameRow2.length, 2);
            const cols = sameRow2.map(nb => nb.col).sort((a, b) => a - b);
            assert.deepEqual(cols, [9, 11]);
        }
    });
});

// ---------------------------------------------------------------------------
// Unit tests — hexDistance
// ---------------------------------------------------------------------------

describe('hexDistance', () => {
    it('distance from a tile to itself is 0', () => {
        assert.equal(hexDistance(0, 0, 0, 0), 0);
        assert.equal(hexDistance(5, 3, 5, 3), 0);
        assert.equal(hexDistance(1, 7, 1, 7), 0);
    });

    it('distance to E neighbor (same row, col+1) is 1', () => {
        assert.equal(hexDistance(0, 0, 0, 1), 1);
        assert.equal(hexDistance(1, 5, 1, 6), 1);
    });

    it('distance to W neighbor (same row, col-1) is 1', () => {
        assert.equal(hexDistance(0, 5, 0, 4), 1);
        assert.equal(hexDistance(1, 5, 1, 4), 1);
    });

    it('distance to each of the 6 neighbors of an even row cell is exactly 1', () => {
        const row = 0;
        const col = 10;
        for (const nb of hexNeighbors(row, col)) {
            const d = hexDistance(row, col, nb.row, nb.col);
            assert.equal(d, 1,
                `expected distance 1 to neighbor (${nb.row},${nb.col}) from (${row},${col}), got ${d}`);
        }
    });

    it('distance to each of the 6 neighbors of an odd row cell is exactly 1', () => {
        const row = 1;
        const col = 10;
        for (const nb of hexNeighbors(row, col)) {
            const d = hexDistance(row, col, nb.row, nb.col);
            assert.equal(d, 1,
                `expected distance 1 to neighbor (${nb.row},${nb.col}) from (${row},${col}), got ${d}`);
        }
    });

    it('distance is symmetric', () => {
        assert.equal(hexDistance(0, 0, 2, 3), hexDistance(2, 3, 0, 0));
        assert.equal(hexDistance(1, 5, 4, 2), hexDistance(4, 2, 1, 5));
    });

    it('two-step path: (0,0) to (2,1) = 2', () => {
        // From (0,0): SE→(1,0), SE→(2,0) or SE→(1,0), E→(1,1) — actual cube distance
        assert.equal(hexDistance(0, 0, 2, 1), 2);
    });
});

// ---------------------------------------------------------------------------
// Property 3: hexNeighbors always returns exactly 6 unique neighbors
// ---------------------------------------------------------------------------

describe('Property 3: hexNeighbors neighbor count is always exactly 6', () => {
    it('for all (row, col) in [0,32]×[0,39], exactly 6 neighbors returned', () => {
        /**
         * Validates: Requirements 2.2
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (row, col) => {
                    const neighbors = hexNeighbors(row, col);
                    return neighbors.length === 6;
                }
            ),
            { numRuns: 1000 }
        );
    });

    it('all 6 neighbors have unique (row,col) coordinates', () => {
        /**
         * Validates: Requirements 2.2
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (row, col) => {
                    const neighbors = hexNeighbors(row, col);
                    const keys = new Set(neighbors.map(n => `${n.row},${n.col}`));
                    return keys.size === 6;
                }
            ),
            { numRuns: 1000 }
        );
    });
});

// ---------------------------------------------------------------------------
// Property 4: hexDistance is admissible (never overestimates)
// ---------------------------------------------------------------------------

describe('Property 4: hexDistance is admissible — neighbor distance is always 1', () => {
    it('for all (row, col) in [0,32]×[0,39], each neighbor has hexDistance of exactly 1', () => {
        /**
         * Validates: Requirements 2.4
         * Admissibility requires dist(a, neighbor) = 1 when min step cost = 1.
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (row, col) => {
                    const neighbors = hexNeighbors(row, col);
                    for (const nb of neighbors) {
                        if (hexDistance(row, col, nb.row, nb.col) !== 1) return false;
                    }
                    return true;
                }
            ),
            { numRuns: 1000 }
        );
    });

    it('hexDistance is non-negative for all tile pairs', () => {
        /**
         * Validates: Requirements 2.4
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (r1, c1, r2, c2) => hexDistance(r1, c1, r2, c2) >= 0
            ),
            { numRuns: 2000 }
        );
    });

    it('hexDistance is symmetric for all tile pairs', () => {
        /**
         * Validates: Requirements 2.4
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (r1, c1, r2, c2) =>
                    hexDistance(r1, c1, r2, c2) === hexDistance(r2, c2, r1, c1)
            ),
            { numRuns: 2000 }
        );
    });

    it('hexDistance(a, a) = 0 for all tiles', () => {
        /**
         * Validates: Requirements 2.4
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (row, col) => hexDistance(row, col, row, col) === 0
            ),
            { numRuns: 1000 }
        );
    });

    it('hexDistance satisfies the triangle inequality', () => {
        /**
         * Validates: Requirements 2.4
         * Triangle inequality: dist(a,c) ≤ dist(a,b) + dist(b,c)
         */
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                fc.integer({ min: 0, max: 32 }),
                fc.integer({ min: 0, max: 39 }),
                (r1, c1, r2, c2, r3, c3) => {
                    const dac = hexDistance(r1, c1, r3, c3);
                    const dab = hexDistance(r1, c1, r2, c2);
                    const dbc = hexDistance(r2, c2, r3, c3);
                    return dac <= dab + dbc;
                }
            ),
            { numRuns: 2000 }
        );
    });
});
