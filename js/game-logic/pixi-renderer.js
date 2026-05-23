/**
 * PixiJS Renderer — hardware-accelerated sprite rendering with graceful fallback.
 *
 * Fallback chain:
 *   1. PixiJS WebGL renderer (5 s timeout)
 *   2. PixiJS CanvasRenderer
 *   3. Direct Canvas 2D (existing SpriteManager)
 *
 * Atlas loading fallback:
 *   1. PixiJS Spritesheet (atlas PNG + JSON)
 *   2. Individual PNG files via SpriteManager.loadAll()
 *
 * Draw-call batching: max 10 draw calls per tile layer.
 *
 * Requirements: 5.5, 6.3, 6.4, 6.6, 6.7, 7.4
 */

/* global PIXI */

// ─── Internal state ──────────────────────────────────────────────────────────

/** @type {'webgl'|'canvas-renderer'|'canvas2d'|null} */
let _rendererType = null;

/** @type {PIXI.Application|null} */
let _app = null;

/** @type {PIXI.Renderer|PIXI.CanvasRenderer|null} */
let _renderer = null;

/** @type {Map<string, PIXI.Texture>} */
const _textures = new Map();

/** @type {boolean} */
let _atlasLoaded = false;

/** @type {boolean} */
let _initialized = false;

// ─── Batch draw-call tracking ─────────────────────────────────────────────────

/**
 * Per-layer draw-call counters, reset each frame.
 * Layers: 'ground', 'structure', 'unit', 'overlay'
 * @type {Map<string, number>}
 */
const _drawCallsPerLayer = new Map([
    ['ground', 0],
    ['structure', 0],
    ['unit', 0],
    ['overlay', 0],
]);

/** Maximum draw calls allowed per tile layer per frame (Req 7.4). */
const MAX_DRAW_CALLS_PER_LAYER = 10;

/**
 * Reset per-layer draw-call counters. Call once per frame before drawing.
 */
function resetDrawCallCounters() {
    for (const key of _drawCallsPerLayer.keys()) {
        _drawCallsPerLayer.set(key, 0);
    }
}

/**
 * Increment the draw-call counter for a layer and return whether the call
 * is within the allowed budget.
 *
 * @param {string} layer - One of 'ground', 'structure', 'unit', 'overlay'
 * @returns {boolean} true if the draw call is within budget
 */
function trackDrawCall(layer) {
    const current = _drawCallsPerLayer.get(layer) || 0;
    if (current >= MAX_DRAW_CALLS_PER_LAYER) {
        return false;
    }
    _drawCallsPerLayer.set(layer, current + 1);
    return true;
}

/**
 * Return the current draw-call count for a layer (for testing / diagnostics).
 * @param {string} layer
 * @returns {number}
 */
function getDrawCallCount(layer) {
    return _drawCallsPerLayer.get(layer) || 0;
}

// ─── Renderer initialisation ──────────────────────────────────────────────────

/**
 * Attempt to create a PixiJS WebGL Application using the existing canvas.
 * Resolves with the Application on success, rejects on failure or timeout.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} timeoutMs
 * @returns {Promise<PIXI.Application>}
 */
function _tryWebGL(canvas, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('PixiJS WebGL init timed out'));
        }, timeoutMs);

        try {
            // PixiJS 7 Application constructor — use `view` to attach to the
            // existing canvas element rather than creating a new one (Req 6.4).
            const app = new PIXI.Application({
                view: canvas,
                width: canvas.width,
                height: canvas.height,
                backgroundAlpha: 0,
                antialias: false,
                forceCanvas: false,
            });

            // Verify we actually got a WebGL renderer.
            if (!(app.renderer instanceof PIXI.Renderer)) {
                clearTimeout(timer);
                app.destroy(false);
                reject(new Error('PixiJS did not create a WebGL renderer'));
                return;
            }

            clearTimeout(timer);
            resolve(app);
        } catch (err) {
            clearTimeout(timer);
            reject(err);
        }
    });
}

/**
 * Attempt to create a PixiJS CanvasRenderer Application using the existing canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<PIXI.Application>}
 */
function _tryCanvasRenderer(canvas) {
    return new Promise((resolve, reject) => {
        try {
            const app = new PIXI.Application({
                view: canvas,
                width: canvas.width,
                height: canvas.height,
                backgroundAlpha: 0,
                antialias: false,
                forceCanvas: true,
            });
            resolve(app);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Initializes the PixiJS renderer with the existing HTML5 Canvas element.
 *
 * Implements the fallback chain (Req 5.5):
 *   WebGL (timeout ms) → PixiJS CanvasRenderer → Canvas 2D
 *
 * @param {HTMLCanvasElement} canvas - The existing game canvas
 * @param {number} [timeout=5000] - WebGL init timeout in milliseconds
 * @returns {Promise<PixiRendererAPI>} Resolved renderer API object
 */
async function initPixiRenderer(canvas, timeout = 5000) {
    if (_initialized) {
        return _buildAPI();
    }

    // ── Step 1: Try WebGL ────────────────────────────────────────────────────
    try {
        _app = await _tryWebGL(canvas, timeout);
        _renderer = _app.renderer;
        _rendererType = 'webgl';
    } catch (webglErr) {
        console.warn('[pixi-renderer] WebGL init failed, trying CanvasRenderer:', webglErr.message);

        // ── Step 2: Try PixiJS CanvasRenderer ───────────────────────────────
        try {
            _app = await _tryCanvasRenderer(canvas);
            _renderer = _app.renderer;
            _rendererType = 'canvas-renderer';
        } catch (canvasRendererErr) {
            console.warn('[pixi-renderer] CanvasRenderer failed, falling back to Canvas 2D:', canvasRendererErr.message);

            // ── Step 3: Canvas 2D fallback ───────────────────────────────────
            _app = null;
            _renderer = null;
            _rendererType = 'canvas2d';
        }
    }

    _initialized = true;
    return _buildAPI();
}

// ─── Atlas loading ────────────────────────────────────────────────────────────

/**
 * Loads the sprite atlas using PixiJS Spritesheet.
 * Falls back to individual PNG loading via SpriteManager.loadAll() on any
 * failure (Req 5.1, 6.6, 6.7).
 *
 * The atlas must be parsed within 5 seconds of initialization (Req 6.6).
 *
 * @param {string} atlasImagePath - Path to the atlas PNG (e.g. 'assets/sprites/atlas-0.png')
 * @param {string} atlasJsonPath  - Path to the atlas JSON metadata
 * @returns {Promise<void>}
 */
async function loadSpriteAtlas(atlasImagePath, atlasJsonPath) {
    const ATLAS_TIMEOUT_MS = 5000;

    try {
        // Fetch and parse the JSON metadata first.
        const jsonResponse = await _fetchWithTimeout(atlasJsonPath, ATLAS_TIMEOUT_MS);
        const atlasData = await jsonResponse.json();

        // Load the atlas image as a PixiJS BaseTexture.
        const baseTexture = await _loadBaseTextureWithTimeout(atlasImagePath, ATLAS_TIMEOUT_MS);

        // Parse the spritesheet.
        const spritesheet = new PIXI.Spritesheet(baseTexture, atlasData);
        await _parseSpritesheetWithTimeout(spritesheet, ATLAS_TIMEOUT_MS);

        // Register all textures from the spritesheet.
        for (const [name, texture] of Object.entries(spritesheet.textures)) {
            _textures.set(name, texture);
        }

        _atlasLoaded = true;
        console.log(`[pixi-renderer] Atlas loaded: ${Object.keys(spritesheet.textures).length} sprites`);

    } catch (err) {
        console.warn('[pixi-renderer] Atlas load failed, falling back to individual PNGs:', err.message);
        _atlasLoaded = false;

        // Fallback: load individual PNGs via the existing SpriteManager (Req 6.7).
        if (typeof SpriteManager !== 'undefined' && typeof SpriteManager.loadAll === 'function') {
            await SpriteManager.loadAll();
        }
    }
}

/**
 * Fetch a resource with a timeout.
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
function _fetchWithTimeout(url, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Fetch timed out: ${url}`)), timeoutMs);
        fetch(url)
            .then(response => {
                clearTimeout(timer);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
                resolve(response);
            })
            .catch(err => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

/**
 * Load a PixiJS BaseTexture with a timeout.
 * @param {string} imagePath
 * @param {number} timeoutMs
 * @returns {Promise<PIXI.BaseTexture>}
 */
function _loadBaseTextureWithTimeout(imagePath, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`BaseTexture load timed out: ${imagePath}`)), timeoutMs);

        const baseTexture = PIXI.BaseTexture.from(imagePath);

        if (baseTexture.valid) {
            clearTimeout(timer);
            resolve(baseTexture);
            return;
        }

        baseTexture.on('loaded', () => {
            clearTimeout(timer);
            resolve(baseTexture);
        });

        baseTexture.on('error', (bt, err) => {
            clearTimeout(timer);
            reject(err || new Error(`Failed to load BaseTexture: ${imagePath}`));
        });
    });
}

/**
 * Parse a PixiJS Spritesheet with a timeout.
 * @param {PIXI.Spritesheet} spritesheet
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
function _parseSpritesheetWithTimeout(spritesheet, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Spritesheet parse timed out')), timeoutMs);
        spritesheet.parse()
            .then(() => { clearTimeout(timer); resolve(); })
            .catch(err => { clearTimeout(timer); reject(err); });
    });
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

/**
 * Draw a sprite using the active renderer.
 *
 * When PixiJS is active and the atlas is loaded, draws via PixiJS Sprite.
 * Otherwise delegates to the existing SpriteManager Canvas 2D path.
 *
 * All coordinates are floored to integers to prevent sub-pixel blur (Req 5.2).
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context (used in fallback)
 * @param {string} name - Sprite name
 * @param {number} x - Draw x position (floored)
 * @param {number} y - Draw y position (floored)
 * @param {number} [width] - Draw width
 * @param {number} [height] - Draw height
 * @param {string} [layer='ground'] - Tile layer for draw-call budgeting
 */
function drawSprite(ctx, name, x, y, width, height, layer = 'ground') {
    // Floor coordinates to prevent sub-pixel blur (Req 5.2, Property 13).
    const ix = Math.floor(x);
    const iy = Math.floor(y);

    if (_rendererType !== 'canvas2d' && _atlasLoaded && _textures.has(name)) {
        // PixiJS path — track draw-call budget (Req 7.4, Property 18).
        if (!trackDrawCall(layer)) {
            // Budget exceeded for this layer; skip this draw call.
            return;
        }

        const texture = _textures.get(name);
        const sprite = new PIXI.Sprite(texture);
        sprite.x = ix;
        sprite.y = iy;
        if (width !== undefined) sprite.width = width;
        if (height !== undefined) sprite.height = height;

        if (_app && _app.stage) {
            _app.stage.addChild(sprite);
        }
        return;
    }

    // Canvas 2D fallback — delegate to SpriteManager.
    if (typeof SpriteManager !== 'undefined') {
        SpriteManager.draw(ctx, name, ix, iy, width, height);
    }
}

// ─── Public API object ────────────────────────────────────────────────────────

/**
 * @typedef {Object} PixiRendererAPI
 * @property {string} rendererType - 'webgl' | 'canvas-renderer' | 'canvas2d'
 * @property {boolean} atlasLoaded
 * @property {Function} loadSpriteAtlas
 * @property {Function} drawSprite
 * @property {Function} resetDrawCallCounters
 * @property {Function} trackDrawCall
 * @property {Function} getDrawCallCount
 * @property {Map<string, PIXI.Texture>} textures
 * @property {PIXI.Application|null} app
 */

/**
 * Build and return the public renderer API.
 * @returns {PixiRendererAPI}
 */
function _buildAPI() {
    return {
        get rendererType() { return _rendererType; },
        get atlasLoaded() { return _atlasLoaded; },
        loadSpriteAtlas,
        drawSprite,
        resetDrawCallCounters,
        trackDrawCall,
        getDrawCallCount,
        get textures() { return _textures; },
        get app() { return _app; },
    };
}

// ─── Module exports ───────────────────────────────────────────────────────────
// The game uses plain <script> tags, so expose on window for browser use.
// Also export via module.exports for Node.js test environments.

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initPixiRenderer,
        loadSpriteAtlas,
        drawSprite,
        resetDrawCallCounters,
        trackDrawCall,
        getDrawCallCount,
        MAX_DRAW_CALLS_PER_LAYER,
        // Expose internals for testing
        _textures,
        _getRendererType: () => _rendererType,
        _getAtlasLoaded: () => _atlasLoaded,
        _getInitialized: () => _initialized,
        _reset: () => {
            _rendererType = null;
            _app = null;
            _renderer = null;
            _textures.clear();
            _atlasLoaded = false;
            _initialized = false;
            resetDrawCallCounters();
        },
    };
} else {
    // Browser global
    window.PixiRenderer = {
        initPixiRenderer,
        loadSpriteAtlas,
        drawSprite,
        resetDrawCallCounters,
        trackDrawCall,
        getDrawCallCount,
        MAX_DRAW_CALLS_PER_LAYER,
        get textures() { return _textures; },
        get app() { return _app; },
        get rendererType() { return _rendererType; },
        get atlasLoaded() { return _atlasLoaded; },
    };
}
