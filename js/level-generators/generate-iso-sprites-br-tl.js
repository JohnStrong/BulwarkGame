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
    CASTLE_COLORS,
    TERRAIN_SPRITES,
    TREE_OVERLAY_SPRITES,
    CASTLE_OVERLAY_SPRITES,
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

// ─── Overlay sprite dimensions ──────────────────────────────────────────────
/** Width of tree overlay sprites in pixels (matches TILE_WIDTH). */
const OVERLAY_WIDTH = 64;
/** Height of tree overlay sprites in pixels (extends 16 px above the 32 px tile). */
const OVERLAY_HEIGHT = 48;

/**
 * Allocates a blank 64×48 RGBA buffer initialized to all zeros (fully transparent).
 * Used as the starting canvas for tree overlay sprite generation.
 *
 * @returns {Buffer} A 64×48×4 byte buffer filled with zeros.
 */
function createOverlayBuffer() {
    return Buffer.alloc(OVERLAY_WIDTH * OVERLAY_HEIGHT * 4, 0);
}

/**
 * Writes one fully opaque pixel into a 64×48 overlay buffer.
 * Coordinates outside the 64×48 bounds are silently ignored.
 * Color values are clamped to 0–255.
 *
 * @param {Buffer} buffer - The 64×48 RGBA overlay buffer.
 * @param {number} x - Horizontal position (0 = left edge).
 * @param {number} y - Vertical position (0 = top edge).
 * @param {number} red - Red channel value (0–255).
 * @param {number} green - Green channel value (0–255).
 * @param {number} blue - Blue channel value (0–255).
 */
function setOverlayPixel(buffer, x, y, red, green, blue) {
    if (x < 0 || x >= OVERLAY_WIDTH || y < 0 || y >= OVERLAY_HEIGHT) return;
    const index = (y * OVERLAY_WIDTH + x) * 4;
    buffer[index]     = Math.max(0, Math.min(255, Math.round(red)));
    buffer[index + 1] = Math.max(0, Math.min(255, Math.round(green)));
    buffer[index + 2] = Math.max(0, Math.min(255, Math.round(blue)));
    buffer[index + 3] = 255;
}

/**
 * Generates a tree overlay sprite with a transparent background.
 *
 * The canvas is 64×48 pixels (OVERLAY_WIDTH × OVERLAY_HEIGHT). Every pixel
 * outside the trunk and canopy shape has alpha=0. Every pixel inside has
 * alpha=255. The same palette colors and layered-canopy technique as
 * `generateTree` are used, adapted for a transparent background.
 *
 * Canopy shapes (Req 1.5):
 *   - oak:   Rounded ellipse, 2 layers, canopy radius 11–13 px
 *   - pine:  Pointed/conical stacked rings, radius 8–10 px
 *   - shrub: Low wide flat ellipse, radius 6–8 px
 *
 * @param {number} variant - Variant index (0-based) selecting which variant.
 * @param {'oak'|'pine'|'shrub'} treeType - Controls canopy shape.
 * @param {function} noiseGen - Noise generator (x, y, scale) => [-1, 1]
 * @returns {Buffer} A 64×48 RGBA pixel buffer (transparent background).
 */
function generateTreeOverlay(variant, treeType, noiseGen) {
    // Start from an all-transparent buffer (alpha=0 everywhere) — Req 1.2
    const buffer = createOverlayBuffer();

    // The overlay canvas is 64×48. The bottom 32 rows correspond to the tile
    // surface; the top 16 rows allow the canopy to bleed upward.
    // Center the tree horizontally and position it so the trunk base sits at
    // the tile surface (y=32 in overlay coords = y=0 in tile coords).
    const centerX = 32;
    // Place canopy center in the upper portion of the canvas so the tree
    // appears to stand on the tile. The trunk base is near y=40 (overlay).
    const centerY = 28;

    resetSeed(8000 + variant * 100 + (treeType === 'oak' ? 0 : treeType === 'pine' ? 1000 : 2000));

    if (treeType === 'oak') {
        // ── Oak: rounded ellipse, 2 layers, canopy radius 11–13 px ──────────
        const canopyRadius = 11 + (variant % 3); // 11, 12, or 13

        // Trunk position: slightly to the bottom-right (BR→TL viewpoint)
        const trunkX = centerX + 3;
        const trunkY = centerY + canopyRadius - 2;

        // ── Trunk ──
        resetSeed(8010 + variant * 100);
        for (let offsetY = -2; offsetY <= 6; offsetY++) {
            for (let offsetX = -2; offsetX <= 2; offsetX++) {
                setOverlayPixel(buffer,
                    trunkX + offsetX, trunkY + offsetY,
                    ...PRIMARY_PALETTE[7]); // wood color
            }
        }

        // ── Canopy Layer 1 (inner/back — larger, darker, provides depth) ──
        resetSeed(8020 + variant * 100);
        const innerRadius = canopyRadius;
        for (let offsetY = -innerRadius; offsetY <= innerRadius; offsetY++) {
            for (let offsetX = -innerRadius; offsetX <= innerRadius; offsetX++) {
                const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
                const canopyX = centerX + offsetX;
                const canopyY = centerY + offsetY - 2; // raised 2px

                if (dist <= innerRadius) {
                    const noise = (seededRandom() - 0.5) * 4;
                    if (dist < innerRadius * 0.5) {
                        // Inner shadow zone: darkest
                        setOverlayPixel(buffer, canopyX, canopyY,
                            GRASS_COLORS[2][0] + noise,
                            GRASS_COLORS[2][1] + noise,
                            GRASS_COLORS[2][2] + noise);
                    } else {
                        // Mid-tone fill
                        setOverlayPixel(buffer, canopyX, canopyY,
                            TERRAIN_COLORS.treeCanopy[0] + noise,
                            TERRAIN_COLORS.treeCanopy[1] + noise,
                            TERRAIN_COLORS.treeCanopy[2] + noise);
                    }
                }
            }
        }

        // ── Canopy Layer 2 (outer/front — smaller, brighter, highlight rim) ──
        resetSeed(8030 + variant * 100);
        const outerRadius = canopyRadius - 3;
        for (let offsetY = -outerRadius; offsetY <= outerRadius; offsetY++) {
            for (let offsetX = -outerRadius; offsetX <= outerRadius; offsetX++) {
                const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
                const canopyX = centerX + offsetX - 1; // slight depth offset
                const canopyY = centerY + offsetY - 3; // raised higher

                if (dist <= outerRadius) {
                    const noise = (seededRandom() - 0.5) * 5;
                    let leafColor;
                    if (dist < outerRadius * 0.4) {
                        leafColor = GRASS_COLORS[2]; // inner shadow: deep green
                    } else if (dist > outerRadius * 0.8) {
                        leafColor = GRASS_COLORS[0]; // highlight rim: bright green
                    } else {
                        leafColor = TERRAIN_COLORS.treeCanopy; // mid-tone fill
                    }
                    setOverlayPixel(buffer, canopyX, canopyY,
                        leafColor[0] + noise,
                        leafColor[1] + noise,
                        leafColor[2] + noise);
                }
            }
        }

    } else if (treeType === 'pine') {
        // ── Pine: pointed/conical stacked rings, radius 8–10 px ─────────────
        const baseRadius = 8 + (variant % 3); // 8, 9, or 10

        // Trunk: centered, narrow
        const trunkX = centerX;
        const trunkY = centerY + baseRadius - 1;

        resetSeed(8110 + variant * 100);
        for (let offsetY = -1; offsetY <= 7; offsetY++) {
            for (let offsetX = -1; offsetX <= 1; offsetX++) {
                setOverlayPixel(buffer,
                    trunkX + offsetX, trunkY + offsetY,
                    ...PRIMARY_PALETTE[7]); // wood color
            }
        }

        // ── Stacked conical rings (bottom to top, each ring narrower) ──
        // 4 rings: bottom is widest, top is narrowest (pointed tip)
        const ringCount = 4;
        resetSeed(8120 + variant * 100);
        for (let ring = 0; ring < ringCount; ring++) {
            // Each ring is narrower and higher than the one below
            const ringRadius = Math.round(baseRadius * (1 - ring * 0.22));
            // Vertical scale: pine is taller than wide (conical shape)
            const ringRadiusY = Math.round(ringRadius * 0.55);
            const ringCenterY = centerY + Math.round(baseRadius * 0.5) - ring * Math.round(baseRadius * 0.55);

            for (let offsetY = -ringRadiusY; offsetY <= ringRadiusY; offsetY++) {
                for (let offsetX = -ringRadius; offsetX <= ringRadius; offsetX++) {
                    // Ellipse test: (x/rx)^2 + (y/ry)^2 <= 1
                    const rx = ringRadius > 0 ? ringRadius : 1;
                    const ry = ringRadiusY > 0 ? ringRadiusY : 1;
                    const inEllipse = (offsetX * offsetX) / (rx * rx) +
                                      (offsetY * offsetY) / (ry * ry) <= 1;

                    if (inEllipse) {
                        const canopyX = centerX + offsetX;
                        const canopyY = ringCenterY + offsetY;
                        const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
                        const outerR = Math.sqrt(rx * rx + ry * ry) * 0.5;
                        const noise = (seededRandom() - 0.5) * 4;

                        let leafColor;
                        if (dist < outerR * 0.4) {
                            leafColor = GRASS_COLORS[2]; // inner shadow
                        } else if (dist > outerR * 0.75) {
                            leafColor = GRASS_COLORS[0]; // highlight rim
                        } else {
                            leafColor = TERRAIN_COLORS.treeCanopy; // mid-tone
                        }
                        setOverlayPixel(buffer, canopyX, canopyY,
                            leafColor[0] + noise,
                            leafColor[1] + noise,
                            leafColor[2] + noise);
                    }
                }
            }
        }

    } else {
        // ── Shrub: low wide flat ellipse, radius 6–8 px ──────────────────────
        const canopyRadiusX = 6 + (variant % 3); // 6, 7, or 8 (wide)
        const canopyRadiusY = Math.round(canopyRadiusX * 0.5); // flat (half height)

        // Trunk: very short, centered
        const trunkX = centerX;
        const trunkY = centerY + canopyRadiusY + 1;

        resetSeed(8210 + variant * 100);
        for (let offsetY = 0; offsetY <= 4; offsetY++) {
            for (let offsetX = -1; offsetX <= 1; offsetX++) {
                setOverlayPixel(buffer,
                    trunkX + offsetX, trunkY + offsetY,
                    ...PRIMARY_PALETTE[7]); // wood color
            }
        }

        // ── Single flat ellipse canopy (low and wide) ──
        resetSeed(8220 + variant * 100);
        const rx = canopyRadiusX;
        const ry = canopyRadiusY > 0 ? canopyRadiusY : 1;

        for (let offsetY = -ry; offsetY <= ry; offsetY++) {
            for (let offsetX = -rx; offsetX <= rx; offsetX++) {
                const inEllipse = (offsetX * offsetX) / (rx * rx) +
                                  (offsetY * offsetY) / (ry * ry) <= 1;

                if (inEllipse) {
                    const canopyX = centerX + offsetX;
                    const canopyY = centerY + offsetY;
                    const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
                    const outerR = Math.sqrt(rx * rx + ry * ry) * 0.5;
                    const noise = (seededRandom() - 0.5) * 4;

                    let leafColor;
                    if (dist < outerR * 0.4) {
                        leafColor = GRASS_COLORS[2]; // inner shadow: deep green
                    } else if (dist > outerR * 0.75) {
                        leafColor = GRASS_COLORS[0]; // highlight rim: bright green
                    } else {
                        leafColor = TERRAIN_COLORS.treeCanopy; // mid-tone fill
                    }
                    setOverlayPixel(buffer, canopyX, canopyY,
                        leafColor[0] + noise,
                        leafColor[1] + noise,
                        leafColor[2] + noise);
                }
            }
        }
    }

    // Final pass: quantize to terrain palette (same as generateTree) — Req 1.4
    const palette = getPaletteForCategory('terrain');
    quantizeToPalette(buffer, palette);

    return buffer;
}

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

    // ── Tree overlay sprites (64×48, transparent background) ────────────────
    const overlayNoiseGen = await createTerrainNoiseGenerator(168);

    const overlaySprites = [
        { name: TREE_OVERLAY_SPRITES.treeOakOverlay1,   buffer: generateTreeOverlay(0, 'oak',   overlayNoiseGen) },
        { name: TREE_OVERLAY_SPRITES.treeOakOverlay2,   buffer: generateTreeOverlay(1, 'oak',   overlayNoiseGen) },
        { name: TREE_OVERLAY_SPRITES.treeOakOverlay3,   buffer: generateTreeOverlay(2, 'oak',   overlayNoiseGen) },
        { name: TREE_OVERLAY_SPRITES.treePineOverlay1,  buffer: generateTreeOverlay(0, 'pine',  overlayNoiseGen) },
        { name: TREE_OVERLAY_SPRITES.treePineOverlay2,  buffer: generateTreeOverlay(1, 'pine',  overlayNoiseGen) },
        { name: TREE_OVERLAY_SPRITES.treeShrubOverlay1, buffer: generateTreeOverlay(0, 'shrub', overlayNoiseGen) },
        { name: TREE_OVERLAY_SPRITES.treeShrubOverlay2, buffer: generateTreeOverlay(1, 'shrub', overlayNoiseGen) },
    ];

    for (const sprite of overlaySprites) {
        await sharp(sprite.buffer, { raw: { width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT, channels: 4 } })
            .png()
            .toFile(path.join(OUTPUT_DIR, `${sprite.name}.png`));
        console.log(`  ✓ ${sprite.name}.png`);
    }

    // ── Isometric wall overlay sprites (64×48, transparent background) ───────
    // A single sprite drawn along the diamond's bottom edges — used by all castle tiles.
    const isoWallSprites = [
        { name: CASTLE_OVERLAY_SPRITES.isoWall,        buffer: generateIsoWallOverlay(false) },
        { name: CASTLE_OVERLAY_SPRITES.isoWallDamaged, buffer: generateIsoWallOverlay(true)  },
    ];

    for (const sprite of isoWallSprites) {
        await sharp(sprite.buffer, { raw: { width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT, channels: 4 } })
            .png()
            .toFile(path.join(OUTPUT_DIR, `${sprite.name}.png`));
        console.log(`  ✓ ${sprite.name}.png`);
    }

    console.log(`\nDone! ${sprites.length} enhanced flat diamond sprites (64×32, BR→TL) + ${overlaySprites.length} tree overlay sprites (64×48) + ${isoWallSprites.length} isometric wall overlay sprites (64×48).`);
}

if (require.main === module) {
    generateAll().catch(error => { console.error(error); process.exit(1); });
}

// ─── Castle Overlay Buffer Helpers ──────────────────────────────────────────

/**
 * Allocates a blank RGBA buffer of the given dimensions, initialized to all
 * zeros (fully transparent). Used as the starting canvas for castle overlay
 * sprite generation.
 *
 * @param {number} width  - Canvas width in pixels (always 64)
 * @param {number} height - Canvas height in pixels (48, 64, or 80)
 * @returns {Buffer} A width×height×4 byte buffer filled with zeros.
 */
function createCastleOverlayBuffer(width, height) {
    return Buffer.alloc(width * height * 4, 0);
}

/**
 * Writes one fully opaque pixel into a castle overlay buffer.
 * Coordinates outside the canvas bounds are silently ignored.
 *
 * @param {Buffer} buffer - The RGBA overlay buffer.
 * @param {number} width  - Canvas width (for stride calculation).
 * @param {number} x - Horizontal position (0 = left edge).
 * @param {number} y - Vertical position (0 = top edge).
 * @param {number} r - Red channel value (0–255).
 * @param {number} g - Green channel value (0–255).
 * @param {number} b - Blue channel value (0–255).
 */
function setCastleOverlayPixel(buffer, width, x, y, r, g, b) {
    const height = buffer.length / (width * 4);
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    buffer[idx]     = r;
    buffer[idx + 1] = g;
    buffer[idx + 2] = b;
    buffer[idx + 3] = 255;
}

// ─── Castle Overlay Sprite Generator ────────────────────────────────────────

/**
 * Canvas height constants for each structure category.
 * The bottom TILE_HEIGHT (32) rows of each canvas correspond to the ground
 * diamond surface and must remain alpha=0. Only the rows above that are drawn.
 *
 * Heights are chosen to give epic castle scale (reference: isometric castle
 * artwork where walls are ~2 tile-heights and towers are ~3-4 tile-heights).
 * Units standing on top of walls/towers will appear above the ground plane.
 */
const CASTLE_OVERLAY_CANVAS_HEIGHTS = {
    wall:       96,  // 64 px above ground = 2 full tile heights of wall
    bridge:     48,  // 16 px above ground (low parapets on bridge)
    tower:      128, // 96 px above ground = 3 tile heights — round tower with battlements
    keep:       128, // 96 px above ground — imposing keep walls
    gatehouse:  144, // 112 px above ground — tallest structure with arch and flanking turrets
};

/**
 * Returns the canvas height for a given structure type.
 * @param {string} structureType
 * @returns {number}
 */
function getCastleOverlayHeight(structureType) {
    if (structureType === 'wall') return CASTLE_OVERLAY_CANVAS_HEIGHTS.wall;
    if (structureType === 'bridge-mm' || structureType === 'bridge-start' ||
        structureType === 'bridge-mid' || structureType === 'bridge-gate') {
        return CASTLE_OVERLAY_CANVAS_HEIGHTS.bridge;
    }
    if (structureType === 'tower') return CASTLE_OVERLAY_CANVAS_HEIGHTS.tower;
    if (structureType === 'keep-tl' || structureType === 'keep-bl' ||
        structureType === 'keep-br' || structureType === 'keep-center') {
        return CASTLE_OVERLAY_CANVAS_HEIGHTS.keep;
    }
    if (structureType === 'gatehouse') return CASTLE_OVERLAY_CANVAS_HEIGHTS.gatehouse;
    throw new Error(`Unknown castle structure type: "${structureType}"`);
}

/**
 * Draws a horizontal stone course row into the overlay buffer.
 * Rows are drawn in the "above ground" area only (y < height - TILE_HEIGHT).
 *
 * @param {Buffer} buffer
 * @param {number} width
 * @param {number} height
 * @param {number} y - Row index in the overlay canvas
 * @param {number} xStart - Left edge of the wall face
 * @param {number} xEnd - Right edge of the wall face (exclusive)
 * @param {number[]} color - [r, g, b]
 * @param {boolean} isMortar - Whether this row is a mortar line
 */
function drawStoneRow(buffer, width, height, y, xStart, xEnd, color, isMortar) {
    const groundStart = height - TILE_HEIGHT; // rows below this are ground diamond (alpha=0)
    if (y < 0 || y >= groundStart) return;
    const [r, g, b] = color;
    for (let x = xStart; x < xEnd; x++) {
        if (x < 0 || x >= width) continue;
        setCastleOverlayPixel(buffer, width, x, y, r, g, b);
    }
}

/**
 * Draws a filled rectangle into the overlay buffer, respecting the ground boundary.
 *
 * @param {Buffer} buffer
 * @param {number} width
 * @param {number} height
 * @param {number} x0 - Left edge (inclusive)
 * @param {number} y0 - Top edge (inclusive)
 * @param {number} x1 - Right edge (exclusive)
 * @param {number} y1 - Bottom edge (exclusive)
 * @param {number[]} color - [r, g, b]
 */
function fillRect(buffer, width, height, x0, y0, x1, y1, color) {
    const groundStart = height - TILE_HEIGHT;
    const [r, g, b] = color;
    for (let y = y0; y < y1; y++) {
        if (y < 0 || y >= groundStart) continue;
        for (let x = x0; x < x1; x++) {
            if (x < 0 || x >= width) continue;
            setCastleOverlayPixel(buffer, width, x, y, r, g, b);
        }
    }
}

/**
 * Draws a stone wall face with horizontal block courses and mortar lines.
 * The wall face spans from x0 to x1 and from y0 to the ground boundary.
 *
 * @param {Buffer} buffer
 * @param {number} width
 * @param {number} height
 * @param {number} x0 - Left edge of wall face
 * @param {number} x1 - Right edge of wall face (exclusive)
 * @param {number} y0 - Top of wall face
 * @param {number[]} wallColor - Main stone color
 * @param {number[]} wallLightColor - Lighter stone variant
 * @param {number[]} mortarColor - Mortar line color
 * @param {boolean} damaged - Whether to use more dark pixels
 * @param {number} seedOffset - Seed offset for reproducibility
 */
function drawWallFace(buffer, width, height, x0, x1, y0, wallColor, wallLightColor, mortarColor, damaged, seedOffset) {
    const groundStart = height - TILE_HEIGHT;
    const courseHeight = 5; // 4 stone + 1 mortar
    const blockMinWidth = 6;
    const blockMaxWidth = 10;

    resetSeed(20000 + seedOffset);

    for (let courseIndex = 0; courseIndex * courseHeight + y0 < groundStart; courseIndex++) {
        const courseY = y0 + courseIndex * courseHeight;
        const rowOffset = (courseIndex % 2 === 0) ? 0 : 4;

        // Mortar line at bottom of each course
        const mortarY = courseY + courseHeight - 1;
        drawStoneRow(buffer, width, height, mortarY, x0, x1, mortarColor, true);

        // Stone blocks within the course
        let blockX = x0 + rowOffset;
        while (blockX < x1) {
            const blockWidth = blockMinWidth + Math.floor(seededRandom() * (blockMaxWidth - blockMinWidth + 1));
            const useLight = !damaged && seededRandom() > 0.5;
            const baseColor = useLight ? wallLightColor : wallColor;

            for (let py = 0; py < courseHeight - 1; py++) {
                const y = courseY + py;
                if (y < 0 || y >= groundStart) continue;
                for (let px = 0; px < blockWidth - 1; px++) {
                    const x = blockX + px;
                    if (x < x0 || x >= x1 || x < 0 || x >= width) continue;
                    const variation = damaged
                        ? (seededRandom() - 0.7) * 14  // bias toward darker
                        : (seededRandom() - 0.5) * 10;
                    const nr = Math.max(0, Math.min(255, baseColor[0] + variation));
                    const ng = Math.max(0, Math.min(255, baseColor[1] + variation));
                    const nb = Math.max(0, Math.min(255, baseColor[2] + variation));
                    setCastleOverlayPixel(buffer, width, x, y, nr, ng, nb);
                }
            }
            blockX += blockWidth;
        }
    }
}

/**
 * Draws battlements (merlons and crenels) along the top of a wall.
 * Merlons are raised stone blocks; crenels are gaps (alpha=0).
 *
 * @param {Buffer} buffer
 * @param {number} width
 * @param {number} height
 * @param {number} x0 - Left edge of battlement row
 * @param {number} x1 - Right edge of battlement row (exclusive)
 * @param {number} topY - Y position of the top of the battlements
 * @param {number[]} merlonColor - Color for merlon blocks
 * @param {boolean} damaged - Damaged merlons are shorter/broken
 */
function drawBattlements(buffer, width, height, x0, x1, topY, merlonColor, damaged) {
    const merlonWidth = 5;
    const crenelWidth = 4;
    const merlonHeight = damaged ? 3 : 5;
    const period = merlonWidth + crenelWidth;

    for (let x = x0; x < x1; x++) {
        const posInPeriod = (x - x0) % period;
        const isMerlon = posInPeriod < merlonWidth;

        if (isMerlon) {
            // Draw merlon block
            for (let dy = 0; dy < merlonHeight; dy++) {
                const y = topY + dy;
                if (x >= 0 && x < width) {
                    setCastleOverlayPixel(buffer, width, x, y, ...merlonColor);
                }
            }
        }
        // Crenels are gaps — leave alpha=0 (already transparent)
    }
}

/**
 * Generates a castle structure overlay sprite with a transparent background.
 * Only the structure's vertical body (walls, battlements, arch, portcullis,
 * planks) is drawn with alpha=255. The isometric ground diamond surface is
 * excluded (alpha=0).
 *
 * Canvas dimensions by structure category:
 *   - wall / bridge-*: 64×48 (16 px above the 32 px ground diamond)
 *   - tower / keep-*:  64×64 (32 px above the 32 px ground diamond)
 *   - gatehouse:       64×80 (48 px above the 32 px ground diamond)
 *
 * @param {'wall'|'tower'|'keep-tl'|'keep-bl'|'keep-br'|'keep-center'|
 *          'gatehouse'|'bridge-mm'|'bridge-start'|'bridge-mid'|'bridge-gate'} structureType
 * @param {boolean} damaged - Whether to draw the damaged variant appearance.
 * @returns {Buffer} RGBA pixel buffer at the correct canvas dimensions.
 */
function generateCastleOverlay(structureType, damaged) {
    const W = 64;
    const H = getCastleOverlayHeight(structureType);
    const buffer = createCastleOverlayBuffer(W, H);

    // groundStart: the first row that belongs to the ground diamond (alpha=0)
    // Everything above this row (y < groundStart) is the structure's vertical body.
    const groundStart = H - TILE_HEIGHT; // e.g. 48-32=16, 64-32=32, 80-32=48

    const castlePalette = getPaletteForCategory('castle');

    // ── Wall ──────────────────────────────────────────────────────────────────
    if (structureType === 'wall') {
        // Imposing castle wall — 64 px of stone above the ground tile.
        // Three visible faces in the BR→TL isometric view:
        //   Left shadow face  (x: 0..15)  — darkest, side wall receding into distance
        //   Front main face   (x: 15..49) — primary face with brickwork and window slits
        //   Right lit face    (x: 49..63) — lighter, slight specular hit from upper-left
        const wallColor      = damaged ? CASTLE_COLORS.wallDark  : CASTLE_COLORS.wall;
        const wallLightColor = damaged ? CASTLE_COLORS.wall       : CASTLE_COLORS.wallLight;
        const mortarColor    = CASTLE_COLORS.wallMortar;

        // Left shadow face — solid dark stone, no mortar detail (receding plane)
        for (let y = 0; y < groundStart; y++) {
            const shade = damaged
                ? CASTLE_COLORS.wallDark
                : (y < groundStart * 0.25 ? CASTLE_COLORS.wallMortar : CASTLE_COLORS.wallDark);
            for (let x = 0; x < 15; x++) {
                setCastleOverlayPixel(buffer, W, x, y, ...shade);
            }
        }

        // Right lit face — bright highlight strip
        for (let y = 0; y < groundStart; y++) {
            for (let x = 49; x < W; x++) {
                setCastleOverlayPixel(buffer, W, x, y,
                    ...(damaged ? CASTLE_COLORS.wallMortar : CASTLE_COLORS.wallLight));
            }
        }

        // Front main face — full brickwork
        drawWallFace(buffer, W, H, 15, 49, 0, wallColor, wallLightColor, mortarColor, damaged, 100);

        // Window slits — two narrow arrow-loops in the middle third of the wall
        if (!damaged) {
            const slitY = Math.floor(groundStart * 0.45);
            for (const slitX of [23, 38]) {
                for (let dy = 0; dy < 6; dy++) {
                    setCastleOverlayPixel(buffer, W, slitX, slitY + dy, ...CASTLE_COLORS.iron);
                }
                // Widen slightly at center for cross-slit look
                setCastleOverlayPixel(buffer, W, slitX - 1, slitY + 2, ...CASTLE_COLORS.iron);
                setCastleOverlayPixel(buffer, W, slitX + 1, slitY + 2, ...CASTLE_COLORS.iron);
            }
        } else {
            // Damaged: one crumbled slit
            const slitY = Math.floor(groundStart * 0.45);
            for (let dy = 0; dy < 4; dy++) {
                setCastleOverlayPixel(buffer, W, 30, slitY + dy, ...CASTLE_COLORS.iron);
            }
        }

        // Crenellated battlements along the top — tall merlons (8px), wide crenels
        drawBattlements(buffer, W, H, 0, W, 0, wallColor, damaged);

    // ── Tower ─────────────────────────────────────────────────────────────────
    } else if (structureType === 'tower') {
        // Round tower — 96 px of visible stone.
        // Circular cross-section tapering from base (radius 26) to top (radius 20).
        // Three shading bands: left shadow edge, right lit edge, center face with mortar.
        const towerColor      = damaged ? CASTLE_COLORS.towerDark  : CASTLE_COLORS.tower;
        const towerLightColor = damaged ? CASTLE_COLORS.tower       : CASTLE_COLORS.towerLight;
        const mortarColor     = CASTLE_COLORS.wallMortar;

        const towerCenterX = 32;
        const baseRadius   = 26; // wider at base for ground-contact visual weight
        const topRadius    = 20; // narrows toward the top

        resetSeed(55000);

        for (let y = 0; y < groundStart; y++) {
            // Linear taper: radius decreases from baseRadius at bottom to topRadius at top
            const t = y / (groundStart - 1); // 0=top, 1=bottom
            const radius = Math.round(topRadius + (baseRadius - topRadius) * t);
            const xLeft  = Math.max(0, towerCenterX - radius);
            const xRight = Math.min(W, towerCenterX + radius);

            for (let x = xLeft; x < xRight; x++) {
                const distFromLeft  = x - xLeft;
                const distFromRight = xRight - 1 - x;
                const innerWidth    = xRight - xLeft;

                if (distFromLeft < 4) {
                    // Hard shadow edge — far curved wall
                    setCastleOverlayPixel(buffer, W, x, y, ...CASTLE_COLORS.towerDark);
                } else if (distFromRight < 4) {
                    // Highlight edge — near curved wall catching upper-left light
                    setCastleOverlayPixel(buffer, W, x, y,
                        ...(damaged ? CASTLE_COLORS.towerDark : CASTLE_COLORS.towerLight));
                } else if (y % 6 === 5) {
                    // Mortar course
                    setCastleOverlayPixel(buffer, W, x, y, ...mortarColor);
                } else {
                    // Stone block with horizontal stagger per course
                    const course  = Math.floor(y / 6);
                    const stagger = (course % 2 === 0) ? 0 : 5;
                    const blockW  = 10;
                    const posInBlock = (x - xLeft + stagger) % blockW;
                    const isJoint    = (posInBlock === 0);

                    if (isJoint) {
                        setCastleOverlayPixel(buffer, W, x, y, ...mortarColor);
                    } else {
                        const variation = damaged
                            ? (seededRandom() - 0.7) * 14
                            : (seededRandom() - 0.5) * 8;
                        // Lit more on right side of face
                        const lateralBias = (x - xLeft - 4) / (innerWidth - 8);
                        const base = (!damaged && lateralBias > 0.6) ? towerLightColor : towerColor;
                        const nr = Math.max(0, Math.min(255, base[0] + variation));
                        const ng = Math.max(0, Math.min(255, base[1] + variation));
                        const nb = Math.max(0, Math.min(255, base[2] + variation));
                        setCastleOverlayPixel(buffer, W, x, y, nr, ng, nb);
                    }
                }
            }
        }

        // Arrow slit — single vertical slit mid-height
        if (!damaged) {
            const slitY = Math.floor(groundStart * 0.5);
            const slitX = towerCenterX + 2;
            for (let dy = 0; dy < 8; dy++) {
                setCastleOverlayPixel(buffer, W, slitX, slitY + dy, ...CASTLE_COLORS.iron);
            }
            setCastleOverlayPixel(buffer, W, slitX - 1, slitY + 3, ...CASTLE_COLORS.iron);
            setCastleOverlayPixel(buffer, W, slitX + 1, slitY + 3, ...CASTLE_COLORS.iron);
        }

        // Round cap battlements — merlons only over the tower body
        const battleX0 = towerCenterX - topRadius + 4;
        const battleX1 = towerCenterX + topRadius - 4;
        drawBattlements(buffer, W, H, battleX0, battleX1, 0, towerColor, damaged);

    // ── Keep quadrants ────────────────────────────────────────────────────────
    } else if (structureType === 'keep-tl' || structureType === 'keep-bl' ||
               structureType === 'keep-br' || structureType === 'keep-center') {

        const keepColor      = damaged ? CASTLE_COLORS.towerDark  : CASTLE_COLORS.tower;
        const keepLightColor = damaged ? CASTLE_COLORS.tower       : CASTLE_COLORS.towerLight;
        const mortarColor    = CASTLE_COLORS.wallMortar;

        // Each keep quadrant is a massive stone face — full width, full height.
        // Left and right edge strips provide isometric depth.
        const seedBase = structureType === 'keep-tl' ? 200 :
                         structureType === 'keep-bl' ? 300 :
                         structureType === 'keep-br' ? 400 : 500;

        // Shadow left edge
        for (let y = 0; y < groundStart; y++) {
            for (let x = 0; x < 10; x++) {
                setCastleOverlayPixel(buffer, W, x, y, ...CASTLE_COLORS.towerDark);
            }
        }
        // Lit right edge
        for (let y = 0; y < groundStart; y++) {
            for (let x = W - 10; x < W; x++) {
                setCastleOverlayPixel(buffer, W, x, y,
                    ...(damaged ? CASTLE_COLORS.towerDark : CASTLE_COLORS.towerLight));
            }
        }

        // Main face — full-height brickwork with deep mortar courses
        drawWallFace(buffer, W, H, 10, W - 10, 0, keepColor, keepLightColor, mortarColor, damaged, seedBase);

        // Window slit — narrow arrow-loop at mid height
        const slitX = structureType === 'keep-tl' ? 28 :
                      structureType === 'keep-bl' ? 34 :
                      structureType === 'keep-br' ? 28 : 32;
        const slitY = Math.floor(groundStart * 0.4);

        if (!damaged || structureType === 'keep-center') {
            for (let dy = 0; dy < 8; dy++) {
                const sy = slitY + dy;
                if (sy >= 0 && sy < groundStart) {
                    setCastleOverlayPixel(buffer, W, slitX, sy, ...CASTLE_COLORS.iron);
                }
            }
            // Cross-shape at center of slit
            if (slitY + 3 < groundStart) {
                setCastleOverlayPixel(buffer, W, slitX - 1, slitY + 3, ...CASTLE_COLORS.iron);
                setCastleOverlayPixel(buffer, W, slitX + 1, slitY + 3, ...CASTLE_COLORS.iron);
            }
        }

        // Keep center: tall flag pole + banner
        if (structureType === 'keep-center') {
            // Flag pole running nearly full height
            for (let y = 2; y < groundStart - 6; y++) {
                setCastleOverlayPixel(buffer, W, 32, y, ...CASTLE_COLORS.woodDark);
                setCastleOverlayPixel(buffer, W, 33, y, ...CASTLE_COLORS.wood);
            }
            // Banner — 8 wide × 6 tall, flies from top of pole
            resetSeed(25000);
            const flagH = damaged ? 4 : 6;
            for (let fy = 0; fy < flagH; fy++) {
                for (let fx = 0; fx < 8; fx++) {
                    const flagY = 4 + fy;
                    const flagX = 34 + fx;
                    if (flagY >= 0 && flagY < groundStart && flagX >= 0 && flagX < W) {
                        const noise = (seededRandom() - 0.5) * 6;
                        setCastleOverlayPixel(buffer, W, flagX, flagY,
                            Math.max(0, Math.min(255, CASTLE_COLORS.wallDark[0] + noise)),
                            Math.max(0, Math.min(255, CASTLE_COLORS.wallDark[1] + noise)),
                            Math.max(0, Math.min(255, CASTLE_COLORS.wallDark[2] + noise)));
                    }
                }
            }
        }

        // Battlements on top
        drawBattlements(buffer, W, H, 0, W, 0, keepColor, damaged);

    // ── Gatehouse ─────────────────────────────────────────────────────────────
    } else if (structureType === 'gatehouse') {
        const wallColor      = damaged ? CASTLE_COLORS.wallDark  : CASTLE_COLORS.wall;
        const wallLightColor = damaged ? CASTLE_COLORS.wall       : CASTLE_COLORS.wallLight;
        const mortarColor    = CASTLE_COLORS.wallMortar;

        // Gatehouse: tallest structure — 112 px above ground.
        // Left and right flanking tower strips + central arch span.

        // Left flanking tower body (x: 0..22)
        for (let y = 0; y < groundStart; y++) {
            const t = y / (groundStart - 1);
            const radius = Math.round(10 + 4 * t); // tapers slightly toward top
            for (let x = 0; x < radius * 2; x++) {
                const shade = (x < 3) ? CASTLE_COLORS.towerDark :
                              (x > radius * 2 - 4) ? (damaged ? CASTLE_COLORS.towerDark : CASTLE_COLORS.towerLight) :
                              (y % 6 === 5) ? mortarColor : CASTLE_COLORS.tower;
                setCastleOverlayPixel(buffer, W, x, y, ...shade);
            }
        }

        // Right flanking tower body (x: 42..63)
        for (let y = 0; y < groundStart; y++) {
            const t = y / (groundStart - 1);
            const radius = Math.round(10 + 4 * t);
            const towerRight = W;
            const towerLeft  = towerRight - radius * 2;
            for (let x = Math.max(42, towerLeft); x < towerRight; x++) {
                const shade = (x < towerLeft + 3) ? CASTLE_COLORS.towerDark :
                              (x > towerRight - 4) ? (damaged ? CASTLE_COLORS.towerDark : CASTLE_COLORS.towerLight) :
                              (y % 6 === 5) ? mortarColor : CASTLE_COLORS.tower;
                setCastleOverlayPixel(buffer, W, x, y, ...shade);
            }
        }

        // Central wall face between towers
        drawWallFace(buffer, W, H, 22, 42, 0, wallColor, wallLightColor, mortarColor, damaged, 600);

        // Arch opening — tall pointed arch in the lower two-thirds of the gatehouse face
        const archTop    = Math.floor(groundStart * 0.28);
        const archBottom = groundStart;
        const archLeft   = 22;
        const archRight  = 42;
        const archCenterX = (archLeft + archRight) / 2;
        const archHalfW   = (archRight - archLeft) / 2;

        // Fill arch interior with dark iron color
        for (let y = archTop; y < archBottom; y++) {
            for (let x = archLeft; x < archRight; x++) {
                setCastleOverlayPixel(buffer, W, x, y, ...CASTLE_COLORS.iron);
            }
        }

        // Rounded arch curve at the top
        for (let x = archLeft; x < archRight; x++) {
            const dx   = x - archCenterX;
            const archY = archTop - Math.round(Math.sqrt(Math.max(0, archHalfW * archHalfW - dx * dx)) * 0.5);
            for (let y = Math.max(0, archY); y < archTop; y++) {
                if (y >= 0 && y < groundStart) {
                    setCastleOverlayPixel(buffer, W, x, y, ...CASTLE_COLORS.iron);
                }
            }
        }

        // Portcullis vertical bars
        if (!damaged) {
            for (let x = archLeft + 2; x < archRight; x += 3) {
                for (let y = archTop; y < archBottom; y++) {
                    if (y >= 0 && y < groundStart) {
                        setCastleOverlayPixel(buffer, W, x, y, ...CASTLE_COLORS.iron);
                    }
                }
            }
            // Horizontal crossbars
            for (let y = archTop + 4; y < archBottom; y += 5) {
                for (let x = archLeft; x < archRight; x++) {
                    if (y >= 0 && y < groundStart) {
                        setCastleOverlayPixel(buffer, W, x, y, ...CASTLE_COLORS.ironLight);
                    }
                }
            }
        } else {
            // Damaged: broken portcullis — partial bars only
            for (let x = archLeft + 2; x < archRight; x += 3) {
                const barH = Math.floor((archBottom - archTop) * 0.35);
                for (let y = archTop; y < archTop + barH && y < groundStart; y++) {
                    setCastleOverlayPixel(buffer, W, x, y, ...CASTLE_COLORS.iron);
                }
            }
        }

        // Battlements — across the full top (both flanking towers and center span)
        drawBattlements(buffer, W, H, 0, W, 0, wallColor, damaged);

    // ── Bridge-mm (cobblestone bridge surface) ────────────────────────────────
    } else if (structureType === 'bridge-mm') {
        // Bridge-mm: cobblestone parapet walls on the sides, open center
        // The overlay shows the low stone parapets above the ground level
        const stoneColor  = CASTLE_COLORS.wall;
        const mortarColor = CASTLE_COLORS.wallMortar;

        // Left parapet (x: 0-10)
        drawWallFace(buffer, W, H, 0, 10, 0, stoneColor, CASTLE_COLORS.wallLight, mortarColor, damaged, 700);
        // Right parapet (x: 54-64)
        drawWallFace(buffer, W, H, 54, W, 0, stoneColor, CASTLE_COLORS.wallLight, mortarColor, damaged, 710);

        // Low crenels on parapets
        drawBattlements(buffer, W, H, 0, 10, 0, stoneColor, damaged);
        drawBattlements(buffer, W, H, 54, W, 0, stoneColor, damaged);

    // ── Bridge-start (road → wooden planks transition) ────────────────────────
    } else if (structureType === 'bridge-start') {
        // Left half: low stone abutment
        drawWallFace(buffer, W, H, 0, 32, 0, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight,
            CASTLE_COLORS.wallMortar, damaged, 720);
        // Right half: wooden plank edge (low railing)
        fillRect(buffer, W, H, 32, 0, W, groundStart, CASTLE_COLORS.wood);
        // Plank grain lines
        for (let y = 2; y < groundStart; y += 5) {
            for (let x = 32; x < W; x++) {
                setCastleOverlayPixel(buffer, W, x, y, ...CASTLE_COLORS.woodDark);
            }
        }

    // ── Bridge-mid (wooden plank drawbridge) ──────────────────────────────────
    } else if (structureType === 'bridge-mid') {
        // Wooden plank railing on both sides
        // Left railing (x: 0-8)
        fillRect(buffer, W, H, 0, 0, 8, groundStart, CASTLE_COLORS.wood);
        // Right railing (x: 56-64)
        fillRect(buffer, W, H, 56, 0, W, groundStart, CASTLE_COLORS.wood);

        // Plank grain lines on railings
        for (let y = 2; y < groundStart; y += 5) {
            for (let x = 0; x < 8; x++) {
                setCastleOverlayPixel(buffer, W, x, y, ...CASTLE_COLORS.woodDark);
            }
            for (let x = 56; x < W; x++) {
                setCastleOverlayPixel(buffer, W, x, y, ...CASTLE_COLORS.woodDark);
            }
        }

        if (damaged) {
            // Damaged: broken planks — some gaps
            for (let x = 8; x < 56; x += 7) {
                for (let y = 0; y < groundStart; y++) {
                    setCastleOverlayPixel(buffer, W, x, y, ...CASTLE_COLORS.woodDark);
                }
            }
        }

    // ── Bridge-gate (wooden planks → stone wall transition) ───────────────────
    } else if (structureType === 'bridge-gate') {
        // Left half: wooden plank railing
        fillRect(buffer, W, H, 0, 0, 8, groundStart, CASTLE_COLORS.wood);
        for (let y = 2; y < groundStart; y += 5) {
            for (let x = 0; x < 8; x++) {
                setCastleOverlayPixel(buffer, W, x, y, ...CASTLE_COLORS.woodDark);
            }
        }
        // Right half: stone wall abutment
        drawWallFace(buffer, W, H, 32, W, 0, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight,
            CASTLE_COLORS.wallMortar, damaged, 730);
    }

    // Final pass: quantize to castle palette
    quantizeToPalette(buffer, castlePalette);

    return buffer;
}

// ─── Isometric Wall Overlay Sprite Generator ────────────────────────────────

/**
 * Generates a 2.5D isometric stone wall overlay for all castle structure tiles.
 *
 * Canvas: 64×96 px (OVERLAY_WIDTH × WALL_OVERLAY_HEIGHT).
 * The bottom 32 rows (y = 64..95) are the ground diamond footprint — left alpha=0.
 * The top 64 rows (y = 0..63) are the wall's vertical stone face.
 *
 * ── Viewpoint: BR→TL (camera in the SE, looking NW) ────────────────────────
 *
 * Diamond vertices in this 64×96 canvas:
 *   Top    (32,  64)
 *   Left   ( 0,  80)   ← West corner
 *   Bottom (32,  95)   ← South corner (deepest point on screen)
 *   Right  (63,  80)   ← East corner
 *
 * Two bottom edges are visible:
 *
 *   LEFT face  (SW edge): x = 0..31
 *     surfaceRow(x) = floor(80 + x * 0.5) + 1
 *     x=0  → sr=81 (wall body = [wallTopY, 80])
 *     x=31 → sr=96 (= H, full wall body)
 *
 *   RIGHT face (SE edge): x = 32..63
 *     surfaceRow(x) = floor(80 + (63-x) * 0.5) + 1
 *     x=32 → sr=96 (full wall body)
 *     x=63 → sr=81
 *
 *   WALL_H   = 64   → wallTopY = 95 - 64 = 31
 *   MERLON_H = 6    → merlonTopCap = wallTopY - MERLON_H = 25
 *   PERIOD   = 9    (MERLON_W=5 + CRENEL_W=4)
 *
 * With 64px of wall height, units can visibly stand atop the battlements.
 *
 * @param {boolean} [damaged=false] - Whether to draw the damaged variant.
 * @returns {Buffer} 64×96 RGBA pixel buffer with transparent background.
 */
function generateIsoWallOverlay(damaged = false) {
    const W = 64;
    const H = 96; // matches CASTLE_OVERLAY_CANVAS_HEIGHTS.wall = 96

    const buffer = createCastleOverlayBuffer(W, H);
    const castlePalette = getPaletteForCategory('castle');

    // ── Geometry constants ────────────────────────────────────────────────
    // Diamond top vertex in this canvas: (32, H - TILE_HEIGHT*2) = (32, 64)
    // Diamond bottom vertex: (32, H - 1) = (32, 95)
    // Diamond left vertex:   (0,  H - TILE_HEIGHT/2 * 3) = (0, 80)  [approx]
    // Diamond right vertex:  (63, 80)
    //
    // Surface row formulas are anchored at the diamond bottom vertex row (95)
    // minus half-tile steps toward each edge:
    //   SW edge (left face): at column x, the diamond surface is at y = 80 + x * 0.5
    //   SE edge (right face): at column x, y = 80 + (63-x) * 0.5
    const DIAMOND_LEFT_Y  = 80; // y of left & right diamond vertices
    const DIAMOND_BOT_Y   = 95; // y of bottom diamond vertex
    const WALL_H          = 64; // px of visible wall above surface = 2 tile heights
    const MERLON_H        = 6;  // tall merlons — units can crouch behind them
    const MERLON_W        = 5;
    const CRENEL_W        = 4;
    const PERIOD          = MERLON_W + CRENEL_W; // 9
    const wallTopY        = DIAMOND_BOT_Y - WALL_H; // = 31
    const merlonTopCap    = wallTopY - MERLON_H;    // = 25

    function leftSurfaceRow(x)  { return Math.floor(DIAMOND_LEFT_Y + x * 0.5) + 1; }
    function rightSurfaceRow(x) { return Math.floor(DIAMOND_LEFT_Y + (63 - x) * 0.5) + 1; }

    // ── Colors ────────────────────────────────────────────────────────────
    const faceMain   = damaged ? CASTLE_COLORS.wallDark   : CASTLE_COLORS.wall;
    const faceLight  = damaged ? CASTLE_COLORS.wall        : CASTLE_COLORS.wallLight;
    const faceShadow = CASTLE_COLORS.wallDark;
    const mortar     = CASTLE_COLORS.wallMortar;
    const border     = CASTLE_COLORS.wallDark;

    resetSeed(damaged ? 88800 : 88000);
    const ch = (v) => Math.round(Math.max(0, Math.min(255, v)));

    // ── Draw one column of wall face ───────────────────────────────────────
    function drawColumn(x, sr, faceColor, litColor) {
        for (let y = wallTopY; y < sr && y < H; y++) {
            if (y < 0) continue;
            const rise = sr - 1 - y;
            const noise = (seededRandom() - 0.5) * 10;

            const isMortarRow = (rise % 6 === 5); // mortar every 6 rows
            const courseIdx   = Math.floor(rise / 6);
            const stagger     = (courseIdx % 2 === 0) ? 0 : Math.floor(PERIOD / 2);
            const isJoint     = ((x + stagger) % PERIOD === 0);

            let r, g, b;
            if (isMortarRow || isJoint) {
                r = mortar[0] + noise * 0.3;
                g = mortar[1] + noise * 0.3;
                b = mortar[2] + noise * 0.3;
            } else {
                // Upper half of wall slightly lighter (ambient sky light hits top)
                const topBias = rise / WALL_H;
                const c = (topBias < 0.4) ? litColor : faceColor;
                r = c[0] + noise;
                g = c[1] + noise;
                b = c[2] + noise;
            }
            setCastleOverlayPixel(buffer, W, x, y, ch(r), ch(g), ch(b));
        }

        // Parapet cap at wallTopY (unconditional dark line)
        if (wallTopY >= 0 && wallTopY < H) {
            setCastleOverlayPixel(buffer, W, x, wallTopY, ...border);
        }

        // Battlements above parapet
        const isMerlon = (x % PERIOD) < MERLON_W;
        if (isMerlon) {
            for (let m = 1; m <= MERLON_H; m++) {
                const my = wallTopY - m;
                if (my < merlonTopCap || my >= H) continue;
                const noise = (seededRandom() - 0.5) * 8;
                const c = (m <= MERLON_H / 2) ? litColor : faceColor;
                setCastleOverlayPixel(buffer, W, x, my,
                    ch(c[0] + noise), ch(c[1] + noise), ch(c[2] + noise));
            }
            if (merlonTopCap >= 0 && merlonTopCap < H) {
                setCastleOverlayPixel(buffer, W, x, merlonTopCap, ...border);
            }
        }

        // Arrow slit — one per wall face half, at mid-height of wall body
        // Only draw on selected x columns to avoid cluttering
        const slitXL = 14; // left face slit column
        const slitXR = 50; // right face slit column
        const slitY  = wallTopY + Math.floor(WALL_H * 0.38);
        if ((x === slitXL || x === slitXR) && !damaged) {
            for (let dy = 0; dy < 10; dy++) {
                const sy = slitY + dy;
                if (sy >= wallTopY && sy < H) {
                    setCastleOverlayPixel(buffer, W, x, sy, ...CASTLE_COLORS.iron);
                }
            }
            // Cross-slit arm
            if (slitY + 4 < H) {
                if (x > 0)  setCastleOverlayPixel(buffer, W, x - 1, slitY + 4, ...CASTLE_COLORS.iron);
                if (x < 63) setCastleOverlayPixel(buffer, W, x + 1, slitY + 4, ...CASTLE_COLORS.iron);
            }
        }
    }

    // ── Left face: SW edge (West→South), x = 0..31 ────────────────────────
    for (let x = 0; x <= 31; x++) {
        drawColumn(x, leftSurfaceRow(x), faceMain, faceLight);
    }

    // ── Right face: SE edge (South→East), x = 32..63 ──────────────────────
    for (let x = 32; x <= 63; x++) {
        drawColumn(x, rightSurfaceRow(x), faceShadow, faceMain);
    }

    // ── Ridge seam at x=32 ────────────────────────────────────────────────
    for (let y = wallTopY; y < H; y++) {
        if (y >= 0) setCastleOverlayPixel(buffer, W, 32, y, ...border);
    }

    quantizeToPalette(buffer, castlePalette);
    return buffer;
}

module.exports = {
    generateTreeOverlay,
    createOverlayBuffer,
    OVERLAY_WIDTH,
    OVERLAY_HEIGHT,
    createCastleOverlayBuffer,
    setCastleOverlayPixel,
    generateCastleOverlay,
    generateIsoWallOverlay,
    CASTLE_OVERLAY_SPRITES,
};