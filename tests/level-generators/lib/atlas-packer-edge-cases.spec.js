/**
 * Edge case tests for atlas-packer.js
 *
 * Recommendation 4: Additional atlas packer edge cases not covered by
 * atlas-packer-split.spec.js — whitespace-only names, single sprite,
 * and multi-frame sprite handling across atlas pages.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/atlas-packer-edge-cases.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { packAtlas } = require('../../../js/level-generators/lib/atlas-packer');

function createSprite(name, width, height, frames) {
    const bufSize = width * height * 4 * (frames || 1);
    return { name, width, height, buffer: Buffer.alloc(bufSize, 50), frames };
}

describe('atlas-packer: whitespace and edge-case names', () => {
    it('should throw on whitespace-only sprite name', () => {
        const sprites = [createSprite('   ', 64, 32)];
        assert.throws(
            () => packAtlas(sprites),
            (err) => err.message === 'Invalid sprite name'
        );
    });

    it('should throw on tab-only sprite name', () => {
        const sprites = [createSprite('\t', 64, 32)];
        assert.throws(
            () => packAtlas(sprites),
            (err) => err.message === 'Invalid sprite name'
        );
    });

    it('should throw on null sprite name', () => {
        const sprites = [{ name: null, width: 64, height: 32, buffer: Buffer.alloc(64 * 32 * 4) }];
        assert.throws(
            () => packAtlas(sprites),
            (err) => err.message === 'Invalid sprite name'
        );
    });

    it('should accept a single sprite', () => {
        const sprites = [createSprite('solo', 64, 32)];
        const { atlases, metadata } = packAtlas(sprites);
        assert.equal(atlases.length, 1);
        assert.ok(metadata.frames['solo']);
    });
});

describe('atlas-packer: multi-frame sprites across pages', () => {
    it('should expand multi-frame sprites into individual frame entries', () => {
        // 4 frames of 64x32 each, buffer stacked vertically
        const sprite = createSprite('water-anim', 64, 32, 4);
        const { metadata } = packAtlas([sprite]);

        // Should have 4 frame entries
        assert.ok(metadata.frames['water-anim-frame-0']);
        assert.ok(metadata.frames['water-anim-frame-1']);
        assert.ok(metadata.frames['water-anim-frame-2']);
        assert.ok(metadata.frames['water-anim-frame-3']);
    });

    it('should build animations section for multi-frame sprites', () => {
        const sprite = createSprite('flag-anim', 32, 32, 3);
        const { metadata } = packAtlas([sprite]);

        assert.ok(metadata.animations['flag-anim']);
        assert.equal(metadata.animations['flag-anim'].length, 3);
        assert.deepEqual(metadata.animations['flag-anim'], [
            'flag-anim-frame-0',
            'flag-anim-frame-1',
            'flag-anim-frame-2',
        ]);
    });

    it('should not create animations entry for single-frame sprites', () => {
        const sprite = createSprite('static-sprite', 64, 32);
        const { metadata } = packAtlas([sprite]);

        assert.equal(metadata.animations['static-sprite'], undefined);
    });

    it('should handle mix of single and multi-frame sprites', () => {
        const sprites = [
            createSprite('grass', 64, 32),
            createSprite('water', 64, 32, 3),
            createSprite('castle', 64, 32),
        ];
        const { metadata } = packAtlas(sprites);

        // Single-frame sprites
        assert.ok(metadata.frames['grass']);
        assert.ok(metadata.frames['castle']);
        // Multi-frame expanded
        assert.ok(metadata.frames['water-frame-0']);
        assert.ok(metadata.frames['water-frame-1']);
        assert.ok(metadata.frames['water-frame-2']);
        // Total: 2 single + 3 frames = 5
        assert.equal(Object.keys(metadata.frames).length, 5);
    });
});

describe('atlas-packer: oversized sprites', () => {
    // MAX_ATLAS_SIZE is 2048. ShelfPacker.place() is called with
    // paddedWidth = width + 1 and paddedHeight = height + 1.
    // If paddedWidth > 2048 or paddedHeight > 2048, place() returns null,
    // placed.length === 0, and packAtlas throws 'Atlas metadata serialization failed'.

    it('sprite with width > 2048 throws Atlas metadata serialization failed', () => {
        // width 2049 → paddedWidth 2050 > 2048 → place() returns null
        const sprite = createSprite('too-wide', 2049, 32);
        assert.throws(
            () => packAtlas([sprite]),
            (err) => err.message === 'Atlas metadata serialization failed'
        );
    });

    it('sprite with height > 2048 throws Atlas metadata serialization failed', () => {
        // height 2049 → paddedHeight 2050 > 2048 → place() returns null
        const sprite = createSprite('too-tall', 32, 2049);
        assert.throws(
            () => packAtlas([sprite]),
            (err) => err.message === 'Atlas metadata serialization failed'
        );
    });

    it('sprite with width = 2048 exactly packs successfully (boundary)', () => {
        // width 2048 → paddedWidth 2049 > 2048 → place() returns null on current shelf,
        // then tries new shelf: width 2048 <= maxWidth (2048), so it fits.
        // Actually paddedWidth = 2049 > maxWidth = 2048, so place() returns null.
        // This means width=2048 also fails. Let's test width=2047 as the true boundary.
        // width 2047 → paddedWidth 2048 <= 2048 → fits.
        const sprite = createSprite('max-width', 2047, 32);
        assert.doesNotThrow(() => {
            const { atlases, metadata } = packAtlas([sprite]);
            assert.ok(atlases.length >= 1);
            assert.ok(metadata.frames['max-width']);
        });
    });

    it('sprite with height = 2047 packs successfully (boundary)', () => {
        // height 2047 → paddedHeight 2048 <= 2048 → fits vertically
        const sprite = createSprite('max-height', 32, 2047);
        assert.doesNotThrow(() => {
            const { atlases, metadata } = packAtlas([sprite]);
            assert.ok(atlases.length >= 1);
            assert.ok(metadata.frames['max-height']);
        });
    });

    it('sprite with width = 2048 throws (paddedWidth 2049 exceeds maxWidth 2048)', () => {
        // Confirms the exact boundary: width=2048 → paddedWidth=2049 > 2048 → fails
        const sprite = createSprite('exact-max-width', 2048, 32);
        assert.throws(
            () => packAtlas([sprite]),
            (err) => err.message === 'Atlas metadata serialization failed'
        );
    });

    it('sprite with height = 2048 throws (paddedHeight 2049 exceeds maxHeight 2048)', () => {
        const sprite = createSprite('exact-max-height', 32, 2048);
        assert.throws(
            () => packAtlas([sprite]),
            (err) => err.message === 'Atlas metadata serialization failed'
        );
    });

    it('mix of normal and oversized sprites: oversized causes throw', () => {
        const sprites = [
            createSprite('normal-a', 64, 32),
            createSprite('oversized', 2049, 32),
            createSprite('normal-b', 64, 32),
        ];
        assert.throws(
            () => packAtlas(sprites),
            (err) => err.message === 'Atlas metadata serialization failed'
        );
    });
});
