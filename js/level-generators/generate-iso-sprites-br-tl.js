/**
 * Flat isometric diamond terrain sprites — Viewpoint: Bottom-Right → Top-Left.
 *
 * Generates 17 terrain sprites as 64×32 pixel flat isometric diamonds.
 * These are the base tiles used by the level loader to render the game map.
 *
 * Sprites produced:
 *   - grass-short-1, grass-short-2       (green meadow with pixel noise)
 *   - grass-flowers-1, grass-flowers-2   (meadow with colored flower clusters)
 *   - road-full                          (sandy dirt road with crack details)
 *   - water-1, water-2, water-3          (blue water with ripple streaks)
 *   - bridge-mm                          (grey cobblestone with block pattern)
 *   - tree-1 through tree-7             (trees with bark trunk visible from BR)
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

// ─── Sprite Generators ──────────────────────────────────────────────────────

/**
 * Generates a grass meadow sprite with subtle dark pixel accents.
 * Used by the level loader for basic ground tiles (characters: 'g', '.').
 *
 * @param {number} variant - Variant index (0 or 1) for different random patterns.
 * @returns {Buffer} The completed pixel buffer.
 */
function generateGrass(variant) {
    const buffer = createBuffer();

    // Fill with green grass base (includes natural speckle)
    fillDiamondWithSpeckle(buffer, TERRAIN_COLORS.grass, 12, 1000 + variant * 100);

    // Scatter a few darker grass pixels for depth
    resetSeed(1080 + variant * 100);
    for (let i = 0; i < 8; i++) {
        const x = Math.floor(seededRandom() * TILE_WIDTH);
        const y = Math.floor(seededRandom() * TILE_HEIGHT);
        if (isInsideDiamond(x, y)) {
            setPixel(buffer, x, y, ...TERRAIN_COLORS.grassDark);
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates a grass sprite with colorful flower clusters scattered on top.
 * Used by the level loader for decorative meadow tiles (character: 'f').
 *
 * @param {number} variant - Variant index (0 or 1) for different flower placement.
 * @returns {Buffer} The completed pixel buffer.
 */
function generateFlowers(variant) {
    const buffer = createBuffer();

    // Green grass base
    fillDiamondWithSpeckle(buffer, TERRAIN_COLORS.grass, 12, 2000 + variant * 100);

    // Place 4 flower clusters in random positions
    resetSeed(2080 + variant * 100);
    const flowerColors = [
        [240, 80, 120],   // pink
        [255, 200, 50],   // yellow
        [220, 220, 240],  // white
        [180, 100, 220],  // purple
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

    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates a dirt road sprite with crack details.
 * Used by the level loader for path tiles (character: 'r').
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
                setPixel(buffer, crackX, crackY, 170, 130, 80);
            }
            crackX += Math.floor(seededRandom() * 3) - 1;
            crackY += Math.floor(seededRandom() * 3) - 1;
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates a water tile with short horizontal ripple streaks.
 * Used by the level loader for water tiles (character: 'w').
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
                setPixel(buffer, rippleX + pixel, rippleY, 80, 155, 235);
            }
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates a cobblestone bridge tile with an offset block pattern.
 * Used by the level loader for bridge tiles (character: 'b').
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
                        setPixel(buffer, x, y, 155 + noise, 152 + noise, 142 + noise);
                    }
                }
            }
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates a tree sprite with grass base, ground shadow, bark trunk, and canopy.
 * The trunk is visible on the bottom-right side (BR→TL viewpoint).
 * Used by the level loader for forest tiles (characters: '1'–'7').
 *
 * @param {number} variant - Variant index (0–6) controlling canopy size and randomness.
 * @returns {Buffer} The completed pixel buffer.
 */
function generateTree(variant) {
    const buffer = createBuffer();

    // Grass base underneath the tree
    fillDiamondWithSpeckle(buffer, TERRAIN_COLORS.grass, 10, 6000 + variant * 100);

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
                const noise = (seededRandom() - 0.5) * 3;
                setPixel(buffer, shadowX, shadowY, 55 + noise, 120 + noise, 38 + noise);
            }
        }
    }

    // ── Trunk (bark texture, visible below-right of canopy) ──
    for (let offsetY = -3; offsetY <= 5; offsetY++) {
        for (let offsetX = -2; offsetX <= 2; offsetX++) {
            if (isInsideDiamond(trunkX + offsetX, trunkY + offsetY)) {
                const noise = (seededRandom() - 0.5) * 6;
                // Right side of trunk is lighter (lit by BR light source)
                const barkColor = offsetX > 0 ? [95, 62, 30] : [70, 45, 22];
                setPixel(buffer, trunkX + offsetX, trunkY + offsetY,
                    barkColor[0] + noise, barkColor[1] + noise, barkColor[2] + noise);
            }
        }
    }

    // ── Canopy (circular, drawn on top of trunk, with light/dark zones) ──
    resetSeed(6080 + variant * 100);
    for (let offsetY = -canopyRadius; offsetY <= canopyRadius; offsetY++) {
        for (let offsetX = -canopyRadius; offsetX <= canopyRadius; offsetX++) {
            const distanceFromCenter = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            const canopyX = centerX + offsetX;
            const canopyY = centerY + offsetY - 2; // raised 2px above center

            if (distanceFromCenter <= canopyRadius && isInsideDiamond(canopyX, canopyY)) {
                const noise = (seededRandom() - 0.5) * 8;

                // Choose canopy color based on distance from center:
                //   - Inner top = light green (sunlit crown)
                //   - Outer edge = dark green (shadow/depth)
                //   - Middle = standard canopy green
                let leafColor;
                if (distanceFromCenter < canopyRadius * 0.35 && offsetY < 0) {
                    leafColor = TERRAIN_COLORS.treeCanopyLight;
                } else if (distanceFromCenter > canopyRadius * 0.72) {
                    leafColor = TERRAIN_COLORS.treeCanopyDark;
                } else {
                    leafColor = TERRAIN_COLORS.treeCanopy;
                }

                setPixel(buffer, canopyX, canopyY,
                    leafColor[0] + noise, leafColor[1] + noise, leafColor[2] + noise);
            }
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates a rock sprite — a grey stone sitting on a grass base.
 * Used by the level loader for obstacle tiles (character: 'k').
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateRock() {
    const buffer = createBuffer();

    // Grass base
    fillDiamondWithSpeckle(buffer, TERRAIN_COLORS.grass, 10, 7000);

    // Draw a roughly circular grey stone in the center
    const centerX = 32;
    const centerY = 16;
    resetSeed(7080);

    for (let offsetY = -4; offsetY <= 4; offsetY++) {
        for (let offsetX = -5; offsetX <= 5; offsetX++) {
            // Use distance check for roughly circular shape (radius² ≈ 20)
            const isInsideRock = (offsetX * offsetX + offsetY * offsetY) <= 20;

            if (isInsideRock && isInsideDiamond(centerX + offsetX, centerY + offsetY)) {
                const noise = (seededRandom() - 0.5) * 8;
                setPixel(buffer, centerX + offsetX, centerY + offsetY,
                    130 + noise, 128 + noise, 122 + noise);
            }
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function generateAll() {
    const sprites = [
        { name: TERRAIN_SPRITES.grassShort1, buffer: generateGrass(0) },
        { name: TERRAIN_SPRITES.grassShort2, buffer: generateGrass(1) },
        { name: TERRAIN_SPRITES.grassFlowers1, buffer: generateFlowers(0) },
        { name: TERRAIN_SPRITES.grassFlowers2, buffer: generateFlowers(1) },
        { name: TERRAIN_SPRITES.road, buffer: generateRoad() },
        { name: TERRAIN_SPRITES.water1, buffer: generateWater(0) },
        { name: TERRAIN_SPRITES.water2, buffer: generateWater(1) },
        { name: TERRAIN_SPRITES.water3, buffer: generateWater(2) },
        { name: TERRAIN_SPRITES.bridge, buffer: generateBridge() },
        { name: TERRAIN_SPRITES.tree1, buffer: generateTree(0) },
        { name: TERRAIN_SPRITES.tree2, buffer: generateTree(1) },
        { name: TERRAIN_SPRITES.tree3, buffer: generateTree(2) },
        { name: TERRAIN_SPRITES.tree4, buffer: generateTree(3) },
        { name: TERRAIN_SPRITES.tree5, buffer: generateTree(4) },
        { name: TERRAIN_SPRITES.tree6, buffer: generateTree(5) },
        { name: TERRAIN_SPRITES.tree7, buffer: generateTree(6) },
        { name: TERRAIN_SPRITES.rock, buffer: generateRock() },
    ];

    for (const sprite of sprites) {
        await sharp(sprite.buffer, { raw: { width: TILE_WIDTH, height: TILE_HEIGHT, channels: 4 } })
            .png()
            .toFile(path.join(OUTPUT_DIR, `${sprite.name}.png`));
        console.log(`  ✓ ${sprite.name}.png`);
    }

    console.log(`\nDone! ${sprites.length} flat diamond sprites (64×32, BR→TL).`);
}

generateAll().catch(error => { console.error(error); process.exit(1); });
