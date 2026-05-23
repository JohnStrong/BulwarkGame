/**
 * Generate enemy unit sprites (64×32 tile dimensions).
 *
 * Enhanced version with:
 *   - 5 enemy unit types: enemy-knight, enemy-archer, enemy-spearman, enemy-militia, enemy-siege
 *   - ENEMY_PALETTE (shares no more than 2 colors with player unit palette)
 *   - Unique silhouette modifier per type (different helmet, banner, or shield emblem)
 *   - Directional lighting (upper-left highlight, lower-right shadow)
 *   - Transparent backgrounds (alpha = 0)
 *   - Legible at 50% native resolution (32×16)
 *   - Palette quantization as final pass with enemy palette
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 *
 * Usage:
 *   node js/level-generators/generate-enemy-sprites.js
 */

'use strict';

const sharp = require('sharp');
const path = require('path');

const {
    OUTPUT_DIR,
    TILE_WIDTH,
    TILE_HEIGHT,
} = require('./lib/sprite-constants');

const { applyDirectionalShading } = require('./lib/shading');
const { quantizeToPalette } = require('./lib/palette-quantizer');
const { ENEMY_PALETTE, getPaletteForCategory } = require('./lib/palette');

// ─── Constants ──────────────────────────────────────────────────────────────

/** Enemy sprites use standard tile dimensions (64×32) per Requirement 8.3 */
const ENEMY_WIDTH = TILE_WIDTH;   // 64
const ENEMY_HEIGHT = TILE_HEIGHT; // 32

/** Exactly 5 enemy unit types (Requirement 8.4) */
const ENEMY_TYPES = [
    { name: 'enemy-knight', type: 'knight' },
    { name: 'enemy-archer', type: 'archer' },
    { name: 'enemy-spearman', type: 'spearman' },
    { name: 'enemy-militia', type: 'militia' },
    { name: 'enemy-siege', type: 'siege' },
];

// ─── Enemy Color Assignments (from ENEMY_PALETTE) ───────────────────────────

const ENEMY_COLORS = {
    body:      ENEMY_PALETTE[0],  // dark crimson body
    accent:    ENEMY_PALETTE[1],  // blood red accent
    shadow:    ENEMY_PALETTE[2],  // shadow purple
    olive:     ENEMY_PALETTE[3],  // dark olive
    highlight: ENEMY_PALETTE[4],  // bright red highlight
    armor:     ENEMY_PALETTE[5],  // near-black armor
    leather:   ENEMY_PALETTE[6],  // weathered leather
    banner:    ENEMY_PALETTE[7],  // banner red
};

// ─── Pixel Utilities (64×32 specific) ───────────────────────────────────────

let randomSeed = 1;

function seededRandom() {
    randomSeed = (randomSeed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (randomSeed >>> 0) / 0xFFFFFFFF;
}

function resetSeed(newSeed) {
    randomSeed = newSeed;
}

/**
 * Creates a 64×32 RGBA buffer (all transparent).
 * @returns {Buffer}
 */
function createEnemyBuffer() {
    return Buffer.alloc(ENEMY_WIDTH * ENEMY_HEIGHT * 4);
}

/**
 * Sets a pixel in the 64×32 buffer. Bounds-checked, color-clamped.
 */
function setPixel(buffer, x, y, r, g, b) {
    if (x < 0 || x >= ENEMY_WIDTH || y < 0 || y >= ENEMY_HEIGHT) return;
    const index = (y * ENEMY_WIDTH + x) * 4;
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

// ─── Silhouette Definitions (64×32 canvas, centered) ────────────────────────
// Each enemy type has a unique body shape. The silhouettes are designed to be
// visually distinct at both native (64×32) and 50% (32×16) resolution.
// Centered at (32, 16) within the 64×32 tile.

/**
 * Returns the silhouette definition for an enemy unit type.
 * Each silhouette is an object of named {x, y, w, h} rectangles.
 * Designed for legibility at 32×16 (50% scale) per Requirement 8.7.
 */
function getEnemySilhouette(enemyType) {
    const cx = 32; // center x in 64-wide tile
    const cy = 16; // center y in 32-tall tile

    switch (enemyType) {
        case 'knight':
            // Broad-shouldered armored figure, wide stance
            return {
                head: { x: cx - 3, y: cy - 12, w: 6, h: 5 },
                torso: { x: cx - 5, y: cy - 7, w: 10, h: 8 },
                leftArm: { x: cx - 8, y: cy - 6, w: 3, h: 7 },
                rightArm: { x: cx + 5, y: cy - 6, w: 3, h: 7 },
                leftLeg: { x: cx - 4, y: cy + 1, w: 4, h: 7 },
                rightLeg: { x: cx + 1, y: cy + 1, w: 4, h: 7 },
                pauldrons: { x: cx - 7, y: cy - 7, w: 14, h: 3 },
            };
        case 'archer':
            // Lean figure with quiver, narrow torso
            return {
                head: { x: cx - 3, y: cy - 12, w: 6, h: 5 },
                torso: { x: cx - 4, y: cy - 7, w: 8, h: 8 },
                leftArm: { x: cx - 7, y: cy - 6, w: 3, h: 6 },
                rightArm: { x: cx + 4, y: cy - 7, w: 3, h: 8 },
                leftLeg: { x: cx - 4, y: cy + 1, w: 3, h: 7 },
                rightLeg: { x: cx + 1, y: cy + 1, w: 3, h: 7 },
                quiver: { x: cx + 6, y: cy - 10, w: 3, h: 7 },
            };
        case 'spearman':
            // Tall upright figure with shield arm
            return {
                head: { x: cx - 3, y: cy - 13, w: 6, h: 5 },
                torso: { x: cx - 4, y: cy - 8, w: 8, h: 8 },
                leftArm: { x: cx - 7, y: cy - 7, w: 3, h: 6 },
                rightArm: { x: cx + 4, y: cy - 6, w: 3, h: 7 },
                leftLeg: { x: cx - 4, y: cy, w: 3, h: 8 },
                rightLeg: { x: cx + 1, y: cy, w: 3, h: 8 },
                shield: { x: cx - 9, y: cy - 6, w: 3, h: 6 },
            };
        case 'militia':
            // Simple hunched figure with ragged clothes
            return {
                head: { x: cx - 3, y: cy - 10, w: 6, h: 5 },
                torso: { x: cx - 4, y: cy - 5, w: 8, h: 6 },
                leftArm: { x: cx - 6, y: cy - 4, w: 3, h: 6 },
                rightArm: { x: cx + 4, y: cy - 4, w: 3, h: 6 },
                leftLeg: { x: cx - 4, y: cy + 1, w: 3, h: 7 },
                rightLeg: { x: cx + 1, y: cy + 1, w: 3, h: 7 },
                cloak: { x: cx - 6, y: cy - 5, w: 3, h: 8 },
            };
        case 'siege':
            // Figure standing beside a siege device (battering ram / catapult)
            return {
                head: { x: cx - 6, y: cy - 11, w: 5, h: 5 },
                torso: { x: cx - 7, y: cy - 6, w: 7, h: 6 },
                leftArm: { x: cx - 9, y: cy - 5, w: 3, h: 5 },
                rightArm: { x: cx, y: cy - 5, w: 3, h: 5 },
                leftLeg: { x: cx - 7, y: cy, w: 3, h: 6 },
                rightLeg: { x: cx - 3, y: cy, w: 3, h: 6 },
                device: { x: cx + 2, y: cy - 4, w: 10, h: 8 },
                wheel: { x: cx + 3, y: cy + 3, w: 4, h: 4 },
            };
        default:
            return {
                head: { x: cx - 3, y: cy - 11, w: 6, h: 5 },
                torso: { x: cx - 4, y: cy - 6, w: 8, h: 7 },
                leftArm: { x: cx - 7, y: cy - 5, w: 3, h: 6 },
                rightArm: { x: cx + 4, y: cy - 5, w: 3, h: 6 },
                leftLeg: { x: cx - 4, y: cy + 1, w: 3, h: 6 },
                rightLeg: { x: cx + 1, y: cy + 1, w: 3, h: 6 },
            };
    }
}

// ─── Silhouette Modifiers (Requirement 8.2) ─────────────────────────────────
// Each enemy type gets at least one unique silhouette modifier:
//   - knight:   spiked helmet (different from player knight's flat-top helmet)
//   - archer:   tattered banner on back
//   - spearman: round shield emblem (different from player's kite shield)
//   - militia:  horned helmet
//   - siege:    war banner on device

/**
 * Draws the unique silhouette modifier for each enemy type.
 * These modifiers differentiate enemy silhouettes from player unit silhouettes.
 */
function drawSilhouetteModifier(buffer, enemyType) {
    const cx = 32;
    const cy = 16;

    switch (enemyType) {
        case 'knight':
            // Spiked helmet: 3 spikes rising from head
            fillRect(buffer, cx - 2, cy - 15, 2, 3, ...ENEMY_COLORS.armor);
            fillRect(buffer, cx, cy - 16, 2, 4, ...ENEMY_COLORS.armor);
            fillRect(buffer, cx + 2, cy - 15, 2, 3, ...ENEMY_COLORS.armor);
            // Helmet visor
            fillRect(buffer, cx - 3, cy - 12, 8, 2, ...ENEMY_COLORS.armor);
            break;

        case 'archer':
            // Tattered banner on back (attached to quiver)
            fillRect(buffer, cx + 7, cy - 13, 2, 4, ...ENEMY_COLORS.leather);
            // Banner cloth (ragged shape)
            fillRect(buffer, cx + 9, cy - 12, 4, 3, ...ENEMY_COLORS.banner);
            fillRect(buffer, cx + 9, cy - 9, 3, 2, ...ENEMY_COLORS.banner);
            fillRect(buffer, cx + 10, cy - 7, 2, 2, ...ENEMY_COLORS.banner);
            break;

        case 'spearman':
            // Round shield emblem: circular boss on shield face
            fillRect(buffer, cx - 9, cy - 5, 4, 5, ...ENEMY_COLORS.accent);
            // Shield boss (center dot)
            fillRect(buffer, cx - 8, cy - 4, 2, 3, ...ENEMY_COLORS.highlight);
            // Shield rim
            setPixel(buffer, cx - 10, cy - 4, ...ENEMY_COLORS.armor);
            setPixel(buffer, cx - 10, cy - 3, ...ENEMY_COLORS.armor);
            setPixel(buffer, cx - 10, cy - 2, ...ENEMY_COLORS.armor);
            break;

        case 'militia':
            // Horned helmet: two curved horns
            fillRect(buffer, cx - 5, cy - 12, 2, 4, ...ENEMY_COLORS.leather);
            fillRect(buffer, cx - 6, cy - 14, 2, 3, ...ENEMY_COLORS.leather);
            fillRect(buffer, cx + 4, cy - 12, 2, 4, ...ENEMY_COLORS.leather);
            fillRect(buffer, cx + 5, cy - 14, 2, 3, ...ENEMY_COLORS.leather);
            // Helmet band
            fillRect(buffer, cx - 4, cy - 11, 9, 2, ...ENEMY_COLORS.armor);
            break;

        case 'siege':
            // War banner on siege device
            fillRect(buffer, cx + 10, cy - 8, 2, 5, ...ENEMY_COLORS.leather);
            // Banner flag
            fillRect(buffer, cx + 12, cy - 8, 5, 4, ...ENEMY_COLORS.banner);
            fillRect(buffer, cx + 12, cy - 4, 4, 2, ...ENEMY_COLORS.banner);
            // Skull emblem on banner
            fillRect(buffer, cx + 13, cy - 7, 3, 2, ...ENEMY_COLORS.highlight);
            break;
    }
}

// ─── Weapon Drawing (enemy variants) ────────────────────────────────────────

/**
 * Draws a weapon element for the given enemy unit type.
 * Each weapon occupies at least 4×4 pixels (16 pixels minimum area).
 * Weapons use enemy palette colors.
 */
function drawEnemyWeapon(buffer, enemyType) {
    const cx = 32;
    const cy = 16;

    switch (enemyType) {
        case 'knight':
            // Dark sword: vertical blade (3×9) + crossguard (5×2)
            for (let row = 0; row < 9; row++) {
                setPixel(buffer, cx + 8, cy - 7 + row, ...ENEMY_COLORS.armor);
                setPixel(buffer, cx + 9, cy - 7 + row, ...ENEMY_COLORS.armor);
                setPixel(buffer, cx + 10, cy - 7 + row, ...ENEMY_COLORS.shadow);
            }
            // Crossguard
            fillRect(buffer, cx + 7, cy + 1, 5, 2, ...ENEMY_COLORS.accent);
            break;

        case 'archer':
            // Dark bow: curved arc + string
            for (let row = 0; row < 10; row++) {
                const bowX = cx - 9 + Math.round(Math.sin(row * 0.35) * 2);
                setPixel(buffer, bowX, cy - 7 + row, ...ENEMY_COLORS.leather);
                setPixel(buffer, bowX + 1, cy - 7 + row, ...ENEMY_COLORS.leather);
            }
            // Bowstring
            for (let row = 0; row < 10; row++) {
                setPixel(buffer, cx - 7, cy - 7 + row, ...ENEMY_COLORS.shadow);
            }
            // Arrow
            fillRect(buffer, cx - 6, cy - 2, 6, 1, ...ENEMY_COLORS.armor);
            setPixel(buffer, cx, cy - 2, ...ENEMY_COLORS.highlight);
            break;

        case 'spearman':
            // Dark spear: long shaft (2×13) + head (4×4)
            for (let row = 0; row < 13; row++) {
                setPixel(buffer, cx + 6, cy - 13 + row, ...ENEMY_COLORS.leather);
                setPixel(buffer, cx + 7, cy - 13 + row, ...ENEMY_COLORS.leather);
            }
            // Spearhead (4×4)
            fillRect(buffer, cx + 5, cy - 15, 4, 4, ...ENEMY_COLORS.armor);
            break;

        case 'militia':
            // Spiked club: thick stick (3×8) + spikes
            for (let row = 0; row < 8; row++) {
                setPixel(buffer, cx + 6, cy - 5 + row, ...ENEMY_COLORS.leather);
                setPixel(buffer, cx + 7, cy - 5 + row, ...ENEMY_COLORS.leather);
                setPixel(buffer, cx + 8, cy - 5 + row, ...ENEMY_COLORS.olive);
            }
            // Club head with spikes (4×4 minimum)
            fillRect(buffer, cx + 5, cy - 8, 5, 4, ...ENEMY_COLORS.armor);
            // Spikes
            setPixel(buffer, cx + 4, cy - 7, ...ENEMY_COLORS.highlight);
            setPixel(buffer, cx + 10, cy - 7, ...ENEMY_COLORS.highlight);
            setPixel(buffer, cx + 7, cy - 9, ...ENEMY_COLORS.highlight);
            break;

        case 'siege':
            // Battering ram / siege device detail
            fillRect(buffer, cx + 2, cy - 2, 9, 3, ...ENEMY_COLORS.leather);
            fillRect(buffer, cx + 2, cy + 1, 9, 2, ...ENEMY_COLORS.olive);
            // Ram head (iron cap)
            fillRect(buffer, cx + 11, cy - 2, 3, 3, ...ENEMY_COLORS.armor);
            // Wheels
            fillRect(buffer, cx + 3, cy + 4, 3, 3, ...ENEMY_COLORS.shadow);
            fillRect(buffer, cx + 8, cy + 4, 3, 3, ...ENEMY_COLORS.shadow);
            break;
    }
}

// ─── Body Rendering ─────────────────────────────────────────────────────────

/**
 * Draws the enemy unit body silhouette with per-part coloring.
 * Uses ENEMY_PALETTE colors for all body parts.
 */
function drawEnemySilhouette(buffer, enemyType, seedValue) {
    resetSeed(seedValue);
    const silhouette = getEnemySilhouette(enemyType);

    for (const [partName, rect] of Object.entries(silhouette)) {
        let baseColor;
        // Assign colors based on body part type
        if (partName === 'head') {
            baseColor = ENEMY_COLORS.body;
        } else if (partName.includes('arm') || partName.includes('leg')) {
            baseColor = ENEMY_COLORS.olive;
        } else if (partName === 'torso' || partName === 'pauldrons') {
            baseColor = ENEMY_COLORS.armor;
        } else if (partName === 'shield') {
            baseColor = ENEMY_COLORS.accent;
        } else if (partName === 'device' || partName === 'wheel') {
            baseColor = ENEMY_COLORS.leather;
        } else if (partName === 'cloak' || partName === 'quiver') {
            baseColor = ENEMY_COLORS.shadow;
        } else {
            baseColor = ENEMY_COLORS.body;
        }

        for (let row = 0; row < rect.h; row++) {
            for (let col = 0; col < rect.w; col++) {
                // Subtle noise for texture variation
                const noise = (seededRandom() - 0.5) * 40;
                setPixel(buffer, rect.x + col, rect.y + row,
                    baseColor[0] + noise,
                    baseColor[1] + noise,
                    baseColor[2] + noise);
            }
        }
    }
}

// ─── Enemy Sprite Generation ────────────────────────────────────────────────

/**
 * Generates a single enemy unit sprite buffer (64×32, transparent background).
 *
 * Pipeline:
 *   1. Draw body silhouette (unique shape per enemy type)
 *   2. Draw silhouette modifier (helmet, banner, or shield emblem)
 *   3. Draw weapon element (min 4×4 pixels)
 *   4. Apply directional shading (upper-left highlight, lower-right shadow)
 *   5. Quantize to ENEMY_PALETTE (final pass)
 *
 * @param {string} enemyType - Enemy type key (e.g. 'knight', 'archer')
 * @param {number} seedValue - Base seed for deterministic rendering
 * @returns {Buffer} The completed 64×32 RGBA pixel buffer
 */
function generateEnemySprite(enemyType, seedValue) {
    const buffer = createEnemyBuffer();

    // 1. Draw body silhouette
    drawEnemySilhouette(buffer, enemyType, seedValue);

    // 2. Draw silhouette modifier (Requirement 8.2)
    drawSilhouetteModifier(buffer, enemyType);

    // 3. Draw weapon element
    drawEnemyWeapon(buffer, enemyType);

    // 4. Apply directional shading (upper-left highlight, lower-right shadow)
    applyDirectionalShading(buffer, ENEMY_WIDTH, ENEMY_HEIGHT, 0.25, 0.25);

    // 5. Quantize to enemy palette (final pass, Requirement 8.1)
    const enemyPalette = getPaletteForCategory('enemy');
    quantizeToPalette(buffer, enemyPalette);

    return buffer;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function generateAll() {
    console.log('Generating enemy unit sprites (64×32)...\n');

    for (let i = 0; i < ENEMY_TYPES.length; i++) {
        const enemy = ENEMY_TYPES[i];
        const buffer = generateEnemySprite(enemy.type, 30000 + i * 300);
        await sharp(buffer, { raw: { width: ENEMY_WIDTH, height: ENEMY_HEIGHT, channels: 4 } })
            .png()
            .toFile(path.join(OUTPUT_DIR, `${enemy.name}.png`));
        console.log(`  ✓ ${enemy.name}.png`);
    }
    console.log(`\nDone! ${ENEMY_TYPES.length} enemy sprites (64×32, enhanced).`);
}

// Export for testing
module.exports = {
    generateEnemySprite,
    getEnemySilhouette,
    drawSilhouetteModifier,
    drawEnemyWeapon,
    drawEnemySilhouette,
    ENEMY_TYPES,
    ENEMY_WIDTH,
    ENEMY_HEIGHT,
    ENEMY_COLORS,
    createEnemyBuffer,
    setPixel,
    fillRect,
};

// Run if executed directly
if (require.main === module) {
    generateAll().catch(error => {
        console.error(`[SPRITE-BUILD-ERROR] generate-enemy-sprites: ${error.message}`);
        console.error(`  Stage: generation`);
        console.error(`  Details: ${error.stack}`);
        process.exit(1);
    });
}
