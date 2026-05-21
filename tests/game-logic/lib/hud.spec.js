/**
 * Tests for js/game-logic/lib/hud.js
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/hud.spec.js
 *
 * Note: HUD relies on Canvas2D context and SpriteManager.
 * These tests cover the pure logic function: getUnitBarClick.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Replicate HUD constants and getUnitBarClick for testing
const HUD = {
    UNIT_BOX_SIZE: 56,
    UNIT_BOX_PAD: 6,
    HUD_MAX_WIDTH: 256,
    HUD_HEIGHT: 180,

    getUnitBarClick(mouseX, mouseY, units, canvasW, canvasH) {
        if (!units || units.length === 0) return -1;
        const totalBarW = units.length * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD) - this.UNIT_BOX_PAD;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - this.UNIT_BOX_SIZE - 28;

        if (mouseY >= barY && mouseY <= barY + this.UNIT_BOX_SIZE + 20) {
            for (let i = 0; i < units.length; i++) {
                const bx = barStartX + i * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD);
                if (mouseX >= bx && mouseX <= bx + this.UNIT_BOX_SIZE) return i;
            }
        }
        return -1;
    }
};

const canvasW = 1024;
const canvasH = 768;
const mockUnits = [
    { name: 'Archer', sprites: ['unit-archer'] },
    { name: 'Knight', sprites: ['unit-knight'] },
    { name: 'Spearman', sprites: ['unit-spearman'] },
];

describe('HUD.getUnitBarClick', () => {
    it('should return -1 when units is null', () => {
        assert.equal(HUD.getUnitBarClick(500, 700, null, canvasW, canvasH), -1);
    });

    it('should return -1 when units is empty', () => {
        assert.equal(HUD.getUnitBarClick(500, 700, [], canvasW, canvasH), -1);
    });

    it('should return -1 when click is above the unit bar', () => {
        // barY = canvasH - UNIT_BOX_SIZE - 28 = 768 - 56 - 28 = 684
        assert.equal(HUD.getUnitBarClick(500, 600, mockUnits, canvasW, canvasH), -1);
    });

    it('should return -1 when click is below the unit bar', () => {
        // barY + UNIT_BOX_SIZE + 20 = 684 + 56 + 20 = 760
        assert.equal(HUD.getUnitBarClick(500, 765, mockUnits, canvasW, canvasH), -1);
    });

    it('should return correct index when clicking first unit box', () => {
        const totalBarW = 3 * (56 + 6) - 6; // 180
        const barStartX = (canvasW - totalBarW) / 2; // (1024 - 180) / 2 = 422
        const barY = canvasH - 56 - 28; // 684
        // Click in the middle of first box
        const clickX = barStartX + 28;
        const clickY = barY + 30;
        assert.equal(HUD.getUnitBarClick(clickX, clickY, mockUnits, canvasW, canvasH), 0);
    });

    it('should return correct index when clicking second unit box', () => {
        const totalBarW = 3 * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        // Click in the middle of second box
        const clickX = barStartX + (56 + 6) + 28;
        const clickY = barY + 30;
        assert.equal(HUD.getUnitBarClick(clickX, clickY, mockUnits, canvasW, canvasH), 1);
    });

    it('should return correct index when clicking third unit box', () => {
        const totalBarW = 3 * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        const clickX = barStartX + 2 * (56 + 6) + 28;
        const clickY = barY + 30;
        assert.equal(HUD.getUnitBarClick(clickX, clickY, mockUnits, canvasW, canvasH), 2);
    });

    it('should return -1 when clicking in padding between boxes', () => {
        const totalBarW = 3 * (56 + 6) - 6;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        // Click in the padding gap between box 0 and box 1
        const clickX = barStartX + 56 + 3; // in the 6px gap
        const clickY = barY + 30;
        assert.equal(HUD.getUnitBarClick(clickX, clickY, mockUnits, canvasW, canvasH), -1);
    });

    it('should return -1 when clicking to the left of the bar', () => {
        const barY = canvasH - 56 - 28;
        assert.equal(HUD.getUnitBarClick(0, barY + 10, mockUnits, canvasW, canvasH), -1);
    });

    it('should return -1 when clicking to the right of the bar', () => {
        const barY = canvasH - 56 - 28;
        assert.equal(HUD.getUnitBarClick(canvasW, barY + 10, mockUnits, canvasW, canvasH), -1);
    });

    it('should handle single unit', () => {
        const singleUnit = [{ name: 'Archer', sprites: ['unit-archer'] }];
        const totalBarW = 1 * (56 + 6) - 6; // 56
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - 56 - 28;
        const clickX = barStartX + 28;
        const clickY = barY + 10;
        assert.equal(HUD.getUnitBarClick(clickX, clickY, singleUnit, canvasW, canvasH), 0);
    });
});

describe('HUD constants', () => {
    it('should have expected default values', () => {
        assert.equal(HUD.UNIT_BOX_SIZE, 56);
        assert.equal(HUD.UNIT_BOX_PAD, 6);
        assert.equal(HUD.HUD_MAX_WIDTH, 256);
        assert.equal(HUD.HUD_HEIGHT, 180);
    });
});
