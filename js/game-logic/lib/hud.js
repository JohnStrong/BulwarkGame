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
 *
 * ─── Synchrony contract ──────────────────────────────────────────────────────
 * All render functions in this module MUST remain fully synchronous.
 *
 * Game._render() (game-iso.js) calls these functions and then immediately writes
 * the bounding rects they return back into the game state. Because JS is
 * single-threaded, no event handler can fire between the render call and the
 * rect write-back as long as both are synchronous. If any render function here
 * were made async, a player click could arrive between render and write-back;
 * the subsequent shallow-merge would overwrite the click's state changes with a
 * stale snapshot, silently losing it.
 *
 * Rule: never add await — or call any function that returns a Promise — inside
 * renderBriefingScreen, renderPlacementHUD, renderTopBar, renderUnitBar,
 * renderUnitDetail, or renderTilePanel.
 *
 * See: .kiro/specs/defensive-phase-hud/design.md
 *      § "The shallow-merge erasure pattern — why it's safe here but fragile by assumption"
 * ─────────────────────────────────────────────────────────────────────────────
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
     * Render the briefing screen overlay (pre-game mission brief).
     *
     * Draws the full-canvas briefing panel, including:
     *   - Mission headline and body blurb
     *   - "[ More ▼ / ▲ ]" toggle for the FurtherReadingPanel
     *   - FurtherReadingPanel content (when furtherReadingOpen is true)
     *   - "[ ▶  PLAY ]" button, always visible and viewport-clamped
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ furtherReadingOpen: boolean, canvasW: number, canvasH: number }} state
     * @returns {{ playButtonRect: {x,y,w,h}|null, moreButtonRect: {x,y,w,h}|null }}
     */
    renderBriefingScreen(ctx, state) {
        const { furtherReadingOpen, canvasW, canvasH, unitDefs } = state;

        if (canvasW <= 0 || canvasH <= 0) {
            return { playButtonRect: null, moreButtonRect: null };
        }

        // ── Panel geometry ─────────────────────────────────────────────────
        const PAD = 20;                  // inner horizontal padding
        const panelW = Math.max(320, Math.min(Math.round(canvasW * 0.55), 600));
        const panelX = Math.round((canvasW - panelW) / 2);

        // ── Measure content height so we can position the panel vertically ─
        // We will do a dry-run measurement pass first, then draw.

        // Font size constants
        const HEAD_SIZE    = 22;
        const BODY_SIZE    = 11;
        const SECTION_SIZE = 10;
        const SUB_SIZE     = 9;
        const FR_BODY_SIZE = 10;
        const LINE_GAP     = 6;  // gap between logical blocks
        const DIVIDER_H    = 1;

        // Heights of fixed elements
        const headLineH    = HEAD_SIZE + LINE_GAP + 2;      // headline + small gap
        const dividerH     = DIVIDER_H + LINE_GAP;
        const bodyLineH    = BODY_SIZE + 4;
        const bodyLines = [
            'Enemy forces are massing beyond the tree line.',
            'They will march on your castle in waves.',
            'Place your garrison and hold the walls.',
        ];
        const bodyH        = bodyLines.length * bodyLineH + LINE_GAP;
        const moreBtnH     = 20 + LINE_GAP;
        const playBtnH     = 28;
        const playBtnMarginTop = LINE_GAP * 2;

        // Further-reading content lines (pre-built for both measure and draw)
        const frSections = [
            {
                type: 'header-main',
                text: 'PHASE I \u2014 THE DEFENDER',
                subtext: 'Hold off all enemy waves to win.',
            },
            {
                type: 'subheader',
                text: 'YOUR UNITS',
                items: [
                    '\u25BA Archers/Crossbowmen \u2014 ranged, forest ambush; needs melee cover',
                    '\u25BA Spearmen/Heavy Inf. \u2014 sturdy chokepoint holders, moderate speed',
                    '\u25BA Men-at-arms \u2014 armoured sorties, breach plugging; slow',
                    '\u25BA Engineers/Militia \u2014 support; operate siege equipment',
                ],
            },
            {
                type: 'subheader',
                text: 'SYNERGIES',
                items: [
                    '\u25BA Archers need a melee shield \u2014 place Spearmen or Men-at-arms',
                    '  one tile ahead of any forested archer position',
                    '\u25BA Engineers are fragile \u2014 keep a melee unit nearby to stop',
                    '  them being overrun',
                    '\u25BA Spearmen hold the front; Men-at-arms plug breaches once',
                    '  enemies get through',
                ],
            },
            {
                type: 'subheader',
                text: 'TIPS',
                items: [
                    '\u2022 Ranged units prefer forests & high ground',
                    '\u2022 Melee units anchor gates & chokepoints',
                    '\u2022 Mix unit types \u2014 avoid single-type lines',
                ],
            },
        ];

        // Compute further-reading height
        const frLineH = FR_BODY_SIZE + 4;
        const frSubHdrH = SUB_SIZE + 4;
        const SPRITE_GRID_W = 48, SPRITE_GRID_H = 28, SPRITE_GRID_GAP = 6;
        const SPRITE_GRID_ROW_H = SPRITE_GRID_H + 14;
        let frContentH = 0;
        if (furtherReadingOpen) {
            frContentH += LINE_GAP + DIVIDER_H + LINE_GAP; // dotted separator after More btn
            for (const sec of frSections) {
                if (sec.type === 'header-main') {
                    frContentH += SECTION_SIZE + 4 + frLineH + LINE_GAP;
                } else if (sec.type === 'subheader') {
                    frContentH += frSubHdrH;
                    // YOUR UNITS gets an extra sprite grid row
                    if (sec.text === 'YOUR UNITS' && unitDefs && unitDefs.length > 0) {
                        const gridCols = Math.min(unitDefs.length, 4);
                        const gridRows = Math.ceil(unitDefs.length / gridCols);
                        frContentH += gridRows * SPRITE_GRID_ROW_H + LINE_GAP;
                    }
                    frContentH += sec.items.length * frLineH + LINE_GAP;
                }
            }
            frContentH += LINE_GAP + DIVIDER_H + LINE_GAP; // trailing dotted separator
        }

        // Total natural panel height
        const naturalH =
            PAD +
            headLineH +
            dividerH +
            bodyH +
            moreBtnH +
            frContentH +
            playBtnMarginTop +
            playBtnH +
            PAD;

        // Clamp to canvas minus breathing room
        const maxPanelH = canvasH - 80;
        const panelH = Math.min(naturalH, maxPanelH);

        // Centre panel vertically (slight bias toward upper half looks better)
        const panelY = Math.round((canvasH - panelH) / 2);

        // ── Background ────────────────────────────────────────────────────
        ctx.fillStyle = 'rgba(15, 12, 10, 0.92)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        this.drawSheenBorder(ctx, panelX, panelY, panelW, panelH);

        // ── Clipping region so tall content doesn't bleed outside the panel ─
        ctx.save();
        ctx.beginPath();
        ctx.rect(panelX, panelY, panelW, panelH);
        ctx.clip();

        // ── Play button geometry (always at panel bottom, clamped) ────────
        const playBtnW     = 120;
        const playBtnH2    = playBtnH;
        let   playBtnX     = panelX + Math.round((panelW - playBtnW) / 2);
        let   playBtnY     = panelY + panelH - PAD - playBtnH2;

        // Viewport clamp: keep play button fully inside canvas
        playBtnX = Math.max(0, Math.min(playBtnX, canvasW - playBtnW));
        playBtnY = Math.max(0, Math.min(playBtnY, canvasH - playBtnH2));

        // We need to reserve space for the play button at the bottom of the
        // clipping region; define a scrollable content area above it.
        const scrollableBottom = panelY + panelH - PAD - playBtnH2 - playBtnMarginTop;

        // ── Drawing cursor ────────────────────────────────────────────────
        let cy = panelY + PAD;

        // Helper: draw a dotted horizontal separator
        const drawDottedSep = (yPos) => {
            ctx.save();
            ctx.setLineDash([2, 4]);
            ctx.strokeStyle = 'rgba(200,184,144,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(panelX + PAD, yPos);
            ctx.lineTo(panelX + panelW - PAD, yPos);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        };

        // ── Headline ──────────────────────────────────────────────────────
        ctx.fillStyle = '#c8b890';
        ctx.font = `bold ${HEAD_SIZE}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('\u2694  OBJECTIVE: DEFEND YOUR DYNASTY!  \u2694', panelX + PAD, cy);
        cy += HEAD_SIZE + 4;

        // Thin gold divider
        ctx.strokeStyle = '#c8b890';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + PAD, cy);
        ctx.lineTo(panelX + panelW - PAD, cy);
        ctx.stroke();
        cy += DIVIDER_H + LINE_GAP;

        // ── Body text ─────────────────────────────────────────────────────
        ctx.fillStyle = '#aaa';
        ctx.font = `${BODY_SIZE}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        for (const line of bodyLines) {
            ctx.fillText(line, panelX + PAD, cy);
            cy += bodyLineH;
        }
        cy += LINE_GAP;

        // ── "More" button ─────────────────────────────────────────────────
        const moreBtnLabel = furtherReadingOpen ? '[ More \u25B2 ]' : '[ More \u25BC ]';
        const moreBtnW     = 72;
        const moreBtnBtnH  = 18;
        const moreBtnBx    = panelX + PAD;
        const moreBtnBy    = cy;

        ctx.fillStyle = 'rgba(20, 18, 15, 0.85)';
        ctx.fillRect(moreBtnBx, moreBtnBy, moreBtnW, moreBtnBtnH);
        ctx.strokeStyle = '#8a7a60';
        ctx.lineWidth = 1;
        ctx.strokeRect(moreBtnBx, moreBtnBy, moreBtnW, moreBtnBtnH);
        ctx.fillStyle = '#bbb';
        ctx.font = `9px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(moreBtnLabel, moreBtnBx + moreBtnW / 2, moreBtnBy + moreBtnBtnH / 2);
        cy += moreBtnBtnH + LINE_GAP;

        // Store More button rect
        const moreButtonRect = { x: moreBtnBx, y: moreBtnBy, w: moreBtnW, h: moreBtnBtnH };

        // ── Further Reading Panel (expanded) ──────────────────────────────
        if (furtherReadingOpen) {
            // Opening dotted separator
            drawDottedSep(cy);
            cy += DIVIDER_H + LINE_GAP;

            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            for (const sec of frSections) {
                // Bail early if we've reached the play-button reserve area
                if (cy + SECTION_SIZE + 4 > scrollableBottom) break;

                if (sec.type === 'header-main') {
                    // "PHASE I — THE DEFENDER"
                    ctx.fillStyle = '#c8b890';
                    ctx.font = `bold ${SECTION_SIZE}px monospace`;
                    ctx.fillText(sec.text, panelX + PAD, cy);
                    cy += SECTION_SIZE + 4;

                    if (cy < scrollableBottom) {
                        // Sub-text "Hold off all enemy waves to win."
                        ctx.fillStyle = '#aaa';
                        ctx.font = `${FR_BODY_SIZE}px monospace`;
                        ctx.fillText(sec.subtext, panelX + PAD, cy);
                        cy += frLineH + LINE_GAP;
                    }
                } else if (sec.type === 'subheader') {
                    if (cy >= scrollableBottom) break;

                    // Section header e.g. "YOUR UNITS"
                    ctx.fillStyle = '#8a7a60';
                    ctx.font = `bold ${SUB_SIZE}px monospace`;
                    ctx.fillText(sec.text, panelX + PAD, cy);
                    cy += frSubHdrH;

                    // YOUR UNITS — render a sprite grid before the text list
                    if (sec.text === 'YOUR UNITS' && unitDefs && unitDefs.length > 0) {
                        const SPRITE_W = 48, SPRITE_H = 28, SPRITE_GAP = 6;
                        const gridCols = Math.min(unitDefs.length, 4);
                        const gridW = gridCols * (SPRITE_W + SPRITE_GAP) - SPRITE_GAP;
                        const gridStartX = panelX + PAD + 2;
                        const gridY = cy;
                        const gridRowH = SPRITE_H + 14; // sprite + name label

                        for (let ui = 0; ui < unitDefs.length; ui++) {
                            const ud = unitDefs[ui];
                            const col = ui % gridCols;
                            const row = Math.floor(ui / gridCols);
                            if (gridY + row * gridRowH + gridRowH > scrollableBottom) break;

                            const sx = gridStartX + col * (SPRITE_W + SPRITE_GAP);
                            const sy = gridY + row * gridRowH;

                            // Box background
                            ctx.fillStyle = 'rgba(30, 25, 18, 0.75)';
                            ctx.fillRect(sx, sy, SPRITE_W, SPRITE_H + 12);
                            ctx.strokeStyle = '#5a4a38';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(sx, sy, SPRITE_W, SPRITE_H + 12);

                            // Sprite
                            if (ud.sprites && ud.sprites[0]) {
                                try {
                                    SpriteManager.draw(ctx, ud.sprites[0], sx + 2, sy + 2, SPRITE_W - 4, SPRITE_H - 4);
                                } catch (_) { /* sprite not yet loaded */ }
                            }

                            // Short name label beneath sprite
                            ctx.fillStyle = '#aaa';
                            ctx.font = '7px monospace';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'alphabetic';
                            const label = (ud.name || '').split('/')[0].split('(')[0].trim().substring(0, 9);
                            ctx.fillText(label, sx + SPRITE_W / 2, sy + SPRITE_H + 10);
                        }

                        const rows = Math.ceil(unitDefs.length / gridCols);
                        cy += rows * gridRowH + LINE_GAP;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'top';
                    }

                    // Body items (text descriptions)
                    ctx.fillStyle = '#aaa';
                    ctx.font = `${FR_BODY_SIZE}px monospace`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    for (const item of sec.items) {
                        if (cy + frLineH > scrollableBottom) break;
                        ctx.fillText(item, panelX + PAD + 2, cy);
                        cy += frLineH;
                    }
                    cy += LINE_GAP;
                }
            }

            // Trailing dotted separator (only if space)
            if (cy + DIVIDER_H <= scrollableBottom) {
                drawDottedSep(cy);
                cy += DIVIDER_H + LINE_GAP;
            }
        }

        // ── "PLAY" button ─────────────────────────────────────────────────
        // Draw at clamped position (already computed above)
        const grad = ctx.createLinearGradient(playBtnX, playBtnY, playBtnX + playBtnW, playBtnY);
        grad.addColorStop(0, '#3a3028');
        grad.addColorStop(0.5, '#c8b890');
        grad.addColorStop(1, '#3a3028');

        ctx.fillStyle = 'rgba(30, 25, 18, 0.92)';
        ctx.fillRect(playBtnX, playBtnY, playBtnW, playBtnH2);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(playBtnX, playBtnY, playBtnW, playBtnH2);
        ctx.fillStyle = '#eee';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u25B6  PLAY', playBtnX + playBtnW / 2, playBtnY + playBtnH2 / 2);

        ctx.restore(); // remove clip

        const playButtonRect = { x: playBtnX, y: playBtnY, w: playBtnW, h: playBtnH2 };
        return { playButtonRect, moreButtonRect };
    },

    /**
     * Render the placement-phase top bar.
     *
     * Draws a 20 px bar at y=0 containing:
     *   - "PLACE YOUR UNITS" label — left-aligned at x=8
     *   - "⏱ M:SS" countdown timer — centred horizontally
     *     (text turns #f88 when secondsRemaining ≤ 5)
     *   - "[ ✓ Ready ]" button — right-aligned with ~8 px margin
     *     (border and text turn gold #c8b890 when secondsRemaining ≤ 10)
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ secondsRemaining: number, canvasW: number, canvasH: number }} state
     * @returns {{ readyButtonRect: {x:number,y:number,w:number,h:number}|null }}
     */
    renderPlacementHUD(ctx, state) {
        const { secondsRemaining, canvasW, canvasH } = state;

        if (canvasW <= 0 || canvasH <= 0) {
            return { readyButtonRect: null };
        }

        const barH = 20;

        // Background — same as renderTopBar
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvasW, barH);

        ctx.font = '11px monospace';
        ctx.textBaseline = 'top';

        // 1. "PLACE YOUR UNITS" label — left-aligned
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText('PLACE YOUR UNITS', 8, 5);

        // 2. Timer — centred, red-tinted when ≤ 5 s
        const mins = Math.floor(secondsRemaining / 60);
        const secs = secondsRemaining % 60;
        const secsStr = secs < 10 ? '0' + secs : '' + secs;
        const timerText = '\u23F1 ' + mins + ':' + secsStr;

        ctx.fillStyle = secondsRemaining <= 5 ? '#f88' : '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(timerText, canvasW / 2, 5);

        // 3. "[ ✓ Ready ]" button — right-aligned, gold when ≤ 10 s
        const isUrgent = secondsRemaining <= 10;
        const btnColour = isUrgent ? '#c8b890' : '#8a7a60';
        const btnText = '[ \u2713 Ready ]';

        ctx.textAlign = 'right';
        // Measure text width to compute the bounding rect
        const textW = ctx.measureText(btnText).width;
        const btnPadX = 4;
        const btnPadY = 2;
        const btnW = textW + btnPadX * 2;
        const btnH = 11 + btnPadY * 2; // font size + vertical padding × 2
        const btnX = canvasW - 8 - btnW;
        const btnY = (barH - btnH) / 2;

        // Draw button background (subtle, same as bar)
        ctx.fillStyle = 'rgba(0,0,0,0)'; // transparent fill — border only

        // Draw stroked border around button
        ctx.strokeStyle = btnColour;
        ctx.lineWidth = 1;
        ctx.strokeRect(btnX, btnY, btnW, btnH);

        // Draw button text
        ctx.fillStyle = btnColour;
        ctx.fillText(btnText, canvasW - 8 - btnPadX, btnPadY + 1);

        return {
            readyButtonRect: { x: btnX, y: btnY, w: btnW, h: btnH },
        };
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
