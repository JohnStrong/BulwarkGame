/**
 * Random Level Generator
 *
 * Generates a level using a seed-based approach inspired by simple procedural
 * generation (noise-based biome selection + path carving).
 *
 * Usage:
 *   node generate-random-level.js [seed]
 *
 * If no seed is provided, uses current timestamp.
 * Output: levels/YYYY-MM-DD_HH-mm-ss.txt
 *
 * ═══════════════════════════════════════════════════════════════
 * GENERATION RULES
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. BIOME WEIGHTS (derived from seed):
 *    The seed determines the "personality" of the map:
 *    - forestWeight (0-1): how many trees appear
 *    - waterWeight (0-1): how much coastline/river coverage
 *    - roadCount (1-3): number of road paths
 *
 * 2. WATER PLACEMENT:
 *    - Always on the left edge (coastline)
 *    - Width varies based on waterWeight (2-6 tiles)
 *    - Coastline is jagged (alternating ~~~) and ~~))
 *
 * 3. ROAD CARVING (random walk with bias):
 *    - Roads enter from the top (enemy entrance)
 *    - Each road does a biased random walk downward
 *    - At a random point, the road turns right toward the castle area
 *    - Roads are 3 tiles wide (L+D+D+r for vertical, U/D/u for horizontal)
 *    - If multiple roads, they branch from the main path
 *
 * 4. TREE PLACEMENT (noise-based):
 *    - Uses 2D value noise to create natural clusters
 *    - Trees only placed on grass (not on roads/water)
 *    - Density controlled by forestWeight
 *
 * 5. CASTLE AREA:
 *    - Right portion of map is kept clear (grass) for castle placement
 *
 * 6. DECORATIONS:
 *    - Flowers placed in small clusters on grass
 *    - Rocks scattered sparsely
 *
 * ═══════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

// Map dimensions
const W = 50;
const H = 35;

// ============ SEEDED RANDOM ============

let seed = 0;

function setSeed(s) {
    seed = s & 0xFFFFFFFF;
}

function random() {
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (seed >>> 0) / 0xFFFFFFFF;
}

function randomInt(min, max) {
    return min + Math.floor(random() * (max - min + 1));
}

// ============ 2D VALUE NOISE ============

function hashNoise(x, y) {
    let h = (x * 374761393 + y * 668265263 + seed) & 0xFFFFFFFF;
    h = ((h >> 13) ^ h) * 1274126177;
    h = ((h >> 16) ^ h);
    return (h >>> 0) / 0xFFFFFFFF;
}

function smoothNoise(x, y, scale) {
    const sx = x / scale;
    const sy = y / scale;
    const ix = Math.floor(sx);
    const iy = Math.floor(sy);
    const fx = sx - ix;
    const fy = sy - iy;

    const v00 = hashNoise(ix, iy);
    const v10 = hashNoise(ix + 1, iy);
    const v01 = hashNoise(ix, iy + 1);
    const v11 = hashNoise(ix + 1, iy + 1);

    const i0 = v00 * (1 - fx) + v10 * fx;
    const i1 = v01 * (1 - fx) + v11 * fx;

    return i0 * (1 - fy) + i1 * fy;
}

// ============ MAP GENERATION ============

function generateLevel(inputSeed) {
    setSeed(inputSeed);

    // Derive biome weights from seed
    const forestWeight = random() * 0.6 + 0.1;   // 0.1 - 0.7
    const waterWidth = Math.floor(random() * 4) + 2; // 2-5 tiles
    const roadCount = Math.floor(random() * 2) + 1;  // 1-2 main roads
    const hasBranch = random() > 0.4;                 // 60% chance of branch

    console.log(`  Seed: ${inputSeed}`);
    console.log(`  Forest density: ${(forestWeight * 100).toFixed(0)}%`);
    console.log(`  Water width: ${waterWidth}`);
    console.log(`  Roads: ${roadCount}${hasBranch ? ' + branch' : ''}`);

    // Initialize map with grass
    const map = Array.from({ length: H }, () => Array(W).fill('.'));

    // --- STEP 1: Water (left coastline) ---
    for (let row = 0; row < H; row++) {
        // Jagged coastline using noise
        const jag = Math.round(smoothNoise(row, 0, 4) * 2);
        const coastEnd = waterWidth + jag;

        for (let col = 0; col < coastEnd - 1; col++) {
            map[row][col] = '~';
        }
        map[row][coastEnd - 1] = ')'; // transition tile
    }

    // --- STEP 2: Carve roads ---
    const roads = []; // store road tile positions for collision avoidance

    function carveRoad(startCol, startRow, direction) {
        // direction: 'down' then turns 'right'
        let col = startCol;
        let row = startRow;
        const turnRow = randomInt(Math.floor(H * 0.3), Math.floor(H * 0.6));
        const path = [];

        // Phase 1: Go down with slight wobble
        while (row < turnRow && row < H - 2) {
            // Carve 3-wide vertical road: L D D r
            for (let dr = 0; dr < 1; dr++) {
                if (row + dr < H) {
                    map[row + dr][col] = 'L';
                    map[row + dr][col + 1] = 'D';
                    map[row + dr][col + 2] = 'D';
                    map[row + dr][col + 3] = 'r';
                    path.push([row + dr, col], [row + dr, col + 1], [row + dr, col + 2], [row + dr, col + 3]);
                }
            }
            row++;

            // Occasional wobble
            if (random() < 0.15 && col > waterWidth + 3 && col < W - 15) {
                col += random() > 0.5 ? 1 : -1;
            }
        }

        // Phase 2: Turn right - horizontal stretch
        const horizEnd = Math.min(W - 2, col + randomInt(15, W - col - 2));

        // Top edge of horizontal road
        for (let c = col; c <= horizEnd; c++) {
            map[row][c] = 'U';
            path.push([row, c]);
        }
        row++;
        // Middle of horizontal road (2 rows)
        for (let r = 0; r < 2; r++) {
            for (let c = col; c <= horizEnd; c++) {
                map[row][c] = 'D';
                path.push([row, c]);
            }
            row++;
        }
        // Bottom edge of horizontal road
        for (let c = col; c <= horizEnd; c++) {
            map[row][c] = 'u';
            path.push([row, c]);
        }

        roads.push({ turnRow, turnCol: col, horizEnd, horizRow: row - 2, path });
        return { turnRow, col, horizEnd, horizRow: row - 2 };
    }

    // Main road: enters from top
    const mainRoadCol = randomInt(waterWidth + 3, Math.floor(W * 0.35));

    // Place road entrance at top
    map[0][mainRoadCol] = 'U';
    map[0][mainRoadCol + 1] = 'U';
    map[0][mainRoadCol + 2] = 'U';
    map[0][mainRoadCol + 3] = 'U';

    const mainRoad = carveRoad(mainRoadCol, 1, 'down');

    // Branch road (splits from main horizontal road, goes down then right)
    if (hasBranch) {
        const branchCol = randomInt(mainRoad.col + 4, mainRoad.horizEnd - 4);
        const branchStartRow = mainRoad.horizRow + 3; // start below the horizontal road

        // Vertical segment going down
        let bRow = branchStartRow;
        let bCol = branchCol;
        const branchTurnRow = randomInt(bRow + 4, Math.min(H - 5, bRow + 10));

        while (bRow < branchTurnRow && bRow < H - 4) {
            map[bRow][bCol] = 'L';
            map[bRow][bCol + 1] = 'D';
            map[bRow][bCol + 2] = 'D';
            map[bRow][bCol + 3] = 'r';
            bRow++;
        }

        // Turn right
        const bHorizEnd = Math.min(W - 2, bCol + randomInt(10, W - bCol - 2));
        for (let c = bCol; c <= bHorizEnd; c++) map[bRow][c] = 'U';
        bRow++;
        for (let c = bCol; c <= bHorizEnd; c++) map[bRow][c] = 'D';
        bRow++;
        for (let c = bCol; c <= bHorizEnd; c++) map[bRow][c] = 'D';
        bRow++;
        for (let c = bCol; c <= bHorizEnd; c++) map[bRow][c] = 'u';
    }

    // --- STEP 3: Forest clusters (same tree type per cluster) ---
    // Place 2-4 forest clusters in different quadrants
    const clusterCount = randomInt(2, 4);
    const treeTypes = ['O', 'P', 'S'];
    const usedAreas = [];

    for (let ci = 0; ci < clusterCount; ci++) {
        // Pick a tree type for this cluster (same type throughout)
        const treeType = treeTypes[ci % treeTypes.length];

        // Pick a cluster center in a quadrant (avoid road/water)
        let cx, cy, attempts = 0;
        do {
            // Prefer corners/edges: top-right, top-left, bottom-left
            const quadrant = ci % 3;
            if (quadrant === 0) { // top-right
                cx = randomInt(Math.floor(W * 0.6), W - 5);
                cy = randomInt(2, Math.floor(H * 0.35));
            } else if (quadrant === 1) { // top-left
                cx = randomInt(waterWidth + 3, Math.floor(W * 0.3));
                cy = randomInt(2, Math.floor(H * 0.35));
            } else { // bottom-left
                cx = randomInt(waterWidth + 3, Math.floor(W * 0.35));
                cy = randomInt(Math.floor(H * 0.65), H - 4);
            }
            attempts++;
        } while (attempts < 20 && map[cy] && map[cy][cx] !== '.');

        // Fill cluster area with this tree type (elliptical shape)
        const clusterRx = randomInt(4, 10);
        const clusterRy = randomInt(3, 7);
        const density = 0.5 + random() * 0.3; // 50-80% fill

        for (let dy = -clusterRy; dy <= clusterRy; dy++) {
            for (let dx = -clusterRx; dx <= clusterRx; dx++) {
                const dist = (dx*dx)/(clusterRx*clusterRx) + (dy*dy)/(clusterRy*clusterRy);
                if (dist > 1) continue;
                const r = cy + dy, c = cx + dx;
                if (r >= 0 && r < H && c >= 0 && c < W && map[r][c] === '.') {
                    if (random() < density) {
                        map[r][c] = treeType;
                    }
                }
            }
        }
    }

    // --- Shrubs along river banks ---
    for (let row = 0; row < H; row++) {
        // Place shrubs 1-2 tiles from water edge
        for (let col = 0; col < W; col++) {
            if (map[row][col] !== '.') continue;
            // Check if adjacent to water
            let nearWater = false;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = row+dr, nc = col+dc;
                    if (nr >= 0 && nr < H && nc >= 0 && nc < W && map[nr][nc] === '~') {
                        nearWater = true;
                    }
                }
            }
            if (nearWater && random() < 0.15) {
                map[row][col] = 'S';
            }
        }
    }

    // --- STEP 4: Flower clusters ---
    for (let i = 0; i < 8; i++) {
        const cr = randomInt(2, H - 3);
        const cc = randomInt(waterWidth + 3, W - 5);
        const size = randomInt(1, 3);

        for (let dr = 0; dr < size; dr++) {
            for (let dc = 0; dc < size; dc++) {
                const r = cr + dr, c = cc + dc;
                if (r < H && c < W && map[r][c] === '.') {
                    map[r][c] = ',';
                }
            }
        }
    }

    // --- STEP 5: Rocks ---
    for (let i = 0; i < 5; i++) {
        const rr = randomInt(1, H - 2);
        const rc = randomInt(waterWidth + 2, W - 3);
        if (map[rr][rc] === '.') {
            map[rr][rc] = 'R';
        }
    }

    // --- BUILD OUTPUT ---
    const biomeDesc = forestWeight > 0.5 ? 'Dense Forest' :
                      forestWeight > 0.3 ? 'Woodland' : 'Open Plains';
    const waterDesc = waterWidth > 4 ? 'Wide Coast' : 'Narrow Coast';

    const header = [
        `; Generated level - seed: ${inputSeed}`,
        `; Biome: ${biomeDesc}, ${waterDesc}`,
        `; Roads: ${roadCount}${hasBranch ? ' + branch' : ''}`,
        `name=${biomeDesc} (${inputSeed})`,
    ].join('\n');

    const mapStr = map.map(row => row.join('')).join('\n');
    return header + '\n' + mapStr + '\n';
}

// ============ EXPORTS (for testing) ============

module.exports = { generateLevel, hashNoise, smoothNoise, setSeed, random, randomInt, W, H };

// ============ MAIN ============

if (require.main === module) {
    const inputSeed = process.argv[2] ? parseInt(process.argv[2], 10) : Date.now();
    const output = generateLevel(inputSeed);

    // Write to candidates folder with timestamp filename
    const now = new Date();
    const ts = now.toISOString().replace(/[T]/g, '_').replace(/[:]/g, '-').substring(0, 19);
    const filename = `${ts}_seed-${inputSeed}.txt`;
    const outputPath = path.join(__dirname, '..', '..', 'levels', 'candidates', filename);

    fs.writeFileSync(outputPath, output);
    console.log(`\n  Written to: levels/candidates/${filename}`);
    console.log(`  Map size: ${W}x${H}`);
    console.log(`\n  To use: copy to levels/ folder and add filename to levels/manifest.txt`);
}
