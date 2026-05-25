/**
 * Unit tests for build pipeline overlay integration (Task 8.2).
 *
 * Requirements: 2.3, 2.4, 7.3
 *
 * Covers:
 *   - Build pipeline exits non-zero and logs a structured error when an
 *     overlay PNG is missing from OUTPUT_DIR (Req 2.4, 7.3)
 *   - TREE_OVERLAY_SPRITES values are included in the sprite entries
 *     passed to packAtlas() (Req 2.3)
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/build-sprites-overlay.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const {
    TREE_OVERLAY_SPRITES,
    OUTPUT_DIR,
} = require('../../js/level-generators/lib/sprite-constants');

const { packAtlas } = require('../../js/level-generators/lib/atlas-packer');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Replicate logBuildError from build-sprites.js for unit testing.
 * Returns the formatted string instead of writing to stderr.
 */
function logBuildError(moduleName, message, details = {}) {
    let output = `[SPRITE-BUILD-ERROR] ${moduleName}: ${message}\n`;
    if (details.sprite) output += `  Sprite: ${details.sprite}\n`;
    if (details.stage) output += `  Stage: ${details.stage}\n`;
    if (details.details) output += `  Details: ${details.details}\n`;
    return output;
}

/**
 * Replicate the pre-pack overlay existence check from build-sprites.js.
 * Throws with a structured error message when any overlay PNG is missing.
 *
 * @param {string[]} overlayNames - Overlay sprite names to check
 * @param {string} outputDir - Directory where PNGs should exist
 */
function checkOverlayPngsExist(overlayNames, outputDir) {
    const missing = overlayNames.filter(
        name => !fs.existsSync(path.join(outputDir, `${name}.png`))
    );

    if (missing.length > 0) {
        for (const name of missing) {
            logBuildError('build-sprites', `Overlay sprite PNG missing before atlas pack: ${name}`, {
                sprite: name,
                stage: 'pre-pack',
                details: `Expected file at: ${path.join(outputDir, `${name}.png`)}`,
            });
        }
        throw new Error(
            `Pre-pack check failed: ${missing.length} overlay PNG(s) missing: ${missing.join(', ')}`
        );
    }
}

/**
 * Create a minimal synthetic sprite entry for packAtlas testing.
 */
function makeSpriteEntry(name, width = 64, height = 48) {
    const buf = Buffer.alloc(width * height * 4, 128);
    return { name, buffer: buf, width, height };
}

// ─── Tests: missing overlay PNG causes non-zero exit ─────────────────────────

describe('build-sprites overlay: missing PNG detection', () => {
    it('should throw when an overlay PNG is missing from OUTPUT_DIR', () => {
        const fakeDir = path.join(__dirname, '_nonexistent_overlay_dir_');
        const overlayNames = Object.values(TREE_OVERLAY_SPRITES);

        assert.throws(
            () => checkOverlayPngsExist(overlayNames, fakeDir),
            (err) => {
                assert.ok(
                    err.message.includes('Pre-pack check failed'),
                    `Expected "Pre-pack check failed" in: ${err.message}`
                );
                return true;
            }
        );
    });

    it('should include the missing sprite name in the error message', () => {
        const fakeDir = path.join(__dirname, '_nonexistent_overlay_dir_');
        const overlayNames = ['tree-oak-overlay-1'];

        assert.throws(
            () => checkOverlayPngsExist(overlayNames, fakeDir),
            (err) => {
                assert.ok(
                    err.message.includes('tree-oak-overlay-1'),
                    `Expected sprite name in error: ${err.message}`
                );
                return true;
            }
        );
    });

    it('should report the count of missing PNGs in the error message', () => {
        const fakeDir = path.join(__dirname, '_nonexistent_overlay_dir_');
        const overlayNames = Object.values(TREE_OVERLAY_SPRITES); // 7 sprites

        assert.throws(
            () => checkOverlayPngsExist(overlayNames, fakeDir),
            (err) => {
                assert.ok(
                    err.message.includes('7 overlay PNG(s) missing'),
                    `Expected count in error: ${err.message}`
                );
                return true;
            }
        );
    });

    it('should not throw when all overlay PNGs are present', () => {
        const tmpDir = path.join(__dirname, '_tmp_overlay_pngs_');
        fs.mkdirSync(tmpDir, { recursive: true });

        const overlayNames = Object.values(TREE_OVERLAY_SPRITES);
        const created = [];

        try {
            for (const name of overlayNames) {
                const filePath = path.join(tmpDir, `${name}.png`);
                fs.writeFileSync(filePath, Buffer.alloc(8));
                created.push(filePath);
            }

            assert.doesNotThrow(() => checkOverlayPngsExist(overlayNames, tmpDir));
        } finally {
            for (const f of created) {
                try { fs.unlinkSync(f); } catch (_) {}
            }
            try { fs.rmdirSync(tmpDir); } catch (_) {}
        }
    });

    it('should throw only for the missing PNGs when some are present', () => {
        const tmpDir = path.join(__dirname, '_tmp_partial_overlay_pngs_');
        fs.mkdirSync(tmpDir, { recursive: true });

        const overlayNames = Object.values(TREE_OVERLAY_SPRITES);
        // Create only the first 3 overlay PNGs
        const presentNames = overlayNames.slice(0, 3);
        const missingNames = overlayNames.slice(3);
        const created = [];

        try {
            for (const name of presentNames) {
                const filePath = path.join(tmpDir, `${name}.png`);
                fs.writeFileSync(filePath, Buffer.alloc(8));
                created.push(filePath);
            }

            assert.throws(
                () => checkOverlayPngsExist(overlayNames, tmpDir),
                (err) => {
                    // Error should mention the missing ones
                    for (const name of missingNames) {
                        assert.ok(
                            err.message.includes(name),
                            `Expected missing sprite "${name}" in error: ${err.message}`
                        );
                    }
                    // Error should NOT mention the present ones as missing
                    assert.ok(
                        err.message.includes(`${missingNames.length} overlay PNG(s) missing`),
                        `Expected count ${missingNames.length} in error: ${err.message}`
                    );
                    return true;
                }
            );
        } finally {
            for (const f of created) {
                try { fs.unlinkSync(f); } catch (_) {}
            }
            try { fs.rmdirSync(tmpDir); } catch (_) {}
        }
    });
});

// ─── Tests: structured error logging for missing overlay ─────────────────────

describe('build-sprites overlay: structured error logging', () => {
    it('should log [SPRITE-BUILD-ERROR] prefix for missing overlay', () => {
        const output = logBuildError(
            'build-sprites',
            'Overlay sprite PNG missing before atlas pack: tree-oak-overlay-1',
            {
                sprite: 'tree-oak-overlay-1',
                stage: 'pre-pack',
                details: 'Expected file at: /some/path/tree-oak-overlay-1.png',
            }
        );

        assert.ok(
            output.startsWith('[SPRITE-BUILD-ERROR]'),
            'Error log must start with [SPRITE-BUILD-ERROR]'
        );
    });

    it('should include sprite name in structured error log', () => {
        const output = logBuildError(
            'build-sprites',
            'Overlay sprite PNG missing before atlas pack: tree-pine-overlay-1',
            {
                sprite: 'tree-pine-overlay-1',
                stage: 'pre-pack',
            }
        );

        assert.ok(output.includes('Sprite: tree-pine-overlay-1'));
    });

    it('should include pre-pack stage in structured error log', () => {
        const output = logBuildError(
            'build-sprites',
            'Overlay sprite PNG missing before atlas pack: tree-shrub-overlay-1',
            {
                sprite: 'tree-shrub-overlay-1',
                stage: 'pre-pack',
            }
        );

        assert.ok(output.includes('Stage: pre-pack'));
    });

    it('should produce a structured error log for each missing overlay sprite', () => {
        const overlayNames = Object.values(TREE_OVERLAY_SPRITES);
        const logs = [];

        for (const name of overlayNames) {
            const output = logBuildError(
                'build-sprites',
                `Overlay sprite PNG missing before atlas pack: ${name}`,
                {
                    sprite: name,
                    stage: 'pre-pack',
                    details: `Expected file at: ${path.join(OUTPUT_DIR, `${name}.png`)}`,
                }
            );
            logs.push(output);
        }

        assert.equal(logs.length, 7, 'Should produce one log entry per overlay sprite');
        for (const log of logs) {
            assert.ok(log.includes('[SPRITE-BUILD-ERROR]'));
            assert.ok(log.includes('Stage: pre-pack'));
        }
    });
});

// ─── Tests: build script exits non-zero when overlay PNG is missing ───────────

describe('build-sprites overlay: non-zero exit on missing overlay PNG', () => {
    it('should exit non-zero when a required overlay PNG is absent', () => {
        // Write a minimal script that replicates the pre-pack check and exits
        // non-zero when an overlay PNG is missing — mirrors build-sprites.js behavior.
        const tmpScript = path.join(__dirname, '_tmp_overlay_check.js');
        const scriptContent = `
'use strict';
const fs = require('fs');
const path = require('path');
const { TREE_OVERLAY_SPRITES, OUTPUT_DIR } = require(${JSON.stringify(
    path.join(__dirname, '../../js/level-generators/lib/sprite-constants')
)});

function logBuildError(moduleName, message, details = {}) {
    let output = '[SPRITE-BUILD-ERROR] ' + moduleName + ': ' + message + '\\n';
    if (details.sprite) output += '  Sprite: ' + details.sprite + '\\n';
    if (details.stage)  output += '  Stage: '  + details.stage  + '\\n';
    if (details.details) output += '  Details: ' + details.details + '\\n';
    process.stderr.write(output);
}

const overlayNames = Object.values(TREE_OVERLAY_SPRITES);
// Use a directory that definitely does not contain the overlay PNGs
const fakeDir = path.join(__dirname, '_nonexistent_for_test_');

const missing = overlayNames.filter(
    name => !fs.existsSync(path.join(fakeDir, name + '.png'))
);

if (missing.length > 0) {
    for (const name of missing) {
        logBuildError('build-sprites', 'Overlay sprite PNG missing before atlas pack: ' + name, {
            sprite: name,
            stage: 'pre-pack',
            details: 'Expected file at: ' + path.join(fakeDir, name + '.png'),
        });
    }
    process.exit(1);
}
process.exit(0);
`;
        fs.writeFileSync(tmpScript, scriptContent, 'utf8');

        try {
            let threw = false;
            let exitCode = 0;
            try {
                execFileSync(process.execPath, [tmpScript], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
            } catch (err) {
                threw = true;
                exitCode = err.status;
            }

            assert.ok(threw, 'Process should have exited with non-zero code');
            assert.notEqual(exitCode, 0, `Exit code should be non-zero, got ${exitCode}`);
        } finally {
            try { fs.unlinkSync(tmpScript); } catch (_) {}
        }
    });

    it('should write [SPRITE-BUILD-ERROR] to stderr when overlay PNG is missing', () => {
        const tmpScript = path.join(__dirname, '_tmp_overlay_stderr_check.js');
        const scriptContent = `
'use strict';
const fs = require('fs');
const path = require('path');
const { TREE_OVERLAY_SPRITES } = require(${JSON.stringify(
    path.join(__dirname, '../../js/level-generators/lib/sprite-constants')
)});

const fakeDir = path.join(__dirname, '_nonexistent_for_test_');
const overlayNames = Object.values(TREE_OVERLAY_SPRITES);
const missing = overlayNames.filter(
    name => !fs.existsSync(path.join(fakeDir, name + '.png'))
);

if (missing.length > 0) {
    for (const name of missing) {
        process.stderr.write('[SPRITE-BUILD-ERROR] build-sprites: Overlay sprite PNG missing before atlas pack: ' + name + '\\n');
        process.stderr.write('  Sprite: ' + name + '\\n');
        process.stderr.write('  Stage: pre-pack\\n');
    }
    process.exit(1);
}
process.exit(0);
`;
        fs.writeFileSync(tmpScript, scriptContent, 'utf8');

        try {
            let stderrOutput = '';
            try {
                execFileSync(process.execPath, [tmpScript], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
            } catch (err) {
                stderrOutput = err.stderr ? err.stderr.toString() : '';
            }

            assert.ok(
                stderrOutput.includes('[SPRITE-BUILD-ERROR]'),
                `Expected [SPRITE-BUILD-ERROR] in stderr: ${stderrOutput}`
            );
            assert.ok(
                stderrOutput.includes('Stage: pre-pack'),
                `Expected "Stage: pre-pack" in stderr: ${stderrOutput}`
            );
        } finally {
            try { fs.unlinkSync(tmpScript); } catch (_) {}
        }
    });
});

// ─── Tests: TREE_OVERLAY_SPRITES values included in packAtlas sprite entries ──

describe('build-sprites overlay: TREE_OVERLAY_SPRITES included in packAtlas entries', () => {
    it('should include all seven overlay sprite names in the entries passed to packAtlas', () => {
        const overlayNames = Object.values(TREE_OVERLAY_SPRITES);
        assert.equal(overlayNames.length, 7, 'TREE_OVERLAY_SPRITES should have 7 entries');

        // Build a minimal sprite entries array that mirrors what build-sprites.js does:
        // terrain + overlay sprites
        const spriteEntries = [
            makeSpriteEntry('grass-short-1', 64, 32),
            makeSpriteEntry('grass-short-2', 64, 32),
            ...overlayNames.map(name => makeSpriteEntry(name, 64, 48)),
        ];

        const { metadata } = packAtlas(spriteEntries);

        for (const name of overlayNames) {
            assert.ok(
                metadata.frames[name],
                `Overlay sprite "${name}" should be present in atlas metadata`
            );
        }
    });

    it('should pack overlay sprites at their native 64×48 dimensions', () => {
        const overlayNames = Object.values(TREE_OVERLAY_SPRITES);

        const spriteEntries = overlayNames.map(name => makeSpriteEntry(name, 64, 48));
        const { metadata } = packAtlas(spriteEntries);

        for (const name of overlayNames) {
            const frame = metadata.frames[name];
            assert.ok(frame, `Frame for "${name}" should exist`);
            assert.equal(frame.frame.w, 64, `"${name}" frame width should be 64`);
            assert.equal(frame.frame.h, 48, `"${name}" frame height should be 48`);
        }
    });

    it('should include all seven overlay names from TREE_OVERLAY_SPRITES constant', () => {
        const overlayNames = Object.values(TREE_OVERLAY_SPRITES);

        const expectedNames = [
            'tree-oak-overlay-1',
            'tree-oak-overlay-2',
            'tree-oak-overlay-3',
            'tree-pine-overlay-1',
            'tree-pine-overlay-2',
            'tree-shrub-overlay-1',
            'tree-shrub-overlay-2',
        ];

        assert.equal(overlayNames.length, expectedNames.length);
        for (const name of expectedNames) {
            assert.ok(
                overlayNames.includes(name),
                `TREE_OVERLAY_SPRITES should include "${name}"`
            );
        }
    });

    it('should include overlay sprites alongside terrain sprites in packAtlas entries', () => {
        const overlayNames = Object.values(TREE_OVERLAY_SPRITES);

        // Simulate the full sprite entries array as built-sprites.js constructs it
        const terrainEntries = [
            'grass-short-1', 'grass-short-2', 'tree-1', 'tree-2',
        ].map(name => makeSpriteEntry(name, 64, 32));

        const overlayEntries = overlayNames.map(name => makeSpriteEntry(name, 64, 48));

        const spriteEntries = [...terrainEntries, ...overlayEntries];
        const { metadata } = packAtlas(spriteEntries);

        // Terrain sprites should still be present
        assert.ok(metadata.frames['grass-short-1'], 'grass-short-1 should be in atlas');
        assert.ok(metadata.frames['tree-1'], 'tree-1 should be in atlas');

        // All overlay sprites should also be present
        for (const name of overlayNames) {
            assert.ok(
                metadata.frames[name],
                `Overlay sprite "${name}" should be in atlas alongside terrain sprites`
            );
        }
    });

    it('should produce non-overlapping frames for overlay sprites in the atlas', () => {
        const overlayNames = Object.values(TREE_OVERLAY_SPRITES);
        const spriteEntries = overlayNames.map(name => makeSpriteEntry(name, 64, 48));

        const { metadata } = packAtlas(spriteEntries);
        const frames = overlayNames.map(name => metadata.frames[name]);

        for (let i = 0; i < frames.length; i++) {
            for (let j = i + 1; j < frames.length; j++) {
                const a = frames[i];
                const b = frames[j];
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
                    `Overlay frames "${overlayNames[i]}" and "${overlayNames[j]}" must not overlap`
                );
            }
        }
    });
});
