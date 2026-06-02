/**
 * Generate castle structure overlay sprites (transparent background).
 *
 * Produces exactly 18 castle/bridge overlay sprites:
 *   Walls (64×48):
 *     - castle-wall-overlay
 *     - castle-wall-damaged-overlay
 *   Towers (64×64):
 *     - castle-tower-overlay
 *     - castle-tower-damaged-overlay
 *   Keep quadrants (64×64):
 *     - castle-keep-tl-overlay
 *     - castle-keep-tl-damaged-overlay
 *     - castle-keep-bl-overlay
 *     - castle-keep-bl-damaged-overlay
 *     - castle-keep-br-overlay
 *     - castle-keep-br-damaged-overlay
 *     - castle-keep-center-overlay
 *     - castle-keep-center-damaged-overlay
 *   Gatehouse (64×80):
 *     - castle-gatehouse-overlay
 *     - castle-gatehouse-damaged-overlay
 *   Bridge surfaces (64×48) — no damaged variants:
 *     - bridge-mm-overlay
 *     - castle-bridge-start-overlay
 *     - castle-bridge-mid-overlay
 *     - castle-bridge-gate-overlay
 *
 * Each overlay sprite has a transparent background (alpha=0 outside the
 * structure's vertical body) and is drawn on top of the flat ground tile
 * at runtime to achieve a 2.5D appearance.
 *
 * Requirements: 1.9, 9.1
 *
 * Usage:
 *   node js/level-generators/generate-castle-overlay-sprites.js
 */

'use strict';

const sharp = require('sharp');
const path = require('path');

const { OUTPUT_DIR, CASTLE_OVERLAY_SPRITES } = require('./lib/sprite-constants');
const { generateCastleOverlay, generateIsoWallOverlay } = require('./generate-iso-sprites-br-tl');

// ─── Sprite Definitions ──────────────────────────────────────────────────────

/**
 * All 20 castle/bridge overlay sprites to generate.
 * Each entry maps a sprite name to its structureType and damaged flag.
 *
 * Canvas dimensions are determined by structureType inside generateCastleOverlay:
 *   - wall / bridge-*: 64×48 px
 *   - tower / keep-*:  64×64 px
 *   - gatehouse:       64×80 px
 *
 * The two 'iso-wall' entries use generateIsoWallOverlay (64×48) and are the
 * sprites actually used at runtime by all castle structure tiles (T, K, j, J, F, G, W).
 */
const CASTLE_OVERLAY_SPRITE_DEFS = [
    // Walls (64×48)
    { name: CASTLE_OVERLAY_SPRITES.wall,                structureType: 'wall',         damaged: false },
    { name: CASTLE_OVERLAY_SPRITES.wallDamaged,         structureType: 'wall',         damaged: true  },
    // Towers (64×64)
    { name: CASTLE_OVERLAY_SPRITES.tower,               structureType: 'tower',        damaged: false },
    { name: CASTLE_OVERLAY_SPRITES.towerDamaged,        structureType: 'tower',        damaged: true  },
    // Keep quadrants (64×64)
    { name: CASTLE_OVERLAY_SPRITES.keepTopLeft,         structureType: 'keep-tl',      damaged: false },
    { name: CASTLE_OVERLAY_SPRITES.keepTopLeftDamaged,  structureType: 'keep-tl',      damaged: true  },
    { name: CASTLE_OVERLAY_SPRITES.keepBotLeft,         structureType: 'keep-bl',      damaged: false },
    { name: CASTLE_OVERLAY_SPRITES.keepBotLeftDamaged,  structureType: 'keep-bl',      damaged: true  },
    { name: CASTLE_OVERLAY_SPRITES.keepBotRight,        structureType: 'keep-br',      damaged: false },
    { name: CASTLE_OVERLAY_SPRITES.keepBotRightDamaged, structureType: 'keep-br',      damaged: true  },
    { name: CASTLE_OVERLAY_SPRITES.keepCenter,          structureType: 'keep-center',  damaged: false },
    { name: CASTLE_OVERLAY_SPRITES.keepCenterDamaged,   structureType: 'keep-center',  damaged: true  },
    // Gatehouse (64×80)
    { name: CASTLE_OVERLAY_SPRITES.gatehouse,           structureType: 'gatehouse',    damaged: false },
    { name: CASTLE_OVERLAY_SPRITES.gatehouseDamaged,    structureType: 'gatehouse',    damaged: true  },
    // Bridge surfaces (64×48) — no damaged variants
    { name: CASTLE_OVERLAY_SPRITES.bridgeMm,            structureType: 'bridge-mm',    damaged: false },
    { name: CASTLE_OVERLAY_SPRITES.bridgeStart,         structureType: 'bridge-start', damaged: false },
    { name: CASTLE_OVERLAY_SPRITES.bridgeMid,           structureType: 'bridge-mid',   damaged: false },
    { name: CASTLE_OVERLAY_SPRITES.bridgeGate,          structureType: 'bridge-gate',  damaged: false },
    // Isometric wall face (64×48) — single sprite used by all castle tiles at runtime
    { name: CASTLE_OVERLAY_SPRITES.isoWall,             structureType: 'iso-wall',     damaged: false },
    { name: CASTLE_OVERLAY_SPRITES.isoWallDamaged,      structureType: 'iso-wall',     damaged: true  },
];

// ─── Canvas Width ────────────────────────────────────────────────────────────

/** All castle overlay sprites share the same canvas width. */
const OVERLAY_WIDTH = 64;

// ─── Main ───────────────────────────────────────────────────────────────────

async function generateAll() {
    console.log('Generating castle structure overlay sprites (transparent background)...\n');

    for (const def of CASTLE_OVERLAY_SPRITE_DEFS) {
        let buffer;
        if (def.structureType === 'iso-wall') {
            // Isometric wall face — uses dedicated generator, always 64×48
            buffer = generateIsoWallOverlay(def.damaged);
        } else {
            buffer = generateCastleOverlay(def.structureType, def.damaged);
        }
        // Canvas height is encoded in the buffer length: buffer.length / (OVERLAY_WIDTH * 4)
        const height = buffer.length / (OVERLAY_WIDTH * 4);

        await sharp(buffer, { raw: { width: OVERLAY_WIDTH, height, channels: 4 } })
            .png()
            .toFile(path.join(OUTPUT_DIR, `${def.name}.png`));
        console.log(`  ✓ ${def.name}.png  (${OVERLAY_WIDTH}×${height})`);
    }

    console.log(`\nDone! ${CASTLE_OVERLAY_SPRITE_DEFS.length} castle overlay sprites.`);
}

// Export for testing
module.exports = {
    CASTLE_OVERLAY_SPRITE_DEFS,
    OVERLAY_WIDTH,
};

// Run if executed directly
if (require.main === module) {
    generateAll().catch(error => {
        console.error(`[SPRITE-BUILD-ERROR] generate-castle-overlay-sprites: ${error.message}`);
        console.error(`  Stage: generation`);
        console.error(`  Details: ${error.stack}`);
        process.exit(1);
    });
}
