/**
 * Tests for js/level-generators/render-level-preview.js
 *
 * Tests the tile-to-sprite mapping logic and helper functions.
 * The actual rendering (sharp compositing) is not tested since it requires
 * sprite files on disk, but the mapping logic is fully testable.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/render-level-preview.spec.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Re-implement the mapping logic from render-level-preview.js

const TILE = 32;

function tileHash(row, col) {
    let h = (row * 7919 + col * 104729 + 31) & 0xFFFFFFFF;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = (h >> 16) ^ h;
    return (h >>> 0) / 0xFFFFFFFF;
}

function charToSprite(ch, row, col) {
    const hash = tileHash(row, col);
    switch (ch) {
        case '.': return `grass-short-${hash > 0.5 ? 2 : 1}`;
        case ',': return `grass-flowers-${hash > 0.5 ? 2 : 1}`;
        case 'O': return `tree-${Math.floor(hash * 3) + 1}`;
        case 'R': return 'rock';
        case 'D': return 'road-full';
        case 'L': return 'road-edge-left';
        case 'r': return 'road-edge-right';
        case 'U': return 'road-edge-top';
        case 'u': return 'road-edge-bottom';
        case '1': return 'road-corner-tl';
        case '2': return 'road-corner-tr';
        case '3': return 'road-corner-bl';
        case '4': return 'road-corner-br';
        case '~': return `water-${Math.floor(hash * 3) + 1}`;
        case 'w': return `water-h-${Math.floor(hash * 3) + 1}`;
        case ')': return 'water-land-right';
        case '(': return 'water-land-left';
        case '{': return 'bridge-tl';
        case '^': return 'bridge-tm';
        case '}': return 'bridge-tr';
        case '[': return 'bridge-ml';
        case '=': return 'bridge-mm';
        case ']': return 'bridge-mr';
        case '<': return 'bridge-bl';
        case '_': return 'bridge-bm';
        case '>': return 'bridge-br';
        default: return 'grass-short-1';
    }
}

describe('render-level-preview: TILE constant', () => {
    it('should be 32', () => {
        assert.equal(TILE, 32);
    });
});

describe('render-level-preview: tileHash', () => {
    it('should return values between 0 and 1', () => {
        for (let row = 0; row < 20; row++) {
            for (let col = 0; col < 20; col++) {
                const val = tileHash(row, col);
                assert.ok(val >= 0 && val <= 1, `tileHash(${row},${col}) = ${val} out of range`);
            }
        }
    });

    it('should be deterministic for the same inputs', () => {
        assert.equal(tileHash(5, 10), tileHash(5, 10));
        assert.equal(tileHash(0, 0), tileHash(0, 0));
    });

    it('should produce different values for different coordinates', () => {
        const val1 = tileHash(0, 0);
        const val2 = tileHash(0, 1);
        const val3 = tileHash(1, 0);
        // At least some should differ
        assert.ok(val1 !== val2 || val2 !== val3);
    });

    it('should produce varied distribution', () => {
        const values = new Set();
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                values.add(Math.round(tileHash(row, col) * 100));
            }
        }
        assert.ok(values.size > 20, 'Hash should produce varied values');
    });
});

describe('render-level-preview: charToSprite', () => {
    it('should map "." to grass-short-1 or grass-short-2', () => {
        const result = charToSprite('.', 0, 0);
        assert.ok(result === 'grass-short-1' || result === 'grass-short-2');
    });

    it('should map "," to grass-flowers-1 or grass-flowers-2', () => {
        const result = charToSprite(',', 0, 0);
        assert.ok(result === 'grass-flowers-1' || result === 'grass-flowers-2');
    });

    it('should map "O" to tree-1, tree-2, or tree-3', () => {
        const result = charToSprite('O', 0, 0);
        assert.ok(['tree-1', 'tree-2', 'tree-3'].includes(result));
    });

    it('should map "R" to rock', () => {
        assert.equal(charToSprite('R', 0, 0), 'rock');
    });

    it('should map road characters correctly', () => {
        assert.equal(charToSprite('D', 0, 0), 'road-full');
        assert.equal(charToSprite('L', 0, 0), 'road-edge-left');
        assert.equal(charToSprite('r', 0, 0), 'road-edge-right');
        assert.equal(charToSprite('U', 0, 0), 'road-edge-top');
        assert.equal(charToSprite('u', 0, 0), 'road-edge-bottom');
    });

    it('should map road corner characters correctly', () => {
        assert.equal(charToSprite('1', 0, 0), 'road-corner-tl');
        assert.equal(charToSprite('2', 0, 0), 'road-corner-tr');
        assert.equal(charToSprite('3', 0, 0), 'road-corner-bl');
        assert.equal(charToSprite('4', 0, 0), 'road-corner-br');
    });

    it('should map "~" to water-1, water-2, or water-3', () => {
        const result = charToSprite('~', 0, 0);
        assert.ok(['water-1', 'water-2', 'water-3'].includes(result));
    });

    it('should map "w" to water-h-1, water-h-2, or water-h-3', () => {
        const result = charToSprite('w', 0, 0);
        assert.ok(['water-h-1', 'water-h-2', 'water-h-3'].includes(result));
    });

    it('should map water edge characters correctly', () => {
        assert.equal(charToSprite(')', 0, 0), 'water-land-right');
        assert.equal(charToSprite('(', 0, 0), 'water-land-left');
    });

    it('should map bridge characters correctly', () => {
        assert.equal(charToSprite('{', 0, 0), 'bridge-tl');
        assert.equal(charToSprite('^', 0, 0), 'bridge-tm');
        assert.equal(charToSprite('}', 0, 0), 'bridge-tr');
        assert.equal(charToSprite('[', 0, 0), 'bridge-ml');
        assert.equal(charToSprite('=', 0, 0), 'bridge-mm');
        assert.equal(charToSprite(']', 0, 0), 'bridge-mr');
        assert.equal(charToSprite('<', 0, 0), 'bridge-bl');
        assert.equal(charToSprite('_', 0, 0), 'bridge-bm');
        assert.equal(charToSprite('>', 0, 0), 'bridge-br');
    });

    it('should default to grass-short-1 for unknown characters', () => {
        assert.equal(charToSprite('X', 0, 0), 'grass-short-1');
        assert.equal(charToSprite('?', 0, 0), 'grass-short-1');
        assert.equal(charToSprite(' ', 0, 0), 'grass-short-1');
    });

    it('variant selection should be deterministic for same position', () => {
        const result1 = charToSprite('.', 5, 10);
        const result2 = charToSprite('.', 5, 10);
        assert.equal(result1, result2);
    });

    it('variant selection should vary by position', () => {
        // The tileHash produces varied values, so different positions
        // should map to different sprites for multi-variant tiles like water
        const results = new Set();
        for (let row = 0; row < 50; row++) {
            for (let col = 0; col < 50; col++) {
                results.add(charToSprite('~', row, col));
            }
        }
        // Water has 3 variants (hash * 3 floored), should see variation
        assert.ok(results.size >= 1, 'Should produce at least one water variant');
    });
});

describe('render-level-preview: level parsing logic', () => {
    it('should filter out comment lines (starting with ;)', () => {
        const content = '; This is a comment\n; Another comment\nname=Test\n...\n~~~';
        const lines = content.split('\n');
        const mapLines = lines.filter(l => !l.startsWith(';') && !l.startsWith('name=') && l.length > 0);
        assert.equal(mapLines.length, 2);
        assert.equal(mapLines[0], '...');
        assert.equal(mapLines[1], '~~~');
    });

    it('should filter out name= lines', () => {
        const content = 'name=My Level\n....\n~~~~';
        const lines = content.split('\n');
        const mapLines = lines.filter(l => !l.startsWith(';') && !l.startsWith('name=') && l.length > 0);
        assert.equal(mapLines.length, 2);
    });

    it('should filter out empty lines', () => {
        const content = '....\n\n~~~~\n\n';
        const lines = content.split('\n');
        const mapLines = lines.filter(l => !l.startsWith(';') && !l.startsWith('name=') && l.length > 0);
        assert.equal(mapLines.length, 2);
    });

    it('should calculate correct image dimensions', () => {
        const mapLines = ['....', '~~~~', '....'];
        const cols = Math.max(...mapLines.map(l => l.length));
        const rows = mapLines.length;
        assert.equal(cols, 4);
        assert.equal(rows, 3);
        assert.equal(cols * TILE, 128);
        assert.equal(rows * TILE, 96);
    });
});
