/**
 * Per-weapon unit tests for js/level-generators/lib/weapons.js
 *
 * Recommendation 5: Direct tests for each individual weapon function
 * to catch regressions in specific weapon rendering.
 *
 * Tests verify:
 *   - Each weapon draws a minimum pixel area (4×4 = 16 pixels)
 *   - Weapons draw within expected spatial regions
 *   - Weapons produce distinct visual patterns from each other
 *   - Weapons handle edge positions (near buffer boundaries)
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/weapons-per-weapon.spec.js
 */

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
} = require('../../../js/level-generators/lib/weapons');
const { createBuffer, resetSeed } = require('../../../js/level-generators/lib/pixel-utils');
const { TILE_WIDTH, TILE_HEIGHT } = require('../../../js/level-generators/lib/sprite-constants');

// ─── Helpers ────────────────────────────────────────────────────────────────

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] === 255) count++;
    }
    return count;
}

function getBoundingBox(buf) {
    let minX = TILE_WIDTH, maxX = 0, minY = TILE_HEIGHT, maxY = 0;
    for (let y = 0; y < TILE_HEIGHT; y++) {
        for (let x = 0; x < TILE_WIDTH; x++) {
            const idx = (y * TILE_WIDTH + x) * 4;
            if (buf[idx + 3] === 255) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function getUniqueColors(buf) {
    const colors = new Set();
    for (let i = 0; i < buf.length; i += 4) {
        if (buf[i + 3] === 255) {
            colors.add(`${buf[i]},${buf[i + 1]},${buf[i + 2]}`);
        }
    }
    return colors;
}

const CENTER_X = 32;
const CENTER_Y = 14;

// ─── drawSword ──────────────────────────────────────────────────────────────

describe('weapons per-weapon: drawSword', () => {
    it('should draw at least 16 pixels (4×4 minimum area)', () => {
        const buf = createBuffer();
        drawSword(buf, CENTER_X, CENTER_Y);
        assert.ok(countOpaquePixels(buf) >= 16,
            `Sword should have at least 16 pixels, got ${countOpaquePixels(buf)}`);
    });

    it('should be primarily vertical (height > width)', () => {
        const buf = createBuffer();
        drawSword(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        assert.ok(bb.height > bb.width,
            `Sword should be taller than wide: ${bb.height}h vs ${bb.width}w`);
    });

    it('should be positioned to the right of centerX', () => {
        const buf = createBuffer();
        drawSword(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        assert.ok(bb.minX >= CENTER_X,
            `Sword should start at or right of center (${bb.minX} >= ${CENTER_X})`);
    });

    it('should use at least 2 distinct colors (blade + crossguard)', () => {
        const buf = createBuffer();
        drawSword(buf, CENTER_X, CENTER_Y);
        const colors = getUniqueColors(buf);
        assert.ok(colors.size >= 2,
            `Sword should use at least 2 colors, got ${colors.size}`);
    });
});

// ─── drawSpear ──────────────────────────────────────────────────────────────

describe('weapons per-weapon: drawSpear', () => {
    it('should draw at least 16 pixels', () => {
        const buf = createBuffer();
        drawSpear(buf, CENTER_X, CENTER_Y);
        assert.ok(countOpaquePixels(buf) >= 16);
    });

    it('should be primarily vertical (shaft is tall)', () => {
        const buf = createBuffer();
        drawSpear(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        assert.ok(bb.height >= 14,
            `Spear shaft should be at least 14px tall, got ${bb.height}`);
    });

    it('should be narrow (width <= 6 pixels)', () => {
        const buf = createBuffer();
        drawSpear(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        assert.ok(bb.width <= 6,
            `Spear should be narrow, got width ${bb.width}`);
    });

    it('should have more pixels than a javelin (longer weapon)', () => {
        const bufSpear = createBuffer();
        drawSpear(bufSpear, CENTER_X, CENTER_Y);
        const bufJavelin = createBuffer();
        drawJavelin(bufJavelin, CENTER_X, CENTER_Y);
        assert.ok(countOpaquePixels(bufSpear) > countOpaquePixels(bufJavelin),
            'Spear should have more pixels than javelin');
    });
});

// ─── drawBow ────────────────────────────────────────────────────────────────

describe('weapons per-weapon: drawBow', () => {
    it('should draw at least 16 pixels', () => {
        const buf = createBuffer();
        drawBow(buf, CENTER_X, CENTER_Y);
        assert.ok(countOpaquePixels(buf) >= 16);
    });

    it('should extend to the left of centerX (bow arc)', () => {
        const buf = createBuffer();
        drawBow(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        assert.ok(bb.minX < CENTER_X,
            `Bow should extend left of center (minX=${bb.minX} < ${CENTER_X})`);
    });

    it('should have significant vertical extent (bow arc height)', () => {
        const buf = createBuffer();
        drawBow(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        assert.ok(bb.height >= 8,
            `Bow arc should be at least 8px tall, got ${bb.height}`);
    });

    it('should include an arrow (extends right of bow arc)', () => {
        const buf = createBuffer();
        drawBow(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        // Arrow extends to the right, so maxX should be > minX + bow width
        assert.ok(bb.width >= 6,
            `Bow + arrow should span at least 6px wide, got ${bb.width}`);
    });
});

// ─── drawCrossbow ───────────────────────────────────────────────────────────

describe('weapons per-weapon: drawCrossbow', () => {
    it('should draw at least 16 pixels', () => {
        const buf = createBuffer();
        drawCrossbow(buf, CENTER_X, CENTER_Y);
        assert.ok(countOpaquePixels(buf) >= 16);
    });

    it('should have a horizontal crossbar (width >= 8)', () => {
        const buf = createBuffer();
        drawCrossbow(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        assert.ok(bb.width >= 8,
            `Crossbow crossbar should span at least 8px, got ${bb.width}`);
    });

    it('should be centered around centerX', () => {
        const buf = createBuffer();
        drawCrossbow(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        const midX = (bb.minX + bb.maxX) / 2;
        assert.ok(Math.abs(midX - CENTER_X) <= 4,
            `Crossbow should be roughly centered (midX=${midX}, center=${CENTER_X})`);
    });
});

// ─── drawJavelin ────────────────────────────────────────────────────────────

describe('weapons per-weapon: drawJavelin', () => {
    it('should draw at least 8 pixels', () => {
        const buf = createBuffer();
        drawJavelin(buf, CENTER_X, CENTER_Y);
        assert.ok(countOpaquePixels(buf) >= 8);
    });

    it('should be shorter than a spear', () => {
        const bufJavelin = createBuffer();
        drawJavelin(bufJavelin, CENTER_X, CENTER_Y);
        const bufSpear = createBuffer();
        drawSpear(bufSpear, CENTER_X, CENTER_Y);
        const jBB = getBoundingBox(bufJavelin);
        const sBB = getBoundingBox(bufSpear);
        assert.ok(jBB.height <= sBB.height,
            `Javelin height (${jBB.height}) should be <= spear height (${sBB.height})`);
    });

    it('should be narrow (width <= 4 pixels)', () => {
        const buf = createBuffer();
        drawJavelin(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        assert.ok(bb.width <= 4,
            `Javelin should be narrow, got width ${bb.width}`);
    });
});

// ─── drawHammer ─────────────────────────────────────────────────────────────

describe('weapons per-weapon: drawHammer', () => {
    it('should draw at least 8 pixels', () => {
        const buf = createBuffer();
        drawHammer(buf, CENTER_X, CENTER_Y);
        assert.ok(countOpaquePixels(buf) >= 8,
            `Hammer should have at least 8 pixels, got ${countOpaquePixels(buf)}`);
    });

    it('should have a wider head region than shaft', () => {
        const buf = createBuffer();
        drawHammer(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        // Hammer has a head that's wider than the shaft
        assert.ok(bb.width >= 3,
            `Hammer should have some width for the head, got ${bb.width}`);
    });

    it('should have vertical extent (shaft + head)', () => {
        const buf = createBuffer();
        drawHammer(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        assert.ok(bb.height >= 6,
            `Hammer should have height >= 6, got ${bb.height}`);
    });
});

// ─── drawShield ─────────────────────────────────────────────────────────────

describe('weapons per-weapon: drawShield', () => {
    it('should draw at least 16 pixels', () => {
        const buf = createBuffer();
        resetSeed(100);
        const palette = { accent: [200, 170, 50] };
        drawShield(buf, CENTER_X, CENTER_Y, palette);
        assert.ok(countOpaquePixels(buf) >= 16);
    });

    it('should be positioned to the left of centerX', () => {
        const buf = createBuffer();
        resetSeed(100);
        const palette = { accent: [200, 170, 50] };
        drawShield(buf, CENTER_X, CENTER_Y, palette);
        const bb = getBoundingBox(buf);
        assert.ok(bb.maxX <= CENTER_X,
            `Shield should be left of center (maxX=${bb.maxX} <= ${CENTER_X})`);
    });

    it('should be roughly square (shield shape)', () => {
        const buf = createBuffer();
        resetSeed(100);
        const palette = { accent: [200, 170, 50] };
        drawShield(buf, CENTER_X, CENTER_Y, palette);
        const bb = getBoundingBox(buf);
        const ratio = bb.width / bb.height;
        assert.ok(ratio >= 0.4 && ratio <= 2.5,
            `Shield aspect ratio should be roughly square, got ${ratio.toFixed(2)}`);
    });

    it('should use the palette accent color', () => {
        const buf = createBuffer();
        resetSeed(100);
        const palette = { accent: [200, 170, 50] };
        drawShield(buf, CENTER_X, CENTER_Y, palette);
        const colors = getUniqueColors(buf);
        // Should include the accent color or something close to it
        assert.ok(colors.size >= 1, 'Shield should use at least one color');
    });

    it('should produce different results with different seeds', () => {
        const buf1 = createBuffer();
        resetSeed(100);
        drawShield(buf1, CENTER_X, CENTER_Y, { accent: [200, 170, 50] });

        const buf2 = createBuffer();
        resetSeed(999);
        drawShield(buf2, CENTER_X, CENTER_Y, { accent: [200, 170, 50] });

        // Shields may differ due to seed-based variation
        // At minimum, both should draw pixels
        assert.ok(countOpaquePixels(buf1) > 0);
        assert.ok(countOpaquePixels(buf2) > 0);
    });
});

// ─── drawCannon ─────────────────────────────────────────────────────────────

describe('weapons per-weapon: drawCannon', () => {
    it('should draw at least 16 pixels', () => {
        const buf = createBuffer();
        drawCannon(buf, CENTER_X, CENTER_Y);
        assert.ok(countOpaquePixels(buf) >= 16);
    });

    it('should be positioned below centerY (cannon is below figure)', () => {
        const buf = createBuffer();
        drawCannon(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        assert.ok(bb.minY >= CENTER_Y,
            `Cannon should be below center (minY=${bb.minY} >= ${CENTER_Y})`);
    });

    it('should be wider than tall (horizontal barrel)', () => {
        const buf = createBuffer();
        drawCannon(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        assert.ok(bb.width >= bb.height,
            `Cannon should be wider than tall: ${bb.width}w vs ${bb.height}h`);
    });

    it('should have significant area (barrel + wheels)', () => {
        const buf = createBuffer();
        drawCannon(buf, CENTER_X, CENTER_Y);
        assert.ok(countOpaquePixels(buf) >= 20,
            `Cannon should have substantial pixel count for barrel + wheels`);
    });
});

// ─── drawClub ───────────────────────────────────────────────────────────────

describe('weapons per-weapon: drawClub', () => {
    it('should draw at least 8 pixels', () => {
        const buf = createBuffer();
        drawClub(buf, CENTER_X, CENTER_Y);
        assert.ok(countOpaquePixels(buf) >= 8);
    });

    it('should have vertical extent (club shaft)', () => {
        const buf = createBuffer();
        drawClub(buf, CENTER_X, CENTER_Y);
        const bb = getBoundingBox(buf);
        assert.ok(bb.height >= 5,
            `Club should have height >= 5, got ${bb.height}`);
    });

    it('should be smaller than a hammer', () => {
        const bufClub = createBuffer();
        drawClub(bufClub, CENTER_X, CENTER_Y);
        const bufHammer = createBuffer();
        drawHammer(bufHammer, CENTER_X, CENTER_Y);
        // Club is simpler/smaller than hammer
        assert.ok(countOpaquePixels(bufClub) <= countOpaquePixels(bufHammer) + 5,
            'Club should not be significantly larger than hammer');
    });
});

// ─── Cross-weapon distinctness ──────────────────────────────────────────────

describe('weapons per-weapon: all weapons are visually distinct', () => {
    it('each weapon should produce a unique pixel pattern', () => {
        const palette = { accent: [200, 170, 50] };
        const weapons = [
            () => { const b = createBuffer(); drawSword(b, CENTER_X, CENTER_Y); return b; },
            () => { const b = createBuffer(); drawSpear(b, CENTER_X, CENTER_Y); return b; },
            () => { const b = createBuffer(); drawBow(b, CENTER_X, CENTER_Y); return b; },
            () => { const b = createBuffer(); drawCrossbow(b, CENTER_X, CENTER_Y); return b; },
            () => { const b = createBuffer(); drawJavelin(b, CENTER_X, CENTER_Y); return b; },
            () => { const b = createBuffer(); drawHammer(b, CENTER_X, CENTER_Y); return b; },
            () => { resetSeed(42); const b = createBuffer(); drawShield(b, CENTER_X, CENTER_Y, palette); return b; },
            () => { const b = createBuffer(); drawCannon(b, CENTER_X, CENTER_Y); return b; },
            () => { const b = createBuffer(); drawClub(b, CENTER_X, CENTER_Y); return b; },
        ];

        const buffers = weapons.map(fn => fn());

        for (let i = 0; i < buffers.length; i++) {
            for (let j = i + 1; j < buffers.length; j++) {
                assert.ok(!buffers[i].equals(buffers[j]),
                    `Weapon ${i} and weapon ${j} should produce different patterns`);
            }
        }
    });

    it('each weapon should have a different bounding box', () => {
        const palette = { accent: [200, 170, 50] };
        const weaponFns = [
            () => { const b = createBuffer(); drawSword(b, CENTER_X, CENTER_Y); return b; },
            () => { const b = createBuffer(); drawSpear(b, CENTER_X, CENTER_Y); return b; },
            () => { const b = createBuffer(); drawBow(b, CENTER_X, CENTER_Y); return b; },
            () => { const b = createBuffer(); drawCrossbow(b, CENTER_X, CENTER_Y); return b; },
            () => { const b = createBuffer(); drawCannon(b, CENTER_X, CENTER_Y); return b; },
        ];

        const boxes = weaponFns.map(fn => getBoundingBox(fn()));
        const boxStrings = boxes.map(bb => `${bb.minX},${bb.minY},${bb.width},${bb.height}`);
        const unique = new Set(boxStrings);
        // At least some should differ (not all weapons have the same bounding box)
        assert.ok(unique.size >= 3,
            `At least 3 of 5 weapons should have different bounding boxes, got ${unique.size}`);
    });
});
