/**
 * Unit body/figure drawing logic.
 *
 * Draws the humanoid figure layer by layer from bottom to top:
 *   1. Drop shadow
 *   2. Legs + boots
 *   3. Torso (body)
 *   4. Cape / cloak
 *   5. Shoulders / pauldrons
 *   6. Head
 *   7. Helmet / hat
 *   8. Weapon (delegated to weapons.js)
 *
 * The figure is approximately 10px wide × 16px tall, centered on the
 * 64×32 tile. It is drawn on a fully transparent background so it can
 * overlay terrain tiles without a visible bounding box.
 */

const { TILE_WIDTH, setPixel, seededRandom, resetSeed } = require('./pixel-utils');
const { drawWeapon } = require('./weapons');

/**
 * Draws a complete unit figure onto the pixel buffer.
 *
 * The figure is anchored at centerX=32, centerY=14 (slightly above the
 * tile's geometric center so the unit appears to stand on the diamond).
 * All body parts are positioned relative to these anchors.
 *
 * @param {Buffer} buffer - The pixel buffer (64×32×4 RGBA, starts transparent).
 * @param {object} palette - Color palette with { body, cape, accent, skin } arrays.
 * @param {string} weaponType - Which weapon to draw (e.g. 'sword', 'bow').
 * @param {number} seedValue - Seed for the PRNG to ensure reproducible output.
 */
function drawUnit(buffer, palette, weaponType, seedValue) {
    resetSeed(seedValue);

    const centerX = 32;
    const centerY = 14;

    // ─── 1. Drop shadow ─────────────────────────────────────────────────
    // A semi-transparent dark ellipse beneath the figure's feet.
    // Makes the unit look grounded on the terrain tile.
    for (let offsetX = -5; offsetX <= 5; offsetX++)
        for (let offsetY = -1; offsetY <= 2; offsetY++)
            if ((offsetX * offsetX) / 25 + (offsetY * offsetY) / 4 < 1) {
                const pixelIndex = ((centerY + 9 + offsetY) * TILE_WIDTH + (centerX + offsetX + 1)) * 4;
                if (pixelIndex >= 0 && pixelIndex < buffer.length - 3) {
                    buffer[pixelIndex] = 20;
                    buffer[pixelIndex + 1] = 20;
                    buffer[pixelIndex + 2] = 15;
                    buffer[pixelIndex + 3] = 100; // semi-transparent
                }
            }

    // ─── 2. Legs ────────────────────────────────────────────────────────
    // Two 2-pixel-wide columns, 5px tall, in darkened body color.
    // A 1px gap between them (at centerX) gives the impression of two limbs.
    for (let row = 0; row < 5; row++) {
        const noise = (seededRandom() - 0.5) * 12;
        // Left leg (2 columns)
        setPixel(buffer, centerX - 2, centerY + 5 + row, palette.body[0] - 20 + noise, palette.body[1] - 20 + noise, palette.body[2] - 20 + noise);
        setPixel(buffer, centerX - 1, centerY + 5 + row, palette.body[0] - 15 + noise, palette.body[1] - 15 + noise, palette.body[2] - 15 + noise);
        // Right leg (2 columns)
        setPixel(buffer, centerX + 1, centerY + 5 + row, palette.body[0] - 20 + noise, palette.body[1] - 20 + noise, palette.body[2] - 20 + noise);
        setPixel(buffer, centerX + 2, centerY + 5 + row, palette.body[0] - 15 + noise, palette.body[1] - 15 + noise, palette.body[2] - 15 + noise);
    }
    // Dark brown boots at the bottom of each leg
    setPixel(buffer, centerX - 2, centerY + 9, 50, 35, 20);
    setPixel(buffer, centerX - 1, centerY + 9, 55, 38, 22);
    setPixel(buffer, centerX + 1, centerY + 9, 50, 35, 20);
    setPixel(buffer, centerX + 2, centerY + 9, 55, 38, 22);

    // ─── 3. Torso / body ────────────────────────────────────────────────
    // 6px wide × 6px tall rectangle with directional shading.
    // Left side is darker (shadow from bottom-right light source).
    for (let row = 0; row < 6; row++)
        for (let col = -3; col <= 2; col++) {
            const noise = (seededRandom() - 0.5) * 15;
            const lightingShift = col < 0 ? -10 : 5; // left = shadow, right = lit
            setPixel(buffer, centerX + col, centerY - 1 + row,
                palette.body[0] + noise + lightingShift,
                palette.body[1] + noise + lightingShift,
                palette.body[2] + noise + lightingShift);
        }

    // ─── 4. Cape / cloak ────────────────────────────────────────────────
    // 2px wide strip on the back-left with a sine-wave wobble for a flowing look.
    for (let row = 0; row < 6; row++) {
        const noise = (seededRandom() - 0.5) * 10;
        const windWobble = Math.round(Math.sin(row * 0.8) * 0.5);
        setPixel(buffer, centerX - 4 + windWobble, centerY + row,
            palette.cape[0] + noise, palette.cape[1] + noise, palette.cape[2] + noise);
        setPixel(buffer, centerX - 3 + windWobble, centerY + 1 + row,
            palette.cape[0] + noise - 5, palette.cape[1] + noise - 5, palette.cape[2] + noise - 5);
    }

    // ─── 5. Shoulders / pauldrons ───────────────────────────────────────
    // 4 accent-colored pixels at the outer top corners of the torso.
    setPixel(buffer, centerX - 3, centerY - 1, ...palette.accent);
    setPixel(buffer, centerX + 2, centerY - 1, ...palette.accent);
    setPixel(buffer, centerX - 3, centerY, ...palette.accent);
    setPixel(buffer, centerX + 2, centerY, ...palette.accent);

    // ─── 6. Head ────────────────────────────────────────────────────────
    // 4×4 pixel block with vertical shading (top lighter, bottom darker).
    for (let row = -2; row <= 1; row++)
        for (let col = -1; col <= 2; col++) {
            const noise = (seededRandom() - 0.5) * 8;
            const verticalShading = (row < 0) ? 5 : -5; // top = lit, bottom = chin shadow
            setPixel(buffer, centerX + col, centerY - 4 + row,
                palette.skin[0] + noise + verticalShading,
                palette.skin[1] + noise + verticalShading,
                palette.skin[2] + noise + verticalShading);
        }

    // ─── 7. Helmet / hat ────────────────────────────────────────────────
    // 6 accent-colored pixels in a tapered cap shape above the head.
    // Top row: 2px wide. Bottom row: 4px wide (brim).
    setPixel(buffer, centerX, centerY - 6, ...palette.accent);
    setPixel(buffer, centerX + 1, centerY - 6, ...palette.accent);
    setPixel(buffer, centerX - 1, centerY - 5, ...palette.accent);
    setPixel(buffer, centerX, centerY - 5, ...palette.accent);
    setPixel(buffer, centerX + 1, centerY - 5, ...palette.accent);
    setPixel(buffer, centerX + 2, centerY - 5, ...palette.accent);

    // ─── 8. Weapon ──────────────────────────────────────────────────────
    // Drawn last so it appears on top of all body parts.
    drawWeapon(buffer, centerX, centerY, weaponType, palette);
}

module.exports = { drawUnit };
