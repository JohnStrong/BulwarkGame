/**
 * Main game loop and rendering
 * Medieval Tower Defense - terrain display
 */

const Game = {
    canvas: null,
    ctx: null,
    state: 'loading',

    async init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        await SpriteManager.loadAll();
        await LevelLoader.loadLevelList();

        this.startLevel();
        this.state = 'playing';
        this.loop();
    },

    startLevel() {
        const level = LevelLoader.getCurrentLevel();

        // Resize canvas to fit level
        this.canvas.width = level.width * TILE_SIZE;
        this.canvas.height = level.height * TILE_SIZE;
    },

    loop() {
        this.render();
        requestAnimationFrame(() => this.loop());
    },

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'loading') {
            ctx.fillStyle = '#fff';
            ctx.font = '18px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', this.canvas.width / 2, this.canvas.height / 2);
            return;
        }

        const level = LevelLoader.getCurrentLevel();

        // Draw all terrain tiles
        for (const tile of level.tiles) {
            if (tile.covered) continue; // Skip tiles covered by multi-tile sprites
            const w = tile.width || TILE_SIZE;
            const h = tile.height || TILE_SIZE;
            SpriteManager.draw(ctx, tile.sprite, tile.x, tile.y, w, h);
        }

        // Draw HUD
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, this.canvas.width, 24);
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${level.width}x${level.height} tiles`, 10, 12);
        ctx.textAlign = 'right';
        ctx.fillText(level.name, this.canvas.width - 10, 12);
    }
};

window.addEventListener('load', () => Game.init());
