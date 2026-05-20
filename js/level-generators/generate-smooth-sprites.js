/**
 * Generate all terrain sprites in pixel art style.
 *
 * Based on reference: "Road Tiles Pixel Art"
 *   - Dirt road: warm brown with darker crack/root details, jagged grass edges
 *   - Stone bridge: grey cobblestone with rounded stone shapes, dark mortar
 *   - Grass: bright green with subtle pixel texture
 *   - Water: soft teal with ripple highlights
 *   - Trees: round dark green canopy blobs
 */

const sharp = require('sharp');
const path = require('path');

const SIZE = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Palette - high contrast pixel art (Kingdom Rush style, top-left panel)
const GRASS = [95, 180, 72];          // bright green (more colorful)
const GRASS_DARK = [75, 155, 55];     // darker grass patches
const GRASS_LIGHT = [115, 200, 88];   // highlight
const GRASS_EDGE = [82, 162, 60];     // edge pixels at road border

const DIRT = [210, 165, 110];         // warm sandy orange road (colorful)
const DIRT_LIGHT = [230, 185, 130];   // lighter patches
const DIRT_DARK = [170, 130, 80];     // cracks/roots

const STONE = [140, 138, 130];        // bridge stone
const STONE_LIGHT = [165, 162, 152];  // stone highlight
const STONE_DARK = [90, 88, 80];      // mortar dark

const WATER = [45, 120, 210];         // vivid blue river
const WATER_LIGHT = [80, 155, 235];   // light ripple highlight
const WATER_DARK = [25, 85, 175];     // deeper water
const WATER_EDGE = [35, 100, 190];    // shoreline

const TREE_DARK = [28, 85, 25];       // darkest canopy shadow
const TREE_MID = [48, 130, 42];       // main canopy
const TREE_LIGHT = [75, 170, 60];     // sun-hit highlight
const TREE_SHADOW = [38, 108, 32];    // ground shadow

let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }

function createBuf() { return Buffer.alloc(SIZE * SIZE * 4); }

/**
 * Clip sprite to hexagonal shape. Pixels outside hex become transparent.
 */
function drawHexBorder(buf) {
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        points.push({ x: cx + (SIZE/2) * Math.cos(angle), y: cy + (SIZE/2) * Math.sin(angle) });
    }

    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (!pointInHex(x, y, points)) {
                const idx = (y * SIZE + x) * 4;
                buf[idx] = 0; buf[idx+1] = 0; buf[idx+2] = 0; buf[idx+3] = 0;
            }
        }
    }
}

function pointInHex(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x, yi = pts[i].y;
        const xj = pts[j].x, yj = pts[j].y;
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

function px(buf, x, y, r, g, b) {
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    const i = (y * SIZE + x) * 4;
    buf[i] = Math.max(0, Math.min(255, Math.round(r)));
    buf[i+1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[i+2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[i+3] = 255;
}

function fill(buf, color, noise, sv) {
    resetSeed(sv);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * noise;
            // Add pixel-art dithering: occasional sharp dark/light pixels
            const dither = seededRandom() > 0.92 ? 15 : (seededRandom() < 0.08 ? -12 : 0);
            px(buf, x, y, color[0]+n+dither, color[1]+n+dither, color[2]+n+dither);
        }
}

// Draw cobblestone pattern (rounded stones with mortar gaps)
function drawCobblestones(buf, x1, y1, x2, y2, sv) {
    resetSeed(sv);
    // Fill with mortar base
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * 10;
            px(buf, x, y, STONE_DARK[0]+n, STONE_DARK[1]+n, STONE_DARK[2]+n);
        }
    // Draw individual stones (irregular rounded rectangles)
    resetSeed(sv + 100);
    const stoneSize = 5;
    for (let sy = y1; sy <= y2; sy += stoneSize + 1) {
        const rowOffset = ((sy - y1) / (stoneSize + 1)) % 2 === 0 ? 0 : 3;
        for (let sx = x1 + rowOffset; sx <= x2; sx += stoneSize + 2) {
            const sw = stoneSize + Math.floor(seededRandom() * 2) - 1;
            const sh = stoneSize + Math.floor(seededRandom() * 2) - 2;
            const isLight = seededRandom() > 0.5;
            const color = isLight ? STONE_LIGHT : STONE;
            for (let dy = 0; dy < sh; dy++) {
                for (let dx = 0; dx < sw; dx++) {
                    // Round corners
                    if ((dx === 0 && dy === 0) || (dx === sw-1 && dy === 0) ||
                        (dx === 0 && dy === sh-1) || (dx === sw-1 && dy === sh-1)) continue;
                    const n = (seededRandom() - 0.5) * 12;
                    px(buf, sx+dx, sy+dy, color[0]+n, color[1]+n, color[2]+n);
                }
            }
        }
    }
}

// Draw dirt texture with cracks
function drawDirt(buf, x1, y1, x2, y2, sv) {
    resetSeed(sv);
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * 10;
            px(buf, x, y, DIRT[0]+n, DIRT[1]+n*0.8, DIRT[2]+n*0.6);
        }
    // Dark cracks/roots
    resetSeed(sv + 200);
    for (let i = 0; i < 8; i++) {
        let cx = x1 + Math.floor(seededRandom() * (x2-x1));
        let cy = y1 + Math.floor(seededRandom() * (y2-y1));
        const len = 3 + Math.floor(seededRandom() * 5);
        for (let d = 0; d < len; d++) {
            px(buf, cx, cy, ...DIRT_DARK);
            cx += Math.floor(seededRandom() * 3) - 1;
            cy += Math.floor(seededRandom() * 3) - 1;
        }
    }
    // Light patches
    resetSeed(sv + 300);
    for (let i = 0; i < 5; i++) {
        const lx = x1 + Math.floor(seededRandom() * (x2-x1));
        const ly = y1 + Math.floor(seededRandom() * (y2-y1));
        px(buf, lx, ly, ...DIRT_LIGHT);
        px(buf, lx+1, ly, ...DIRT_LIGHT);
    }
}

// Jagged grass edge (pixels of grass poking into road)
function drawGrassEdgeVertical(buf, edgeX, side, sv) {
    resetSeed(sv);
    for (let y = 0; y < SIZE; y++) {
        const jag = Math.floor(seededRandom() * 3);
        for (let d = 0; d < jag; d++) {
            const x = side === 'left' ? edgeX + d : edgeX - d;
            px(buf, x, y, ...GRASS_EDGE);
            if (seededRandom() > 0.5) px(buf, x, y, ...GRASS_DARK);
        }
    }
}

function drawGrassEdgeHorizontal(buf, edgeY, side, sv) {
    resetSeed(sv);
    for (let x = 0; x < SIZE; x++) {
        const jag = Math.floor(seededRandom() * 3);
        for (let d = 0; d < jag; d++) {
            const y = side === 'top' ? edgeY + d : edgeY - d;
            px(buf, x, y, ...GRASS_EDGE);
            if (seededRandom() > 0.5) px(buf, x, y, ...GRASS_DARK);
        }
    }
}

// ============ SPRITE GENERATORS ============

function genGrass(v) {
    const buf = createBuf();
    fill(buf, GRASS, 14, 1000 + v*100);
    resetSeed(1050 + v*100);
    for (let i = 0; i < 6; i++) {
        px(buf, Math.floor(seededRandom()*SIZE), Math.floor(seededRandom()*SIZE), ...GRASS_DARK);
    }
    return buf;
}

function genFlowers(v) {
    const buf = createBuf();
    fill(buf, GRASS, 14, 2000 + v*100);
    resetSeed(2050 + v*100);

    // Draw 3-4 proper flowers with petals
    const flowerColors = [
        { petal: [240, 80, 120], center: [255, 220, 60] },   // pink/red with yellow center
        { petal: [255, 200, 50], center: [180, 100, 30] },    // yellow with brown center
        { petal: [220, 220, 240], center: [240, 200, 50] },   // white with yellow center
        { petal: [180, 100, 220], center: [255, 230, 80] },   // purple with yellow center
    ];

    const count = 3 + Math.floor(seededRandom() * 2);
    for (let i = 0; i < count; i++) {
        const fx = 5 + Math.floor(seededRandom() * 22);
        const fy = 5 + Math.floor(seededRandom() * 22);
        const flower = flowerColors[Math.floor(seededRandom() * flowerColors.length)];

        // Petals (cross pattern, 2px each direction)
        const dirs = [[0,-2],[0,2],[-2,0],[2,0],[-1,-1],[1,-1],[-1,1],[1,1]];
        for (const [dx, dy] of dirs) {
            px(buf, fx+dx, fy+dy, ...flower.petal);
        }
        // Extra petal pixels for fullness
        px(buf, fx, fy-1, ...flower.petal);
        px(buf, fx, fy+1, ...flower.petal);
        px(buf, fx-1, fy, ...flower.petal);
        px(buf, fx+1, fy, ...flower.petal);

        // Center (bright dot)
        px(buf, fx, fy, ...flower.center);

        // Stem (1-2px green below)
        px(buf, fx, fy+3, 45, 120, 35);
        px(buf, fx, fy+4, 40, 110, 30);
    }
    return buf;
}

function genRoadFull() {
    const buf = createBuf();
    drawDirt(buf, 0, 0, 31, 31, 3000);
    return buf;
}

function genRoadEdgeLeft() {
    const buf = createBuf();
    fill(buf, GRASS, 12, 3100);
    drawDirt(buf, 14, 0, 31, 31, 3110);
    drawGrassEdgeVertical(buf, 14, 'left', 3120);
    return buf;
}

function genRoadEdgeRight() {
    const buf = createBuf();
    fill(buf, GRASS, 12, 3200);
    drawDirt(buf, 0, 0, 17, 31, 3210);
    drawGrassEdgeVertical(buf, 17, 'right', 3220);
    return buf;
}

function genRoadEdgeTop() {
    const buf = createBuf();
    fill(buf, GRASS, 12, 3300);
    drawDirt(buf, 0, 14, 31, 31, 3310);
    drawGrassEdgeHorizontal(buf, 14, 'top', 3320);
    return buf;
}

function genRoadEdgeBottom() {
    const buf = createBuf();
    fill(buf, GRASS, 12, 3400);
    drawDirt(buf, 0, 0, 31, 17, 3410);
    drawGrassEdgeHorizontal(buf, 17, 'bottom', 3420);
    return buf;
}

function genRoadCorner(corner) {
    const buf = createBuf();
    fill(buf, GRASS, 12, 3500 + corner*100);
    // Fill road in the non-grass quadrant
    const half = 16;
    switch(corner) {
        case 0: drawDirt(buf, half, half, 31, 31, 3510); break; // TL: grass TL, road BR
        case 1: drawDirt(buf, 0, half, half, 31, 3610); break;  // TR: grass TR, road BL
        case 2: drawDirt(buf, half, 0, 31, half, 3710); break;  // BL: grass BL, road TR
        case 3: drawDirt(buf, 0, 0, half, half, 3810); break;   // BR: grass BR, road TL
    }
    return buf;
}

// Bridge tiles - based on stone bridge reference:
// Top/bottom rows = stone parapet walls (darker, heavier blocks)
// Middle row = open stone road surface (lighter cobblestone)
// Left/right edges = dirt road transitioning to stone

const BRIDGE_WALL = [100, 98, 88];      // parapet wall stone (darker)
const BRIDGE_WALL_DARK = [62, 60, 52];  // mortar in wall
const BRIDGE_ROAD = [140, 138, 128];    // bridge road surface (lighter stone)
const BRIDGE_ROAD_DARK = [95, 92, 82];  // mortar in road

function drawBridgeWall(buf, x1, y1, x2, y2, sv) {
    // Heavier stone blocks for the parapet wall
    resetSeed(sv);
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom()-0.5)*5;
            px(buf, x, y, BRIDGE_WALL_DARK[0]+n, BRIDGE_WALL_DARK[1]+n, BRIDGE_WALL_DARK[2]+n);
        }
    // Large stone blocks
    resetSeed(sv+50);
    for (let sy = y1; sy <= y2; sy += 7) {
        const rowOff = ((sy-y1)/7)%2===0 ? 0 : 4;
        for (let sx = x1+rowOff; sx <= x2; sx += 8) {
            const sw = 6+Math.floor(seededRandom()*3);
            const sh = 5+Math.floor(seededRandom()*2);
            for (let dy = 1; dy < sh-1 && sy+dy <= y2; dy++)
                for (let dx = 1; dx < sw-1 && sx+dx <= x2; dx++) {
                    const n = (seededRandom()-0.5)*6;
                    px(buf, sx+dx, sy+dy, BRIDGE_WALL[0]+n, BRIDGE_WALL[1]+n, BRIDGE_WALL[2]+n);
                }
        }
    }
}

function drawBridgeRoad(buf, x1, y1, x2, y2, sv) {
    // Lighter, flatter cobblestone for the walkable surface
    resetSeed(sv);
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom()-0.5)*4;
            px(buf, x, y, BRIDGE_ROAD_DARK[0]+n, BRIDGE_ROAD_DARK[1]+n, BRIDGE_ROAD_DARK[2]+n);
        }
    resetSeed(sv+50);
    for (let sy = y1; sy <= y2; sy += 5) {
        const rowOff = ((sy-y1)/5)%2===0 ? 0 : 3;
        for (let sx = x1+rowOff; sx <= x2; sx += 6) {
            const sw = 4+Math.floor(seededRandom()*2);
            const sh = 3+Math.floor(seededRandom()*2);
            for (let dy = 0; dy < sh && sy+dy <= y2; dy++)
                for (let dx = 0; dx < sw && sx+dx <= x2; dx++) {
                    if ((dx===0&&dy===0)||(dx===sw-1&&dy===0)||(dx===0&&dy===sh-1)||(dx===sw-1&&dy===sh-1)) continue;
                    const n = (seededRandom()-0.5)*5;
                    px(buf, sx+dx, sy+dy, BRIDGE_ROAD[0]+n, BRIDGE_ROAD[1]+n, BRIDGE_ROAD[2]+n);
                }
        }
    }
}

function genBridgeTL() {
    const buf = createBuf();
    // Left half: dirt road, right half: road surface with narrow wall at top
    drawDirt(buf, 0, 0, 15, 31, 4000);
    drawBridgeRoad(buf, 16, 0, 31, 31, 4020);
    drawBridgeWall(buf, 16, 0, 31, 8, 4025);
    for (let x = 16; x < SIZE; x++) px(buf, x, 9, ...BRIDGE_WALL_DARK);
    return buf;
}
function genBridgeTM() {
    const buf = createBuf();
    // Top parapet: narrow wall at TOP of sprite, cobblestone road below
    // Wall takes up top ~8px, road surface fills the rest
    drawBridgeRoad(buf, 0, 0, 31, 31, 4110);
    drawBridgeWall(buf, 0, 0, 31, 8, 4115);
    // Dark edge line between wall and road
    for (let x = 0; x < SIZE; x++) px(buf, x, 9, ...BRIDGE_WALL_DARK);
    return buf;
}
function genBridgeTR() {
    const buf = createBuf();
    // Left half: road surface with narrow wall at top, right half: dirt
    drawBridgeRoad(buf, 0, 0, 15, 31, 4210);
    drawBridgeWall(buf, 0, 0, 15, 8, 4215);
    for (let x = 0; x <= 15; x++) px(buf, x, 9, ...BRIDGE_WALL_DARK);
    drawDirt(buf, 16, 0, 31, 31, 4220);
    return buf;
}
function genBridgeML() {
    const buf = createBuf();
    drawDirt(buf, 0, 0, 15, 31, 4310);
    drawBridgeRoad(buf, 16, 0, 31, 31, 4320);
    return buf;
}
function genBridgeMM() {
    const buf = createBuf();
    drawBridgeRoad(buf, 0, 0, 31, 31, 4410);
    return buf;
}
function genBridgeMR() {
    const buf = createBuf();
    drawBridgeRoad(buf, 0, 0, 15, 31, 4510);
    drawDirt(buf, 16, 0, 31, 31, 4520);
    return buf;
}
function genBridgeBL() {
    const buf = createBuf();
    // Left half: dirt road, right half: road surface with narrow wall at bottom
    drawDirt(buf, 0, 0, 15, 31, 4610);
    drawBridgeRoad(buf, 16, 0, 31, 31, 4620);
    drawBridgeWall(buf, 16, 23, 31, 31, 4625);
    for (let x = 16; x < SIZE; x++) px(buf, x, 22, ...BRIDGE_WALL_DARK);
    return buf;
}
function genBridgeBM() {
    const buf = createBuf();
    // Bottom parapet: cobblestone road on top, narrow wall at BOTTOM of sprite
    drawBridgeRoad(buf, 0, 0, 31, 31, 4710);
    drawBridgeWall(buf, 0, 23, 31, 31, 4715);
    // Dark edge line between road and wall
    for (let x = 0; x < SIZE; x++) px(buf, x, 22, ...BRIDGE_WALL_DARK);
    return buf;
}
function genBridgeBR() {
    const buf = createBuf();
    // Left half: road surface with narrow wall at bottom, right half: dirt
    drawBridgeRoad(buf, 0, 0, 15, 31, 4810);
    drawBridgeWall(buf, 0, 23, 15, 31, 4815);
    for (let x = 0; x <= 15; x++) px(buf, x, 22, ...BRIDGE_WALL_DARK);
    drawDirt(buf, 16, 0, 31, 31, 4820);
    return buf;
}

// Water - two flow directions
function genWaterV(v) {
    // Vertical flow (top to bottom) - tidal marks run vertically
    const buf = createBuf();
    fill(buf, WATER, 12, 5000 + v*100);
    resetSeed(5050 + v*100);
    // Vertical flow streaks (top to bottom)
    for (let i = 0; i < 6; i++) {
        const x = Math.floor(seededRandom()*SIZE);
        const y = Math.floor(seededRandom()*SIZE);
        const len = 4 + Math.floor(seededRandom()*5);
        for (let d = 0; d < len; d++) px(buf, x, y+d, ...WATER_LIGHT);
    }
    // Subtle darker current lines
    resetSeed(5060 + v*100);
    for (let i = 0; i < 3; i++) {
        const x = Math.floor(seededRandom()*SIZE);
        const y = Math.floor(seededRandom()*SIZE);
        const len = 3 + Math.floor(seededRandom()*4);
        for (let d = 0; d < len; d++) px(buf, x+1, y+d, ...WATER_DARK);
    }
    return buf;
}

function genWaterH(v) {
    // Horizontal flow (left to right) - tidal marks run horizontally
    const buf = createBuf();
    fill(buf, WATER, 12, 5500 + v*100);
    resetSeed(5550 + v*100);
    // Horizontal flow streaks (left to right)
    for (let i = 0; i < 6; i++) {
        const x = Math.floor(seededRandom()*SIZE);
        const y = Math.floor(seededRandom()*SIZE);
        const len = 4 + Math.floor(seededRandom()*5);
        for (let d = 0; d < len; d++) px(buf, x+d, y, ...WATER_LIGHT);
    }
    // Subtle darker current lines
    resetSeed(5560 + v*100);
    for (let i = 0; i < 3; i++) {
        const x = Math.floor(seededRandom()*SIZE);
        const y = Math.floor(seededRandom()*SIZE);
        const len = 3 + Math.floor(seededRandom()*4);
        for (let d = 0; d < len; d++) px(buf, x+d, y+1, ...WATER_DARK);
    }
    return buf;
}

function genWaterEdgeRight() {
    const buf = createBuf();
    resetSeed(5200);
    for (let y = 0; y < SIZE; y++) {
        const edge = 16 + Math.round(Math.sin(y*0.25)*2);
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom()-0.5)*3;
            if (x > edge+1) px(buf, x, y, GRASS[0]+n, GRASS[1]+n, GRASS[2]+n);
            else if (x > edge-1) px(buf, x, y, WATER_EDGE[0]+n, WATER_EDGE[1]+n, WATER_EDGE[2]+n);
            else px(buf, x, y, WATER[0]+n, WATER[1]+n, WATER[2]+n);
        }
    }
    return buf;
}

function genWaterEdgeLeft() {
    const buf = createBuf();
    resetSeed(5300);
    for (let y = 0; y < SIZE; y++) {
        const edge = 15 + Math.round(Math.sin(y*0.25+1)*2);
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom()-0.5)*3;
            if (x < edge-1) px(buf, x, y, GRASS[0]+n, GRASS[1]+n, GRASS[2]+n);
            else if (x < edge+1) px(buf, x, y, WATER_EDGE[0]+n, WATER_EDGE[1]+n, WATER_EDGE[2]+n);
            else px(buf, x, y, WATER[0]+n, WATER[1]+n, WATER[2]+n);
        }
    }
    return buf;
}

// Trees - multiple types for variety
// tree-1/2/3: round oak (existing)
// tree-4/5: tall pine/conifer (triangular)
// tree-6/7: bushy shrub (small, wide)

const PINE_DARK = [18, 62, 28];
const PINE_MID = [30, 90, 38];
const PINE_LIGHT = [48, 120, 50];
const PINE_TRUNK = [65, 42, 25];

const SHRUB_DARK = [35, 105, 30];
const SHRUB_MID = [52, 138, 42];
const SHRUB_LIGHT = [72, 165, 55];

function genTree(v) {
    // Round oak tree
    const buf = createBuf();
    fill(buf, GRASS, 12, 6000 + v*100);
    const cx = 16, cy = 14, r = 9 + (v%2);
    // Shadow
    resetSeed(6050+v*100);
    for (let dy = -3; dy <= 3; dy++)
        for (let dx = -r; dx <= r; dx++)
            if ((dx*dx)/(r*r)+(dy*dy)/9 < 1) px(buf, cx+dx+2, cy+r+dy, ...TREE_SHADOW);
    // Canopy
    for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
            const d = Math.sqrt(dx*dx+dy*dy);
            if (d <= r) {
                const n = (seededRandom()-0.5)*5;
                const c = (d < r*0.4 && dy < 0) ? TREE_LIGHT : (d > r*0.75 ? TREE_DARK : TREE_MID);
                px(buf, cx+dx, cy+dy, c[0]+n, c[1]+n, c[2]+n);
            }
        }
    return buf;
}

function genPine(v) {
    // Triangular conifer/pine tree
    const buf = createBuf();
    fill(buf, GRASS, 12, 6500 + v*100);
    const cx = 16, baseY = 26;
    resetSeed(6550+v*100);

    // Trunk
    for (let y = baseY-2; y <= baseY+2; y++)
        for (let dx = -1; dx <= 1; dx++)
            px(buf, cx+dx, y, ...PINE_TRUNK);

    // Triangular canopy (3 layers, getting narrower toward top)
    const layers = [
        { y: baseY-4, halfW: 8, color: PINE_DARK },
        { y: baseY-9, halfW: 6, color: PINE_MID },
        { y: baseY-13, halfW: 4, color: PINE_LIGHT },
    ];
    for (const layer of layers) {
        for (let dy = 0; dy < 6; dy++) {
            const w = Math.round(layer.halfW * (1 - dy/8));
            for (let dx = -w; dx <= w; dx++) {
                const n = (seededRandom()-0.5)*5;
                const d = Math.abs(dx)/w;
                const c = d > 0.7 ? PINE_DARK : (dy < 2 ? PINE_LIGHT : layer.color);
                px(buf, cx+dx, layer.y-dy, c[0]+n, c[1]+n, c[2]+n);
            }
        }
    }
    // Shadow
    for (let dx = -5; dx <= 5; dx++)
        for (let dy = 0; dy <= 2; dy++)
            if (Math.abs(dx)+dy < 6) px(buf, cx+dx+2, baseY+2+dy, ...TREE_SHADOW);

    return buf;
}

function genShrub(v) {
    // Small bushy shrub (wider than tall)
    const buf = createBuf();
    fill(buf, GRASS, 12, 6800 + v*100);
    const cx = 16, cy = 18;
    const rx = 8 + (v%2)*2, ry = 5 + (v%2);
    resetSeed(6850+v*100);

    // Shadow
    for (let dy = -2; dy <= 2; dy++)
        for (let dx = -rx; dx <= rx; dx++)
            if ((dx*dx)/(rx*rx)+(dy*dy)/4 < 1) px(buf, cx+dx+1, cy+ry+dy-1, ...TREE_SHADOW);

    // Bush body (elliptical)
    for (let dy = -ry; dy <= ry; dy++)
        for (let dx = -rx; dx <= rx; dx++) {
            const d = (dx*dx)/(rx*rx) + (dy*dy)/(ry*ry);
            if (d <= 1) {
                const n = (seededRandom()-0.5)*6;
                const c = (d < 0.3) ? SHRUB_LIGHT : (d > 0.7 ? SHRUB_DARK : SHRUB_MID);
                px(buf, cx+dx, cy+dy, c[0]+n, c[1]+n, c[2]+n);
            }
        }
    return buf;
}

function genRock() {
    const buf = createBuf();
    fill(buf, GRASS, 12, 7000);
    resetSeed(7050);
    const cx=16, cy=18, r=4;
    for (let dy=-r; dy<=r; dy++)
        for (let dx=-r; dx<=r; dx++)
            if (dx*dx+dy*dy<=r*r) px(buf, cx+dx, cy+dy, ...(dy<0?STONE_LIGHT:STONE));
    return buf;
}

// ============ MAIN ============
async function generateAll() {
    const sprites = [
        {name:'grass-short-1', buf:genGrass(0)}, {name:'grass-short-2', buf:genGrass(1)},
        {name:'grass-flowers-1', buf:genFlowers(0)}, {name:'grass-flowers-2', buf:genFlowers(1)},
        {name:'road-full', buf:genRoadFull()},
        {name:'road-edge-left', buf:genRoadEdgeLeft()}, {name:'road-edge-right', buf:genRoadEdgeRight()},
        {name:'road-edge-top', buf:genRoadEdgeTop()}, {name:'road-edge-bottom', buf:genRoadEdgeBottom()},
        {name:'road-corner-tl', buf:genRoadCorner(0)}, {name:'road-corner-tr', buf:genRoadCorner(1)},
        {name:'road-corner-bl', buf:genRoadCorner(2)}, {name:'road-corner-br', buf:genRoadCorner(3)},
        {name:'bridge-tl', buf:genBridgeTL()}, {name:'bridge-tm', buf:genBridgeTM()}, {name:'bridge-tr', buf:genBridgeTR()},
        {name:'bridge-ml', buf:genBridgeML()}, {name:'bridge-mm', buf:genBridgeMM()}, {name:'bridge-mr', buf:genBridgeMR()},
        {name:'bridge-bl', buf:genBridgeBL()}, {name:'bridge-bm', buf:genBridgeBM()}, {name:'bridge-br', buf:genBridgeBR()},
        {name:'water-1', buf:genWaterV(0)}, {name:'water-2', buf:genWaterV(1)}, {name:'water-3', buf:genWaterV(2)},
        {name:'water-h-1', buf:genWaterH(0)}, {name:'water-h-2', buf:genWaterH(1)}, {name:'water-h-3', buf:genWaterH(2)},
        {name:'water-land-right', buf:genWaterEdgeRight()}, {name:'water-land-left', buf:genWaterEdgeLeft()},
        {name:'tree-1', buf:genTree(0)}, {name:'tree-2', buf:genTree(1)}, {name:'tree-3', buf:genTree(2)},
        {name:'tree-4', buf:genPine(0)}, {name:'tree-5', buf:genPine(1)},
        {name:'tree-6', buf:genShrub(0)}, {name:'tree-7', buf:genShrub(1)},
        {name:'rock', buf:genRock()},
    ];
    for (const s of sprites) {
        drawHexBorder(s.buf);
        await sharp(s.buf, {raw:{width:SIZE,height:SIZE,channels:4}}).png().toFile(path.join(OUTPUT_DIR,`${s.name}.png`));
        console.log(`  ✓ ${s.name}.png`);
    }
    console.log(`\nDone! ${sprites.length} sprites.`);
}
generateAll().catch(e=>{console.error(e);process.exit(1);});
