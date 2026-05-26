/**
 * Sprite manager - loads and draws sprite images
 *
 * Extended to support:
 *  - Atlas loading via SpriteManager.loadAtlas(atlasPath, jsonPath)
 *  - PixiJS renderer delegation via SpriteManager.usePixiRenderer(pixiRenderer)
 *  - Integer pixel alignment in draw() to prevent sub-pixel blur (Req 5.2)
 *  - Animated sprite frame resolution via AnimationController (Req 5.3)
 *  - Enemy sprites (enemy-* prefix) and damaged castle sprites (-damaged suffix) (Req 8.6, 9.6)
 *  - Fallback: atlas load failure → individual PNG loading via loadAll() (Req 5.1)
 *
 * The draw(ctx, name, x, y, width, height) API signature is preserved unchanged (Req 5.4).
 *
 * Requirements: 5.1, 5.2, 5.4, 8.6, 9.6
 */

const SpriteManager = {
    images: {},

    /** @type {Object|null} PixiRenderer API object set via usePixiRenderer() */
    _pixiRenderer: null,

    /** @type {boolean} Whether the sprite atlas has been successfully loaded */
    _atlasLoaded: false,

    /**
     * Atlas animations metadata: maps animation type name to array of frame names.
     * Populated from the atlas JSON `animations` section.
     * @type {Object.<string, string[]>}
     */
    _atlasAnimations: {},

    spriteList: [
        // Grass
        'grass-short-1',
        'grass-short-2',
        'grass-flowers-1',
        'grass-flowers-2',

        // Road
        'road-full',

        // Water
        'water-1',
        'water-2',
        'water-3',

        // Bridge (cobblestone)
        'bridge-mm',

        // Trees
        'tree-1',
        'tree-2',
        'tree-3',
        'tree-4',
        'tree-5',
        'tree-6',
        'tree-7',

        // Tree overlay sprites (transparent background, drawn on top of grass ground tiles)
        'tree-oak-overlay-1',
        'tree-oak-overlay-2',
        'tree-oak-overlay-3',
        'tree-pine-overlay-1',
        'tree-pine-overlay-2',
        'tree-shrub-overlay-1',
        'tree-shrub-overlay-2',

        // Decorations
        'rock',

        // Units (transparent background, overlay on terrain)
        'unit-knight',
        'unit-heavy-infantry',
        'unit-spearman',
        'unit-archer',
        'unit-crossbowman',
        'unit-skirmisher',
        'unit-engineer',
        'unit-militia',
        'unit-artillery',

        // Castle structures
        'castle-bridge-mid',
        'castle-tower',
        'castle-keep-tl',
        'castle-keep-bl',
        'castle-keep-br',
        'castle-keep-center',
        'castle-gatehouse',
        'castle-wall',
        'castle-bailey-1',
        'castle-bailey-2',
        'castle-bailey-3',

        // Enemy sprites (Req 8.6) — registered with 'enemy-' prefix
        'enemy-knight',
        'enemy-archer',
        'enemy-spearman',
        'enemy-militia',
        'enemy-siege',

        // Damaged castle sprites (Req 9.6) — registered with '-damaged' suffix
        'castle-wall-damaged',
        'castle-tower-damaged',
        'castle-keep-tl-damaged',
        'castle-keep-bl-damaged',
        'castle-keep-br-damaged',
        'castle-keep-center-damaged',
        'castle-gatehouse-damaged',
        'castle-bailey-1-damaged',
        'castle-bailey-2-damaged',
        'castle-bailey-3-damaged',

        // Castle overlay sprites (transparent background, drawn on top of castle ground tiles)
        // Walls and bridges: 64×48 px
        'castle-wall-overlay',
        'castle-wall-damaged-overlay',
        'bridge-mm-overlay',
        'castle-bridge-start-overlay',
        'castle-bridge-mid-overlay',
        'castle-bridge-gate-overlay',
        // Towers and keeps: 64×64 px
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
        // Gatehouse: 64×80 px
        'castle-gatehouse-overlay',
        'castle-gatehouse-damaged-overlay'
    ],

    /**
     * Loads all sprites from individual PNG files.
     * Used as the primary load path when no atlas is available, and as the
     * fallback when atlas loading fails (Req 5.1).
     */
    async loadAll() {
        const promises = this.spriteList.map(async (name) => {
            try {
                this.images[name] = await loadImage(`assets/sprites/${name}.png`);
            } catch (e) {
                console.warn(`Could not load sprite: ${name}`);
                this.images[name] = this.createFallback(name);
            }
        });
        await Promise.all(promises);
    },

    /**
     * Loads sprites from a sprite atlas using the PixiJS renderer.
     * Falls back to individual PNG loading via loadAll() if the atlas fails
     * to load or parse (Req 5.1).
     *
     * @param {string} atlasPath - Path to the atlas PNG (e.g. 'assets/sprites/atlas-0.png')
     * @param {string} jsonPath  - Path to the atlas JSON metadata
     * @returns {Promise<void>}
     */
    async loadAtlas(atlasPath, jsonPath) {
        if (!this._pixiRenderer) {
            console.warn('[SpriteManager] loadAtlas called before usePixiRenderer — falling back to loadAll()');
            await this.loadAll();
            return;
        }

        try {
            await this._pixiRenderer.loadSpriteAtlas(atlasPath, jsonPath);

            if (this._pixiRenderer.atlasLoaded) {
                this._atlasLoaded = true;

                // Cache the animations section from the atlas JSON for animated sprite resolution.
                // The PixiJS renderer has already parsed the atlas; we fetch the JSON separately
                // to extract the animations map.
                try {
                    const response = await fetch(jsonPath);
                    if (response.ok) {
                        const atlasData = await response.json();
                        if (atlasData && atlasData.animations) {
                            this._atlasAnimations = atlasData.animations;
                        }
                    }
                } catch (animErr) {
                    // Non-fatal: animated sprites will fall back to base name lookup
                    console.warn('[SpriteManager] Could not load atlas animations metadata:', animErr.message);
                }

                console.log('[SpriteManager] Atlas loaded successfully');
            } else {
                // PixiJS renderer fell back to individual PNGs internally; mark as not loaded
                // so draw() uses the Canvas 2D path with this.images
                this._atlasLoaded = false;
                await this.loadAll();
            }
        } catch (err) {
            console.warn('[SpriteManager] Atlas load failed, falling back to loadAll():', err.message);
            this._atlasLoaded = false;
            await this.loadAll();
        }
    },

    /**
     * Stores a reference to the PixiRenderer API object.
     * Once set, draw() will delegate to the PixiJS renderer when the atlas is loaded.
     *
     * @param {Object} pixiRenderer - The PixiRenderer API object returned by initPixiRenderer()
     */
    usePixiRenderer(pixiRenderer) {
        this._pixiRenderer = pixiRenderer;
    },

    createFallback(name) {
        const canvas = document.createElement('canvas');
        canvas.width = TILE_SIZE;
        canvas.height = TILE_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#555';
        ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#fff';
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name.substring(0, 6), TILE_SIZE / 2, TILE_SIZE / 2);
        return canvas;
    },

    /**
     * Draws a sprite onto the canvas.
     *
     * Coordinates are floored to integers to prevent sub-pixel blur (Req 5.2).
     * If a PixiJS renderer is set and the atlas is loaded, delegates to the
     * PixiJS renderer. Otherwise uses the Canvas 2D path with this.images.
     *
     * For animated sprites (e.g. water tiles), resolves the current animation
     * frame via AnimationController and looks up the frame-specific atlas name.
     *
     * API signature is preserved unchanged (Req 5.4):
     *   draw(ctx, name, x, y, width, height)
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} name - Sprite name
     * @param {number} x - Draw x position
     * @param {number} y - Draw y position
     * @param {number} [width]
     * @param {number} [height]
     */
    draw(ctx, name, x, y, width, height) {
        // Floor coordinates to prevent sub-pixel blur (Req 5.2, Property 13)
        const ix = Math.floor(x);
        const iy = Math.floor(y);

        // Resolve animated sprite to its current frame name if applicable
        const resolvedName = this._resolveAnimatedFrame(name);

        // PixiJS path: delegate if renderer is set and atlas is loaded
        if (this._pixiRenderer && this._atlasLoaded) {
            this._pixiRenderer.drawSprite(ctx, resolvedName, ix, iy, width, height);
            return;
        }

        // Canvas 2D fallback path
        const img = this.images[resolvedName] || this.images[name];
        if (img) {
            ctx.drawImage(img, ix, iy, width || TILE_SIZE, height || TILE_SIZE);
        }
    },

    /**
     * Resolves an animated sprite name to its current frame name using AnimationController.
     *
     * For a sprite name like 'water-1', checks if there is an animation registered
     * under a matching key in the atlas animations map (e.g. 'water-anim') and
     * returns the frame name for the current frame index.
     *
     * If no animation is found, returns the original name unchanged.
     *
     * @param {string} name - Sprite name
     * @returns {string} Resolved frame name, or original name if not animated
     */
    _resolveAnimatedFrame(name) {
        // Only attempt resolution when atlas is loaded and AnimationController is available
        if (!this._atlasLoaded || typeof AnimationController === 'undefined') {
            return name;
        }

        // Check each registered animation type to see if this sprite name is a base
        // for that animation (e.g. 'water-1' → animation type 'water-anim')
        for (const [animType, frames] of Object.entries(this._atlasAnimations)) {
            if (!frames || frames.length === 0) continue;

            // Match if the sprite name starts with the animation type base
            // (e.g. 'water-1' starts with 'water', 'water-anim' type)
            // or if the sprite name exactly matches the animation type base
            const animBase = animType.replace(/-anim$/, '');
            if (name === animBase || name.startsWith(animBase + '-')) {
                const currentFrame = AnimationController.getCurrentFrame(animType);
                const frameIndex = currentFrame % frames.length;
                return frames[frameIndex];
            }
        }

        return name;
    }
};

// Export for Node.js (tests) while remaining usable as a browser global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpriteManager;
}
