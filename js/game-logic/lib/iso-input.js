/**
 * Isometric Input Handler — keyboard, mouse, and touch events.
 *
 * Reusable input system. Emits callbacks for game actions.
 * Decoupled from game logic — just tracks state and fires handlers.
 *
 * Usage:
 *   IsoInput.init(canvas, {
 *     onTileHover: (row, col) => {},
 *     onTileClick: (row, col) => {},
 *     onTileRightClick: (row, col) => {},
 *     onViewpointToggle: () => {},
 *     screenToGrid: (x, y) => ({ row, col }),
 *   });
 */

const IsoInput = {
    keys: { up: false, down: false, left: false, right: false, zoomIn: false, zoomOut: false },
    canvas: null,
    callbacks: {},

    /**
     * Initialize input listeners on a canvas.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} callbacks — event handlers
     */
    init(canvas, callbacks) {
        this.canvas = canvas;
        this.callbacks = callbacks || {};

        // Keyboard
        window.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowUp': case 'w': case 'W': this.keys.up = true; break;
                case 'ArrowDown': case 's': case 'S': this.keys.down = true; break;
                case 'ArrowLeft': case 'a': case 'A': this.keys.left = true; break;
                case 'ArrowRight': case 'd': case 'D': this.keys.right = true; break;
                case '+': case '=': this.keys.zoomIn = true; break;
                case '-': case '_': this.keys.zoomOut = true; break;
                case ' ':
                    e.preventDefault();
                    if (this.callbacks.onViewpointToggle) this.callbacks.onViewpointToggle();
                    break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch (e.key) {
                case 'ArrowUp': case 'w': case 'W': this.keys.up = false; break;
                case 'ArrowDown': case 's': case 'S': this.keys.down = false; break;
                case 'ArrowLeft': case 'a': case 'A': this.keys.left = false; break;
                case 'ArrowRight': case 'd': case 'D': this.keys.right = false; break;
                case '+': case '=': this.keys.zoomIn = false; break;
                case '-': case '_': this.keys.zoomOut = false; break;
            }
        });

        // Mouse wheel zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (this.callbacks.onZoom) {
                this.callbacks.onZoom(e.deltaY > 0 ? -1 : 1);
            }
        }, { passive: false });

        // Mouse move (hover)
        canvas.addEventListener('mousemove', (e) => {
            const { x, y } = this.getMousePos(e);
            if (this.callbacks.onMouseMove) this.callbacks.onMouseMove(x, y);
        });

        // Left click
        canvas.addEventListener('click', (e) => {
            const { x, y } = this.getMousePos(e);
            if (this.callbacks.onClick) this.callbacks.onClick(x, y);
        });

        // Right click
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const { x, y } = this.getMousePos(e);
            if (this.callbacks.onRightClick) this.callbacks.onRightClick(x, y);
        });

        // Mouse leave
        canvas.addEventListener('mouseleave', () => {
            if (this.callbacks.onMouseLeave) this.callbacks.onMouseLeave();
        });
    },

    /**
     * Get mouse position relative to canvas.
     */
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },

    /**
     * Get current scroll direction from held keys.
     * Returns { dx, dy } where each is -1, 0, or 1.
     */
    getScrollDir() {
        return {
            dx: (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0),
            dy: (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0),
        };
    }
};
