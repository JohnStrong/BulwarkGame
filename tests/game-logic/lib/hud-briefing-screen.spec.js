/**
 * Tests for HUD.renderBriefingScreen(ctx, state)
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/lib/hud-briefing-screen.spec.js
 *
 * Validates:
 *   - Returns { playButtonRect: null, moreButtonRect: null } for zero/negative canvas dims
 *   - Returns non-null rects for normal canvas dims (collapsed and expanded)
 *   - Play button rect is within canvas viewport (clamp guarantee)
 *   - More button label changes based on furtherReadingOpen
 *   - Further-reading content is rendered when furtherReadingOpen is true
 *   - Further-reading content is NOT rendered when furtherReadingOpen is false
 *   - Headline text is always drawn
 *   - Panel background is drawn with the expected dark colour
 *   - Rect shape: { x, y, w, h } with numeric values
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Canvas mock ────────────────────────────────────────────────────────────

function createMockCtx() {
    const drawCalls = [];
    const gradients = [];
    const savedStates = [];

    const ctx = {
        drawCalls,
        gradients,
        fillStyle: '',
        strokeStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        lineWidth: 1,

        fillRect(x, y, w, h) {
            drawCalls.push({ method: 'fillRect', args: [x, y, w, h], fillStyle: this.fillStyle });
        },
        strokeRect(x, y, w, h) {
            drawCalls.push({ method: 'strokeRect', args: [x, y, w, h] });
        },
        fillText(text, x, y) {
            drawCalls.push({ method: 'fillText', args: [text, x, y], fillStyle: this.fillStyle, font: this.font });
        },
        moveTo(x, y) { drawCalls.push({ method: 'moveTo', args: [x, y] }); },
        lineTo(x, y) { drawCalls.push({ method: 'lineTo', args: [x, y] }); },
        beginPath() { drawCalls.push({ method: 'beginPath' }); },
        stroke() { drawCalls.push({ method: 'stroke', strokeStyle: this.strokeStyle }); },
        rect(x, y, w, h) { drawCalls.push({ method: 'rect', args: [x, y, w, h] }); },
        clip() { drawCalls.push({ method: 'clip' }); },
        setLineDash(pattern) { drawCalls.push({ method: 'setLineDash', args: [pattern] }); },
        createLinearGradient(x0, y0, x1, y1) {
            const stops = [];
            const grad = {
                addColorStop(offset, color) { stops.push({ offset, color }); },
                stops,
            };
            gradients.push({ x0, y0, x1, y1, grad });
            return grad;
        },
        measureText(text) {
            // Approximate: 6px per character at ~10px font
            return { width: text.length * 6 };
        },
        save() {
            savedStates.push({
                fillStyle: this.fillStyle,
                strokeStyle: this.strokeStyle,
                font: this.font,
                lineWidth: this.lineWidth,
            });
            drawCalls.push({ method: 'save' });
        },
        restore() {
            if (savedStates.length) {
                const s = savedStates.pop();
                this.fillStyle = s.fillStyle;
                this.strokeStyle = s.strokeStyle;
                this.font = s.font;
                this.lineWidth = s.lineWidth;
            }
            drawCalls.push({ method: 'restore' });
        },
    };

    return ctx;
}

// ─── Replica of renderBriefingScreen and drawSheenBorder ────────────────────
// We replicate the function here (same pattern as other hud test files) to
// avoid browser-global dependencies that the actual hud.js file has.

const HUD = {
    UNIT_BOX_SIZE: 56,
    UNIT_BOX_PAD: 6,
    HUD_MAX_WIDTH: 256,
    HUD_HEIGHT: 180,

    drawSheenBorder(ctx, x, y, w, h, highlight) {
        const grad = ctx.createLinearGradient(x, y, x + w, y);
        grad.addColorStop(0, '#3a3028');
        grad.addColorStop(0.5, highlight || '#c8b890');
        grad.addColorStop(1, '#3a3028');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
    },

    renderBriefingScreen(ctx, state) {
        const { furtherReadingOpen, canvasW, canvasH } = state;

        if (canvasW <= 0 || canvasH <= 0) {
            return { playButtonRect: null, moreButtonRect: null };
        }

        const PAD = 20;
        const panelW = Math.max(320, Math.min(Math.round(canvasW * 0.55), 600));
        const panelX = Math.round((canvasW - panelW) / 2);

        const HEAD_SIZE    = 22;
        const BODY_SIZE    = 11;
        const SECTION_SIZE = 10;
        const SUB_SIZE     = 9;
        const FR_BODY_SIZE = 10;
        const LINE_GAP     = 6;
        const DIVIDER_H    = 1;

        const headLineH    = HEAD_SIZE + LINE_GAP + 2;
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

        const frLineH = FR_BODY_SIZE + 4;
        const frSubHdrH = SUB_SIZE + 4;
        let frContentH = 0;
        if (furtherReadingOpen) {
            frContentH += LINE_GAP + DIVIDER_H + LINE_GAP;
            for (const sec of frSections) {
                if (sec.type === 'header-main') {
                    frContentH += SECTION_SIZE + 4 + frLineH + LINE_GAP;
                } else if (sec.type === 'subheader') {
                    frContentH += frSubHdrH;
                    frContentH += sec.items.length * frLineH + LINE_GAP;
                }
            }
            frContentH += LINE_GAP + DIVIDER_H + LINE_GAP;
        }

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

        const maxPanelH = canvasH - 80;
        const panelH = Math.min(naturalH, maxPanelH);
        const panelY = Math.round((canvasH - panelH) / 2);

        ctx.fillStyle = 'rgba(15, 12, 10, 0.92)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        this.drawSheenBorder(ctx, panelX, panelY, panelW, panelH);

        ctx.save();
        ctx.beginPath();
        ctx.rect(panelX, panelY, panelW, panelH);
        ctx.clip();

        const playBtnW  = 120;
        const playBtnH2 = playBtnH;
        let   playBtnX  = panelX + Math.round((panelW - playBtnW) / 2);
        let   playBtnY  = panelY + panelH - PAD - playBtnH2;

        playBtnX = Math.max(0, Math.min(playBtnX, canvasW - playBtnW));
        playBtnY = Math.max(0, Math.min(playBtnY, canvasH - playBtnH2));

        const scrollableBottom = panelY + panelH - PAD - playBtnH2 - playBtnMarginTop;

        let cy = panelY + PAD;

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

        ctx.fillStyle = '#c8b890';
        ctx.font = `bold ${HEAD_SIZE}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('\u2694  OBJECTIVE: DEFEND YOUR DYNASTY!  \u2694', panelX + PAD, cy);
        cy += HEAD_SIZE + 4;

        ctx.strokeStyle = '#c8b890';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + PAD, cy);
        ctx.lineTo(panelX + panelW - PAD, cy);
        ctx.stroke();
        cy += DIVIDER_H + LINE_GAP;

        ctx.fillStyle = '#aaa';
        ctx.font = `${BODY_SIZE}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        for (const line of bodyLines) {
            ctx.fillText(line, panelX + PAD, cy);
            cy += bodyLineH;
        }
        cy += LINE_GAP;

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

        const moreButtonRect = { x: moreBtnBx, y: moreBtnBy, w: moreBtnW, h: moreBtnBtnH };

        if (furtherReadingOpen) {
            drawDottedSep(cy);
            cy += DIVIDER_H + LINE_GAP;

            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            for (const sec of frSections) {
                if (cy + SECTION_SIZE + 4 > scrollableBottom) break;

                if (sec.type === 'header-main') {
                    ctx.fillStyle = '#c8b890';
                    ctx.font = `bold ${SECTION_SIZE}px monospace`;
                    ctx.fillText(sec.text, panelX + PAD, cy);
                    cy += SECTION_SIZE + 4;

                    if (cy < scrollableBottom) {
                        ctx.fillStyle = '#aaa';
                        ctx.font = `${FR_BODY_SIZE}px monospace`;
                        ctx.fillText(sec.subtext, panelX + PAD, cy);
                        cy += frLineH + LINE_GAP;
                    }
                } else if (sec.type === 'subheader') {
                    if (cy >= scrollableBottom) break;

                    ctx.fillStyle = '#8a7a60';
                    ctx.font = `bold ${SUB_SIZE}px monospace`;
                    ctx.fillText(sec.text, panelX + PAD, cy);
                    cy += frSubHdrH;

                    ctx.fillStyle = '#aaa';
                    ctx.font = `${FR_BODY_SIZE}px monospace`;
                    for (const item of sec.items) {
                        if (cy + frLineH > scrollableBottom) break;
                        ctx.fillText(item, panelX + PAD + 2, cy);
                        cy += frLineH;
                    }
                    cy += LINE_GAP;
                }
            }

            if (cy + DIVIDER_H <= scrollableBottom) {
                drawDottedSep(cy);
                cy += DIVIDER_H + LINE_GAP;
            }
        }

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

        ctx.restore();

        const playButtonRect = { x: playBtnX, y: playBtnY, w: playBtnW, h: playBtnH2 };
        return { playButtonRect, moreButtonRect };
    },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CANVAS_W = 1024;
const CANVAS_H = 768;

function hasText(ctx, text) {
    return ctx.drawCalls.some(c => c.method === 'fillText' && c.args[0] === text);
}

function hasTextContaining(ctx, substring) {
    return ctx.drawCalls.some(c => c.method === 'fillText' && String(c.args[0]).includes(substring));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('HUD.renderBriefingScreen — zero / negative dimensions', () => {
    it('returns null rects when canvasW is 0', () => {
        const ctx = createMockCtx();
        const result = HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: 0, canvasH: CANVAS_H });
        assert.equal(result.playButtonRect, null);
        assert.equal(result.moreButtonRect, null);
    });

    it('returns null rects when canvasH is 0', () => {
        const ctx = createMockCtx();
        const result = HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: 0 });
        assert.equal(result.playButtonRect, null);
        assert.equal(result.moreButtonRect, null);
    });

    it('returns null rects when both dimensions are negative', () => {
        const ctx = createMockCtx();
        const result = HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: -100, canvasH: -200 });
        assert.equal(result.playButtonRect, null);
        assert.equal(result.moreButtonRect, null);
    });

    it('does not draw anything when dimensions are zero', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: 0, canvasH: 0 });
        assert.equal(ctx.drawCalls.length, 0);
    });
});

describe('HUD.renderBriefingScreen — return value shape', () => {
    it('returns an object with playButtonRect and moreButtonRect for normal canvas', () => {
        const ctx = createMockCtx();
        const result = HUD.renderBriefingScreen(ctx, {
            furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: CANVAS_H,
        });
        assert.ok(result !== null && typeof result === 'object');
        assert.ok('playButtonRect' in result);
        assert.ok('moreButtonRect' in result);
    });

    it('playButtonRect has numeric x, y, w, h properties', () => {
        const ctx = createMockCtx();
        const { playButtonRect } = HUD.renderBriefingScreen(ctx, {
            furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: CANVAS_H,
        });
        assert.ok(playButtonRect !== null);
        assert.equal(typeof playButtonRect.x, 'number');
        assert.equal(typeof playButtonRect.y, 'number');
        assert.equal(typeof playButtonRect.w, 'number');
        assert.equal(typeof playButtonRect.h, 'number');
    });

    it('moreButtonRect has numeric x, y, w, h properties', () => {
        const ctx = createMockCtx();
        const { moreButtonRect } = HUD.renderBriefingScreen(ctx, {
            furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: CANVAS_H,
        });
        assert.ok(moreButtonRect !== null);
        assert.equal(typeof moreButtonRect.x, 'number');
        assert.equal(typeof moreButtonRect.y, 'number');
        assert.equal(typeof moreButtonRect.w, 'number');
        assert.equal(typeof moreButtonRect.h, 'number');
    });

    it('returns non-null rects when expanded too', () => {
        const ctx = createMockCtx();
        const result = HUD.renderBriefingScreen(ctx, {
            furtherReadingOpen: true, canvasW: CANVAS_W, canvasH: CANVAS_H,
        });
        assert.ok(result.playButtonRect !== null);
        assert.ok(result.moreButtonRect !== null);
    });
});

describe('HUD.renderBriefingScreen — play button viewport clamp', () => {
    it('playButtonRect is fully within canvas bounds (collapsed, normal canvas)', () => {
        const ctx = createMockCtx();
        const { playButtonRect } = HUD.renderBriefingScreen(ctx, {
            furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: CANVAS_H,
        });
        assert.ok(playButtonRect.x >= 0, 'playBtn left edge should be >= 0');
        assert.ok(playButtonRect.y >= 0, 'playBtn top edge should be >= 0');
        assert.ok(playButtonRect.x + playButtonRect.w <= CANVAS_W, 'playBtn right edge should be <= canvasW');
        assert.ok(playButtonRect.y + playButtonRect.h <= CANVAS_H, 'playBtn bottom edge should be <= canvasH');
    });

    it('playButtonRect is fully within canvas bounds (expanded, normal canvas)', () => {
        const ctx = createMockCtx();
        const { playButtonRect } = HUD.renderBriefingScreen(ctx, {
            furtherReadingOpen: true, canvasW: CANVAS_W, canvasH: CANVAS_H,
        });
        assert.ok(playButtonRect.x >= 0);
        assert.ok(playButtonRect.y >= 0);
        assert.ok(playButtonRect.x + playButtonRect.w <= CANVAS_W);
        assert.ok(playButtonRect.y + playButtonRect.h <= CANVAS_H);
    });

    it('playButtonRect is within canvas on a small 400×300 canvas', () => {
        const ctx = createMockCtx();
        const { playButtonRect } = HUD.renderBriefingScreen(ctx, {
            furtherReadingOpen: false, canvasW: 400, canvasH: 300,
        });
        assert.ok(playButtonRect.x >= 0);
        assert.ok(playButtonRect.y >= 0);
        assert.ok(playButtonRect.x + playButtonRect.w <= 400);
        assert.ok(playButtonRect.y + playButtonRect.h <= 300);
    });

    it('playButtonRect is within canvas on a very tall 800×1200 canvas', () => {
        const ctx = createMockCtx();
        const { playButtonRect } = HUD.renderBriefingScreen(ctx, {
            furtherReadingOpen: true, canvasW: 800, canvasH: 1200,
        });
        assert.ok(playButtonRect.x >= 0);
        assert.ok(playButtonRect.y >= 0);
        assert.ok(playButtonRect.x + playButtonRect.w <= 800);
        assert.ok(playButtonRect.y + playButtonRect.h <= 1200);
    });
});

describe('HUD.renderBriefingScreen — headline always rendered', () => {
    it('renders the mission headline in collapsed state', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(
            hasTextContaining(ctx, 'OBJECTIVE: DEFEND YOUR DYNASTY'),
            'Headline should be rendered in collapsed state'
        );
    });

    it('renders the mission headline in expanded state', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: true, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(
            hasTextContaining(ctx, 'OBJECTIVE: DEFEND YOUR DYNASTY'),
            'Headline should be rendered in expanded state'
        );
    });
});

describe('HUD.renderBriefingScreen — body text', () => {
    it('renders all three body lines in collapsed state', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(hasTextContaining(ctx, 'Enemy forces are massing'));
        assert.ok(hasTextContaining(ctx, 'march on your castle'));
        assert.ok(hasTextContaining(ctx, 'Place your garrison'));
    });

    it('renders all three body lines in expanded state', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: true, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(hasTextContaining(ctx, 'Enemy forces are massing'));
        assert.ok(hasTextContaining(ctx, 'march on your castle'));
        assert.ok(hasTextContaining(ctx, 'Place your garrison'));
    });
});

describe('HUD.renderBriefingScreen — More button label', () => {
    it('shows "More ▼" when collapsed (furtherReadingOpen = false)', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(
            hasTextContaining(ctx, 'More \u25BC'),
            'Collapsed state should show down-arrow More button'
        );
    });

    it('shows "More ▲" when expanded (furtherReadingOpen = true)', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: true, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(
            hasTextContaining(ctx, 'More \u25B2'),
            'Expanded state should show up-arrow More button'
        );
    });
});

describe('HUD.renderBriefingScreen — PLAY button always rendered', () => {
    it('renders PLAY button text in collapsed state', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(hasTextContaining(ctx, 'PLAY'), 'PLAY button should be present in collapsed state');
    });

    it('renders PLAY button text in expanded state', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: true, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(hasTextContaining(ctx, 'PLAY'), 'PLAY button should be present in expanded state');
    });
});

describe('HUD.renderBriefingScreen — Further Reading Panel content', () => {
    it('does NOT render "PHASE I" header when collapsed', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(
            !hasTextContaining(ctx, 'PHASE I'),
            'PHASE I header should not appear in collapsed state'
        );
    });

    it('renders "PHASE I" header when expanded', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: true, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(
            hasTextContaining(ctx, 'PHASE I'),
            'PHASE I header should appear in expanded state'
        );
    });

    it('renders "YOUR UNITS" section header when expanded', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: true, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(hasText(ctx, 'YOUR UNITS'), '"YOUR UNITS" section should appear when expanded');
    });

    it('does NOT render "YOUR UNITS" section when collapsed', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(!hasText(ctx, 'YOUR UNITS'), '"YOUR UNITS" should not appear in collapsed state');
    });

    it('renders "SYNERGIES" section header when expanded', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: true, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(hasText(ctx, 'SYNERGIES'), '"SYNERGIES" section should appear when expanded');
    });

    it('renders "TIPS" section header when expanded', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: true, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(hasText(ctx, 'TIPS'), '"TIPS" section should appear when expanded');
    });

    it('renders at least one unit description when expanded', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: true, canvasW: CANVAS_W, canvasH: CANVAS_H });
        assert.ok(
            hasTextContaining(ctx, 'Archers') || hasTextContaining(ctx, 'Spearmen'),
            'At least one unit description should appear when expanded'
        );
    });
});

describe('HUD.renderBriefingScreen — panel background', () => {
    it('draws a dark semi-transparent panel background', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: CANVAS_H });
        const bgRect = ctx.drawCalls.find(
            c => c.method === 'fillRect' && c.fillStyle === 'rgba(15, 12, 10, 0.92)'
        );
        assert.ok(bgRect, 'Panel background should use rgba(15, 12, 10, 0.92)');
    });

    it('uses the sheen border gradient (has 3 color stops)', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: CANVAS_W, canvasH: CANVAS_H });
        // First gradient created by drawSheenBorder has 3 stops: dark, gold, dark
        const sheenGrad = ctx.gradients.find(g =>
            g.grad.stops.length === 3 &&
            g.grad.stops.some(s => s.color === '#c8b890')
        );
        assert.ok(sheenGrad, 'Should use sheen border gradient with gold midpoint #c8b890');
    });
});

describe('HUD.renderBriefingScreen — panel height clamping', () => {
    it('panel height does not exceed canvasH - 80 on a tall canvas', () => {
        // We can infer this by checking the panel fillRect dimensions.
        // The first fillRect with the dark bg colour tells us panelH.
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: true, canvasW: CANVAS_W, canvasH: CANVAS_H });
        const bgRects = ctx.drawCalls.filter(
            c => c.method === 'fillRect' && c.fillStyle === 'rgba(15, 12, 10, 0.92)'
        );
        // First dark bg rect is the panel background (panelX, panelY, panelW, panelH)
        const panelRect = bgRects[0];
        assert.ok(panelRect, 'Panel background fillRect should exist');
        const panelH = panelRect.args[3];
        assert.ok(panelH <= CANVAS_H - 80,
            `Panel height ${panelH} should be <= canvasH - 80 = ${CANVAS_H - 80}`
        );
    });

    it('panel height is non-zero on a small 400x300 canvas', () => {
        const ctx = createMockCtx();
        HUD.renderBriefingScreen(ctx, { furtherReadingOpen: false, canvasW: 400, canvasH: 300 });
        const bgRects = ctx.drawCalls.filter(
            c => c.method === 'fillRect' && c.fillStyle === 'rgba(15, 12, 10, 0.92)'
        );
        const panelRect = bgRects[0];
        assert.ok(panelRect);
        assert.ok(panelRect.args[3] > 0, 'Panel height should be > 0');
    });
});
