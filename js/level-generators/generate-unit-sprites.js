/**
 * Generate medieval army unit sprites (64×32 isometric diamond, BR→TL viewpoint).
 *
 * Units:
 *   - knight: heavy armored (silver armor, blue cape, sword)
 *   - heavy-infantry: armored swordsman (chainmail, shield)
 *   - spearman: spear/pike holder (leather armor, long spear)
 *   - archer: longbow user (green tunic, bow)
 *   - crossbowman: crossbow variant (brown tunic, crossbow)
 *   - skirmisher: light javelin thrower (light leather)
 *   - engineer: siege crew / builder (brown apron, hammer)
 *   - militia: local levy / watchman (simple clothes, club)
 *   - artillery: cannon/ballista crew (dark clothes, cannon)
 *
 * Each unit is drawn as a small figure on a fully transparent background.
 * Viewed from bottom-right → top-left (figure faces upper-left).
 *
 * Usage:
 *   node js/level-generators/generate-unit-sprites.js
 */

const sharp = require('sharp');
const path = require('path');

const {
    TILE_WIDTH,
    TILE_HEIGHT,
    OUTPUT_DIR,
    UNIT_PALETTES,
    UNIT_SPRITES,
} = require('./lib/sprite-constants');

const { createBuffer } = require('./lib/pixel-utils');
const { drawUnit } = require('./lib/unit-body');

// ─── Unit Generation ────────────────────────────────────────────────────────

/**
 * Generates a single unit sprite buffer (transparent background, no border).
 *
 * @param {object} palette - Color palette for this unit type.
 * @param {string} weapon - Weapon type string (e.g. 'sword', 'bow').
 * @param {number} seedValue - Base seed for deterministic rendering.
 * @returns {Buffer} The completed pixel buffer ready for PNG encoding.
 */
function generateUnitSprite(palette, weapon, seedValue) {
    const buffer = createBuffer();
    drawUnit(buffer, palette, weapon, seedValue + 500);
    return buffer;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function generateAll() {
    const units = [
        { name: UNIT_SPRITES.knight, palette: UNIT_PALETTES.knight, weapon: 'sword' },
        { name: UNIT_SPRITES.heavyInfantry, palette: UNIT_PALETTES.heavyInfantry, weapon: 'shield' },
        { name: UNIT_SPRITES.spearman, palette: UNIT_PALETTES.spearman, weapon: 'spear' },
        { name: UNIT_SPRITES.archer, palette: UNIT_PALETTES.archer, weapon: 'bow' },
        { name: UNIT_SPRITES.crossbowman, palette: UNIT_PALETTES.crossbowman, weapon: 'crossbow' },
        { name: UNIT_SPRITES.skirmisher, palette: UNIT_PALETTES.skirmisher, weapon: 'javelin' },
        { name: UNIT_SPRITES.engineer, palette: UNIT_PALETTES.engineer, weapon: 'hammer' },
        { name: UNIT_SPRITES.militia, palette: UNIT_PALETTES.militia, weapon: 'club' },
        { name: UNIT_SPRITES.artillery, palette: UNIT_PALETTES.artillery, weapon: 'cannon' },
    ];

    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        const buffer = generateUnitSprite(unit.palette, unit.weapon, 20000 + i * 200);
        await sharp(buffer, { raw: { width: TILE_WIDTH, height: TILE_HEIGHT, channels: 4 } })
            .png()
            .toFile(path.join(OUTPUT_DIR, `${unit.name}.png`));
        console.log(`  ✓ ${unit.name}.png`);
    }
    console.log(`\nDone! ${units.length} unit sprites (64×32, BR→TL).`);
}

generateAll().catch(error => { console.error(error); process.exit(1); });
