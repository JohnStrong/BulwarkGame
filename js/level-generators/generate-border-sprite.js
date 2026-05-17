/**
 * Generate a hill/tall grass border sprite that matches the style
 * of the existing medieval sprite sheet.
 *
 * Usage: node generate-border-sprite.js
 * Requires: sharp
 */

const sharp = require('sharp');
const path = require('path');

const SIZE = 32;
const OUTPUT = path.join(__dirname, '..', '..', 'assets', 'sprites', 'hill-border.png');

async function generateHillBorder() {
    // Create a 32x32 pixel buffer with tall grass / hill appearance
    // Using raw pixel data to create a natural-looking border tile

    const pixels = Buffer.alloc(SIZE * SIZE * 4); // RGBA

    // Color palette matching the existing sprites
    const darkGreen = [34, 85, 34, 255];
    const midGreen = [50, 120, 50, 255];
    const lightGreen = [72, 150, 60, 255];
    const grassTip = [90, 170, 70, 255];
    const darkBrown = [60, 40, 20, 255];
    const midBrown = [80, 55, 30, 255];

    function setPixel(x, y, color) {
        if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
        const idx = (y * SIZE + x) * 4;
        pixels[idx] = color[0];
        pixels[idx + 1] = color[1];
        pixels[idx + 2] = color[2];
        pixels[idx + 3] = color[3];
    }

    // Fill base with dark green (hill base)
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            // Gradient from brown at bottom to green at top
            if (y > 24) {
                setPixel(x, y, darkBrown);
            } else if (y > 20) {
                setPixel(x, y, midBrown);
            } else if (y > 14) {
                setPixel(x, y, darkGreen);
            } else {
                setPixel(x, y, midGreen);
            }
        }
    }

    // Add tall grass blades sticking up
    const grassBlades = [
        { x: 3, height: 10 },
        { x: 6, height: 12 },
        { x: 9, height: 8 },
        { x: 11, height: 14 },
        { x: 14, height: 11 },
        { x: 16, height: 9 },
        { x: 18, height: 13 },
        { x: 21, height: 10 },
        { x: 23, height: 12 },
        { x: 25, height: 7 },
        { x: 27, height: 11 },
        { x: 29, height: 9 },
    ];

    for (const blade of grassBlades) {
        const baseY = 16;
        for (let dy = 0; dy < blade.height; dy++) {
            const y = baseY - dy;
            const color = dy > blade.height - 3 ? grassTip : (dy > blade.height / 2 ? lightGreen : midGreen);
            setPixel(blade.x, y, color);
            // Make blades 2px wide at base, 1px at tip
            if (dy < blade.height - 2) {
                setPixel(blade.x + 1, y, color);
            }
        }
    }

    // Add some texture dots
    const textureDots = [
        [2, 18], [7, 20], [12, 17], [19, 19], [24, 18], [28, 20],
        [4, 22], [10, 23], [15, 21], [22, 22], [26, 23],
    ];
    for (const [x, y] of textureDots) {
        setPixel(x, y, lightGreen);
    }

    // Add hill contour highlights at top
    for (let x = 0; x < SIZE; x++) {
        if (x % 3 !== 0) {
            setPixel(x, 14, lightGreen);
        }
    }

    await sharp(pixels, {
        raw: { width: SIZE, height: SIZE, channels: 4 }
    })
    .png()
    .toFile(OUTPUT);

    console.log(`✓ Generated hill-border.png at ${OUTPUT}`);
}

generateHillBorder().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
