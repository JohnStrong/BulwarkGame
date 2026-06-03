/**
 * Castle wall overlay sprites — isometric cobblestone wall faces.
 *
 * Visual design
 * ─────────────
 * The ground tile is a 64×32 flat isometric diamond.  A "wall overlay" adds
 * the vertical stone faces that make the tile look like a raised Minecraft
 * block.  Two faces are visible from the BR→TL viewpoint:
 *
 *        (32, 0) ← top of diamond
 *       /         \
 *     (0,16)     (63,16)    ← left/right vertices of diamond
 *       \         /
 *        (32,32)             ← bottom vertex of diamond  ← canvas row FACE_H
 *       /         \
 *   LEFT FACE   RIGHT FACE   ← vertical cobblestone sides, each FACE_H tall
 *       \         /
 *        (32, FACE_H*2+32)  ← bottom of canvas
 *
 * Canvas layout (64 × canvasH, transparent background):
 *
 *   rows 0 .. FACE_H-1        : fully transparent  (above the diamond top)
 *   rows FACE_H .. FACE_H+TOP_H-1 : transparent ground connector rows
 *                                   (these overlap the top of the ground tile)
 *   rows FACE_H+TOP_H .. end  : left + right cobblestone face pixels
 *
 * Wait — simpler model that works with the existing OVERLAY_HEIGHT=48 system:
 *
 *   canvasH = TOP_H + blockCount × FACE_H   where TOP_H=32, FACE_H=16
 *
 *   The overlay is positioned by the renderer using:
 *     overlayY = (y - camera.tileH/2) - (overlayHeight - camera.tileH) + offsetY
 *   which places the top of the canvas above the tile, and the bottom FACE_H
 *   rows coincide with the lower half of the ground diamond.
 *
 *   So the BOTTOM FACE_H rows of the canvas align with the ground tile.
 *   The side-face pixels live in rows 0 .. (canvasH - FACE_H - 1).
 *   The transparent connector strip occupies rows (canvasH - FACE_H) .. (canvasH-1).
 *
 * Cobblestone style (see attached reference image)
 * ────────────────────────────────────────────────
 * Large rounded boulders (≈14×10 px each), 2-px dark mortar gaps,
 * occasional moss-green pixel between stones.  Three brightness levels:
 *   highlight centre, mid stone, shadow edges.
 * Directional light comes from top-left (left face = medium, right face = dark).
 *
 * Usage:
 *   node js/level-generators/generate-castle-block-sprites.js
 */

'use strict';

const sharp  = require('sharp');
const path   = require('path');

const { OUTPUT_DIR }              = require('./lib/sprite-constants');
const { seededRandom, resetSeed } = require('./lib/pixel-utils');
const { quantizeToPalette }       = require('./lib/palette-quantizer');
const { getPaletteForCategory }   = require('./lib/palette');

// ─── Canvas geometry constants ───────────────────────────────────────────────

const W      = 64;   // canvas width — always matches tile width
const TOP_H  = 32;   // ground-tile diamond height (transparent connector)
const FACE_H = 16;   // height of ONE block of side faces

// ─── Cobblestone colour palette ──────────────────────────────────────────────
// Reference: rounded grey boulders with dark mortar and green moss accents.

// Stone tones — three levels of brightness for the rounded boulder look
const STONE_HI   = [185, 185, 175];  // highlight centre of each stone
const STONE_MID  = [148, 148, 138];  // main body of each stone
const STONE_SHAD = [102, 102,  94];  // shadow edges of each stone
const MORTAR     = [ 42,  40,  36];  // dark mortar gap between stones
const MOSS       = [ 72,  95,  52];  // occasional green moss in mortar

// Left-face tones (receives some sunlight — slightly brighter)
const L_HI   = [178, 178, 168];
const L_MID  = [142, 142, 132];
const L_SHAD = [ 96,  96,  88];

// Right-face tones (shadow face — noticeably darker)
const R_HI   = [145, 145, 135];
const R_MID  = [112, 112, 104];
const R_SHAD = [ 76,  76,  70];

const OUTLINE = [24, 22, 18];       // 1-px dark border

const CASTLE_PALETTE = getPaletteForCategory('castle');

// ─── Buffer helpers ──────────────────────────────────────────────────────────

function createBlockBuffer(h) {
    return Buffer.alloc(W * h * 4, 0);
}

function pset(buf, h, x, y, r, g, b) {
    if (x < 0 || x >= W || y < 0 || y >= h) return;
    const i = (y * W + x) * 4;
    buf[i]     = Math.max(0, Math.min(255, Math.round(r)));
    buf[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[i + 3] = 255;
}

function getAlpha(buf, h, x, y) {
    if (x < 0 || x >= W || y < 0 || y >= h) return 0;
    return buf[(y * W + x) * 4 + 3];
}

// ─── Cobblestone face painter ─────────────────────────────────────────────────

/**
 * Paint a cobblestone wall face into a rectangular region of the buffer.
 *
 * Stones are large (≈14 wide × 10 tall), staggered per row, with 2-px mortar
 * gaps and occasional moss pixels.  Each stone has a brighter highlight in its
 * centre and darker shadow edges, giving a rounded boulder appearance.
 *
 * @param {Buffer} buf
 * @param {number} canvasH
 * @param {number} x0      Left edge of the face region
 * @param {number} y0      Top edge of the face region
 * @param {number} fw      Width of the face region
 * @param {number} fh      Height of the face region
 * @param {number[]} stHi  Highlight colour [r,g,b]
 * @param {number[]} stMid Mid colour [r,g,b]
 * @param {number[]} stShad Shadow colour [r,g,b]
 * @param {number} seed
 */
function paintCobbleFace(buf, canvasH, x0, y0, fw, fh, stHi, stMid, stShad, seed) {
    resetSeed(seed);

    const STONE_W = 14;   // nominal stone width
    const STONE_H = 10;   // nominal stone height
    const GAP     =  2;   // mortar thickness

    // First flood-fill the entire face region with MORTAR colour
    for (let fy = 0; fy < fh; fy++) {
        for (let fx = 0; fx < fw; fx++) {
            pset(buf, canvasH, x0 + fx, y0 + fy, MORTAR[0], MORTAR[1], MORTAR[2]);
        }
    }

    // Scatter moss pixels in the mortar zone (≈5% of mortar pixels)
    resetSeed(seed + 500);
    for (let fy = 0; fy < fh; fy++) {
        for (let fx = 0; fx < fw; fx++) {
            if (seededRandom() < 0.05) {
                pset(buf, canvasH, x0 + fx, y0 + fy, MOSS[0], MOSS[1], MOSS[2]);
            }
        }
    }

    // Draw staggered rows of rounded stones
    resetSeed(seed + 1000);
    let row = 0;
    for (let sy = GAP; sy < fh - STONE_H; sy += STONE_H + GAP) {
        // Alternate stagger: even rows start at 0, odd rows start at STONE_W/2+GAP
        const stagger = (row % 2 === 0) ? 0 : Math.floor((STONE_W + GAP) / 2);
        row++;

        for (let sx = stagger - Math.floor(STONE_W / 2);
             sx < fw;
             sx += STONE_W + GAP) {

            // Stone size varies slightly per instance
            const sw = STONE_W - 2 + Math.floor(seededRandom() * 4);
            const sh = STONE_H - 2 + Math.floor(seededRandom() * 3);

            // Draw each pixel of the stone
            for (let dy = 0; dy < sh; dy++) {
                for (let dx = 0; dx < sw; dx++) {
                    const px = x0 + sx + dx;
                    const py = y0 + sy + dy;

                    // Skip out-of-bounds face pixels
                    if (px < x0 || px >= x0 + fw || py < y0 || py >= y0 + fh) continue;

                    // Rounded corners: skip the 2×2 pixel corner squares
                    if ((dx < 2 || dx >= sw - 2) && (dy < 2 || dy >= sh - 2)) continue;
                    if ((dx < 1 || dx >= sw - 1) && (dy < 1 || dy >= sh - 1)) continue;

                    // Brightness: centre is highlight, edges/border are shadow
                    const cx = sw / 2, cy = sh / 2;
                    const dist = Math.sqrt((dx - cx) * (dx - cx) / (cx * cx) +
                                           (dy - cy) * (dy - cy) / (cy * cy));

                    const noise = (seededRandom() - 0.5) * 14;
                    let col;
                    if (dist < 0.35) {
                        col = stHi;
                    } else if (dist < 0.72) {
                        col = stMid;
                    } else {
                        col = stShad;
                    }
                    pset(buf, canvasH, px, py,
                        col[0] + noise, col[1] + noise, col[2] + noise);
                }
            }
        }
    }
}

// ─── Outline pass ─────────────────────────────────────────────────────────────

function applyOutline(buf, canvasH) {
    const edges = [];
    for (let y = 0; y < canvasH; y++) {
        for (let x = 0; x < W; x++) {
            if (getAlpha(buf, canvasH, x, y) === 0) continue;
            let isEdge = false;
            outer: for (let dy = -1; dy <= 1 && !isEdge; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (getAlpha(buf, canvasH, x + dx, y + dy) === 0) {
                        isEdge = true; break outer;
                    }
                }
            }
            if (isEdge) edges.push(x, y);
        }
    }
    for (let i = 0; i < edges.length; i += 2) {
        pset(buf, canvasH, edges[i], edges[i + 1], OUTLINE[0], OUTLINE[1], OUTLINE[2]);
    }
}

// ─── Isometric face geometry ──────────────────────────────────────────────────
//
// For the BR→TL viewpoint, looking at the face region BELOW the diamond:
//
//   The diamond bottom-left edge runs from (0, FACE_H) to (32, 2×FACE_H).
//   The diamond bottom-right edge runs from (32, 2×FACE_H) to (63, FACE_H).
//
// Wait — we're working in the overlay canvas coordinate system, where
// the TOP of the canvas is the TOP of the diamond, not the bottom.
// The ground connector (TOP_H rows at the bottom of the canvas) overlaps
// the actual ground tile.  The wall faces sit ABOVE this connector.
//
// Canvas rows in the face area (rows 0 .. faceTotalH-1):
//   The LEFT face trapezoid and RIGHT face trapezoid share the same row range.
//   Row 0 = top of the face area = widest row.
//   Row faceTotalH-1 = bottom of the face area = meets the diamond.
//
// LEFT face per row r (0-based):
//   x left  = r          (grows from 0 inward)
//   x right = 31         (fixed: centre seam)
//
// RIGHT face per row r:
//   x left  = 32         (fixed: centre seam)
//   x right = 63 - r     (shrinks from 63 inward)
//
// This gives the classic Minecraft-iso side-face trapezoid shape.

/**
 * Draw the isometric left and right wall faces for `blockCount` blocks.
 *
 * The face area occupies rows 0 .. (blockCount * FACE_H - 1) in the canvas.
 * Below that, `TOP_H` rows are left transparent (ground connector).
 *
 * @param {Buffer} buf
 * @param {number} canvasH
 * @param {number} blockCount
 * @param {number} seed
 */
function drawWallFaces(buf, canvasH, blockCount, seed) {
    const faceTotalH = blockCount * FACE_H;  // total pixel rows of side faces
    // The face area starts at y=0 in the canvas.
    // The transparent ground connector is rows faceTotalH .. canvasH-1.

    // ── Paint each pixel of the left and right trapezoid faces ────────────
    // We build a lookup: for each canvas row y (0..faceTotalH-1),
    // what x range is the left face, what is the right face?
    //
    // Each "block layer" has FACE_H rows.  Within a layer, row r (0..FACE_H-1):
    //   left  face: x = [r, 31]
    //   right face: x = [32, 63-r]

    for (let block = 0; block < blockCount; block++) {
        const yBase = block * FACE_H;   // top row of this block layer in the canvas

        for (let r = 0; r < FACE_H; r++) {
            const y = yBase + r;

            // Left face row: x from r to 31 (inclusive)
            const lxLeft  = r;
            const lxRight = 31;

            // Right face row: x from 32 to 63-r (inclusive)
            const rxLeft  = 32;
            const rxRight = 63 - r;

            // Paint left face pixels individually — cobblestone texture
            for (let x = lxLeft; x <= lxRight; x++) {
                // Use a seeded noise value for each pixel
                resetSeed(seed + block * 10000 + y * 100 + x);
                const noise = (seededRandom() - 0.5) * 16;

                // Mortar on the top edge of each block layer and at stone joints
                const isMortarH = (r === 0 || r === FACE_H - 1);
                const stoneCol  = Math.floor((x - r) / 8) + (r < FACE_H / 2 ? 0 : 1);
                const isMortarV = ((x - r) % 8 === 0);

                if (isMortarH || isMortarV) {
                    pset(buf, canvasH, x, y, MORTAR[0], MORTAR[1], MORTAR[2]);
                    // Chance of moss in mortar
                    if (seededRandom() < 0.08) {
                        pset(buf, canvasH, x, y, MOSS[0], MOSS[1], MOSS[2]);
                    }
                } else {
                    // Stone pixel: brightness depends on distance from stone centre
                    const localX   = (x - r) % 8;
                    const stoneMid = 4;
                    const dist     = Math.abs(localX - stoneMid) / stoneMid +
                                     Math.abs(r - FACE_H / 2) / (FACE_H / 2);
                    let col;
                    if (dist < 0.4) col = L_HI;
                    else if (dist < 0.8) col = L_MID;
                    else col = L_SHAD;
                    pset(buf, canvasH, x, y,
                        col[0] + noise, col[1] + noise, col[2] + noise);
                }
            }

            // Paint right face pixels
            for (let x = rxLeft; x <= rxRight; x++) {
                resetSeed(seed + block * 10000 + y * 100 + x + 50000);
                const noise = (seededRandom() - 0.5) * 12;

                const isMortarH = (r === 0 || r === FACE_H - 1);
                const localX    = (x - rxLeft) % 8;
                const isMortarV = (localX === 0);

                if (isMortarH || isMortarV) {
                    pset(buf, canvasH, x, y, MORTAR[0], MORTAR[1], MORTAR[2]);
                    if (seededRandom() < 0.06) {
                        pset(buf, canvasH, x, y, MOSS[0], MOSS[1], MOSS[2]);
                    }
                } else {
                    const stoneMid = 4;
                    const dist     = Math.abs(localX - stoneMid) / stoneMid +
                                     Math.abs(r - FACE_H / 2) / (FACE_H / 2);
                    let col;
                    if (dist < 0.4) col = R_HI;
                    else if (dist < 0.8) col = R_MID;
                    else col = R_SHAD;
                    pset(buf, canvasH, x, y,
                        col[0] + noise, col[1] + noise, col[2] + noise);
                }
            }
        }
    }
}

// ─── Public generator ─────────────────────────────────────────────────────────

/**
 * Generate a Minecraft-style isometric cobblestone wall overlay.
 *
 * Canvas: 64 × canvasH   where canvasH = blockCount × FACE_H + TOP_H
 *
 * Layout:
 *   rows 0 .. (blockCount*FACE_H - 1)          : left + right cobblestone faces
 *   rows (blockCount*FACE_H) .. (canvasH - 1)  : fully transparent connector
 *                                                (overlaps the ground tile top)
 *
 * The renderer positions this overlay so the transparent connector rows sit on
 * top of the ground diamond — making the wall look like it grows out of it.
 *
 * @param {number} [blockCount=1]  Number of block heights (1 = wall, 2 = tower, 3 = gatehouse).
 * @param {number} [seed=1000]     PRNG seed for texture variation.
 * @returns {Buffer}  RGBA pixel buffer, 64 × canvasH × 4 bytes.
 */
function generateBlockOverlay(blockCount = 1, seed = 1000) {
    const canvasH = blockCount * FACE_H + TOP_H;
    const buf     = createBlockBuffer(canvasH);

    // Draw the cobblestone side faces into the top part of the canvas.
    drawWallFaces(buf, canvasH, blockCount, seed);

    // The bottom TOP_H rows remain fully transparent (ground connector).

    applyOutline(buf, canvasH);
    quantizeToPalette(buf, CASTLE_PALETTE);

    return buf;
}

/**
 * Compute the canvas height for a given block count.
 * @param {number} blockCount
 * @returns {number}
 */
function canvasHeightForBlocks(blockCount) {
    return blockCount * FACE_H + TOP_H;
}

// ─── Sprite definitions ───────────────────────────────────────────────────────

const SPRITE_DEFS = [
    // ── Walls (1 block, 64×48) ──────────────────────────────────────────────
    { name: 'castle-wall-overlay',               blockCount: 1, seed: 1000 },
    { name: 'castle-wall-damaged-overlay',       blockCount: 1, seed: 1100 },
    // Shared iso-wall overlay used by W / T / K / j / J / G tiles
    { name: 'castle-iso-wall-overlay',           blockCount: 1, seed: 1200 },
    { name: 'castle-iso-wall-damaged-overlay',   blockCount: 1, seed: 1300 },
    // ── Bridges (1 block, 64×48) ────────────────────────────────────────────
    { name: 'bridge-mm-overlay',                 blockCount: 1, seed: 2000 },
    { name: 'castle-bridge-start-overlay',       blockCount: 1, seed: 2100 },
    { name: 'castle-bridge-mid-overlay',         blockCount: 1, seed: 2200 },
    { name: 'castle-bridge-gate-overlay',        blockCount: 1, seed: 2300 },
    // ── Tower (2 blocks, 64×64) ─────────────────────────────────────────────
    { name: 'castle-tower-overlay',              blockCount: 2, seed: 3000 },
    { name: 'castle-tower-damaged-overlay',      blockCount: 2, seed: 3100 },
    // ── Keep quadrants (2 blocks, 64×64) ────────────────────────────────────
    { name: 'castle-keep-tl-overlay',            blockCount: 2, seed: 4000 },
    { name: 'castle-keep-tl-damaged-overlay',    blockCount: 2, seed: 4100 },
    { name: 'castle-keep-bl-overlay',            blockCount: 2, seed: 4200 },
    { name: 'castle-keep-bl-damaged-overlay',    blockCount: 2, seed: 4300 },
    { name: 'castle-keep-br-overlay',            blockCount: 2, seed: 4400 },
    { name: 'castle-keep-br-damaged-overlay',    blockCount: 2, seed: 4500 },
    { name: 'castle-keep-center-overlay',        blockCount: 2, seed: 4600 },
    { name: 'castle-keep-center-damaged-overlay',blockCount: 2, seed: 4700 },
    // ── Gatehouse (3 blocks, 64×80) ─────────────────────────────────────────
    { name: 'castle-gatehouse-overlay',          blockCount: 3, seed: 5000 },
    { name: 'castle-gatehouse-damaged-overlay',  blockCount: 3, seed: 5100 },
    // ── Full keep overlays ───────────────────────────────────────────────────
    { name: 'castle-keep-overlay',               blockCount: 2, seed: 6000 },
    { name: 'castle-keep-damaged-overlay',       blockCount: 2, seed: 6100 },
    { name: 'castle-keep-destroyed-overlay',     blockCount: 1, seed: 6200 },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function generateAll() {
    console.log('Generating isometric cobblestone wall overlay sprites...\n');

    for (const def of SPRITE_DEFS) {
        const buf = generateBlockOverlay(def.blockCount, def.seed);
        const h   = canvasHeightForBlocks(def.blockCount);

        await sharp(buf, { raw: { width: W, height: h, channels: 4 } })
            .png()
            .toFile(path.join(OUTPUT_DIR, `${def.name}.png`));
        console.log(`  ✓ ${def.name}.png  (${W}×${h})`);
    }

    console.log(`\nDone! ${SPRITE_DEFS.length} cobblestone wall overlay sprites.`);
}

module.exports = {
    generateBlockOverlay,
    canvasHeightForBlocks,
    SPRITE_DEFS,
    W,
    TOP_H,
    FACE_H,
    STONE_HI,
    STONE_MID,
    STONE_SHAD,
    MORTAR,
    MOSS,
    L_HI, L_MID, L_SHAD,
    R_HI, R_MID, R_SHAD,
    OUTLINE,
};

if (require.main === module) {
    generateAll().catch(e => {
        console.error('[CASTLE-WALL-ERROR]', e.message);
        process.exit(1);
    });
}
