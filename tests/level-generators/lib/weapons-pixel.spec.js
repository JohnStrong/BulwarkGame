/**
 * Pixel-level tests for js/level-generators/lib/weapons.js (Recommendation 2).
 *
 * Verifies that each exported weapon draw function places non-transparent pixels
 * in the expected region of the buffer. Tests use a 64×32 RGBA buffer matching
 * the unit sprite tile dimensions.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/weapons-pixel.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    drawSword,
    drawSpear,
    drawBow,
    drawCrossbow,
    drawJavelin,
    drawHammer,
    drawShield,
    drawCannon,
    drawClub,
    drawWeapon,
} = require('../../../js/level-generators/lib/weapons');

const TILE_W = 64;
const TILE_H = 32;
const CENTER_X = 32;
const CENTER_Y = 14;

/**
 * Creates a zeroed RGBA buffer for a 64×32 tile.
 */
function createBuffer() {
    return Buffer.alloc(TILE_W * TILE_H * 4, 0);
}

/**
 * Returns the number of non-transparent pixels in the buffer.
 */
function countNonTransparent(buffer) {
    let count = 0;
    for (let i = 3; i < buffer.length; i += 4) {
        if (buffer[i] > 0) count++;
    }
    return count;
}

/**
 * Returns true if any pixel in the given rectangular region is non-transparent.
 */
function hasPixelsInRegion(buffer, x1, y1, x2, y2) {
    for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
            if (x < 0 || x >= TILE_W || y < 0 || y >= TILE_H) continue;
            const idx = (y * TILE_W + x) * 4;
            if (buffer[idx + 3] > 0) return true;
        }
    }
    return false;
}

/**
 * Returns the RGB values of a specific pixel.
 */
function getPixel(buffer, x, y) {
    const idx = (y * TILE_W + x) * 4;
    return { r: buffer[idx], g: buffer[idx + 1], b: buffer[idx + 2], a: buffer[idx + 3] };
}

// ─── drawSword ───────────────────────────────────────────────────────────────

describe('drawSword', () => {
    it('should place non-transparent pixels in the buffer', () => {
        const buf = createBuffer();
        drawSword(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) > 0, 'Expected non-transparent pixels after drawSword');
    });

    it('should draw blade pixels to the right of center (centerX + 4)', () => {
        const buf = createBuffer();
        drawSword(buf, CENTER_X, CENTER_Y);
        // Blade is at centerX+4 and centerX+5, rows centerY-3 down to centerY-10
        assert.ok(
            hasPixelsInRegion(buf, CENTER_X + 4, CENTER_Y - 11, CENTER_X + 5, CENTER_Y - 3),
            'Blade should have pixels at centerX+4..5, above centerY-3'
        );
    });

    it('should draw crossguard pixels at the base of the blade', () => {
        const buf = createBuffer();
        drawSword(buf, CENTER_X, CENTER_Y);
        // Crossguard at centerX+3 and centerX+6, row centerY-3
        const left = getPixel(buf, CENTER_X + 3, CENTER_Y - 3);
        const right = getPixel(buf, CENTER_X + 6, CENTER_Y - 3);
        assert.ok(left.a > 0, 'Left crossguard pixel should be set');
        assert.ok(right.a > 0, 'Right crossguard pixel should be set');
    });

    it('should draw grip pixels below the crossguard', () => {
        const buf = createBuffer();
        drawSword(buf, CENTER_X, CENTER_Y);
        const grip = getPixel(buf, CENTER_X + 4, CENTER_Y + 1);
        assert.ok(grip.a > 0, 'Grip pixel should be set');
    });

    it('should produce at least 4×4 = 16 non-transparent pixels (minimum weapon area)', () => {
        const buf = createBuffer();
        drawSword(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) >= 16, 'Sword should cover at least 16 pixels');
    });
});

// ─── drawSpear ───────────────────────────────────────────────────────────────

describe('drawSpear', () => {
    it('should place non-transparent pixels in the buffer', () => {
        const buf = createBuffer();
        drawSpear(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) > 0);
    });

    it('should draw a vertical shaft at centerX+3', () => {
        const buf = createBuffer();
        drawSpear(buf, CENTER_X, CENTER_Y);
        // Shaft: centerX+3, rows centerY-8 to centerY+5 (14px)
        assert.ok(
            hasPixelsInRegion(buf, CENTER_X + 3, CENTER_Y - 8, CENTER_X + 3, CENTER_Y + 5),
            'Shaft should span vertically at centerX+3'
        );
    });

    it('should draw a spearhead above the shaft', () => {
        const buf = createBuffer();
        drawSpear(buf, CENTER_X, CENTER_Y);
        // Spearhead at centerY-9 and centerY-10
        const tip = getPixel(buf, CENTER_X + 3, CENTER_Y - 10);
        assert.ok(tip.a > 0, 'Spearhead tip should be set');
    });

    it('should produce at least 16 non-transparent pixels', () => {
        const buf = createBuffer();
        drawSpear(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) >= 16);
    });
});

// ─── drawBow ─────────────────────────────────────────────────────────────────

describe('drawBow', () => {
    it('should place non-transparent pixels in the buffer', () => {
        const buf = createBuffer();
        drawBow(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) > 0);
    });

    it('should draw bow arc pixels to the left of center', () => {
        const buf = createBuffer();
        drawBow(buf, CENTER_X, CENTER_Y);
        // Arc is around centerX-5 to centerX-3, rows centerY-4 to centerY+4
        assert.ok(
            hasPixelsInRegion(buf, CENTER_X - 7, CENTER_Y - 4, CENTER_X - 2, CENTER_Y + 4),
            'Bow arc should have pixels to the left of center'
        );
    });

    it('should draw a nocked arrow pointing right', () => {
        const buf = createBuffer();
        drawBow(buf, CENTER_X, CENTER_Y);
        // Arrow shaft: centerX+2 to centerX+7, row centerY-1
        assert.ok(
            hasPixelsInRegion(buf, CENTER_X + 2, CENTER_Y - 1, CENTER_X + 7, CENTER_Y - 1),
            'Arrow shaft should extend to the right'
        );
    });

    it('should produce at least 16 non-transparent pixels', () => {
        const buf = createBuffer();
        drawBow(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) >= 16);
    });
});

// ─── drawCrossbow ─────────────────────────────────────────────────────────────

describe('drawCrossbow', () => {
    it('should place non-transparent pixels in the buffer', () => {
        const buf = createBuffer();
        drawCrossbow(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) > 0);
    });

    it('should draw a horizontal crossbar spanning centerX±4', () => {
        const buf = createBuffer();
        drawCrossbow(buf, CENTER_X, CENTER_Y);
        // Crossbar: centerX-4 to centerX+4, rows centerY+1 and centerY+2
        assert.ok(
            hasPixelsInRegion(buf, CENTER_X - 4, CENTER_Y + 1, CENTER_X + 4, CENTER_Y + 2),
            'Crossbar should span horizontally'
        );
    });

    it('should draw a bolt in the center', () => {
        const buf = createBuffer();
        drawCrossbow(buf, CENTER_X, CENTER_Y);
        const bolt = getPixel(buf, CENTER_X, CENTER_Y);
        assert.ok(bolt.a > 0, 'Bolt pixel at center should be set');
    });

    it('should produce at least 16 non-transparent pixels', () => {
        const buf = createBuffer();
        drawCrossbow(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) >= 16);
    });
});

// ─── drawJavelin ─────────────────────────────────────────────────────────────

describe('drawJavelin', () => {
    it('should place non-transparent pixels in the buffer', () => {
        const buf = createBuffer();
        drawJavelin(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) > 0);
    });

    it('should draw a vertical shaft at centerX+4', () => {
        const buf = createBuffer();
        drawJavelin(buf, CENTER_X, CENTER_Y);
        // Shaft: centerX+4, rows centerY-4 to centerY+2 (7px)
        assert.ok(
            hasPixelsInRegion(buf, CENTER_X + 4, CENTER_Y - 4, CENTER_X + 4, CENTER_Y + 2),
            'Javelin shaft should be at centerX+4'
        );
    });

    it('should draw a silver tip above the shaft', () => {
        const buf = createBuffer();
        drawJavelin(buf, CENTER_X, CENTER_Y);
        const tip = getPixel(buf, CENTER_X + 4, CENTER_Y - 6);
        assert.ok(tip.a > 0, 'Javelin tip should be set');
    });

    it('should produce at least 9 non-transparent pixels (7 shaft + 2 tip)', () => {
        const buf = createBuffer();
        drawJavelin(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) >= 9);
    });
});

// ─── drawHammer ──────────────────────────────────────────────────────────────

describe('drawHammer', () => {
    it('should place non-transparent pixels in the buffer', () => {
        const buf = createBuffer();
        drawHammer(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) > 0);
    });

    it('should draw a handle at centerX+4', () => {
        const buf = createBuffer();
        drawHammer(buf, CENTER_X, CENTER_Y);
        // Handle: centerX+4, rows centerY-1 to centerY+4 (6px)
        assert.ok(
            hasPixelsInRegion(buf, CENTER_X + 4, CENTER_Y - 1, CENTER_X + 4, CENTER_Y + 4),
            'Hammer handle should be at centerX+4'
        );
    });

    it('should draw a hammerhead above the handle', () => {
        const buf = createBuffer();
        drawHammer(buf, CENTER_X, CENTER_Y);
        // Hammerhead: centerX+3 to centerX+5, rows centerY-2 to centerY-3
        assert.ok(
            hasPixelsInRegion(buf, CENTER_X + 3, CENTER_Y - 3, CENTER_X + 5, CENTER_Y - 2),
            'Hammerhead should be above the handle'
        );
    });

    it('should produce at least 10 non-transparent pixels (6 handle + 4 head)', () => {
        const buf = createBuffer();
        drawHammer(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) >= 10);
    });
});

// ─── drawShield ──────────────────────────────────────────────────────────────

describe('drawShield', () => {
    const palette = { accent: [180, 30, 30] }; // red shield

    it('should place non-transparent pixels in the buffer', () => {
        const buf = createBuffer();
        drawShield(buf, CENTER_X, CENTER_Y, palette);
        assert.ok(countNonTransparent(buf) > 0);
    });

    it('should draw shield face pixels to the left of center', () => {
        const buf = createBuffer();
        drawShield(buf, CENTER_X, CENTER_Y, palette);
        // Shield face: centerX-5 to centerX-3, rows centerY-3 to centerY+3
        assert.ok(
            hasPixelsInRegion(buf, CENTER_X - 5, CENTER_Y - 3, CENTER_X - 3, CENTER_Y + 3),
            'Shield face should be to the left of center'
        );
    });

    it('should draw a gold boss dot at the center of the shield', () => {
        const buf = createBuffer();
        drawShield(buf, CENTER_X, CENTER_Y, palette);
        const boss = getPixel(buf, CENTER_X - 4, CENTER_Y);
        assert.ok(boss.a > 0, 'Shield boss should be set');
        // Boss is gold: R≈220, G≈200, B≈80
        assert.ok(boss.r > 150, 'Boss should have high red channel (gold)');
        assert.ok(boss.g > 150, 'Boss should have high green channel (gold)');
        assert.ok(boss.b < 120, 'Boss should have low blue channel (gold)');
    });

    it('should produce at least 16 non-transparent pixels (3×7 face + boss)', () => {
        const buf = createBuffer();
        drawShield(buf, CENTER_X, CENTER_Y, palette);
        assert.ok(countNonTransparent(buf) >= 16);
    });

    it('should use the palette accent color for the shield face', () => {
        const buf = createBuffer();
        const redPalette = { accent: [200, 20, 20] };
        drawShield(buf, CENTER_X, CENTER_Y, redPalette);
        // The shield face pixels should be close to the accent color (with noise ±4)
        const facePixel = getPixel(buf, CENTER_X - 5, CENTER_Y);
        assert.ok(facePixel.a > 0, 'Shield face pixel should be set');
        // Red channel should be close to 200 (±8 for noise)
        assert.ok(facePixel.r > 180 && facePixel.r < 220,
            `Shield face R channel ${facePixel.r} should be near 200`);
    });
});

// ─── drawCannon ──────────────────────────────────────────────────────────────

describe('drawCannon', () => {
    it('should place non-transparent pixels in the buffer', () => {
        const buf = createBuffer();
        drawCannon(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) > 0);
    });

    it('should draw a horizontal barrel below center', () => {
        const buf = createBuffer();
        drawCannon(buf, CENTER_X, CENTER_Y);
        // Barrel: centerX-4 to centerX+4, rows centerY+6 to centerY+8
        assert.ok(
            hasPixelsInRegion(buf, CENTER_X - 4, CENTER_Y + 6, CENTER_X + 4, CENTER_Y + 8),
            'Cannon barrel should be below center'
        );
    });

    it('should draw wheels on each side', () => {
        const buf = createBuffer();
        drawCannon(buf, CENTER_X, CENTER_Y);
        const leftWheel = getPixel(buf, CENTER_X - 4, CENTER_Y + 9);
        const rightWheel = getPixel(buf, CENTER_X + 4, CENTER_Y + 9);
        assert.ok(leftWheel.a > 0, 'Left wheel should be set');
        assert.ok(rightWheel.a > 0, 'Right wheel should be set');
    });

    it('should produce at least 16 non-transparent pixels', () => {
        const buf = createBuffer();
        drawCannon(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) >= 16);
    });
});

// ─── drawClub ────────────────────────────────────────────────────────────────

describe('drawClub', () => {
    it('should place non-transparent pixels in the buffer', () => {
        const buf = createBuffer();
        drawClub(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) > 0);
    });

    it('should draw a shaft at centerX+3', () => {
        const buf = createBuffer();
        drawClub(buf, CENTER_X, CENTER_Y);
        // Shaft: centerX+3, rows centerY-2 to centerY+3 (6px)
        assert.ok(
            hasPixelsInRegion(buf, CENTER_X + 3, CENTER_Y - 2, CENTER_X + 3, CENTER_Y + 3),
            'Club shaft should be at centerX+3'
        );
    });

    it('should draw a wider head at the top', () => {
        const buf = createBuffer();
        drawClub(buf, CENTER_X, CENTER_Y);
        // Head: centerX+3 to centerX+4, row centerY-3
        assert.ok(
            hasPixelsInRegion(buf, CENTER_X + 3, CENTER_Y - 3, CENTER_X + 4, CENTER_Y - 3),
            'Club head should be wider than shaft'
        );
    });

    it('should produce at least 8 non-transparent pixels (6 shaft + 2 head)', () => {
        const buf = createBuffer();
        drawClub(buf, CENTER_X, CENTER_Y);
        assert.ok(countNonTransparent(buf) >= 8);
    });
});

// ─── drawWeapon dispatcher ────────────────────────────────────────────────────

describe('drawWeapon dispatcher', () => {
    const palette = { accent: [100, 100, 200] };

    const weaponTypes = [
        'sword', 'spear', 'bow', 'crossbow', 'javelin',
        'hammer', 'shield', 'cannon', 'club',
    ];

    for (const type of weaponTypes) {
        it(`should draw pixels for weapon type "${type}"`, () => {
            const buf = createBuffer();
            drawWeapon(buf, CENTER_X, CENTER_Y, type, palette);
            assert.ok(
                countNonTransparent(buf) > 0,
                `drawWeapon("${type}") should produce non-transparent pixels`
            );
        });
    }

    it('should not throw for unknown weapon type', () => {
        const buf = createBuffer();
        assert.doesNotThrow(() => {
            drawWeapon(buf, CENTER_X, CENTER_Y, 'unknown-weapon', palette);
        });
    });

    it('should produce no pixels for unknown weapon type', () => {
        const buf = createBuffer();
        drawWeapon(buf, CENTER_X, CENTER_Y, 'unknown-weapon', palette);
        assert.equal(countNonTransparent(buf), 0, 'Unknown weapon type should draw nothing');
    });
});
