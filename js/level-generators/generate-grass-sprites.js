/**
 * Generate procedural terrain tiles:
 *   - grass-short (x2): Open meadow/pasture grass
 *   - grass-flowers (x2): Meadow with wildflowers
 *   - forest (x3): Dense tree canopy (replaces "tall grass")
 *
 * Transition tiles (forest edge ↔ grass):
 *   - grass-trans-left   : forest LEFT, grass right
 *   - grass-trans-right  : forest RIGHT, grass left
 *   - grass-trans-top    : forest TOP, grass bottom
 *   - grass-trans-bottom : forest BOTTOM, grass top
 *   - grass-trans-tl/tr/bl/br : corner transitions
 *
 * Forest tiles use a darker green with circular tree canopy shapes.
 * Transitions have smooth rounded edges.
 */

const sharp = require('sharp');
const path = require('path');

const SIZE = 32;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Grass: open meadow green
const SHORT_COLOR = [82, 142, 55];
// Forest: darker, richer green (tree canopy from above)
const FOREST_COLOR = [32, 72, 28];

const COLORS = {
    shortBase: SHORT_COLOR,
    shortDetail1: [92, 155, 62],
    shortDetail2: [72, 128, 48],
    shortDirt: [100, 80, 45],

    forestBase: FOREST_COLOR,
    forestCanopy1: [38, 82, 32],    // lighter canopy
    forestCanopy2: [26, 62, 22],    // darker shadow
    forestHighlight: [48, 95, 38],  // sun-hit leaves
    forestTrunk: [55, 40, 25],      // glimpse of trunk

    flowerYellow: [235, 205, 55],
    flowerWhite: [230, 230, 215],
    flowerPink: [215, 125, 155],
    flowerCenter: [175, 135, 35],
    flowerStem: [60, 115, 44],
};

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

function fillFlat(buf, baseColor, noiseAmount, seedVal) {
    resetSeed(seedVal);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const n = (seededRandom() - 0.5) * noiseAmount;
            setPixel(buf, x, y, baseColor[0] + n, baseColor[1] + n * 1.1, baseColor[2] + n * 0.9);
        }
    }
}

function drawShortDetail(buf, count, seedVal) {
    resetSeed(seedVal);
    for (let i = 0; i < count; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        const color = seededRandom() > 0.5 ? COLORS.shortDetail1 : COLORS.shortDetail2;
        setPixel(buf, x, y, ...color);
        if (seededRandom() > 0.6) setPixel(buf, x, y - 1, ...color);
    }
}

/**
 * Draw tree canopy circles (top-down view of trees)
 */
function drawTreeCanopies(buf, count, seedVal, region) {
    resetSeed(seedVal);
    for (let i = 0; i < count; i++) {
        const cx = region ? region.x + Math.floor(seededRandom() * region.w) : Math.floor(seededRandom() * SIZE);
        const cy = region ? region.y + Math.floor(seededRandom() * region.h) : Math.floor(seededRandom() * SIZE);
        const radius = 3 + Math.floor(seededRandom() * 4);

        // Draw circular canopy
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= radius) {
                    const px = cx + dx, py = cy + dy;
                    if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
                        let color;
                        if (dist < radius * 0.4) {
                            // Center: highlight (sun hitting top)
                            color = COLORS.forestHighlight;
                        } else if (dist < radius * 0.7) {
                            // Mid: lighter canopy
                            color = COLORS.forestCanopy1;
                        } else {
                            // Edge: darker shadow
                            color = COLORS.forestCanopy2;
                        }
                        const n = (seededRandom() - 0.5) * 4;
                        setPixel(buf, px, py, color[0] + n, color[1] + n, color[2] + n);
                    }
                }
            }
        }

        // Tiny trunk peek (1-2 pixels)
        if (seededRandom() > 0.5) {
            setPixel(buf, cx + 1, cy + radius, ...COLORS.forestTrunk);
            setPixel(buf, cx + 1, cy + radius - 1, ...COLORS.forestTrunk);
        }
    }
}

function drawDirtSpecks(buf, count, seedVal) {
    resetSeed(seedVal);
    for (let i = 0; i < count; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        setPixel(buf, x, y, ...COLORS.shortDirt);
    }
}

function drawFlower(buf, cx, cy, petalColor) {
    setPixel(buf, cx, cy + 1, ...COLORS.flowerStem);
    setPixel(buf, cx, cy + 2, ...COLORS.flowerStem);
    setPixel(buf, cx, cy - 1, ...petalColor);
    setPixel(buf, cx - 1, cy, ...petalColor);
    setPixel(buf, cx + 1, cy, ...petalColor);
    setPixel(buf, cx, cy, ...COLORS.flowerCenter);
    if (seededRandom() > 0.4) setPixel(buf, cx + 1, cy - 1, ...petalColor);
}

/**
 * Smooth boundary mask with gentle curves.
 */
function generateSmoothMask(direction, seedVal) {
    resetSeed(seedVal);
    const mask = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

    const wobbleAmp = 1.5;
    const wobbleFreq = 0.18;
    const phase = seededRandom() * Math.PI * 2;

    if (direction === 'left' || direction === 'right') {
        const center = 15 + seededRandom() * 2;
        for (let y = 0; y < SIZE; y++) {
            const wobble = Math.sin(y * wobbleFreq + phase) * wobbleAmp;
            const bx = Math.round(center + wobble);
            for (let x = 0; x < SIZE; x++) {
                mask[y][x] = (direction === 'left') ? (x < bx) : (x >= SIZE - bx);
            }
        }
    } else if (direction === 'top' || direction === 'bottom') {
        const center = 15 + seededRandom() * 2;
        for (let x = 0; x < SIZE; x++) {
            const wobble = Math.sin(x * wobbleFreq + phase) * wobbleAmp;
            const by = Math.round(center + wobble);
            for (let y = 0; y < SIZE; y++) {
                mask[y][x] = (direction === 'top') ? (y < by) : (y >= SIZE - by);
            }
        }
    } else {
        const radius = SIZE * 0.72 + seededRandom() * 2;
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                let dist;
                switch (direction) {
                    case 'tl': dist = Math.sqrt(x * x + y * y); break;
                    case 'tr': dist = Math.sqrt((SIZE - 1 - x) * (SIZE - 1 - x) + y * y); break;
                    case 'bl': dist = Math.sqrt(x * x + (SIZE - 1 - y) * (SIZE - 1 - y)); break;
                    case 'br': dist = Math.sqrt((SIZE - 1 - x) * (SIZE - 1 - x) + (SIZE - 1 - y) * (SIZE - 1 - y)); break;
                }
                mask[y][x] = dist < radius;
            }
        }
    }
    return mask;
}

/**
 * Fill with smooth blend between forest and grass.
 */
function fillWithSmoothMask(buf, mask, seedVal) {
    resetSeed(seedVal);

    // Compute distance to boundary
    const distMap = Array.from({ length: SIZE }, () => Array(SIZE).fill(99));
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const side = mask[y][x];
            for (let dy = -5; dy <= 5; dy++) {
                for (let dx = -5; dx <= 5; dx++) {
                    const ny = y + dy, nx = x + dx;
                    if (ny >= 0 && ny < SIZE && nx >= 0 && nx < SIZE) {
                        if (mask[ny][nx] !== side) {
                            const d = Math.sqrt(dx * dx + dy * dy);
                            if (d < distMap[y][x]) distMap[y][x] = d;
                        }
                    }
                }
            }
        }
    }

    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const isForest = mask[y][x];
            const dist = distMap[y][x];
            const n = (seededRandom() - 0.5) * 5;

            let r, g, b;
            if (dist <= 5) {
                let t;
                if (isForest) {
                    t = 1 - (dist / 5) * 0.5;
                } else {
                    t = (dist / 5) * 0.5;
                }
                if (!isForest) t = 1 - t;
                r = FOREST_COLOR[0] * t + SHORT_COLOR[0] * (1 - t);
                g = FOREST_COLOR[1] * t + SHORT_COLOR[1] * (1 - t);
                b = FOREST_COLOR[2] * t + SHORT_COLOR[2] * (1 - t);
            } else if (isForest) {
                r = FOREST_COLOR[0]; g = FOREST_COLOR[1]; b = FOREST_COLOR[2];
            } else {
                r = SHORT_COLOR[0]; g = SHORT_COLOR[1]; b = SHORT_COLOR[2];
            }

            setPixel(buf, x, y, r + n, g + n * 1.1, b + n * 0.9);
        }
    }
}

// ============ GENERATORS ============

function generateGrassShort(variant) {
    const buf = createBuffer();
    fillFlat(buf, COLORS.shortBase, 7, 300 + variant * 73);
    drawShortDetail(buf, 22, 400 + variant * 73);
    drawDirtSpecks(buf, 3, 500 + variant * 73);
    return buf;
}

function generateGrassFlowers(variant) {
    const buf = createBuffer();
    fillFlat(buf, COLORS.shortBase, 7, 600 + variant * 73);
    drawShortDetail(buf, 14, 700 + variant * 73);
    resetSeed(800 + variant * 73);
    const clusterCount = 2 + Math.floor(seededRandom() * 2);
    const petalColors = [COLORS.flowerYellow, COLORS.flowerWhite, COLORS.flowerPink];
    for (let c = 0; c < clusterCount; c++) {
        const cx = 6 + Math.floor(seededRandom() * 18);
        const cy = 6 + Math.floor(seededRandom() * 18);
        const color = petalColors[Math.floor(seededRandom() * petalColors.length)];
        for (let f = 0; f < 2 + Math.floor(seededRandom() * 2); f++) {
            drawFlower(buf, cx + Math.floor(seededRandom() * 8) - 4, cy + Math.floor(seededRandom() * 8) - 4, color);
        }
    }
    return buf;
}

function generateForest(variant) {
    const buf = createBuffer();
    // Dark forest floor
    fillFlat(buf, COLORS.forestBase, 4, 900 + variant * 73);
    // Overlapping tree canopies
    drawTreeCanopies(buf, 4 + variant, 1000 + variant * 73, null);
    return buf;
}

function generateTransition(direction) {
    const buf = createBuffer();
    const maskSeed = 2000 + direction.charCodeAt(0) * 17 + direction.length * 53;
    const mask = generateSmoothMask(direction, maskSeed);
    fillWithSmoothMask(buf, mask, 3000 + direction.charCodeAt(0) * 23);

    // Tree canopies on forest side only
    resetSeed(4000 + direction.charCodeAt(0) * 29);
    for (let i = 0; i < 2; i++) {
        const cx = Math.floor(seededRandom() * SIZE);
        const cy = Math.floor(seededRandom() * SIZE);
        if (mask[cy] && mask[cy][cx]) {
            // Only draw if well inside forest side
            let minDist = 99;
            for (let dy = -3; dy <= 3; dy++) {
                for (let dx = -3; dx <= 3; dx++) {
                    const ny = cy + dy, nx = cx + dx;
                    if (ny >= 0 && ny < SIZE && nx >= 0 && nx < SIZE && !mask[ny][nx]) {
                        minDist = Math.min(minDist, Math.sqrt(dx*dx+dy*dy));
                    }
                }
            }
            if (minDist > 4) {
                const radius = 2 + Math.floor(seededRandom() * 3);
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        if (Math.sqrt(dx*dx+dy*dy) <= radius) {
                            const px = cx+dx, py = cy+dy;
                            if (px>=0 && px<SIZE && py>=0 && py<SIZE && mask[py][px]) {
                                const d = Math.sqrt(dx*dx+dy*dy)/radius;
                                const color = d < 0.5 ? COLORS.forestHighlight : COLORS.forestCanopy1;
                                setPixel(buf, px, py, ...color);
                            }
                        }
                    }
                }
            }
        }
    }

    // Grass detail on open side
    resetSeed(5000 + direction.charCodeAt(0) * 31);
    for (let i = 0; i < 6; i++) {
        const x = Math.floor(seededRandom() * SIZE);
        const y = Math.floor(seededRandom() * SIZE);
        if (mask[y] && !mask[y][x]) {
            setPixel(buf, x, y, ...COLORS.shortDetail1);
        }
    }

    return buf;
}

// ============ MAIN ============

async function generateAll() {
    const sprites = [];

    for (let i = 0; i < 2; i++) sprites.push({ name: `grass-short-${i+1}`, gen: () => generateGrassShort(i) });
    for (let i = 0; i < 2; i++) sprites.push({ name: `grass-flowers-${i+1}`, gen: () => generateGrassFlowers(i) });
    for (let i = 0; i < 3; i++) sprites.push({ name: `grass-tall-${i+1}`, gen: () => generateForest(i) });

    const directions = ['left', 'right', 'top', 'bottom', 'tl', 'tr', 'bl', 'br'];
    for (const dir of directions) {
        sprites.push({ name: `grass-trans-${dir}`, gen: () => generateTransition(dir) });
    }

    for (const sprite of sprites) {
        const buf = sprite.gen();
        await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toFile(path.join(OUTPUT_DIR, `${sprite.name}.png`));
        console.log(`  ✓ ${sprite.name}.png`);
    }
    console.log(`\nDone! ${sprites.length} sprites.`);
}

generateAll().catch(err => { console.error(err); process.exit(1); });
