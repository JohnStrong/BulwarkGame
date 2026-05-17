/**
 * Generate dirt road sprite (64x64, 2x2 tiles).
 * Warm brown dirt path with wheel ruts and scattered pebbles.
 */

const sharp = require('sharp');
const path = require('path');

const S = 64;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'assets', 'sprites');

const DIRT = [140, 110, 70];
const DIRT_LIGHT = [160, 130, 85];
const DIRT_DARK = [110, 85, 55];
const PEBBLE = [125, 120, 105];
const RUT = [95, 72, 45];

let seed = 1;
function seededRandom() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}
function resetSeed(s) { seed = s; }

function setPixel(buf, x, y, r, g, b) {
    if (x < 0 || x >= S || y < 0 || y >= S) return;
    const idx = (y * S + x) * 4;
    buf[idx] = Math.max(0, Math.min(255, Math.round(r)));
    buf[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
    buf[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[idx + 3] = 255;
}

function generateRoad() {
    const buf = Buffer.alloc(S * S * 4);
    resetSeed(60000);

    // Base dirt fill
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const n = (seededRandom() - 0.5) * 10;
            setPixel(buf, x, y, DIRT[0] + n, DIRT[1] + n * 0.9, DIRT[2] + n * 0.8);
        }
    }

    // Wheel ruts (subtle darker lines)
    resetSeed(60100);
    for (let y = 0; y < S; y++) {
        const wobble1 = Math.sin(y * 0.1) * 2;
        const wobble2 = Math.sin(y * 0.1 + 1) * 2;
        const rut1x = Math.round(20 + wobble1);
        const rut2x = Math.round(44 + wobble2);
        for (let dx = 0; dx < 3; dx++) {
            const n = (seededRandom() - 0.5) * 4;
            setPixel(buf, rut1x + dx, y, RUT[0] + n, RUT[1] + n, RUT[2] + n);
            setPixel(buf, rut2x + dx, y, RUT[0] + n, RUT[1] + n, RUT[2] + n);
        }
    }

    // Scattered pebbles
    resetSeed(60200);
    for (let i = 0; i < 20; i++) {
        const px = Math.floor(seededRandom() * S);
        const py = Math.floor(seededRandom() * S);
        const pr = 1 + Math.floor(seededRandom() * 2);
        for (let dy = -pr; dy <= pr; dy++) {
            for (let dx = -pr; dx <= pr; dx++) {
                if (dx * dx + dy * dy <= pr * pr) {
                    const n = (seededRandom() - 0.5) * 5;
                    setPixel(buf, px + dx, py + dy, PEBBLE[0] + n, PEBBLE[1] + n, PEBBLE[2] + n);
                }
            }
        }
    }

    // Light patches
    resetSeed(60300);
    for (let i = 0; i < 10; i++) {
        const px = Math.floor(seededRandom() * S);
        const py = Math.floor(seededRandom() * S);
        const n = (seededRandom() - 0.5) * 4;
        setPixel(buf, px, py, DIRT_LIGHT[0] + n, DIRT_LIGHT[1] + n, DIRT_LIGHT[2] + n);
        setPixel(buf, px + 1, py, DIRT_LIGHT[0] + n, DIRT_LIGHT[1] + n, DIRT_LIGHT[2] + n);
    }

    return buf;
}

async function main() {
    const buf = generateRoad();
    await sharp(buf, { raw: { width: S, height: S, channels: 4 } })
        .png().toFile(path.join(OUTPUT_DIR, 'road.png'));
    console.log('  ✓ road.png (64x64)');
}

main().catch(err => { console.error(err); process.exit(1); });
