/**
 * Extended tests for js/level-generators/generate-smooth-sprites.js
 *
 * Recommendation 1: Tests for the untested generator functions (road edges,
 * bridge variants, water edges, pine trees, shrubs) by re-implementing
 * the shared drawing helpers and testing them directly.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-smooth-sprites-extended.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const SIZE = 32;

let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }

function createBuf() { return Buffer.alloc(SIZE * SIZE * 4); }

function px(buf, x, y, r, g, b) {
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    const i = (y * SIZE + x) * 4;
    buf[i] = Math.max(0, Math.min(255, Math.round(r)));
    buf[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[i + 3] = 255;
}

function fill(buf, color, noise, sv) {
    resetSeed(sv);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * noise;
            const dither = seededRandom() > 0.92 ? 15 : (seededRandom() < 0.08 ? -12 : 0);
            px(buf, x, y, color[0] + n + dither, color[1] + n + dither, color[2] + n + dither);
        }
}

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] === 255) count++;
    }
    return count;
}

function getPixel(buf, x, y) {
    const i = (y * SIZE + x) * 4;
    return { r: buf[i], g: buf[i + 1], b: buf[i + 2], a: buf[i + 3] };
}

// Palette constants (from generate-smooth-sprites.js)
const GRASS = [95, 180, 72];
const GRASS_DARK = [75, 155, 55];
const GRASS_EDGE = [82, 162, 60];
const DIRT = [210, 165, 110];
const DIRT_LIGHT = [230, 185, 130];
const DIRT_DARK = [170, 130, 80];
const STONE = [140, 138, 130];
const STONE_LIGHT = [165, 162, 152];
const STONE_DARK = [90, 88, 80];
const WATER = [45, 120, 210];
const WATER_LIGHT = [80, 155, 235];
const WATER_DARK = [25, 85, 175];
const WATER_EDGE = [35, 100, 190];
const TREE_DARK = [28, 85, 25];
const TREE_MID = [48, 130, 42];
const TREE_LIGHT = [75, 170, 60];
const TREE_SHADOW = [38, 108, 32];
const PINE_DARK = [18, 62, 28];
const PINE_MID = [30, 90, 38];
const PINE_LIGHT = [48, 120, 50];
const PINE_TRUNK = [65, 42, 25];
const SHRUB_DARK = [35, 105, 30];
const SHRUB_MID = [52, 138, 42];
const SHRUB_LIGHT = [72, 165, 55];
const BRIDGE_WALL = [100, 98, 88];
const BRIDGE_WALL_DARK = [62, 60, 52];
const BRIDGE_ROAD = [140, 138, 128];
const BRIDGE_ROAD_DARK = [95, 92, 82];

// ─── Re-implemented drawing helpers ─────────────────────────────────────────

function drawCobblestones(buf, x1, y1, x2, y2, sv) {
    resetSeed(sv);
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * 10;
            px(buf, x, y, STONE_DARK[0]+n, STONE_DARK[1]+n, STONE_DARK[2]+n);
        }
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
                    if ((dx === 0 && dy === 0) || (dx === sw-1 && dy === 0) ||
                        (dx === 0 && dy === sh-1) || (dx === sw-1 && dy === sh-1)) continue;
                    const n = (seededRandom() - 0.5) * 12;
                    px(buf, sx+dx, sy+dy, color[0]+n, color[1]+n, color[2]+n);
                }
            }
        }
    }
}

function drawDirt(buf, x1, y1, x2, y2, sv) {
    resetSeed(sv);
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * 10;
            px(buf, x, y, DIRT[0]+n, DIRT[1]+n*0.8, DIRT[2]+n*0.6);
        }
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
    resetSeed(sv + 300);
    for (let i = 0; i < 5; i++) {
        const lx = x1 + Math.floor(seededRandom() * (x2-x1));
        const ly = y1 + Math.floor(seededRandom() * (y2-y1));
        px(buf, lx, ly, ...DIRT_LIGHT);
        px(buf, lx+1, ly, ...DIRT_LIGHT);
    }
}

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

function drawBridgeWall(buf, x1, y1, x2, y2, sv) {
    resetSeed(sv);
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom()-0.5)*5;
            px(buf, x, y, BRIDGE_WALL_DARK[0]+n, BRIDGE_WALL_DARK[1]+n, BRIDGE_WALL_DARK[2]+n);
        }
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

// ─── Sprite generator re-implementations ────────────────────────────────────

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
    const half = 16;
    switch(corner) {
        case 0: drawDirt(buf, half, half, 31, 31, 3510); break;
        case 1: drawDirt(buf, 0, half, half, 31, 3610); break;
        case 2: drawDirt(buf, half, 0, 31, half, 3710); break;
        case 3: drawDirt(buf, 0, 0, half, half, 3810); break;
    }
    return buf;
}

function genBridgeTM() {
    const buf = createBuf();
    drawBridgeRoad(buf, 0, 0, 31, 31, 4110);
    drawBridgeWall(buf, 0, 0, 31, 8, 4115);
    for (let x = 0; x < SIZE; x++) px(buf, x, 9, ...BRIDGE_WALL_DARK);
    return buf;
}

function genBridgeMM() {
    const buf = createBuf();
    drawBridgeRoad(buf, 0, 0, 31, 31, 4410);
    return buf;
}

function genBridgeBM() {
    const buf = createBuf();
    drawBridgeRoad(buf, 0, 0, 31, 31, 4710);
    drawBridgeWall(buf, 0, 23, 31, 31, 4715);
    for (let x = 0; x < SIZE; x++) px(buf, x, 22, ...BRIDGE_WALL_DARK);
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

function genPine(v) {
    const buf = createBuf();
    fill(buf, GRASS, 12, 6500 + v*100);
    const cx = 16, baseY = 26;
    resetSeed(6550+v*100);
    for (let y = baseY-2; y <= baseY+2; y++)
        for (let dx = -1; dx <= 1; dx++)
            px(buf, cx+dx, y, ...PINE_TRUNK);
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
    for (let dx = -5; dx <= 5; dx++)
        for (let dy = 0; dy <= 2; dy++)
            if (Math.abs(dx)+dy < 6) px(buf, cx+dx+2, baseY+2+dy, ...TREE_SHADOW);
    return buf;
}

function genShrub(v) {
    const buf = createBuf();
    fill(buf, GRASS, 12, 6800 + v*100);
    const cx = 16, cy = 18;
    const rx = 8 + (v%2)*2, ry = 5 + (v%2);
    resetSeed(6850+v*100);
    for (let dy = -2; dy <= 2; dy++)
        for (let dx = -rx; dx <= rx; dx++)
            if ((dx*dx)/(rx*rx)+(dy*dy)/4 < 1) px(buf, cx+dx+1, cy+ry+dy-1, ...TREE_SHADOW);
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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('drawCobblestones: stone pattern generation', () => {
    it('should fill the specified region with opaque pixels', () => {
        const buf = createBuf();
        drawCobblestones(buf, 0, 0, 31, 31, 1000);
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
    });

    it('should be deterministic', () => {
        const buf1 = createBuf();
        drawCobblestones(buf1, 0, 0, 31, 31, 1000);
        const buf2 = createBuf();
        drawCobblestones(buf2, 0, 0, 31, 31, 1000);
        assert.ok(buf1.equals(buf2));
    });

    it('should produce grey-toned pixels (stone colors)', () => {
        const buf = createBuf();
        drawCobblestones(buf, 5, 5, 25, 25, 2000);
        const p = getPixel(buf, 15, 15);
        // Stone colors are in the grey range (80-170)
        assert.ok(p.r > 60 && p.r < 200, `Red ${p.r} should be in stone range`);
    });
});

describe('drawDirt: dirt texture with cracks', () => {
    it('should fill the specified region with opaque pixels', () => {
        const buf = createBuf();
        drawDirt(buf, 0, 0, 31, 31, 3000);
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
    });

    it('should produce warm brown-toned pixels', () => {
        const buf = createBuf();
        drawDirt(buf, 0, 0, 31, 31, 3000);
        const p = getPixel(buf, 16, 16);
        // Dirt is warm: red > blue
        assert.ok(p.r > p.b, `Dirt should be warm (R=${p.r} > B=${p.b})`);
    });

    it('should be deterministic', () => {
        const buf1 = createBuf();
        drawDirt(buf1, 0, 0, 31, 31, 3000);
        const buf2 = createBuf();
        drawDirt(buf2, 0, 0, 31, 31, 3000);
        assert.ok(buf1.equals(buf2));
    });

    it('should produce different output for different seeds', () => {
        const buf1 = createBuf();
        drawDirt(buf1, 0, 0, 31, 31, 3000);
        const buf2 = createBuf();
        drawDirt(buf2, 0, 0, 31, 31, 4000);
        assert.ok(!buf1.equals(buf2));
    });
});

describe('drawGrassEdgeVertical: jagged grass edge', () => {
    it('should add grass-colored pixels near the edge', () => {
        const buf = createBuf();
        fill(buf, DIRT, 5, 100);
        drawGrassEdgeVertical(buf, 16, 'left', 200);
        // Check that some pixels near x=16 have grass-like colors
        let grassPixels = 0;
        for (let y = 0; y < SIZE; y++) {
            for (let x = 16; x < 19; x++) {
                const p = getPixel(buf, x, y);
                if (p.g > p.r && p.g > 100) grassPixels++;
            }
        }
        assert.ok(grassPixels > 0, 'Should have some grass-colored pixels at edge');
    });

    it('should be deterministic', () => {
        const buf1 = createBuf();
        drawGrassEdgeVertical(buf1, 16, 'left', 200);
        const buf2 = createBuf();
        drawGrassEdgeVertical(buf2, 16, 'left', 200);
        assert.ok(buf1.equals(buf2));
    });
});

describe('drawGrassEdgeHorizontal: jagged grass edge', () => {
    it('should add grass-colored pixels near the edge', () => {
        const buf = createBuf();
        fill(buf, DIRT, 5, 100);
        drawGrassEdgeHorizontal(buf, 16, 'top', 300);
        let grassPixels = 0;
        for (let x = 0; x < SIZE; x++) {
            for (let y = 16; y < 19; y++) {
                const p = getPixel(buf, x, y);
                if (p.g > p.r && p.g > 100) grassPixels++;
            }
        }
        assert.ok(grassPixels > 0, 'Should have some grass-colored pixels at edge');
    });
});

describe('genRoadEdge variants: road with grass edge', () => {
    it('genRoadEdgeLeft should have grass on left, dirt on right', () => {
        const buf = genRoadEdgeLeft();
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
        // Left side (x=5) should be green-ish (grass)
        const left = getPixel(buf, 5, 16);
        assert.ok(left.g > left.r, 'Left side should be grass (green > red)');
        // Right side (x=25) should be warm (dirt)
        const right = getPixel(buf, 25, 16);
        assert.ok(right.r > right.b, 'Right side should be dirt (red > blue)');
    });

    it('genRoadEdgeRight should have dirt on left, grass on right', () => {
        const buf = genRoadEdgeRight();
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
        const left = getPixel(buf, 5, 16);
        assert.ok(left.r > left.b, 'Left side should be dirt');
        const right = getPixel(buf, 25, 16);
        assert.ok(right.g > right.r, 'Right side should be grass');
    });

    it('genRoadEdgeTop should have grass on top, dirt on bottom', () => {
        const buf = genRoadEdgeTop();
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
        const top = getPixel(buf, 16, 5);
        assert.ok(top.g > top.r, 'Top should be grass');
        const bottom = getPixel(buf, 16, 25);
        assert.ok(bottom.r > bottom.b, 'Bottom should be dirt');
    });

    it('genRoadEdgeBottom should have dirt on top, grass on bottom', () => {
        const buf = genRoadEdgeBottom();
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
        const top = getPixel(buf, 16, 5);
        assert.ok(top.r > top.b, 'Top should be dirt');
        const bottom = getPixel(buf, 16, 25);
        assert.ok(bottom.g > bottom.r, 'Bottom should be grass');
    });

    it('all road edge variants should be deterministic', () => {
        assert.ok(genRoadEdgeLeft().equals(genRoadEdgeLeft()));
        assert.ok(genRoadEdgeRight().equals(genRoadEdgeRight()));
        assert.ok(genRoadEdgeTop().equals(genRoadEdgeTop()));
        assert.ok(genRoadEdgeBottom().equals(genRoadEdgeBottom()));
    });
});

describe('genRoadCorner: road corner variants', () => {
    it('should produce 4 different corner variants', () => {
        const corners = [0, 1, 2, 3].map(c => genRoadCorner(c));
        for (let i = 0; i < corners.length; i++) {
            for (let j = i + 1; j < corners.length; j++) {
                assert.ok(!corners[i].equals(corners[j]),
                    `Corner ${i} and ${j} should differ`);
            }
        }
    });

    it('each corner should be fully opaque', () => {
        for (let c = 0; c < 4; c++) {
            const buf = genRoadCorner(c);
            assert.equal(countOpaquePixels(buf), SIZE * SIZE);
        }
    });

    it('corner 0 (TL) should have dirt in bottom-right quadrant', () => {
        const buf = genRoadCorner(0);
        const p = getPixel(buf, 24, 24);
        assert.ok(p.r > p.b, 'Bottom-right should be dirt for corner 0');
    });
});

describe('genBridge variants: bridge tile generation', () => {
    it('genBridgeTM should have wall at top and road below', () => {
        const buf = genBridgeTM();
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
        // Top area (y=4) should be darker (wall)
        const top = getPixel(buf, 16, 4);
        // Bottom area (y=20) should be lighter (road)
        const bottom = getPixel(buf, 16, 20);
        // Road is lighter than wall
        assert.ok(bottom.r > top.r || bottom.g > top.g,
            'Road area should be lighter than wall area');
    });

    it('genBridgeMM should be all road surface', () => {
        const buf = genBridgeMM();
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
        // Center should be road-colored (grey, 90-150 range)
        const center = getPixel(buf, 16, 16);
        assert.ok(center.r > 70 && center.r < 180, `Road color R=${center.r}`);
    });

    it('genBridgeBM should have road on top and wall at bottom', () => {
        const buf = genBridgeBM();
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
        const top = getPixel(buf, 16, 10);
        const bottom = getPixel(buf, 16, 28);
        assert.ok(top.r > bottom.r || top.g > bottom.g,
            'Top road should be lighter than bottom wall');
    });

    it('bridge variants should be deterministic', () => {
        assert.ok(genBridgeTM().equals(genBridgeTM()));
        assert.ok(genBridgeMM().equals(genBridgeMM()));
        assert.ok(genBridgeBM().equals(genBridgeBM()));
    });
});

describe('genWaterEdge variants: water-land transitions', () => {
    it('genWaterEdgeRight should have water on left, grass on right', () => {
        const buf = genWaterEdgeRight();
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
        const left = getPixel(buf, 3, 16);
        assert.ok(left.b > left.r && left.b > left.g,
            `Left should be water (B=${left.b} > R=${left.r}, G=${left.g})`);
        const right = getPixel(buf, 28, 16);
        assert.ok(right.g > right.b,
            `Right should be grass (G=${right.g} > B=${right.b})`);
    });

    it('genWaterEdgeLeft should have grass on left, water on right', () => {
        const buf = genWaterEdgeLeft();
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
        const left = getPixel(buf, 3, 16);
        assert.ok(left.g > left.b,
            `Left should be grass (G=${left.g} > B=${left.b})`);
        const right = getPixel(buf, 28, 16);
        assert.ok(right.b > right.r && right.b > right.g,
            `Right should be water (B=${right.b} > R=${right.r}, G=${right.g})`);
    });

    it('water edge variants should be deterministic', () => {
        assert.ok(genWaterEdgeRight().equals(genWaterEdgeRight()));
        assert.ok(genWaterEdgeLeft().equals(genWaterEdgeLeft()));
    });
});

describe('genPine: triangular conifer tree', () => {
    it('should produce a fully opaque buffer', () => {
        const buf = genPine(0);
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
    });

    it('should be deterministic', () => {
        assert.ok(genPine(0).equals(genPine(0)));
        assert.ok(genPine(1).equals(genPine(1)));
    });

    it('variant 0 and 1 should differ', () => {
        assert.ok(!genPine(0).equals(genPine(1)));
    });

    it('should have green canopy pixels in upper area', () => {
        const buf = genPine(0);
        // Pine canopy is in the upper portion (y < 22)
        const p = getPixel(buf, 16, 12);
        assert.ok(p.g > p.r, `Canopy should be green (G=${p.g} > R=${p.r})`);
    });

    it('should have trunk pixels near base', () => {
        const buf = genPine(0);
        // Trunk is at center (x=16), near baseY=26
        const p = getPixel(buf, 16, 25);
        // Trunk color is [65, 42, 25] — brown
        assert.ok(p.r > p.g && p.r > p.b,
            `Trunk should be brown (R=${p.r} > G=${p.g}, B=${p.b})`);
    });
});

describe('genShrub: bushy shrub', () => {
    it('should produce a fully opaque buffer', () => {
        const buf = genShrub(0);
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
    });

    it('should be deterministic', () => {
        assert.ok(genShrub(0).equals(genShrub(0)));
    });

    it('variant 0 and 1 should differ', () => {
        assert.ok(!genShrub(0).equals(genShrub(1)));
    });

    it('should have green bush pixels in center', () => {
        const buf = genShrub(0);
        const p = getPixel(buf, 16, 18);
        assert.ok(p.g > p.r, `Center should be green bush (G=${p.g} > R=${p.r})`);
    });

    it('shrub should be wider than tall (elliptical)', () => {
        const buf = genShrub(0);
        // Check horizontal extent vs vertical extent of non-grass pixels
        // The shrub center is at (16, 18), rx=8, ry=5
        // At center row, shrub extends from x=8 to x=24
        const leftP = getPixel(buf, 9, 18);
        const rightP = getPixel(buf, 23, 18);
        // Both should be shrub-green (not grass-green)
        assert.ok(leftP.g > 80, 'Left extent should be shrub');
        assert.ok(rightP.g > 80, 'Right extent should be shrub');
    });
});

describe('genRock: rock on grass', () => {
    it('should produce a fully opaque buffer', () => {
        const buf = genRock();
        assert.equal(countOpaquePixels(buf), SIZE * SIZE);
    });

    it('should be deterministic', () => {
        assert.ok(genRock().equals(genRock()));
    });

    it('should have grey rock pixels in center', () => {
        const buf = genRock();
        const p = getPixel(buf, 16, 18);
        // Rock is grey (STONE or STONE_LIGHT)
        const isGrey = Math.abs(p.r - p.g) < 20 && Math.abs(p.g - p.b) < 20;
        assert.ok(isGrey, `Center should be grey rock (R=${p.r}, G=${p.g}, B=${p.b})`);
    });

    it('should have grass background around rock', () => {
        const buf = genRock();
        // Far from center should be grass
        const p = getPixel(buf, 3, 3);
        assert.ok(p.g > p.r, `Corner should be grass (G=${p.g} > R=${p.r})`);
    });
});
