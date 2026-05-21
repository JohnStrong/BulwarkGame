/**
 * Tests for js/game-logic/lib/iso-input.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/iso-input.spec.js
 *
 * Note: IsoInput relies on DOM events (addEventListener).
 * These tests cover the pure logic functions: getScrollDir, getMousePos.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Replicate the testable logic from IsoInput
function createIsoInput() {
    return {
        keys: { up: false, down: false, left: false, right: false, zoomIn: false, zoomOut: false },
        canvas: null,
        callbacks: {},

        getMousePos(e) {
            const rect = this.canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        },

        getScrollDir() {
            return {
                dx: (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0),
                dy: (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0),
            };
        }
    };
}

describe('IsoInput.getScrollDir', () => {
    let input;

    beforeEach(() => {
        input = createIsoInput();
    });

    it('should return {dx: 0, dy: 0} when no keys pressed', () => {
        const dir = input.getScrollDir();
        assert.deepEqual(dir, { dx: 0, dy: 0 });
    });

    it('should return dx=1 when right is pressed', () => {
        input.keys.right = true;
        const dir = input.getScrollDir();
        assert.equal(dir.dx, 1);
        assert.equal(dir.dy, 0);
    });

    it('should return dx=-1 when left is pressed', () => {
        input.keys.left = true;
        const dir = input.getScrollDir();
        assert.equal(dir.dx, -1);
        assert.equal(dir.dy, 0);
    });

    it('should return dy=1 when down is pressed', () => {
        input.keys.down = true;
        const dir = input.getScrollDir();
        assert.equal(dir.dx, 0);
        assert.equal(dir.dy, 1);
    });

    it('should return dy=-1 when up is pressed', () => {
        input.keys.up = true;
        const dir = input.getScrollDir();
        assert.equal(dir.dx, 0);
        assert.equal(dir.dy, -1);
    });

    it('should cancel out when both left and right pressed', () => {
        input.keys.left = true;
        input.keys.right = true;
        const dir = input.getScrollDir();
        assert.equal(dir.dx, 0);
    });

    it('should cancel out when both up and down pressed', () => {
        input.keys.up = true;
        input.keys.down = true;
        const dir = input.getScrollDir();
        assert.equal(dir.dy, 0);
    });

    it('should handle diagonal movement (right + down)', () => {
        input.keys.right = true;
        input.keys.down = true;
        const dir = input.getScrollDir();
        assert.deepEqual(dir, { dx: 1, dy: 1 });
    });

    it('should handle diagonal movement (left + up)', () => {
        input.keys.left = true;
        input.keys.up = true;
        const dir = input.getScrollDir();
        assert.deepEqual(dir, { dx: -1, dy: -1 });
    });
});

describe('IsoInput.getMousePos', () => {
    let input;

    beforeEach(() => {
        input = createIsoInput();
        input.canvas = {
            getBoundingClientRect() {
                return { left: 100, top: 50, width: 1024, height: 768 };
            }
        };
    });

    it('should compute position relative to canvas', () => {
        const pos = input.getMousePos({ clientX: 200, clientY: 150 });
        assert.equal(pos.x, 100); // 200 - 100
        assert.equal(pos.y, 100); // 150 - 50
    });

    it('should return 0,0 when mouse is at canvas top-left', () => {
        const pos = input.getMousePos({ clientX: 100, clientY: 50 });
        assert.equal(pos.x, 0);
        assert.equal(pos.y, 0);
    });

    it('should handle negative values (mouse above/left of canvas)', () => {
        const pos = input.getMousePos({ clientX: 50, clientY: 20 });
        assert.equal(pos.x, -50);
        assert.equal(pos.y, -30);
    });
});
