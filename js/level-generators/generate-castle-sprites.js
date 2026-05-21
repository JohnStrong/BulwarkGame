/**
 * Castle structure sprites — flat isometric diamonds (64×32), BR→TL viewpoint.
 * Matches the terrain sprite format from generate-iso-sprites-br-tl.js.
 *
 * Sprites produced:
 *   - castle-bridge-start/mid/gate   (wooden drawbridge planks)
 *   - castle-tower                   (round stone tower, top-down circle)
 *   - castle-keep-tl/bl/br/center    (keep quadrant tiles with stone blocks)
 *   - castle-gatehouse               (stone arch with iron portcullis grate)
 *   - castle-wall                    (full stone curtain wall)
 *   - castle-bailey-1/2/3            (dirt+hay floor, 3 density variants)
 *
 * Usage:
 *   node js/level-generators/generate-castle-sprites.js
 */

const sharp = require('sharp');
const path = require('path');

const {
    TILE_WIDTH,
    TILE_HEIGHT,
    OUTPUT_DIR,
    TERRAIN_COLORS,
    CASTLE_COLORS,
    CASTLE_SPRITES,
} = require('./lib/sprite-constants');

const {
    createBuffer,
    setPixel,
    isInsideDiamond,
    seededRandom,
    resetSeed,
    drawEdgeBorder,
} = require('./lib/pixel-utils');

const { fillDiamond, drawStoneBlocks } = require('./lib/fill-patterns');

// ─── Castle Bridge Sprites ──────────────────────────────────────────────────

/**
 * Generates the bridge start tile — half road (left), half wooden planks (right).
 * Used where the bridge meets the road on the approach side.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateBridgeStart() {
    const buffer = createBuffer();
    resetSeed(10000);

    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noise = (seededRandom() - 0.5) * 10;

                if (x < 32) {
                    // Left half: road/dirt approach
                    setPixel(buffer, x, y,
                        TERRAIN_COLORS.road[0] + noise,
                        TERRAIN_COLORS.road[1] + noise * 0.8,
                        TERRAIN_COLORS.road[2] + noise * 0.6);
                } else {
                    // Right half: wooden planks with horizontal grain lines
                    const isPlankGap = y % 5 === 0;
                    const plankColor = isPlankGap ? CASTLE_COLORS.woodDark : CASTLE_COLORS.wood;
                    setPixel(buffer, x, y, ...plankColor);
                }
            }
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates the bridge middle tile — full wooden planks with grain variation.
 * The main span of the drawbridge.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateBridgeMid() {
    const buffer = createBuffer();
    resetSeed(10100);

    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                seededRandom(); // consume for consistency
                const isPlankGap = y % 5 === 0;
                let plankColor;

                if (isPlankGap) {
                    plankColor = CASTLE_COLORS.woodDark;
                } else {
                    plankColor = seededRandom() > 0.7 ? CASTLE_COLORS.woodLight : CASTLE_COLORS.wood;
                }

                setPixel(buffer, x, y, ...plankColor);
            }
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates the bridge gate tile — wooden planks (left) meeting stone wall (right).
 * Where the bridge meets the castle gatehouse.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateBridgeGate() {
    const buffer = createBuffer();
    resetSeed(10200);

    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noise = (seededRandom() - 0.5) * 8;

                if (x < 32) {
                    // Left half: wooden planks
                    const isPlankGap = y % 5 === 0;
                    const plankColor = isPlankGap ? CASTLE_COLORS.woodDark : CASTLE_COLORS.wood;
                    setPixel(buffer, x, y, ...plankColor);
                } else {
                    // Right half: stone wall
                    setPixel(buffer, x, y,
                        CASTLE_COLORS.wall[0] + noise,
                        CASTLE_COLORS.wall[1] + noise,
                        CASTLE_COLORS.wall[2] + noise);
                }
            }
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

// ─── Tower ──────────────────────────────────────────────────────────────────

/**
 * Generates a round stone tower viewed from above (circular on the diamond).
 * Has concentric rings: light center, medium middle, dark outer edge.
 * Crenellation dots around the perimeter suggest battlements.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateTower() {
    const buffer = createBuffer();

    // Stone base fill for the full diamond
    fillDiamond(buffer, CASTLE_COLORS.tower, 8, 11000);

    const centerX = 32;
    const centerY = 16;
    const towerRadius = 12;

    // Draw circular tower with concentric color zones
    resetSeed(11100);
    for (let offsetY = -towerRadius; offsetY <= towerRadius; offsetY++) {
        for (let offsetX = -towerRadius; offsetX <= towerRadius; offsetX++) {
            const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

            if (distance <= towerRadius && isInsideDiamond(centerX + offsetX, centerY + offsetY)) {
                const noise = (seededRandom() - 0.5) * 8;

                // Color zones: dark edge → medium → light center
                let stoneColor;
                if (distance > towerRadius - 2) {
                    stoneColor = CASTLE_COLORS.towerDark;
                } else if (distance > towerRadius - 4) {
                    stoneColor = CASTLE_COLORS.tower;
                } else {
                    stoneColor = CASTLE_COLORS.towerLight;
                }

                setPixel(buffer, centerX + offsetX, centerY + offsetY,
                    stoneColor[0] + noise, stoneColor[1] + noise, stoneColor[2] + noise);
            }
        }
    }

    // Crenellation dots around the perimeter (suggest battlements from above)
    for (let dotIndex = 0; dotIndex < 10; dotIndex++) {
        const angle = (dotIndex / 10) * Math.PI * 2;
        const dotX = centerX + Math.round((towerRadius - 1) * Math.cos(angle));
        const dotY = centerY + Math.round((towerRadius - 1) * Math.sin(angle) * 0.5);
        setPixel(buffer, dotX, dotY, ...CASTLE_COLORS.towerDark);
    }

    drawEdgeBorder(buffer);
    return buffer;
}

// ─── Keep Tiles ─────────────────────────────────────────────────────────────

/**
 * Generates the top-left quadrant of the castle keep (stone blocks).
 * @returns {Buffer} The completed pixel buffer.
 */
function generateKeepTopLeft() {
    const buffer = createBuffer();
    drawStoneBlocks(buffer, CASTLE_COLORS.tower, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallMortar, 12000);
    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates the bottom-left quadrant of the castle keep (stone blocks).
 * @returns {Buffer} The completed pixel buffer.
 */
function generateKeepBottomLeft() {
    const buffer = createBuffer();
    drawStoneBlocks(buffer, CASTLE_COLORS.tower, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallMortar, 12200);
    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates the bottom-right quadrant of the castle keep (stone blocks).
 * @returns {Buffer} The completed pixel buffer.
 */
function generateKeepBottomRight() {
    const buffer = createBuffer();
    drawStoneBlocks(buffer, CASTLE_COLORS.tower, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallMortar, 12300);
    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates the center of the castle keep — stone base with a flag pole
 * and a waving red flag with gold trim.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateKeepCenter() {
    const buffer = createBuffer();

    // Stone block base (lighter than outer keep tiles)
    drawStoneBlocks(buffer, CASTLE_COLORS.towerLight, [200, 190, 165], CASTLE_COLORS.wallMortar, 12400);

    // Flag pole (brown vertical line)
    for (let y = 4; y <= 18; y++) {
        setPixel(buffer, 32, y, 55, 35, 18);   // dark side
        setPixel(buffer, 33, y, 65, 42, 22);   // lit side
    }

    // Waving red flag (sine-wave horizontal offset per row)
    resetSeed(12500);
    for (let flagRow = 0; flagRow < 7; flagRow++) {
        const windWave = Math.round(Math.sin(flagRow * 0.8) * 1.5);

        for (let flagCol = 0; flagCol < 9; flagCol++) {
            const noise = (seededRandom() - 0.5) * 6;
            const flagX = 34 + flagCol + windWave;
            const flagY = 4 + flagRow;

            if (isInsideDiamond(flagX, flagY)) {
                setPixel(buffer, flagX, flagY, 200 + noise, 30, 25);
            }
        }
    }

    // Gold trim on top and bottom edges of flag
    for (let trimCol = 0; trimCol < 9; trimCol++) {
        if (isInsideDiamond(34 + trimCol, 4)) {
            setPixel(buffer, 34 + trimCol, 4, 230, 190, 50);
        }
        if (isInsideDiamond(34 + trimCol, 10)) {
            setPixel(buffer, 34 + trimCol, 10, 230, 190, 50);
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

// ─── Gatehouse ──────────────────────────────────────────────────────────────

/**
 * Generates the castle gatehouse — stone walls with a dark archway
 * and an iron portcullis grate pattern.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateGatehouse() {
    const buffer = createBuffer();

    // Stone wall base
    drawStoneBlocks(buffer, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, 13000);

    // Dark archway opening (center rectangle)
    resetSeed(13100);
    for (let y = 8; y <= 24; y++) {
        for (let x = 22; x <= 42; x++) {
            if (isInsideDiamond(x, y)) {
                setPixel(buffer, x, y, 25, 22, 20); // near-black void
            }
        }
    }

    // Vertical iron bars of the portcullis
    for (let x = 23; x <= 41; x += 3) {
        for (let y = 9; y <= 23; y++) {
            if (isInsideDiamond(x, y)) {
                setPixel(buffer, x, y, ...CASTLE_COLORS.iron);
            }
        }
    }

    // Horizontal iron crossbars
    for (let y = 10; y <= 22; y += 3) {
        for (let x = 22; x <= 42; x++) {
            if (isInsideDiamond(x, y)) {
                setPixel(buffer, x, y, ...CASTLE_COLORS.ironLight);
            }
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

// ─── Wall ───────────────────────────────────────────────────────────────────

/**
 * Generates a full stone curtain wall tile.
 * Uses the standard stone block pattern.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateWall() {
    const buffer = createBuffer();
    drawStoneBlocks(buffer, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, 14000);
    drawEdgeBorder(buffer);
    return buffer;
}

// ─── Bailey (Courtyard Floor) ───────────────────────────────────────────────

/**
 * Generates bailey variant 1 — mostly dirt with scattered straw strands.
 * Lightest straw density of the three variants.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateBailey1() {
    const buffer = createBuffer();

    // Dirt floor base
    resetSeed(16000);
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noise = (seededRandom() - 0.5) * 12;
                setPixel(buffer, x, y,
                    200 + noise,
                    155 + noise * 0.8,
                    100 + noise * 0.6);
            }
        }
    }

    // Scatter straw strands (short angled lines)
    resetSeed(16050);
    for (let strandIndex = 0; strandIndex < 15; strandIndex++) {
        const startX = Math.floor(seededRandom() * TILE_WIDTH);
        const startY = Math.floor(seededRandom() * TILE_HEIGHT);
        const strandLength = 3 + Math.floor(seededRandom() * 4);
        const strandAngle = seededRandom() * Math.PI;

        for (let step = 0; step < strandLength; step++) {
            const pixelX = startX + Math.round(Math.cos(strandAngle) * step);
            const pixelY = startY + Math.round(Math.sin(strandAngle) * step);

            if (isInsideDiamond(pixelX, pixelY)) {
                setPixel(buffer, pixelX, pixelY, ...CASTLE_COLORS.straw);
            }
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates bailey variant 2 — mixed dirt and straw (medium density).
 * About 70% straw coverage, 30% visible dirt.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateBailey2() {
    const buffer = createBuffer();

    resetSeed(16100);
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noise = (seededRandom() - 0.5) * 10;
                const isStraw = seededRandom() > 0.3;

                if (isStraw) {
                    setPixel(buffer, x, y,
                        CASTLE_COLORS.straw[0] + noise,
                        CASTLE_COLORS.straw[1] + noise,
                        CASTLE_COLORS.straw[2] + noise);
                } else {
                    // Visible dirt patches
                    setPixel(buffer, x, y,
                        195 + noise,
                        150 + noise * 0.8,
                        95 + noise * 0.6);
                }
            }
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

/**
 * Generates bailey variant 3 — dense straw coverage (heaviest density).
 * About 80% bright straw, 20% darker straw. Almost no visible dirt.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateBailey3() {
    const buffer = createBuffer();

    resetSeed(16300);
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                const noise = (seededRandom() - 0.5) * 10;
                const strawColor = seededRandom() > 0.2 ? CASTLE_COLORS.straw : CASTLE_COLORS.strawDark;
                setPixel(buffer, x, y,
                    strawColor[0] + noise,
                    strawColor[1] + noise,
                    strawColor[2] + noise);
            }
        }
    }

    drawEdgeBorder(buffer);
    return buffer;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function generateAll() {
    const sprites = [
        { name: CASTLE_SPRITES.bridgeStart, buffer: generateBridgeStart() },
        { name: CASTLE_SPRITES.bridgeMid, buffer: generateBridgeMid() },
        { name: CASTLE_SPRITES.bridgeGate, buffer: generateBridgeGate() },
        { name: CASTLE_SPRITES.tower, buffer: generateTower() },
        { name: CASTLE_SPRITES.keepTopLeft, buffer: generateKeepTopLeft() },
        { name: CASTLE_SPRITES.keepBotLeft, buffer: generateKeepBottomLeft() },
        { name: CASTLE_SPRITES.keepBotRight, buffer: generateKeepBottomRight() },
        { name: CASTLE_SPRITES.keepCenter, buffer: generateKeepCenter() },
        { name: CASTLE_SPRITES.gatehouse, buffer: generateGatehouse() },
        { name: CASTLE_SPRITES.wall, buffer: generateWall() },
        { name: CASTLE_SPRITES.bailey1, buffer: generateBailey1() },
        { name: CASTLE_SPRITES.bailey2, buffer: generateBailey2() },
        { name: CASTLE_SPRITES.bailey3, buffer: generateBailey3() },
    ];

    for (const sprite of sprites) {
        await sharp(sprite.buffer, { raw: { width: TILE_WIDTH, height: TILE_HEIGHT, channels: 4 } })
            .png()
            .toFile(path.join(OUTPUT_DIR, `${sprite.name}.png`));
        console.log(`  ✓ ${sprite.name}.png`);
    }

    console.log(`\nDone! ${sprites.length} castle iso sprites (64×32, BR→TL).`);
}

generateAll().catch(error => { console.error(error); process.exit(1); });
