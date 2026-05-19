/**
 * Generate stone bridge sprites (32x32).
 *
 * Bridge runs left-to-right over water flowing top-to-bottom.
 * The bridge is 3 tiles tall (wall-top, middle/road, wall-bottom).
 * And 3+ tiles wide (start, mid sections, end).
 *
 * Sprites (9 total for a 3-row bridge):
 *
 *   Top row (bridge wall/parapet, top side):
 *     bridge-tl  = top-left corner (road connects left, water above)
 *     bridge-tm  = top-middle (stone parapet over water)
 *     bridge-tr  = top-right corner (road connects right, water above)
 *
 *   Middle row (road surface):
 *     bridge-ml  = middle-left (road from left onto bridge)
 *     bridge-mm  = middle-middle (road surface over water)
 *     bridge-mr  = middle-right (road from bridge to right)
 *
 *   Bottom row (bridge wall/parapet, bottom side):
 *     bridge-bl  = bottom-left corner (road connects left, water below)
 *     bridge-bm  = bottom-middle (stone parapet over water)
 *     bridge-br  = bottom-right corner (road connects right, water below)
 *
 * Style: stone parapets (warm sandy stone matching castle), road surface
 * on middle row, water visible above/below the parapets.
 */

const sharp = require('sharp');
const path = require('path');

const SIZE = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

const WATER = [130, 210, 210];
const ROAD = [210, 165, 110];
const ROAD_EDGE = [185, 140, 90];

// Stone parapet (matches castle style)
const STONE = [175, 165, 140];
const STONE_DARK = [120, 112, 95];
const STONE_LIGHT = [195, 185, 160];
const STONE_TOP = [185, 175, 150];

let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }

function setPixel(buf, x, y, r, g, b) {
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    const idx = (y * SIZE + x) * 4;
    buf[idx] = Math.max(0, Math.min(255, Math.round(r)));
    buf[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[idx + 3] = 255;
}

function fill(buf, x1, y1, x2, y2, color, noise, seedVal) {
    resetSeed(seedVal);
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * noise;
            setPixel(buf, x, y, color[0]+n, color[1]+n, color[2]+n);
        }
}

function fillWater(buf, seedVal) { fill(buf, 0, 0, 31, 31, WATER, 3, seedVal); }
function fillRoad(buf, seedVal) { fill(buf, 0, 0, 31, 31, ROAD, 3, seedVal); }

function drawStoneWall(buf, x1, y1, x2, y2, seedVal) {
    fill(buf, x1, y1, x2, y2, STONE, 4, seedVal);
    // Top highlight
    for (let x = x1; x <= x2; x++) setPixel(buf, x, y1, ...STONE_TOP);
    // Bottom shadow
    for (let x = x1; x <= x2; x++) setPixel(buf, x, y2, ...STONE_DARK);
    // Block pattern
    resetSeed(seedVal + 500);
    for (let y = y1 + 3; y < y2; y += 4) {
        for (let x = x1; x <= x2; x++) setPixel(buf, x, y, ...STONE_DARK);
    }
}

// === TOP ROW (stone parapet on top, water above) ===

function genBridgeTL() {
    const buf = Buffer.alloc(SIZE*SIZE*4);
    // Left half: road, right half: water above + stone parapet below
    fillRoad(buf, 90000);
    // Water in top-right area
    fill(buf, 16, 0, 31, 14, WATER, 3, 90010);
    // Stone parapet (bottom portion)
    drawStoneWall(buf, 0, 20, 31, 31, 90020);
    // Road connects from left into the parapet top
    fill(buf, 0, 0, 15, 19, ROAD, 3, 90030);
    fill(buf, 0, 0, 15, 2, ROAD_EDGE, 3, 90031);
    return buf;
}

function genBridgeTM() {
    const buf = Buffer.alloc(SIZE*SIZE*4);
    // Water on top, stone parapet on bottom
    fill(buf, 0, 0, 31, 14, WATER, 3, 91000);
    // Stone parapet
    drawStoneWall(buf, 0, 15, 31, 31, 91010);
    return buf;
}

function genBridgeTR() {
    const buf = Buffer.alloc(SIZE*SIZE*4);
    // Right half: road, left half: water above + stone parapet below
    fillRoad(buf, 92000);
    fill(buf, 0, 0, 15, 14, WATER, 3, 92010);
    drawStoneWall(buf, 0, 20, 31, 31, 92020);
    // Road connects to right
    fill(buf, 16, 0, 31, 19, ROAD, 3, 92030);
    fill(buf, 16, 0, 31, 2, ROAD_EDGE, 3, 92031);
    return buf;
}

// === MIDDLE ROW (road surface over water) ===

function genBridgeML() {
    const buf = Buffer.alloc(SIZE*SIZE*4);
    // Full road surface (connects from left)
    fillRoad(buf, 93000);
    // Road edge on top and bottom
    fill(buf, 0, 0, 31, 2, ROAD_EDGE, 3, 93010);
    fill(buf, 0, 29, 31, 31, ROAD_EDGE, 3, 93020);
    return buf;
}

function genBridgeMM() {
    const buf = Buffer.alloc(SIZE*SIZE*4);
    // Full road surface
    fillRoad(buf, 94000);
    fill(buf, 0, 0, 31, 2, ROAD_EDGE, 3, 94010);
    fill(buf, 0, 29, 31, 31, ROAD_EDGE, 3, 94020);
    return buf;
}

function genBridgeMR() {
    const buf = Buffer.alloc(SIZE*SIZE*4);
    // Full road surface (connects to right)
    fillRoad(buf, 95000);
    fill(buf, 0, 0, 31, 2, ROAD_EDGE, 3, 95010);
    fill(buf, 0, 29, 31, 31, ROAD_EDGE, 3, 95020);
    return buf;
}

// === BOTTOM ROW (stone parapet on bottom, water below) ===

function genBridgeBL() {
    const buf = Buffer.alloc(SIZE*SIZE*4);
    fillRoad(buf, 96000);
    // Water in bottom-right
    fill(buf, 16, 17, 31, 31, WATER, 3, 96010);
    // Stone parapet (top portion)
    drawStoneWall(buf, 0, 0, 31, 11, 96020);
    // Road connects from left
    fill(buf, 0, 12, 15, 31, ROAD, 3, 96030);
    fill(buf, 0, 29, 15, 31, ROAD_EDGE, 3, 96031);
    return buf;
}

function genBridgeBM() {
    const buf = Buffer.alloc(SIZE*SIZE*4);
    // Stone parapet on top, water below
    drawStoneWall(buf, 0, 0, 31, 16, 97000);
    fill(buf, 0, 17, 31, 31, WATER, 3, 97010);
    return buf;
}

function genBridgeBR() {
    const buf = Buffer.alloc(SIZE*SIZE*4);
    fillRoad(buf, 98000);
    // Water in bottom-left
    fill(buf, 0, 17, 15, 31, WATER, 3, 98010);
    // Stone parapet (top portion)
    drawStoneWall(buf, 0, 0, 31, 11, 98020);
    // Road connects to right
    fill(buf, 16, 12, 31, 31, ROAD, 3, 98030);
    fill(buf, 16, 29, 31, 31, ROAD_EDGE, 3, 98031);
    return buf;
}

// === MAIN ===
async function generateAll() {
    const sprites = [
        { name: 'bridge-tl', buf: genBridgeTL() },
        { name: 'bridge-tm', buf: genBridgeTM() },
        { name: 'bridge-tr', buf: genBridgeTR() },
        { name: 'bridge-ml', buf: genBridgeML() },
        { name: 'bridge-mm', buf: genBridgeMM() },
        { name: 'bridge-mr', buf: genBridgeMR() },
        { name: 'bridge-bl', buf: genBridgeBL() },
        { name: 'bridge-bm', buf: genBridgeBM() },
        { name: 'bridge-br', buf: genBridgeBR() },
    ];

    for (const sprite of sprites) {
        await sharp(sprite.buf, { raw: { width: SIZE, height: SIZE, channels: 4 } })
            .png().toFile(path.join(OUTPUT_DIR, `${sprite.name}.png`));
        console.log(`  ✓ ${sprite.name}.png`);
    }
    console.log('\nDone! 9 bridge sprites.');
}

generateAll().catch(err => { console.error(err); process.exit(1); });
