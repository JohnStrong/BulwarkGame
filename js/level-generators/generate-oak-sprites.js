/**
 * Generate oak tree sprites in RPG-maker pixel art style.
 * Based on the middle-left trees in the reference (round leafy canopy,
 * visible trunk, shadow on ground, layered leaf texture).
 *
 * Generates:
 *   - oak-large-1.png (64x64, 2x2 tiles) - Large oak tree
 *   - oak-large-2.png (64x64, 2x2 tiles) - Large oak variant
 *   - oak-large-3.png (64x64, 2x2 tiles) - Large oak variant
 *
 * Style: Front-facing RPG view (not pure top-down).
 *   - Trunk visible at bottom center
 *   - Round/bulbous canopy fills upper 2/3
 *   - Layered leaf clusters with light/dark variation
 *   - Ground shadow beneath
 *   - Grass background visible around edges
 */

const sharp = require('sharp');
const path = require('path');

const TILE = 32;
const S = TILE * 2; // 64x64
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Colors matching the reference image (middle-left green oaks)
const GRASS = [82, 142, 55];

const TRUNK = [75, 48, 28];
const TRUNK_DARK = [55, 35, 18];
const TRUNK_LIGHT = [95, 62, 35];
const TRUNK_HIGHLIGHT = [110, 75, 42];

const LEAF_DARK = [28, 75, 25];       // deepest shadow in canopy
const LEAF_MID = [45, 105, 38];       // main leaf color
const LEAF_LIGHT = [65, 135, 50];     // lighter leaves (sun-facing)
const LEAF_HIGHLIGHT = [90, 160, 62]; // brightest highlights
const LEAF_EDGE = [35, 85, 30];       // canopy edge/outline

const SHADOW = [55, 100, 40];         // ground shadow (darker grass)

let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }

function createBuffer() { return Buffer.alloc(S * S * 4); }

function setPixel(buf, x, y, r, g, b, a = 255) {
    if (x < 0 || x >= S || y < 0 || y >= S) return;
    const idx = (y * S + x) * 4;
    buf[idx] = Math.max(0, Math.min(255, Math.round(r)));
    buf[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[idx + 3] = a;
}

function fillGrass(buf, seedVal) {
    resetSeed(seedVal);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const n = (seededRandom() - 0.5) * 5;
            setPixel(buf, x, y, GRASS[0] + n, GRASS[1] + n, GRASS[2] + n);
        }
    }
}

/**
 * Draw an elliptical filled shape with per-pixel noise
 */
function fillEllipse(buf, cx, cy, rx, ry, color, noise, seedVal) {
    resetSeed(seedVal);
    for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
            const dist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
            if (dist <= 1.0) {
                const n = (seededRandom() - 0.5) * noise;
                setPixel(buf, cx + dx, cy + dy, color[0] + n, color[1] + n, color[2] + n);
            }
        }
    }
}

/**
 * Draw leaf clusters - overlapping circles of varying green shades
 * to create the layered, textured canopy look from the reference.
 */
function drawLeafClusters(buf, cx, cy, canopyRx, canopyRy, count, seedVal) {
    resetSeed(seedVal);

    for (let i = 0; i < count; i++) {
        // Random position within canopy bounds
        const angle = seededRandom() * Math.PI * 2;
        const dist = seededRandom() * 0.8;
        const clusterX = Math.round(cx + Math.cos(angle) * canopyRx * dist);
        const clusterY = Math.round(cy + Math.sin(angle) * canopyRy * dist * 0.9);
        const clusterR = 4 + Math.floor(seededRandom() * 6);

        // Determine shade based on position (upper = lighter, lower/edge = darker)
        const verticalPos = (clusterY - (cy - canopyRy)) / (canopyRy * 2); // 0=top, 1=bottom
        const horizontalPos = (clusterX - cx) / canopyRx; // -1=left, 1=right

        let baseColor;
        if (verticalPos < 0.3 && horizontalPos > -0.3) {
            baseColor = LEAF_HIGHLIGHT; // top-right gets highlights
        } else if (verticalPos < 0.5) {
            baseColor = LEAF_LIGHT;
        } else if (verticalPos > 0.75) {
            baseColor = LEAF_DARK;
        } else {
            baseColor = LEAF_MID;
        }

        // Draw cluster as a rough circle with leaf-like texture
        for (let dy = -clusterR; dy <= clusterR; dy++) {
            for (let dx = -clusterR; dx <= clusterR; dx++) {
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d <= clusterR) {
                    const px = clusterX + dx, py = clusterY + dy;
                    // Check if within overall canopy
                    const cdx = (px - cx) / canopyRx;
                    const cdy = (py - cy) / canopyRy;
                    if (cdx * cdx + cdy * cdy > 1.05) continue;

                    const n = (seededRandom() - 0.5) * 12;
                    // Edge of cluster is darker
                    const edgeFactor = d / clusterR;
                    const r = baseColor[0] + n - edgeFactor * 8;
                    const g = baseColor[1] + n - edgeFactor * 10;
                    const b = baseColor[2] + n - edgeFactor * 6;
                    setPixel(buf, px, py, r, g, b);
                }
            }
        }
    }
}

/**
 * Draw canopy outline (darker edge pixels) for definition
 */
function drawCanopyOutline(buf, cx, cy, rx, ry, seedVal) {
    resetSeed(seedVal);
    for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
        const wobble = (seededRandom() - 0.5) * 3;
        const ex = Math.round(cx + Math.cos(angle) * (rx + wobble));
        const ey = Math.round(cy + Math.sin(angle) * (ry + wobble));
        const n = (seededRandom() - 0.5) * 4;
        setPixel(buf, ex, ey, LEAF_EDGE[0] + n, LEAF_EDGE[1] + n, LEAF_EDGE[2] + n);
        // Slightly thicker outline
        setPixel(buf, ex + 1, ey, LEAF_EDGE[0] + n, LEAF_EDGE[1] + n, LEAF_EDGE[2] + n);
    }
}

/**
 * Draw tree trunk (visible below canopy)
 */
function drawTrunk(buf, cx, baseY, trunkW, trunkH, seedVal) {
    resetSeed(seedVal);
    const halfW = Math.floor(trunkW / 2);

    for (let y = baseY - trunkH; y <= baseY; y++) {
        // Trunk gets slightly wider at base
        const progress = (y - (baseY - trunkH)) / trunkH;
        const w = halfW + Math.floor(progress * 2);

        for (let dx = -w; dx <= w; dx++) {
            const n = (seededRandom() - 0.5) * 6;
            // Left side darker, right side lighter (light from right)
            const shade = dx < 0 ? TRUNK_DARK : (dx > w - 2 ? TRUNK_HIGHLIGHT : TRUNK);
            setPixel(buf, cx + dx, y, shade[0] + n, shade[1] + n, shade[2] + n);
        }
    }

    // Bark texture lines
    resetSeed(seedVal + 500);
    for (let i = 0; i < 5; i++) {
        const lx = cx - halfW + Math.floor(seededRandom() * trunkW);
        const ly = baseY - trunkH + Math.floor(seededRandom() * trunkH);
        const len = 2 + Math.floor(seededRandom() * 4);
        for (let d = 0; d < len; d++) {
            setPixel(buf, lx, ly + d, ...TRUNK_DARK);
        }
    }
}

/**
 * Draw ground shadow (ellipse beneath tree)
 */
function drawShadow(buf, cx, baseY, rx, ry, seedVal) {
    resetSeed(seedVal);
    for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
            const dist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
            if (dist <= 1.0) {
                const px = cx + dx, py = baseY + dy;
                if (px >= 0 && px < S && py >= 0 && py < S) {
                    const n = (seededRandom() - 0.5) * 3;
                    // Blend shadow with grass
                    const alpha = (1 - dist) * 0.5;
                    const idx = (py * S + px) * 4;
                    const existR = buf[idx], existG = buf[idx + 1], existB = buf[idx + 2];
                    setPixel(buf, px, py,
                        existR * (1 - alpha) + SHADOW[0] * alpha + n,
                        existG * (1 - alpha) + SHADOW[1] * alpha + n,
                        existB * (1 - alpha) + SHADOW[2] * alpha + n
                    );
                }
            }
        }
    }
}

// ============ GENERATE OAK VARIANTS ============

function generateOakLarge(variant) {
    const buf = createBuffer();
    fillGrass(buf, 50000 + variant * 1000);

    // Tree parameters vary slightly per variant
    resetSeed(50100 + variant * 1000);
    const trunkCx = 32 + Math.floor(seededRandom() * 2 - 1);
    const trunkBaseY = 54 + Math.floor(seededRandom() * 2);
    const trunkW = 6 + Math.floor(seededRandom() * 2);
    const trunkH = 14 + Math.floor(seededRandom() * 4);

    const canopyCx = trunkCx + Math.floor(seededRandom() * 3 - 1);
    const canopyCy = 24 + Math.floor(seededRandom() * 3 - 1);
    const canopyRx = 20 + Math.floor(seededRandom() * 4);
    const canopyRy = 17 + Math.floor(seededRandom() * 3);

    // 1. Ground shadow
    drawShadow(buf, trunkCx + 4, trunkBaseY + 3, 18, 6, 50200 + variant * 1000);

    // 2. Trunk
    drawTrunk(buf, trunkCx, trunkBaseY, trunkW, trunkH, 50300 + variant * 1000);

    // 3. Base canopy fill (solid dark green)
    fillEllipse(buf, canopyCx, canopyCy, canopyRx, canopyRy, LEAF_MID, 6, 50400 + variant * 1000);

    // 4. Leaf clusters (layered texture)
    drawLeafClusters(buf, canopyCx, canopyCy, canopyRx, canopyRy, 20 + variant * 3, 50500 + variant * 1000);

    // 5. Canopy outline
    drawCanopyOutline(buf, canopyCx, canopyCy, canopyRx, canopyRy, 50600 + variant * 1000);

    // 6. Final highlight dots on top
    resetSeed(50700 + variant * 1000);
    for (let i = 0; i < 8; i++) {
        const hx = canopyCx - 8 + Math.floor(seededRandom() * 16);
        const hy = canopyCy - canopyRy + 3 + Math.floor(seededRandom() * 10);
        setPixel(buf, hx, hy, ...LEAF_HIGHLIGHT);
        setPixel(buf, hx + 1, hy, ...LEAF_HIGHLIGHT);
        setPixel(buf, hx, hy + 1, ...LEAF_LIGHT);
    }

    return buf;
}

// ============ MAIN ============

async function generateAll() {
    const sprites = [];

    for (let i = 0; i < 3; i++) {
        sprites.push({ name: `oak-large-${i + 1}`, buf: generateOakLarge(i) });
    }

    for (const sprite of sprites) {
        await sharp(sprite.buf, { raw: { width: S, height: S, channels: 4 } })
            .png().toFile(path.join(OUTPUT_DIR, `${sprite.name}.png`));
        console.log(`  ✓ ${sprite.name}.png (${S}x${S})`);
    }
    console.log('\nDone!');
}

generateAll().catch(err => { console.error(err); process.exit(1); });
