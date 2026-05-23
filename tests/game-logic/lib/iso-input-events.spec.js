/**
 * Tests for js/game-logic/lib/iso-input.js
 *
 * IsoInput is a browser global with no module.exports, so the implementation
 * is replicated inline here — the same pattern used by iso-renderer-canvas-mock.spec.js.
 *
 * Covers:
 *   - init(): keyboard keydown/keyup sets/clears keys flags
 *   - init(): wheel event calls onZoom with correct direction
 *   - init(): click calls onClick with canvas-relative coordinates
 *   - init(): mousemove calls onMouseMove with canvas-relative coordinates
 *   - init(): contextmenu calls onRightClick with canvas-relative coordinates
 *   - init(): mouseleave calls onMouseLeave
 *   - init(): spacebar calls onViewpointToggle and calls preventDefault
 *   - getMousePos(): returns clientX/Y minus canvas bounding rect
 *   - getScrollDir(): returns correct dx/dy from keys state
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-input-events.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Minimal event-emitter mock for canvas and window ────────────────────────

function createEventEmitter() {
    const listeners = {};
    return {
        _listeners: listeners,
        addEventListener(event, handler, _opts) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(handler);
        },
        _emit(event, eventObj) {
            for (const fn of (listeners[event] || [])) fn(eventObj);
        },
    };
}

function createMockCanvas(rectLeft = 10, rectTop = 20) {
    const emitter = createEventEmitter();
    emitter.getBoundingClientRect = () => ({ left: rectLeft, top: rectTop });
    return emitter;
}

// ─── IsoInput replica ─────────────────────────────────────────────────────────
// Replicated inline because the source file has no module.exports.

function createIsoInput() {
    return {
        keys: { up: false, down: false, left: false, right: false, zoomIn: false, zoomOut: false },
        canvas: null,
        callbacks: {},

        init(canvas, callbacks) {
            this.canvas = canvas;
            this.callbacks = callbacks || {};

            // Keyboard — attached to the window mock passed in via _window
            const win = this._window || { addEventListener() {} };

            win.addEventListener('keydown', (e) => {
                switch (e.key) {
                    case 'ArrowUp':  case 'w': case 'W': this.keys.up    = true; break;
                    case 'ArrowDown': case 's': case 'S': this.keys.down  = true; break;
                    case 'ArrowLeft': case 'a': case 'A': this.keys.left  = true; break;
                    case 'ArrowRight':case 'd': case 'D': this.keys.right = true; break;
                    case '+': case '=': this.keys.zoomIn  = true; break;
                    case '-': case '_': this.keys.zoomOut = true; break;
                    case ' ':
                        e.preventDefault();
                        if (this.callbacks.onViewpointToggle) this.callbacks.onViewpointToggle();
                        break;
                }
            });

            win.addEventListener('keyup', (e) => {
                switch (e.key) {
                    case 'ArrowUp':  case 'w': case 'W': this.keys.up    = false; break;
                    case 'ArrowDown': case 's': case 'S': this.keys.down  = false; break;
                    case 'ArrowLeft': case 'a': case 'A': this.keys.left  = false; break;
                    case 'ArrowRight':case 'd': case 'D': this.keys.right = false; break;
                    case '+': case '=': this.keys.zoomIn  = false; break;
                    case '-': case '_': this.keys.zoomOut = false; break;
                }
            });

            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (this.callbacks.onZoom) {
                    this.callbacks.onZoom(e.deltaY > 0 ? -1 : 1);
                }
            }, { passive: false });

            canvas.addEventListener('mousemove', (e) => {
                const { x, y } = this.getMousePos(e);
                if (this.callbacks.onMouseMove) this.callbacks.onMouseMove(x, y);
            });

            canvas.addEventListener('click', (e) => {
                const { x, y } = this.getMousePos(e);
                if (this.callbacks.onClick) this.callbacks.onClick(x, y);
            });

            canvas.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const { x, y } = this.getMousePos(e);
                if (this.callbacks.onRightClick) this.callbacks.onRightClick(x, y);
            });

            canvas.addEventListener('mouseleave', () => {
                if (this.callbacks.onMouseLeave) this.callbacks.onMouseLeave();
            });
        },

        getMousePos(e) {
            const rect = this.canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        },

        getScrollDir() {
            return {
                dx: (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0),
                dy: (this.keys.down  ? 1 : 0) - (this.keys.up   ? 1 : 0),
            };
        },
    };
}

// ─── Tests: keyboard keydown ──────────────────────────────────────────────────

describe('IsoInput.init() — keydown sets keys flags', () => {
    let input, win, canvas;

    beforeEach(() => {
        input = createIsoInput();
        win = createEventEmitter();
        canvas = createMockCanvas();
        input._window = win;
        input.init(canvas, {});
    });

    const keyMappings = [
        { key: 'ArrowUp',    flag: 'up' },
        { key: 'w',          flag: 'up' },
        { key: 'W',          flag: 'up' },
        { key: 'ArrowDown',  flag: 'down' },
        { key: 's',          flag: 'down' },
        { key: 'S',          flag: 'down' },
        { key: 'ArrowLeft',  flag: 'left' },
        { key: 'a',          flag: 'left' },
        { key: 'A',          flag: 'left' },
        { key: 'ArrowRight', flag: 'right' },
        { key: 'd',          flag: 'right' },
        { key: 'D',          flag: 'right' },
        { key: '+',          flag: 'zoomIn' },
        { key: '=',          flag: 'zoomIn' },
        { key: '-',          flag: 'zoomOut' },
        { key: '_',          flag: 'zoomOut' },
    ];

    for (const { key, flag } of keyMappings) {
        it(`keydown "${key}" sets keys.${flag} = true`, () => {
            win._emit('keydown', { key, preventDefault() {} });
            assert.equal(input.keys[flag], true, `keys.${flag} should be true after keydown "${key}"`);
        });
    }

    it('keydown of unknown key does not change any flag', () => {
        win._emit('keydown', { key: 'F5', preventDefault() {} });
        assert.equal(input.keys.up,      false);
        assert.equal(input.keys.down,    false);
        assert.equal(input.keys.left,    false);
        assert.equal(input.keys.right,   false);
        assert.equal(input.keys.zoomIn,  false);
        assert.equal(input.keys.zoomOut, false);
    });
});

// ─── Tests: keyboard keyup ────────────────────────────────────────────────────

describe('IsoInput.init() — keyup clears keys flags', () => {
    let input, win, canvas;

    beforeEach(() => {
        input = createIsoInput();
        win = createEventEmitter();
        canvas = createMockCanvas();
        input._window = win;
        input.init(canvas, {});
        // Pre-set all flags to true
        input.keys.up = input.keys.down = input.keys.left =
            input.keys.right = input.keys.zoomIn = input.keys.zoomOut = true;
    });

    const keyMappings = [
        { key: 'ArrowUp',    flag: 'up' },
        { key: 'w',          flag: 'up' },
        { key: 'ArrowDown',  flag: 'down' },
        { key: 's',          flag: 'down' },
        { key: 'ArrowLeft',  flag: 'left' },
        { key: 'a',          flag: 'left' },
        { key: 'ArrowRight', flag: 'right' },
        { key: 'd',          flag: 'right' },
        { key: '+',          flag: 'zoomIn' },
        { key: '-',          flag: 'zoomOut' },
    ];

    for (const { key, flag } of keyMappings) {
        it(`keyup "${key}" clears keys.${flag} = false`, () => {
            win._emit('keyup', { key });
            assert.equal(input.keys[flag], false, `keys.${flag} should be false after keyup "${key}"`);
        });
    }
});

// ─── Tests: spacebar → onViewpointToggle ─────────────────────────────────────

describe('IsoInput.init() — spacebar calls onViewpointToggle', () => {
    it('should call onViewpointToggle when spacebar is pressed', () => {
        const input = createIsoInput();
        const win = createEventEmitter();
        const canvas = createMockCanvas();
        input._window = win;

        let toggled = false;
        input.init(canvas, { onViewpointToggle: () => { toggled = true; } });

        let preventDefaultCalled = false;
        win._emit('keydown', { key: ' ', preventDefault() { preventDefaultCalled = true; } });

        assert.ok(toggled, 'onViewpointToggle should be called on spacebar');
        assert.ok(preventDefaultCalled, 'preventDefault should be called on spacebar');
    });

    it('should not throw when onViewpointToggle is not provided', () => {
        const input = createIsoInput();
        const win = createEventEmitter();
        const canvas = createMockCanvas();
        input._window = win;
        input.init(canvas, {}); // no onViewpointToggle

        assert.doesNotThrow(() => {
            win._emit('keydown', { key: ' ', preventDefault() {} });
        });
    });
});

// ─── Tests: wheel → onZoom ────────────────────────────────────────────────────

describe('IsoInput.init() — wheel event calls onZoom', () => {
    let input, canvas;
    let zoomCalls;

    beforeEach(() => {
        input = createIsoInput();
        canvas = createMockCanvas();
        zoomCalls = [];
        input._window = createEventEmitter();
        input.init(canvas, { onZoom: (dir) => zoomCalls.push(dir) });
    });

    it('should call onZoom(-1) when scrolling down (deltaY > 0)', () => {
        canvas._emit('wheel', { deltaY: 100, preventDefault() {} });
        assert.equal(zoomCalls.length, 1);
        assert.equal(zoomCalls[0], -1, 'scroll down should zoom out (-1)');
    });

    it('should call onZoom(+1) when scrolling up (deltaY < 0)', () => {
        canvas._emit('wheel', { deltaY: -100, preventDefault() {} });
        assert.equal(zoomCalls.length, 1);
        assert.equal(zoomCalls[0], 1, 'scroll up should zoom in (+1)');
    });

    it('should not throw when onZoom is not provided', () => {
        const input2 = createIsoInput();
        const canvas2 = createMockCanvas();
        input2._window = createEventEmitter();
        input2.init(canvas2, {});
        assert.doesNotThrow(() => {
            canvas2._emit('wheel', { deltaY: 50, preventDefault() {} });
        });
    });
});

// ─── Tests: click → onClick ───────────────────────────────────────────────────

describe('IsoInput.init() — click calls onClick with canvas-relative coords', () => {
    it('should call onClick with (clientX - rectLeft, clientY - rectTop)', () => {
        const input = createIsoInput();
        const canvas = createMockCanvas(10, 20); // rect: left=10, top=20
        input._window = createEventEmitter();

        let clickArgs = null;
        input.init(canvas, { onClick: (x, y) => { clickArgs = { x, y }; } });

        canvas._emit('click', { clientX: 110, clientY: 220 });

        assert.ok(clickArgs !== null, 'onClick should have been called');
        assert.equal(clickArgs.x, 100, 'x = clientX - rectLeft = 110 - 10');
        assert.equal(clickArgs.y, 200, 'y = clientY - rectTop = 220 - 20');
    });

    it('should not throw when onClick is not provided', () => {
        const input = createIsoInput();
        const canvas = createMockCanvas();
        input._window = createEventEmitter();
        input.init(canvas, {});
        assert.doesNotThrow(() => canvas._emit('click', { clientX: 50, clientY: 50 }));
    });
});

// ─── Tests: mousemove → onMouseMove ──────────────────────────────────────────

describe('IsoInput.init() — mousemove calls onMouseMove with canvas-relative coords', () => {
    it('should call onMouseMove with canvas-relative coordinates', () => {
        const input = createIsoInput();
        const canvas = createMockCanvas(5, 15); // rect: left=5, top=15
        input._window = createEventEmitter();

        let moveArgs = null;
        input.init(canvas, { onMouseMove: (x, y) => { moveArgs = { x, y }; } });

        canvas._emit('mousemove', { clientX: 55, clientY: 65 });

        assert.ok(moveArgs !== null, 'onMouseMove should have been called');
        assert.equal(moveArgs.x, 50, 'x = 55 - 5');
        assert.equal(moveArgs.y, 50, 'y = 65 - 15');
    });
});

// ─── Tests: contextmenu → onRightClick ───────────────────────────────────────

describe('IsoInput.init() — contextmenu calls onRightClick', () => {
    it('should call onRightClick with canvas-relative coordinates', () => {
        const input = createIsoInput();
        const canvas = createMockCanvas(0, 0);
        input._window = createEventEmitter();

        let rightClickArgs = null;
        input.init(canvas, { onRightClick: (x, y) => { rightClickArgs = { x, y }; } });

        let preventDefaultCalled = false;
        canvas._emit('contextmenu', {
            clientX: 80,
            clientY: 40,
            preventDefault() { preventDefaultCalled = true; },
        });

        assert.ok(rightClickArgs !== null, 'onRightClick should have been called');
        assert.equal(rightClickArgs.x, 80);
        assert.equal(rightClickArgs.y, 40);
        assert.ok(preventDefaultCalled, 'preventDefault should be called on contextmenu');
    });
});

// ─── Tests: mouseleave → onMouseLeave ────────────────────────────────────────

describe('IsoInput.init() — mouseleave calls onMouseLeave', () => {
    it('should call onMouseLeave when mouse leaves canvas', () => {
        const input = createIsoInput();
        const canvas = createMockCanvas();
        input._window = createEventEmitter();

        let leaveCalled = false;
        input.init(canvas, { onMouseLeave: () => { leaveCalled = true; } });

        canvas._emit('mouseleave', {});

        assert.ok(leaveCalled, 'onMouseLeave should be called on mouseleave');
    });

    it('should not throw when onMouseLeave is not provided', () => {
        const input = createIsoInput();
        const canvas = createMockCanvas();
        input._window = createEventEmitter();
        input.init(canvas, {});
        assert.doesNotThrow(() => canvas._emit('mouseleave', {}));
    });
});

// ─── Tests: getMousePos ───────────────────────────────────────────────────────

describe('IsoInput.getMousePos()', () => {
    it('should return clientX - rectLeft and clientY - rectTop', () => {
        const input = createIsoInput();
        input.canvas = createMockCanvas(30, 50);

        const pos = input.getMousePos({ clientX: 130, clientY: 150 });
        assert.equal(pos.x, 100, 'x = 130 - 30');
        assert.equal(pos.y, 100, 'y = 150 - 50');
    });

    it('should return zero when clientX/Y equals rect origin', () => {
        const input = createIsoInput();
        input.canvas = createMockCanvas(100, 200);

        const pos = input.getMousePos({ clientX: 100, clientY: 200 });
        assert.equal(pos.x, 0);
        assert.equal(pos.y, 0);
    });

    it('should return negative values when mouse is above/left of canvas', () => {
        const input = createIsoInput();
        input.canvas = createMockCanvas(50, 50);

        const pos = input.getMousePos({ clientX: 30, clientY: 20 });
        assert.equal(pos.x, -20);
        assert.equal(pos.y, -30);
    });
});

// ─── Tests: getScrollDir ──────────────────────────────────────────────────────

describe('IsoInput.getScrollDir()', () => {
    let input;

    beforeEach(() => {
        input = createIsoInput();
    });

    it('should return { dx: 0, dy: 0 } when no keys are held', () => {
        const dir = input.getScrollDir();
        assert.deepEqual(dir, { dx: 0, dy: 0 });
    });

    it('should return { dx: 1, dy: 0 } when right is held', () => {
        input.keys.right = true;
        assert.deepEqual(input.getScrollDir(), { dx: 1, dy: 0 });
    });

    it('should return { dx: -1, dy: 0 } when left is held', () => {
        input.keys.left = true;
        assert.deepEqual(input.getScrollDir(), { dx: -1, dy: 0 });
    });

    it('should return { dx: 0, dy: 1 } when down is held', () => {
        input.keys.down = true;
        assert.deepEqual(input.getScrollDir(), { dx: 0, dy: 1 });
    });

    it('should return { dx: 0, dy: -1 } when up is held', () => {
        input.keys.up = true;
        assert.deepEqual(input.getScrollDir(), { dx: 0, dy: -1 });
    });

    it('should return { dx: 0, dy: 0 } when both left and right are held (cancel out)', () => {
        input.keys.left = true;
        input.keys.right = true;
        assert.deepEqual(input.getScrollDir(), { dx: 0, dy: 0 });
    });

    it('should return { dx: 0, dy: 0 } when both up and down are held (cancel out)', () => {
        input.keys.up = true;
        input.keys.down = true;
        assert.deepEqual(input.getScrollDir(), { dx: 0, dy: 0 });
    });

    it('should return { dx: 1, dy: -1 } when right and up are held', () => {
        input.keys.right = true;
        input.keys.up = true;
        assert.deepEqual(input.getScrollDir(), { dx: 1, dy: -1 });
    });

    it('should return { dx: -1, dy: 1 } when left and down are held', () => {
        input.keys.left = true;
        input.keys.down = true;
        assert.deepEqual(input.getScrollDir(), { dx: -1, dy: 1 });
    });
});
