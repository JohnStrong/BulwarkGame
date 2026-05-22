/**
 * Isolated tests for generate-unit-sprites.js exported functions.
 *
 * Recommendation 3: Test getSilhouette(), drawWeaponElement(), and drawSilhouette()
 * directly rather than only through the full generateUnitSprite() pipeline.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-unit-sprites-isolated.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    getSilhouette,
    drawWeaponElement,
    drawSilhouette,
    createUnitBuffer,
    setPixel,
    fillRect,
    UNIT_SIZE,
} = require('../../js/level-generators/generate-unit-sprites');

const { UNIT_PALETTES } = require('../../js/level-generators/lib/sprite-constants');

const ALL_UNIT_TYPES = [
    'knight', 'archer', 'spearman', 'crossbowman',
    'engineer', 'heavy-infantry', 'skirmisher', 'militia', 'artillery',
];

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] > 0) count++;
    }
    return count;
}

function getOpaqueBoundingBox(buf, size) {
    let minX = size, minY = size, maxX = -1, maxY = -1;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            if (buf[idx + 3] > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    return { minX, minY, maxX, maxY };
}

// ─── getSilhouette() tests ──────────────────────────────────────────────────

describe('getSilhouette: returns valid silhouette for all unit types', () => {
    for (const unitType of ALL_UNIT_TYPES) {
        it(`${unitType} should return an object with body part rectangles`, () => {
            const silhouette = getSilhouette(unitType);
            assert.ok(typeof silhouette === 'object');
            assert.ok(Object.keys(silhouette).length >= 4,
                `${unitType} should have at least 4 body parts, got ${Object.keys(silhouette).length}`);
        });

        it(`${unitType} should have a head part`, () => {
            const silhouette = getSilhouette(unitType);
            assert.ok('head' in silhouette, `${unitType} should have a head part`);
        });

        it(`${unitType} body parts should have valid {x, y, w, h} rectangles`, () => {
            const silhouette = getSilhouette(unitType);
            for (const [partName, rect] of Object.entries(silhouette)) {
                assert.ok(typeof rect.x === 'number', `${unitType}.${partName}.x should be a number`);
                assert.ok(typeof rect.y === 'number', `${unitType}.${partName}.y should be a number`);
                assert.ok(typeof rect.w === 'number', `${unitType}.${partName}.w should be a number`);
                assert.ok(typeof rect.h === 'number', `${unitType}.${partName}.h should be a number`);
                assert.ok(rect.w > 0, `${unitType}.${partName}.w should be positive`);
                assert.ok(rect.h > 0, `${unitType}.${partName}.h should be positive`);
            }
        });

        it(`${unitType} body parts should fit within 32×32 canvas`, () => {
            const silhouette = getSilhouette(unitType);
            for (const [partName, rect] of Object.entries(silhouette)) {
                assert.ok(rect.x >= 0 && rect.x + rect.w <= UNIT_SIZE,
                    `${unitType}.${partName} x-range [${rect.x}, ${rect.x + rect.w}] exceeds canvas`);
                assert.ok(rect.y >= 0 && rect.y + rect.h <= UNIT_SIZE,
                    `${unitType}.${partName} y-range [${rect.y}, ${rect.y + rect.h}] exceeds canvas`);
            }
        });
    }

    it('default/fallback silhouette should be returned for unknown type', () => {
        const silhouette = getSilhouette('unknown-type');
        assert.ok(typeof silhouette === 'object');
        assert.ok('head' in silhouette);
        assert.ok('torso' in silhouette);
    });
});

describe('getSilhouette: unique shapes per unit type', () => {
    it('each unit type should have a different silhouette definition', () => {
        const silhouettes = ALL_UNIT_TYPES.map(t => JSON.stringify(getSilhouette(t)));
        for (let i = 0; i < silhouettes.length; i++) {
            for (let j = i + 1; j < silhouettes.length; j++) {
                assert.notEqual(silhouettes[i], silhouettes[j],
                    `${ALL_UNIT_TYPES[i]} and ${ALL_UNIT_TYPES[j]} should have different silhouettes`);
            }
        }
    });

    it('knight should have pauldrons (broad shoulders)', () => {
        const s = getSilhouette('knight');
        assert.ok('pauldrons' in s, 'Knight should have pauldrons');
        assert.ok(s.pauldrons.w >= 8, 'Pauldrons should be wide (>=8px)');
    });

    it('archer should have a quiver', () => {
        const s = getSilhouette('archer');
        assert.ok('quiver' in s, 'Archer should have a quiver');
    });

    it('heavy-infantry should have a great helm and skirt', () => {
        const s = getSilhouette('heavy-infantry');
        assert.ok('greatHelm' in s, 'Heavy infantry should have a great helm');
        assert.ok('skirt' in s, 'Heavy infantry should have an armor skirt');
    });

    it('artillery should have a device (cannon)', () => {
        const s = getSilhouette('artillery');
        assert.ok('device' in s, 'Artillery should have a device');
        assert.ok(s.device.w >= 4 && s.device.h >= 4, 'Device should be at least 4×4');
    });

    it('skirmisher should have a pouch and bandana', () => {
        const s = getSilhouette('skirmisher');
        assert.ok('pouch' in s, 'Skirmisher should have a pouch');
        assert.ok('bandana' in s, 'Skirmisher should have a bandana');
    });

    it('militia should have a cloak and boots', () => {
        const s = getSilhouette('militia');
        assert.ok('cloak' in s, 'Militia should have a cloak');
        assert.ok('boots' in s, 'Militia should have boots');
    });
});

// ─── drawWeaponElement() tests ──────────────────────────────────────────────

describe('drawWeaponElement: draws weapon pixels for each unit type', () => {
    const PALETTE_MAP = {
        'knight': UNIT_PALETTES.knight,
        'archer': UNIT_PALETTES.archer,
        'spearman': UNIT_PALETTES.spearman,
        'crossbowman': UNIT_PALETTES.crossbowman,
        'engineer': UNIT_PALETTES.engineer,
        'heavy-infantry': UNIT_PALETTES.heavyInfantry,
        'skirmisher': UNIT_PALETTES.skirmisher,
        'militia': UNIT_PALETTES.militia,
        'artillery': UNIT_PALETTES.artillery,
    };

    for (const unitType of ALL_UNIT_TYPES) {
        it(`${unitType} weapon should add at least 16 opaque pixels (4×4 minimum area)`, () => {
            const buf = createUnitBuffer();
            drawWeaponElement(buf, unitType, PALETTE_MAP[unitType]);
            const weaponPixels = countOpaquePixels(buf);
            assert.ok(weaponPixels >= 16,
                `${unitType} weapon should have at least 16 pixels, got ${weaponPixels}`);
        });

        it(`${unitType} weapon should fit within 32×32 canvas`, () => {
            const buf = createUnitBuffer();
            drawWeaponElement(buf, unitType, PALETTE_MAP[unitType]);
            const bbox = getOpaqueBoundingBox(buf, UNIT_SIZE);
            if (bbox.maxX >= 0) {
                assert.ok(bbox.minX >= 0 && bbox.maxX < UNIT_SIZE);
                assert.ok(bbox.minY >= 0 && bbox.maxY < UNIT_SIZE);
            }
        });
    }

    it('knight weapon should include silver blade pixels', () => {
        const buf = createUnitBuffer();
        drawWeaponElement(buf, 'knight', UNIT_PALETTES.knight);
        // Check for silver-colored pixels (180, 180, 190)
        let silverCount = 0;
        for (let i = 0; i < buf.length; i += 4) {
            if (buf[i + 3] > 0 && buf[i] === 180 && buf[i + 1] === 180 && buf[i + 2] === 190) {
                silverCount++;
            }
        }
        assert.ok(silverCount >= 8, `Knight sword blade should have silver pixels, got ${silverCount}`);
    });

    it('knight weapon should include gold crossguard pixels', () => {
        const buf = createUnitBuffer();
        drawWeaponElement(buf, 'knight', UNIT_PALETTES.knight);
        let goldCount = 0;
        for (let i = 0; i < buf.length; i += 4) {
            if (buf[i + 3] > 0 && buf[i] === 200 && buf[i + 1] === 170 && buf[i + 2] === 50) {
                goldCount++;
            }
        }
        assert.ok(goldCount >= 4, `Knight crossguard should have gold pixels, got ${goldCount}`);
    });

    it('archer weapon should include brown bow pixels', () => {
        const buf = createUnitBuffer();
        drawWeaponElement(buf, 'archer', UNIT_PALETTES.archer);
        let brownCount = 0;
        for (let i = 0; i < buf.length; i += 4) {
            if (buf[i + 3] > 0 && buf[i] === 120 && buf[i + 1] === 78 && buf[i + 2] === 38) {
                brownCount++;
            }
        }
        assert.ok(brownCount >= 6, `Archer bow should have brown pixels, got ${brownCount}`);
    });
});

// ─── drawSilhouette() tests ────────────────────────────────────────────────

describe('drawSilhouette: fills body parts with palette colors', () => {
    for (const unitType of ALL_UNIT_TYPES) {
        const palette = {
            'knight': UNIT_PALETTES.knight,
            'archer': UNIT_PALETTES.archer,
            'spearman': UNIT_PALETTES.spearman,
            'crossbowman': UNIT_PALETTES.crossbowman,
            'engineer': UNIT_PALETTES.engineer,
            'heavy-infantry': UNIT_PALETTES.heavyInfantry,
            'skirmisher': UNIT_PALETTES.skirmisher,
            'militia': UNIT_PALETTES.militia,
            'artillery': UNIT_PALETTES.artillery,
        }[unitType];

        it(`${unitType} silhouette should produce opaque pixels`, () => {
            const buf = createUnitBuffer();
            drawSilhouette(buf, unitType, palette, 20000);
            const opaqueCount = countOpaquePixels(buf);
            assert.ok(opaqueCount >= 30,
                `${unitType} silhouette should have at least 30 opaque pixels, got ${opaqueCount}`);
        });

        it(`${unitType} silhouette should be deterministic`, () => {
            const buf1 = createUnitBuffer();
            drawSilhouette(buf1, unitType, palette, 20000);
            const buf2 = createUnitBuffer();
            drawSilhouette(buf2, unitType, palette, 20000);
            assert.ok(buf1.equals(buf2), `${unitType} silhouette should be deterministic`);
        });

        it(`${unitType} silhouette should differ with different seeds`, () => {
            const buf1 = createUnitBuffer();
            drawSilhouette(buf1, unitType, palette, 20000);
            const buf2 = createUnitBuffer();
            drawSilhouette(buf2, unitType, palette, 30000);
            assert.ok(!buf1.equals(buf2), `${unitType} silhouette should vary with seed`);
        });
    }

    it('silhouette pixel count should roughly match sum of body part areas', () => {
        const buf = createUnitBuffer();
        drawSilhouette(buf, 'knight', UNIT_PALETTES.knight, 20000);
        const opaqueCount = countOpaquePixels(buf);
        const silhouette = getSilhouette('knight');
        let expectedArea = 0;
        for (const rect of Object.values(silhouette)) {
            expectedArea += rect.w * rect.h;
        }
        // Some overlap between parts is expected, so opaque count <= expected area
        assert.ok(opaqueCount <= expectedArea + 5,
            `Opaque pixels (${opaqueCount}) should not greatly exceed total part area (${expectedArea})`);
        assert.ok(opaqueCount >= expectedArea * 0.5,
            `Opaque pixels (${opaqueCount}) should cover at least 50% of part area (${expectedArea})`);
    });
});

// ─── setPixel() and fillRect() tests ────────────────────────────────────────

describe('setPixel: bounds checking and clamping', () => {
    it('should write pixel at valid coordinates', () => {
        const buf = createUnitBuffer();
        setPixel(buf, 10, 10, 100, 150, 200);
        const idx = (10 * UNIT_SIZE + 10) * 4;
        assert.equal(buf[idx], 100);
        assert.equal(buf[idx + 1], 150);
        assert.equal(buf[idx + 2], 200);
        assert.equal(buf[idx + 3], 255);
    });

    it('should clamp color values to [0, 255]', () => {
        const buf = createUnitBuffer();
        setPixel(buf, 0, 0, -50, 300, 128);
        assert.equal(buf[0], 0);
        assert.equal(buf[1], 255);
        assert.equal(buf[2], 128);
    });

    it('should ignore out-of-bounds coordinates', () => {
        const buf = createUnitBuffer();
        setPixel(buf, -1, 0, 255, 0, 0);
        setPixel(buf, UNIT_SIZE, 0, 255, 0, 0);
        setPixel(buf, 0, -1, 255, 0, 0);
        setPixel(buf, 0, UNIT_SIZE, 255, 0, 0);
        assert.equal(countOpaquePixels(buf), 0);
    });
});

describe('fillRect: fills rectangular regions', () => {
    it('should fill a 4×4 region with 16 opaque pixels', () => {
        const buf = createUnitBuffer();
        fillRect(buf, 5, 5, 4, 4, 100, 100, 100);
        assert.equal(countOpaquePixels(buf), 16);
    });

    it('should fill with the specified color', () => {
        const buf = createUnitBuffer();
        fillRect(buf, 0, 0, 2, 2, 50, 100, 150);
        const idx = 0;
        assert.equal(buf[idx], 50);
        assert.equal(buf[idx + 1], 100);
        assert.equal(buf[idx + 2], 150);
        assert.equal(buf[idx + 3], 255);
    });

    it('should clip to canvas bounds', () => {
        const buf = createUnitBuffer();
        fillRect(buf, 30, 30, 10, 10, 100, 100, 100);
        // Only 2×2 = 4 pixels should be within bounds
        assert.equal(countOpaquePixels(buf), 4);
    });
});

// ─── createUnitBuffer() tests ───────────────────────────────────────────────

describe('createUnitBuffer: creates transparent 32×32 buffer', () => {
    it('should create a buffer of correct size', () => {
        const buf = createUnitBuffer();
        assert.equal(buf.length, UNIT_SIZE * UNIT_SIZE * 4);
    });

    it('should be fully transparent (all zeros)', () => {
        const buf = createUnitBuffer();
        for (let i = 0; i < buf.length; i++) {
            assert.equal(buf[i], 0);
        }
    });
});
