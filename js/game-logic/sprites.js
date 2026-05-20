/**
 * Sprite manager - loads and draws sprite images
 */

const SpriteManager = {
    images: {},

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

        // Decorations
        'rock',

        // Castle structures
        'castle-bridge-start',
        'castle-bridge-mid',
        'castle-bridge-gate',
        'castle-tower',
        'castle-keep-tl',
        'castle-keep-bl',
        'castle-keep-br',
        'castle-keep-center',
        'castle-gatehouse',
        'castle-wall',
        'castle-bailey-1',
        'castle-bailey-2',
        'castle-bailey-3'
    ],

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

    draw(ctx, name, x, y, width, height) {
        const img = this.images[name];
        if (img) {
            ctx.drawImage(img, x, y, width || TILE_SIZE, height || TILE_SIZE);
        }
    }
};
