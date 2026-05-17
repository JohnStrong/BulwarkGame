/**
 * Generate castle sprites in a 2D top-down RPG-maker style.
 * Inspired by medieval gatehouse: warm sandy stone, clear block pattern,
 * crenellations (merlons), arrow slits, arched gate opening.
 *
 * All wall/structure sprites share the same stone palette and wall height
 * so they tile seamlessly when placed adjacent.
 *
 * Sprites:
 *   - portcullis-large.png (64x64, 2x2 tiles) - Gatehouse with arch + iron grate
 *   - wall-h.png (32x32) - Horizontal curtain wall segment
 *   - wall-v.png (32x32) - Vertical curtain wall segment
 *   - wall-gate-left.png (32x32) - Wall connecting to left of gatehouse
 *   - wall-gate-right.png (32x32) - Wall connecting to right of gatehouse
 *   - battlement.png (32x32) - Wall with prominent crenellations
 *   - tower.png (32x32) - Corner tower (square, taller)
 *
 * Style: top-down view. Walls appear as thick stone bands running across
 * the tile. The "top" of the wall shows crenellations. Stone is warm
 * sandy/beige with visible mortar lines.
 */

const sharp = require('sharp');
const path = require('path');

const TILE = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Warm sandy stone palette (matching the gatehouse image)
const STONE = {
    base: [175, 165, 140],      // main wall color - warm sandy beige
    light: [195, 185, 160],     // sun-hit face
    mid: [160, 150, 125],       // mid tone
    dark: [120, 112, 95],       // shadow/mortar
    shadow: [90, 82, 68],       // deep shadow
    mortar: [135, 125, 105],    // mortar lines between blocks
    top: [185, 175, 150],       // top surface (lighter, catches light)
};

const IRON = [45, 45, 50];
const IRON_LIGHT = [65, 65, 70];
const GATE_DARK = [25, 20, 18];  // dark interior of gate opening
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

function fillArea(buf, w, h, x1, y1, x2, y2, color, noise, seedVal) {
    resetSeed(seedVal);
    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * noise;
            setPixel(buf, x, y, w, h, color[0] + n, color[1] + n * 0.9, color[2] + n * 0.8);
        }
    }
}

function fillGrass(buf, w, h, seedVal) {
    resetSeed(seedVal);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const n = (seededRandom() - 0.5) * 5;
            setPixel(buf, x, y, w, h, GRASS[0] + n, GRASS[1] + n, GRASS[2] + n);
        }
    }
}

/**
 * Draw stone block pattern (horizontal mortar lines + offset vertical lines)
 */
function drawBlocks(buf, w, h, x1, y1, x2, y2, blockH, blockW, seedVal) {
    resetSeed(seedVal);
    // Horizontal mortar
    for (let y = y1 + blockH; y < y2; y += blockH) {
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * 3;
            setPixel(buf, x, y, w, h, STONE.mortar[0] + n, STONE.mortar[1] + n, STONE.mortar[2] + n);
        }
    }
    // Vertical mortar (offset per row)
    let rowIdx = 0;
    for (let y = y1; y < y2; y += blockH) {
        const offset = (rowIdx % 2) * Math.floor(blockW / 2);
        for (let vx = x1 + offset; vx <= x2; vx += blockW) {
            for (let dy = 0; dy < blockH && y + dy <= y2; dy++) {
                const n = (seededRandom() - 0.5) * 3;
                setPixel(buf, vx, y + dy, w, h, STONE.mortar[0] + n, STONE.mortar[1] + n, STONE.mortar[2] + n);
            }
        }
        rowIdx++;
    }
}

/**
 * Draw crenellations (merlons) along the top of a wall.
 * Merlons are raised blocks with gaps (crenels) between them.
 */
function drawCrenellations(buf, w, h, x1, x2, topY, merlonW, crenelW, merlonH, seedVal) {
    resetSeed(seedVal);
    let x = x1;
    while (x <= x2) {
        // Merlon (raised block)
        fillArea(buf, w, h, x, topY - merlonH, x + merlonW - 1, topY - 1, STONE.top, 4, seedVal + x);
        // Dark edge on merlon
        for (let dy = 0; dy < merlonH; dy++) {
            setPixel(buf, x, topY - merlonH + dy, w, h, ...STONE.dark);
            setPixel(buf, x + merlonW - 1, topY - merlonH + dy, w, h, ...STONE.dark);
        }
        for (let dx = 0; dx < merlonW; dx++) {
            setPixel(buf, x + dx, topY - merlonH, w, h, ...STONE.dark);
        }
        x += merlonW + crenelW;
    }
}

/**
 * Draw an arrow slit (narrow vertical dark rectangle)
 */
function drawArrowSlit(buf, w, h, cx, cy, slitH) {
    for (let dy = 0; dy < slitH; dy++) {
        setPixel(buf, cx, cy + dy, w, h, ...GATE_DARK);
        setPixel(buf, cx + 1, cy + dy, w, h, 35, 30, 25);
    }
}

// ============ WALL HORIZONTAL (32x32) ============
// Top-down: wall runs left-right. Shows top surface + front face.
// Wall occupies rows 8-24 (front face), rows 4-8 (top surface with crenellations)

function generateWallH() {
    const buf = Buffer.alloc(TILE * TILE * 4);
    fillGrass(buf, TILE, TILE, 40000);

    const wallFaceTop = 10;
    const wallFaceBot = 24;
    const wallTopSurface = 6;

    // Top surface (lighter, flat top of wall)
    fillArea(buf, TILE, TILE, 0, wallTopSurface, 31, wallFaceTop - 1, STONE.top, 4, 40100);

    // Front face (main wall body)
    fillArea(buf, TILE, TILE, 0, wallFaceTop, 31, wallFaceBot, STONE.base, 5, 40200);
    drawBlocks(buf, TILE, TILE, 0, wallFaceTop, 31, wallFaceBot, 5, 8, 40300);

    // Shadow at bottom of wall
    fillArea(buf, TILE, TILE, 0, wallFaceBot + 1, 31, wallFaceBot + 2, STONE.shadow, 3, 40400);

    // Crenellations on top
    drawCrenellations(buf, TILE, TILE, 0, 31, wallTopSurface, 4, 3, 3, 40500);

    // Dark line separating top surface from face
    for (let x = 0; x < TILE; x++) {
        setPixel(buf, x, wallFaceTop, TILE, TILE, ...STONE.dark);
    }

    return { buf, w: TILE, h: TILE };
}

// ============ WALL VERTICAL (32x32) ============

function generateWallV() {
    const buf = Buffer.alloc(TILE * TILE * 4);
    fillGrass(buf, TILE, TILE, 41000);

    const wallLeft = 10;
    const wallRight = 22;

    // Wall body
    fillArea(buf, TILE, TILE, wallLeft, 0, wallRight, 31, STONE.base, 5, 41100);
    drawBlocks(buf, TILE, TILE, wallLeft, 0, wallRight, 31, 5, 8, 41200);

    // Left edge (shadow)
    for (let y = 0; y < TILE; y++) {
        setPixel(buf, wallLeft, y, TILE, TILE, ...STONE.dark);
        setPixel(buf, wallLeft + 1, y, TILE, TILE, ...STONE.shadow);
    }
    // Right edge (light)
    for (let y = 0; y < TILE; y++) {
        setPixel(buf, wallRight, y, TILE, TILE, ...STONE.dark);
        setPixel(buf, wallRight - 1, y, TILE, TILE, ...STONE.light);
    }

    return { buf, w: TILE, h: TILE };
}

// ============ BATTLEMENT (32x32) ============
// Same as wall-h but with more prominent crenellations

function generateBattlement() {
    const buf = Buffer.alloc(TILE * TILE * 4);
    fillGrass(buf, TILE, TILE, 42000);

    const wallFaceTop = 10;
    const wallFaceBot = 24;
    const wallTopSurface = 5;

    // Top surface
    fillArea(buf, TILE, TILE, 0, wallTopSurface, 31, wallFaceTop - 1, STONE.top, 4, 42100);

    // Front face
    fillArea(buf, TILE, TILE, 0, wallFaceTop, 31, wallFaceBot, STONE.base, 5, 42200);
    drawBlocks(buf, TILE, TILE, 0, wallFaceTop, 31, wallFaceBot, 5, 8, 42300);

    // Larger crenellations
    drawCrenellations(buf, TILE, TILE, 0, 31, wallTopSurface, 5, 3, 4, 42400);

    // Shadow
    fillArea(buf, TILE, TILE, 0, wallFaceBot + 1, 31, wallFaceBot + 2, STONE.shadow, 3, 42500);

    // Dark separator
    for (let x = 0; x < TILE; x++) {
        setPixel(buf, x, wallFaceTop, TILE, TILE, ...STONE.dark);
    }

    // Arrow slit in center
    drawArrowSlit(buf, TILE, TILE, 15, 13, 7);

    return { buf, w: TILE, h: TILE };
}

// ============ TOWER (32x32) ============

function generateTower() {
    const buf = Buffer.alloc(TILE * TILE * 4);
    fillGrass(buf, TILE, TILE, 43000);

    // Tower is wider/taller than wall
    const tX1 = 4, tY1 = 3, tX2 = 27, tY2 = 28;

    // Main body
    fillArea(buf, TILE, TILE, tX1, tY1, tX2, tY2, STONE.base, 5, 43100);
    drawBlocks(buf, TILE, TILE, tX1, tY1 + 4, tX2, tY2, 4, 7, 43200);

    // Top surface
    fillArea(buf, TILE, TILE, tX1, tY1, tX2, tY1 + 3, STONE.top, 4, 43300);

    // Crenellations on all sides (top)
    drawCrenellations(buf, TILE, TILE, tX1, tX2, tY1, 3, 2, 3, 43400);

    // Border
    for (let x = tX1; x <= tX2; x++) {
        setPixel(buf, x, tY1, TILE, TILE, ...STONE.dark);
        setPixel(buf, x, tY2, TILE, TILE, ...STONE.dark);
    }
    for (let y = tY1; y <= tY2; y++) {
        setPixel(buf, tX1, y, TILE, TILE, ...STONE.dark);
        setPixel(buf, tX2, y, TILE, TILE, ...STONE.dark);
    }

    // Shadow at bottom
    fillArea(buf, TILE, TILE, tX1, tY2 + 1, tX2, tY2 + 2, STONE.shadow, 3, 43500);

    // Arrow slits
    drawArrowSlit(buf, TILE, TILE, 10, 12, 6);
    drawArrowSlit(buf, TILE, TILE, 20, 12, 6);

    return { buf, w: TILE, h: TILE };
}

// ============ WALL-GATE-LEFT (32x32) ============
// Wall that connects seamlessly to the left side of the portcullis.
// Same wall height/position as wall-h, but right edge aligns with gatehouse.

function generateWallGateLeft() {
    const buf = Buffer.alloc(TILE * TILE * 4);
    fillGrass(buf, TILE, TILE, 44000);

    const wallFaceTop = 10;
    const wallFaceBot = 24;
    const wallTopSurface = 6;

    // Top surface
    fillArea(buf, TILE, TILE, 0, wallTopSurface, 31, wallFaceTop - 1, STONE.top, 4, 44100);

    // Front face - extends to right edge to meet gatehouse
    fillArea(buf, TILE, TILE, 0, wallFaceTop, 31, wallFaceBot, STONE.base, 5, 44200);
    drawBlocks(buf, TILE, TILE, 0, wallFaceTop, 31, wallFaceBot, 5, 8, 44300);

    // Right edge thickens (buttress meeting gatehouse)
    fillArea(buf, TILE, TILE, 26, wallFaceTop - 2, 31, wallFaceBot + 2, STONE.mid, 4, 44400);
    for (let y = wallFaceTop - 2; y <= wallFaceBot + 2; y++) {
        setPixel(buf, 31, y, TILE, TILE, ...STONE.dark);
    }

    // Crenellations
    drawCrenellations(buf, TILE, TILE, 0, 25, wallTopSurface, 4, 3, 3, 44500);

    // Shadow
    fillArea(buf, TILE, TILE, 0, wallFaceBot + 1, 25, wallFaceBot + 2, STONE.shadow, 3, 44600);

    // Dark separator
    for (let x = 0; x < 26; x++) {
        setPixel(buf, x, wallFaceTop, TILE, TILE, ...STONE.dark);
    }

    return { buf, w: TILE, h: TILE };
}

// ============ WALL-GATE-RIGHT (32x32) ============

function generateWallGateRight() {
    const buf = Buffer.alloc(TILE * TILE * 4);
    fillGrass(buf, TILE, TILE, 45000);

    const wallFaceTop = 10;
    const wallFaceBot = 24;
    const wallTopSurface = 6;

    // Top surface
    fillArea(buf, TILE, TILE, 0, wallTopSurface, 31, wallFaceTop - 1, STONE.top, 4, 45100);

    // Front face
    fillArea(buf, TILE, TILE, 0, wallFaceTop, 31, wallFaceBot, STONE.base, 5, 45200);
    drawBlocks(buf, TILE, TILE, 0, wallFaceTop, 31, wallFaceBot, 5, 8, 45300);

    // Left edge thickens (buttress meeting gatehouse)
    fillArea(buf, TILE, TILE, 0, wallFaceTop - 2, 5, wallFaceBot + 2, STONE.mid, 4, 45400);
    for (let y = wallFaceTop - 2; y <= wallFaceBot + 2; y++) {
        setPixel(buf, 0, y, TILE, TILE, ...STONE.dark);
    }

    // Crenellations
    drawCrenellations(buf, TILE, TILE, 6, 31, wallTopSurface, 4, 3, 3, 45500);

    // Shadow
    fillArea(buf, TILE, TILE, 6, wallFaceBot + 1, 31, wallFaceBot + 2, STONE.shadow, 3, 45600);

    // Dark separator
    for (let x = 6; x < TILE; x++) {
        setPixel(buf, x, wallFaceTop, TILE, TILE, ...STONE.dark);
    }

    return { buf, w: TILE, h: TILE };
}

// ============ PORTCULLIS LARGE (64x64, 2x2 tiles) ============
// Gatehouse: two flanking towers with arched gate opening between them.
// Iron portcullis grate visible in the dark arch.

function generatePortcullisLarge() {
    const S = TILE * 2; // 64
    const buf = Buffer.alloc(S * S * 4);
    fillGrass(buf, S, S, 46000);

    const wallFaceTop = 10;
    const wallFaceBot = 52;
    const wallTopSurface = 5;

    // Main gatehouse body
    fillArea(buf, S, S, 2, wallTopSurface, S - 3, wallFaceBot, STONE.base, 5, 46100);
    drawBlocks(buf, S, S, 2, wallFaceTop + 1, S - 3, wallFaceBot, 5, 9, 46200);

    // Top surface
    fillArea(buf, S, S, 2, wallTopSurface, S - 3, wallFaceTop, STONE.top, 4, 46300);

    // Crenellations across top
    drawCrenellations(buf, S, S, 2, S - 3, wallTopSurface, 5, 3, 4, 46400);

    // Dark line under top surface
    for (let x = 2; x <= S - 3; x++) {
        setPixel(buf, x, wallFaceTop + 1, S, S, ...STONE.dark);
    }

    // === Flanking towers (slightly wider/taller) ===
    // Left tower
    fillArea(buf, S, S, 0, wallTopSurface - 2, 14, wallFaceBot + 2, STONE.mid, 4, 46500);
    drawBlocks(buf, S, S, 0, wallFaceTop, 14, wallFaceBot + 2, 5, 7, 46550);
    drawCrenellations(buf, S, S, 0, 14, wallTopSurface - 2, 4, 2, 4, 46600);
    for (let y = wallTopSurface - 2; y <= wallFaceBot + 2; y++) {
        setPixel(buf, 0, y, S, S, ...STONE.dark);
        setPixel(buf, 14, y, S, S, ...STONE.dark);
    }

    // Right tower
    fillArea(buf, S, S, S - 15, wallTopSurface - 2, S - 1, wallFaceBot + 2, STONE.mid, 4, 46700);
    drawBlocks(buf, S, S, S - 15, wallFaceTop, S - 1, wallFaceBot + 2, 5, 7, 46750);
    drawCrenellations(buf, S, S, S - 15, S - 1, wallTopSurface - 2, 4, 2, 4, 46800);
    for (let y = wallTopSurface - 2; y <= wallFaceBot + 2; y++) {
        setPixel(buf, S - 15, y, S, S, ...STONE.dark);
        setPixel(buf, S - 1, y, S, S, ...STONE.dark);
    }

    // === Gate arch opening ===
    const archLeft = 18, archRight = S - 19;
    const archTop = 20, archBot = wallFaceBot;

    // Dark interior
    fillArea(buf, S, S, archLeft, archTop, archRight, archBot, GATE_DARK, 3, 46900);

    // Pointed arch top
    const archCx = (archLeft + archRight) / 2;
    const archW = (archRight - archLeft) / 2;
    for (let x = archLeft; x <= archRight; x++) {
        const dx = Math.abs(x - archCx) / archW;
        const archHeight = Math.round((1 - dx * dx) * 8);
        for (let dy = 0; dy <= archHeight; dy++) {
            setPixel(buf, x, archTop - dy, S, S, ...STONE.base);
        }
        // Arch border
        setPixel(buf, x, archTop - archHeight, S, S, ...STONE.dark);
    }

    // Stone border around arch
    for (let y = archTop; y <= archBot; y++) {
        setPixel(buf, archLeft - 1, y, S, S, ...STONE.dark);
        setPixel(buf, archLeft - 2, y, S, S, ...STONE.mid);
        setPixel(buf, archRight + 1, y, S, S, ...STONE.dark);
        setPixel(buf, archRight + 2, y, S, S, ...STONE.mid);
    }

    // === Iron portcullis grate ===
    // Vertical bars
    for (let x = archLeft + 2; x <= archRight - 2; x += 4) {
        for (let y = archTop + 2; y <= archBot - 1; y++) {
            setPixel(buf, x, y, S, S, ...IRON);
            setPixel(buf, x + 1, y, S, S, ...IRON_LIGHT);
        }
    }
    // Horizontal bars
    for (let y = archTop + 4; y <= archBot - 2; y += 5) {
        for (let x = archLeft + 1; x <= archRight - 1; x++) {
            setPixel(buf, x, y, S, S, ...IRON);
            setPixel(buf, x, y + 1, S, S, ...IRON_LIGHT);
        }
    }

    // === Arrow slits on towers ===
    drawArrowSlit(buf, S, S, 5, 22, 8);
    drawArrowSlit(buf, S, S, 9, 35, 8);
    drawArrowSlit(buf, S, S, S - 8, 22, 8);
    drawArrowSlit(buf, S, S, S - 12, 35, 8);

    // Arrow slits above gate
    drawArrowSlit(buf, S, S, 24, 12, 5);
    drawArrowSlit(buf, S, S, 36, 12, 5);

    // Shadow at base
    fillArea(buf, S, S, 0, wallFaceBot + 3, S - 1, wallFaceBot + 5, STONE.shadow, 3, 47000);

    // Border edges
    for (let x = 0; x < S; x++) {
        setPixel(buf, x, wallTopSurface - 2, S, S, ...STONE.dark);
    }

    return { buf, w: S, h: S };
}

// ============ MAIN ============

async function generateAll() {
    const sprites = [
        { name: 'portcullis-large', ...generatePortcullisLarge() },
        { name: 'wall-h', ...generateWallH() },
        { name: 'wall-v', ...generateWallV() },
        { name: 'wall-gate-left', ...generateWallGateLeft() },
        { name: 'wall-gate-right', ...generateWallGateRight() },
        { name: 'battlement', ...generateBattlement() },
        { name: 'tower', ...generateTower() },
    ];

    for (const sprite of sprites) {
        await sharp(sprite.buf, { raw: { width: sprite.w, height: sprite.h, channels: 4 } })
            .png().toFile(path.join(OUTPUT_DIR, `${sprite.name}.png`));
        console.log(`  ✓ ${sprite.name}.png (${sprite.w}x${sprite.h})`);
    }
    console.log('\nDone!');
}

generateAll().catch(err => { console.error(err); process.exit(1); });
