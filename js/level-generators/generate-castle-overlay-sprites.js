/**
 * Generate castle structure overlay sprites (transparent background).
 *
 * Delegates to generate-castle-block-sprites.js which produces
 * isometric cobblestone wall-face overlays.  All sprites are written
 * to OUTPUT_DIR as PNGs.
 *
 * Canvas heights are determined by blockCount:
 *   1 block  → 48 px  (wall, bridge)
 *   2 blocks → 64 px  (tower, keep quadrants)
 *   3 blocks → 80 px  (gatehouse)
 *
 * Requirements: 1.9, 9.1
 *
 * Usage:
 *   node js/level-generators/generate-castle-overlay-sprites.js
 */

'use strict';

const sharp = require('sharp');
const path  = require('path');

const { OUTPUT_DIR, CASTLE_OVERLAY_SPRITES } = require('./lib/sprite-constants');
const {
    generateBlockOverlay,
    canvasHeightForBlocks,
    W: OVERLAY_WIDTH,
} = require('./generate-castle-block-sprites');

// ─── Sprite Definitions ──────────────────────────────────────────────────────

/**
 * All 23 castle/bridge overlay sprites.
 * blockCount drives canvas height: canvasHeightForBlocks(blockCount).
 */
const CASTLE_OVERLAY_SPRITE_DEFS = [
    // Iso-wall (shared overlay for all castle structure tiles W/T/K/j/J/G)
    { name: CASTLE_OVERLAY_SPRITES.isoWall,              blockCount: 1, seed: 1200 },
    { name: CASTLE_OVERLAY_SPRITES.isoWallDamaged,       blockCount: 1, seed: 1300 },
    // Walls (64×48)
    { name: CASTLE_OVERLAY_SPRITES.wall,                 blockCount: 1, seed: 1000 },
    { name: CASTLE_OVERLAY_SPRITES.wallDamaged,          blockCount: 1, seed: 1100 },
    // Tower (64×64)
    { name: CASTLE_OVERLAY_SPRITES.tower,                blockCount: 2, seed: 3000 },
    { name: CASTLE_OVERLAY_SPRITES.towerDamaged,         blockCount: 2, seed: 3100 },
    // Keep quadrants (64×64)
    { name: CASTLE_OVERLAY_SPRITES.keepTopLeft,          blockCount: 2, seed: 4000 },
    { name: CASTLE_OVERLAY_SPRITES.keepTopLeftDamaged,   blockCount: 2, seed: 4100 },
    { name: CASTLE_OVERLAY_SPRITES.keepBotLeft,          blockCount: 2, seed: 4200 },
    { name: CASTLE_OVERLAY_SPRITES.keepBotLeftDamaged,   blockCount: 2, seed: 4300 },
    { name: CASTLE_OVERLAY_SPRITES.keepBotRight,         blockCount: 2, seed: 4400 },
    { name: CASTLE_OVERLAY_SPRITES.keepBotRightDamaged,  blockCount: 2, seed: 4500 },
    { name: CASTLE_OVERLAY_SPRITES.keepCenter,           blockCount: 2, seed: 4600 },
    { name: CASTLE_OVERLAY_SPRITES.keepCenterDamaged,    blockCount: 2, seed: 4700 },
    // Gatehouse (64×80)
    { name: CASTLE_OVERLAY_SPRITES.gatehouse,            blockCount: 3, seed: 5000 },
    { name: CASTLE_OVERLAY_SPRITES.gatehouseDamaged,     blockCount: 3, seed: 5100 },
    // Full-keep overlays (64×64 — same block height as keep quadrants)
    { name: CASTLE_OVERLAY_SPRITES.keep,                 blockCount: 2, seed: 6000 },
    { name: CASTLE_OVERLAY_SPRITES.keepDamaged,          blockCount: 2, seed: 6100 },
    { name: CASTLE_OVERLAY_SPRITES.keepDestroyed,        blockCount: 1, seed: 6200 },
    // Bridge surfaces (64×48)
    { name: CASTLE_OVERLAY_SPRITES.bridgeMm,             blockCount: 1, seed: 2000 },
    { name: CASTLE_OVERLAY_SPRITES.bridgeStart,          blockCount: 1, seed: 2100 },
    { name: CASTLE_OVERLAY_SPRITES.bridgeMid,            blockCount: 1, seed: 2200 },
    { name: CASTLE_OVERLAY_SPRITES.bridgeGate,           blockCount: 1, seed: 2300 },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function generateAll() {
    console.log('Generating isometric cobblestone wall overlay sprites...\n');

    for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
        const h      = canvasHeightForBlocks(def.blockCount);
        const buffer = generateBlockOverlay(def.blockCount, def.seed);
        await sharp(buffer, { raw: { width: OVERLAY_WIDTH, height: h, channels: 4 } })
            .png()
            .toFile(path.join(OUTPUT_DIR, `${def.name}.png`));
        console.log(`  ✓ ${def.name}.png  (${OVERLAY_WIDTH}×${h})`);
    }

    console.log(`\nDone! ${CASTLE_OVERLAY_SPRITE_DEFS.length} castle overlay sprites.`);
}

// Export for testing
module.exports = {
    CASTLE_OVERLAY_SPRITE_DEFS,
    OVERLAY_WIDTH,
};

if (require.main === module) {
    generateAll().catch(error => {
        console.error(`[SPRITE-BUILD-ERROR] generate-castle-overlay-sprites: ${error.message}`);
        console.error(`  Stage: generation`);
        console.error(`  Details: ${error.stack}`);
        process.exit(1);
    });
}
