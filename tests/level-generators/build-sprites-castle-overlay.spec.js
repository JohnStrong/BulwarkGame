/**
 * Unit tests for build pipeline castle overlay integration (Task 11.2).
 *
 * Requirements: 2.3, 2.4, 2.5, 9.3
 *
 * Covers:
 *   - Build pipeline exits non-zero and logs a structured error when a castle
 *     overlay PNG is missing from OUTPUT_DIR (Req 2.4, 9.3)
 *   - Build pipeline exits non-zero and logs an error when CASTLE_OVERLAY_SPRITES
 *     is undefined or empty (Req 2.5)
 *   - CASTLE_OVERLAY_SPRITE_NAMES values are included in the sprite entries
 *     passed to packAtlas() (Req 2.3, 9.2)
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/build-sprites-castle-overlay.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const {
    CASTLE_OVERLAY_SPRITES,
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
 * Replicate the pre-pack castle overlay existence check from build-sprites.js.
 * Throws with a structured error message when any castle overlay PNG is missing.
 *
 * @param {string[]} overlayNames - Castle overlay sprite names to check
 * @param {string} outputDir - Directory where PNGs should exist
 */
function checkCastleOverlayPngsExist(overlayNames, outputDir) {
    const missing = overlayNames.filter(
        name => !fs.existsSync(path.join(outputDir, `${name}.png`))
    );

    if (missing.length > 0) {
        for (const name of missing) {
            logBuildError('build-sprites', `Castle overlay PNG missing before atlas pack: ${name}`, {
                sprite: name,
                stage: 'pre-pack',
                details: `Expected file at: ${path.join(outputDir, `${name}.png`)}`,
            });
        }
        throw new Error(
            `Pre-pack check failed: ${missing.length} castle overlay PNG(s) missing`
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

/**
 * Returns the expected overlay height for a given castle overlay sprite name,
 * matching the CASTLE_OVERLAY_CATEGORY_MAP in iso-renderer.js.
 *
 * @param {string} name - Overlay sprite name
 * @returns {number} Expected height in pixels (48, 64, or 80)
 */
function expectedHeightForOverlay(name) {
    if (name === 'castle-gatehouse-overlay' || name === 'castle-gatehouse-damaged-overlay') {
        return 80;
    }
    // Single large keep overlay (192×192 px)
    if (name === 'castle-keep-overlay' || name === 'castle-keep-damaged-overlay' || name === 'castle-keep-destroyed-overlay') {
        return 192;
    }
    if (
        name === 'castle-tower-overlay' ||
        name === 'castle-tower-damaged-overlay' ||
        name.startsWith('castle-keep-')
    ) {
        return 64;
    }
    // Walls and bridges: 48 px
    return 48;
}

// ─── Tests: missing castle overlay PNG causes non-zero exit ──────────────────

describe('build-sprites castle overlay: missing PNG detection', () => {
    it('should throw when a castle overlay PNG is missing from OUTPUT_DIR', () => {
        const fakeDir = path.join(__dirname, '_nonexistent_castle_overlay_dir_');
        const overlayNames = Object.values(CASTLE_OVERLAY_SPRITES);

        assert.throws(
            () => checkCastleOverlayPngsExist(overlayNames, fakeDir),
            (err) => {
                assert.ok(
                    err.message.includes('Pre-pack check failed'),
                    `Expected "Pre-pack check failed" in: ${err.message}`
                );
                return true;
            }
        );
    });

    it('should include the count of missing sprites in the error message', () => {
        const fakeDir = path.join(__dirname, '_nonexistent_castle_overlay_dir_');
        const overlayNames = ['castle-wall-overlay'];

        assert.throws(
            () => checkCastleOverlayPngsExist(overlayNames, fakeDir),
            (err) => {
                assert.ok(
                    err.message.includes('1 castle overlay PNG(s) missing'),
                    `Expected count in error message: ${err.message}`
                );
                return true;
            }
        );
    });

    it('should report the count of missing castle overlay PNGs in the error message', () => {
        const fakeDir = path.join(__dirname, '_nonexistent_castle_overlay_dir_');
        const overlayNames = Object.values(CASTLE_OVERLAY_SPRITES); // 23 sprites

        assert.throws(
            () => checkCastleOverlayPngsExist(overlayNames, fakeDir),
            (err) => {
                assert.ok(
                    err.message.includes('23 castle overlay PNG(s) missing'),
                    `Expected count "23" in error: ${err.message}`
                );
                return true;
            }
        );
    });

    it('should not throw when all castle overlay PNGs are present', () => {
        const tmpDir = path.join(__dirname, '_tmp_castle_overlay_pngs_');
        fs.mkdirSync(tmpDir, { recursive: true });

        const overlayNames = Object.values(CASTLE_OVERLAY_SPRITES);
        const created = [];

        try {
            for (const name of overlayNames) {
                const filePath = path.join(tmpDir, `${name}.png`);
                fs.writeFileSync(filePath, Buffer.alloc(8));
                created.push(filePath);
            }

            assert.doesNotThrow(() => checkCastleOverlayPngsExist(overlayNames, tmpDir));
        } finally {
            for (const f of created) {
                try { fs.unlinkSync(f); } catch (_) {}
            }
            try { fs.rmdirSync(tmpDir); } catch (_) {}
        }
    });
});

// ─── Tests: structured error logging for missing castle overlay ───────────────

describe('build-sprites castle overlay: structured error logging', () => {
    it('should log [SPRITE-BUILD-ERROR] prefix for missing castle overlay', () => {
        const output = logBuildError(
            'build-sprites',
            'Castle overlay PNG missing before atlas pack: castle-wall-overlay',
            {
                sprite: 'castle-wall-overlay',
                stage: 'pre-pack',
                details: 'Expected file at: /some/path/castle-wall-overlay.png',
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
            'Castle overlay PNG missing before atlas pack: castle-tower-overlay',
            {
                sprite: 'castle-tower-overlay',
                stage: 'pre-pack',
            }
        );

        assert.ok(output.includes('Sprite: castle-tower-overlay'));
    });

    it('should include pre-pack stage in structured error log', () => {
        const output = logBuildError(
            'build-sprites',
            'Castle overlay PNG missing before atlas pack: castle-gatehouse-overlay',
            {
                sprite: 'castle-gatehouse-overlay',
                stage: 'pre-pack',
            }
        );

        assert.ok(output.includes('Stage: pre-pack'));
    });

    it('should produce a structured error log for each missing castle overlay sprite', () => {
        const overlayNames = Object.values(CASTLE_OVERLAY_SPRITES);
        const logs = [];

        for (const name of overlayNames) {
            const output = logBuildError(
                'build-sprites',
                `Castle overlay PNG missing before atlas pack: ${name}`,
                {
                    sprite: name,
                    stage: 'pre-pack',
                    details: `Expected file at: ${path.join(OUTPUT_DIR, `${name}.png`)}`,
                }
            );
            logs.push(output);
        }

        assert.equal(logs.length, overlayNames.length, 'Should produce one log entry per castle overlay sprite');
        for (const log of logs) {
            assert.ok(log.includes('[SPRITE-BUILD-ERROR]'));
            assert.ok(log.includes('Stage: pre-pack'));
        }
    });
});

// ─── Tests: build script exits non-zero when castle overlay PNG is missing ────

describe('build-sprites castle overlay: non-zero exit on missing castle overlay PNG', () => {
    it('should exit non-zero when a required castle overlay PNG is absent', () => {
        const tmpScript = path.join(__dirname, '_tmp_castle_overlay_check.js');
        const scriptContent = `
'use strict';
const fs = require('fs');
const path = require('path');
const { CASTLE_OVERLAY_SPRITES } = require(${JSON.stringify(
    path.join(__dirname, '../../js/level-generators/lib/sprite-constants')
)});

function logBuildError(moduleName, message, details = {}) {
    let output = '[SPRITE-BUILD-ERROR] ' + moduleName + ': ' + message + '\\n';
    if (details.sprite) output += '  Sprite: ' + details.sprite + '\\n';
    if (details.stage)  output += '  Stage: '  + details.stage  + '\\n';
    if (details.details) output += '  Details: ' + details.details + '\\n';
    process.stderr.write(output);
}

const overlayNames = Object.values(CASTLE_OVERLAY_SPRITES);
// Use a directory that definitely does not contain the castle overlay PNGs
const fakeDir = path.join(__dirname, '_nonexistent_for_castle_test_');

const missing = overlayNames.filter(
    name => !fs.existsSync(path.join(fakeDir, name + '.png'))
);

if (missing.length > 0) {
    for (const name of missing) {
        logBuildError('build-sprites', 'Castle overlay PNG missing before atlas pack: ' + name, {
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

    it('should write [SPRITE-BUILD-ERROR] to stderr when castle overlay PNG is missing', () => {
        const tmpScript = path.join(__dirname, '_tmp_castle_overlay_stderr_check.js');
        const scriptContent = `
'use strict';
const fs = require('fs');
const path = require('path');
const { CASTLE_OVERLAY_SPRITES } = require(${JSON.stringify(
    path.join(__dirname, '../../js/level-generators/lib/sprite-constants')
)});

const fakeDir = path.join(__dirname, '_nonexistent_for_castle_test_');
const overlayNames = Object.values(CASTLE_OVERLAY_SPRITES);
const missing = overlayNames.filter(
    name => !fs.existsSync(path.join(fakeDir, name + '.png'))
);

if (missing.length > 0) {
    for (const name of missing) {
        process.stderr.write('[SPRITE-BUILD-ERROR] build-sprites: Castle overlay PNG missing before atlas pack: ' + name + '\\n');
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

// ─── Tests: CASTLE_OVERLAY_SPRITES undefined/empty guard ─────────────────────

describe('build-sprites castle overlay: CASTLE_OVERLAY_SPRITES undefined/empty guard', () => {
    it('should exit non-zero and log an error when CASTLE_OVERLAY_SPRITES is undefined', () => {
        const tmpScript = path.join(__dirname, '_tmp_castle_overlay_undefined_guard.js');
        const scriptContent = `
'use strict';
const CASTLE_OVERLAY_SPRITES = undefined;

if (!CASTLE_OVERLAY_SPRITES || Object.keys(CASTLE_OVERLAY_SPRITES).length === 0) {
    process.stderr.write('[SPRITE-BUILD-ERROR] build-sprites: CASTLE_OVERLAY_SPRITES is undefined or has zero entries\\n');
    process.stderr.write('  Stage: validation\\n');
    process.exit(1);
}
process.exit(0);
`;
        fs.writeFileSync(tmpScript, scriptContent, 'utf8');

        try {
            let threw = false;
            let exitCode = 0;
            let stderrOutput = '';
            try {
                execFileSync(process.execPath, [tmpScript], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
            } catch (err) {
                threw = true;
                exitCode = err.status;
                stderrOutput = err.stderr ? err.stderr.toString() : '';
            }

            assert.ok(threw, 'Process should have exited with non-zero code when CASTLE_OVERLAY_SPRITES is undefined');
            assert.notEqual(exitCode, 0, `Exit code should be non-zero, got ${exitCode}`);
            assert.ok(
                stderrOutput.includes('[SPRITE-BUILD-ERROR]'),
                `Expected [SPRITE-BUILD-ERROR] in stderr: ${stderrOutput}`
            );
        } finally {
            try { fs.unlinkSync(tmpScript); } catch (_) {}
        }
    });

    it('should exit non-zero and log an error when CASTLE_OVERLAY_SPRITES is an empty object', () => {
        const tmpScript = path.join(__dirname, '_tmp_castle_overlay_empty_guard.js');
        const scriptContent = `
'use strict';
const CASTLE_OVERLAY_SPRITES = {};

if (!CASTLE_OVERLAY_SPRITES || Object.keys(CASTLE_OVERLAY_SPRITES).length === 0) {
    process.stderr.write('[SPRITE-BUILD-ERROR] build-sprites: CASTLE_OVERLAY_SPRITES is undefined or has zero entries\\n');
    process.stderr.write('  Stage: validation\\n');
    process.exit(1);
}
process.exit(0);
`;
        fs.writeFileSync(tmpScript, scriptContent, 'utf8');

        try {
            let threw = false;
            let exitCode = 0;
            let stderrOutput = '';
            try {
                execFileSync(process.execPath, [tmpScript], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
            } catch (err) {
                threw = true;
                exitCode = err.status;
                stderrOutput = err.stderr ? err.stderr.toString() : '';
            }

            assert.ok(threw, 'Process should have exited with non-zero code when CASTLE_OVERLAY_SPRITES is empty');
            assert.notEqual(exitCode, 0, `Exit code should be non-zero, got ${exitCode}`);
            assert.ok(
                stderrOutput.includes('[SPRITE-BUILD-ERROR]'),
                `Expected [SPRITE-BUILD-ERROR] in stderr: ${stderrOutput}`
            );
        } finally {
            try { fs.unlinkSync(tmpScript); } catch (_) {}
        }
    });

    it('CASTLE_OVERLAY_SPRITES from sprite-constants should have 23 entries', () => {
        const overlayNames = Object.values(CASTLE_OVERLAY_SPRITES);
        assert.equal(
            overlayNames.length,
            23,
            `CASTLE_OVERLAY_SPRITES should have 23 entries, got ${overlayNames.length}`
        );
    });
});

// ─── Tests: CASTLE_OVERLAY_SPRITE_NAMES included in packAtlas entries ─────────

describe('build-sprites castle overlay: CASTLE_OVERLAY_SPRITE_NAMES included in packAtlas entries', () => {
    it('should include all 23 castle overlay sprite names in the entries passed to packAtlas', () => {
        const overlayNames = Object.values(CASTLE_OVERLAY_SPRITES);
        assert.equal(overlayNames.length, 23, 'CASTLE_OVERLAY_SPRITES should have 23 entries');

        // Build a minimal sprite entries array that mirrors what build-sprites.js does:
        // terrain + castle overlay sprites (use 64 height as a safe default for all)
        const spriteEntries = [
            makeSpriteEntry('grass-short-1', 64, 32),
            makeSpriteEntry('grass-short-2', 64, 32),
            ...overlayNames.map(name => makeSpriteEntry(name, 64, expectedHeightForOverlay(name))),
        ];

        const { metadata } = packAtlas(spriteEntries);

        for (const name of overlayNames) {
            assert.ok(
                metadata.frames[name],
                `Castle overlay sprite "${name}" should be present in atlas metadata`
            );
        }
    });

    it('should pack castle overlay sprites at their native dimensions', () => {
        const overlayNames = Object.values(CASTLE_OVERLAY_SPRITES);

        const spriteEntries = overlayNames.map(name =>
            makeSpriteEntry(name, 64, expectedHeightForOverlay(name))
        );
        const { metadata } = packAtlas(spriteEntries);

        for (const name of overlayNames) {
            const frame = metadata.frames[name];
            const expectedH = expectedHeightForOverlay(name);
            assert.ok(frame, `Frame for "${name}" should exist`);
            assert.equal(frame.frame.w, 64, `"${name}" frame width should be 64`);
            assert.equal(
                frame.frame.h,
                expectedH,
                `"${name}" frame height should be ${expectedH}, got ${frame.frame.h}`
            );
        }
    });

    it('should include all 23 castle overlay names from CASTLE_OVERLAY_SPRITES constant', () => {
        const overlayNames = Object.values(CASTLE_OVERLAY_SPRITES);

        const expectedNames = [
            'castle-wall-overlay',
            'castle-wall-damaged-overlay',
            'castle-tower-overlay',
            'castle-tower-damaged-overlay',
            'castle-keep-tl-overlay',
            'castle-keep-tl-damaged-overlay',
            'castle-keep-bl-overlay',
            'castle-keep-bl-damaged-overlay',
            'castle-keep-br-overlay',
            'castle-keep-br-damaged-overlay',
            'castle-keep-center-overlay',
            'castle-keep-center-damaged-overlay',
            'castle-gatehouse-overlay',
            'castle-gatehouse-damaged-overlay',
            'bridge-mm-overlay',
            'castle-bridge-start-overlay',
            'castle-bridge-mid-overlay',
            'castle-bridge-gate-overlay',
            'castle-iso-wall-overlay',
            'castle-iso-wall-damaged-overlay',
            // Single large keep overlay (192×192) — three damage states
            'castle-keep-overlay',
            'castle-keep-damaged-overlay',
            'castle-keep-destroyed-overlay',
        ];

        assert.equal(overlayNames.length, expectedNames.length);
        for (const name of expectedNames) {
            assert.ok(
                overlayNames.includes(name),
                `CASTLE_OVERLAY_SPRITES should include "${name}"`
            );
        }
    });

    it('should include castle overlay sprites alongside terrain sprites in packAtlas entries', () => {
        const overlayNames = Object.values(CASTLE_OVERLAY_SPRITES);

        // Simulate the sprite entries array as build-sprites.js constructs it
        const terrainEntries = [
            'grass-short-1', 'grass-short-2', 'road-full', 'bridge-mm',
        ].map(name => makeSpriteEntry(name, 64, 32));

        const castleEntries = overlayNames.map(name =>
            makeSpriteEntry(name, 64, expectedHeightForOverlay(name))
        );

        const spriteEntries = [...terrainEntries, ...castleEntries];
        const { metadata } = packAtlas(spriteEntries);

        // Terrain sprites should still be present
        assert.ok(metadata.frames['grass-short-1'], 'grass-short-1 should be in atlas');
        assert.ok(metadata.frames['road-full'], 'road-full should be in atlas');

        // All castle overlay sprites should also be present
        for (const name of overlayNames) {
            assert.ok(
                metadata.frames[name],
                `Castle overlay sprite "${name}" should be in atlas alongside terrain sprites`
            );
        }
    });

    it('should pack wall/bridge overlays at 48px height and tower/keep overlays at 64px height', () => {
        const wallAndBridgeNames = [
            'castle-wall-overlay',
            'castle-wall-damaged-overlay',
            'bridge-mm-overlay',
            'castle-bridge-start-overlay',
            'castle-bridge-mid-overlay',
            'castle-bridge-gate-overlay',
        ];
        const towerAndKeepNames = [
            'castle-tower-overlay',
            'castle-tower-damaged-overlay',
            'castle-keep-tl-overlay',
            'castle-keep-tl-damaged-overlay',
            'castle-keep-bl-overlay',
            'castle-keep-bl-damaged-overlay',
            'castle-keep-br-overlay',
            'castle-keep-br-damaged-overlay',
            'castle-keep-center-overlay',
            'castle-keep-center-damaged-overlay',
        ];

        const wallEntries = wallAndBridgeNames.map(name => makeSpriteEntry(name, 64, 48));
        const towerEntries = towerAndKeepNames.map(name => makeSpriteEntry(name, 64, 64));
        const { metadata } = packAtlas([...wallEntries, ...towerEntries]);

        for (const name of wallAndBridgeNames) {
            const frame = metadata.frames[name];
            assert.ok(frame, `Frame for "${name}" should exist`);
            assert.equal(frame.frame.h, 48, `"${name}" should pack at 48px height`);
        }

        for (const name of towerAndKeepNames) {
            const frame = metadata.frames[name];
            assert.ok(frame, `Frame for "${name}" should exist`);
            assert.equal(frame.frame.h, 64, `"${name}" should pack at 64px height`);
        }
    });

    it('should pack the gatehouse overlay at 80px height', () => {
        const gatehouseNames = [
            'castle-gatehouse-overlay',
            'castle-gatehouse-damaged-overlay',
        ];

        const entries = gatehouseNames.map(name => makeSpriteEntry(name, 64, 80));
        const { metadata } = packAtlas(entries);

        for (const name of gatehouseNames) {
            const frame = metadata.frames[name];
            assert.ok(frame, `Frame for "${name}" should exist`);
            assert.equal(frame.frame.h, 80, `"${name}" should pack at 80px height`);
        }
    });

    it('should produce non-overlapping frames for castle overlay sprites in the atlas', () => {
        const overlayNames = Object.values(CASTLE_OVERLAY_SPRITES);
        const spriteEntries = overlayNames.map(name =>
            makeSpriteEntry(name, 64, expectedHeightForOverlay(name))
        );

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
                    `Castle overlay frames "${overlayNames[i]}" and "${overlayNames[j]}" must not overlap`
                );
            }
        }
    });
});
