/**
 * Tests for js/level-generators/generate-damaged-castle-sprites.js
 *
 * Tests the damaged castle sprite generation (64×32, stone block patterns,
 * crack/rubble/missing-block damage, palette quantization, determinism).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-damaged-castle-sprites.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    generateDamagedCastleSprite,
    generateDamagedWall,
    generateDamagedTower,
    generateDamagedKeepTL,
    generateDamagedKeepBL,
    generateDamagedKeepBR,
    generateDamagedKeepCenter,
    generateDamagedGatehouse,
    generateDamagedBailey1,
    generateDamagedBailey2,
    generateDamagedBailey3,
    applyCracks,
    applyMissingBlocks,
    applyRubbleDebris,
    applyDamage,
    countOpaquePixels,
    DAMAGED_CASTLE_TYPES,
    CASTLE_PALETTE,
    MIN_DAMAGE_PERCENT,
} = require('../../js/level-generators/generate-damaged-castle-sprites');

const { TILE_WIDTH, TILE_HEIGHT } = require('../../js/level-generators/lib/sprite-constants');
const { createBuffer, isInsideDiamond } = require('../../js/level-generators/lib/pixel-utils');
const { fillDiamond } = require('../../js/level-generators/lib/fill-patterns');

// ─── Helpers ────────────────────────────────────────────────────────────────

function countOpaquePixelsInBuffer(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] > 0) count++;
    }
    return count;
}

/**
 * Creates a fully opaque diamond buffer for testing damage functions.
 */
function createFilledBuffer() {
    const buf = createBuffer();
    fillDiamond(buf, [150, 150, 150], 0, 12345);
    return buf;
}

// ─── Constants ──────────────────────────────────────────────────────────────

describe('generate-damaged-castle-sprites: constants', () => {
    it('should define exactly 10 damaged castle types (Requirement 9.1)', () => {
        assert.equal(DAMAGED_CASTLE_TYPES.length, 10);
    });

    it('damaged types should have correct names', () => {
        const names = DAMAGED_CASTLE_TYPES.map(e => e.name);
        assert.deepEqual(names, [
            'castle-wall-damaged',
            'castle-tower-damaged',
            'castle-keep-tl-damaged',
            'castle-keep-bl-damaged',
            'castle-keep-br-damaged',
            'castle-keep-center-damaged',
            'castle-gatehouse-damaged',
            'castle-bailey-1-damaged',
            'castle-bailey-2-damaged',
            'castle-bailey-3-damaged',
        ]);
    });

    it('damaged types should have unique seed values', () => {
        const seeds = DAMAGED_CASTLE_TYPES.map(e => e.seed);
        const uniqueSeeds = new Set(seeds);
        assert.equal(uniqueSeeds.size, 10);
    });

    it('MIN_DAMAGE_PERCENT should be 0.15 (15%)', () => {
        assert.equal(MIN_DAMAGE_PERCENT, 0.15);
    });

    it('CASTLE_PALETTE should be a non-empty array of RGB triples', () => {
        assert.ok(Array.isArray(CASTLE_PALETTE));
        assert.ok(CASTLE_PALETTE.length > 0);
        for (const color of CASTLE_PALETTE) {
            assert.equal(color.length, 3);
            assert.ok(color[0] >= 0 && color[0] <= 255);
            assert.ok(color[1] >= 0 && color[1] <= 255);
            assert.ok(color[2] >= 0 && color[2] <= 255);
        }
    });
});

// ─── Buffer Dimensions ──────────────────────────────────────────────────────

describe('generate-damaged-castle-sprites: buffer dimensions', () => {
    it('should produce a 64×32 RGBA buffer for all types', () => {
        for (const entry of DAMAGED_CASTLE_TYPES) {
            const buf = generateDamagedCastleSprite(entry.type, entry.seed);
            assert.equal(buf.length, TILE_WIDTH * TILE_HEIGHT * 4,
                `${entry.name} should have correct buffer size`);
        }
    });

    it('TILE_WIDTH should be 64 and TILE_HEIGHT should be 32', () => {
        assert.equal(TILE_WIDTH, 64);
        assert.equal(TILE_HEIGHT, 32);
    });
});

// ─── Determinism ────────────────────────────────────────────────────────────

describe('generate-damaged-castle-sprites: determinism', () => {
    it('should be deterministic for the same type and seed', () => {
        const buf1 = generateDamagedCastleSprite('wall', 50000);
        const buf2 = generateDamagedCastleSprite('wall', 50000);
        assert.ok(buf1.equals(buf2));
    });

    it('should produce different output for different seed values', () => {
        const buf1 = generateDamagedCastleSprite('wall', 50000);
        const buf2 = generateDamagedCastleSprite('wall', 99999);
        assert.ok(!buf1.equals(buf2));
    });

    it('should produce different output for different types', () => {
        const buf1 = generateDamagedCastleSprite('wall', 50000);
        const buf2 = generateDamagedCastleSprite('tower', 50000);
        assert.ok(!buf1.equals(buf2));
    });

    it('all 10 types should produce unique sprites', () => {
        const buffers = DAMAGED_CASTLE_TYPES.map(entry =>
            generateDamagedCastleSprite(entry.type, entry.seed)
        );
        for (let i = 0; i < buffers.length; i++) {
            for (let j = i + 1; j < buffers.length; j++) {
                assert.ok(!buffers[i].equals(buffers[j]),
                    `${DAMAGED_CASTLE_TYPES[i].name} and ${DAMAGED_CASTLE_TYPES[j].name} should differ`);
            }
        }
    });
});

// ─── Palette Compliance ─────────────────────────────────────────────────────

describe('generate-damaged-castle-sprites: palette compliance', () => {
    it('all non-transparent pixels should match the castle palette', () => {
        const buf = generateDamagedCastleSprite('wall', 50000);
        for (let i = 0; i < buf.length; i += 4) {
            if (buf[i + 3] === 0) continue;
            const r = buf[i], g = buf[i + 1], b = buf[i + 2];
            const found = CASTLE_PALETTE.some(c => c[0] === r && c[1] === g && c[2] === b);
            assert.ok(found,
                `Pixel at byte ${i} has color [${r},${g},${b}] not in castle palette`);
        }
    });

    it('palette compliance holds for all 10 damaged types', () => {
        for (const entry of DAMAGED_CASTLE_TYPES) {
            const buf = generateDamagedCastleSprite(entry.type, entry.seed);
            for (let i = 0; i < buf.length; i += 4) {
                if (buf[i + 3] === 0) continue;
                const r = buf[i], g = buf[i + 1], b = buf[i + 2];
                const found = CASTLE_PALETTE.some(c => c[0] === r && c[1] === g && c[2] === b);
                assert.ok(found,
                    `${entry.name}: pixel at byte ${i} has color [${r},${g},${b}] not in palette`);
            }
        }
    });
});

// ─── Binary Alpha ───────────────────────────────────────────────────────────

describe('generate-damaged-castle-sprites: binary alpha', () => {
    it('all pixels should have alpha of 0 or 255', () => {
        for (const entry of DAMAGED_CASTLE_TYPES) {
            const buf = generateDamagedCastleSprite(entry.type, entry.seed);
            for (let i = 0; i < buf.length; i += 4) {
                const alpha = buf[i + 3];
                assert.ok(alpha === 0 || alpha === 255,
                    `${entry.name}: pixel at byte ${i} has alpha ${alpha}, expected 0 or 255`);
            }
        }
    });
});

// ─── Damage Coverage (Requirement 9.2) ──────────────────────────────────────

describe('generate-damaged-castle-sprites: damage coverage', () => {
    it('countOpaquePixels should count correctly on a known buffer', () => {
        const buf = createBuffer();
        assert.equal(countOpaquePixels(buf), 0);

        const filled = createFilledBuffer();
        const count = countOpaquePixels(filled);
        assert.ok(count > 0, 'Filled diamond should have opaque pixels');
    });

    it('applyCracks should modify pixels in the buffer', () => {
        const buf = createFilledBuffer();
        const modified = applyCracks(buf, 12345, 5);
        assert.ok(modified > 0, 'applyCracks should modify at least some pixels');
    });

    it('applyMissingBlocks should modify pixels in the buffer', () => {
        const buf = createFilledBuffer();
        const modified = applyMissingBlocks(buf, 12345, 4);
        assert.ok(modified > 0, 'applyMissingBlocks should modify at least some pixels');
    });

    it('applyRubbleDebris should modify pixels in the buffer', () => {
        const buf = createFilledBuffer();
        const modified = applyRubbleDebris(buf, 12345, 5);
        assert.ok(modified > 0, 'applyRubbleDebris should modify at least some pixels');
    });

    it('applyDamage should modify at least 15% of opaque pixels', () => {
        const buf = createFilledBuffer();
        const opaqueCount = countOpaquePixels(buf);
        const bufCopy = Buffer.from(buf);
        applyDamage(bufCopy, 12345, opaqueCount);

        // Count how many pixels changed
        let changedPixels = 0;
        for (let i = 0; i < buf.length; i += 4) {
            if (buf[i] !== bufCopy[i] || buf[i + 1] !== bufCopy[i + 1] ||
                buf[i + 2] !== bufCopy[i + 2] || buf[i + 3] !== bufCopy[i + 3]) {
                changedPixels++;
            }
        }
        const damageRatio = changedPixels / opaqueCount;
        assert.ok(damageRatio >= MIN_DAMAGE_PERCENT,
            `Damage should cover at least 15% of area (got ${(damageRatio * 100).toFixed(1)}%)`);
    });

    it('applyCracks should be deterministic for same seed', () => {
        const buf1 = createFilledBuffer();
        const buf2 = createFilledBuffer();
        applyCracks(buf1, 77777, 4);
        applyCracks(buf2, 77777, 4);
        assert.ok(buf1.equals(buf2));
    });

    it('applyMissingBlocks should be deterministic for same seed', () => {
        const buf1 = createFilledBuffer();
        const buf2 = createFilledBuffer();
        applyMissingBlocks(buf1, 88888, 3);
        applyMissingBlocks(buf2, 88888, 3);
        assert.ok(buf1.equals(buf2));
    });

    it('applyRubbleDebris should be deterministic for same seed', () => {
        const buf1 = createFilledBuffer();
        const buf2 = createFilledBuffer();
        applyRubbleDebris(buf1, 99999, 4);
        applyRubbleDebris(buf2, 99999, 4);
        assert.ok(buf1.equals(buf2));
    });
});

// ─── Dispatch Function ──────────────────────────────────────────────────────

describe('generate-damaged-castle-sprites: generateDamagedCastleSprite dispatch', () => {
    it('should throw for unknown type', () => {
        assert.throws(
            () => generateDamagedCastleSprite('unknown-type', 12345),
            /Unknown damaged castle type/
        );
    });

    it('should dispatch correctly for all valid types', () => {
        const validTypes = ['wall', 'tower', 'keep-tl', 'keep-bl', 'keep-br',
            'keep-center', 'gatehouse', 'bailey-1', 'bailey-2', 'bailey-3'];
        for (const type of validTypes) {
            assert.doesNotThrow(() => {
                const buf = generateDamagedCastleSprite(type, 50000);
                assert.equal(buf.length, TILE_WIDTH * TILE_HEIGHT * 4);
            }, `Type "${type}" should generate without errors`);
        }
    });
});

// ─── Individual Generator Functions ─────────────────────────────────────────

describe('generate-damaged-castle-sprites: individual generators', () => {
    const generators = [
        { fn: generateDamagedWall, name: 'generateDamagedWall' },
        { fn: generateDamagedTower, name: 'generateDamagedTower' },
        { fn: generateDamagedKeepTL, name: 'generateDamagedKeepTL' },
        { fn: generateDamagedKeepBL, name: 'generateDamagedKeepBL' },
        { fn: generateDamagedKeepBR, name: 'generateDamagedKeepBR' },
        { fn: generateDamagedKeepCenter, name: 'generateDamagedKeepCenter' },
        { fn: generateDamagedGatehouse, name: 'generateDamagedGatehouse' },
        { fn: generateDamagedBailey1, name: 'generateDamagedBailey1' },
        { fn: generateDamagedBailey2, name: 'generateDamagedBailey2' },
        { fn: generateDamagedBailey3, name: 'generateDamagedBailey3' },
    ];

    for (const { fn, name } of generators) {
        it(`${name} should generate without errors`, () => {
            assert.doesNotThrow(() => fn(50000));
        });

        it(`${name} should return a buffer of correct size`, () => {
            const buf = fn(50000);
            assert.equal(buf.length, TILE_WIDTH * TILE_HEIGHT * 4);
        });

        it(`${name} should produce opaque pixels`, () => {
            const buf = fn(50000);
            assert.ok(countOpaquePixelsInBuffer(buf) > 50,
                `${name} should have visible pixels`);
        });

        it(`${name} should be deterministic`, () => {
            const buf1 = fn(50000);
            const buf2 = fn(50000);
            assert.ok(buf1.equals(buf2), `${name} should be deterministic`);
        });
    }
});

// ─── Diamond Boundary ───────────────────────────────────────────────────────

describe('generate-damaged-castle-sprites: diamond boundary', () => {
    it('no opaque pixels should exist outside the diamond boundary', () => {
        const buf = generateDamagedCastleSprite('wall', 50000);
        for (let y = 0; y < TILE_HEIGHT; y++) {
            for (let x = 0; x < TILE_WIDTH; x++) {
                if (!isInsideDiamond(x, y)) {
                    const idx = (y * TILE_WIDTH + x) * 4;
                    assert.equal(buf[idx + 3], 0,
                        `Pixel at (${x},${y}) is outside diamond but has alpha ${buf[idx + 3]}`);
                }
            }
        }
    });

    it('diamond boundary holds for tower type', () => {
        const buf = generateDamagedCastleSprite('tower', 50100);
        for (let y = 0; y < TILE_HEIGHT; y++) {
            for (let x = 0; x < TILE_WIDTH; x++) {
                if (!isInsideDiamond(x, y)) {
                    const idx = (y * TILE_WIDTH + x) * 4;
                    assert.equal(buf[idx + 3], 0,
                        `Tower pixel at (${x},${y}) is outside diamond but has alpha ${buf[idx + 3]}`);
                }
            }
        }
    });
});

// ─── Damage Visibility ──────────────────────────────────────────────────────

describe('generate-damaged-castle-sprites: damage visibility', () => {
    it('damaged sprites should differ from a plain stone block fill', () => {
        // A damaged sprite should not be identical to a plain filled diamond
        const buf = generateDamagedCastleSprite('wall', 50000);
        const plain = createFilledBuffer();
        assert.ok(!buf.equals(plain),
            'Damaged sprite should differ from a plain fill');
    });

    it('damaged sprites should have some transparent pixels from missing blocks', () => {
        // At least some damage types create transparent gaps
        const buf = generateDamagedCastleSprite('wall', 50000);
        let hasTransparentInDiamond = false;
        for (let y = 0; y < TILE_HEIGHT; y++) {
            for (let x = 0; x < TILE_WIDTH; x++) {
                if (isInsideDiamond(x, y)) {
                    const idx = (y * TILE_WIDTH + x) * 4;
                    if (buf[idx + 3] === 0) {
                        hasTransparentInDiamond = true;
                        break;
                    }
                }
            }
            if (hasTransparentInDiamond) break;
        }
        // Note: Not all seeds will produce transparent gaps (depends on seededRandom),
        // but the wall type with seed 50000 should have some from applyMissingBlocks
        assert.ok(hasTransparentInDiamond,
            'Damaged wall should have some transparent pixels inside diamond from missing blocks');
    });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('generate-damaged-castle-sprites: edge cases', () => {
    it('applyCracks with 0 cracks should not modify the buffer', () => {
        const buf = createFilledBuffer();
        const modified = applyCracks(buf, 12345, 0);
        assert.equal(modified, 0);
    });

    it('applyMissingBlocks with 0 blocks should not modify the buffer', () => {
        const buf = createFilledBuffer();
        const modified = applyMissingBlocks(buf, 12345, 0);
        assert.equal(modified, 0);
    });

    it('applyRubbleDebris with 0 clusters should not modify the buffer', () => {
        const buf = createFilledBuffer();
        const modified = applyRubbleDebris(buf, 12345, 0);
        assert.equal(modified, 0);
    });

    it('applyCracks on empty buffer should return 0 modified pixels', () => {
        const buf = createBuffer(); // all transparent
        const modified = applyCracks(buf, 12345, 5);
        assert.equal(modified, 0);
    });

    it('applyMissingBlocks on empty buffer should return 0 modified pixels', () => {
        const buf = createBuffer(); // all transparent
        const modified = applyMissingBlocks(buf, 12345, 4);
        assert.equal(modified, 0);
    });

    it('applyRubbleDebris on empty buffer should return 0 modified pixels', () => {
        const buf = createBuffer(); // all transparent
        const modified = applyRubbleDebris(buf, 12345, 5);
        assert.equal(modified, 0);
    });

    it('countOpaquePixels on empty buffer should return 0', () => {
        const buf = createBuffer();
        assert.equal(countOpaquePixels(buf), 0);
    });

    it('different crack counts should produce different damage amounts', () => {
        const buf1 = createFilledBuffer();
        const buf2 = createFilledBuffer();
        const mod1 = applyCracks(buf1, 12345, 2);
        const mod2 = applyCracks(buf2, 12345, 8);
        assert.ok(mod2 > mod1,
            `More cracks (${mod2}) should modify more pixels than fewer (${mod1})`);
    });
});
