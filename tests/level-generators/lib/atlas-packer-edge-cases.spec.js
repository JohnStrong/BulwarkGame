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
