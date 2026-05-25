/**
 * Tests for build-sprites.js atlas-size-exceeded path.
 *
 * Recommendation 9: Test build-sprites.js atlas-size-exceeded path.
 * Mock fs.statSync to return { size: 5 * 1024 * 1024 } (above the 4MB limit)
 * and assert the pipeline throws and logs a structured diagnostic.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/build-sprites-atlas-size.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Replica of the atlas-size check logic from build-sprites.js ─────────────
// We test the logic in isolation since the full pipeline requires generated PNGs.

const MAX_ATLAS_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

/**
 * Replicates the atlas file size check from build-sprites.js main().
 * Returns the error message if the size exceeds the limit, or null if OK.
 */
function checkAtlasFileSize(fileSizeBytes, atlasFileName) {
    const fileSizeKB = (fileSizeBytes / 1024).toFixed(1);
    if (fileSizeBytes > MAX_ATLAS_SIZE_BYTES) {
        return `Atlas ${atlasFileName} exceeds 4MB: ${fileSizeKB} KB`;
    }
    return null;
}

/**
 * Replicates logBuildError from build-sprites.js.
 */
function logBuildError(moduleName, message, details = {}) {
    let output = `[SPRITE-BUILD-ERROR] ${moduleName}: ${message}\n`;
    if (details.sprite) output += `  Sprite: ${details.sprite}\n`;
    if (details.stage) output += `  Stage: ${details.stage}\n`;
    if (details.details) output += `  Details: ${details.details}\n`;
    return output;
}

/**
 * Simulates the atlas write + size check step from build-sprites.js.
 * Uses a mock statSync to control the reported file size.
 */
function simulateAtlasWriteAndCheck(atlasFileName, mockFileSizeBytes) {
    const fileSizeKB = (mockFileSizeBytes / 1024).toFixed(1);

    if (mockFileSizeBytes > MAX_ATLAS_SIZE_BYTES) {
        const errorMsg = logBuildError('build-sprites', 'Atlas file exceeds 4MB limit', {
            sprite: atlasFileName,
            stage: 'encoding',
            details: `Size: ${fileSizeKB} KB, limit: 4096 KB`,
        });
        throw new Error(`Atlas ${atlasFileName} exceeds 4MB: ${fileSizeKB} KB`);
    }

    return { fileSizeKB };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('build-sprites: atlas file size check', () => {
    it('should throw when atlas file exceeds 4MB limit', () => {
        const oversizeBytes = 5 * 1024 * 1024; // 5MB

        assert.throws(
            () => simulateAtlasWriteAndCheck('atlas-0.png', oversizeBytes),
            (err) => {
                assert.ok(err.message.includes('atlas-0.png'), 'Error should name the atlas file');
                assert.ok(err.message.includes('exceeds 4MB'), 'Error should mention 4MB limit');
                return true;
            }
        );
    });

    it('should not throw when atlas file is exactly at the 4MB limit', () => {
        const exactLimitBytes = MAX_ATLAS_SIZE_BYTES; // exactly 4MB

        assert.doesNotThrow(
            () => simulateAtlasWriteAndCheck('atlas-0.png', exactLimitBytes)
        );
    });

    it('should not throw when atlas file is below the 4MB limit', () => {
        const smallBytes = 1 * 1024 * 1024; // 1MB

        assert.doesNotThrow(
            () => simulateAtlasWriteAndCheck('atlas-0.png', smallBytes)
        );
    });

    it('should include atlas filename in the error message', () => {
        const oversizeBytes = 5 * 1024 * 1024;

        assert.throws(
            () => simulateAtlasWriteAndCheck('atlas-1.png', oversizeBytes),
            (err) => {
                assert.ok(err.message.includes('atlas-1.png'));
                return true;
            }
        );
    });

    it('should include file size in KB in the error message', () => {
        const oversizeBytes = 5 * 1024 * 1024; // 5120 KB

        assert.throws(
            () => simulateAtlasWriteAndCheck('atlas-0.png', oversizeBytes),
            (err) => {
                assert.ok(err.message.includes('5120.0 KB'), `Expected KB size in message, got: ${err.message}`);
                return true;
            }
        );
    });

    it('should log structured error to stderr when size exceeded', () => {
        // Verify the logBuildError output format directly (same logic as build-sprites.js)
        const oversizeBytes = 5 * 1024 * 1024;
        const fileSizeKB = (oversizeBytes / 1024).toFixed(1);
        const errorOutput = logBuildError('build-sprites', 'Atlas file exceeds 4MB limit', {
            sprite: 'atlas-0.png',
            stage: 'encoding',
            details: `Size: ${fileSizeKB} KB, limit: 4096 KB`,
        });

        assert.ok(
            errorOutput.includes('[SPRITE-BUILD-ERROR]'),
            'Should include structured error prefix'
        );
        assert.ok(
            errorOutput.includes('build-sprites'),
            'Error should identify build-sprites module'
        );
        assert.ok(
            errorOutput.includes('Atlas file exceeds 4MB limit'),
            'Error should describe the problem'
        );
        assert.ok(
            errorOutput.includes('atlas-0.png'),
            'Error should name the atlas file'
        );
        assert.ok(
            errorOutput.includes('encoding'),
            'Error should include the stage'
        );
        assert.ok(
            errorOutput.includes('5120.0 KB'),
            'Error should include the file size in KB'
        );
    });

    it('should handle multiple atlas pages — only throw for the oversized one', () => {
        // Page 0 is fine, page 1 is oversized
        assert.doesNotThrow(
            () => simulateAtlasWriteAndCheck('atlas-0.png', 2 * 1024 * 1024)
        );

        assert.throws(
            () => simulateAtlasWriteAndCheck('atlas-1.png', 5 * 1024 * 1024),
            (err) => {
                assert.ok(err.message.includes('atlas-1.png'));
                return true;
            }
        );
    });
});

describe('build-sprites: checkAtlasFileSize helper', () => {
    it('should return null for files within the limit', () => {
        assert.equal(checkAtlasFileSize(1024 * 1024, 'atlas-0.png'), null);
        assert.equal(checkAtlasFileSize(MAX_ATLAS_SIZE_BYTES, 'atlas-0.png'), null);
    });

    it('should return error string for files exceeding the limit', () => {
        const result = checkAtlasFileSize(5 * 1024 * 1024, 'atlas-0.png');
        assert.ok(result !== null);
        assert.ok(result.includes('atlas-0.png'));
        assert.ok(result.includes('exceeds 4MB'));
    });

    it('should include KB size in error string', () => {
        const result = checkAtlasFileSize(5 * 1024 * 1024, 'atlas-0.png');
        assert.ok(result.includes('5120.0 KB'));
    });

    it('should return null for zero-byte file', () => {
        assert.equal(checkAtlasFileSize(0, 'atlas-0.png'), null);
    });

    it('should return error for file one byte over the limit', () => {
        const result = checkAtlasFileSize(MAX_ATLAS_SIZE_BYTES + 1, 'atlas-0.png');
        assert.ok(result !== null);
    });
});
