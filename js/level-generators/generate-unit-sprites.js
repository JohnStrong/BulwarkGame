/**
 * Generate medieval army unit sprites (64x32 isometric diamond, BR→TL viewpoint).
 *
 * Units:
 *   - knight: heavy armored mounted/dismounted (silver armor, blue cape)
 *   - heavy-infantry: armored swordsman (chainmail, shield)
 *   - spearman: spear/pike holder (leather armor, long spear)
 *   - archer: longbow/crossbow (green tunic, bow)
 *   - crossbowman: crossbow variant (brown tunic, crossbow)
 *   - skirmisher: light javelin thrower (light leather)
 *   - engineer: siege crew / builder (brown apron, hammer)
 *   - militia: local levy / watchman (simple clothes, basic weapon)
 *   - artillery: cannon/ballista crew (dark clothes, near weapon)
 *
 * Each unit is drawn as a small figure on a grass diamond base.
 * Viewed from BR→TL (figure faces upper-left).
 */

const sharp = require('sharp');
const path = require('path');

const TILE_W = 64, TILE_H = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

const GRASS = [95, 180, 72];
const BORDER = [25, 25, 22];

// Unit color palettes
const PALETTES = {
    knight:        { body: [180, 180, 190], cape: [40, 60, 140], accent: [200, 170, 50], skin: [210, 175, 140] },
    heavyInfantry: { body: [140, 140, 145], cape: [100, 50, 50], accent: [160, 155, 140], skin: [200, 165, 130] },
    spearman:      { body: [130, 100, 60], cape: [90, 75, 50], accent: [170, 170, 170], skin: [195, 160, 125] },
    archer:        { body: [60, 110, 50], cape: [45, 90, 40], accent: [140, 100, 50], skin: [205, 170, 135] },
    crossbowman:   { body: [100, 75, 45], cape: [80, 60, 35], accent: [130, 130, 130], skin: [200, 165, 130] },
    skirmisher:    { body: [150, 130, 90], cape: [120, 105, 70], accent: [100, 90, 70], skin: [210, 175, 140] },
    engineer:      { body: [110, 80, 50], cape: [85, 65, 40], accent: [160, 140, 100], skin: [195, 160, 125] },
    militia:       { body: [130, 120, 100], cape: [110, 100, 80], accent: [90, 85, 75], skin: [205, 170, 135] },
    artillery:     { body: [60, 55, 50], cape: [45, 42, 38], accent: [140, 130, 110], skin: [200, 165, 130] },
};

let seed = 1;
function sr() { seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF; return (seed >>> 0) / 0xFFFFFFFF; }
function rs(s) { seed = s; }

function createBuf() { return Buffer.alloc(TILE_W * TILE_H * 4); }

function px(buf, x, y, r, g, b) {
    if (x < 0 || x >= TILE_W || y < 0 || y >= TILE_H) return;
    const i = (y * TILE_W + x) * 4;
    buf[i] = Math.max(0, Math.min(255, Math.round(r)));
    buf[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[i + 3] = 255;
}

function inD(x, y) { return (Math.abs(x - 32) / 32 + Math.abs(y - 16) / 16) <= 1; }

function fillGrass(buf, sv) {
    rs(sv);
    for (let y = 0; y < TILE_H; y++)
        for (let x = 0; x < TILE_W; x++)
            if (inD(x, y)) {
                const n = (sr() - 0.5) * 10;
                px(buf, x, y, GRASS[0] + n, GRASS[1] + n, GRASS[2] + n);
            }
}

function drawBorder(buf) {
    for (let y = 0; y < TILE_H; y++)
        for (let x = 0; x < TILE_W; x++) {
            const i = (y * TILE_W + x) * 4;
            if (buf[i + 3] === 0) continue;
            let e = false;
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= TILE_W || ny < 0 || ny >= TILE_H) { e = true; continue; }
                    if (buf[(ny * TILE_W + nx) * 4 + 3] === 0) e = true;
                }
            if (e) { buf[i] = BORDER[0]; buf[i + 1] = BORDER[1]; buf[i + 2] = BORDER[2]; }
        }
}

/**
 * Draw a unit figure at center of diamond.
 * Figure is ~10px wide × 16px tall, viewed from BR→TL (facing upper-left).
 * Transparent background (no grass base) — units overlay terrain tiles.
 * Higher detail with more noise/dithering for visibility.
 */
function drawUnit(buf, palette, weaponType, sv) {
    rs(sv);
    const cx = 32, cy = 14;

    // Drop shadow (semi-transparent dark ellipse)
    for (let dx = -5; dx <= 5; dx++)
        for (let dy = -1; dy <= 2; dy++)
            if ((dx * dx) / 25 + (dy * dy) / 4 < 1) {
                const i = ((cy + 9 + dy) * TILE_W + (cx + dx + 1)) * 4;
                if (i >= 0 && i < buf.length - 3) {
                    buf[i] = 20; buf[i + 1] = 20; buf[i + 2] = 15; buf[i + 3] = 100;
                }
            }

    // Legs (3px wide, 5px tall, with shading)
    for (let dy = 0; dy < 5; dy++) {
        const n = (sr() - 0.5) * 12;
        px(buf, cx - 2, cy + 5 + dy, palette.body[0] - 20 + n, palette.body[1] - 20 + n, palette.body[2] - 20 + n);
        px(buf, cx - 1, cy + 5 + dy, palette.body[0] - 15 + n, palette.body[1] - 15 + n, palette.body[2] - 15 + n);
        px(buf, cx + 1, cy + 5 + dy, palette.body[0] - 20 + n, palette.body[1] - 20 + n, palette.body[2] - 20 + n);
        px(buf, cx + 2, cy + 5 + dy, palette.body[0] - 15 + n, palette.body[1] - 15 + n, palette.body[2] - 15 + n);
    }
    // Boots
    px(buf, cx - 2, cy + 9, 50, 35, 20); px(buf, cx - 1, cy + 9, 55, 38, 22);
    px(buf, cx + 1, cy + 9, 50, 35, 20); px(buf, cx + 2, cy + 9, 55, 38, 22);

    // Body / torso (6px wide, 6px tall, with noise for texture)
    for (let dy = 0; dy < 6; dy++)
        for (let dx = -3; dx <= 2; dx++) {
            const n = (sr() - 0.5) * 15;
            const shade = dx < 0 ? -10 : 5; // left side darker (shadow from BR light)
            px(buf, cx + dx, cy - 1 + dy, palette.body[0] + n + shade, palette.body[1] + n + shade, palette.body[2] + n + shade);
        }

    // Cape/cloak (visible on back-left, flowing)
    for (let dy = 0; dy < 6; dy++) {
        const n = (sr() - 0.5) * 10;
        const wave = Math.round(Math.sin(dy * 0.8) * 0.5);
        px(buf, cx - 4 + wave, cy + dy, palette.cape[0] + n, palette.cape[1] + n, palette.cape[2] + n);
        px(buf, cx - 3 + wave, cy + 1 + dy, palette.cape[0] + n - 5, palette.cape[1] + n - 5, palette.cape[2] + n - 5);
    }

    // Shoulders / pauldrons
    px(buf, cx - 3, cy - 1, ...palette.accent);
    px(buf, cx + 2, cy - 1, ...palette.accent);
    px(buf, cx - 3, cy, ...palette.accent);
    px(buf, cx + 2, cy, ...palette.accent);

    // Head (4x4 with shading)
    for (let dy = -2; dy <= 1; dy++)
        for (let dx = -1; dx <= 2; dx++) {
            const n = (sr() - 0.5) * 8;
            const shade = (dy < 0) ? 5 : -5;
            px(buf, cx + dx, cy - 4 + dy, palette.skin[0] + n + shade, palette.skin[1] + n + shade, palette.skin[2] + n + shade);
        }

    // Helmet/hat (accent color, 2px taller)
    px(buf, cx, cy - 6, ...palette.accent);
    px(buf, cx + 1, cy - 6, ...palette.accent);
    px(buf, cx - 1, cy - 5, ...palette.accent);
    px(buf, cx, cy - 5, ...palette.accent);
    px(buf, cx + 1, cy - 5, ...palette.accent);
    px(buf, cx + 2, cy - 5, ...palette.accent);

    // Weapon
    switch (weaponType) {
        case 'sword':
            for (let d = 0; d < 8; d++) { px(buf, cx + 4, cy - 3 - d, 190, 190, 195); px(buf, cx + 5, cy - 3 - d, 170, 170, 175); }
            px(buf, cx + 3, cy - 3, 200, 170, 50); px(buf, cx + 6, cy - 3, 200, 170, 50); // crossguard
            px(buf, cx + 4, cy + 1, 80, 55, 30); px(buf, cx + 5, cy + 1, 80, 55, 30); // grip
            break;
        case 'spear':
            for (let d = 0; d < 14; d++) px(buf, cx + 3, cy - 8 + d, 110, 80, 40);
            px(buf, cx + 3, cy - 9, 185, 185, 190); px(buf, cx + 3, cy - 10, 185, 185, 190);
            px(buf, cx + 2, cy - 9, 170, 170, 175);
            break;
        case 'bow':
            for (let d = 0; d < 9; d++) {
                const bx = cx - 5 + Math.round(Math.sin(d * 0.4) * 2);
                px(buf, bx, cy - 4 + d, 110, 75, 35); px(buf, bx + 1, cy - 4 + d, 95, 65, 30);
            }
            // Bowstring
            for (let d = 0; d < 9; d++) px(buf, cx - 4, cy - 4 + d, 180, 170, 150);
            // Arrow nocked
            for (let d = 0; d < 6; d++) px(buf, cx + 2 + d, cy - 1, 130, 95, 45);
            px(buf, cx + 8, cy - 1, 160, 160, 165); // arrowhead
            break;
        case 'crossbow':
            for (let dx = -4; dx <= 4; dx++) { px(buf, cx + dx, cy + 1, 100, 80, 45); px(buf, cx + dx, cy + 2, 90, 72, 40); }
            for (let dy = 0; dy < 4; dy++) { px(buf, cx + 4, cy + dy, 80, 60, 35); px(buf, cx + 5, cy + dy, 75, 55, 30); }
            px(buf, cx, cy, 140, 140, 145); // bolt
            break;
        case 'javelin':
            for (let d = 0; d < 7; d++) px(buf, cx + 4, cy - 4 + d, 120, 90, 48);
            px(buf, cx + 4, cy - 5, 175, 175, 180); px(buf, cx + 4, cy - 6, 175, 175, 180);
            break;
        case 'hammer':
            for (let d = 0; d < 6; d++) px(buf, cx + 4, cy - 1 + d, 95, 70, 38);
            px(buf, cx + 3, cy - 2, 140, 140, 140); px(buf, cx + 4, cy - 2, 150, 150, 150);
            px(buf, cx + 5, cy - 2, 140, 140, 140); px(buf, cx + 4, cy - 3, 130, 130, 130);
            break;
        case 'shield':
            for (let dy = -3; dy <= 3; dy++)
                for (let dx = 0; dx < 3; dx++) {
                    const n = (sr() - 0.5) * 8;
                    px(buf, cx - 5 + dx, cy + dy, palette.accent[0] + n, palette.accent[1] + n, palette.accent[2] + n);
                }
            // Shield boss (center dot)
            px(buf, cx - 4, cy, 220, 200, 80);
            break;
        case 'cannon':
            // Cannon barrel
            for (let dx = -4; dx <= 4; dx++) { px(buf, cx + dx, cy + 7, 55, 52, 48); px(buf, cx + dx, cy + 8, 50, 48, 44); }
            for (let dx = -3; dx <= 3; dx++) px(buf, cx + dx, cy + 6, 65, 62, 55);
            // Wheels
            px(buf, cx - 4, cy + 9, 80, 55, 30); px(buf, cx + 4, cy + 9, 80, 55, 30);
            break;
        case 'club':
            for (let d = 0; d < 6; d++) px(buf, cx + 3, cy - 2 + d, 85, 60, 30);
            px(buf, cx + 3, cy - 3, 100, 75, 40); px(buf, cx + 4, cy - 3, 100, 75, 40);
            break;
    }
}

// ============ GENERATORS ============

function genUnit(name, palette, weapon, sv) {
    const buf = createBuf();
    // No grass base — transparent background, unit only
    drawUnit(buf, palette, weapon, sv + 500);
    // No diamond border — units float over terrain
    return buf;
}

// ============ MAIN ============

async function generateAll() {
    const units = [
        { name: 'unit-knight', palette: PALETTES.knight, weapon: 'sword' },
        { name: 'unit-heavy-infantry', palette: PALETTES.heavyInfantry, weapon: 'shield' },
        { name: 'unit-spearman', palette: PALETTES.spearman, weapon: 'spear' },
        { name: 'unit-archer', palette: PALETTES.archer, weapon: 'bow' },
        { name: 'unit-crossbowman', palette: PALETTES.crossbowman, weapon: 'crossbow' },
        { name: 'unit-skirmisher', palette: PALETTES.skirmisher, weapon: 'javelin' },
        { name: 'unit-engineer', palette: PALETTES.engineer, weapon: 'hammer' },
        { name: 'unit-militia', palette: PALETTES.militia, weapon: 'club' },
        { name: 'unit-artillery', palette: PALETTES.artillery, weapon: 'cannon' },
    ];

    for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const buf = genUnit(u.name, u.palette, u.weapon, 20000 + i * 200);
        await sharp(buf, { raw: { width: TILE_W, height: TILE_H, channels: 4 } })
            .png().toFile(path.join(OUTPUT_DIR, `${u.name}.png`));
        console.log(`  ✓ ${u.name}.png`);
    }
    console.log(`\nDone! ${units.length} unit sprites (64x32, BR→TL).`);
}

generateAll().catch(e => { console.error(e); process.exit(1); });
