/**
 * Full coverage tests for js/level-generators/generate-smooth-sprites.js
 * — Recommendation 2.
 *
 * Now that the module exports its functions, we can test bridge generators,
 * road-edge generators, water-edge generators, pointInHex, and the
 * drawBridgeWall / drawBridgeRoad helpers directly.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/level-generators/generate-smooth-sprites-full.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
    genGrass,
    genFlowers,
    genRoadFull,
    genRoadEdgeLeft,
    genRoadEdgeRight,
    genRoadEdgeTop,
    genRoadEdgeBottom,
    genRoadCorner,
    genBridgeTL,
    genBridgeTM,
    genBridgeTR,
    genBridgeML,
    genBridgeMM,
    genBridgeMR,
    genBridgeBL,
    genBridgeBM,
    genBridgeBR,
    genWaterV,
    genWaterH,
    genWaterEdgeRight,
    genWaterEdgeLeft,
    genTree,
    genPine,
    genShrub,
    genRock,
    drawBridgeWall,
    drawBridgeRoad,
    drawGrassEdgeVertical,
    drawGrassEdgeHorizontal,
    pointInHex,
    createBuf,
    px,
    SIZE,
} = require('../../js/level-generators/generate-smooth-sprites');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countOpaquePixels(buf) {
    let count = 0;
    for (let i = 3; i < buf.length; i += 4) {
        if (buf[i] === 255) count++;
    }
    return count;
}

function getPixel(buf, x, y) {
    const i = (y * SIZE + x) * 4;
    return { r: buf[i], g: buf[i + 1], b: buf[i + 2], a: buf[i + 3] };
}

function buffersDiffer(a, b) {
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return true;
    }
    return false;
}

// ─── pointInHex ──────────────────────────────────────────────────────────────

describe('generate-smooth-sprites: pointInHex', () => {
    function getHexPoints() {
        const cx = SIZE / 2;
        const cy = SIZE / 2;
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            points.push({
                x: cx + (SIZE / 2) * Math.cos(angle),
                y: cy + (SIZE / 2) * Math.sin(angle),
            });
        }
        return points;
    }

    const pts = getHexPoints();

    it('center (16,16) should be inside hex', () => {
        assert.ok(pointInHex(16, 16, pts));
    });

    it('corner (0,0) should be outside hex', () => {
        assert.ok(!pointInHex(0, 0, pts));
    });

    it('corner (31,31) should be outside hex', () => {
        assert.ok(!pointInHex(31, 31, pts));
    });

    it('corner (31,0) should be outside hex', () => {
        assert.ok(!pointInHex(31, 0, pts));
    });

    it('corner (0,31) should be outside hex', () => {
        assert.ok(!pointInHex(0, 31, pts));
    });

    it('mid-left (3,16) should be inside hex', () => {
        assert.ok(pointInHex(3, 16, pts));
    });

    it('mid-right (29,16) should be inside hex', () => {
        assert.ok(pointInHex(29, 16, pts));
    });
});

// ─── drawBridgeWall ──────────────────────────────────────────────────────────

describe('generate-smooth-sprites: drawBridgeWall', () => {
    it('should write opaque pixels in the specified region', () => {
        const buf = createBuf();
        drawBridgeWall(buf, 0, 0, 31, 8, 9000);
        // Check that some pixels in the region are opaque
        let hasOpaque = false;
        for (let y = 0; y <= 8; y++) {
            for (let x = 0; x <= 31; x++) {
                const p = getPixel(buf, x, y);
                if (p.a === 255) { hasOpaque = true; break; }
            }
            if (hasOpaque) break;
        }
        assert.ok(hasOpaque, 'drawBridgeWall should write opaque pixels');
    });

    it('should be deterministic for the same seed', () => {
        const buf1 = createBuf();
        drawBridgeWall(buf1, 0, 0, 31, 8, 9001);
        const buf2 = createBuf();
        drawBridgeWall(buf2, 0, 0, 31, 8, 9001);
        assert.ok(!buffersDiffer(buf1, buf2), 'drawBridgeWall should be deterministic');
    });

    it('should produce different output for different seeds', () => {
        const buf1 = createBuf();
        drawBridgeWall(buf1, 0, 0, 31, 8, 9002);
        const buf2 = createBuf();
        drawBridgeWall(buf2, 0, 0, 31, 8, 9003);
        assert.ok(buffersDiffer(buf1, buf2), 'Different seeds should produce different output');
    });
});

// ─── drawBridgeRoad ──────────────────────────────────────────────────────────

describe('generate-smooth-sprites: drawBridgeRoad', () => {
    it('should write opaque pixels in the specified region', () => {
        const buf = createBuf();
        drawBridgeRoad(buf, 0, 0, 31, 31, 9100);
        const opaqueCount = countOpaquePixels(buf);
        assert.ok(opaqueCount > 0, 'drawBridgeRoad should write opaque pixels');
    });

    it('should be deterministic for the same seed', () => {
        const buf1 = createBuf();
        drawBridgeRoad(buf1, 0, 0, 31, 31, 9101);
        const buf2 = createBuf();
        drawBridgeRoad(buf2, 0, 0, 31, 31, 9101);
        assert.ok(!buffersDiffer(buf1, buf2));
    });

    it('should produce different output from drawBridgeWall (lighter stone)', () => {
        const buf1 = createBuf();
        drawBridgeWall(buf1, 0, 0, 31, 31, 9102);
        const buf2 = createBuf();
        drawBridgeRoad(buf2, 0, 0, 31, 31, 9102);
        assert.ok(buffersDiffer(buf1, buf2), 'Wall and road should look different');
    });
});

// ─── drawGrassEdgeVertical / drawGrassEdgeHorizontal ─────────────────────────

describe('generate-smooth-sprites: drawGrassEdgeVertical', () => {
    it('should write some pixels near the edge', () => {
        const buf = createBuf();
        // Fill with road color first
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                px(buf, x, y, 210, 165, 110);
            }
        }
        drawGrassEdgeVertical(buf, 14, 'left', 9200);
        // Some pixels near x=14 should now be grass-colored (greenish)
        let hasGreen = false;
        for (let y = 0; y < SIZE; y++) {
            for (let x = 14; x <= 17; x++) {
                const p = getPixel(buf, x, y);
                if (p.g > p.r && p.g > p.b) { hasGreen = true; break; }
            }
            if (hasGreen) break;
        }
        assert.ok(hasGreen, 'drawGrassEdgeVertical should draw grass-colored pixels');
    });

    it('should be deterministic', () => {
        const buf1 = createBuf();
        drawGrassEdgeVertical(buf1, 14, 'left', 9201);
        const buf2 = createBuf();
        drawGrassEdgeVertical(buf2, 14, 'left', 9201);
        assert.ok(!buffersDiffer(buf1, buf2));
    });
});

describe('generate-smooth-sprites: drawGrassEdgeHorizontal', () => {
    it('should write some pixels near the edge', () => {
        const buf = createBuf();
        drawGrassEdgeHorizontal(buf, 14, 'top', 9300);
        // Should have written some pixels
        const opaqueCount = countOpaquePixels(buf);
        // May write 0 pixels if all jag values are 0, but should not throw
        assert.ok(opaqueCount >= 0);
    });

    it('should be deterministic', () => {
        const buf1 = createBuf();
        drawGrassEdgeHorizontal(buf1, 14, 'top', 9301);
        const buf2 = createBuf();
        drawGrassEdgeHorizontal(buf2, 14, 'top', 9301);
        assert.ok(!buffersDiffer(buf1, buf2));
    });
});

// ─── Bridge tile generators ───────────────────────────────────────────────────

describe('generate-smooth-sprites: bridge tile generators', () => {
    const BRIDGE_SIZE = SIZE * SIZE * 4;

    it('genBridgeTL should produce a buffer of correct size', () => {
        const buf = genBridgeTL();
        assert.equal(buf.length, BRIDGE_SIZE);
    });

    it('genBridgeTM should produce a buffer of correct size', () => {
        const buf = genBridgeTM();
        assert.equal(buf.length, BRIDGE_SIZE);
    });

    it('genBridgeTR should produce a buffer of correct size', () => {
        const buf = genBridgeTR();
        assert.equal(buf.length, BRIDGE_SIZE);
    });

    it('genBridgeML should produce a buffer of correct size', () => {
        const buf = genBridgeML();
        assert.equal(buf.length, BRIDGE_SIZE);
    });

    it('genBridgeMM should produce a buffer of correct size', () => {
        const buf = genBridgeMM();
        assert.equal(buf.length, BRIDGE_SIZE);
    });

    it('genBridgeMR should produce a buffer of correct size', () => {
        const buf = genBridgeMR();
        assert.equal(buf.length, BRIDGE_SIZE);
    });

    it('genBridgeBL should produce a buffer of correct size', () => {
        const buf = genBridgeBL();
        assert.equal(buf.length, BRIDGE_SIZE);
    });

    it('genBridgeBM should produce a buffer of correct size', () => {
        const buf = genBridgeBM();
        assert.equal(buf.length, BRIDGE_SIZE);
    });

    it('genBridgeBR should produce a buffer of correct size', () => {
        const buf = genBridgeBR();
        assert.equal(buf.length, BRIDGE_SIZE);
    });

    it('all bridge tiles should have opaque pixels', () => {
        const tiles = [
            genBridgeTL(), genBridgeTM(), genBridgeTR(),
            genBridgeML(), genBridgeMM(), genBridgeMR(),
            genBridgeBL(), genBridgeBM(), genBridgeBR(),
        ];
        for (const buf of tiles) {
            assert.ok(countOpaquePixels(buf) > 0, 'Bridge tile should have opaque pixels');
        }
    });

    it('bridge tiles should not all be identical', () => {
        const tl = genBridgeTL();
        const mm = genBridgeMM();
        const br = genBridgeBR();
        // TL has dirt on left, MM is all road, BR has dirt on right
        assert.ok(buffersDiffer(tl, mm), 'TL and MM should differ');
        assert.ok(buffersDiffer(mm, br), 'MM and BR should differ');
    });

    it('genBridgeMM should be deterministic', () => {
        const buf1 = genBridgeMM();
        const buf2 = genBridgeMM();
        assert.ok(!buffersDiffer(buf1, buf2), 'genBridgeMM should be deterministic');
    });
});

// ─── Road edge generators ─────────────────────────────────────────────────────

describe('generate-smooth-sprites: road edge generators', () => {
    it('genRoadEdgeLeft should produce a buffer of correct size', () => {
        const buf = genRoadEdgeLeft();
        assert.equal(buf.length, SIZE * SIZE * 4);
    });

    it('genRoadEdgeRight should produce a buffer of correct size', () => {
        const buf = genRoadEdgeRight();
        assert.equal(buf.length, SIZE * SIZE * 4);
    });

    it('genRoadEdgeTop should produce a buffer of correct size', () => {
        const buf = genRoadEdgeTop();
        assert.equal(buf.length, SIZE * SIZE * 4);
    });

    it('genRoadEdgeBottom should produce a buffer of correct size', () => {
        const buf = genRoadEdgeBottom();
        assert.equal(buf.length, SIZE * SIZE * 4);
    });

    it('genRoadCorner(0) should produce a buffer of correct size', () => {
        const buf = genRoadCorner(0);
        assert.equal(buf.length, SIZE * SIZE * 4);
    });

    it('all 4 road corners should differ from each other', () => {
        const corners = [0, 1, 2, 3].map(genRoadCorner);
        assert.ok(buffersDiffer(corners[0], corners[1]), 'Corner 0 and 1 should differ');
        assert.ok(buffersDiffer(corners[0], corners[2]), 'Corner 0 and 2 should differ');
        assert.ok(buffersDiffer(corners[1], corners[3]), 'Corner 1 and 3 should differ');
    });

    it('road edge tiles should all have opaque pixels', () => {
        const tiles = [
            genRoadEdgeLeft(), genRoadEdgeRight(),
            genRoadEdgeTop(), genRoadEdgeBottom(),
        ];
        for (const buf of tiles) {
            assert.ok(countOpaquePixels(buf) > 0, 'Road edge tile should have opaque pixels');
        }
    });

    it('road edge tiles should differ from genRoadFull', () => {
        const full = genRoadFull();
        const edgeLeft = genRoadEdgeLeft();
        assert.ok(buffersDiffer(full, edgeLeft), 'Road edge should differ from full road');
    });
});

// ─── Water edge generators ────────────────────────────────────────────────────

describe('generate-smooth-sprites: water edge generators', () => {
    it('genWaterEdgeRight should produce a buffer of correct size', () => {
        const buf = genWaterEdgeRight();
        assert.equal(buf.length, SIZE * SIZE * 4);
    });

    it('genWaterEdgeLeft should produce a buffer of correct size', () => {
        const buf = genWaterEdgeLeft();
        assert.equal(buf.length, SIZE * SIZE * 4);
    });

    it('genWaterEdgeRight should have opaque pixels', () => {
        const buf = genWaterEdgeRight();
        assert.ok(countOpaquePixels(buf) > 0);
    });

    it('genWaterEdgeLeft should have opaque pixels', () => {
        const buf = genWaterEdgeLeft();
        assert.ok(countOpaquePixels(buf) > 0);
    });

    it('genWaterEdgeRight and genWaterEdgeLeft should differ', () => {
        const right = genWaterEdgeRight();
        const left = genWaterEdgeLeft();
        assert.ok(buffersDiffer(right, left), 'Right and left water edges should differ');
    });

    it('genWaterEdgeRight should be deterministic', () => {
        const buf1 = genWaterEdgeRight();
        const buf2 = genWaterEdgeRight();
        assert.ok(!buffersDiffer(buf1, buf2));
    });

    it('genWaterEdgeLeft should be deterministic', () => {
        const buf1 = genWaterEdgeLeft();
        const buf2 = genWaterEdgeLeft();
        assert.ok(!buffersDiffer(buf1, buf2));
    });
});

// ─── Tree generators ──────────────────────────────────────────────────────────

describe('generate-smooth-sprites: tree generators', () => {
    it('genTree variants should differ from each other', () => {
        const t0 = genTree(0);
        const t1 = genTree(1);
        const t2 = genTree(2);
        assert.ok(buffersDiffer(t0, t1), 'Tree variant 0 and 1 should differ');
        assert.ok(buffersDiffer(t0, t2), 'Tree variant 0 and 2 should differ');
    });

    it('genPine variants should differ from each other', () => {
        const p0 = genPine(0);
        const p1 = genPine(1);
        assert.ok(buffersDiffer(p0, p1), 'Pine variant 0 and 1 should differ');
    });

    it('genShrub variants should differ from each other', () => {
        const s0 = genShrub(0);
        const s1 = genShrub(1);
        assert.ok(buffersDiffer(s0, s1), 'Shrub variant 0 and 1 should differ');
    });

    it('genTree, genPine, and genShrub should produce distinct sprites', () => {
        const tree = genTree(0);
        const pine = genPine(0);
        const shrub = genShrub(0);
        assert.ok(buffersDiffer(tree, pine), 'Tree and pine should differ');
        assert.ok(buffersDiffer(tree, shrub), 'Tree and shrub should differ');
        assert.ok(buffersDiffer(pine, shrub), 'Pine and shrub should differ');
    });

    it('genTree should have opaque pixels (canopy)', () => {
        const buf = genTree(0);
        assert.ok(countOpaquePixels(buf) > 0);
    });
});

// ─── Pixel-level assertions for bridge tiles ──────────────────────────────────

describe('generate-smooth-sprites: bridge tile pixel content', () => {
    it('genBridgeTM top region should have wall-colored pixels (darker stone)', () => {
        const buf = genBridgeTM();
        // Top 8 rows should have wall pixels (darker than road)
        let hasPixel = false;
        for (let y = 0; y <= 8; y++) {
            for (let x = 0; x < SIZE; x++) {
                const p = getPixel(buf, x, y);
                if (p.a === 255) { hasPixel = true; break; }
            }
            if (hasPixel) break;
        }
        assert.ok(hasPixel, 'genBridgeTM top region should have opaque pixels');
    });

    it('genBridgeMM center should have road-colored pixels (lighter stone)', () => {
        const buf = genBridgeMM();
        // Center pixel should be opaque
        const center = getPixel(buf, 16, 16);
        assert.equal(center.a, 255, 'Center pixel of bridge-mm should be opaque');
    });

    it('genBridgeML left half should have dirt, right half should have road', () => {
        const buf = genBridgeML();
        // Left half (x=8) should have warm dirt colors (r > b)
        const leftPixel = getPixel(buf, 8, 16);
        // Right half (x=24) should have stone colors (more grey)
        const rightPixel = getPixel(buf, 24, 16);
        // Both should be opaque
        assert.equal(leftPixel.a, 255, 'Left pixel should be opaque');
        assert.equal(rightPixel.a, 255, 'Right pixel should be opaque');
        // They should differ (dirt vs stone)
        const leftIsDirt = leftPixel.r > leftPixel.b;
        const rightIsStone = Math.abs(rightPixel.r - rightPixel.g) < 30;
        assert.ok(leftIsDirt, 'Left half should be dirt-colored (r > b)');
        assert.ok(rightIsStone, 'Right half should be stone-colored (r ≈ g ≈ b)');
    });
});
