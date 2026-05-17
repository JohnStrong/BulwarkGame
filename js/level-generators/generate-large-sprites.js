/**
 * Generate multi-tile sprites:
 *   - keep.png (4x4 tiles = 128x128px) - Main castle keep/donjon
 *   - portcullis-large.png (2x2 tiles = 64x64px) - Gatehouse with portcullis
 *   - wall-gate-left.png (32x32) - Wall connecting to left side of gate
 *   - wall-gate-right.png (32x32) - Wall connecting to right side of gate
 *
 * These are rendered as single sprites spanning multiple tiles.
 */

const sharp = require('sharp');
const path = require('path');

const TILE = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Colors
const STONE_BASE = [155, 148, 130];
const STONE_LIGHT = [175, 168, 150];
const STONE_DARK = [110, 105, 92];
const STONE_MORTAR = [125, 118, 105];
const STONE_SHADOW = [85, 80, 72];

const IRON = [55, 55, 60];
const IRON_LIGHT = [80, 80, 85];
const WOOD = [90, 60, 30];
const WOOD_DARK = [65, 42, 20];

const GRASS = [82, 142, 55];

let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }

function setPixel(buf, x, y, w, h, r, g, b) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = (y * w + x) * 4;
    buf[idx] = Math.max(0, Math.min(255, Math.round(r)));
    buf[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[idx + 3] = 255;
}

function fillRect(buf, w, h, x1, y1, x2, y2, color, noise, seedVal) {
    resetSeed(seedVal);
    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * noise;
            setPixel(buf, x, y, w, h, color[0] + n, color[1] + n, color[2] + n);
        }
    }
}

function drawStoneBlocks(buf, w, h, x1, y1, x2, y2, seedVal) {
    resetSeed(seedVal);
    // Horizontal mortar lines
    for (let y = y1; y <= y2; y += 6 + Math.floor(seededRandom() * 3)) {
        for (let x = x1; x <= x2; x++) {
            setPixel(buf, x, y, w, h, ...STONE_MORTAR);
        }
    }
    // Vertical mortar lines (offset per row)
    for (let y = y1; y <= y2; y++) {
        const rowIdx = Math.floor((y - y1) / 7);
        const offset = (rowIdx % 2) * 5;
        for (let x = x1 + offset; x <= x2; x += 10 + Math.floor(seededRandom() * 3)) {
            setPixel(buf, x, y, w, h, ...STONE_MORTAR);
        }
    }
}

// ============ KEEP (4x4 tiles = 128x128) ============

function generateKeep() {
    const S = TILE * 4; // 128
    const buf = Buffer.alloc(S * S * 4);

    // Grass background
    resetSeed(30000);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const n = (seededRandom() - 0.5) * 5;
            setPixel(buf, x, y, S, S, GRASS[0] + n, GRASS[1] + n, GRASS[2] + n);
        }
    }

    // Main keep body (large square with thick walls)
    const margin = 10;
    const outerX1 = margin, outerY1 = margin;
    const outerX2 = S - margin - 1, outerY2 = S - margin - 1;

    // Outer wall
    fillRect(buf, S, S, outerX1, outerY1, outerX2, outerY2, STONE_BASE, 6, 30100);
    drawStoneBlocks(buf, S, S, outerX1, outerY1, outerX2, outerY2, 30200);

    // Dark border
    for (let i = outerX1; i <= outerX2; i++) {
        setPixel(buf, i, outerY1, S, S, ...STONE_DARK);
        setPixel(buf, i, outerY2, S, S, ...STONE_DARK);
        setPixel(buf, i, outerY1 + 1, S, S, ...STONE_SHADOW);
    }
    for (let i = outerY1; i <= outerY2; i++) {
        setPixel(buf, outerX1, i, S, S, ...STONE_DARK);
        setPixel(buf, outerX2, i, S, S, ...STONE_DARK);
    }

    // Inner courtyard (lighter stone floor)
    const innerMargin = 22;
    fillRect(buf, S, S, innerMargin, innerMargin, S - innerMargin, S - innerMargin, STONE_LIGHT, 5, 30300);

    // Corner turrets (small circles at each corner)
    const turretR = 8;
    const corners = [
        [outerX1, outerY1], [outerX2, outerY1],
        [outerX1, outerY2], [outerX2, outerY2]
    ];
    for (let ci = 0; ci < corners.length; ci++) {
        const [cx, cy] = corners[ci];
        resetSeed(30400 + ci * 50);
        for (let dy = -turretR; dy <= turretR; dy++) {
            for (let dx = -turretR; dx <= turretR; dx++) {
                if (dx * dx + dy * dy <= turretR * turretR) {
                    const dist = Math.sqrt(dx * dx + dy * dy) / turretR;
                    const n = (seededRandom() - 0.5) * 5;
                    let color;
                    if (dist > 0.85) color = STONE_DARK;
                    else if (dist > 0.6) color = STONE_BASE;
                    else color = STONE_LIGHT;
                    setPixel(buf, cx + dx, cy + dy, S, S, color[0] + n, color[1] + n, color[2] + n);
                }
            }
        }
        // Battlement dots on turret
        for (let a = 0; a < 8; a++) {
            const angle = (a / 8) * Math.PI * 2;
            const bx = Math.round(cx + Math.cos(angle) * (turretR - 2));
            const by = Math.round(cy + Math.sin(angle) * (turretR - 2));
            setPixel(buf, bx, by, S, S, ...STONE_DARK);
        }
    }

    // Central tower (raised section in middle)
    const centerX = S / 2, centerY = S / 2;
    const towerR = 18;
    fillRect(buf, S, S, centerX - towerR, centerY - towerR, centerX + towerR, centerY + towerR, STONE_BASE, 5, 30500);
    drawStoneBlocks(buf, S, S, centerX - towerR, centerY - towerR, centerX + towerR, centerY + towerR, 30600);

    // Tower border
    for (let i = centerX - towerR; i <= centerX + towerR; i++) {
        setPixel(buf, i, centerY - towerR, S, S, ...STONE_DARK);
        setPixel(buf, i, centerY + towerR, S, S, ...STONE_DARK);
    }
    for (let i = centerY - towerR; i <= centerY + towerR; i++) {
        setPixel(buf, centerX - towerR, i, S, S, ...STONE_DARK);
        setPixel(buf, centerX + towerR, i, S, S, ...STONE_DARK);
    }

    // Tower battlements
    for (let x = centerX - towerR; x <= centerX + towerR; x += 5) {
        fillRect(buf, S, S, x, centerY - towerR - 3, x + 2, centerY - towerR, STONE_BASE, 3, 30700 + x);
        fillRect(buf, S, S, x, centerY + towerR, x + 2, centerY + towerR + 3, STONE_BASE, 3, 30800 + x);
    }

    // Tower inner highlight
    fillRect(buf, S, S, centerX - 10, centerY - 10, centerX + 10, centerY + 10, STONE_LIGHT, 4, 30900);

    // Flag pole on top
    for (let y = centerY - towerR - 8; y <= centerY - towerR; y++) {
        setPixel(buf, centerX, y, S, S, 60, 40, 20);
    }
    // Flag
    fillRect(buf, S, S, centerX + 1, centerY - towerR - 8, centerX + 8, centerY - towerR - 4, [180, 30, 30], 5, 31000);

    return { buf, w: S, h: S };
}

// ============ PORTCULLIS (2x2 tiles = 64x64) ============

function generatePortcullisLarge() {
    const S = TILE * 2; // 64
    const buf = Buffer.alloc(S * S * 4);

    // Grass background
    resetSeed(32000);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const n = (seededRandom() - 0.5) * 5;
            setPixel(buf, x, y, S, S, GRASS[0] + n, GRASS[1] + n, GRASS[2] + n);
        }
    }

    // Gatehouse structure (stone arch)
    const gateX1 = 4, gateY1 = 2, gateX2 = S - 5, gateY2 = S - 3;
    fillRect(buf, S, S, gateX1, gateY1, gateX2, gateY2, STONE_BASE, 5, 32100);
    drawStoneBlocks(buf, S, S, gateX1, gateY1, gateX2, gateY2, 32200);

    // Dark border
    for (let i = gateX1; i <= gateX2; i++) {
        setPixel(buf, i, gateY1, S, S, ...STONE_DARK);
        setPixel(buf, i, gateY2, S, S, ...STONE_DARK);
    }
    for (let i = gateY1; i <= gateY2; i++) {
        setPixel(buf, gateX1, i, S, S, ...STONE_DARK);
        setPixel(buf, gateX2, i, S, S, ...STONE_DARK);
    }

    // Gate opening (dark interior)
    const openX1 = 14, openY1 = 8, openX2 = S - 15, openY2 = S - 8;
    fillRect(buf, S, S, openX1, openY1, openX2, openY2, [30, 25, 20], 3, 32300);

    // Arch top (rounded)
    resetSeed(32350);
    const archCx = S / 2, archCy = openY1 + 2;
    const archR = (openX2 - openX1) / 2;
    for (let dx = -archR; dx <= archR; dx++) {
        const height = Math.round(Math.sqrt(archR * archR - dx * dx) * 0.4);
        for (let dy = 0; dy <= height; dy++) {
            setPixel(buf, archCx + dx, archCy - dy, S, S, ...STONE_BASE);
        }
    }

    // Iron portcullis grate
    for (let x = openX1 + 2; x <= openX2 - 2; x += 4) {
        for (let y = openY1 + 4; y <= openY2 - 2; y++) {
            setPixel(buf, x, y, S, S, ...IRON);
            setPixel(buf, x + 1, y, S, S, ...IRON_LIGHT);
        }
    }
    for (let y = openY1 + 6; y <= openY2 - 2; y += 4) {
        for (let x = openX1 + 2; x <= openX2 - 2; x++) {
            setPixel(buf, x, y, S, S, ...IRON);
        }
    }

    // Gatehouse towers (small turrets on each side)
    const turretR = 6;
    const turrets = [[gateX1 + 2, S / 2], [gateX2 - 2, S / 2]];
    for (let ti = 0; ti < turrets.length; ti++) {
        const [tx, ty] = turrets[ti];
        resetSeed(32400 + ti * 50);
        for (let dy = -turretR; dy <= turretR; dy++) {
            for (let dx = -turretR; dx <= turretR; dx++) {
                if (dx * dx + dy * dy <= turretR * turretR) {
                    const n = (seededRandom() - 0.5) * 4;
                    const dist = Math.sqrt(dx*dx+dy*dy)/turretR;
                    const c = dist > 0.8 ? STONE_DARK : STONE_LIGHT;
                    setPixel(buf, tx + dx, ty + dy, S, S, c[0] + n, c[1] + n, c[2] + n);
                }
            }
        }
    }

    // Battlements on top
    for (let x = gateX1; x <= gateX2; x += 5) {
        fillRect(buf, S, S, x, gateY1 - 3, x + 2, gateY1, STONE_BASE, 3, 32500 + x);
    }

    return { buf, w: S, h: S };
}

// ============ WALL-GATE CONNECTORS (32x32) ============

function generateWallGateLeft() {
    const buf = Buffer.alloc(TILE * TILE * 4);

    // Grass background
    resetSeed(33000);
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const n = (seededRandom() - 0.5) * 5;
            setPixel(buf, x, y, TILE, TILE, GRASS[0] + n, GRASS[1] + n, GRASS[2] + n);
        }
    }

    // Wall running left to right, connecting to gate on the right edge
    // Wall is full width, thickens slightly on right to meet gatehouse
    const wallTop = 11, wallBot = 20;
    fillRect(buf, TILE, TILE, 0, wallTop, 31, wallBot, STONE_BASE, 5, 33100);
    drawStoneBlocks(buf, TILE, TILE, 0, wallTop, 31, wallBot, 33200);

    // Top/bottom edges
    for (let x = 0; x < TILE; x++) {
        setPixel(buf, x, wallTop, TILE, TILE, ...STONE_DARK);
        setPixel(buf, x, wallBot, TILE, TILE, ...STONE_DARK);
        setPixel(buf, x, wallTop + 1, TILE, TILE, ...STONE_LIGHT);
    }

    // Right edge thickens to meet gatehouse (wider on right)
    fillRect(buf, TILE, TILE, 28, wallTop - 3, 31, wallBot + 3, STONE_BASE, 4, 33300);
    for (let y = wallTop - 3; y <= wallBot + 3; y++) {
        setPixel(buf, 31, y, TILE, TILE, ...STONE_DARK);
    }

    return { buf, w: TILE, h: TILE };
}

function generateWallGateRight() {
    const buf = Buffer.alloc(TILE * TILE * 4);

    resetSeed(34000);
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const n = (seededRandom() - 0.5) * 5;
            setPixel(buf, x, y, TILE, TILE, GRASS[0] + n, GRASS[1] + n, GRASS[2] + n);
        }
    }

    const wallTop = 11, wallBot = 20;
    fillRect(buf, TILE, TILE, 0, wallTop, 31, wallBot, STONE_BASE, 5, 34100);
    drawStoneBlocks(buf, TILE, TILE, 0, wallTop, 31, wallBot, 34200);

    for (let x = 0; x < TILE; x++) {
        setPixel(buf, x, wallTop, TILE, TILE, ...STONE_DARK);
        setPixel(buf, x, wallBot, TILE, TILE, ...STONE_DARK);
        setPixel(buf, x, wallTop + 1, TILE, TILE, ...STONE_LIGHT);
    }

    // Left edge thickens to meet gatehouse
    fillRect(buf, TILE, TILE, 0, wallTop - 3, 3, wallBot + 3, STONE_BASE, 4, 34300);
    for (let y = wallTop - 3; y <= wallBot + 3; y++) {
        setPixel(buf, 0, y, TILE, TILE, ...STONE_DARK);
    }

    return { buf, w: TILE, h: TILE };
}

// ============ MAIN ============

async function generateAll() {
    const sprites = [
        { name: 'keep', ...generateKeep() },
        { name: 'portcullis-large', ...generatePortcullisLarge() },
        { name: 'wall-gate-left', ...generateWallGateLeft() },
        { name: 'wall-gate-right', ...generateWallGateRight() },
    ];

    for (const sprite of sprites) {
        await sharp(sprite.buf, { raw: { width: sprite.w, height: sprite.h, channels: 4 } })
            .png().toFile(path.join(OUTPUT_DIR, `${sprite.name}.png`));
        console.log(`  ✓ ${sprite.name}.png (${sprite.w}x${sprite.h})`);
    }
    console.log('\nDone!');
}

generateAll().catch(err => { console.error(err); process.exit(1); });
