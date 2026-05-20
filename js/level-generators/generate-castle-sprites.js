/**
 * Generate castle structure sprites (32x32, hex-clipped).
 *
 * Castle Bridge (drawbridge):
 *   - castle-bridge-start: road transitioning to wooden planks
 *   - castle-bridge-mid: wooden plank bridge over moat
 *   - castle-bridge-gate: bridge meeting the gatehouse
 *
 * Tower:
 *   - castle-tower: round stone tower (top-down, circular)
 *
 * Keep:
 *   - castle-keep: large square tower (the main fortification)
 *
 * Portcullis/Gatehouse:
 *   - castle-gatehouse: gate entrance with iron grate
 *
 * Battlements/Curtain Wall:
 *   - castle-wall: stone wall segment (different from bridge cobblestone)
 *   - castle-battlement: wall with crenellations visible
 *
 * Bailey floor:
 *   - castle-bailey-1: light grey stone floor
 *   - castle-bailey-2: stone floor with dirt stains
 *   - castle-bailey-3: stone floor with straw
 */

const sharp = require('sharp');
const path = require('path');

const SIZE = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Castle stone palette (warmer/sandier than bridge cobblestone)
const WALL_BASE = [175, 162, 135];
const WALL_LIGHT = [195, 182, 155];
const WALL_DARK = [125, 115, 95];
const WALL_MORTAR = [145, 135, 112];

// Tower/Keep (slightly darker, more imposing)
const TOWER_BASE = [155, 145, 120];
const TOWER_LIGHT = [178, 168, 142];
const TOWER_DARK = [105, 98, 80];
const TOWER_TOP = [168, 158, 132];

// Drawbridge wood
const WOOD = [120, 78, 38];
const WOOD_LIGHT = [145, 98, 50];
const WOOD_DARK = [85, 55, 25];
const WOOD_GRAIN = [100, 65, 30];

// Iron (portcullis grate)
const IRON = [55, 55, 58];
const IRON_LIGHT = [75, 75, 78];

// Bailey floor
const BAILEY_BASE = [175, 172, 165];
const BAILEY_DARK = [145, 140, 132];
const BAILEY_MORTAR = [155, 150, 142];
const DIRT_STAIN = [140, 120, 90];
const STRAW = [195, 175, 95];
const STRAW_DARK = [165, 145, 70];

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
    buf[i+1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[i+2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[i+3] = 255;
}

function fill(buf, color, noise, sv) {
    resetSeed(sv);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * noise;
            const dither = seededRandom() > 0.9 ? 12 : (seededRandom() < 0.1 ? -10 : 0);
            px(buf, x, y, color[0]+n+dither, color[1]+n+dither, color[2]+n+dither);
        }
}

function drawStoneBlocks(buf, x1, y1, x2, y2, base, light, dark, mortar, sv) {
    resetSeed(sv);
    // Mortar fill
    for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom()-0.5)*6;
            px(buf, x, y, mortar[0]+n, mortar[1]+n, mortar[2]+n);
        }
    // Stone blocks
    resetSeed(sv+100);
    const bh = 5, bw = 7;
    for (let sy = y1; sy <= y2; sy += bh+1) {
        const off = ((sy-y1)/(bh+1))%2===0 ? 0 : 4;
        for (let sx = x1+off; sx <= x2; sx += bw+1) {
            const sw = bw + Math.floor(seededRandom()*2)-1;
            const sh = bh + Math.floor(seededRandom()*2)-1;
            const isLit = seededRandom() > 0.4;
            const col = isLit ? light : base;
            for (let dy = 1; dy < sh && sy+dy <= y2; dy++)
                for (let dx = 1; dx < sw && sx+dx <= x2; dx++) {
                    const n = (seededRandom()-0.5)*8;
                    px(buf, sx+dx, sy+dy, col[0]+n, col[1]+n, col[2]+n);
                }
        }
    }
}

// Hex clip (same as main generator)
function hexClip(buf) {
    const cx = SIZE/2, cy = SIZE/2;
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI/3)*i - Math.PI/6;
        points.push({x: cx+(SIZE/2)*Math.cos(angle), y: cy+(SIZE/2)*Math.sin(angle)});
    }
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++)
            if (!pointInHex(x, y, points)) {
                const idx = (y*SIZE+x)*4;
                buf[idx]=0; buf[idx+1]=0; buf[idx+2]=0; buf[idx+3]=0;
            }
}

function pointInHex(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length-1; i < pts.length; j = i++) {
        const xi=pts[i].x, yi=pts[i].y, xj=pts[j].x, yj=pts[j].y;
        if ((yi>py)!==(yj>py) && px<(xj-xi)*(py-yi)/(yj-yi)+xi) inside=!inside;
    }
    return inside;
}

// ============ CASTLE BRIDGE ============

function genCastleBridgeStart() {
    // Left half: dirt road, right half: wooden planks
    const buf = createBuf();
    // Road side
    resetSeed(10000);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < 16; x++) {
            const n = (seededRandom()-0.5)*12;
            px(buf, x, y, 210+n, 165+n*0.8, 110+n*0.6);
        }
    // Wood planks
    resetSeed(10100);
    for (let y = 0; y < SIZE; y++)
        for (let x = 16; x < SIZE; x++) {
            const n = (seededRandom()-0.5)*10;
            const plankLine = y % 6 === 0;
            const col = plankLine ? WOOD_DARK : WOOD;
            px(buf, x, y, col[0]+n, col[1]+n, col[2]+n);
        }
    // Wood grain lines
    resetSeed(10200);
    for (let i = 0; i < 6; i++) {
        const x = 18 + Math.floor(seededRandom()*12);
        for (let y = 0; y < SIZE; y++) {
            if (seededRandom() > 0.3) px(buf, x, y, ...WOOD_GRAIN);
        }
    }
    hexClip(buf);
    return buf;
}

function genCastleBridgeMid() {
    // Full wooden plank bridge
    const buf = createBuf();
    resetSeed(10300);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom()-0.5)*10;
            const plankLine = y % 6 === 0;
            const col = plankLine ? WOOD_DARK : (seededRandom()>0.7 ? WOOD_LIGHT : WOOD);
            px(buf, x, y, col[0]+n, col[1]+n, col[2]+n);
        }
    // Grain
    resetSeed(10400);
    for (let i = 0; i < 8; i++) {
        const x = Math.floor(seededRandom()*SIZE);
        for (let y = 0; y < SIZE; y++)
            if (seededRandom()>0.4) px(buf, x, y, ...WOOD_GRAIN);
    }
    // Side rails (dark edges)
    for (let y = 0; y < SIZE; y++) {
        px(buf, 0, y, ...WOOD_DARK); px(buf, 1, y, ...WOOD_DARK);
        px(buf, SIZE-1, y, ...WOOD_DARK); px(buf, SIZE-2, y, ...WOOD_DARK);
    }
    hexClip(buf);
    return buf;
}

function genCastleBridgeGate() {
    // Wood planks meeting stone gatehouse
    const buf = createBuf();
    // Wood left half
    resetSeed(10500);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < 16; x++) {
            const n = (seededRandom()-0.5)*10;
            const col = (y%6===0) ? WOOD_DARK : WOOD;
            px(buf, x, y, col[0]+n, col[1]+n, col[2]+n);
        }
    // Stone right half (gatehouse wall)
    drawStoneBlocks(buf, 16, 0, 31, 31, WALL_BASE, WALL_LIGHT, WALL_DARK, WALL_MORTAR, 10600);
    hexClip(buf);
    return buf;
}

// ============ TOWER ============

function genCastleTower() {
    // Round tower from top-down (circular stone, no grass bg)
    const buf = createBuf();
    // Fill with stone base first
    fill(buf, TOWER_BASE, 8, 11000);
    const cx = 16, cy = 16, r = 14;
    resetSeed(11100);
    // Tower body (circle with shading)
    for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
            const d = Math.sqrt(dx*dx+dy*dy);
            if (d <= r) {
                const n = (seededRandom()-0.5)*10;
                let col;
                if (d > r-2) col = TOWER_DARK;
                else if (d > r-4) col = TOWER_BASE;
                else col = TOWER_TOP;
                px(buf, cx+dx, cy+dy, col[0]+n, col[1]+n, col[2]+n);
            }
        }
    // Battlements
    resetSeed(11200);
    for (let a = 0; a < 12; a++) {
        const angle = (a/12)*Math.PI*2;
        const bx = Math.round(cx + (r-1)*Math.cos(angle));
        const by = Math.round(cy + (r-1)*Math.sin(angle));
        px(buf, bx, by, ...TOWER_DARK);
        px(buf, bx+1, by, ...TOWER_DARK);
    }
    hexClip(buf);
    return buf;
}

// ============ KEEP (4 tiles: TL, TR, BL, BR) ============

function genKeepTL() {
    const buf = createBuf();
    // Top-left quadrant: stone wall with corner turret
    drawStoneBlocks(buf, 0, 0, 31, 31, TOWER_BASE, TOWER_LIGHT, TOWER_DARK, WALL_MORTAR, 12000);
    // Corner turret (bottom-right of this tile)
    for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++)
            if (dx*dx+dy*dy <= 16) {
                const n = (seededRandom()-0.5)*6;
                px(buf, 28+dx, 28+dy, TOWER_LIGHT[0]+n, TOWER_LIGHT[1]+n, TOWER_LIGHT[2]+n);
            }
    // Top edge battlement
    for (let x = 0; x < SIZE; x += 5)
        for (let dy = 0; dy < 3; dy++) px(buf, x, dy, ...TOWER_DARK);
    hexClip(buf);
    return buf;
}

function genKeepTR() {
    const buf = createBuf();
    drawStoneBlocks(buf, 0, 0, 31, 31, TOWER_BASE, TOWER_LIGHT, TOWER_DARK, WALL_MORTAR, 12100);
    // Corner turret (bottom-left)
    for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++)
            if (dx*dx+dy*dy <= 16) {
                const n = (seededRandom()-0.5)*6;
                px(buf, 3+dx, 28+dy, TOWER_LIGHT[0]+n, TOWER_LIGHT[1]+n, TOWER_LIGHT[2]+n);
            }
    // Flag
    px(buf, 16, 8, 60, 40, 20); px(buf, 16, 7, 60, 40, 20); px(buf, 16, 6, 60, 40, 20);
    px(buf, 17, 5, 180, 30, 30); px(buf, 18, 5, 180, 30, 30); px(buf, 19, 5, 180, 30, 30);
    for (let x = 0; x < SIZE; x += 5)
        for (let dy = 0; dy < 3; dy++) px(buf, x, dy, ...TOWER_DARK);
    hexClip(buf);
    return buf;
}

function genKeepBL() {
    const buf = createBuf();
    drawStoneBlocks(buf, 0, 0, 31, 31, TOWER_BASE, TOWER_LIGHT, TOWER_DARK, WALL_MORTAR, 12200);
    // Corner turret (top-right)
    for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++)
            if (dx*dx+dy*dy <= 16) {
                const n = (seededRandom()-0.5)*6;
                px(buf, 28+dx, 3+dy, TOWER_LIGHT[0]+n, TOWER_LIGHT[1]+n, TOWER_LIGHT[2]+n);
            }
    hexClip(buf);
    return buf;
}

function genKeepBR() {
    const buf = createBuf();
    drawStoneBlocks(buf, 0, 0, 31, 31, TOWER_BASE, TOWER_LIGHT, TOWER_DARK, WALL_MORTAR, 12300);
    // Corner turret (top-left)
    for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++)
            if (dx*dx+dy*dy <= 16) {
                const n = (seededRandom()-0.5)*6;
                px(buf, 3+dx, 3+dy, TOWER_LIGHT[0]+n, TOWER_LIGHT[1]+n, TOWER_LIGHT[2]+n);
            }
    hexClip(buf);
    return buf;
}

function genKeepCenter() {
    // Center keep tile with prominent flag — the focal point to protect
    const buf = createBuf();
    // Stone floor base (lighter than walls to stand out)
    drawStoneBlocks(buf, 0, 0, 31, 31, TOWER_LIGHT, [200, 190, 165], TOWER_DARK, WALL_MORTAR, 12400);

    // Raised platform in center (slightly lighter)
    resetSeed(12500);
    for (let dy = -6; dy <= 6; dy++)
        for (let dx = -6; dx <= 6; dx++) {
            const n = (seededRandom()-0.5)*5;
            px(buf, 16+dx, 16+dy, 195+n, 185+n, 158+n);
        }

    // Flag pole (dark brown, tall, center)
    for (let y = 4; y <= 20; y++) {
        px(buf, 16, y, 55, 35, 18);
        px(buf, 17, y, 65, 42, 22);
    }
    // Pole base (wider)
    for (let dx = -1; dx <= 2; dx++) {
        px(buf, 16+dx, 20, 50, 32, 15);
        px(buf, 16+dx, 21, 50, 32, 15);
    }

    // Flag (large, red with gold trim — clearly visible)
    // Flag body (red, waving shape)
    resetSeed(12600);
    for (let fy = 0; fy < 8; fy++) {
        const wave = Math.round(Math.sin(fy * 0.8) * 1.5);
        for (let fx = 0; fx < 10; fx++) {
            const n = (seededRandom()-0.5)*8;
            // Red body
            px(buf, 18 + fx + wave, 4 + fy, 200+n, 30+n*0.3, 25+n*0.3);
        }
    }
    // Gold trim (top and bottom of flag)
    for (let fx = 0; fx < 10; fx++) {
        const wave1 = Math.round(Math.sin(0) * 1.5);
        const wave2 = Math.round(Math.sin(7 * 0.8) * 1.5);
        px(buf, 18 + fx + wave1, 4, 230, 190, 50);
        px(buf, 18 + fx + wave1, 5, 220, 180, 45);
        px(buf, 18 + fx + wave2, 11, 220, 180, 45);
        px(buf, 18 + fx + wave2, 12, 230, 190, 50);
    }
    // Gold emblem center of flag (small cross/shield)
    px(buf, 22, 7, 240, 200, 60); px(buf, 23, 7, 240, 200, 60);
    px(buf, 22, 8, 240, 200, 60); px(buf, 23, 8, 240, 200, 60);
    px(buf, 21, 8, 240, 200, 60); px(buf, 24, 8, 240, 200, 60);
    px(buf, 22, 9, 240, 200, 60); px(buf, 23, 9, 240, 200, 60);

    // Shadow of flag on stone
    resetSeed(12700);
    for (let fy = 0; fy < 5; fy++)
        for (let fx = 0; fx < 8; fx++)
            if (seededRandom() > 0.4)
                px(buf, 19+fx, 22+fy, 130, 122, 100);

    hexClip(buf);
    return buf;
}

// ============ GATEHOUSE ============

function genCastleGatehouse() {
    // Gatehouse with portcullis (iron grate visible in dark arch)
    const buf = createBuf();
    drawStoneBlocks(buf, 0, 0, 31, 31, WALL_BASE, WALL_LIGHT, WALL_DARK, WALL_MORTAR, 13000);
    // Dark gate opening (center)
    resetSeed(13100);
    for (let y = 8; y <= 24; y++)
        for (let x = 10; x <= 21; x++) {
            const n = (seededRandom()-0.5)*4;
            px(buf, x, y, 25+n, 22+n, 20+n);
        }
    // Iron grate bars
    for (let x = 11; x <= 20; x += 3)
        for (let y = 9; y <= 23; y++) px(buf, x, y, ...IRON);
    for (let y = 10; y <= 22; y += 3)
        for (let x = 10; x <= 21; x++) px(buf, x, y, ...IRON_LIGHT);
    // Arch top
    for (let dx = -5; dx <= 5; dx++) {
        const h = Math.round(Math.sqrt(25-dx*dx)*0.6);
        for (let dy = 0; dy <= h; dy++)
            px(buf, 16+dx, 8-dy, ...WALL_BASE);
    }
    hexClip(buf);
    return buf;
}

// ============ CURTAIN WALL ============

function genCastleWall() {
    // Full stone wall (no grass background)
    const buf = createBuf();
    drawStoneBlocks(buf, 0, 0, 31, 31, WALL_BASE, WALL_LIGHT, WALL_DARK, WALL_MORTAR, 14100);
    // Dark edges top/bottom for depth
    for (let x = 0; x < SIZE; x++) {
        px(buf, x, 0, ...WALL_DARK); px(buf, x, 31, ...WALL_DARK);
    }
    hexClip(buf);
    return buf;
}

// ============ BATTLEMENT ============

function genCastleBattlement() {
    // Full stone wall with crenellations (no grass)
    const buf = createBuf();
    drawStoneBlocks(buf, 0, 0, 31, 31, WALL_BASE, WALL_LIGHT, WALL_DARK, WALL_MORTAR, 15100);
    // Merlons on top edge
    for (let x = 2; x < SIZE; x += 6) {
        for (let y = 0; y < 4; y++)
            for (let dx = 0; dx < 3; dx++) {
                const n = (seededRandom()-0.5)*5;
                px(buf, x+dx, y, WALL_LIGHT[0]+n, WALL_LIGHT[1]+n, WALL_LIGHT[2]+n);
            }
        // Merlon dark outline
        for (let y = 0; y < 4; y++) { px(buf, x, y, ...WALL_DARK); px(buf, x+2, y, ...WALL_DARK); }
        for (let dx = 0; dx < 3; dx++) px(buf, x+dx, 0, ...WALL_DARK);
    }
    hexClip(buf);
    return buf;
}

// ============ BAILEY FLOOR ============

function genBailey1() {
    // Road-colored dirt base with light straw
    const buf = createBuf();
    resetSeed(16000);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom()-0.5)*12;
            px(buf, x, y, 200+n, 155+n*0.8, 100+n*0.6);
        }
    // Scattered straw
    resetSeed(16050);
    for (let i = 0; i < 20; i++) {
        const sx = Math.floor(seededRandom()*SIZE);
        const sy = Math.floor(seededRandom()*SIZE);
        const len = 3 + Math.floor(seededRandom()*4);
        const angle = seededRandom() * Math.PI;
        for (let d = 0; d < len; d++) {
            const dx = Math.round(Math.cos(angle)*d);
            const dy = Math.round(Math.sin(angle)*d);
            px(buf, sx+dx, sy+dy, ...STRAW);
        }
    }
    hexClip(buf);
    return buf;
}

function genBailey2() {
    // Mostly straw/hay with road-dirt showing through
    const buf = createBuf();
    resetSeed(16100);
    // Base: straw color
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom()-0.5)*10;
            const isStraw = seededRandom() > 0.3;
            if (isStraw) px(buf, x, y, STRAW[0]+n, STRAW[1]+n, STRAW[2]+n);
            else px(buf, x, y, 195+n, 150+n*0.8, 95+n*0.6);
        }
    // Straw strands
    resetSeed(16200);
    for (let i = 0; i < 25; i++) {
        const sx = Math.floor(seededRandom()*SIZE);
        const sy = Math.floor(seededRandom()*SIZE);
        const len = 3 + Math.floor(seededRandom()*5);
        const angle = seededRandom() * Math.PI;
        const col = seededRandom() > 0.5 ? STRAW : STRAW_DARK;
        for (let d = 0; d < len; d++) {
            const dx = Math.round(Math.cos(angle)*d);
            const dy = Math.round(Math.sin(angle)*d);
            px(buf, sx+dx, sy+dy, ...col);
        }
    }
    hexClip(buf);
    return buf;
}

function genBailey3() {
    // Dense hay floor (almost all straw)
    const buf = createBuf();
    resetSeed(16300);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom()-0.5)*10;
            const col = seededRandom() > 0.2 ? STRAW : STRAW_DARK;
            px(buf, x, y, col[0]+n, col[1]+n, col[2]+n);
        }
    // Dense straw strands
    resetSeed(16400);
    for (let i = 0; i < 35; i++) {
        const sx = Math.floor(seededRandom()*SIZE);
        const sy = Math.floor(seededRandom()*SIZE);
        const len = 2 + Math.floor(seededRandom()*5);
        const angle = seededRandom() * Math.PI;
        const col = seededRandom() > 0.3 ? [205, 185, 105] : STRAW_DARK;
        for (let d = 0; d < len; d++) {
            const dx = Math.round(Math.cos(angle)*d);
            const dy = Math.round(Math.sin(angle)*d);
            px(buf, sx+dx, sy+dy, ...col);
        }
    }
    hexClip(buf);
    return buf;
}

// ============ MAIN ============

async function generateAll() {
    const sprites = [
        { name: 'castle-bridge-start', buf: genCastleBridgeStart() },
        { name: 'castle-bridge-mid', buf: genCastleBridgeMid() },
        { name: 'castle-bridge-gate', buf: genCastleBridgeGate() },
        { name: 'castle-tower', buf: genCastleTower() },
        { name: 'castle-keep-tl', buf: genKeepTL() },
        { name: 'castle-keep-tr', buf: genKeepTR() },
        { name: 'castle-keep-bl', buf: genKeepBL() },
        { name: 'castle-keep-br', buf: genKeepBR() },
        { name: 'castle-keep-center', buf: genKeepCenter() },
        { name: 'castle-gatehouse', buf: genCastleGatehouse() },
        { name: 'castle-wall', buf: genCastleWall() },
        { name: 'castle-battlement', buf: genCastleBattlement() },
        { name: 'castle-bailey-1', buf: genBailey1() },
        { name: 'castle-bailey-2', buf: genBailey2() },
        { name: 'castle-bailey-3', buf: genBailey3() },
    ];

    for (const s of sprites) {
        await sharp(s.buf, { raw: { width: SIZE, height: SIZE, channels: 4 } })
            .png().toFile(path.join(OUTPUT_DIR, `${s.name}.png`));
        console.log(`  ✓ ${s.name}.png`);
    }
    console.log(`\nDone! ${sprites.length} castle sprites.`);
}

generateAll().catch(e => { console.error(e); process.exit(1); });
