/**
 * Integration test for the build-sprites pipeline.
 *
 * Recommendation 8: Verify the atlas output meets the 4MB size constraint
 * and contains all expected frame entries in atlas.json.
 *
 * This test exercises the atlas packing pipeline end-to-end using
 * synthetic sprite buffers (avoiding actual generator execution which
 * requires sharp file I/O).
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/build-sprites-integration.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { packAtlas } = require('../../js/level-generators/lib/atlas-packer');

// ─── Expected sprite manifest ───────────────────────────────────────────────

const TERRAIN_SPRITES = [
    'grass-short-1', 'grass-short-2', 'grass-flowers-1', 'grass-flowers-2',
    'road-full', 'water-1', 'water-2', 'water-3', 'bridge-mm',
    'tree-1', 'tree-2', 'tree-3', 'tree-4', 'tree-5', 'tree-6', 'tree-7',
    'rock',
];

const CASTLE_SPRITES = [
    'castle-bridge-start', 'castle-bridge-mid', 'castle-bridge-gate',
    'castle-tower', 'castle-keep-tl', 'castle-keep-bl', 'castle-keep-br',
    'castle-keep-center', 'castle-gatehouse', 'castle-wall',
    'castle-bailey-1', 'castle-bailey-2', 'castle-bailey-3',
];

const UNIT_SPRITES = [
    'unit-knight', 'unit-heavy-infantry', 'unit-spearman',
    'unit-archer', 'unit-crossbowman', 'unit-skirmisher',
    'unit-engineer', 'unit-militia', 'unit-artillery',
];

const ENEMY_SPRITES = [
    'enemy-knight', 'enemy-archer', 'enemy-spearman',
    'enemy-militia', 'enemy-siege',
];

const DAMAGED_SPRITES = [
    'castle-wall-damaged', 'castle-tower-damaged',
    'castle-keep-tl-damaged', 'castle-keep-bl-damaged',
    'castle-keep-br-damaged', 'castle-keep-center-damaged',
    'castle-gatehouse-damaged', 'castle-bailey-1-damaged',
    'castle-bailey-2-damaged', 'castle-bailey-3-damaged',
];

const ALL_SPRITES = [
    ...TERRAIN_SPRITES,
    ...CASTLE_SPRITES,
    ...UNIT_SPRITES,
    ...ENEMY_SPRITES,
    ...DAMAGED_SPRITES,
];

// Water animation (multi-frame)
const WATER_ANIM_FRAMES = 4;

function createSpriteEntry(name, width, height, frames) {
    const bufSize = width * height * 4 * (frames || 1);
    // Fill with semi-random data to simulate real sprites
    const buf = Buffer.alloc(bufSize);
    for (let i = 0; i < bufSize; i += 4) {
        buf[i] = (i * 7) % 256;
        buf[i + 1] = (i * 13) % 256;
        buf[i + 2] = (i * 23) % 256;
        buf[i + 3] = 255;
    }
    return { name, width, height, buffer: buf, frames };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('build-sprites integration: full pipeline simulation', () => {
    it('should pack all expected sprites into atlas(es)', () => {
        const sprites = ALL_SPRITES.map(name => {
            const isUnit = name.startsWith('unit-');
            const w = isUnit ? 32 : 64;
            const h = isUnit ? 32 : 32;
            return createSpriteEntry(name, w, h);
        });
        // Add water animation
        sprites.push(createSpriteEntry('water-anim', 64, 32, WATER_ANIM_FRAMES));

        const { atlases, metadata } = packAtlas(sprites);

        // All single-frame sprites should be in metadata
        for (const name of ALL_SPRITES) {
            assert.ok(metadata.frames[name],
                `Sprite "${name}" should be in atlas metadata`);
        }

        // Water animation frames should be expanded
        for (let i = 0; i < WATER_ANIM_FRAMES; i++) {
            assert.ok(metadata.frames[`water-anim-frame-${i}`],
                `Water animation frame ${i} should be in metadata`);
        }
    });

    it('should produce atlas under 4MB size constraint', () => {
        const sprites = ALL_SPRITES.map(name => {
            const isUnit = name.startsWith('unit-');
            return createSpriteEntry(name, isUnit ? 32 : 64, isUnit ? 32 : 32);
        });
        sprites.push(createSpriteEntry('water-anim', 64, 32, WATER_ANIM_FRAMES));

        const { atlases } = packAtlas(sprites);

        const MAX_SIZE = 4 * 1024 * 1024; // 4MB
        for (let i = 0; i < atlases.length; i++) {
            assert.ok(atlases[i].length <= MAX_SIZE,
                `Atlas ${i} size ${atlases[i].length} exceeds 4MB limit`);
        }
    });

    it('should produce power-of-two atlas dimensions', () => {
        const sprites = ALL_SPRITES.map(name => {
            const isUnit = name.startsWith('unit-');
            return createSpriteEntry(name, isUnit ? 32 : 64, isUnit ? 32 : 32);
        });
        sprites.push(createSpriteEntry('water-anim', 64, 32, WATER_ANIM_FRAMES));

        const { metadata } = packAtlas(sprites);
        const validSizes = [256, 512, 1024, 2048];

        assert.ok(validSizes.includes(metadata.meta.size.w),
            `Atlas width ${metadata.meta.size.w} should be power-of-two`);
        assert.ok(validSizes.includes(metadata.meta.size.h),
            `Atlas height ${metadata.meta.size.h} should be power-of-two`);
    });

    it('should include water-anim in animations section', () => {
        const sprites = ALL_SPRITES.map(name => {
            const isUnit = name.startsWith('unit-');
            return createSpriteEntry(name, isUnit ? 32 : 64, isUnit ? 32 : 32);
        });
        sprites.push(createSpriteEntry('water-anim', 64, 32, WATER_ANIM_FRAMES));

        const { metadata } = packAtlas(sprites);

        assert.ok(metadata.animations['water-anim'],
            'Should have water-anim in animations');
        assert.equal(metadata.animations['water-anim'].length, WATER_ANIM_FRAMES);
    });

    it('should have no overlapping frames within same atlas page', () => {
        const sprites = ALL_SPRITES.map(name => {
            const isUnit = name.startsWith('unit-');
            return createSpriteEntry(name, isUnit ? 32 : 64, isUnit ? 32 : 32);
        });
        sprites.push(createSpriteEntry('water-anim', 64, 32, WATER_ANIM_FRAMES));

        const { metadata } = packAtlas(sprites);
        const entries = Object.values(metadata.frames);

        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                const a = entries[i];
                const b = entries[j];
                if (a.atlasIndex !== b.atlasIndex) continue;

                const overlapX = Math.max(0,
                    Math.min(a.frame.x + a.frame.w, b.frame.x + b.frame.w) -
                    Math.max(a.frame.x, b.frame.x));
                const overlapY = Math.max(0,
                    Math.min(a.frame.y + a.frame.h, b.frame.y + b.frame.h) -
                    Math.max(a.frame.y, b.frame.y));

                assert.ok(!(overlapX > 0 && overlapY > 0),
                    'Frames should not overlap on same atlas page');
            }
        }
    });

    it('should produce valid JSON-serializable metadata', () => {
        const sprites = ALL_SPRITES.slice(0, 10).map(name =>
            createSpriteEntry(name, 64, 32));

        const { metadata } = packAtlas(sprites);

        // Should not throw
        const json = JSON.stringify(metadata);
        const parsed = JSON.parse(json);
        assert.ok(parsed.meta);
        assert.ok(parsed.frames);
        assert.ok(parsed.animations !== undefined);
    });

    it('should include correct sprite count in metadata', () => {
        const sprites = ALL_SPRITES.map(name => {
            const isUnit = name.startsWith('unit-');
            return createSpriteEntry(name, isUnit ? 32 : 64, isUnit ? 32 : 32);
        });
        sprites.push(createSpriteEntry('water-anim', 64, 32, WATER_ANIM_FRAMES));

        const { metadata } = packAtlas(sprites);

        // Total frames = ALL_SPRITES.length + WATER_ANIM_FRAMES
        const expectedFrames = ALL_SPRITES.length + WATER_ANIM_FRAMES;
        assert.equal(Object.keys(metadata.frames).length, expectedFrames);
    });
});
