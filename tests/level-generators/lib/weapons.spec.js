/**
 * Tests for js/level-generators/lib/weapons.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/weapons.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('../../../js/level-generators/lib/weapons');
const { createBuffer, resetSeed } = require('../../../js/level-generators/lib/pixel-utils');
const { TILE_WIDTH, TILE_HEIGHT } = require('../../../js/level-generators/lib/sprite-constants');

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] === 255) count++;
    }
    return count;
}

describe('weapons: drawSword', () => {
    it('should draw pixels onto the buffer', () => {
        const buf = createBuffer();
        drawSword(buf, 32, 14);
        assert.ok(countOpaquePixels(buf) > 10, 'Sword should draw multiple pixels');
    });

    it('should draw to the right of centerX (at centerX + 4/5)', () => {
        const buf = createBuffer();
        drawSword(buf, 32, 14);

        // Check pixels at x=36 (centerX + 4)
        let foundAtExpectedX = false;
        for (let y = 0; y < TILE_HEIGHT; y++) {
            const idx = (y * TILE_WIDTH + 36) * 4;
            if (buf[idx + 3] === 255) {
                foundAtExpectedX = true;
                break;
            }
        }
        assert.ok(foundAtExpectedX, 'Sword blade should be at centerX + 4');
    });
});

describe('weapons: drawSpear', () => {
    it('should draw pixels onto the buffer', () => {
        const buf = createBuffer();
        drawSpear(buf, 32, 14);
        assert.ok(countOpaquePixels(buf) > 10, 'Spear should draw multiple pixels');
    });

    it('should span more vertical rows than a sword', () => {
        const bufSpear = createBuffer();
        drawSpear(bufSpear, 32, 14);

        // Find the vertical extent of the spear
        let minY = TILE_HEIGHT, maxY = 0;
        for (let y = 0; y < TILE_HEIGHT; y++) {
            for (let x = 0; x < TILE_WIDTH; x++) {
                const idx = (y * TILE_WIDTH + x) * 4;
                if (bufSpear[idx + 3] === 255) {
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        const spearHeight = maxY - minY + 1;
        // Spear shaft is 14px + 2px head = spans at least 16 vertical pixels
        assert.ok(spearHeight >= 14, `Spear should span at least 14 rows, got ${spearHeight}`);
    });
});

describe('weapons: drawBow', () => {
    it('should draw pixels onto the buffer', () => {
        const buf = createBuffer();
        drawBow(buf, 32, 14);
        assert.ok(countOpaquePixels(buf) > 15, 'Bow should draw many pixels (arc + string + arrow)');
    });

    it('should draw to the left of centerX (bow arc at centerX - 5)', () => {
        const buf = createBuffer();
        drawBow(buf, 32, 14);

        // Check pixels around x=27 (centerX - 5)
        let foundLeft = false;
        for (let y = 0; y < TILE_HEIGHT; y++) {
            const idx = (y * TILE_WIDTH + 27) * 4;
            if (buf[idx + 3] === 255) {
                foundLeft = true;
                break;
            }
        }
        assert.ok(foundLeft, 'Bow arc should be to the left of center');
    });
});

describe('weapons: drawCrossbow', () => {
    it('should draw pixels onto the buffer', () => {
        const buf = createBuffer();
        drawCrossbow(buf, 32, 14);
        assert.ok(countOpaquePixels(buf) > 10);
    });

    it('should span horizontally (crossbar)', () => {
        const buf = createBuffer();
        drawCrossbow(buf, 32, 14);

        // Check that pixels exist at both centerX - 4 and centerX + 4
        const leftIdx = (15 * TILE_WIDTH + 28) * 4; // centerY+1, centerX-4
        const rightIdx = (15 * TILE_WIDTH + 36) * 4; // centerY+1, centerX+4
        assert.equal(buf[leftIdx + 3], 255, 'Left end of crossbar should be drawn');
        assert.equal(buf[rightIdx + 3], 255, 'Right end of crossbar should be drawn');
    });
});

describe('weapons: drawJavelin', () => {
    it('should draw pixels onto the buffer', () => {
        const buf = createBuffer();
        drawJavelin(buf, 32, 14);
        assert.ok(countOpaquePixels(buf) > 5);
    });

    it('should be shorter than a spear', () => {
        const bufJavelin = createBuffer();
        drawJavelin(bufJavelin, 32, 14);

        const bufSpear = createBuffer();
        drawSpear(bufSpear, 32, 14);

        assert.ok(countOpaquePixels(bufJavelin) < countOpaquePixels(bufSpear));
    });
});

describe('weapons: drawHammer', () => {
    it('should draw pixels onto the buffer', () => {
        const buf = createBuffer();
        drawHammer(buf, 32, 14);
        assert.ok(countOpaquePixels(buf) > 5);
    });
});

describe('weapons: drawShield', () => {
    it('should draw pixels onto the buffer', () => {
        const buf = createBuffer();
        resetSeed(100);
        const palette = { accent: [200, 170, 50] };
        drawShield(buf, 32, 14, palette);
        assert.ok(countOpaquePixels(buf) > 10);
    });

    it('should draw to the left of centerX (at centerX - 5)', () => {
        const buf = createBuffer();
        resetSeed(100);
        const palette = { accent: [200, 170, 50] };
        drawShield(buf, 32, 14, palette);

        let foundLeft = false;
        for (let y = 0; y < TILE_HEIGHT; y++) {
            const idx = (y * TILE_WIDTH + 27) * 4; // centerX - 5
            if (buf[idx + 3] === 255) {
                foundLeft = true;
                break;
            }
        }
        assert.ok(foundLeft, 'Shield should be to the left of center');
    });
});

describe('weapons: drawCannon', () => {
    it('should draw pixels onto the buffer', () => {
        const buf = createBuffer();
        drawCannon(buf, 32, 14);
        assert.ok(countOpaquePixels(buf) > 10);
    });

    it('should draw below the figure (at centerY + 6/7/8)', () => {
        const buf = createBuffer();
        drawCannon(buf, 32, 14);

        // Check row at centerY + 7 = 21
        let foundBelow = false;
        for (let x = 0; x < TILE_WIDTH; x++) {
            const idx = (21 * TILE_WIDTH + x) * 4;
            if (buf[idx + 3] === 255) {
                foundBelow = true;
                break;
            }
        }
        assert.ok(foundBelow, 'Cannon barrel should be below the figure');
    });
});

describe('weapons: drawClub', () => {
    it('should draw pixels onto the buffer', () => {
        const buf = createBuffer();
        drawClub(buf, 32, 14);
        assert.ok(countOpaquePixels(buf) > 5);
    });
});

describe('weapons: drawWeapon dispatcher', () => {
    it('should dispatch to drawSword for "sword"', () => {
        const buf1 = createBuffer();
        drawWeapon(buf1, 32, 14, 'sword', {});

        const buf2 = createBuffer();
        drawSword(buf2, 32, 14);

        assert.ok(buf1.equals(buf2));
    });

    it('should dispatch to drawBow for "bow"', () => {
        const buf1 = createBuffer();
        drawWeapon(buf1, 32, 14, 'bow', {});

        const buf2 = createBuffer();
        drawBow(buf2, 32, 14);

        assert.ok(buf1.equals(buf2));
    });

    it('should dispatch to drawShield for "shield" (passes palette)', () => {
        const palette = { accent: [100, 100, 100] };
        resetSeed(50);
        const buf1 = createBuffer();
        drawWeapon(buf1, 32, 14, 'shield', palette);

        resetSeed(50);
        const buf2 = createBuffer();
        drawShield(buf2, 32, 14, palette);

        assert.ok(buf1.equals(buf2));
    });

    it('should handle unknown weapon type without throwing', () => {
        const buf = createBuffer();
        assert.doesNotThrow(() => {
            drawWeapon(buf, 32, 14, 'unknown', {});
        });
        // Buffer should remain empty
        assert.equal(countOpaquePixels(buf), 0);
    });

    it('should handle all valid weapon types without throwing', () => {
        const weapons = ['sword', 'spear', 'bow', 'crossbow', 'javelin', 'hammer', 'shield', 'cannon', 'club'];
        const palette = { accent: [100, 100, 100] };

        for (const weapon of weapons) {
            const buf = createBuffer();
            resetSeed(42);
            assert.doesNotThrow(() => {
                drawWeapon(buf, 32, 14, weapon, palette);
            }, `drawWeapon should handle "${weapon}"`);
            assert.ok(countOpaquePixels(buf) > 0, `"${weapon}" should draw pixels`);
        }
    });
});
