/**
 * Render a level to a PNG image for documentation.
 * Uses the same sprites as the game to produce a pixel-accurate preview.
 *
 * Usage: node render-level-preview.js [level-file] [output-file]
 * Default: levels/level1.txt → docs/level1-preview.png
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const TILE = 32;
const SPRITES_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

// Tile → sprite mapping (simplified version of level-loader logic)
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

async function renderLevel(levelFile, outputFile) {
    const content = fs.readFileSync(levelFile, 'utf8');
    const lines = content.split('\n');
    const mapLines = lines.filter(l => !l.startsWith(';') && !l.startsWith('name=') && l.length > 0);

    const cols = Math.max(...mapLines.map(l => l.length));
    const rows = mapLines.length;
    const width = cols * TILE;
    const height = rows * TILE;

    console.log(`Rendering ${cols}x${rows} tiles (${width}x${height}px)...`);

    // Load all unique sprites needed
    const spriteCache = {};
    async function getSprite(name) {
        if (!spriteCache[name]) {
            const filePath = path.join(SPRITES_DIR, `${name}.png`);
            if (fs.existsSync(filePath)) {
                spriteCache[name] = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
            } else {
                // Fallback: grey tile
                const buf = Buffer.alloc(TILE * TILE * 4, 0);
                for (let i = 0; i < TILE * TILE; i++) {
                    buf[i * 4] = 80; buf[i * 4 + 1] = 80; buf[i * 4 + 2] = 80; buf[i * 4 + 3] = 255;
                }
                spriteCache[name] = { data: buf, info: { width: TILE, height: TILE, channels: 4 } };
            }
        }
        return spriteCache[name];
    }

    // Create output buffer
    const output = Buffer.alloc(width * height * 4);

    // Render each tile
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < mapLines[row].length; col++) {
            const ch = mapLines[row][col];
            const spriteName = charToSprite(ch, row, col);
            const sprite = await getSprite(spriteName);
            const srcBuf = sprite.data;

            // Copy sprite pixels to output buffer
            const destX = col * TILE;
            const destY = row * TILE;
            for (let sy = 0; sy < TILE; sy++) {
                for (let sx = 0; sx < TILE; sx++) {
                    const srcIdx = (sy * TILE + sx) * 4;
                    const destIdx = ((destY + sy) * width + (destX + sx)) * 4;
                    output[destIdx] = srcBuf[srcIdx];
                    output[destIdx + 1] = srcBuf[srcIdx + 1];
                    output[destIdx + 2] = srcBuf[srcIdx + 2];
                    output[destIdx + 3] = srcBuf[srcIdx + 3];
                }
            }
        }
    }

    // Write PNG
    await sharp(output, { raw: { width, height, channels: 4 } })
        .png()
        .toFile(outputFile);

    console.log(`Written: ${outputFile} (${width}x${height}px)`);
}

// Export for testing
module.exports = { charToSprite, tileHash, renderLevel };

// Main
if (require.main === module) {
    const levelFile = process.argv[2] || path.join(__dirname, '..', '..', 'levels', 'level1.txt');
    const outputFile = process.argv[3] || path.join(__dirname, '..', '..', 'docs', 'level1-preview.png');
    renderLevel(levelFile, outputFile).catch(err => { console.error(err); process.exit(1); });
}
