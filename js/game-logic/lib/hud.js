/**
 * HUD System — renders all UI panels on top of the game map.
 *
 * Panels:
 *   - Top info bar (level name, controls, zoom %)
 *   - Unit bar (bottom center, unit type selection)
 *   - Unit detail panel (above unit bar, stats + actions)
 *   - Tile info panel (bottom-left, slide-in)
 *
 * Reusable: configure with unit data and callbacks.
 *
 * Usage:
 *   HUD.render(ctx, state);
 */

const HUD = {
    // Config
    UNIT_BOX_SIZE: 56,
    UNIT_BOX_PAD: 6,
    HUD_MAX_WIDTH: 256,
    HUD_HEIGHT: 180,

    /**
     * Draw the metallic gradient border (sword sheen).
     */
    drawSheenBorder(ctx, x, y, w, h, highlight) {
        const grad = ctx.createLinearGradient(x, y, x + w, y);
        grad.addColorStop(0, '#3a3028');
        grad.addColorStop(0.5, highlight || '#c8b890');
        grad.addColorStop(1, '#3a3028');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
    },

    /**
     * Render the top info bar.
     */
    renderTopBar(ctx, canvasW, text) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvasW, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, 8, 5);
    },

    /**
     * Render the unit bar (bottom center).
     * @param {Object} state — { units, selectedUnitIdx, canvasW, canvasH }
     */
    renderUnitBar(ctx, state) {
        const { units, selectedUnitIdx, canvasW, canvasH } = state;
        if (!units || units.length === 0) return;

        const totalBarW = units.length * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD) - this.UNIT_BOX_PAD;
        const barStartX = (canvasW - totalBarW) / 2;
        const barY = canvasH - this.UNIT_BOX_SIZE - 28;

        for (let i = 0; i < units.length; i++) {
            const u = units[i];
            const bx = barStartX + i * (this.UNIT_BOX_SIZE + this.UNIT_BOX_PAD);
            const by = barY;
            const isSelected = (selectedUnitIdx === i);

            // Box background
            ctx.fillStyle = isSelected ? 'rgba(40, 35, 25, 0.95)' : 'rgba(20, 18, 15, 0.85)';
            ctx.fillRect(bx, by, this.UNIT_BOX_SIZE, this.UNIT_BOX_SIZE + 20);

            // Border
            const grad = ctx.createLinearGradient(bx, by, bx + this.UNIT_BOX_SIZE, by);
            grad.addColorStop(0, '#3a3028');
            grad.addColorStop(0.5, isSelected ? '#e8c870' : '#8a7a60');
            grad.addColorStop(1, '#3a3028');
            ctx.strokeStyle = grad;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(bx, by, this.UNIT_BOX_SIZE, this.UNIT_BOX_SIZE + 20);

            // Sprite
            SpriteManager.draw(ctx, u.sprites[0], bx + 4, by + 2, this.UNIT_BOX_SIZE - 8, (this.UNIT_BOX_SIZE - 8) / 2);

            // Name
            ctx.fillStyle = '#bbb';
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(u.name.split('/')[0].split('(')[0].trim().substring(0, 8), bx + this.UNIT_BOX_SIZE / 2, by + this.UNIT_BOX_SIZE - 4);

            // Quantity
            ctx.fillStyle = u.qtyRemaining > 0 ? '#8f8' : '#f66';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(u.qtyRemaining + '/' + u.qty, bx + this.UNIT_BOX_SIZE / 2, by + this.UNIT_BOX_SIZE + 10);
        }

        return barY; // return Y position for detail panel positioning
    },

    /**
     * Render the unit detail panel (above unit bar).
     */
    renderUnitDetail(ctx, unit, canvasW, barY) {
        if (!unit) return;

        const panelW = 280, panelH = 100;
        const panelX = (canvasW - panelW) / 2;
        const panelY = barY - panelH - 8;

        // Background
        ctx.fillStyle = 'rgba(15, 12, 10, 0.92)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        this.drawSheenBorder(ctx, panelX, panelY, panelW, panelH);

        // Sprite
        SpriteManager.draw(ctx, unit.sprites[0], panelX + 8, panelY + 10, 64, 32);

        // Stats
        ctx.fillStyle = '#ddd';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const sx = panelX + 80;
        ctx.fillText(unit.name, sx, panelY + 18);
        ctx.fillStyle = '#aaa';
        ctx.fillText(`HP: ${unit.health}  ATK: ${unit.attack}  Armour: ${Math.round((1 - unit.defense) * 100)}%`, sx, panelY + 34);
        ctx.fillText(`Available: ${unit.qtyRemaining} / ${unit.qty}`, sx, panelY + 50);

        // Action buttons
        const actions = [['Q', 'Attack'], ['V', 'Defend']];
        const actionsW = actions.length * 28 + (actions.length - 1) * 10;
        const actStartX = panelX + (panelW - actionsW) / 2;
        const actY = panelY + 65;

        for (let a = 0; a < actions.length; a++) {
            const ax = actStartX + a * 38;
            ctx.fillStyle = 'rgba(60, 55, 45, 0.9)';
            ctx.fillRect(ax, actY, 24, 16);
            ctx.strokeStyle = '#8a7a60';
            ctx.lineWidth = 1;
            ctx.strokeRect(ax, actY, 24, 16);
            ctx.fillStyle = '#eee';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(actions[a][0], ax + 12, actY + 8);
        }
        ctx.fillStyle = '#888';
        ctx.font = '7px monospace';
        ctx.textBaseline = 'top';
        for (let a = 0; a < actions.length; a++) {
            ctx.fillText(actions[a][1], actStartX + a * 38 + 12, actY + 18);
        }
    },

    /**
     * Render the tile info panel (bottom-left, slide-in).
     */
    renderTilePanel(ctx, state) {
        const { hudWidth, canvasH, selectedTile, level } = state;
        if (hudWidth <= 0) return;

        const hudX = 0;
        const hudY = canvasH - this.HUD_HEIGHT;
        const w = hudWidth;
        const h = this.HUD_HEIGHT;

        // Background
        ctx.fillStyle = 'rgba(15, 12, 10, 0.92)';
        ctx.fillRect(hudX, hudY, w, h);

        // Top border
        const grad = ctx.createLinearGradient(hudX, hudY, hudX + w, hudY);
        grad.addColorStop(0, '#3a3028');
        grad.addColorStop(0.3, '#8a7a60');
        grad.addColorStop(0.5, '#c8b890');
        grad.addColorStop(0.7, '#8a7a60');
        grad.addColorStop(1, '#3a3028');
        ctx.fillStyle = grad;
        ctx.fillRect(hudX, hudY, w, 3);

        // Right edge
        const gradR = ctx.createLinearGradient(hudX + w - 3, hudY, hudX + w - 3, hudY + h);
        gradR.addColorStop(0, '#8a7a60');
        gradR.addColorStop(0.5, '#c8b890');
        gradR.addColorStop(1, '#3a3028');
        ctx.fillStyle = gradR;
        ctx.fillRect(hudX + w - 3, hudY, 3, h);

        // Close button
        ctx.fillStyle = '#666';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕', hudX + w - 12, hudY + 12);

        // Content
        if (selectedTile && w > 100) {
            ctx.fillStyle = '#aaa';
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`Tile [${selectedTile.row}, ${selectedTile.col}]`, hudX + 10, hudY + 16);

            if (level) {
                const t = level.tiles.find(t => t.row === selectedTile.row && t.col === selectedTile.col);
                if (t) {
                    ctx.fillStyle = '#ccc';
                    ctx.fillText(t.sprite, hudX + 10, hudY + 32);
                }
            }
        }
    },

    /**
     * Check if a click is inside the unit bar. Returns index or -1.
     */
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
