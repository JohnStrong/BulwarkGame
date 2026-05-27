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
    TREE_OVERLAY_SPRITES,
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

    console.log(`\nDone! ${sprites.length} enhanced flat diamond sprites (64×32, BR→TL) + ${overlaySprites.length} tree overlay sprites (64×48).`);
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

module.exports = {
    generateTreeOverlay,
    createOverlayBuffer,
    OVERLAY_WIDTH,
    OVERLAY_HEIGHT,
    createCastleOverlayBuffer,
    setCastleOverlayPixel,
};
