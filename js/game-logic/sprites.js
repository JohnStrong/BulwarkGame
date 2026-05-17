/**
 * Sprite manager - loads and draws sprite images
 */

const SpriteManager = {
    images: {},

    spriteList: [
        // Border (map edge)
        'border-top',
        'border-bottom',
        'border-left',
        'border-right',
        'border-corner-tl',
        'border-corner-tr',
        'border-corner-bl',
        'border-corner-br',
        'hill-border',

        // Grass
        'grass-short-1',
        'grass-short-2',
        'grass-flowers-1',
        'grass-flowers-2',

        // Water
        'water-1',
        'water-2',
        'water-3',
        'water-land-right',
        'water-land-br',

        // Oak trees (2x2)
        'oak-large-1',
        'oak-large-2',
        'oak-large-3',

        // Structures
        'wall-h',
        'wall-v',
        'tower',
        'wall-gate-left',
        'wall-gate-right',
        'portcullis-large',
        'hut-1',
        'hut-2',
        'bailey',
        'keep',
        'road'
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
