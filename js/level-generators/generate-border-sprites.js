/**
 * Generate border sprites AND border-to-tall-grass transition sprites.
 * 
 * Style: NO gradients. Flat colors with texture details.
 *   - Border: flat grey/brown rocky texture with sharp edge details
 *   - Tall grass: flat dark green with blade details
 *   - Transitions: jagged organic boundary between the two flat colors
 *
 * Border sprites (8):
 *   border-top, border-bottom, border-left, border-right
 *   border-corner-tl, border-corner-tr, border-corner-bl, border-corner-br
 *
 * Border-to-tall-grass transitions (8):
 *   border-tall-left   : border on left, tall grass on right
 *   border-tall-right  : border on right, tall grass on left
 *   border-tall-top    : border on top, tall grass on bottom
 *   border-tall-bottom : border on bottom, tall grass on top
 *   border-tall-tl     : border in top-left corner
 *   border-tall-tr     : border in top-right corner
 *   border-tall-bl     : border in bottom-left corner
 *   border-tall-br     : border in bottom-right corner
 *
 * Usage: node generate-border-sprites.js
 * Requires: sharp
 */

const sharp = require('sharp');
const path = require('path');

const SIZE = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Flat colors - no gradients
const BORDER_COLOR = [58, 48, 36];       // grey-brown rock
const BORDER_DETAIL1 = [72, 60, 45];     // lighter rock detail
const BORDER_DETAIL2 = [42, 35, 26];     // darker crevice
const BORDER_EDGE = [80, 68, 52];        // sharp edge highlight

const TALL_COLOR = [32, 72, 28];         // forest canopy (matches grass-tall/forest)
const TALL_BLADE = [48, 95, 38];        // canopy highlight
const TALL_TIP = [38, 82, 32];          // lighter canopy
const TALL_DETAIL = [26, 62, 22];       // shadow

let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }

function createBuffer() {
    return Buffer.alloc(SIZE * SIZE * 4);
}

function setPixel(buf, x, y, r, g, b, a = 255) {
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    const idx = (y * SIZE + x) * 4;
    buf[idx] = Math.max(0, Math.min(255, Math.round(r)));
    buf[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[idx + 3] = a;
}

/**
 * Fill with flat color + subtle per-pixel noise (no gradient)
 */
function fillFlat(buf, baseColor, noise, seedVal, region) {
    resetSeed(seedVal);
    const x1 = region ? region.x : 0;
    const y1 = region ? region.y : 0;
    const x2 = region ? region.x + region.w - 1 : SIZE - 1;
    const y2 = region ? region.y + region.h - 1 : SIZE - 1;

    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
            const n = (seededRandom() - 0.5) * noise;
            setPixel(buf, x, y,
                baseColor[0] + n,
                baseColor[1] + n * 0.9,
                baseColor[2] + n * 0.8
            );
        }
    }
}

/**
 * Add rocky texture details to border area
 */
function addRockTexture(buf, count, seedVal, region) {
    resetSeed(seedVal);
    for (let i = 0; i < count; i++) {
        const x = region ? region.x + Math.floor(seededRandom() * region.w) : Math.floor(seededRandom() * SIZE);
        const y = region ? region.y + Math.floor(seededRandom() * region.h) : Math.floor(seededRandom() * SIZE);

        // Rock cracks / sharp edges
        const isLight = seededRandom() > 0.5;
        const color = isLight ? BORDER_DETAIL1 : BORDER_DETAIL2;
        setPixel(buf, x, y, ...color);

        // Extend crack in a direction
        const len = 1 + Math.floor(seededRandom() * 3);
        const dx = Math.floor(seededRandom() * 3) - 1;
        const dy = Math.floor(seededRandom() * 3) - 1;
        for (let d = 1; d <= len; d++) {
            setPixel(buf, x + dx * d, y + dy * d, ...color);
        }
    }

    // Add some edge highlights (sharp rock faces)
    resetSeed(seedVal + 500);
    for (let i = 0; i < count / 2; i++) {
        const x = region ? region.x + Math.floor(seededRandom() * region.w) : Math.floor(seededRandom() * SIZE);
        const y = region ? region.y + Math.floor(seededRandom() * region.h) : Math.floor(seededRandom() * SIZE);
        setPixel(buf, x, y, ...BORDER_EDGE);
    }
}

/**
 * Add tall grass blade details
 */
function addTallGrassDetail(buf, count, seedVal, region) {
    resetSeed(seedVal);
    for (let i = 0; i < count; i++) {
        const x = region ? region.x + Math.floor(seededRandom() * region.w) : Math.floor(seededRandom() * SIZE);
        const baseY = region ? region.y + Math.floor(seededRandom() * region.h) : Math.floor(seededRandom() * SIZE);
        const height = 3 + Math.floor(seededRandom() * 4);
        const swayDir = seededRandom() > 0.5 ? 1 : -1;

        for (let d = 0; d < height; d++) {
            const progress = d / height;
            const color = progress > 0.6 ? TALL_TIP : TALL_BLADE;
            const sway = (d > height * 0.5) ? swayDir : 0;
            setPixel(buf, x + sway, baseY - d, ...color);
        }
    }

    // Dark undergrowth dots
    resetSeed(seedVal + 300);
    for (let i = 0; i < count / 2; i++) {
        const x = region ? region.x + Math.floor(seededRandom() * region.w) : Math.floor(seededRandom() * SIZE);
        const y = region ? region.y + Math.floor(seededRandom() * region.h) : Math.floor(seededRandom() * SIZE);
        setPixel(buf, x, y, ...TALL_DETAIL);
    }
}

/**
 * Generate a jagged boundary mask between two zones.
 * Returns mask[y][x] = true means "first color side" (border side).
 */
function generateMask(direction, seedVal) {
    resetSeed(seedVal);
    const mask = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

    if (direction === 'left' || direction === 'right') {
        let bx = 14 + Math.floor(seededRandom() * 4);
        for (let y = 0; y < SIZE; y++) {
            bx += Math.floor(seededRandom() * 3) - 1;
            bx = Math.max(11, Math.min(20, bx));
            for (let x = 0; x < SIZE; x++) {
                mask[y][x] = (direction === 'left') ? (x < bx) : (x >= SIZE - bx);
            }
        }
    } else if (direction === 'top' || direction === 'bottom') {
        let by = 14 + Math.floor(seededRandom() * 4);
        for (let x = 0; x < SIZE; x++) {
            by += Math.floor(seededRandom() * 3) - 1;
            by = Math.max(11, Math.min(20, by));
            for (let y = 0; y < SIZE; y++) {
                mask[y][x] = (direction === 'top') ? (y < by) : (y >= SIZE - by);
            }
        }
    } else {
        // Corner masks
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                const noise = (seededRandom() - 0.5) * 5;
                let inCorner;
                switch (direction) {
                    case 'tl': inCorner = (x + y) < (SIZE - 4 + noise); break;
                    case 'tr': inCorner = ((SIZE - 1 - x) + y) < (SIZE - 4 + noise); break;
                    case 'bl': inCorner = (x + (SIZE - 1 - y)) < (SIZE - 4 + noise); break;
                    case 'br': inCorner = ((SIZE - 1 - x) + (SIZE - 1 - y)) < (SIZE - 4 + noise); break;
                }
                mask[y][x] = inCorner;
            }
        }
    }

    return mask;
}

/**
 * Fill tile using mask: masked area = color1, rest = color2.
 * Add a 1-2px edge highlight at the boundary.
 */
function fillWithMask(buf, mask, color1, color2, noise, seedVal) {
    resetSeed(seedVal);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const isSide1 = mask[y][x];
            const n = (seededRandom() - 0.5) * noise;
            const base = isSide1 ? color1 : color2;

            // Check if at boundary (within 1px of opposite)
            let atEdge = false;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ny = y + dy, nx = x + dx;
                    if (ny >= 0 && ny < SIZE && nx >= 0 && nx < SIZE) {
                        if (mask[ny][nx] !== isSide1) { atEdge = true; break; }
                    }
                }
                if (atEdge) break;
            }

            if (atEdge && isSide1) {
                // Edge highlight on the border/dark side
                setPixel(buf, x, y, BORDER_EDGE[0] + n, BORDER_EDGE[1] + n, BORDER_EDGE[2] + n);
            } else {
                setPixel(buf, x, y, base[0] + n, base[1] + n * 0.9, base[2] + n * 0.8);
            }
        }
    }
}

// ============ PURE BORDER SPRITES ============

function generateBorder(direction) {
    const buf = createBuffer();
    fillFlat(buf, BORDER_COLOR, 8, 5000 + direction.length * 37);
    addRockTexture(buf, 20, 5100 + direction.length * 37);
    return buf;
}

function generateBorderCorner(direction) {
    const buf = createBuffer();
    fillFlat(buf, BORDER_COLOR, 8, 5200 + direction.length * 41);
    addRockTexture(buf, 18, 5300 + direction.length * 41);
    return buf;
}

// ============ BORDER-TO-TALL-GRASS TRANSITIONS ============

function generateBorderTallTransition(direction) {
    const buf = createBuffer();
    const maskSeed = 6000 + direction.length * 53 + direction.charCodeAt(0) * 7;
    const mask = generateMask(direction, maskSeed);

    // Fill: border side (mask=true) and tall grass side (mask=false)
    fillWithMask(buf, mask, BORDER_COLOR, TALL_COLOR, 7, 6500 + direction.length * 53);

    // Add rock texture on border side
    resetSeed(7000 + direction.length * 53);
    for (let i = 0; i < 12; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        if (mask[y] && mask[y][x]) {
            const color = seededRandom() > 0.5 ? BORDER_DETAIL1 : BORDER_DETAIL2;
            setPixel(buf, x, y, ...color);
            const len = 1 + Math.floor(seededRandom() * 2);
            const dx = Math.floor(seededRandom() * 3) - 1;
            for (let d = 1; d <= len; d++) {
                if (mask[y] && mask[y][x + dx * d]) {
                    setPixel(buf, x + dx * d, y, ...color);
                }
            }
        }
    }

    // Add grass blades on tall grass side
    resetSeed(7500 + direction.length * 53);
    for (let i = 0; i < 10; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const baseY = Math.floor(seededRandom() * SIZE);
        if (mask[baseY] && !mask[baseY][x]) {
            const height = 3 + Math.floor(seededRandom() * 3);
            const swayDir = seededRandom() > 0.5 ? 1 : -1;
            for (let d = 0; d < height; d++) {
                const py = baseY - d;
                if (py >= 0 && mask[py] && !mask[py][x]) {
                    const color = (d / height) > 0.6 ? TALL_TIP : TALL_BLADE;
                    const sway = d > height * 0.5 ? swayDir : 0;
                    setPixel(buf, x + sway, py, ...color);
                }
            }
        }
    }

    return buf;
}

// ============ ALSO REGENERATE hill-border (pure border, flat) ============

function generateHillBorder() {
    const buf = createBuffer();
    fillFlat(buf, BORDER_COLOR, 8, 8000);
    addRockTexture(buf, 22, 8100);
    return buf;
}

// ============ MAIN ============

async function generateAll() {
    const sprites = [];

    // Pure border sprites (flat rocky texture, no gradient)
    sprites.push({ name: 'border-top', gen: () => generateBorder('top') });
    sprites.push({ name: 'border-bottom', gen: () => generateBorder('bottom') });
    sprites.push({ name: 'border-left', gen: () => generateBorder('left') });
    sprites.push({ name: 'border-right', gen: () => generateBorder('right') });
    sprites.push({ name: 'border-corner-tl', gen: () => generateBorderCorner('tl') });
    sprites.push({ name: 'border-corner-tr', gen: () => generateBorderCorner('tr') });
    sprites.push({ name: 'border-corner-bl', gen: () => generateBorderCorner('bl') });
    sprites.push({ name: 'border-corner-br', gen: () => generateBorderCorner('br') });

    // Border-to-tall-grass transitions (8 directions)
    const directions = ['left', 'right', 'top', 'bottom', 'tl', 'tr', 'bl', 'br'];
    for (const dir of directions) {
        sprites.push({ name: `border-tall-${dir}`, gen: () => generateBorderTallTransition(dir) });
    }

    // Generic hill-border (fully surrounded border tile)
    sprites.push({ name: 'hill-border', gen: () => generateHillBorder() });

    for (const sprite of sprites) {
        const buf = sprite.gen();
        const outputPath = path.join(OUTPUT_DIR, `${sprite.name}.png`);

        await sharp(buf, {
            raw: { width: SIZE, height: SIZE, channels: 4 }
        })
        .png()
        .toFile(outputPath);

        console.log(`  ✓ ${sprite.name}.png`);
    }

    console.log(`\nDone! ${sprites.length} border sprites generated.`);
}

generateAll().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
