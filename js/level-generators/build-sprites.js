#!/usr/bin/env node
/**
 * Unified sprite build script — orchestrates all sprite generators,
 * collects buffers, packs into atlas, and outputs atlas files.
 *
 * Pipeline:
 *   1. Run terrain sprite generator (individual PNGs)
 *   2. Run castle sprite generator (individual PNGs)
 *   3. Run unit sprite generator (individual PNGs)
 *   4. Run enemy sprite generator (individual PNGs)
 *   5. Run damaged castle sprite generator (individual PNGs)
 *   6. Generate water animation frames (in-process)
 *   7. Read all generated PNGs as raw RGBA buffers
 *   8. Pack all sprites into atlas via packAtlas()
 *   9. Output atlas-0.png (+ additional if needed) and atlas.json
 *  10. Verify atlas file size < 4MB
 *
 * All generator errors throw and propagate non-zero exit codes.
 * Structured diagnostics logged to stderr on failure.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 7.2, 8.5, 9.5
 *
 * Usage:
 *   node js/level-generators/build-sprites.js
 */

'use strict';

const { execFileSync } = require('child_process');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const {
    TILE_WIDTH,
    TILE_HEIGHT,
    OUTPUT_DIR,
    TERRAIN_SPRITES,
    CASTLE_SPRITES,
    UNIT_SPRITES,
    TREE_OVERLAY_SPRITES,
} = require('./lib/sprite-constants');

const { packAtlas } = require('./lib/atlas-packer');
const { generateWaterFrames } = require('./lib/animation-frames');
const { ANIMATION_CONFIG } = require('./lib/palette');

// ─── Atlas Output Directory ─────────────────────────────────────────────────

/** Directory where atlas PNG and JSON files are written. */
const ATLAS_OUTPUT_DIR = path.join(__dirname, '..', '..', 'generated', 'assets', 'atlas');

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum atlas file size in bytes (4MB per Requirement 7.2) */
const MAX_ATLAS_SIZE_BYTES = 4 * 1024 * 1024;

/** Unit sprite native resolution */
const UNIT_SIZE = 32;

/** Generator scripts to run in order */
const GENERATOR_SCRIPTS = [
    'generate-iso-sprites-br-tl.js',
    'generate-castle-sprites.js',
    'generate-unit-sprites.js',
    'generate-enemy-sprites.js',
    'generate-damaged-castle-sprites.js',
];

/** All sprite names that should be packed into the atlas */
const TERRAIN_SPRITE_NAMES = Object.values(TERRAIN_SPRITES);
const CASTLE_SPRITE_NAMES = Object.values(CASTLE_SPRITES);
const UNIT_SPRITE_NAMES = Object.values(UNIT_SPRITES);
const TREE_OVERLAY_SPRITE_NAMES = Object.values(TREE_OVERLAY_SPRITES);

const ENEMY_SPRITE_NAMES = [
    'enemy-knight',
    'enemy-archer',
    'enemy-spearman',
    'enemy-militia',
    'enemy-siege',
];

const DAMAGED_SPRITE_NAMES = [
    'castle-wall-damaged',
    'castle-tower-damaged',
    'castle-keep-tl-damaged',
    'castle-keep-bl-damaged',
    'castle-keep-br-damaged',
    'castle-keep-center-damaged',
    'castle-gatehouse-damaged',
    'castle-bailey-1-damaged',
    'castle-bailey-2-damaged',
    'castle-bailey-3-damaged',
];

// ─── Error Logging ──────────────────────────────────────────────────────────

/**
 * Logs a structured diagnostic error to stderr.
 * @param {string} moduleName - The module name where the error occurred
 * @param {string} message - Error description
 * @param {Object} [details] - Additional context
 */
function logBuildError(moduleName, message, details = {}) {
    let output = `[SPRITE-BUILD-ERROR] ${moduleName}: ${message}\n`;
    if (details.sprite) output += `  Sprite: ${details.sprite}\n`;
    if (details.stage) output += `  Stage: ${details.stage}\n`;
    if (details.details) output += `  Details: ${details.details}\n`;
    process.stderr.write(output);
}

// ─── Generator Execution ────────────────────────────────────────────────────

/**
 * Runs a generator script as a child process.
 * Throws on non-zero exit code, propagating the error.
 *
 * @param {string} scriptName - Filename of the generator script
 */
function runGenerator(scriptName) {
    const scriptPath = path.join(__dirname, scriptName);
    try {
        execFileSync(process.execPath, [scriptPath], {
            stdio: ['pipe', 'inherit', 'pipe'],
            cwd: path.join(__dirname, '..', '..'),
        });
    } catch (error) {
        const stderr = error.stderr ? error.stderr.toString() : '';
        logBuildError('build-sprites', `Generator failed: ${scriptName}`, {
            stage: 'generation',
            details: stderr || error.message,
        });
        throw new Error(`Generator ${scriptName} exited with code ${error.status}`);
    }
}

// ─── PNG Reading ────────────────────────────────────────────────────────────

/**
 * Reads a PNG file and returns its raw RGBA pixel buffer and dimensions.
 *
 * @param {string} spriteName - Sprite name (without .png extension)
 * @returns {Promise<{buffer: Buffer, width: number, height: number}>}
 */
async function readSpriteBuffer(spriteName) {
    const filePath = path.join(OUTPUT_DIR, `${spriteName}.png`);

    if (!fs.existsSync(filePath)) {
        logBuildError('build-sprites', `Sprite PNG not found: ${spriteName}`, {
            sprite: spriteName,
            stage: 'packing',
            details: `Expected file at: ${filePath}`,
        });
        throw new Error(`Sprite PNG not found: ${filePath}`);
    }

    const { data, info } = await sharp(filePath)
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true });

    return {
        buffer: data,
        width: info.width,
        height: info.height,
    };
}

// ─── Main Build Pipeline ────────────────────────────────────────────────────

async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  Sprite Build Pipeline                       ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // ── Step 1: Run all generator scripts ─────────────────────────────────
    console.log('Step 1: Running sprite generators...\n');

    for (const script of GENERATOR_SCRIPTS) {
        console.log(`  → ${script}`);
        runGenerator(script);
    }

    console.log('\n  All generators completed successfully.\n');

    // ── Step 2: Collect sprite buffers from generated PNGs ────────────────
    console.log('Step 2: Collecting sprite buffers...\n');

    const spriteEntries = [];

    // Terrain sprites (64×32)
    for (const name of TERRAIN_SPRITE_NAMES) {
        const { buffer, width, height } = await readSpriteBuffer(name);
        spriteEntries.push({ name, buffer, width, height });
    }
    console.log(`  ✓ ${TERRAIN_SPRITE_NAMES.length} terrain sprites`);

    // Castle sprites (64×32)
    for (const name of CASTLE_SPRITE_NAMES) {
        const { buffer, width, height } = await readSpriteBuffer(name);
        spriteEntries.push({ name, buffer, width, height });
    }
    console.log(`  ✓ ${CASTLE_SPRITE_NAMES.length} castle sprites`);

    // Unit sprites (32×32)
    for (const name of UNIT_SPRITE_NAMES) {
        const { buffer, width, height } = await readSpriteBuffer(name);
        spriteEntries.push({ name, buffer, width, height });
    }
    console.log(`  ✓ ${UNIT_SPRITE_NAMES.length} unit sprites`);

    // Enemy sprites (64×32, prefixed with enemy-)
    for (const name of ENEMY_SPRITE_NAMES) {
        const { buffer, width, height } = await readSpriteBuffer(name);
        spriteEntries.push({ name, buffer, width, height });
    }
    console.log(`  ✓ ${ENEMY_SPRITE_NAMES.length} enemy sprites`);

    // Damaged castle sprites (64×32, suffixed with -damaged)
    for (const name of DAMAGED_SPRITE_NAMES) {
        const { buffer, width, height } = await readSpriteBuffer(name);
        spriteEntries.push({ name, buffer, width, height });
    }
    console.log(`  ✓ ${DAMAGED_SPRITE_NAMES.length} damaged castle sprites`);

    // Tree overlay sprites (64×48, transparent background)
    for (const name of TREE_OVERLAY_SPRITE_NAMES) {
        const { buffer, width, height } = await readSpriteBuffer(name);
        spriteEntries.push({ name, buffer, width, height });
    }
    console.log(`  ✓ ${TREE_OVERLAY_SPRITE_NAMES.length} tree overlay sprites`);

    // ── Step 3: Generate water animation frames ────────────────────────────
    console.log('\nStep 3: Generating water animation frames...\n');

    const waterFrameCount = ANIMATION_CONFIG.water.frameCount;
    const waterFrames = generateWaterFrames(waterFrameCount, 99999);

    // Pack water frames as a multi-frame sprite entry
    // Concatenate all frame buffers vertically for the atlas packer
    const waterFrameBuffer = Buffer.concat(waterFrames);
    spriteEntries.push({
        name: 'water-anim',
        buffer: waterFrameBuffer,
        width: TILE_WIDTH,
        height: TILE_HEIGHT,
        frames: waterFrameCount,
    });
    console.log(`  ✓ ${waterFrameCount} water animation frames`);

    // ── Pre-pack check: Verify all overlay PNGs exist ─────────────────────
    console.log('\nPre-pack check: Verifying overlay sprite PNGs...\n');

    const missingOverlays = TREE_OVERLAY_SPRITE_NAMES.filter(
        name => !fs.existsSync(path.join(OUTPUT_DIR, `${name}.png`))
    );

    if (missingOverlays.length > 0) {
        for (const name of missingOverlays) {
            logBuildError('build-sprites', `Overlay sprite PNG missing before atlas pack: ${name}`, {
                sprite: name,
                stage: 'pre-pack',
                details: `Expected file at: ${path.join(OUTPUT_DIR, `${name}.png`)}`,
            });
        }
        throw new Error(
            `Pre-pack check failed: ${missingOverlays.length} overlay PNG(s) missing: ${missingOverlays.join(', ')}`
        );
    }

    console.log(`  ✓ All ${TREE_OVERLAY_SPRITE_NAMES.length} overlay PNGs verified present`);

    // ── Step 4: Pack into atlas ───────────────────────────────────────────
    console.log('\nStep 4: Packing sprites into atlas...\n');

    const totalSprites = spriteEntries.length;
    console.log(`  Total sprite entries: ${totalSprites}`);

    const { atlases, metadata } = packAtlas(spriteEntries);

    console.log(`  Atlas pages: ${atlases.length}`);
    console.log(`  Atlas dimensions: ${metadata.meta.size.w}×${metadata.meta.size.h}`);
    console.log(`  Frame entries: ${Object.keys(metadata.frames).length}`);
    console.log(`  Animations: ${Object.keys(metadata.animations).length}`);

    // ── Step 5: Write atlas PNG files ───────────────────────────────────────
    console.log('\nStep 5: Writing atlas files...\n');

    // Ensure atlas output directory exists
    fs.mkdirSync(ATLAS_OUTPUT_DIR, { recursive: true });

    for (let i = 0; i < atlases.length; i++) {
        const atlasBuffer = atlases[i];
        const atlasFileName = `atlas-${i}.png`;
        const atlasFilePath = path.join(ATLAS_OUTPUT_DIR, atlasFileName);

        // Determine dimensions for this atlas page
        // For the first page, use metadata.meta.size; for additional pages,
        // we need to calculate from the buffer size
        let atlasWidth, atlasHeight;
        if (i === 0) {
            atlasWidth = metadata.meta.size.w;
            atlasHeight = metadata.meta.size.h;
        } else {
            // Calculate from buffer: buffer.length = width * height * 4
            // We know atlases are square or power-of-two, use metadata frames
            // to determine the actual dimensions
            const pixelCount = atlasBuffer.length / 4;
            // Find the power-of-two dimensions that match
            atlasWidth = metadata.meta.size.w;
            atlasHeight = pixelCount / atlasWidth;
        }

        await sharp(atlasBuffer, {
            raw: { width: atlasWidth, height: atlasHeight, channels: 4 },
        })
            .png({ compressionLevel: 9 })
            .toFile(atlasFilePath);

        const fileStats = fs.statSync(atlasFilePath);
        const fileSizeKB = (fileStats.size / 1024).toFixed(1);
        console.log(`  ✓ ${atlasFileName} (${fileSizeKB} KB)`);

        // Verify file size < 4MB (Requirement 7.2)
        if (fileStats.size > MAX_ATLAS_SIZE_BYTES) {
            logBuildError('build-sprites', 'Atlas file exceeds 4MB limit', {
                sprite: atlasFileName,
                stage: 'encoding',
                details: `Size: ${fileSizeKB} KB, limit: 4096 KB`,
            });
            throw new Error(
                `Atlas ${atlasFileName} exceeds 4MB: ${fileSizeKB} KB`
            );
        }
    }

    // ── Step 6: Write atlas JSON metadata ───────────────────────────────────
    console.log('\nStep 6: Writing atlas metadata...\n');

    const jsonFilePath = path.join(ATLAS_OUTPUT_DIR, 'atlas.json');

    try {
        const jsonContent = JSON.stringify(metadata, null, 2);
        fs.writeFileSync(jsonFilePath, jsonContent, 'utf8');
    } catch (error) {
        logBuildError('build-sprites', 'Failed to write atlas.json', {
            stage: 'encoding',
            details: error.message,
        });
        throw new Error(`Failed to write atlas.json: ${error.message}`);
    }

    const jsonStats = fs.statSync(jsonFilePath);
    const jsonSizeKB = (jsonStats.size / 1024).toFixed(1);
    console.log(`  ✓ atlas.json (${jsonSizeKB} KB)`);

    // ── Summary ───────────────────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  Build Complete                              ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`\n  Sprites packed: ${Object.keys(metadata.frames).length}`);
    console.log(`  Atlas files: ${atlases.length}`);
    console.log(`  Animations: ${Object.keys(metadata.animations).length}`);
    console.log(`  Output: ${ATLAS_OUTPUT_DIR}/\n`);
}

// ─── Entry Point ────────────────────────────────────────────────────────────

main().catch(error => {
    logBuildError('build-sprites', error.message, {
        stage: 'pipeline',
        details: error.stack,
    });
    process.exit(1);
});
