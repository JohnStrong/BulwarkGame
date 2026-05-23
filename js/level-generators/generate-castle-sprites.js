/**
 * Castle structure sprites — flat isometric diamonds (64×32), BR→TL viewpoint.
 * Matches the terrain sprite format from generate-iso-sprites-br-tl.js.
 *
 * Enhanced with:
 *   - Stone block patterns (3+ horizontal courses, 1-pixel mortar lines, 2+ px color variation)
 *   - Crenellation detail on tower tops (3+ alternating merlon/crenel shapes)
 *   - Keep details: window slits (1×3 dark rectangles), flag element (3×5 pixels), layered stone texture
 *   - 1-pixel dark outline (BORDER_COLOR) on all outer-perimeter pixels bordering transparent pixels
 *   - Palette quantization as final pass (CASTLE_COLORS + max 4 accent colors)
 *
 * Sprites produced:
 *   - castle-bridge-start/mid/gate   (wooden drawbridge planks)
 *   - castle-tower                   (round stone tower with crenellations)
 *   - castle-keep-tl/bl/br/center    (keep quadrant tiles with stone blocks + details)
 *   - castle-gatehouse               (stone arch with iron portcullis grate)
 *   - castle-wall                    (full stone curtain wall with courses)
 *   - castle-bailey-1/2/3            (dirt+hay floor, 3 density variants)
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
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

const { fillDiamond } = require('./lib/fill-patterns');
const { applyFaceShading, applyShadowEdge } = require('./lib/shading');
const { quantizeToPalette } = require('./lib/palette-quantizer');
const { getPaletteForCategory } = require('./lib/palette');

// Castle palette for quantization (PRIMARY_PALETTE + CASTLE_ACCENT_COLORS)
const CASTLE_PALETTE = getPaletteForCategory('castle');

// ─── Enhanced Stone Block Pattern ───────────────────────────────────────────

/**
 * Draws an enhanced stone masonry pattern with:
 *   - At least 3 horizontal courses of blocks
 *   - 1-pixel mortar lines between courses
 *   - At least 2 pixels of color variation per block face
 *
 * Requirement 2.1: 3+ horizontal courses, 1-pixel mortar lines, 2+ px color variation.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number[]} stoneColor - Primary stone block color [r, g, b].
 * @param {number[]} stoneLightColor - Lighter stone variant for variation.
 * @param {number[]} mortarColor - Color for the 1-pixel mortar lines.
 * @param {number} seedValue - Seed for reproducible randomness.
 */
function drawEnhancedStoneBlocks(buffer, stoneColor, stoneLightColor, mortarColor, seedValue) {
    // Fill entire diamond with mortar (the gaps between stones)
    fillDiamond(buffer, mortarColor, 4, seedValue);

    resetSeed(seedValue + 100);

    // Course height = 5 pixels (4 stone + 1 mortar line).
    // With TILE_HEIGHT=32, we get ~6 courses (well above the 3 minimum).
    const courseHeight = 5;
    const mortarThickness = 1;
    const blockMinWidth = 6;
    const blockMaxWidth = 10;

    for (let courseIndex = 0; courseIndex < Math.floor(TILE_HEIGHT / courseHeight); courseIndex++) {
        const courseY = courseIndex * courseHeight;
        // Offset alternating rows by half a block width for staggered masonry
        const rowOffset = (courseIndex % 2 === 0) ? 0 : 4;

        let blockX = rowOffset;
        while (blockX < TILE_WIDTH) {
            const blockWidth = blockMinWidth + Math.floor(seededRandom() * (blockMaxWidth - blockMinWidth + 1));

            // Choose base color for this block (variation between light and standard)
            const useLight = seededRandom() > 0.5;
            const baseBlockColor = useLight ? stoneLightColor : stoneColor;

            // Draw block interior (skip mortar row at bottom of each course)
            for (let py = 0; py < courseHeight - mortarThickness; py++) {
                for (let px = 0; px < blockWidth - 1; px++) { // -1 for vertical mortar gap
                    const x = blockX + px;
                    const y = courseY + py;

                    if (x >= 0 && x < TILE_WIDTH && y >= 0 && y < TILE_HEIGHT && isInsideDiamond(x, y)) {
                        // Per-pixel color variation (2+ pixels differ within each block)
                        const variation = (seededRandom() - 0.5) * 12;
                        setPixel(buffer, x, y,
                            baseBlockColor[0] + variation,
                            baseBlockColor[1] + variation,
                            baseBlockColor[2] + variation);
                    }
                }
            }

            blockX += blockWidth;
        }
    }
}

// ─── Castle Bridge Sprites ──────────────────────────────────────────────────

/**
 * Generates the bridge start tile — half road (left), half wooden planks (right).
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
                    setPixel(buffer, x, y,
                        TERRAIN_COLORS.road[0] + noise,
                        TERRAIN_COLORS.road[1] + noise * 0.8,
                        TERRAIN_COLORS.road[2] + noise * 0.6);
                } else {
                    const isPlankGap = y % 5 === 0;
                    const plankColor = isPlankGap ? CASTLE_COLORS.woodDark : CASTLE_COLORS.wood;
                    setPixel(buffer, x, y, ...plankColor);
                }
            }
        }
    }

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates the bridge middle tile — full wooden planks with grain variation.
 * @returns {Buffer} The completed pixel buffer.
 */
function generateBridgeMid() {
    const buffer = createBuffer();
    resetSeed(10100);

    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            if (isInsideDiamond(x, y)) {
                seededRandom();
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

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.woodLight, CASTLE_COLORS.woodDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates the bridge gate tile — wooden planks (left) meeting stone wall (right).
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
                    const isPlankGap = y % 5 === 0;
                    const plankColor = isPlankGap ? CASTLE_COLORS.woodDark : CASTLE_COLORS.wood;
                    setPixel(buffer, x, y, ...plankColor);
                } else {
                    setPixel(buffer, x, y,
                        CASTLE_COLORS.wall[0] + noise,
                        CASTLE_COLORS.wall[1] + noise,
                        CASTLE_COLORS.wall[2] + noise);
                }
            }
        }
    }

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

// ─── Tower ──────────────────────────────────────────────────────────────────

/**
 * Generates a round stone tower viewed from above (circular on the diamond).
 * Enhanced with crenellation detail: 3+ alternating merlon/crenel shapes.
 *
 * Requirement 2.2: At least 3 alternating merlon (raised, min 3×3 px) and
 * crenel (gap, min 2 px wide) shapes on the top edge.
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

    // Crenellation: 4 alternating merlon/crenel shapes around the perimeter
    // Merlons are 3×3 pixel raised blocks, crenels are 2-pixel gaps
    // Requirement 2.2: at least 3 alternating merlon/crenel shapes
    const merlonCount = 4;
    for (let i = 0; i < merlonCount; i++) {
        // Distribute merlons evenly around the circle
        const angle = (i / merlonCount) * Math.PI * 2;
        const merlonCenterX = centerX + Math.round((towerRadius - 1) * Math.cos(angle));
        const merlonCenterY = centerY + Math.round((towerRadius - 1) * Math.sin(angle) * 0.5);

        // Draw 3×3 merlon block (raised battlement)
        for (let my = -1; my <= 1; my++) {
            for (let mx = -1; mx <= 1; mx++) {
                const px = merlonCenterX + mx;
                const py = merlonCenterY + my;
                if (isInsideDiamond(px, py)) {
                    setPixel(buffer, px, py, ...CASTLE_COLORS.towerDark);
                }
            }
        }

        // Draw crenel gap (2px wide) between merlons — lighter color to suggest open space
        const crenelAngle = ((i + 0.5) / merlonCount) * Math.PI * 2;
        const crenelX = centerX + Math.round((towerRadius - 1) * Math.cos(crenelAngle));
        const crenelY = centerY + Math.round((towerRadius - 1) * Math.sin(crenelAngle) * 0.5);
        if (isInsideDiamond(crenelX, crenelY)) {
            setPixel(buffer, crenelX, crenelY, ...CASTLE_COLORS.towerLight);
        }
        if (isInsideDiamond(crenelX + 1, crenelY)) {
            setPixel(buffer, crenelX + 1, crenelY, ...CASTLE_COLORS.towerLight);
        }
    }

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

// ─── Keep Tiles ─────────────────────────────────────────────────────────────

/**
 * Generates the top-left quadrant of the castle keep.
 * Enhanced with layered stone texture (highlight on top face, shadow on side face)
 * and a window slit (1×3 dark rectangle).
 *
 * Requirement 2.3: window slit (1×3 dark rectangle), layered stone texture.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateKeepTopLeft() {
    const buffer = createBuffer();
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.tower, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallMortar, 12000);

    // Window slit: 1×3 dark rectangle (Requirement 2.3)
    const slitX = 30;
    const slitY = 12;
    for (let dy = 0; dy < 3; dy++) {
        if (isInsideDiamond(slitX, slitY + dy)) {
            setPixel(buffer, slitX, slitY + dy, 25, 25, 22);
        }
    }

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates the bottom-left quadrant of the castle keep.
 * Enhanced with layered stone texture and a window slit.
 * @returns {Buffer} The completed pixel buffer.
 */
function generateKeepBottomLeft() {
    const buffer = createBuffer();
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.tower, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallMortar, 12200);

    // Window slit: 1×3 dark rectangle
    const slitX = 34;
    const slitY = 14;
    for (let dy = 0; dy < 3; dy++) {
        if (isInsideDiamond(slitX, slitY + dy)) {
            setPixel(buffer, slitX, slitY + dy, 25, 25, 22);
        }
    }

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates the bottom-right quadrant of the castle keep.
 * Enhanced with layered stone texture and a window slit.
 * @returns {Buffer} The completed pixel buffer.
 */
function generateKeepBottomRight() {
    const buffer = createBuffer();
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.tower, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallMortar, 12300);

    // Window slit: 1×3 dark rectangle
    const slitX = 28;
    const slitY = 13;
    for (let dy = 0; dy < 3; dy++) {
        if (isInsideDiamond(slitX, slitY + dy)) {
            setPixel(buffer, slitX, slitY + dy, 25, 25, 22);
        }
    }

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates the center of the castle keep — stone base with a flag pole
 * and a waving flag (3×5 pixels minimum).
 *
 * Requirement 2.3: flag element of at least 3×5 pixels on the center tile,
 * layered stone texture using distinct highlight/shadow colors.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateKeepCenter() {
    const buffer = createBuffer();

    // Stone block base (lighter than outer keep tiles) with enhanced pattern
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.towerLight, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, 12400);

    // Flag pole (brown vertical line)
    for (let y = 4; y <= 18; y++) {
        if (isInsideDiamond(32, y)) {
            setPixel(buffer, 32, y, 55, 35, 18);   // dark side
        }
        if (isInsideDiamond(33, y)) {
            setPixel(buffer, 33, y, 65, 42, 22);   // lit side
        }
    }

    // Waving flag — at least 3×5 pixels (Requirement 2.3: 3×5 minimum)
    // Actual size: 7 wide × 5 tall (exceeds minimum)
    resetSeed(12500);
    const flagWidth = 7;
    const flagHeight = 5;
    const flagStartX = 34;
    const flagStartY = 5;

    for (let flagRow = 0; flagRow < flagHeight; flagRow++) {
        const windWave = Math.round(Math.sin(flagRow * 0.9) * 1);

        for (let flagCol = 0; flagCol < flagWidth; flagCol++) {
            const noise = (seededRandom() - 0.5) * 6;
            const flagX = flagStartX + flagCol + windWave;
            const flagY = flagStartY + flagRow;

            if (isInsideDiamond(flagX, flagY)) {
                // Red flag body
                setPixel(buffer, flagX, flagY, 200 + noise, 30, 25);
            }
        }
    }

    // Gold trim on top and bottom edges of flag
    for (let trimCol = 0; trimCol < flagWidth; trimCol++) {
        const topX = flagStartX + trimCol;
        const botX = flagStartX + trimCol;
        if (isInsideDiamond(topX, flagStartY)) {
            setPixel(buffer, topX, flagStartY, 200, 170, 50);
        }
        if (isInsideDiamond(botX, flagStartY + flagHeight - 1)) {
            setPixel(buffer, botX, flagStartY + flagHeight - 1, 200, 170, 50);
        }
    }

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.towerLight, CASTLE_COLORS.towerDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

// ─── Gatehouse ──────────────────────────────────────────────────────────────

/**
 * Generates the castle gatehouse — stone walls with a dark archway
 * and an iron portcullis grate pattern. Enhanced with stone block courses.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateGatehouse() {
    const buffer = createBuffer();

    // Enhanced stone wall base with proper courses
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, 13000);

    // Dark archway opening (center rectangle)
    resetSeed(13100);
    for (let y = 8; y <= 24; y++) {
        for (let x = 22; x <= 42; x++) {
            if (isInsideDiamond(x, y)) {
                setPixel(buffer, x, y, 25, 22, 20);
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

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

// ─── Wall ───────────────────────────────────────────────────────────────────

/**
 * Generates a full stone curtain wall tile with enhanced stone block pattern.
 * Requirement 2.1: 3+ horizontal courses, 1-pixel mortar lines, 2+ px color variation.
 *
 * @returns {Buffer} The completed pixel buffer.
 */
function generateWall() {
    const buffer = createBuffer();
    drawEnhancedStoneBlocks(buffer, CASTLE_COLORS.wall, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallMortar, 14000);
    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

// ─── Bailey (Courtyard Floor) ───────────────────────────────────────────────

/**
 * Generates bailey variant 1 — mostly dirt with scattered straw strands.
 * @returns {Buffer} The completed pixel buffer.
 */
function generateBailey1() {
    const buffer = createBuffer();

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

    // Scatter straw strands
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

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates bailey variant 2 — mixed dirt and straw (medium density).
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
                    setPixel(buffer, x, y,
                        195 + noise,
                        150 + noise * 0.8,
                        95 + noise * 0.6);
                }
            }
        }
    }

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
    return buffer;
}

/**
 * Generates bailey variant 3 — dense straw coverage (heaviest density).
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

    applyFaceShading(buffer, TILE_WIDTH, TILE_HEIGHT, CASTLE_COLORS.wallLight, CASTLE_COLORS.wallDark);
    applyShadowEdge(buffer, TILE_WIDTH, TILE_HEIGHT);
    drawEdgeBorder(buffer);
    quantizeToPalette(buffer, CASTLE_PALETTE);
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
