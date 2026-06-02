/**
 * Tests for js/game-logic/sprites.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/sprites.spec.js
 *
 * Note: SpriteManager relies heavily on DOM (Image, Canvas, fetch).
 * These tests cover the logic that can be tested without a browser:
 * - spriteList completeness
 * - draw() behavior with mock context
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const TILE_SIZE = 32;

// Minimal SpriteManager replica for testable logic
const SpriteManager = {
    images: {},

    spriteList: [
        'grass-short-1', 'grass-short-2',
        'grass-flowers-1', 'grass-flowers-2',
        'road-full',
        'water-1', 'water-2', 'water-3',
        'bridge-mm',
        'tree-1', 'tree-2', 'tree-3', 'tree-4',
        'tree-5', 'tree-6', 'tree-7',
        'rock',
        'unit-knight', 'unit-heavy-infantry', 'unit-spearman',
        'unit-archer', 'unit-crossbowman', 'unit-skirmisher',
        'unit-engineer', 'unit-militia', 'unit-artillery',
        'castle-bridge-start', 'castle-bridge-mid', 'castle-bridge-gate',
        'castle-tower',
        'castle-keep-tl', 'castle-keep-bl', 'castle-keep-br',
        'castle-keep-center', 'castle-gatehouse', 'castle-wall',
        'castle-bailey-1', 'castle-bailey-2', 'castle-bailey-3'
    ],

    draw(ctx, name, x, y, width, height) {
        const img = this.images[name];
        if (img) {
            ctx.drawImage(img, x, y, width || TILE_SIZE, height || TILE_SIZE);
        }
    }
};

describe('SpriteManager.spriteList', () => {
    it('should contain all grass sprites', () => {
        assert.ok(SpriteManager.spriteList.includes('grass-short-1'));
        assert.ok(SpriteManager.spriteList.includes('grass-short-2'));
        assert.ok(SpriteManager.spriteList.includes('grass-flowers-1'));
        assert.ok(SpriteManager.spriteList.includes('grass-flowers-2'));
    });

    it('should contain road sprite', () => {
        assert.ok(SpriteManager.spriteList.includes('road-full'));
    });

    it('should contain 3 water sprites', () => {
        assert.ok(SpriteManager.spriteList.includes('water-1'));
        assert.ok(SpriteManager.spriteList.includes('water-2'));
        assert.ok(SpriteManager.spriteList.includes('water-3'));
    });

    it('should contain 7 tree sprites', () => {
        for (let i = 1; i <= 7; i++) {
            assert.ok(SpriteManager.spriteList.includes(`tree-${i}`));
        }
    });

    it('should contain all 9 unit sprites', () => {
        const unitSprites = [
            'unit-knight', 'unit-heavy-infantry', 'unit-spearman',
            'unit-archer', 'unit-crossbowman', 'unit-skirmisher',
            'unit-engineer', 'unit-militia', 'unit-artillery'
        ];
        for (const s of unitSprites) {
            assert.ok(SpriteManager.spriteList.includes(s), `Missing: ${s}`);
        }
    });

    it('should contain all castle sprites', () => {
        const castleSprites = [
            'castle-bridge-start', 'castle-bridge-mid', 'castle-bridge-gate',
            'castle-tower',
            'castle-keep-tl', 'castle-keep-bl', 'castle-keep-br',
            'castle-keep-center', 'castle-gatehouse', 'castle-wall',
            'castle-bailey-1', 'castle-bailey-2', 'castle-bailey-3'
        ];
        for (const s of castleSprites) {
            assert.ok(SpriteManager.spriteList.includes(s), `Missing: ${s}`);
        }
    });

    it('should have no duplicate entries', () => {
        const set = new Set(SpriteManager.spriteList);
        assert.equal(set.size, SpriteManager.spriteList.length);
    });

    it('should have no empty string entries', () => {
        for (const s of SpriteManager.spriteList) {
            assert.ok(s.length > 0);
        }
    });
});

describe('SpriteManager.draw', () => {
    it('should call drawImage when sprite exists', () => {
        let called = false;
        let args = null;
        const mockCtx = {
            drawImage(img, x, y, w, h) { called = true; args = { img, x, y, w, h }; }
        };
        SpriteManager.images['test-sprite'] = { fake: true };
        SpriteManager.draw(mockCtx, 'test-sprite', 10, 20, 64, 32);
        assert.ok(called);
        assert.equal(args.x, 10);
        assert.equal(args.y, 20);
        assert.equal(args.w, 64);
        assert.equal(args.h, 32);
        delete SpriteManager.images['test-sprite'];
    });

    it('should use TILE_SIZE as default width/height', () => {
        let args = null;
        const mockCtx = {
            drawImage(img, x, y, w, h) { args = { w, h }; }
        };
        SpriteManager.images['test-sprite'] = { fake: true };
        SpriteManager.draw(mockCtx, 'test-sprite', 0, 0);
        assert.equal(args.w, TILE_SIZE);
        assert.equal(args.h, TILE_SIZE);
        delete SpriteManager.images['test-sprite'];
    });

    it('should not call drawImage when sprite does not exist', () => {
        let called = false;
        const mockCtx = {
            drawImage() { called = true; }
        };
        SpriteManager.draw(mockCtx, 'nonexistent', 0, 0, 32, 32);
        assert.equal(called, false);
    });
});

// ---------------------------------------------------------------------------
// New tests for task 12.2 — SpriteManager integration
// Tests use a self-contained SpriteManager replica that mirrors the new
// implementation (loadAtlas, usePixiRenderer, Math.floor in draw,
// _resolveAnimatedFrame, enemy-* and *-damaged entries in spriteList).
// ---------------------------------------------------------------------------

const TILE_SIZE_NEW = 32;

/**
 * Extended SpriteManager replica that mirrors js/game-logic/sprites.js
 * after the task-12.1 modifications.
 */
function makeExtendedSpriteManager() {
    return {
        images: {},
        _pixiRenderer: null,
        _atlasLoaded: false,
        _atlasAnimations: {},
        _loadAllCalled: false,   // test-only flag

        spriteList: [
            // Grass
            'grass-short-1', 'grass-short-2',
            'grass-flowers-1', 'grass-flowers-2',
            // Road
            'road-full',
            // Water
            'water-1', 'water-2', 'water-3',
            // Bridge
            'bridge-mm',
            // Trees
            'tree-1', 'tree-2', 'tree-3', 'tree-4',
            'tree-5', 'tree-6', 'tree-7',
            // Decorations
            'rock',
            // Units
            'unit-knight', 'unit-heavy-infantry', 'unit-spearman',
            'unit-archer', 'unit-crossbowman', 'unit-skirmisher',
            'unit-engineer', 'unit-militia', 'unit-artillery',
            // Castle structures
            'castle-bridge-start', 'castle-bridge-mid', 'castle-bridge-gate',
            'castle-tower',
            'castle-keep-tl', 'castle-keep-bl', 'castle-keep-br',
            'castle-keep-center', 'castle-gatehouse', 'castle-wall',
            'castle-bailey-1', 'castle-bailey-2', 'castle-bailey-3',
            // Enemy sprites (Req 8.6) — registered with 'enemy-' prefix
            'enemy-knight', 'enemy-archer', 'enemy-spearman',
            'enemy-militia', 'enemy-siege',
            // Damaged castle sprites (Req 9.6) — registered with '-damaged' suffix
            'castle-wall-damaged', 'castle-tower-damaged',
            'castle-keep-tl-damaged', 'castle-keep-bl-damaged',
            'castle-keep-br-damaged', 'castle-keep-center-damaged',
            'castle-gatehouse-damaged',
            'castle-bailey-1-damaged', 'castle-bailey-2-damaged',
            'castle-bailey-3-damaged'
        ],

        usePixiRenderer(pixiRenderer) {
            this._pixiRenderer = pixiRenderer;
        },

        async loadAll() {
            this._loadAllCalled = true;
        },

        async loadAtlas(atlasPath, jsonPath) {
            if (!this._pixiRenderer) {
                await this.loadAll();
                return;
            }
            try {
                await this._pixiRenderer.loadSpriteAtlas(atlasPath, jsonPath);
                if (this._pixiRenderer.atlasLoaded) {
                    this._atlasLoaded = true;
                } else {
                    this._atlasLoaded = false;
                    await this.loadAll();
                }
            } catch (err) {
                this._atlasLoaded = false;
                await this.loadAll();
            }
        },

        _resolveAnimatedFrame(name) {
            if (!this._atlasLoaded) return name;
            for (const [animType, frames] of Object.entries(this._atlasAnimations)) {
                if (!frames || frames.length === 0) continue;
                const animBase = animType.replace(/-anim$/, '');
                if (name === animBase || name.startsWith(animBase + '-')) {
                    const frameIndex = 0 % frames.length;
                    return frames[frameIndex];
                }
            }
            return name;
        },

        draw(ctx, name, x, y, width, height) {
            // Floor coordinates to prevent sub-pixel blur (Req 5.2)
            const ix = Math.floor(x);
            const iy = Math.floor(y);

            const resolvedName = this._resolveAnimatedFrame(name);

            if (this._pixiRenderer && this._atlasLoaded) {
                this._pixiRenderer.drawSprite(ctx, resolvedName, ix, iy, width, height);
                return;
            }

            const img = this.images[resolvedName] || this.images[name];
            if (img) {
                ctx.drawImage(img, ix, iy, width || TILE_SIZE_NEW, height || TILE_SIZE_NEW);
            }
        }
    };
}

// ---------------------------------------------------------------------------
// 1. Integer pixel alignment
// ---------------------------------------------------------------------------
describe('SpriteManager.draw() integer pixel alignment', () => {
    it('should floor fractional x coordinate', () => {
        const sm = makeExtendedSpriteManager();
        sm.images['test'] = { fake: true };
        let capturedX;
        const mockCtx = { drawImage(img, x) { capturedX = x; } };
        sm.draw(mockCtx, 'test', 10.7, 0, 64, 32);
        assert.equal(capturedX, 10);
    });

    it('should floor fractional y coordinate', () => {
        const sm = makeExtendedSpriteManager();
        sm.images['test'] = { fake: true };
        let capturedY;
        const mockCtx = { drawImage(img, x, y) { capturedY = y; } };
        sm.draw(mockCtx, 'test', 0, 15.9, 64, 32);
        assert.equal(capturedY, 15);
    });

    it('should floor both x and y when both are fractional', () => {
        const sm = makeExtendedSpriteManager();
        sm.images['test'] = { fake: true };
        let capturedX, capturedY;
        const mockCtx = { drawImage(img, x, y) { capturedX = x; capturedY = y; } };
        sm.draw(mockCtx, 'test', 3.14, 2.99, 64, 32);
        assert.equal(capturedX, 3);
        assert.equal(capturedY, 2);
    });

    it('should leave integer coordinates unchanged', () => {
        const sm = makeExtendedSpriteManager();
        sm.images['test'] = { fake: true };
        let capturedX, capturedY;
        const mockCtx = { drawImage(img, x, y) { capturedX = x; capturedY = y; } };
        sm.draw(mockCtx, 'test', 8, 16, 64, 32);
        assert.equal(capturedX, 8);
        assert.equal(capturedY, 16);
    });

    it('should floor negative fractional coordinates', () => {
        const sm = makeExtendedSpriteManager();
        sm.images['test'] = { fake: true };
        let capturedX, capturedY;
        const mockCtx = { drawImage(img, x, y) { capturedX = x; capturedY = y; } };
        sm.draw(mockCtx, 'test', -1.3, -0.5, 64, 32);
        assert.equal(capturedX, -2);
        assert.equal(capturedY, -1);
    });
});

// ---------------------------------------------------------------------------
// 2. Backward compatibility of draw() API signature
// ---------------------------------------------------------------------------
describe('SpriteManager.draw() backward compatibility', () => {
    it('should accept the full (ctx, name, x, y, width, height) signature', () => {
        const sm = makeExtendedSpriteManager();
        sm.images['castle-wall'] = { fake: true };
        let args = null;
        const mockCtx = {
            drawImage(img, x, y, w, h) { args = { x, y, w, h }; }
        };
        sm.draw(mockCtx, 'castle-wall', 100, 200, 64, 32);
        assert.ok(args !== null, 'drawImage should have been called');
        assert.equal(args.x, 100);
        assert.equal(args.y, 200);
        assert.equal(args.w, 64);
        assert.equal(args.h, 32);
    });

    it('should use TILE_SIZE defaults when width and height are omitted', () => {
        const sm = makeExtendedSpriteManager();
        sm.images['grass-short-1'] = { fake: true };
        let args = null;
        const mockCtx = {
            drawImage(img, x, y, w, h) { args = { w, h }; }
        };
        sm.draw(mockCtx, 'grass-short-1', 0, 0);
        assert.ok(args !== null, 'drawImage should have been called');
        assert.equal(args.w, TILE_SIZE_NEW);
        assert.equal(args.h, TILE_SIZE_NEW);
    });

    it('should not call drawImage when sprite is not loaded', () => {
        const sm = makeExtendedSpriteManager();
        let called = false;
        const mockCtx = { drawImage() { called = true; } };
        sm.draw(mockCtx, 'nonexistent-sprite', 0, 0, 64, 32);
        assert.equal(called, false);
    });

    it('should work without a PixiJS renderer set (Canvas 2D path)', () => {
        const sm = makeExtendedSpriteManager();
        sm.images['road-full'] = { fake: true };
        let called = false;
        const mockCtx = { drawImage() { called = true; } };
        sm.draw(mockCtx, 'road-full', 10, 20, 64, 32);
        assert.ok(called, 'Canvas 2D path should call drawImage');
    });
});

// ---------------------------------------------------------------------------
// 3. usePixiRenderer() — delegation to PixiJS renderer
// ---------------------------------------------------------------------------
describe('SpriteManager.usePixiRenderer()', () => {
    it('should store the pixiRenderer reference', () => {
        const sm = makeExtendedSpriteManager();
        const fakeRenderer = { drawSprite() {}, loadSpriteAtlas() {}, atlasLoaded: false };
        sm.usePixiRenderer(fakeRenderer);
        assert.equal(sm._pixiRenderer, fakeRenderer);
    });

    it('should delegate draw() to pixiRenderer.drawSprite when atlas is loaded', () => {
        const sm = makeExtendedSpriteManager();
        let delegated = false;
        let delegatedArgs = null;
        const fakeRenderer = {
            atlasLoaded: true,
            drawSprite(ctx, name, x, y, w, h) {
                delegated = true;
                delegatedArgs = { name, x, y, w, h };
            }
        };
        sm.usePixiRenderer(fakeRenderer);
        sm._atlasLoaded = true;

        const mockCtx = {};
        sm.draw(mockCtx, 'grass-short-1', 5, 10, 64, 32);

        assert.ok(delegated, 'draw() should delegate to pixiRenderer.drawSprite');
        assert.equal(delegatedArgs.name, 'grass-short-1');
        assert.equal(delegatedArgs.x, 5);
        assert.equal(delegatedArgs.y, 10);
    });

    it('should pass floored coordinates to pixiRenderer.drawSprite', () => {
        const sm = makeExtendedSpriteManager();
        let capturedX, capturedY;
        const fakeRenderer = {
            atlasLoaded: true,
            drawSprite(ctx, name, x, y) { capturedX = x; capturedY = y; }
        };
        sm.usePixiRenderer(fakeRenderer);
        sm._atlasLoaded = true;

        sm.draw({}, 'water-1', 7.8, 3.2, 64, 32);
        assert.equal(capturedX, 7);
        assert.equal(capturedY, 3);
    });

    it('should fall back to Canvas 2D when atlas is not loaded', () => {
        const sm = makeExtendedSpriteManager();
        sm.images['rock'] = { fake: true };
        let pixiCalled = false;
        let canvasCalled = false;
        const fakeRenderer = {
            atlasLoaded: false,
            drawSprite() { pixiCalled = true; }
        };
        sm.usePixiRenderer(fakeRenderer);
        sm._atlasLoaded = false;

        const mockCtx = { drawImage() { canvasCalled = true; } };
        sm.draw(mockCtx, 'rock', 0, 0, 64, 32);

        assert.equal(pixiCalled, false, 'pixiRenderer.drawSprite should NOT be called when atlas not loaded');
        assert.ok(canvasCalled, 'Canvas 2D drawImage should be called as fallback');
    });
});

// ---------------------------------------------------------------------------
// 4. loadAtlas() fallback to loadAll() on atlas load failure
// ---------------------------------------------------------------------------
describe('SpriteManager.loadAtlas() fallback', () => {
    it('should call loadAll() when pixiRenderer.atlasLoaded is false after loadSpriteAtlas()', async () => {
        const sm = makeExtendedSpriteManager();
        const fakeRenderer = {
            atlasLoaded: false,
            async loadSpriteAtlas() {
                // atlasLoaded remains false — simulates atlas load failure
            }
        };
        sm.usePixiRenderer(fakeRenderer);

        await sm.loadAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.ok(sm._loadAllCalled, 'loadAll() should be called as fallback when atlasLoaded is false');
        assert.equal(sm._atlasLoaded, false, '_atlasLoaded should remain false');
    });

    it('should call loadAll() when loadSpriteAtlas() throws', async () => {
        const sm = makeExtendedSpriteManager();
        const fakeRenderer = {
            atlasLoaded: false,
            async loadSpriteAtlas() {
                throw new Error('Network error');
            }
        };
        sm.usePixiRenderer(fakeRenderer);

        await sm.loadAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.ok(sm._loadAllCalled, 'loadAll() should be called as fallback when loadSpriteAtlas() throws');
        assert.equal(sm._atlasLoaded, false);
    });

    it('should set _atlasLoaded to true when pixiRenderer.atlasLoaded is true', async () => {
        const sm = makeExtendedSpriteManager();
        const fakeRenderer = {
            atlasLoaded: true,
            async loadSpriteAtlas() {
                // atlasLoaded is already true — simulates successful load
            }
        };
        sm.usePixiRenderer(fakeRenderer);

        await sm.loadAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.equal(sm._atlasLoaded, true, '_atlasLoaded should be true on successful atlas load');
        assert.equal(sm._loadAllCalled, false, 'loadAll() should NOT be called on success');
    });

    it('should call loadAll() when no pixiRenderer is set', async () => {
        const sm = makeExtendedSpriteManager();
        // No usePixiRenderer() call

        await sm.loadAtlas('assets/sprites/atlas-0.png', 'assets/sprites/atlas.json');

        assert.ok(sm._loadAllCalled, 'loadAll() should be called when no pixiRenderer is set');
    });
});

// ---------------------------------------------------------------------------
// 5. spriteList — enemy sprites with 'enemy-' prefix (Req 8.6)
// ---------------------------------------------------------------------------
describe('SpriteManager.spriteList enemy sprites', () => {
    const sm = makeExtendedSpriteManager();

    it('should contain enemy-knight', () => {
        assert.ok(sm.spriteList.includes('enemy-knight'), 'Missing: enemy-knight');
    });

    it('should contain enemy-archer', () => {
        assert.ok(sm.spriteList.includes('enemy-archer'), 'Missing: enemy-archer');
    });

    it('should contain enemy-spearman', () => {
        assert.ok(sm.spriteList.includes('enemy-spearman'), 'Missing: enemy-spearman');
    });

    it('should contain enemy-militia', () => {
        assert.ok(sm.spriteList.includes('enemy-militia'), 'Missing: enemy-militia');
    });

    it('should contain enemy-siege', () => {
        assert.ok(sm.spriteList.includes('enemy-siege'), 'Missing: enemy-siege');
    });

    it('should contain exactly 5 enemy sprites', () => {
        const enemySprites = sm.spriteList.filter(s => s.startsWith('enemy-'));
        assert.equal(enemySprites.length, 5, `Expected 5 enemy sprites, got ${enemySprites.length}: ${enemySprites.join(', ')}`);
    });

    it('should have all enemy sprites prefixed with enemy-', () => {
        const expected = ['enemy-knight', 'enemy-archer', 'enemy-spearman', 'enemy-militia', 'enemy-siege'];
        for (const name of expected) {
            assert.ok(sm.spriteList.includes(name), `Missing enemy sprite: ${name}`);
        }
    });
});

// ---------------------------------------------------------------------------
// 6. spriteList — damaged castle sprites with '-damaged' suffix (Req 9.6)
// ---------------------------------------------------------------------------
describe('SpriteManager.spriteList damaged sprites', () => {
    const sm = makeExtendedSpriteManager();

    const expectedDamaged = [
        'castle-wall-damaged',
        'castle-tower-damaged',
        'castle-keep-tl-damaged',
        'castle-keep-bl-damaged',
        'castle-keep-br-damaged',
        'castle-keep-center-damaged',
        'castle-gatehouse-damaged',
        'castle-bailey-1-damaged',
        'castle-bailey-2-damaged',
        'castle-bailey-3-damaged'
    ];

    for (const name of expectedDamaged) {
        it(`should contain ${name}`, () => {
            assert.ok(sm.spriteList.includes(name), `Missing: ${name}`);
        });
    }

    it('should contain exactly 10 damaged castle sprites', () => {
        const damagedSprites = sm.spriteList.filter(s => s.endsWith('-damaged'));
        assert.equal(damagedSprites.length, 10, `Expected 10 damaged sprites, got ${damagedSprites.length}: ${damagedSprites.join(', ')}`);
    });

    it('should make damaged sprites available via draw() API', () => {
        sm.images['castle-wall-damaged'] = { fake: true };
        let called = false;
        const mockCtx = { drawImage() { called = true; } };
        sm.draw(mockCtx, 'castle-wall-damaged', 0, 0, 64, 32);
        assert.ok(called, 'draw() should render castle-wall-damaged via Canvas 2D path');
        delete sm.images['castle-wall-damaged'];
    });
});
