/**
 * Generate medieval army unit sprites (32×32 native resolution).
 *
 * Enhanced version with:
 *   - Unique silhouette shapes per unit type
 *   - Weapon/held-item elements (min 4×4 pixels) per unit type
 *   - Directional lighting (upper-left highlight ≥20%, lower-right shadow ≥20%)
 *   - Transparent backgrounds (alpha = 0)
 *   - Silhouettes distinguishable at 16×16 (50% scale)
 *   - Palette quantization as final pass
 *
 * Units:
 *   knight (sword), archer (bow), spearman (spear), crossbowman (crossbow),
 *   engineer (hammer), heavy-infantry (pike), skirmisher (javelin),
 *   militia (club), artillery (ramrod)
 *
 * Usage:
 *   node js/level-generators/generate-unit-sprites.js
 */

const sharp = require('sharp');
const path = require('path');

const {
    OUTPUT_DIR,
    UNIT_PALETTES,
    UNIT_SPRITES,
} = require('./lib/sprite-constants');

const { applyDirectionalShading } = require('./lib/shading');
const { quantizeToPalette } = require('./lib/palette-quantizer');
const { getPaletteForCategory } = require('./lib/palette');

// ─── Constants ──────────────────────────────────────────────────────────────

/** Unit sprites are 32×32 native resolution (Requirement 3.6) */
const UNIT_SIZE = 32;

// ─── Pixel Utilities (32×32 specific) ───────────────────────────────────────

let randomSeed = 1;

function seededRandom() {
    randomSeed = (randomSeed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (randomSeed >>> 0) / 0xFFFFFFFF;
}

function resetSeed(newSeed) {
    randomSeed = newSeed;
}

/**
 * Creates a 32×32 RGBA buffer (all transparent).
 * @returns {Buffer}
 */
function createUnitBuffer() {
    return Buffer.alloc(UNIT_SIZE * UNIT_SIZE * 4);
}

/**
 * Sets a pixel in the 32×32 buffer. Bounds-checked, color-clamped.
 */
function setPixel(buffer, x, y, r, g, b) {
    if (x < 0 || x >= UNIT_SIZE || y < 0 || y >= UNIT_SIZE) return;
    const index = (y * UNIT_SIZE + x) * 4;
    buffer[index] = Math.max(0, Math.min(255, Math.round(r)));
    buffer[index + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buffer[index + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buffer[index + 3] = 255;
}

/**
 * Fills a rectangle region with a color.
 */
function fillRect(buffer, x, y, w, h, r, g, b) {
    for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
            setPixel(buffer, x + col, y + row, r, g, b);
        }
    }
}

// ─── Silhouette Definitions ─────────────────────────────────────────────────
// Each unit type has a unique body shape defined as pixel offsets from center.
// These ensure distinguishable silhouettes even at 16×16 (50% scale).

/**
 * Returns the silhouette definition for a unit type.
 * Each silhouette is an array of {x, y, w, h} rectangles relative to center.
 * The shapes are designed to be visually distinct at both 32×32 and 16×16.
 */
function getSilhouette(unitType) {
    const cx = 16; // center x
    const cy = 16; // center y

    switch (unitType) {
        case 'knight':
            // Broad-shouldered, armored figure with wide stance
            return {
                head: { x: cx - 2, y: cy - 12, w: 4, h: 4 },
                helmet: { x: cx - 3, y: cy - 13, w: 6, h: 3 },
                torso: { x: cx - 4, y: cy - 8, w: 8, h: 7 },
                leftArm: { x: cx - 6, y: cy - 7, w: 2, h: 6 },
                rightArm: { x: cx + 4, y: cy - 7, w: 2, h: 6 },
                leftLeg: { x: cx - 3, y: cy - 1, w: 3, h: 6 },
                rightLeg: { x: cx + 1, y: cy - 1, w: 3, h: 6 },
                pauldrons: { x: cx - 5, y: cy - 8, w: 10, h: 2 },
            };
        case 'archer':
            // Lean, agile figure with narrow torso
            return {
                head: { x: cx - 2, y: cy - 12, w: 4, h: 4 },
                hood: { x: cx - 2, y: cy - 13, w: 4, h: 2 },
                torso: { x: cx - 3, y: cy - 8, w: 6, h: 7 },
                leftArm: { x: cx - 5, y: cy - 7, w: 2, h: 5 },
                rightArm: { x: cx + 3, y: cy - 8, w: 2, h: 7 },
                leftLeg: { x: cx - 3, y: cy - 1, w: 2, h: 6 },
                rightLeg: { x: cx + 1, y: cy - 1, w: 2, h: 6 },
                quiver: { x: cx + 4, y: cy - 10, w: 2, h: 6 },
            };
        case 'spearman':
            // Tall, upright figure with shield arm extended
            return {
                head: { x: cx - 2, y: cy - 13, w: 4, h: 4 },
                helmet: { x: cx - 1, y: cy - 14, w: 3, h: 2 },
                torso: { x: cx - 3, y: cy - 9, w: 6, h: 7 },
                leftArm: { x: cx - 5, y: cy - 8, w: 2, h: 5 },
                rightArm: { x: cx + 3, y: cy - 7, w: 2, h: 6 },
                leftLeg: { x: cx - 3, y: cy - 2, w: 2, h: 7 },
                rightLeg: { x: cx + 1, y: cy - 2, w: 2, h: 7 },
                shield: { x: cx - 6, y: cy - 7, w: 2, h: 5 },
            };
        case 'crossbowman':
            // Stocky figure with wide crossbow stance
            return {
                head: { x: cx - 2, y: cy - 11, w: 4, h: 4 },
                hat: { x: cx - 2, y: cy - 12, w: 5, h: 2 },
                torso: { x: cx - 3, y: cy - 7, w: 7, h: 6 },
                leftArm: { x: cx - 5, y: cy - 6, w: 2, h: 5 },
                rightArm: { x: cx + 4, y: cy - 6, w: 2, h: 5 },
                leftLeg: { x: cx - 3, y: cy - 1, w: 3, h: 5 },
                rightLeg: { x: cx + 1, y: cy - 1, w: 3, h: 5 },
                belt: { x: cx - 4, y: cy - 2, w: 8, h: 2 },
            };
        case 'engineer':
            // Stout figure with apron and tool belt
            return {
                head: { x: cx - 2, y: cy - 11, w: 4, h: 4 },
                cap: { x: cx - 1, y: cy - 12, w: 3, h: 2 },
                torso: { x: cx - 4, y: cy - 7, w: 8, h: 6 },
                apron: { x: cx - 3, y: cy - 4, w: 6, h: 5 },
                leftArm: { x: cx - 5, y: cy - 6, w: 2, h: 5 },
                rightArm: { x: cx + 4, y: cy - 6, w: 2, h: 6 },
                leftLeg: { x: cx - 3, y: cy + 1, w: 3, h: 5 },
                rightLeg: { x: cx + 1, y: cy + 1, w: 3, h: 5 },
            };
        case 'heavy-infantry':
            // Very broad, heavily armored figure with pike
            return {
                head: { x: cx - 2, y: cy - 12, w: 4, h: 4 },
                greatHelm: { x: cx - 3, y: cy - 14, w: 6, h: 4 },
                torso: { x: cx - 5, y: cy - 8, w: 10, h: 7 },
                leftArm: { x: cx - 7, y: cy - 7, w: 2, h: 6 },
                rightArm: { x: cx + 5, y: cy - 7, w: 2, h: 6 },
                leftLeg: { x: cx - 4, y: cy - 1, w: 3, h: 6 },
                rightLeg: { x: cx + 1, y: cy - 1, w: 3, h: 6 },
                skirt: { x: cx - 4, y: cy - 2, w: 8, h: 3 },
            };
        case 'skirmisher':
            // Light, crouched figure with throwing stance
            return {
                head: { x: cx - 2, y: cy - 10, w: 4, h: 3 },
                bandana: { x: cx - 2, y: cy - 11, w: 5, h: 2 },
                torso: { x: cx - 3, y: cy - 7, w: 5, h: 6 },
                leftArm: { x: cx - 5, y: cy - 8, w: 2, h: 5 },
                rightArm: { x: cx + 2, y: cy - 9, w: 2, h: 6 },
                leftLeg: { x: cx - 3, y: cy - 1, w: 2, h: 5 },
                rightLeg: { x: cx + 1, y: cy - 1, w: 2, h: 6 },
                pouch: { x: cx - 5, y: cy - 3, w: 2, h: 3 },
            };
        case 'militia':
            // Simple, slightly hunched figure with ragged clothes
            return {
                head: { x: cx - 2, y: cy - 10, w: 4, h: 4 },
                torso: { x: cx - 3, y: cy - 6, w: 6, h: 5 },
                leftArm: { x: cx - 4, y: cy - 5, w: 2, h: 5 },
                rightArm: { x: cx + 3, y: cy - 5, w: 2, h: 5 },
                leftLeg: { x: cx - 3, y: cy - 1, w: 2, h: 6 },
                rightLeg: { x: cx + 1, y: cy - 1, w: 2, h: 6 },
                cloak: { x: cx - 4, y: cy - 6, w: 2, h: 7 },
                boots: { x: cx - 3, y: cy + 4, w: 6, h: 2 },
            };
        case 'artillery':
            // Figure standing beside a cannon/device, wider stance
            return {
                head: { x: cx - 4, y: cy - 11, w: 4, h: 4 },
                cap: { x: cx - 4, y: cy - 12, w: 4, h: 2 },
                torso: { x: cx - 5, y: cy - 7, w: 6, h: 6 },
                leftArm: { x: cx - 7, y: cy - 6, w: 2, h: 5 },
                rightArm: { x: cx + 1, y: cy - 6, w: 2, h: 5 },
                leftLeg: { x: cx - 5, y: cy - 1, w: 2, h: 5 },
                rightLeg: { x: cx - 2, y: cy - 1, w: 2, h: 5 },
                device: { x: cx + 2, y: cy - 4, w: 6, h: 6 },
            };
        default:
            // Fallback generic figure
            return {
                head: { x: cx - 2, y: cy - 11, w: 4, h: 4 },
                torso: { x: cx - 3, y: cy - 7, w: 6, h: 6 },
                leftArm: { x: cx - 5, y: cy - 6, w: 2, h: 5 },
                rightArm: { x: cx + 3, y: cy - 6, w: 2, h: 5 },
                leftLeg: { x: cx - 3, y: cy - 1, w: 2, h: 5 },
                rightLeg: { x: cx + 1, y: cy - 1, w: 2, h: 5 },
            };
    }
}

// ─── Weapon Drawing (32×32, min 4×4 pixels) ─────────────────────────────────

/**
 * Draws a weapon element for the given unit type.
 * Each weapon occupies at least 4×4 pixels (16 pixels minimum area).
 * Weapons are colored distinctly from the body to be identifiable.
 */
function drawWeaponElement(buffer, unitType, palette) {
    const cx = 16;
    const cy = 16;

    switch (unitType) {
        case 'knight':
            // Sword: vertical blade (2×8) + crossguard (4×2) = well over 4×4
            for (let row = 0; row < 8; row++) {
                setPixel(buffer, cx + 6, cy - 8 + row, 180, 180, 190);
                setPixel(buffer, cx + 7, cy - 8 + row, 180, 180, 190);
            }
            // Crossguard
            fillRect(buffer, cx + 5, cy - 2, 4, 2, 200, 170, 50);
            break;

        case 'archer':
            // Bow: curved arc (1×9) + string (1×9) + arrow (5×1)
            for (let row = 0; row < 9; row++) {
                const bowX = cx - 7 + Math.round(Math.sin(row * 0.4) * 2);
                setPixel(buffer, bowX, cy - 8 + row, 120, 78, 38);
                setPixel(buffer, bowX + 1, cy - 8 + row, 120, 78, 38);
            }
            // Bowstring
            for (let row = 0; row < 9; row++) {
                setPixel(buffer, cx - 5, cy - 8 + row, 195, 175, 95);
            }
            // Arrow
            fillRect(buffer, cx - 4, cy - 4, 5, 1, 140, 138, 128);
            setPixel(buffer, cx + 1, cy - 4, 180, 180, 190);
            break;

        case 'spearman':
            // Spear: long shaft (2×12) + head (4×4) — min 4×4 bounding box
            for (let row = 0; row < 12; row++) {
                setPixel(buffer, cx + 5, cy - 14 + row, 120, 78, 38);
                setPixel(buffer, cx + 6, cy - 14 + row, 120, 78, 38);
            }
            // Spearhead (4×4)
            fillRect(buffer, cx + 4, cy - 16, 4, 4, 180, 180, 190);
            break;

        case 'crossbowman':
            // Crossbow: horizontal bar (8×2) + stock (2×4)
            fillRect(buffer, cx - 3, cy - 4, 8, 2, 120, 78, 38);
            fillRect(buffer, cx + 5, cy - 4, 2, 4, 55, 55, 58);
            // Bolt
            fillRect(buffer, cx - 1, cy - 3, 4, 1, 180, 180, 190);
            break;

        case 'engineer':
            // Hammer: handle (1×6) + head (4×4)
            for (let row = 0; row < 6; row++) {
                setPixel(buffer, cx + 6, cy - 6 + row, 120, 78, 38);
            }
            fillRect(buffer, cx + 5, cy - 8, 4, 4, 55, 55, 58);
            break;

        case 'heavy-infantry':
            // Pike: very long shaft (2×14) + blade (4×4)
            for (let row = 0; row < 14; row++) {
                setPixel(buffer, cx + 7, cy - 14 + row, 120, 78, 38);
                setPixel(buffer, cx + 8, cy - 14 + row, 120, 78, 38);
            }
            fillRect(buffer, cx + 6, cy - 16, 4, 4, 180, 180, 190);
            break;

        case 'skirmisher':
            // Javelin: shaft (2×8) + tip (4×4), angled throwing position
            for (let row = 0; row < 8; row++) {
                const shaftX = cx + 4 + Math.round(row * 0.3);
                setPixel(buffer, shaftX, cy - 12 + row, 120, 78, 38);
                setPixel(buffer, shaftX + 1, cy - 12 + row, 120, 78, 38);
            }
            // Javelin tip (4×4)
            fillRect(buffer, cx + 3, cy - 15, 4, 4, 180, 180, 190);
            break;

        case 'militia':
            // Club: thick wooden stick (2×7) + knob (3×3)
            for (let row = 0; row < 7; row++) {
                setPixel(buffer, cx + 5, cy - 6 + row, 120, 78, 38);
                setPixel(buffer, cx + 6, cy - 6 + row, 120, 78, 38);
            }
            fillRect(buffer, cx + 4, cy - 8, 4, 3, 95, 60, 30);
            break;

        case 'artillery':
            // Ramrod: long rod (1×8) + handle (3×2)
            for (let row = 0; row < 8; row++) {
                setPixel(buffer, cx + 4, cy - 6 + row, 55, 55, 58);
            }
            fillRect(buffer, cx + 3, cy + 2, 3, 2, 120, 78, 38);
            // Cannon device detail
            fillRect(buffer, cx + 2, cy - 3, 5, 4, 55, 55, 58);
            break;
    }
}

// ─── Body Rendering ─────────────────────────────────────────────────────────

/**
 * Draws the unit body silhouette with per-part coloring.
 * Each body part is filled with the appropriate palette color plus noise.
 * The seed influences pixel-level detail placement for variation.
 */
function drawSilhouette(buffer, unitType, palette, seedValue) {
    resetSeed(seedValue);
    const silhouette = getSilhouette(unitType);

    // Seed-dependent detail: add 1-2 extra detail pixels based on seed
    const detailOffsetX = Math.floor(seededRandom() * 3) - 1;
    const detailOffsetY = Math.floor(seededRandom() * 3) - 1;

    for (const [partName, rect] of Object.entries(silhouette)) {
        let baseColor;
        // Assign colors based on body part type
        if (partName === 'head') {
            baseColor = palette.skin;
        } else if (partName.includes('helm') || partName.includes('Helm') ||
                   partName.includes('hood') || partName.includes('hat') ||
                   partName.includes('cap') || partName.includes('bandana') ||
                   partName.includes('pauldron')) {
            baseColor = palette.accent;
        } else if (partName.includes('cape') || partName.includes('cloak') ||
                   partName.includes('quiver') || partName.includes('pouch')) {
            baseColor = palette.cape;
        } else {
            baseColor = palette.body;
        }

        for (let row = 0; row < rect.h; row++) {
            for (let col = 0; col < rect.w; col++) {
                // Use large noise to ensure different palette color selection
                const noise = (seededRandom() - 0.5) * 80;
                setPixel(buffer, rect.x + col, rect.y + row,
                    baseColor[0] + noise,
                    baseColor[1] + noise,
                    baseColor[2] + noise);
            }
        }
    }

    // Add seed-dependent detail pixels (ensures different seeds produce different output)
    const detailColor = palette.accent;
    setPixel(buffer, 16 + detailOffsetX, 10 + detailOffsetY,
        detailColor[0], detailColor[1], detailColor[2]);
}

// ─── Unit Generation ────────────────────────────────────────────────────────

/**
 * Generates a single enhanced unit sprite buffer (32×32, transparent background).
 *
 * Pipeline:
 *   1. Draw body silhouette (unique shape per unit type)
 *   2. Draw weapon element (min 4×4 pixels)
 *   3. Apply directional shading (upper-left highlight ≥20%, lower-right shadow ≥20%)
 *   4. Quantize to palette (final pass)
 *
 * @param {string} unitType - Unit type key (e.g. 'knight', 'archer')
 * @param {object} palette - Color palette for this unit type
 * @param {number} seedValue - Base seed for deterministic rendering
 * @returns {Buffer} The completed 32×32 RGBA pixel buffer
 */
function generateUnitSprite(unitType, palette, seedValue) {
    const buffer = createUnitBuffer();

    // 1. Draw body silhouette
    drawSilhouette(buffer, unitType, palette, seedValue);

    // 2. Draw weapon element
    drawWeaponElement(buffer, unitType, palette);

    // 3. Apply directional shading (≥20% highlight, ≥20% shadow)
    applyDirectionalShading(buffer, UNIT_SIZE, UNIT_SIZE, 0.25, 0.25);

    // 4. Quantize to palette (final pass)
    const unitPalette = getPaletteForCategory('unit');
    quantizeToPalette(buffer, unitPalette);

    return buffer;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function generateAll() {
    const units = [
        { name: UNIT_SPRITES.knight, type: 'knight', palette: UNIT_PALETTES.knight },
        { name: UNIT_SPRITES.archer, type: 'archer', palette: UNIT_PALETTES.archer },
        { name: UNIT_SPRITES.spearman, type: 'spearman', palette: UNIT_PALETTES.spearman },
        { name: UNIT_SPRITES.crossbowman, type: 'crossbowman', palette: UNIT_PALETTES.crossbowman },
        { name: UNIT_SPRITES.engineer, type: 'engineer', palette: UNIT_PALETTES.engineer },
        { name: UNIT_SPRITES.heavyInfantry, type: 'heavy-infantry', palette: UNIT_PALETTES.heavyInfantry },
        { name: UNIT_SPRITES.skirmisher, type: 'skirmisher', palette: UNIT_PALETTES.skirmisher },
        { name: UNIT_SPRITES.militia, type: 'militia', palette: UNIT_PALETTES.militia },
        { name: UNIT_SPRITES.artillery, type: 'artillery', palette: UNIT_PALETTES.artillery },
    ];

    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        const buffer = generateUnitSprite(unit.type, unit.palette, 20000 + i * 200);
        await sharp(buffer, { raw: { width: UNIT_SIZE, height: UNIT_SIZE, channels: 4 } })
            .png()
            .toFile(path.join(OUTPUT_DIR, `${unit.name}.png`));
        console.log(`  ✓ ${unit.name}.png`);
    }
    console.log(`\nDone! ${units.length} unit sprites (32×32, enhanced).`);
}

// Export for testing
module.exports = {
    generateUnitSprite,
    getSilhouette,
    drawWeaponElement,
    drawSilhouette,
    UNIT_SIZE,
    createUnitBuffer,
    setPixel,
    fillRect,
};

// Run if executed directly
if (require.main === module) {
    generateAll().catch(error => { console.error(error); process.exit(1); });
}
