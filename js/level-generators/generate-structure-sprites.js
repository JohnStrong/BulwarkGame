/**
 * Generate medieval structure and nature sprites (32x32, top-down view).
 *
 * Nature:
 *   - oak-tree (x3): Oak tree canopy on grass background (round, leafy)
 *
 * Structures (all on grass background):
 *   - wall-h: Horizontal stone wall segment
 *   - wall-v: Vertical stone wall segment
 *   - tower: Corner/guard tower (square with battlements)
 *   - battlement: Wall with crenellations on top
 *   - portcullis: Gate/entrance with iron grate
 *   - hut (x2): Small thatched-roof peasant hut
 *   - bailey: Open courtyard cobblestone
 *
 * All sprites have the meadow grass as background so they sit naturally on the map.
 */

const sharp = require('sharp');
const path = require('path');

const SIZE = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Background grass color (matches grass-short)
const GRASS = [82, 142, 55];
const GRASS_N = 5; // noise amount

// Oak tree colors
const OAK_TRUNK = [65, 45, 25];
const OAK_CANOPY_DARK = [35, 80, 30];
const OAK_CANOPY_MID = [50, 105, 40];
const OAK_CANOPY_LIGHT = [68, 130, 52];
const OAK_HIGHLIGHT = [85, 150, 60];
const OAK_SHADOW = [25, 60, 20];

// Stone wall colors
const STONE_BASE = [130, 125, 115];
const STONE_LIGHT = [150, 145, 135];
const STONE_DARK = [95, 90, 82];
const STONE_MORTAR = [110, 105, 95];

// Hut colors
const THATCH_BASE = [155, 125, 60];
const THATCH_LIGHT = [175, 145, 75];
const THATCH_DARK = [120, 95, 45];
const HUT_WALL = [180, 165, 130];
const HUT_WALL_DARK = [145, 130, 100];

// Iron/metal
const IRON = [60, 60, 65];
const IRON_LIGHT = [85, 85, 90];

// Bailey/courtyard
const COBBLE_BASE = [140, 130, 110];
const COBBLE_LIGHT = [160, 150, 130];
const COBBLE_DARK = [110, 100, 85];

let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }

function createBuffer() { return Buffer.alloc(SIZE * SIZE * 4); }

function setPixel(buf, x, y, r, g, b, a = 255) {
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    const idx = (y * SIZE + x) * 4;
    buf[idx] = Math.max(0, Math.min(255, Math.round(r)));
    buf[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[idx + 3] = a;
}

function fillGrass(buf, seedVal) {
    resetSeed(seedVal);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * GRASS_N;
            setPixel(buf, x, y, GRASS[0] + n, GRASS[1] + n, GRASS[2] + n);
        }
    }
}

function fillCobble(buf, seedVal) {
    resetSeed(seedVal);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            // Cobblestone pattern: grid of rounded stones
            const gx = x % 8, gy = y % 8;
            const onEdge = gx === 0 || gy === 0;
            const n = (seededRandom() - 0.5) * 8;
            if (onEdge) {
                setPixel(buf, x, y, COBBLE_DARK[0] + n, COBBLE_DARK[1] + n, COBBLE_DARK[2] + n);
            } else {
                const light = ((Math.floor(x/8) + Math.floor(y/8)) % 2 === 0);
                const c = light ? COBBLE_LIGHT : COBBLE_BASE;
                setPixel(buf, x, y, c[0] + n, c[1] + n, c[2] + n);
            }
        }
    }
}

function drawCircle(buf, cx, cy, radius, color, noise, seedVal) {
    resetSeed(seedVal);
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius) {
                const n = (seededRandom() - 0.5) * noise;
                setPixel(buf, cx + dx, cy + dy, color[0] + n, color[1] + n, color[2] + n);
            }
        }
    }
}

function drawRect(buf, x1, y1, x2, y2, color, noise, seedVal) {
    resetSeed(seedVal);
    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * noise;
            setPixel(buf, x, y, color[0] + n, color[1] + n, color[2] + n);
        }
    }
}

// ============ OAK TREE ============

function generateOakTree(variant) {
    const buf = createBuffer();
    fillGrass(buf, 10000 + variant * 100);

    resetSeed(10050 + variant * 100);

    // Shadow on grass (offset down-right)
    const shadowCx = 17 + Math.floor(seededRandom() * 2);
    const shadowCy = 18 + Math.floor(seededRandom() * 2);
    drawCircle(buf, shadowCx, shadowCy, 10, OAK_SHADOW, 3, 10100 + variant * 100);

    // Trunk (small, mostly hidden by canopy)
    const trunkX = 15 + Math.floor(seededRandom() * 2);
    const trunkY = 16;
    drawRect(buf, trunkX, trunkY + 2, trunkX + 2, trunkY + 6, OAK_TRUNK, 4, 10150 + variant * 100);

    // Main canopy (large irregular circle)
    const canopyR = 9 + Math.floor(seededRandom() * 2);
    drawCircle(buf, 16, 14, canopyR, OAK_CANOPY_MID, 6, 10200 + variant * 100);

    // Darker edges
    resetSeed(10300 + variant * 100);
    for (let dy = -canopyR; dy <= canopyR; dy++) {
        for (let dx = -canopyR; dx <= canopyR; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > canopyR * 0.7 && dist <= canopyR) {
                const px = 16 + dx, py = 14 + dy;
                if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
                    const n = (seededRandom() - 0.5) * 4;
                    setPixel(buf, px, py, OAK_CANOPY_DARK[0] + n, OAK_CANOPY_DARK[1] + n, OAK_CANOPY_DARK[2] + n);
                }
            }
        }
    }

    // Light patches (sun hitting top of canopy)
    resetSeed(10400 + variant * 100);
    for (let i = 0; i < 5; i++) {
        const lx = 12 + Math.floor(seededRandom() * 8);
        const ly = 9 + Math.floor(seededRandom() * 7);
        const lr = 2 + Math.floor(seededRandom() * 2);
        drawCircle(buf, lx, ly, lr, OAK_HIGHLIGHT, 4, 10500 + variant * 100 + i * 10);
    }

    // Canopy texture dots
    resetSeed(10600 + variant * 100);
    for (let i = 0; i < 15; i++) {
        const x = 8 + Math.floor(seededRandom() * 16);
        const y = 6 + Math.floor(seededRandom() * 14);
        const dist = Math.sqrt((x-16)*(x-16) + (y-14)*(y-14));
        if (dist < canopyR) {
            const c = seededRandom() > 0.5 ? OAK_CANOPY_LIGHT : OAK_CANOPY_DARK;
            setPixel(buf, x, y, ...c);
            setPixel(buf, x+1, y, ...c);
        }
    }

    return buf;
}

// ============ WALL HORIZONTAL ============

function generateWallH() {
    const buf = createBuffer();
    fillGrass(buf, 20000);

    // Horizontal wall: runs left-right, 6px tall in center
    const wallTop = 13;
    const wallBot = 18;
    drawRect(buf, 0, wallTop, 31, wallBot, STONE_BASE, 6, 20100);

    // Stone block pattern
    resetSeed(20200);
    for (let y = wallTop; y <= wallBot; y++) {
        const offset = (y % 2 === 0) ? 0 : 5;
        for (let x = offset; x < SIZE; x += 10) {
            // Mortar lines
            for (let my = wallTop; my <= wallBot; my++) {
                setPixel(buf, x, my, ...STONE_MORTAR);
            }
        }
        for (let x = 0; x < SIZE; x++) {
            setPixel(buf, x, wallTop, ...STONE_DARK);
            setPixel(buf, x, wallBot, ...STONE_DARK);
        }
    }

    // Top highlight
    for (let x = 0; x < SIZE; x++) {
        setPixel(buf, x, wallTop + 1, ...STONE_LIGHT);
    }

    return buf;
}

// ============ WALL VERTICAL ============

function generateWallV() {
    const buf = createBuffer();
    fillGrass(buf, 21000);

    const wallLeft = 13;
    const wallRight = 18;
    drawRect(buf, wallLeft, 0, wallRight, 31, STONE_BASE, 6, 21100);

    // Stone pattern
    resetSeed(21200);
    for (let x = wallLeft; x <= wallRight; x++) {
        const offset = (x % 2 === 0) ? 0 : 5;
        for (let y = offset; y < SIZE; y += 10) {
            for (let mx = wallLeft; mx <= wallRight; mx++) {
                setPixel(buf, mx, y, ...STONE_MORTAR);
            }
        }
        setPixel(buf, wallLeft, x, ...STONE_DARK);
        setPixel(buf, wallRight, x, ...STONE_DARK);
    }
    for (let y = 0; y < SIZE; y++) {
        setPixel(buf, wallLeft, y, ...STONE_DARK);
        setPixel(buf, wallRight, y, ...STONE_DARK);
        setPixel(buf, wallLeft + 1, y, ...STONE_LIGHT);
    }

    return buf;
}

// ============ TOWER ============

function generateTower() {
    const buf = createBuffer();
    fillGrass(buf, 22000);

    // Square tower base (larger than wall)
    drawRect(buf, 6, 6, 25, 25, STONE_BASE, 5, 22100);

    // Darker border
    for (let i = 6; i <= 25; i++) {
        setPixel(buf, 6, i, ...STONE_DARK); setPixel(buf, 25, i, ...STONE_DARK);
        setPixel(buf, i, 6, ...STONE_DARK); setPixel(buf, i, 25, ...STONE_DARK);
    }

    // Battlements (crenellations on top)
    for (let x = 6; x <= 25; x += 4) {
        drawRect(buf, x, 4, x + 1, 6, STONE_BASE, 3, 22200 + x);
        drawRect(buf, x, 25, x + 1, 27, STONE_BASE, 3, 22300 + x);
    }
    for (let y = 6; y <= 25; y += 4) {
        drawRect(buf, 4, y, 6, y + 1, STONE_BASE, 3, 22400 + y);
        drawRect(buf, 25, y, 27, y + 1, STONE_BASE, 3, 22500 + y);
    }

    // Inner highlight
    drawRect(buf, 10, 10, 21, 21, STONE_LIGHT, 4, 22600);

    // Center mark (arrow slit or flag)
    setPixel(buf, 15, 15, ...STONE_DARK);
    setPixel(buf, 16, 15, ...STONE_DARK);
    setPixel(buf, 15, 16, ...STONE_DARK);
    setPixel(buf, 16, 16, ...STONE_DARK);

    return buf;
}

// ============ BATTLEMENT ============

function generateBattlement() {
    const buf = createBuffer();
    fillGrass(buf, 23000);

    // Wall base
    drawRect(buf, 0, 11, 31, 20, STONE_BASE, 5, 23100);
    for (let x = 0; x < SIZE; x++) {
        setPixel(buf, x, 11, ...STONE_DARK);
        setPixel(buf, x, 20, ...STONE_DARK);
        setPixel(buf, x, 12, ...STONE_LIGHT);
    }

    // Crenellations (merlons) on top
    for (let x = 0; x < SIZE; x += 6) {
        drawRect(buf, x, 8, x + 3, 11, STONE_BASE, 4, 23200 + x);
        setPixel(buf, x, 8, ...STONE_DARK);
        setPixel(buf, x + 3, 8, ...STONE_DARK);
        for (let cx = x; cx <= x + 3; cx++) setPixel(buf, cx, 8, ...STONE_DARK);
        for (let cx = x; cx <= x + 3; cx++) setPixel(buf, cx, 9, ...STONE_LIGHT);
    }

    return buf;
}

// ============ PORTCULLIS ============

function generatePortcullis() {
    const buf = createBuffer();
    fillGrass(buf, 24000);

    // Gate arch (stone surround)
    drawRect(buf, 4, 4, 27, 27, STONE_BASE, 5, 24100);
    // Inner opening
    drawRect(buf, 8, 8, 23, 27, [40, 35, 30], 3, 24200); // dark interior

    // Iron grate bars
    for (let x = 9; x <= 22; x += 3) {
        for (let y = 8; y <= 27; y++) {
            setPixel(buf, x, y, ...IRON);
            setPixel(buf, x + 1, y, ...IRON_LIGHT);
        }
    }
    for (let y = 10; y <= 26; y += 3) {
        for (let x = 8; x <= 23; x++) {
            setPixel(buf, x, y, ...IRON);
        }
    }

    // Stone border
    for (let i = 4; i <= 27; i++) {
        setPixel(buf, 4, i, ...STONE_DARK); setPixel(buf, 27, i, ...STONE_DARK);
        setPixel(buf, i, 4, ...STONE_DARK); setPixel(buf, i, 27, ...STONE_DARK);
    }

    return buf;
}

// ============ HUT ============

function generateHut(variant) {
    const buf = createBuffer();
    fillGrass(buf, 25000 + variant * 200);

    resetSeed(25050 + variant * 200);
    const offsetX = Math.floor(seededRandom() * 2);
    const offsetY = Math.floor(seededRandom() * 2);

    // Hut base (walls visible at bottom)
    const bx = 8 + offsetX, by = 14 + offsetY;
    const bw = 16, bh = 12;
    drawRect(buf, bx, by, bx + bw, by + bh, HUT_WALL, 5, 25100 + variant * 200);
    // Wall shadow
    drawRect(buf, bx, by + bh - 2, bx + bw, by + bh, HUT_WALL_DARK, 4, 25150 + variant * 200);

    // Thatched roof (larger than walls, overhangs)
    const rx = bx - 2, ry = by - 6;
    const rw = bw + 4, rh = bh - 2;
    drawRect(buf, rx, ry, rx + rw, ry + rh, THATCH_BASE, 6, 25200 + variant * 200);

    // Roof ridge (lighter center line)
    for (let x = rx; x <= rx + rw; x++) {
        setPixel(buf, x, ry + Math.floor(rh / 2), ...THATCH_LIGHT);
        setPixel(buf, x, ry + Math.floor(rh / 2) - 1, ...THATCH_LIGHT);
    }

    // Roof edges (darker)
    for (let x = rx; x <= rx + rw; x++) {
        setPixel(buf, x, ry, ...THATCH_DARK);
        setPixel(buf, x, ry + rh, ...THATCH_DARK);
    }
    for (let y = ry; y <= ry + rh; y++) {
        setPixel(buf, rx, y, ...THATCH_DARK);
        setPixel(buf, rx + rw, y, ...THATCH_DARK);
    }

    // Roof texture (thatch lines)
    resetSeed(25300 + variant * 200);
    for (let i = 0; i < 8; i++) {
        const lx = rx + 2 + Math.floor(seededRandom() * (rw - 4));
        const ly = ry + 1 + Math.floor(seededRandom() * (rh - 2));
        const len = 2 + Math.floor(seededRandom() * 3);
        for (let d = 0; d < len; d++) {
            const c = seededRandom() > 0.5 ? THATCH_LIGHT : THATCH_DARK;
            setPixel(buf, lx + d, ly, ...c);
        }
    }

    // Door (tiny dark rectangle)
    if (variant === 0) {
        drawRect(buf, bx + 6, by + bh - 4, bx + 8, by + bh, [50, 35, 20], 3, 25400);
    }

    return buf;
}

// ============ BAILEY ============

function generateBailey() {
    const buf = createBuffer();
    fillCobble(buf, 26000);
    return buf;
}

// ============ MAIN ============

async function generateAll() {
    const sprites = [];

    // Oak trees
    for (let i = 0; i < 3; i++) {
        sprites.push({ name: `oak-tree-${i + 1}`, gen: () => generateOakTree(i) });
    }

    // Structures
    sprites.push({ name: 'wall-h', gen: generateWallH });
    sprites.push({ name: 'wall-v', gen: generateWallV });
    sprites.push({ name: 'tower', gen: generateTower });
    sprites.push({ name: 'battlement', gen: generateBattlement });
    sprites.push({ name: 'portcullis', gen: generatePortcullis });
    sprites.push({ name: 'hut-1', gen: () => generateHut(0) });
    sprites.push({ name: 'hut-2', gen: () => generateHut(1) });
    sprites.push({ name: 'bailey', gen: generateBailey });

    for (const sprite of sprites) {
        const buf = sprite.gen();
        await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 4 } })
            .png().toFile(path.join(OUTPUT_DIR, `${sprite.name}.png`));
        console.log(`  ✓ ${sprite.name}.png`);
    }
    console.log(`\nDone! ${sprites.length} structure/nature sprites.`);
}

generateAll().catch(err => { console.error(err); process.exit(1); });
