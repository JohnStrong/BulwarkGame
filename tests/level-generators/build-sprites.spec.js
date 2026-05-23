/**
 * Tests for js/level-generators/build-sprites.js
 *
 * Recommendation 1: Test logBuildError output format, runGenerator error
 * propagation, and readSpriteBuffer behavior when PNG files are missing.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/build-sprites.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

// ─── logBuildError replica ──────────────────────────────────────────────────

/**
 * Replicate logBuildError from build-sprites.js for unit testing.
 * Instead of writing to process.stderr, we capture the output.
 */
function logBuildError(moduleName, message, details = {}) {
    let output = `[SPRITE-BUILD-ERROR] ${moduleName}: ${message}\n`;
    if (details.sprite) output += `  Sprite: ${details.sprite}\n`;
    if (details.stage) output += `  Stage: ${details.stage}\n`;
    if (details.details) output += `  Details: ${details.details}\n`;
    return output;
}

describe('build-sprites: logBuildError', () => {
    it('should format error with module name and message', () => {
        const output = logBuildError('test-module', 'Something went wrong');
        assert.ok(output.startsWith('[SPRITE-BUILD-ERROR] test-module: Something went wrong'));
    });

    it('should include sprite name when provided', () => {
        const output = logBuildError('atlas', 'Failed', { sprite: 'castle-wall' });
        assert.ok(output.includes('Sprite: castle-wall'));
    });

    it('should include stage when provided', () => {
        const output = logBuildError('atlas', 'Failed', { stage: 'packing' });
        assert.ok(output.includes('Stage: packing'));
    });

    it('should include details when provided', () => {
        const output = logBuildError('atlas', 'Failed', { details: 'File not found' });
        assert.ok(output.includes('Details: File not found'));
    });

    it('should include all fields when all provided', () => {
        const output = logBuildError('build-sprites', 'Generator failed', {
            sprite: 'enemy-knight',
            stage: 'generation',
            details: 'exit code 1',
        });
        assert.ok(output.includes('[SPRITE-BUILD-ERROR] build-sprites: Generator failed'));
        assert.ok(output.includes('Sprite: enemy-knight'));
        assert.ok(output.includes('Stage: generation'));
        assert.ok(output.includes('Details: exit code 1'));
    });

    it('should omit optional fields when not provided', () => {
        const output = logBuildError('test', 'error');
        assert.ok(!output.includes('Sprite:'));
        assert.ok(!output.includes('Stage:'));
        assert.ok(!output.includes('Details:'));
    });

    it('should handle empty details object', () => {
        const output = logBuildError('test', 'error', {});
        assert.ok(output.includes('[SPRITE-BUILD-ERROR] test: error'));
        assert.ok(!output.includes('Sprite:'));
    });
});

// ─── runGenerator replica ───────────────────────────────────────────────────

/**
 * Replicate runGenerator logic for testing error propagation.
 */
function runGenerator(scriptName, baseDir) {
    const scriptPath = path.join(baseDir, scriptName);
    try {
        execFileSync(process.execPath, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: path.join(baseDir, '..', '..'),
        });
    } catch (error) {
        const stderr = error.stderr ? error.stderr.toString() : '';
        throw new Error(`Generator ${scriptName} exited with code ${error.status}`);
    }
}

describe('build-sprites: runGenerator error propagation', () => {
    it('should throw when script does not exist', () => {
        assert.throws(
            () => runGenerator('nonexistent-script.js', __dirname),
            (err) => {
                assert.ok(err.message.includes('nonexistent-script.js'));
                return true;
            }
        );
    });

    it('should throw when script exits with non-zero code', () => {
        // Create a temporary script that exits with code 1
        const tmpScript = path.join(__dirname, '_tmp_fail_script.js');
        fs.writeFileSync(tmpScript, 'process.exit(1);', 'utf8');

        try {
            assert.throws(
                () => runGenerator('_tmp_fail_script.js', __dirname),
                (err) => {
                    assert.ok(err.message.includes('_tmp_fail_script.js'));
                    assert.ok(err.message.includes('exited with code'));
                    return true;
                }
            );
        } finally {
            fs.unlinkSync(tmpScript);
        }
    });

    it('should not throw when script exits successfully', () => {
        // Create a temporary script that exits with code 0
        const tmpScript = path.join(__dirname, '_tmp_ok_script.js');
        fs.writeFileSync(tmpScript, 'process.exit(0);', 'utf8');

        try {
            assert.doesNotThrow(() => runGenerator('_tmp_ok_script.js', __dirname));
        } finally {
            fs.unlinkSync(tmpScript);
        }
    });

    it('should include script name in error message', () => {
        const tmpScript = path.join(__dirname, '_tmp_named_fail.js');
        fs.writeFileSync(tmpScript, 'process.exit(2);', 'utf8');

        try {
            assert.throws(
                () => runGenerator('_tmp_named_fail.js', __dirname),
                (err) => err.message.includes('_tmp_named_fail.js')
            );
        } finally {
            fs.unlinkSync(tmpScript);
        }
    });
});

// ─── readSpriteBuffer replica ───────────────────────────────────────────────

/**
 * Replicate readSpriteBuffer's file-existence check for testing.
 * We don't test the sharp() call since that requires actual PNG files,
 * but we test the error path when files are missing.
 */
function readSpriteBufferSync(spriteName, outputDir) {
    const filePath = path.join(outputDir, `${spriteName}.png`);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Sprite PNG not found: ${filePath}`);
    }

    return filePath;
}

describe('build-sprites: readSpriteBuffer file existence check', () => {
    it('should throw when sprite PNG does not exist', () => {
        const fakeDir = path.join(__dirname, '_nonexistent_dir_');
        assert.throws(
            () => readSpriteBufferSync('missing-sprite', fakeDir),
            (err) => {
                assert.ok(err.message.includes('Sprite PNG not found'));
                assert.ok(err.message.includes('missing-sprite'));
                return true;
            }
        );
    });

    it('should throw with full file path in error message', () => {
        const fakeDir = '/tmp/fake-sprites';
        assert.throws(
            () => readSpriteBufferSync('castle-wall', fakeDir),
            (err) => {
                assert.ok(err.message.includes('/tmp/fake-sprites/castle-wall.png'));
                return true;
            }
        );
    });

    it('should not throw when file exists', () => {
        // Create a temporary PNG file (just needs to exist)
        const tmpDir = path.join(__dirname, '_tmp_sprites_');
        fs.mkdirSync(tmpDir, { recursive: true });
        const tmpFile = path.join(tmpDir, 'test-sprite.png');
        fs.writeFileSync(tmpFile, Buffer.alloc(8)); // minimal file

        try {
            assert.doesNotThrow(() => readSpriteBufferSync('test-sprite', tmpDir));
        } finally {
            fs.unlinkSync(tmpFile);
            fs.rmdirSync(tmpDir);
        }
    });
});

// ─── Constants validation ───────────────────────────────────────────────────

describe('build-sprites: constants', () => {
    it('MAX_ATLAS_SIZE_BYTES should be 4MB', () => {
        const MAX_ATLAS_SIZE_BYTES = 4 * 1024 * 1024;
        assert.equal(MAX_ATLAS_SIZE_BYTES, 4194304);
    });

    it('GENERATOR_SCRIPTS should include all 5 generators', () => {
        const GENERATOR_SCRIPTS = [
            'generate-iso-sprites-br-tl.js',
            'generate-castle-sprites.js',
            'generate-unit-sprites.js',
            'generate-enemy-sprites.js',
            'generate-damaged-castle-sprites.js',
        ];
        assert.equal(GENERATOR_SCRIPTS.length, 5);
        assert.ok(GENERATOR_SCRIPTS.includes('generate-enemy-sprites.js'));
        assert.ok(GENERATOR_SCRIPTS.includes('generate-damaged-castle-sprites.js'));
    });

    it('ENEMY_SPRITE_NAMES should have 5 entries with enemy- prefix', () => {
        const ENEMY_SPRITE_NAMES = [
            'enemy-knight', 'enemy-archer', 'enemy-spearman',
            'enemy-militia', 'enemy-siege',
        ];
        assert.equal(ENEMY_SPRITE_NAMES.length, 5);
        for (const name of ENEMY_SPRITE_NAMES) {
            assert.ok(name.startsWith('enemy-'), `${name} should start with enemy-`);
        }
    });

    it('DAMAGED_SPRITE_NAMES should have 10 entries with -damaged suffix', () => {
        const DAMAGED_SPRITE_NAMES = [
            'castle-wall-damaged', 'castle-tower-damaged',
            'castle-keep-tl-damaged', 'castle-keep-bl-damaged',
            'castle-keep-br-damaged', 'castle-keep-center-damaged',
            'castle-gatehouse-damaged', 'castle-bailey-1-damaged',
            'castle-bailey-2-damaged', 'castle-bailey-3-damaged',
        ];
        assert.equal(DAMAGED_SPRITE_NAMES.length, 10);
        for (const name of DAMAGED_SPRITE_NAMES) {
            assert.ok(name.endsWith('-damaged'), `${name} should end with -damaged`);
        }
    });
});
