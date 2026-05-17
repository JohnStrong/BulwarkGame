/**
 * Generate level1.txt - Medieval Castle with 2x2 tile grid
 *
 * All major sprites are 2x2 (64x64px). The map is 40x40 chars
 * representing a 20x20 logical grid of 2x2 blocks.
 *
 * Layout (castle in upper-left quadrant, offset from center):
 *   - Castle: rows 2-8, cols 3-11 (logical grid)
 *   - Moat: water ring around castle
 *   - Road: winding from castle gate (south) to bottom-right
 *   - Trees: clusters around edges
 *   - River: right edge
 *   - Meadow: open grass with flower patches
 *
 * Logical grid (20x20):
 *   Each cell = 2x2 chars in the output
 *
 * Tile codes (each occupies 2x2 chars):
 *   .. = grass          ,, = flowers
 *   Pp = large oak      ~~ = water
 *   Dd = road           CC = bailey
 *   Kk = keep(4x4=2x2 logical cells)
 *   Gg = portcullis     TT = tower
 *   WW = wall-h         || = wall-v
 *   LL = wall-gate-L    RR = wall-gate-R
 *   HH = hut            )) = water-land-right
 *   BB = battlement
 */

const fs = require('fs');
const path = require('path');

const GRID = 20; // logical grid size
const W = GRID * 2; // 40 chars
const H = GRID * 2; // 40 chars

// Initialize with grass
const grid = [];
for (let r = 0; r < GRID; r++) {
    grid.push(new Array(GRID).fill('..'));
}

function setCell(r, c, val) {
    if (r >= 0 && r < GRID && c >= 0 && c < GRID) grid[r][c] = val;
}

function fillCells(r1, c1, r2, c2, val) {
    for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++)
            setCell(r, c, val);
}

// === BORDER (top, bottom, left) ===
for (let c = 0; c < GRID; c++) { setCell(0, c, '##'); setCell(GRID-1, c, '##'); }
for (let r = 0; r < GRID; r++) { setCell(r, 0, '##'); }

// === RIVER (right edge, cols 18-19) ===
for (let r = 1; r < GRID - 1; r++) {
    setCell(r, GRID - 1, '~~');
    setCell(r, GRID - 2, '))');
}
// River corners
setCell(0, GRID - 1, '##');
setCell(0, GRID - 2, '##');
setCell(GRID-1, GRID - 1, '##');
setCell(GRID-1, GRID - 2, '>>');

// === MOAT (water around castle) ===
// Castle occupies logical rows 3-9, cols 4-12
// Moat is one cell ring around it (rows 2-10, cols 3-13)
const moatTop = 2, moatBot = 10, moatLeft = 3, moatRight = 13;
// Top moat
for (let c = moatLeft; c <= moatRight; c++) setCell(moatTop, c, '~~');
// Bottom moat (with gap for gate)
for (let c = moatLeft; c <= moatRight; c++) {
    if (c === 8) continue; // gate opening
    setCell(moatBot, c, '~~');
}
// Left moat
for (let r = moatTop + 1; r < moatBot; r++) setCell(r, moatLeft, '~~');
// Right moat
for (let r = moatTop + 1; r < moatBot; r++) setCell(r, moatRight, '~~');

// === CASTLE WALLS ===
// Inner castle: rows 3-9, cols 4-12
const castleTop = 3, castleBot = 9, castleLeft = 4, castleRight = 12;

// Top wall
setCell(castleTop, castleLeft, 'TT'); // corner tower
setCell(castleTop, castleRight, 'TT'); // corner tower
for (let c = castleLeft + 1; c < castleRight; c++) setCell(castleTop, c, 'WW');

// Bottom wall (with gatehouse)
setCell(castleBot, castleLeft, 'TT');
setCell(castleBot, castleRight, 'TT');
for (let c = castleLeft + 1; c < castleRight; c++) {
    if (c === 7) { setCell(castleBot, c, 'LL'); continue; }
    if (c === 8) { setCell(castleBot, c, 'Gg'); continue; }
    if (c === 9) { setCell(castleBot, c, 'RR'); continue; }
    setCell(castleBot, c, 'WW');
}

// Left wall
for (let r = castleTop + 1; r < castleBot; r++) setCell(r, castleLeft, '||');
// Right wall
for (let r = castleTop + 1; r < castleBot; r++) setCell(r, castleRight, '||');

// === BAILEY (courtyard inside walls) ===
fillCells(castleTop + 1, castleLeft + 1, castleBot - 1, castleRight - 1, 'CC');

// === KEEP (occupies 2x2 logical cells = 4x4 tiles) ===
// Place keep in center-left of bailey
const keepR = 5, keepC = 6;
setCell(keepR, keepC, 'Kk');
setCell(keepR, keepC + 1, 'kk');
setCell(keepR + 1, keepC, 'kk');
setCell(keepR + 1, keepC + 1, 'kk');

// === ROAD (winding from gate south to bottom-right) ===
// Gate is at logical row 9, col 8. Road goes south then curves to bottom-right.
// Path: (10,8) → (11,8) → (12,9) → (13,10) → (14,11) → (15,12) → (16,13) → (17,14) → (18,15)
const roadPath = [
    [10, 8], // just below moat (bridge)
    [11, 8],
    [12, 8],
    [12, 9],
    [13, 9],
    [13, 10],
    [14, 10],
    [14, 11],
    [15, 11],
    [15, 12],
    [16, 12],
    [16, 13],
    [17, 13],
    [17, 14],
    [18, 14],
    [18, 15],
];
for (const [r, c] of roadPath) setCell(r, c, 'Dd');

// Bridge through moat
setCell(moatBot, 8, 'Dd'); // bridge over moat gap

// === VILLAGE HUTS (outside castle, near road) ===
setCell(11, 6, 'HH');
setCell(11, 7, 'HH');
setCell(12, 6, 'HH');
setCell(13, 7, 'HH');
setCell(13, 8, 'HH');

// === OAK TREES ===
// Upper-left cluster (behind castle)
setCell(1, 1, 'Pp'); setCell(1, 2, 'Pp');
setCell(2, 1, 'Pp'); setCell(2, 2, 'Pp');

// Left side trees
setCell(5, 1, 'Pp'); setCell(6, 1, 'Pp');
setCell(8, 1, 'Pp'); setCell(9, 1, 'Pp');

// Lower-left trees
setCell(14, 1, 'Pp'); setCell(15, 1, 'Pp');
setCell(16, 1, 'Pp'); setCell(17, 1, 'Pp');

// Upper-right trees (between castle and river)
setCell(1, 14, 'Pp'); setCell(1, 15, 'Pp');
setCell(2, 15, 'Pp');

// Lower-right trees
setCell(16, 15, 'Pp'); setCell(17, 16, 'Pp');

// Scattered singles
setCell(12, 14, 'Pp');
setCell(7, 14, 'Pp');

// === FLOWER PATCHES ===
setCell(11, 3, ',,'); setCell(12, 3, ',,');
setCell(15, 5, ',,'); setCell(15, 6, ',,');
setCell(17, 8, ',,'); setCell(17, 9, ',,');
setCell(14, 15, ',,');
setCell(6, 15, ',,');

// === OUTPUT ===
// Convert logical grid to 40x40 char map
const charMap = [];
for (let r = 0; r < GRID; r++) {
    const row1 = [];
    const row2 = [];
    for (let c = 0; c < GRID; c++) {
        const cell = grid[r][c];
        // Each logical cell becomes 2x2 chars
        // First char = top-left identifier, rest = continuation
        switch (cell) {
            case '..': row1.push('..'); row2.push('..'); break;
            case ',,': row1.push(',,'); row2.push(',,'); break;
            case '##': row1.push('##'); row2.push('##'); break;
            case '~~': row1.push('~~'); row2.push('~~'); break;
            case '))': row1.push('))'); row2.push('))'); break;
            case '>>': row1.push('>>'); row2.push('>>'); break;
            case 'Pp': row1.push('Pp'); row2.push('pp'); break;
            case 'Dd': row1.push('Dd'); row2.push('dd'); break;
            case 'CC': row1.push('CC'); row2.push('CC'); break;
            case 'TT': row1.push('TT'); row2.push('TT'); break;
            case 'WW': row1.push('WW'); row2.push('WW'); break;
            case '||': row1.push('||'); row2.push('||'); break;
            case 'BB': row1.push('BB'); row2.push('BB'); break;
            case 'LL': row1.push('LL'); row2.push('LL'); break;
            case 'RR': row1.push('RR'); row2.push('RR'); break;
            case 'Gg': row1.push('Gg'); row2.push('gg'); break;
            case 'HH': row1.push('Hh'); row2.push('hh'); break;
            case 'Kk': row1.push('Kk'); row2.push('kk'); break;
            case 'kk': row1.push('kk'); row2.push('kk'); break;
            default:   row1.push('..'); row2.push('..'); break;
        }
    }
    charMap.push(row1.join(''));
    charMap.push(row2.join(''));
}

const header = [
    '; Level 1 - Medieval Castle (2x2 grid)',
    '; All major sprites are 2x2 tiles (64x64px)',
    '; K=keep(4x4) G=gate(2x2) P=oak(2x2) D=road(2x2) H=hut(2x2)',
    '; T=tower W=wall-h |=wall-v L/R=wall-gate C=bailey ~=water',
    'name=Castle Stronghold',
].join('\n');

const output = header + '\n' + charMap.join('\n') + '\n';
fs.writeFileSync(path.join(__dirname, '..', '..', 'levels', 'level1.txt'), output);

console.log(`Generated level1.txt: ${W}x${H} (${GRID}x${GRID} logical grid)`);
