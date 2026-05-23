/**
 * Flat isometric diamond terrain sprites — Viewpoint: Bottom-Right → Top-Left.
 *
 * Generates 17 terrain sprites as 64×32 pixel flat isometric diamonds.
 * These are the base tiles used by the level loader to render the game map.
 *
 * Enhanced with:
 *   - Simplex noise texture for grass variation (Req 1.2)
 *   - Face shading: lit top face, darker side face (Req 1.1)
 *   - 1-pixel shadow edge along bottom-right perimeter (Req 1.1)
 *   - 3+ distinct palette colors for grass ground detail (Req 1.2)
 *   - Tree canopy with 2+ overlapping layers (Req 1.4)
 *   - Ordered dithering on terrain transition edges (Req 1.5)
 *   - Palette quantization as final pass (Req 10.2)
 *   - Maintains 64×32 pixel tile dimensions (Req 1.6)
 *   - BR→TL isometric viewpoint preserved (Req 10.3)
 *
 * Sprites produced:
 *   - grass-short-1, grass-short-2       (green meadow with noise texture)
 *   - grass-flowers-1, grass-flowers-2   (meadow with colored flower clusters)
 *   - road-full                          (sandy dirt road with crack details)
 *   - water-1, water-2, water-3          (blue water with ripple streaks)
 *   - bridge-mm                          (grey cobblestone with block pattern)
 *   - tree-1 through tree-7             (trees with layered canopy)
 *   - rock                               (grey stone on grass base)
 *
 * Usage:
 *   node js/level-generators/generate-iso-sprites-br-tl.js
 */

const sharp = require('sharp');
const path = require('path');

const {
    TILE_WIDTH,
    TILE_HEIGHT,
    OUTPUT_DIR,
    TERRAIN_COLORS,
    TERRAIN_SPRITES,
} = require('./lib/sprite-constants');

const {
    createBuffer,
    setPixel,
    isInsideDiamond,
    seededRandom,
    resetSeed,
    drawEdgeBorder,
} = require('./lib/pixel-utils');

const { fillDiamondWithSpeckle } = require('./lib/fill-patterns');

// Enhanced pipeline modules
const { createTerrainNoiseGenerator } = require('./lib/noise-texture');
const { applyFaceShading, applyShadowEdge } = require('./lib/shading');
const { applyOrderedDithering } = require('./lib/dithering');
const { quantizeToPalette } = require('./lib/palette-quantizer');
const { getPaletteForCategory, PRIMARY_PALETTE } = require('./lib/palette');

// ─── Palette colors for terrain shading ─────────────────────────────────────
// Top face (lit): grass green from palette
const TERRAIN_TOP_COLOR = PRIMARY_PALETTE[0];   // [95, 180, 72] grass green
// Side face (shadow): grass dark from palette
const TERRAIN_SIDE_COLOR = PRIMARY_PALETTE[1];  // [75, 155, 55] grass dark

// Road shading colors
const ROAD_TOP_COLOR = PRIMARY_PALETTE[2];      // [210, 165, 110] road tan
const ROAD_SIDE_COLOR = PRIMARY_PALETTE[7];     // [120, 78, 38] wood (darker brown)

// Water shading colors
const WATER_TOP_COLOR = PRIMARY_PALETTE[3];     // [45, 120, 210] water blue
const WATER_SIDE_COLOR = PRIMARY_PALETTE[13];   // [40, 60, 140] cape blue (darker)

// Bridge shading colors
const BRIDGE_TOP_COLOR = PRIMARY_PALETTE[15];   // [140, 138, 128] bridge stone
const BRIDGE_SIDE_COLOR = PRIMARY_PALETTE[8];   // [55, 55, 58] iron (darker)

// Grass detail colors (3+ distinct palette colors for ground detail - Req 1.2)
const GRASS_COLORS = [
    PRIMARY_PALETTE[0],  // [95, 180, 72] grass green (base)
    PRIMARY_PALETTE[1],  // [75, 155, 55] grass dark (shadow patches)
    PRIMARY_PALETTE[4],  // [48, 130, 42] tree canopy (deep green accents)
];

// ─── Sprite Generators ──────────────────────────────────────────────────────

/**
 * Generates a grass meadow sprite with simplex noise texture variation.
 * Uses at least 3 distinct palette colors for ground detail.
 *
 * @param {number} variant - Variant index (0 or 1) for different random patterns.
 * @param {function} noiseGen - Noise generator function (x, y, scale) => [-1, 1]
 * @returns {Buffer} The completed pixel buffer.
 */
function generateGrass(variant, noiseGen) {
    const buffer = createBuffer();

    // Fill diamond with noise-driven grass variation using 3 palette colors
    resetSeed(1000 + variant * 100);

    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                // Get noise value for this pixel position
                const noiseVal = noiseGen(x + variant * 64, y + variant * 32, 12);

                // Map noise to one of 3 grass palette colors
                let color;
                if (noiseVal < -0.3) {
                    color = GRASS_COLORS[2]; // deep green accents
                } else if (noiseVal < 0.3) {
                    color = GRASS_COLORS[0]; // base grass green
                } else {
                    color = GRASS_COLORS[1]; // dark grass
                }

                // Add subtle per-pixel variation
                const pixelNoise = (seededRandom() - 0.5) * 6;
                setPixel(buffer, x, y,
                    color[0] + pixelNoise,
                    color[1] + pixelNoise,
                    color[2] + pixelNoise);
            }
        }
    }

    // Apply face shading: lit top face, darker side face
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, TERRAIN_TOP_COLOR, TERRAIN_SIDE_COLOR);

    // Apply 1-pixel shadow edge along bottom-right
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);

    // Apply ordered dithering on transition edges (4-pixel border region)
    // Dither the bottom edge to simulate terrain transition
    applyOrderedDithering(buffer, TILE_WIDTH, TILE_HEIGHT,
        GRASS_COLORS[0], GRASS_COLORS[1], 4, 'bottom');

    drawEdgeBorder(buffer);

    // Final pass: quantize to terrain palette
    const palette = getPaletteForCategory('terrain');
    quantizeToPalette(buffer, palette);

    return buffer;
}

/**
 * Generates a grass sprite with colorful flower clusters scattered on top.
 * Uses noise texture for base grass variation.
 *
 * @param {number} variant - Variant index (0 or 1) for different flower placement.
 * @param {function} noiseGen - Noise generator function (x, y, scale) => [-1, 1]
 * @returns {Buffer} The completed pixel buffer.
 */
function generateFlowers(variant, noiseGen) {
    const buffer = createBuffer();

    // Noise-driven grass base with 3 palette colors
    resetSeed(2000 + variant * 100);

    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noiseVal = noiseGen(x + variant * 128, y + variant * 64, 14);

                let color;
                if (noiseVal < -0.25) {
                    color = GRASS_COLORS[2];
                } else if (noiseVal < 0.35) {
                    color = GRASS_COLORS[0];
                } else {
                    color = GRASS_COLORS[1];
                }

                const pixelNoise = (seededRandom() - 0.5) * 6;
                setPixel(buffer, x, y,
                    color[0] + pixelNoise,
                    color[1] + pixelNoise,
                    color[2] + pixelNoise);
            }
        }
    }

    // Place 4 flower clusters in random positions
    resetSeed(2080 + variant * 100);
    // Flower colors mapped to nearest palette colors (gold accent, straw)
    const flowerColors = [
        PRIMARY_PALETTE[14], // gold accent [200, 170, 50]
        PRIMARY_PALETTE[9],  // straw [195, 175, 95]
        PRIMARY_PALETTE[12], // armor silver [180, 180, 190]
        PRIMARY_PALETTE[11], // skin tone [210, 175, 140]
    ];

    for (let i = 0; i < 4; i++) {
        const flowerX = 12 + Math.floor(seededRandom() * 40);
        const flowerY = 4 + Math.floor(seededRandom() * 24);

        if (isInsideDiamond(flowerX, flowerY)) {
            const color = flowerColors[Math.floor(seededRandom() * 4)];

            // Draw a small cross-shaped cluster (5 pixels)
            setPixel(buffer, flowerX, flowerY, ...color);
            setPixel(buffer, flowerX + 1, flowerY, ...color);
            setPixel(buffer, flowerX - 1, flowerY, ...color);
            setPixel(buffer, flowerX, flowerY - 1, ...color);
            setPixel(buffer, flowerX, flowerY + 1, ...color);
        }
    }

    // Apply face shading
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, TERRAIN_TOP_COLOR, TERRAIN_SIDE_COLOR);

    // Apply shadow edge
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);

    // Apply dithering on bottom edge for terrain transition
    applyOrderedDithering(buffer, TILE_WIDTH, TILE_HEIGHT,
        GRASS_COLORS[0], GRASS_COLORS[1], 4, 'bottom');

    drawEdgeBorder(buffer);

    // Final pass: quantize to terrain palette
    const palette = getPaletteForCategory('terrain');
    quantizeToPalette(buffer, palette);

    return buffer;
}

/**
 * Generates a dirt road sprite with crack details.
 * Enhanced with face shading and shadow edge.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateRoad() {
    const buffer = createBuffer();

    // Sandy base fill
    fillDiamondWithSpeckle(buffer, TERRAIN_COLORS.road, 10, 3000);

    // Draw 5 small crack lines (darker brown, random-walk)
    resetSeed(3080);
    for (let crackIndex = 0; crackIndex < 5; crackIndex++) {
        let crackX = Math.floor(seededRandom() * TILE_WIDTH);
        let crackY = Math.floor(seededRandom() * TILE_HEIGHT);

        for (let step = 0; step < 4; step++) {
            if (isInsideDiamond(crackX, crackY)) {
                setPixel(buffer, crackX, crackY, ...PRIMARY_PALETTE[7]); // wood color for cracks
            }
            crackX += Math.floor(seededRandom() * 3) - 1;
            crackY += Math.floor(seededRandom() * 3) - 1;
        }
    }

    // Apply face shading: lit top, darker side
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, ROAD_TOP_COLOR, ROAD_SIDE_COLOR);

    // Apply shadow edge
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);

    // Apply dithering on edges for terrain transition (road to grass)
    applyOrderedDithering(buffer, TILE_WIDTH, TILE_HEIGHT,
        PRIMARY_PALETTE[2], PRIMARY_PALETTE[0], 4, 'left');

    drawEdgeBorder(buffer);

    // Final pass: quantize to terrain palette
    const palette = getPaletteForCategory('terrain');
    quantizeToPalette(buffer, palette);

    return buffer;
}

/**
 * Generates a water tile with short horizontal ripple streaks.
 * Enhanced with face shading and shadow edge.
 *
 * @param {number} variant - Variant index (0, 1, or 2) for different ripple placement.
 * @returns {Buffer} The completed pixel buffer.
 */
function generateWater(variant) {
    const buffer = createBuffer();

    // Blue water base
    fillDiamondWithSpeckle(buffer, TERRAIN_COLORS.water, 8, 4000 + variant * 100);

    // Draw 4 short horizontal ripple highlights
    resetSeed(4080 + variant * 100);
    for (let rippleIndex = 0; rippleIndex < 4; rippleIndex++) {
        const rippleX = 10 + Math.floor(seededRandom() * 44);
        const rippleY = 4 + Math.floor(seededRandom() * 24);

        if (isInsideDiamond(rippleX, rippleY)) {
            for (let pixel = 0; pixel < 4; pixel++) {
                // Use a palette color for ripple highlights
                setPixel(buffer, rippleX + pixel, rippleY, ...PRIMARY_PALETTE[12]); // armor silver as highlight
            }
        }
    }

    // Apply face shading: lit top, darker side
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, WATER_TOP_COLOR, WATER_SIDE_COLOR);

    // Apply shadow edge
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);

    // Apply dithering on right edge for water-to-terrain transition
    applyOrderedDithering(buffer, TILE_WIDTH, TILE_HEIGHT,
        PRIMARY_PALETTE[3], PRIMARY_PALETTE[0], 4, 'right');

    drawEdgeBorder(buffer);

    // Final pass: quantize to terrain palette
    const palette = getPaletteForCategory('terrain');
    quantizeToPalette(buffer, palette);

    return buffer;
}

/**
 * Generates a cobblestone bridge tile with an offset block pattern.
 * Enhanced with face shading and shadow edge.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateBridge() {
    const buffer = createBuffer();

    // Grey stone base
    fillDiamondWithSpeckle(buffer, TERRAIN_COLORS.bridgeStone, 8, 5000);

    // Draw stone block pattern (offset rows like brickwork)
    resetSeed(5080);
    for (let blockRow = 0; blockRow < TILE_HEIGHT; blockRow += 5) {
        const rowOffset = (blockRow / 5) % 2 === 0 ? 0 : 4;

        for (let blockCol = rowOffset; blockCol < TILE_WIDTH; blockCol += 8) {
            for (let pixelRow = 1; pixelRow < 3; pixelRow++) {
                for (let pixelCol = 1; pixelCol < 5; pixelCol++) {
                    const x = blockCol + pixelCol;
                    const y = blockRow + pixelRow;

                    if (isInsideDiamond(x, y)) {
                        const noise = (seededRandom() - 0.5) * 6;
                        setPixel(buffer, x, y,
                            TERRAIN_COLORS.bridgeStone[0] + noise,
                            TERRAIN_COLORS.bridgeStone[1] + noise,
                            TERRAIN_COLORS.bridgeStone[2] + noise);
                    }
                }
            }
        }
    }

    // Apply face shading: lit top, darker side
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, BRIDGE_TOP_COLOR, BRIDGE_SIDE_COLOR);

    // Apply shadow edge
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);

    drawEdgeBorder(buffer);

    // Final pass: quantize to terrain palette
    const palette = getPaletteForCategory('terrain');
    quantizeToPalette(buffer, palette);

    return buffer;
}

/**
 * Generates a tree sprite with grass base, ground shadow, bark trunk, and
 * 2+ overlapping canopy layers with inner shadow, mid-tone fill, and highlight rim.
 * The trunk is visible on the bottom-right side (BR→TL viewpoint).
 *
 * Canopy layers (Req 1.4):
 *   Layer 1 (inner/back): Larger, darker canopy providing depth
 *   Layer 2 (outer/front): Smaller, brighter canopy on top with highlight rim
 *
 * @param {number} variant - Variant index (0–6) controlling canopy size and randomness.
 * @param {function} noiseGen - Noise generator function (x, y, scale) => [-1, 1]
 * @returns {Buffer} The completed pixel buffer.
 */
function generateTree(variant, noiseGen) {
    const buffer = createBuffer();

    // Grass base underneath the tree with noise variation
    resetSeed(6000 + variant * 100);
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noiseVal = noiseGen(x + variant * 64, y, 10);
                let color;
                if (noiseVal < -0.3) {
                    color = GRASS_COLORS[2];
                } else if (noiseVal < 0.3) {
                    color = GRASS_COLORS[0];
                } else {
                    color = GRASS_COLORS[1];
                }
                const pixelNoise = (seededRandom() - 0.5) * 5;
                setPixel(buffer, x, y,
                    color[0] + pixelNoise,
                    color[1] + pixelNoise,
                    color[2] + pixelNoise);
            }
        }
    }

    const centerX = 32;
    const centerY = 16;
    const canopyRadius = 9 + (variant % 2) * 2; // alternates between 9 and 11

    // Position trunk slightly to the bottom-right (visible from BR viewpoint)
    const trunkX = centerX + 3;
    const trunkY = centerY + 4;

    resetSeed(6070 + variant * 100);

    // ── Ground shadow (dark green ellipse beneath the tree) ──
    for (let offsetY = -2; offsetY <= 2; offsetY++) {
        for (let offsetX = -4; offsetX <= 4; offsetX++) {
            const shadowX = centerX + offsetX + 2;
            const shadowY = centerY + offsetY + canopyRadius - 2;

            if (isInsideDiamond(shadowX, shadowY)) {
                // Use palette dark green for shadow
                setPixel(buffer, shadowX, shadowY, ...GRASS_COLORS[2]);
            }
        }
    }

    // ── Trunk (bark texture, visible below-right of canopy) ──
    for (let offsetY = -3; offsetY <= 5; offsetY++) {
        for (let offsetX = -2; offsetX <= 2; offsetX++) {
            if (isInsideDiamond(trunkX + offsetX, trunkY + offsetY)) {
                // Use wood palette color for trunk
                setPixel(buffer, trunkX + offsetX, trunkY + offsetY, ...PRIMARY_PALETTE[7]);
            }
        }
    }

    // ── Canopy Layer 1 (inner/back layer - larger, provides depth) ──
    // This is the shadow/back layer with inner shadow zone and mid-tone fill
    resetSeed(6080 + variant * 100);
    const innerRadius = canopyRadius;
    for (let offsetY = -innerRadius; offsetY <= innerRadius; offsetY++) {
        for (let offsetX = -innerRadius; offsetX <= innerRadius; offsetX++) {
            const distanceFromCenter = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            const canopyX = centerX + offsetX;
            const canopyY = centerY + offsetY - 2; // raised 2px above center

            if (distanceFromCenter <= innerRadius && isInsideDiamond(canopyX, canopyY)) {
                // Inner shadow zone: dark canopy color (deep green)
                // This layer is entirely the shadow/dark tone
                const noise = (seededRandom() - 0.5) * 4;
                // Inner shadow zone for the back layer
                if (distanceFromCenter < innerRadius * 0.5) {
                    // Inner shadow: darkest
                    setPixel(buffer, canopyX, canopyY,
                        GRASS_COLORS[2][0] + noise,
                        GRASS_COLORS[2][1] + noise,
                        GRASS_COLORS[2][2] + noise);
                } else {
                    // Mid-tone fill for back layer
                    setPixel(buffer, canopyX, canopyY,
                        TERRAIN_COLORS.treeCanopy[0] + noise,
                        TERRAIN_COLORS.treeCanopy[1] + noise,
                        TERRAIN_COLORS.treeCanopy[2] + noise);
                }
            }
        }
    }

    // ── Canopy Layer 2 (outer/front layer - smaller, brighter, with highlight rim) ──
    resetSeed(6090 + variant * 100);
    const outerRadius = canopyRadius - 3;
    for (let offsetY = -outerRadius; offsetY <= outerRadius; offsetY++) {
        for (let offsetX = -outerRadius; offsetX <= outerRadius; offsetX++) {
            const distanceFromCenter = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            const canopyX = centerX + offsetX - 1; // slightly offset for depth
            const canopyY = centerY + offsetY - 3; // raised higher

            if (distanceFromCenter <= outerRadius && isInsideDiamond(canopyX, canopyY)) {
                const noise = (seededRandom() - 0.5) * 5;

                let leafColor;
                if (distanceFromCenter < outerRadius * 0.4) {
                    // Inner shadow zone of front layer
                    leafColor = GRASS_COLORS[2]; // deep green
                } else if (distanceFromCenter > outerRadius * 0.8) {
                    // Highlight rim (at least 1 pixel width) - bright green
                    leafColor = GRASS_COLORS[0]; // grass green (brightest)
                } else {
                    // Mid-tone fill
                    leafColor = TERRAIN_COLORS.treeCanopy; // standard canopy
                }

                setPixel(buffer, canopyX, canopyY,
                    leafColor[0] + noise,
                    leafColor[1] + noise,
                    leafColor[2] + noise);
            }
        }
    }

    // Apply face shading to the whole tile
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, TERRAIN_TOP_COLOR, TERRAIN_SIDE_COLOR);

    // Apply shadow edge
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);

    // Apply dithering on bottom edge for terrain transition
    applyOrderedDithering(buffer, TILE_WIDTH, TILE_HEIGHT,
        GRASS_COLORS[0], GRASS_COLORS[1], 4, 'bottom');

    drawEdgeBorder(buffer);

    // Final pass: quantize to terrain palette
    const palette = getPaletteForCategory('terrain');
    quantizeToPalette(buffer, palette);

    return buffer;
}

/**
 * Generates a rock sprite — a grey stone sitting on a grass base.
 * Enhanced with face shading and shadow edge.
 *
 * @param {function} noiseGen - Noise generator function (x, y, scale) => [-1, 1]
 * @returns {Buffer} The completed pixel buffer.
 */
function generateRock(noiseGen) {
    const buffer = createBuffer();

    // Grass base with noise variation
    resetSeed(7000);
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noiseVal = noiseGen(x, y, 10);
                let color;
                if (noiseVal < -0.3) {
                    color = GRASS_COLORS[2];
                } else if (noiseVal < 0.3) {
                    color = GRASS_COLORS[0];
                } else {
                    color = GRASS_COLORS[1];
                }
                const pixelNoise = (seededRandom() - 0.5) * 5;
                setPixel(buffer, x, y,
                    color[0] + pixelNoise,
                    color[1] + pixelNoise,
                    color[2] + pixelNoise);
            }
        }
    }

    // Draw a roughly circular grey stone in the center
    const centerX = 32;
    const centerY = 16;
    resetSeed(7080);

    for (let offsetY = -4; offsetY <= 4; offsetY++) {
        for (let offsetX = -5; offsetX <= 5; offsetX++) {
            const isInsideRock = (offsetX * offsetX + offsetY * offsetY) <= 20;

            if (isInsideRock && isInsideDiamond(centerX + offsetX, centerY + offsetY)) {
                // Use bridge stone palette color for rock
                setPixel(buffer, centerX + offsetX, centerY + offsetY,
                    ...PRIMARY_PALETTE[15]); // bridge stone
            }
        }
    }

    // Apply face shading
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, TERRAIN_TOP_COLOR, TERRAIN_SIDE_COLOR);

    // Apply shadow edge
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);

    // Apply dithering on bottom edge for terrain transition
    applyOrderedDithering(buffer, TILE_WIDTH, TILE_HEIGHT,
        GRASS_COLORS[0], GRASS_COLORS[1], 4, 'bottom');

    drawEdgeBorder(buffer);

    // Final pass: quantize to terrain palette
    const palette = getPaletteForCategory('terrain');
    quantizeToPalette(buffer, palette);

    return buffer;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function generateAll() {
    // Initialize noise generators for deterministic terrain variation
    const grassNoiseGen = await createTerrainNoiseGenerator(42);
    const treeNoiseGen = await createTerrainNoiseGenerator(84);
    const rockNoiseGen = await createTerrainNoiseGenerator(126);

    const sprites = [
        { name: TERRAIN_SPRITES.grassShort1, buffer: generateGrass(0, grassNoiseGen) },
        { name: TERRAIN_SPRITES.grassShort2, buffer: generateGrass(1, grassNoiseGen) },
        { name: TERRAIN_SPRITES.grassFlowers1, buffer: generateFlowers(0, grassNoiseGen) },
        { name: TERRAIN_SPRITES.grassFlowers2, buffer: generateFlowers(1, grassNoiseGen) },
        { name: TERRAIN_SPRITES.road, buffer: generateRoad() },
        { name: TERRAIN_SPRITES.water1, buffer: generateWater(0) },
        { name: TERRAIN_SPRITES.water2, buffer: generateWater(1) },
        { name: TERRAIN_SPRITES.water3, buffer: generateWater(2) },
        { name: TERRAIN_SPRITES.bridge, buffer: generateBridge() },
        { name: TERRAIN_SPRITES.tree1, buffer: generateTree(0, treeNoiseGen) },
        { name: TERRAIN_SPRITES.tree2, buffer: generateTree(1, treeNoiseGen) },
        { name: TERRAIN_SPRITES.tree3, buffer: generateTree(2, treeNoiseGen) },
        { name: TERRAIN_SPRITES.tree4, buffer: generateTree(3, treeNoiseGen) },
        { name: TERRAIN_SPRITES.tree5, buffer: generateTree(4, treeNoiseGen) },
        { name: TERRAIN_SPRITES.tree6, buffer: generateTree(5, treeNoiseGen) },
        { name: TERRAIN_SPRITES.tree7, buffer: generateTree(6, treeNoiseGen) },
        { name: TERRAIN_SPRITES.rock, buffer: generateRock(rockNoiseGen) },
    ];

    for (const sprite of sprites) {
        await sharp(sprite.buffer, { raw: { width: TILE_WIDTH, height: TILE_HEIGHT, channels: 4 } })
            .png()
            .toFile(path.join(OUTPUT_DIR, `${sprite.name}.png`));
        console.log(`  ✓ ${sprite.name}.png`);
    }

    console.log(`\nDone! ${sprites.length} enhanced flat diamond sprites (64×32, BR→TL).`);
}

generateAll().catch(error => { console.error(error); process.exit(1); });
