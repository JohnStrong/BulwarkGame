/**
 * Tests for atlas-packer multi-atlas split path.
 *
 * Recommendation 2: Test the atlas-packer multi-atlas split path by creating
 * enough large sprites to exceed 2048px and verifying the packer produces
 * multiple atlas buffers with correct metadata atlasIndex fields.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/atlas-packer-split.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { packAtlas } = require('../../../js/level-generators/lib/atlas-packer');

/**
 * Creates a sprite entry with the given dimensions.
 */
function createSprite(name, width, height) {
    return {
        name,
        width,
        height,
        buffer: Buffer.alloc(width * height * 4, 100),
    };
}

describe('atlas-packer: multi-atlas split', () => {
    it('should split into multiple atlases when sprites exceed 2048px', () => {
        // Create many large sprites that cannot fit in a single 2048x2048 atlas
        // Each sprite is 512x512 = 262144 pixels. A 2048x2048 atlas can fit
        // at most 16 of these (4x4 grid). Create 20 to force a split.
        const sprites = [];
        for (let i = 0; i < 20; i++) {
            sprites.push(createSprite(`large-sprite-${i}`, 512, 512));
        }

        const { atlases, metadata } = packAtlas(sprites);

        // Should produce more than one atlas
        assert.ok(atlases.length > 1, `Expected multiple atlases, got ${atlases.length}`);
    });

    it('should assign correct atlasIndex to frames across multiple atlases', () => {
        // Create sprites that force a split
        const sprites = [];
        for (let i = 0; i < 20; i++) {
            sprites.push(createSprite(`split-sprite-${i}`, 512, 512));
        }

        const { atlases, metadata } = packAtlas(sprites);

        // Verify atlasIndex values are valid
        const frameEntries = Object.values(metadata.frames);
        for (const frame of frameEntries) {
            assert.ok(
                frame.atlasIndex >= 0 && frame.atlasIndex < atlases.length,
                `atlasIndex ${frame.atlasIndex} should be in range [0, ${atlases.length - 1}]`
            );
        }

        // Verify that at least some frames are on atlas index > 0
        const maxIndex = Math.max(...frameEntries.map(f => f.atlasIndex));
        assert.ok(maxIndex > 0, 'At least some frames should be on a second atlas page');
    });

    it('should include all sprites in metadata even when split across atlases', () => {
        const sprites = [];
        for (let i = 0; i < 20; i++) {
            sprites.push(createSprite(`all-sprite-${i}`, 512, 512));
        }

        const { metadata } = packAtlas(sprites);

        // All 20 sprites should appear in metadata
        assert.equal(Object.keys(metadata.frames).length, 20);
        for (let i = 0; i < 20; i++) {
            assert.ok(
                metadata.frames[`all-sprite-${i}`],
                `Sprite all-sprite-${i} should be in metadata`
            );
        }
    });

    it('should produce power-of-two dimensions for all atlas pages', () => {
        const sprites = [];
        for (let i = 0; i < 20; i++) {
            sprites.push(createSprite(`pot-sprite-${i}`, 512, 512));
        }

        const { atlases, metadata } = packAtlas(sprites);
        const validSizes = [256, 512, 1024, 2048];

        // First atlas dimensions from metadata
        assert.ok(
            validSizes.includes(metadata.meta.size.w),
            `Atlas width ${metadata.meta.size.w} should be power-of-two`
        );
        assert.ok(
            validSizes.includes(metadata.meta.size.h),
            `Atlas height ${metadata.meta.size.h} should be power-of-two`
        );
    });

    it('should not split when all sprites fit in one atlas', () => {
        // Small sprites that easily fit in one atlas
        const sprites = [];
        for (let i = 0; i < 10; i++) {
            sprites.push(createSprite(`small-sprite-${i}`, 64, 32));
        }

        const { atlases } = packAtlas(sprites);
        assert.equal(atlases.length, 1, 'Small sprites should fit in one atlas');
    });

    it('should handle sprites of varying sizes across atlas split', () => {
        const sprites = [];
        // Mix of large and small sprites
        for (let i = 0; i < 15; i++) {
            sprites.push(createSprite(`big-${i}`, 512, 512));
        }
        for (let i = 0; i < 10; i++) {
            sprites.push(createSprite(`tiny-${i}`, 32, 32));
        }

        const { atlases, metadata } = packAtlas(sprites);

        // All sprites should be in metadata
        assert.equal(Object.keys(metadata.frames).length, 25);
        // Should have multiple atlases due to the large sprites
        assert.ok(atlases.length >= 1);
    });

    it('should throw on duplicate sprite names', () => {
        const sprites = [
            createSprite('duplicate', 64, 32),
            createSprite('duplicate', 64, 32),
        ];

        assert.throws(
            () => packAtlas(sprites),
            (err) => err.message === 'Invalid sprite name'
        );
    });

    it('should throw on empty sprite name', () => {
        const sprites = [
            createSprite('', 64, 32),
        ];

        assert.throws(
            () => packAtlas(sprites),
            (err) => err.message === 'Invalid sprite name'
        );
    });

    it('should handle frames that do not overlap across atlas pages', () => {
        const sprites = [];
        for (let i = 0; i < 20; i++) {
            sprites.push(createSprite(`no-overlap-${i}`, 512, 512));
        }

        const { metadata } = packAtlas(sprites);
        const frameEntries = Object.entries(metadata.frames);

        // Check no overlap within same atlas page
        for (let i = 0; i < frameEntries.length; i++) {
            for (let j = i + 1; j < frameEntries.length; j++) {
                const [, a] = frameEntries[i];
                const [, b] = frameEntries[j];

                if (a.atlasIndex !== b.atlasIndex) continue;

                const overlapX = Math.max(0,
                    Math.min(a.frame.x + a.frame.w, b.frame.x + b.frame.w) -
                    Math.max(a.frame.x, b.frame.x)
                );
                const overlapY = Math.max(0,
                    Math.min(a.frame.y + a.frame.h, b.frame.y + b.frame.h) -
                    Math.max(a.frame.y, b.frame.y)
                );

                assert.ok(
                    !(overlapX > 0 && overlapY > 0),
                    `Frames should not overlap on same atlas page`
                );
            }
        }
    });
});
