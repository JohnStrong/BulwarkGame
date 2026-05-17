/**
 * Sprite Sheet Splitter (Node.js)
 *
 * Usage: node split-sprites.js
 *
 * Requires: npm install sharp
 * (or: npx -- run directly)
 *
 * Splits all-sprites.jpeg into individual 32x32 PNG sprites
 * and saves them to assets/sprites/
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const INPUT = path.join(__dirname, '..', '..', 'assets', 'sprites', 'all-sprites.jpeg');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Sprite names in grid order (left-to-right, top-to-bottom)
// Based on the visible sprite sheet layout (6 columns × 7 rows)
const COLS = 6;
const ROWS = 7;
const TILE_SIZE = 32;

const spriteNames = [
    // Row 1 - Stone walls
    'stone-wall-corner-left',
    'stone-wall-edge-top',
    'stone-wall-right',
    'stone-wall-corner-top',
    'stone-wall-bottom',
    'stone-wall-corner-right',
    // Row 2 - Floors and walls
    'stone-wall-interior',
    'stone-wall-floor-a',
    'cobblestone-floor-b',
    'cobblestone-floor-c',
    'stone-grass-floor',
    'scorch-overlay',
    // Row 3 - Nature/terrain
    'short-grass-base',
    'grass-tuft-overlay',
    'small-flower-overlay',
    'rock-overlay',
    'dirt-road-worn-edge',
    'soot-mark-overlay',
    // Row 4 - Structures
    'hay-tile',
    'hay-bale-overlay',
    'wooden-door-closed',
    'wooden-door-open',
    'didder-overlay',
    'barricade-overlay',
    // Row 5 - Doors and props
    'unit-placeholder-hobbed',
    'unit-placeholder-door',
    'wooden-door-damaged',
    'wooden-door-reinforced',
    'ladder-overlay',
    'reinforced-door-overlay',
    // Row 6 - Unit placeholders and props
    'unit-placeholder-hold',
    'unit-placeholder-overlayed',
    'unit-placeholder-overlay',
    'unit-placeholder-alt',
    'shadow-overlay',
    'shield-prop',
    // Row 7 - Misc props
    'gate-open-tile',
    'broken-ladder-piece',
    'rope-overlay',
    'barrel-prop',
    'empty',
    'empty-alt'
];

async function splitSprites() {
    console.log('Loading sprite sheet:', INPUT);

    if (!fs.existsSync(INPUT)) {
        console.error('ERROR: all-sprites.jpeg not found at', INPUT);
        process.exit(1);
    }

    const metadata = await sharp(INPUT).metadata();
    console.log(`Image size: ${metadata.width}x${metadata.height}`);

    // Calculate cell dimensions (each cell contains a sprite + label below it)
    const cellW = Math.floor(metadata.width / COLS);
    const cellH = Math.floor((metadata.height - 120) / ROWS); // Reserve bottom for large tiles

    console.log(`Cell size: ${cellW}x${cellH}`);
    console.log(`Extracting ${spriteNames.length} sprites...\n`);

    let extracted = 0;

    for (let i = 0; i < spriteNames.length; i++) {
        const name = spriteNames[i];
        const col = i % COLS;
        const row = Math.floor(i / COLS);

        // Calculate the center of each cell, then extract 32x32 from that center
        const cellCenterX = Math.floor((col * cellW) + (cellW / 2));
        const cellCenterY = Math.floor((row * cellH) + (cellH / 2));

        // Top-left corner of the 32x32 extraction area
        let srcX = cellCenterX - Math.floor(TILE_SIZE / 2);
        let srcY = cellCenterY - Math.floor(TILE_SIZE / 2);

        // Clamp to image bounds
        srcX = Math.max(0, Math.min(srcX, metadata.width - TILE_SIZE));
        srcY = Math.max(0, Math.min(srcY, metadata.height - TILE_SIZE));

        const outputPath = path.join(OUTPUT_DIR, `${name}.png`);

        try {
            await sharp(INPUT)
                .extract({
                    left: srcX,
                    top: srcY,
                    width: TILE_SIZE,
                    height: TILE_SIZE
                })
                .png()
                .toFile(outputPath);

            console.log(`  ✓ ${name}.png (from ${srcX},${srcY})`);
            extracted++;
        } catch (err) {
            console.error(`  ✗ ${name}.png - ${err.message}`);
        }
    }

    console.log(`\nDone! Extracted ${extracted}/${spriteNames.length} sprites to ${OUTPUT_DIR}`);
}

splitSprites().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
