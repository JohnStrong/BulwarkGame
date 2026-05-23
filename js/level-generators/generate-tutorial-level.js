/**
 * Generate Tutorial Level (Level 1)
 *
 * Features:
 *   - Coastline on left
 *   - River through center with proper bank transitions ( and )
 *   - Road from top, turns right, crosses river (bridge), continues to right edge
 *   - Branch road below
 *   - Road corners where vertical meets horizontal
 *   - Dense forest clusters (for strategic cover)
 *   - Open grassland on right (castle area)
 *
 * Output: levels/level1.txt
 */

const fs = require('fs');
const path = require('path');

const W = 50;
const H = 30;

function generate() {
    const map = Array.from({ length: H }, () => Array(W).fill('.'));

    // === COASTLINE (left edge) ===
    for (let row = 0; row < H; row++) {
        const jag = Math.round(Math.sin(row * 0.5) * 0.7);
        const coastEnd = 3 + jag;
        for (let col = 0; col < coastEnd - 1; col++) map[row][col] = '~';
        map[row][coastEnd - 1] = ')'; // water-left, grass-right
    }

    // === RIVER (vertical, cols 24-26, with proper bank transitions) ===
    const riverCenter = 24;
    const riverW = 3;
    for (let row = 0; row < H; row++) {
        const wobble = Math.round(Math.sin(row * 0.25) * 1);
        const rLeft = riverCenter + wobble;
        const rRight = rLeft + riverW - 1;

        // Skip bridge rows (road crosses here)
        if (row >= 13 && row <= 16) continue;
        if (row >= 24 && row <= 27) continue;

        // Left bank: ( = grass-left, water-right
        map[row][rLeft - 1] = '(';
        // River water
        for (let c = rLeft; c <= rRight; c++) map[row][c] = '~';
        // Right bank: ) = water-left, grass-right
        map[row][rRight + 1] = ')';
    }

    // === MAIN ROAD: enters top at col 10, goes down to row 27 ===
    const roadCol = 10;

    // Entrance at top
    map[0][roadCol] = 'U'; map[0][roadCol+1] = 'U'; map[0][roadCol+2] = 'U'; map[0][roadCol+3] = 'U';

    // Vertical segment with edge tiles (rows 1-27, skip horizontal road rows)
    for (let row = 1; row <= 27; row++) {
        // Skip horizontal road rows entirely (they fill themselves)
        if (row >= 13 && row <= 16) continue;
        if (row >= 24 && row <= 27) continue;

        // On the row just ABOVE a horizontal road, use full road (no edges)
        // so it connects seamlessly into the U tiles below
        if (row === 12 || row === 23) {
            map[row][roadCol] = 'D';
            map[row][roadCol+1] = 'D';
            map[row][roadCol+2] = 'D';
            map[row][roadCol+3] = 'D';
        } else {
            map[row][roadCol] = 'L';
            map[row][roadCol+1] = 'D';
            map[row][roadCol+2] = 'D';
            map[row][roadCol+3] = 'r';
        }
    }

    // === HORIZONTAL ROAD 1 (rows 13-16, from col 5 to right edge) ===
    for (let row = 13; row <= 16; row++) {
        for (let col = 5; col < W - 1; col++) {
            if (row === 13) map[row][col] = 'U';
            else if (row === 16) map[row][col] = 'u';
            else map[row][col] = 'D';
        }
    }
    // Fill the junction: make sure cols 10-13 on row 13 are D not U
    // (the vertical road feeds directly into the horizontal)
    for (let col = roadCol; col <= roadCol + 3; col++) {
        map[13][col] = 'D';
    }

    // === HORIZONTAL ROAD 2 / BRANCH (rows 24-27, from col 5 to right edge) ===
    for (let row = 24; row <= 27; row++) {
        for (let col = 5; col < W - 1; col++) {
            if (row === 24) map[row][col] = 'U';
            else if (row === 27) map[row][col] = 'u';
            else map[row][col] = 'D';
        }
    }
    // Fill junction
    for (let col = roadCol; col <= roadCol + 3; col++) {
        map[24][col] = 'D';
    }

    // Also ensure row 17 (just below first horizontal) connects to vertical
    map[17][roadCol] = 'D'; map[17][roadCol+1] = 'D';
    map[17][roadCol+2] = 'D'; map[17][roadCol+3] = 'D';

    // === FOREST CLUSTERS ===
    // Forest 1: between coast and road (rows 2-10, cols 5-8)
    const forest1 = [[2,5],[2,6],[3,5],[3,6],[3,7],[4,5],[4,6],[5,6],[5,7],[6,5],[6,6],[7,5],[8,5],[8,6],[9,6]];
    for (const [r,c] of forest1) if (map[r][c] === '.') map[r][c] = 'O';

    // Forest 2: right of river (rows 2-8, cols 29-34)
    const forest2 = [[2,29],[2,30],[2,31],[3,29],[3,30],[3,31],[3,32],
                     [4,30],[4,31],[4,32],[5,29],[5,30],[5,31],
                     [6,30],[6,31],[7,29],[7,30],[7,31],[8,30],[8,31]];
    for (const [r,c] of forest2) if (map[r][c] === '.') map[r][c] = 'O';

    // Forest 3: below branch road, left side (rows 28-29, cols 5-8)
    const forest3 = [[28,5],[28,6],[28,7],[29,5],[29,6],[29,7],[29,8]];
    for (const [r,c] of forest3) if (map[r][c] === '.') map[r][c] = 'O';

    // Forest 4: between the two roads, right of river (rows 18-22, cols 29-32)
    const forest4 = [[18,29],[18,30],[19,29],[19,30],[19,31],[20,30],[20,31],[21,29],[21,30],[22,30]];
    for (const [r,c] of forest4) if (map[r][c] === '.') map[r][c] = 'O';

    // Scattered individual trees
    const singles = [[1,15],[4,17],[7,15],[10,7],[11,17],[19,7],[20,6],[22,7],[28,15],[29,17],[5,40],[9,38],[18,42],[22,40]];
    for (const [r,c] of singles) if (r < H && c < W && map[r][c] === '.') map[r][c] = 'O';

    // === FLOWER PATCHES ===
    const flowers = [[5,35],[5,36],[6,35],[6,36],[10,35],[10,36],[11,35],
                     [20,35],[20,36],[21,35],[21,36],[1,42],[1,43],[2,42]];
    for (const [r,c] of flowers) if (r < H && c < W && map[r][c] === '.') map[r][c] = ',';

    // === ROCKS ===
    const rocks = [[3,16],[8,18],[12,8],[19,16],[28,18]];
    for (const [r,c] of rocks) if (r < H && c < W && map[r][c] === '.') map[r][c] = 'R';

    // === OUTPUT ===
    const header = [
        '; Tutorial Level - The Crossing',
        '; Teaches: roads, river barrier, bridge chokepoint, forest cover',
        '; ( = grass|water border (left bank)  ) = water|grass border (right bank)',
        'name=Tutorial - The Crossing',
    ].join('\n');

    return header + '\n' + map.map(r => r.join('')).join('\n') + '\n';
}

// Export for testing
module.exports = { generate, W, H };

// Run if executed directly
if (require.main === module) {
    const output = generate();
    const outputPath = path.join(__dirname, '..', '..', 'levels', 'level1.txt');
    fs.writeFileSync(outputPath, output);
    console.log('Generated tutorial level: levels/level1.txt');
    console.log(`  Map size: ${W}x${H}`);
}
