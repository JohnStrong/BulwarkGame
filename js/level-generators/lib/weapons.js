/**
 * Weapon drawing logic for unit sprites.
 *
 * Each exported function draws a specific weapon type onto the pixel buffer
 * at the given anchor point (centerX, centerY). Weapons are always drawn
 * last in the unit rendering pipeline so they appear on top of the body.
 *
 * All weapon functions share the same signature:
 *   drawWeaponName(buffer, centerX, centerY)
 * except drawShield which also needs the palette for accent coloring.
 */

const { setPixel, seededRandom } = require('./pixel-utils');

/**
 * Draws a sword: 8px vertical silver blade with gold crossguard and brown grip.
 * Positioned to the right of the figure at centerX + 4.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number} centerX - Horizontal anchor (tile center, typically 32).
 * @param {number} centerY - Vertical anchor (figure center, typically 14).
 */
function drawSword(buffer, centerX, centerY) {
    // Silver blade (2px wide, 8px tall)
    for (let row = 0; row < 8; row++) {
        setPixel(buffer, centerX + 4, centerY - 3 - row, 190, 190, 195); // lit edge
        setPixel(buffer, centerX + 5, centerY - 3 - row, 170, 170, 175); // shadow edge
    }
    // Gold crossguard (2 pixels, one on each side of blade)
    setPixel(buffer, centerX + 3, centerY - 3, 200, 170, 50);
    setPixel(buffer, centerX + 6, centerY - 3, 200, 170, 50);
    // Brown leather grip (below crossguard)
    setPixel(buffer, centerX + 4, centerY + 1, 80, 55, 30);
    setPixel(buffer, centerX + 5, centerY + 1, 80, 55, 30);
}

/**
 * Draws a spear: 14px vertical brown shaft with a silver spearhead at the top.
 * Positioned to the right of the figure at centerX + 3.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number} centerX - Horizontal anchor.
 * @param {number} centerY - Vertical anchor.
 */
function drawSpear(buffer, centerX, centerY) {
    // Brown wooden shaft (14px tall)
    for (let row = 0; row < 14; row++) {
        setPixel(buffer, centerX + 3, centerY - 8 + row, 110, 80, 40);
    }
    // Silver spearhead (2px tall + 1px side blade)
    setPixel(buffer, centerX + 3, centerY - 9, 185, 185, 190);
    setPixel(buffer, centerX + 3, centerY - 10, 185, 185, 190);
    setPixel(buffer, centerX + 2, centerY - 9, 170, 170, 175);
}

/**
 * Draws a bow: 9px curved arc with a bowstring and a nocked arrow pointing right.
 * Positioned to the left of the figure at centerX - 5.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number} centerX - Horizontal anchor.
 * @param {number} centerY - Vertical anchor.
 */
function drawBow(buffer, centerX, centerY) {
    // Curved wooden arc (sine wave gives the bow its bend)
    for (let row = 0; row < 9; row++) {
        const bowX = centerX - 5 + Math.round(Math.sin(row * 0.4) * 2);
        setPixel(buffer, bowX, centerY - 4 + row, 110, 75, 35);      // outer edge
        setPixel(buffer, bowX + 1, centerY - 4 + row, 95, 65, 30);   // inner edge
    }
    // Bowstring (straight vertical line)
    for (let row = 0; row < 9; row++) {
        setPixel(buffer, centerX - 4, centerY - 4 + row, 180, 170, 150);
    }
    // Nocked arrow (horizontal, pointing right)
    for (let col = 0; col < 6; col++) {
        setPixel(buffer, centerX + 2 + col, centerY - 1, 130, 95, 45);
    }
    // Silver arrowhead
    setPixel(buffer, centerX + 8, centerY - 1, 160, 160, 165);
}

/**
 * Draws a crossbow: horizontal bar with vertical stock and a bolt in the center.
 * Spans centerX ± 4 horizontally.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number} centerX - Horizontal anchor.
 * @param {number} centerY - Vertical anchor.
 */
function drawCrossbow(buffer, centerX, centerY) {
    // Horizontal crossbar (9px wide, 2 rows)
    for (let col = -4; col <= 4; col++) {
        setPixel(buffer, centerX + col, centerY + 1, 100, 80, 45);  // top row
        setPixel(buffer, centerX + col, centerY + 2, 90, 72, 40);   // bottom row
    }
    // Vertical stock (right side, 4px tall)
    for (let row = 0; row < 4; row++) {
        setPixel(buffer, centerX + 4, centerY + row, 80, 60, 35);
        setPixel(buffer, centerX + 5, centerY + row, 75, 55, 30);
    }
    // Bolt loaded in center
    setPixel(buffer, centerX, centerY, 140, 140, 145);
}

/**
 * Draws a javelin: 7px vertical shaft with a silver tip (2px).
 * Positioned to the right of the figure at centerX + 4.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number} centerX - Horizontal anchor.
 * @param {number} centerY - Vertical anchor.
 */
function drawJavelin(buffer, centerX, centerY) {
    // Wooden shaft (7px tall)
    for (let row = 0; row < 7; row++) {
        setPixel(buffer, centerX + 4, centerY - 4 + row, 120, 90, 48);
    }
    // Silver tip (2px above shaft)
    setPixel(buffer, centerX + 4, centerY - 5, 175, 175, 180);
    setPixel(buffer, centerX + 4, centerY - 6, 175, 175, 180);
}

/**
 * Draws a hammer: 6px brown handle with a 3×3 grey hammerhead at the top.
 * Positioned to the right of the figure at centerX + 4.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number} centerX - Horizontal anchor.
 * @param {number} centerY - Vertical anchor.
 */
function drawHammer(buffer, centerX, centerY) {
    // Brown wooden handle (6px tall)
    for (let row = 0; row < 6; row++) {
        setPixel(buffer, centerX + 4, centerY - 1 + row, 95, 70, 38);
    }
    // Grey iron hammerhead (cross shape, 3px wide)
    setPixel(buffer, centerX + 3, centerY - 2, 140, 140, 140);
    setPixel(buffer, centerX + 4, centerY - 2, 150, 150, 150);
    setPixel(buffer, centerX + 5, centerY - 2, 140, 140, 140);
    setPixel(buffer, centerX + 4, centerY - 3, 130, 130, 130);
}

/**
 * Draws a shield: 3×6px rectangle in the unit's accent color with a gold boss dot.
 * Positioned to the left of the figure at centerX - 5.
 * Uses seededRandom() for per-pixel noise on the shield face.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number} centerX - Horizontal anchor.
 * @param {number} centerY - Vertical anchor.
 * @param {object} palette - Unit palette (needs palette.accent for shield color).
 */
function drawShield(buffer, centerX, centerY, palette) {
    // Shield face (3px wide × 7px tall, accent color with noise)
    for (let row = -3; row <= 3; row++)
        for (let col = 0; col < 3; col++) {
            const noise = (seededRandom() - 0.5) * 8;
            setPixel(buffer, centerX - 5 + col, centerY + row,
                palette.accent[0] + noise, palette.accent[1] + noise, palette.accent[2] + noise);
        }
    // Gold shield boss (center dot)
    setPixel(buffer, centerX - 4, centerY, 220, 200, 80);
}

/**
 * Draws a cannon: horizontal barrel with wheels on each side.
 * Positioned below the figure, centered horizontally.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number} centerX - Horizontal anchor.
 * @param {number} centerY - Vertical anchor.
 */
function drawCannon(buffer, centerX, centerY) {
    // Iron barrel (9px wide, 2 rows for the main tube)
    for (let col = -4; col <= 4; col++) {
        setPixel(buffer, centerX + col, centerY + 7, 55, 52, 48);  // dark bottom
        setPixel(buffer, centerX + col, centerY + 8, 50, 48, 44);  // darker underside
    }
    // Barrel top (slightly lighter, narrower)
    for (let col = -3; col <= 3; col++) {
        setPixel(buffer, centerX + col, centerY + 6, 65, 62, 55);
    }
    // Wooden wheels (one on each side)
    setPixel(buffer, centerX - 4, centerY + 9, 80, 55, 30);
    setPixel(buffer, centerX + 4, centerY + 9, 80, 55, 30);
}

/**
 * Draws a club: 6px brown stick that widens slightly at the top.
 * Positioned to the right of the figure at centerX + 3.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number} centerX - Horizontal anchor.
 * @param {number} centerY - Vertical anchor.
 */
function drawClub(buffer, centerX, centerY) {
    // Wooden shaft (6px tall)
    for (let row = 0; row < 6; row++) {
        setPixel(buffer, centerX + 3, centerY - 2 + row, 85, 60, 30);
    }
    // Wider head (2px at top)
    setPixel(buffer, centerX + 3, centerY - 3, 100, 75, 40);
    setPixel(buffer, centerX + 4, centerY - 3, 100, 75, 40);
}

/**
 * Draws the appropriate weapon onto the buffer based on the weapon type string.
 * This is the main entry point — call this from the unit body renderer.
 *
 * @param {Buffer} buffer - The pixel buffer to draw into.
 * @param {number} centerX - Horizontal anchor (tile center, typically 32).
 * @param {number} centerY - Vertical anchor (figure center, typically 14).
 * @param {string} weaponType - One of: sword, spear, bow, crossbow, javelin, hammer, shield, cannon, club.
 * @param {object} palette - Unit palette (only needed by shield for accent color).
 */
function drawWeapon(buffer, centerX, centerY, weaponType, palette) {
    switch (weaponType) {
        case 'sword':    drawSword(buffer, centerX, centerY); break;
        case 'spear':    drawSpear(buffer, centerX, centerY); break;
        case 'bow':      drawBow(buffer, centerX, centerY); break;
        case 'crossbow': drawCrossbow(buffer, centerX, centerY); break;
        case 'javelin':  drawJavelin(buffer, centerX, centerY); break;
        case 'hammer':   drawHammer(buffer, centerX, centerY); break;
        case 'shield':   drawShield(buffer, centerX, centerY, palette); break;
        case 'cannon':   drawCannon(buffer, centerX, centerY); break;
        case 'club':     drawClub(buffer, centerX, centerY); break;
    }
}

module.exports = {
    drawWeapon,
    drawSword,
    drawSpear,
    drawBow,
    drawCrossbow,
    drawJavelin,
    drawHammer,
    drawShield,
    drawCannon,
    drawClub,
};
