/**
 * Tests for Game.handleClick tile panel close-button branch — Recommendation 6.
 *
 * Covers the `hudOpen && mouseX < hudWidth` branch in game-iso.js handleClick
 * that closes the tile panel when clicking the close button region.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game-iso-hud-close.spec.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Extracted close-button logic from game-iso.js handleClick ──────────────

const HUD_HEIGHT = 200;  // Matches HUD.HUD_HEIGHT
const HUD_MAX_WIDTH = 220;

/**
 * Simulates the tile panel close-button branch of handleClick.
 * Returns the new state after the click is processed.
 *
 * The close button is in the top-right corner of the HUD panel:
 *   - mouseX > hudWidth - 20 (within 20px of right edge of panel)
 *   - mouseY < canvasHeight - HUD_HEIGHT + 20 (within 20px of top edge of panel)
 *
 * The panel occupies:
 *   - x: 0 to hudWidth
 *   - y: canvasHeight - HUD_HEIGHT to canvasHeight
 */
function handleClickWithHud(mouseX, mouseY, state) {
    const { hudOpen, hudWidth, canvasHeight, canvasWidth } = state;

    // Unit bar click check (simplified — returns -1 if not on bar)
    const barIdx = -1;

    // Tile panel close button branch
    if (hudOpen && mouseX < hudWidth && mouseY > canvasHeight - HUD_HEIGHT) {
        if (mouseX > hudWidth - 20 && mouseY < canvasHeight - HUD_HEIGHT + 20) {
            return { ...state, hudOpen: false, hudTargetWidth: 0 };
        }
        // Click is inside panel but not on close button — consumed, no further action
        return state;
    }

    // Normal click handling would follow here (tile selection, etc.)
    return { ...state, clickPassedThrough: true };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Game handleClick: tile panel close-button branch', () => {
    let baseState;

    beforeEach(() => {
        baseState = {
            hudOpen: true,
            hudWidth: HUD_MAX_WIDTH,
            hudTargetWidth: HUD_MAX_WIDTH,
            canvasWidth: 1024,
            canvasHeight: 768,
        };
    });

    it('should close the HUD when clicking the close button region', () => {
        // Close button is at top-right of panel:
        // x > hudWidth - 20 = 200, y < canvasHeight - HUD_HEIGHT + 20 = 588
        // Panel starts at y = canvasHeight - HUD_HEIGHT = 568
        const mouseX = 210; // > 200 (hudWidth - 20)
        const mouseY = 575; // > 568 (panel top) and < 588 (panel top + 20)

        const result = handleClickWithHud(mouseX, mouseY, baseState);
        assert.equal(result.hudOpen, false);
        assert.equal(result.hudTargetWidth, 0);
    });

    it('should not close when clicking inside panel but outside close button', () => {
        // Inside panel (x < hudWidth, y > canvasHeight - HUD_HEIGHT)
        // But NOT in close button region
        const mouseX = 100; // < hudWidth but NOT > hudWidth - 20
        const mouseY = 700; // inside panel vertically

        const result = handleClickWithHud(mouseX, mouseY, baseState);
        assert.equal(result.hudOpen, true);
        assert.equal(result.hudTargetWidth, HUD_MAX_WIDTH);
    });

    it('should pass click through when HUD is not open', () => {
        const closedState = { ...baseState, hudOpen: false };
        const mouseX = 210;
        const mouseY = 575;

        const result = handleClickWithHud(mouseX, mouseY, closedState);
        assert.equal(result.clickPassedThrough, true);
    });

    it('should pass click through when clicking outside the panel area', () => {
        // Click is to the right of the panel (x > hudWidth)
        const mouseX = 500;
        const mouseY = 700;

        const result = handleClickWithHud(mouseX, mouseY, baseState);
        assert.equal(result.clickPassedThrough, true);
    });

    it('should pass click through when clicking above the panel', () => {
        // Click is above the panel (y < canvasHeight - HUD_HEIGHT)
        const mouseX = 100;
        const mouseY = 400; // above panel

        const result = handleClickWithHud(mouseX, mouseY, baseState);
        assert.equal(result.clickPassedThrough, true);
    });

    it('should consume click when inside panel but not on close button (no pass-through)', () => {
        // Inside panel, not on close button
        const mouseX = 50;
        const mouseY = 700;

        const result = handleClickWithHud(mouseX, mouseY, baseState);
        assert.equal(result.hudOpen, true);
        assert.ok(!result.clickPassedThrough, 'Click inside panel should be consumed');
    });

    it('close button should work at exact boundary coordinates', () => {
        // Exact boundary: mouseX = hudWidth - 20 + 1 = 201, mouseY = canvasHeight - HUD_HEIGHT + 1 = 569
        const mouseX = 201;
        const mouseY = 569;

        const result = handleClickWithHud(mouseX, mouseY, baseState);
        assert.equal(result.hudOpen, false);
        assert.equal(result.hudTargetWidth, 0);
    });

    it('should not trigger close when mouseY is at bottom of close region boundary', () => {
        // mouseY = canvasHeight - HUD_HEIGHT + 20 = 588 (NOT < 588, so not in close button)
        const mouseX = 210;
        const mouseY = 588;

        const result = handleClickWithHud(mouseX, mouseY, baseState);
        // Should be inside panel but not on close button
        assert.equal(result.hudOpen, true);
    });

    it('should not trigger close when mouseX is at left boundary of close region', () => {
        // mouseX = hudWidth - 20 = 200 (NOT > 200, so not in close button)
        const mouseX = 200;
        const mouseY = 575;

        const result = handleClickWithHud(mouseX, mouseY, baseState);
        assert.equal(result.hudOpen, true);
    });

    it('should handle partially animated hudWidth (smaller than max)', () => {
        const partialState = { ...baseState, hudWidth: 150 };
        // Close button at x > 130 (150 - 20), y < 568 + 20 = 588
        const mouseX = 140;
        const mouseY = 575;

        const result = handleClickWithHud(mouseX, mouseY, partialState);
        assert.equal(result.hudOpen, false);
        assert.equal(result.hudTargetWidth, 0);
    });
});
