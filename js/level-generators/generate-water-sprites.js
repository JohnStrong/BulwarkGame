/**
 * Generate water tiles and water-to-land transition sprites.
 *
 * Water tiles:
 *   - water-1, water-2, water-3 : blue/azure flat water with subtle ripple texture
 *
 * Water-to-land transitions (water side → short grass side):
 *   - water-land-left   : water on left, grass on right
 *   - water-land-right  : water on right, grass on left
 *   - water-land-top    : water on top, grass below
 *   - water-land-bottom : water on bottom, grass above
 *   - water-land-tl     : water in top-left corner
 *   - water-land-tr     : water in top-right corner
 *   - water-land-bl     : water in bottom-left corner
 *   - water-land-br     : water in bottom-right corner
 *
 * Style: flat color base + texture details, no gradients.
 * Jagged organic boundary on transitions (like the grass transitions).
 *
 * Usage: node generate-water-sprites.js
 * Requires: sharp
 */

const sharp = require('sharp');
const path = require('path');

const SIZE = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Colors
const WATER_COLOR = [45, 100, 150];       // deep azure blue
const WATER_LIGHT = [60, 125, 175];       // lighter ripple
const WATER_DARK = [35, 80, 130];         // darker depth
const WATER_FOAM = [155, 115, 65];        // orangey-brown sand/beach edge

const GRASS_COLOR = [78, 138, 54];        // matches grass-short base
const GRASS_DETAIL = [88, 152, 62];       // matches grass-short detail

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
                baseColor[1] + n * 1.1,
                baseColor[2] + n * 0.9
            );
        }
    }
}

/**
 * Add water ripple texture: small horizontal streaks
 */
function addRipples(buf, count, seedVal, region) {
    resetSeed(seedVal);
    for (let i = 0; i < count; i++) {
        const x = region ? region.x + Math.floor(seededRandom() * region.w) : Math.floor(seededRandom() * SIZE);
        const y = region ? region.y + Math.floor(seededRandom() * region.h) : Math.floor(seededRandom() * SIZE);
        const len = 2 + Math.floor(seededRandom() * 4);
        const isLight = seededRandom() > 0.4;
        const color = isLight ? WATER_LIGHT : WATER_DARK;

        for (let d = 0; d < len; d++) {
            setPixel(buf, x + d, y, ...color);
        }
    }
}

/**
 * Add short grass detail marks on land side
 */
function addGrassDetail(buf, count, seedVal, region) {
    resetSeed(seedVal);
    for (let i = 0; i < count; i++) {
        const x = region ? region.x + Math.floor(seededRandom() * region.w) : Math.floor(seededRandom() * SIZE);
        const y = region ? region.y + Math.floor(seededRandom() * region.h) : Math.floor(seededRandom() * SIZE);
        setPixel(buf, x, y, ...GRASS_DETAIL);
        if (seededRandom() > 0.6) setPixel(buf, x, y - 1, ...GRASS_DETAIL);
    }
}

/**
 * Generate jagged boundary mask.
 * mask[y][x] = true means "water side".
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
        // Corner
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

// ============ GENERATORS ============

function generateWater(variant) {
    const buf = createBuffer();
    fillFlat(buf, WATER_COLOR, 6, 9000 + variant * 67);
    addRipples(buf, 12, 9100 + variant * 67);
    return buf;
}

function generateWaterLandTransition(direction) {
    const buf = createBuffer();
    const maskSeed = 9500 + direction.length * 43 + direction.charCodeAt(0) * 11;
    const mask = generateMask(direction, maskSeed);

    // Fill based on mask
    resetSeed(9700 + direction.length * 43);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const isWater = mask[y][x];
            const n = (seededRandom() - 0.5) * 6;

            // Check if at boundary
            let atEdge = false;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ny = y + dy, nx = x + dx;
                    if (ny >= 0 && ny < SIZE && nx >= 0 && nx < SIZE) {
                        if (mask[ny][nx] !== isWater) { atEdge = true; break; }
                    }
                }
                if (atEdge) break;
            }

            if (atEdge) {
                // Foam/sand edge
                setPixel(buf, x, y, WATER_FOAM[0] + n, WATER_FOAM[1] + n, WATER_FOAM[2] + n);
            } else if (isWater) {
                setPixel(buf, x, y, WATER_COLOR[0] + n, WATER_COLOR[1] + n * 1.1, WATER_COLOR[2] + n * 0.9);
            } else {
                setPixel(buf, x, y, GRASS_COLOR[0] + n, GRASS_COLOR[1] + n * 1.1, GRASS_COLOR[2] + n * 0.9);
            }
        }
    }

    // Add ripples on water side
    resetSeed(9800 + direction.length * 43);
    for (let i = 0; i < 6; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        if (mask[y] && mask[y][x]) {
            // Check not at edge
            let nearEdge = false;
            for (let d = -2; d <= 2; d++) {
                const nx = x + d;
                if (nx >= 0 && nx < SIZE && mask[y] && !mask[y][nx]) { nearEdge = true; break; }
            }
            if (!nearEdge) {
                const len = 2 + Math.floor(seededRandom() * 3);
                const color = seededRandom() > 0.5 ? WATER_LIGHT : WATER_DARK;
                for (let d = 0; d < len; d++) {
                    if (mask[y] && mask[y][x + d]) setPixel(buf, x + d, y, ...color);
                }
            }
        }
    }

    // Add grass detail on land side
    resetSeed(9900 + direction.length * 43);
    for (let i = 0; i < 8; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        if (mask[y] && !mask[y][x]) {
            setPixel(buf, x, y, ...GRASS_DETAIL);
            if (seededRandom() > 0.5) setPixel(buf, x, y - 1, ...GRASS_DETAIL);
        }
    }

    return buf;
}

// ============ MAIN ============

async function generateAll() {
    const sprites = [];

    // 3 water variants
    for (let i = 0; i < 3; i++) {
        sprites.push({ name: `water-${i + 1}`, gen: () => generateWater(i) });
    }

    // 8 water-to-land transitions
    const directions = ['left', 'right', 'top', 'bottom', 'tl', 'tr', 'bl', 'br'];
    for (const dir of directions) {
        sprites.push({ name: `water-land-${dir}`, gen: () => generateWaterLandTransition(dir) });
    }

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

    console.log(`\nDone! ${sprites.length} water sprites generated.`);
}

generateAll().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
