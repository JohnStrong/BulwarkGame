/**
 * Tests for atlas-packer infinite-loop guard path.
 *
 * Recommendation 7 (partial): Test packAtlas infinite-loop guard.
 * When a sprite has dimensions exceeding MAX_ATLAS_SIZE (2048px), the packer
 * cannot place it on any page and should throw 'Atlas metadata serialization failed'.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/lib/atlas-packer-infinite-loop-guard.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { packAtlas } = require('../../../js/level-generators/lib/atlas-packer.js');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSprite(name, width, height) {
    const buffer = Buffer.alloc(width * height * 4, 128);
    return { name, buffer, width, height };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('atlas-packer: infinite-loop guard (placed.length === 0)', () => {
    it('should throw "Atlas metadata serialization failed" when sprite exceeds MAX_ATLAS_SIZE', () => {
        // A sprite wider than 2048px cannot be placed on any shelf
        const oversizedSprite = makeSprite('too-wide', 2049, 32);

        assert.throws(
            () => packAtlas([oversizedSprite]),
            { message: 'Atlas metadata serialization failed' },
            'Should throw when sprite cannot be placed on any atlas page'
        );
    });

    it('should throw when sprite is taller than MAX_ATLAS_SIZE', () => {
        // A sprite taller than 2048px cannot fit vertically
        const oversizedSprite = makeSprite('too-tall', 32, 2049);

        assert.throws(
            () => packAtlas([oversizedSprite]),
            { message: 'Atlas metadata serialization failed' },
            'Should throw when sprite height exceeds MAX_ATLAS_SIZE'
        );
    });

    it('should throw when both dimensions exceed MAX_ATLAS_SIZE', () => {
        const oversizedSprite = makeSprite('too-big', 2049, 2049);

        assert.throws(
            () => packAtlas([oversizedSprite]),
            { message: 'Atlas metadata serialization failed' }
        );
    });

    it('should log structured diagnostic to stderr when guard triggers', () => {
        const originalWrite = process.stderr.write.bind(process.stderr);
        let stderrOutput = '';
        process.stderr.write = (msg) => { stderrOutput += msg; return true; };

        try {
            packAtlas([makeSprite('oversized', 2049, 32)]);
        } catch (e) {
            // expected
        } finally {
            process.stderr.write = originalWrite;
        }

        assert.ok(
            stderrOutput.includes('[SPRITE-BUILD-ERROR]'),
            'Should log structured error to stderr'
        );
        assert.ok(
            stderrOutput.includes('atlas-packer'),
            'Error should identify the atlas-packer module'
        );
    });

    it('should still pack valid sprites when oversized sprite is not in the list', () => {
        // Sanity check: normal sprites still pack fine
        const normalSprites = [
            makeSprite('grass-1', 64, 32),
            makeSprite('grass-2', 64, 32),
        ];

        assert.doesNotThrow(() => packAtlas(normalSprites));
        const result = packAtlas(normalSprites);
        assert.equal(result.atlases.length, 1);
        assert.ok(result.metadata.frames['grass-1']);
        assert.ok(result.metadata.frames['grass-2']);
    });

    it('should throw when a mix of valid and oversized sprites is provided', () => {
        // The oversized sprite cannot be placed, triggering the guard
        const sprites = [
            makeSprite('valid-1', 64, 32),
            makeSprite('oversized', 2049, 32),
        ];

        // The valid sprite gets placed on page 0, but the oversized sprite
        // cannot be placed on any subsequent page, triggering the guard
        assert.throws(
            () => packAtlas(sprites),
            { message: 'Atlas metadata serialization failed' }
        );
    });

    it('should throw for sprite exactly at 2049px width (one over the limit)', () => {
        // MAX_ATLAS_SIZE = 2048, so 2049 is exactly one pixel over
        const sprite = makeSprite('just-over-limit', 2049, 1);

        assert.throws(
            () => packAtlas([sprite]),
            { message: 'Atlas metadata serialization failed' }
        );
    });

    it('should NOT throw for sprite well within MAX_ATLAS_SIZE (e.g. 2047px)', () => {
        // A 2047×1 sprite: paddedWidth = 2047 + 1 = 2048 = maxWidth, fits exactly
        const sprite = makeSprite('within-limit', 2047, 1);

        // This should pack successfully (padded width = 2048 = maxWidth)
        assert.doesNotThrow(() => packAtlas([sprite]));
    });
});
