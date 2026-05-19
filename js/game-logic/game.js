/**
 * Main game loop and rendering
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
        this.canvas.width = level.pixelWidth;
        this.canvas.height = level.pixelHeight;
    },

    loop() {
        this.render();
        requestAnimationFrame(() => this.loop());
    },

    render() {
        const ctx = this.ctx;

        // Clear canvas (transparent background - hex sprites handle their own shape)
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'loading') {
            ctx.fillStyle = '#fff';
            ctx.font = '18px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', this.canvas.width / 2, this.canvas.height / 2);
            return;
        }

        const level = LevelLoader.getCurrentLevel();

        for (const tile of level.tiles) {
            if (tile.covered) continue;
            const w = tile.width || HEX_WIDTH;
            const h = tile.height || HEX_HEIGHT;
            SpriteManager.draw(ctx, tile.sprite, tile.x, tile.y, w, h);
        }

        // HUD
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, this.canvas.width, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(level.name, 8, 14);
    }
};

window.addEventListener('load', () => Game.init());
