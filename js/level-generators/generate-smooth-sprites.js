/**
 * Generate smooth, clean sprites matching the reference tower defense style:
 *   - Bright, flat green grass with subtle texture
 *   - Warm orange/sandy dirt road (smooth, rounded edges)
 *   - Soft teal/cyan river water
 *   - Round, smooth tree canopies (dark green blobs with highlights)
 *   - Small grey rock/pebble decorations
 *
 * All sprites are 32x32 (1x1 tile). The style is clean and smooth
 * with minimal noise — more like vector art than pixel art.
 */

const sharp = require('sharp');
const path = require('path');

const SIZE = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Clean, bright palette matching the reference
const GRASS_COLOR = [95, 180, 72];        // bright green
const GRASS_DETAIL = [85, 165, 62];       // slightly darker grass speck

const ROAD_COLOR = [210, 165, 110];       // warm sandy orange
const ROAD_EDGE = [185, 140, 90];         // road border (slightly darker)
const ROAD_SPECK = [190, 150, 100];       // pebble on road

const WATER_COLOR = [130, 210, 210];      // soft teal/cyan
const WATER_LIGHT = [150, 225, 225];      // light ripple
const WATER_DARK = [110, 190, 195];       // darker area
const WATER_EDGE = [100, 175, 170];       // shoreline edge

const TREE_DARK = [40, 110, 45];          // tree shadow
const TREE_MID = [55, 140, 58];           // main canopy
const TREE_LIGHT = [75, 165, 72];         // highlight
const TREE_SHADOW = [65, 145, 55];        // ground shadow under tree

const ROCK_COLOR = [140, 140, 135];       // small grey rocks
const ROCK_DARK = [115, 115, 110];

let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }

function createBuffer() { return Buffer.alloc(SIZE * SIZE * 4); }

function setPixel(buf, x, y, r, g, b) {
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    const idx = (y * SIZE + x) * 4;
    buf[idx] = Math.max(0, Math.min(255, Math.round(r)));
    buf[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[idx + 3] = 255;
}

function fillSmooth(buf, color, noise, seedVal) {
    resetSeed(seedVal);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * noise;
            setPixel(buf, x, y, color[0] + n, color[1] + n, color[2] + n);
        }
    }
}

// ============ GRASS ============
function generateGrass(variant) {
    const buf = createBuffer();
    fillSmooth(buf, GRASS_COLOR, 4, 70000 + variant * 100);
    // Very subtle darker specks
    resetSeed(70050 + variant * 100);
    for (let i = 0; i < 8; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        setPixel(buf, x, y, ...GRASS_DETAIL);
    }
    return buf;
}

// ============ GRASS WITH FLOWERS ============
function generateGrassFlowers(variant) {
    const buf = createBuffer();
    fillSmooth(buf, GRASS_COLOR, 4, 71000 + variant * 100);
    // Small flower dots
    resetSeed(71050 + variant * 100);
    const colors = [[220, 220, 210], [200, 180, 220], [220, 200, 100]];
    for (let i = 0; i < 5; i++) {
        const x = 4 + Math.floor(seededRandom() * 24);
        const y = 4 + Math.floor(seededRandom() * 24);
        const c = colors[Math.floor(seededRandom() * colors.length)];
        setPixel(buf, x, y, ...c);
        setPixel(buf, x + 1, y, ...c);
    }
    return buf;
}

// ============ ROAD ============
function generateRoad() {
    const buf = createBuffer();
    fillSmooth(buf, ROAD_COLOR, 3, 72000);
    // Subtle pebble specks
    resetSeed(72050);
    for (let i = 0; i < 12; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        setPixel(buf, x, y, ...ROAD_SPECK);
    }
    return buf;
}

// Road with grass on left (road on right side)
function generateRoadEdgeLeft() {
    const buf = createBuffer();
    resetSeed(72100);
    for (let y = 0; y < SIZE; y++) {
        const edge = 14 + Math.round(Math.sin(y * 0.15) * 1.5);
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * 3;
            if (x < edge - 1) {
                setPixel(buf, x, y, GRASS_COLOR[0] + n, GRASS_COLOR[1] + n, GRASS_COLOR[2] + n);
            } else if (x < edge + 1) {
                setPixel(buf, x, y, ROAD_EDGE[0] + n, ROAD_EDGE[1] + n, ROAD_EDGE[2] + n);
            } else {
                setPixel(buf, x, y, ROAD_COLOR[0] + n, ROAD_COLOR[1] + n, ROAD_COLOR[2] + n);
            }
        }
    }
    return buf;
}

// Road with grass on right (road on left side)
function generateRoadEdgeRight() {
    const buf = createBuffer();
    resetSeed(72200);
    for (let y = 0; y < SIZE; y++) {
        const edge = 17 + Math.round(Math.sin(y * 0.15 + 1) * 1.5);
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * 3;
            if (x > edge + 1) {
                setPixel(buf, x, y, GRASS_COLOR[0] + n, GRASS_COLOR[1] + n, GRASS_COLOR[2] + n);
            } else if (x > edge - 1) {
                setPixel(buf, x, y, ROAD_EDGE[0] + n, ROAD_EDGE[1] + n, ROAD_EDGE[2] + n);
            } else {
                setPixel(buf, x, y, ROAD_COLOR[0] + n, ROAD_COLOR[1] + n, ROAD_COLOR[2] + n);
            }
        }
    }
    return buf;
}

// Road with grass on top (road on bottom)
function generateRoadEdgeTop() {
    const buf = createBuffer();
    resetSeed(72300);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const edge = 14 + Math.round(Math.sin(x * 0.15) * 1.5);
            const n = (seededRandom() - 0.5) * 3;
            if (y < edge - 1) {
                setPixel(buf, x, y, GRASS_COLOR[0] + n, GRASS_COLOR[1] + n, GRASS_COLOR[2] + n);
            } else if (y < edge + 1) {
                setPixel(buf, x, y, ROAD_EDGE[0] + n, ROAD_EDGE[1] + n, ROAD_EDGE[2] + n);
            } else {
                setPixel(buf, x, y, ROAD_COLOR[0] + n, ROAD_COLOR[1] + n, ROAD_COLOR[2] + n);
            }
        }
    }
    return buf;
}

// Road with grass on bottom (road on top)
function generateRoadEdgeBottom() {
    const buf = createBuffer();
    resetSeed(72400);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const edge = 17 + Math.round(Math.sin(x * 0.15 + 1) * 1.5);
            const n = (seededRandom() - 0.5) * 3;
            if (y > edge + 1) {
                setPixel(buf, x, y, GRASS_COLOR[0] + n, GRASS_COLOR[1] + n, GRASS_COLOR[2] + n);
            } else if (y > edge - 1) {
                setPixel(buf, x, y, ROAD_EDGE[0] + n, ROAD_EDGE[1] + n, ROAD_EDGE[2] + n);
            } else {
                setPixel(buf, x, y, ROAD_COLOR[0] + n, ROAD_COLOR[1] + n, ROAD_COLOR[2] + n);
            }
        }
    }
    return buf;
}

// Road corner (top-left: road in bottom-right quadrant)
function generateRoadCornerTL() {
    const buf = createBuffer();
    resetSeed(72500);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const dist = Math.sqrt((x - 0) * (x - 0) + (y - 0) * (y - 0));
            const edge = 18;
            const n = (seededRandom() - 0.5) * 3;
            if (dist < edge - 1) {
                setPixel(buf, x, y, GRASS_COLOR[0] + n, GRASS_COLOR[1] + n, GRASS_COLOR[2] + n);
            } else if (dist < edge + 1) {
                setPixel(buf, x, y, ROAD_EDGE[0] + n, ROAD_EDGE[1] + n, ROAD_EDGE[2] + n);
            } else {
                setPixel(buf, x, y, ROAD_COLOR[0] + n, ROAD_COLOR[1] + n, ROAD_COLOR[2] + n);
            }
        }
    }
    return buf;
}

// Road corner (top-right: road in bottom-left quadrant)
function generateRoadCornerTR() {
    const buf = createBuffer();
    resetSeed(72600);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const dist = Math.sqrt((x - 31) * (x - 31) + (y - 0) * (y - 0));
            const edge = 18;
            const n = (seededRandom() - 0.5) * 3;
            if (dist < edge - 1) {
                setPixel(buf, x, y, GRASS_COLOR[0] + n, GRASS_COLOR[1] + n, GRASS_COLOR[2] + n);
            } else if (dist < edge + 1) {
                setPixel(buf, x, y, ROAD_EDGE[0] + n, ROAD_EDGE[1] + n, ROAD_EDGE[2] + n);
            } else {
                setPixel(buf, x, y, ROAD_COLOR[0] + n, ROAD_COLOR[1] + n, ROAD_COLOR[2] + n);
            }
        }
    }
    return buf;
}

// Road corner (bottom-left)
function generateRoadCornerBL() {
    const buf = createBuffer();
    resetSeed(72700);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const dist = Math.sqrt((x - 0) * (x - 0) + (y - 31) * (y - 31));
            const edge = 18;
            const n = (seededRandom() - 0.5) * 3;
            if (dist < edge - 1) {
                setPixel(buf, x, y, GRASS_COLOR[0] + n, GRASS_COLOR[1] + n, GRASS_COLOR[2] + n);
            } else if (dist < edge + 1) {
                setPixel(buf, x, y, ROAD_EDGE[0] + n, ROAD_EDGE[1] + n, ROAD_EDGE[2] + n);
            } else {
                setPixel(buf, x, y, ROAD_COLOR[0] + n, ROAD_COLOR[1] + n, ROAD_COLOR[2] + n);
            }
        }
    }
    return buf;
}

// Road corner (bottom-right)
function generateRoadCornerBR() {
    const buf = createBuffer();
    resetSeed(72800);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const dist = Math.sqrt((x - 31) * (x - 31) + (y - 31) * (y - 31));
            const edge = 18;
            const n = (seededRandom() - 0.5) * 3;
            if (dist < edge - 1) {
                setPixel(buf, x, y, GRASS_COLOR[0] + n, GRASS_COLOR[1] + n, GRASS_COLOR[2] + n);
            } else if (dist < edge + 1) {
                setPixel(buf, x, y, ROAD_EDGE[0] + n, ROAD_EDGE[1] + n, ROAD_EDGE[2] + n);
            } else {
                setPixel(buf, x, y, ROAD_COLOR[0] + n, ROAD_COLOR[1] + n, ROAD_COLOR[2] + n);
            }
        }
    }
    return buf;
}

// ============ WATER ============
function generateWater(variant) {
    const buf = createBuffer();
    fillSmooth(buf, WATER_COLOR, 3, 73000 + variant * 100);
    // Soft ripple highlights
    resetSeed(73050 + variant * 100);
    for (let i = 0; i < 6; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        const len = 3 + Math.floor(seededRandom() * 4);
        for (let d = 0; d < len; d++) {
            setPixel(buf, x + d, y, ...WATER_LIGHT);
        }
    }
    return buf;
}

// Water edge (water on LEFT side, grass on RIGHT - for river on left side of map)
function generateWaterEdgeRight() {
    const buf = createBuffer();
    resetSeed(73200);
    for (let y = 0; y < SIZE; y++) {
        const edge = 16 + Math.round(Math.sin(y * 0.2) * 2);
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * 3;
            if (x > edge + 2) {
                setPixel(buf, x, y, GRASS_COLOR[0] + n, GRASS_COLOR[1] + n, GRASS_COLOR[2] + n);
            } else if (x > edge) {
                setPixel(buf, x, y, WATER_EDGE[0] + n, WATER_EDGE[1] + n, WATER_EDGE[2] + n);
            } else {
                setPixel(buf, x, y, WATER_COLOR[0] + n, WATER_COLOR[1] + n, WATER_COLOR[2] + n);
            }
        }
    }
    return buf;
}

// Water edge (water on RIGHT side, grass on LEFT - for right bank of river)
function generateWaterEdgeLeft() {
    const buf = createBuffer();
    resetSeed(73300);
    for (let y = 0; y < SIZE; y++) {
        const edge = 15 + Math.round(Math.sin(y * 0.2 + 1) * 2);
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * 3;
            if (x < edge - 2) {
                setPixel(buf, x, y, GRASS_COLOR[0] + n, GRASS_COLOR[1] + n, GRASS_COLOR[2] + n);
            } else if (x < edge) {
                setPixel(buf, x, y, WATER_EDGE[0] + n, WATER_EDGE[1] + n, WATER_EDGE[2] + n);
            } else {
                setPixel(buf, x, y, WATER_COLOR[0] + n, WATER_COLOR[1] + n, WATER_COLOR[2] + n);
            }
        }
    }
    return buf;
}

// ============ TREE (on grass background) ============
function generateTree(variant) {
    const buf = createBuffer();
    fillSmooth(buf, GRASS_COLOR, 3, 74000 + variant * 100);

    const cx = 16, cy = 14;
    const r = 9 + (variant % 2);

    // Ground shadow
    resetSeed(74050 + variant * 100);
    for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            const dist = (dx * dx) / (r * r) + (dy * dy) / 16;
            if (dist < 1) {
                const n = (seededRandom() - 0.5) * 2;
                setPixel(buf, cx + dx + 2, cy + r + dy, TREE_SHADOW[0] + n, TREE_SHADOW[1] + n, TREE_SHADOW[2] + n);
            }
        }
    }

    // Main canopy (smooth circle)
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= r) {
                const n = (seededRandom() - 0.5) * 4;
                let color;
                if (dist < r * 0.4 && dy < 0) {
                    color = TREE_LIGHT; // highlight on top
                } else if (dist > r * 0.75) {
                    color = TREE_DARK; // edge shadow
                } else {
                    color = TREE_MID;
                }
                setPixel(buf, cx + dx, cy + dy, color[0] + n, color[1] + n, color[2] + n);
            }
        }
    }

    return buf;
}

// ============ ROCK (small decoration on grass) ============
function generateRock() {
    const buf = createBuffer();
    fillSmooth(buf, GRASS_COLOR, 3, 75000);
    // Small grey rock blob
    const cx = 16, cy = 18, r = 4;
    resetSeed(75050);
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy <= r * r) {
                const n = (seededRandom() - 0.5) * 5;
                const color = (dy < 0) ? ROCK_COLOR : ROCK_DARK;
                setPixel(buf, cx + dx, cy + dy, color[0] + n, color[1] + n, color[2] + n);
            }
        }
    }
    return buf;
}

// ============ MAIN ============
async function generateAll() {
    const sprites = [
        // Grass
        { name: 'grass-short-1', buf: generateGrass(0) },
        { name: 'grass-short-2', buf: generateGrass(1) },
        { name: 'grass-flowers-1', buf: generateGrassFlowers(0) },
        { name: 'grass-flowers-2', buf: generateGrassFlowers(1) },

        // Road
        { name: 'road-full', buf: generateRoad() },
        { name: 'road-edge-left', buf: generateRoadEdgeLeft() },
        { name: 'road-edge-right', buf: generateRoadEdgeRight() },
        { name: 'road-edge-top', buf: generateRoadEdgeTop() },
        { name: 'road-edge-bottom', buf: generateRoadEdgeBottom() },
        { name: 'road-corner-tl', buf: generateRoadCornerTL() },
        { name: 'road-corner-tr', buf: generateRoadCornerTR() },
        { name: 'road-corner-bl', buf: generateRoadCornerBL() },
        { name: 'road-corner-br', buf: generateRoadCornerBR() },

        // Water
        { name: 'water-1', buf: generateWater(0) },
        { name: 'water-2', buf: generateWater(1) },
        { name: 'water-3', buf: generateWater(2) },
        { name: 'water-land-right', buf: generateWaterEdgeRight() },
        { name: 'water-land-left', buf: generateWaterEdgeLeft() },

        // Trees
        { name: 'tree-1', buf: generateTree(0) },
        { name: 'tree-2', buf: generateTree(1) },
        { name: 'tree-3', buf: generateTree(2) },

        // Rock decoration
        { name: 'rock', buf: generateRock() },
    ];

    for (const sprite of sprites) {
        await sharp(sprite.buf, { raw: { width: SIZE, height: SIZE, channels: 4 } })
            .png().toFile(path.join(OUTPUT_DIR, `${sprite.name}.png`));
        console.log(`  ✓ ${sprite.name}.png`);
    }
    console.log(`\nDone! ${sprites.length} smooth sprites.`);
}

generateAll().catch(err => { console.error(err); process.exit(1); });
