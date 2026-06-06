/**
 * Tests for the phase-gated camera update in Game.loop() — game-iso.js.
 *
 * The diff added a guard so that IsoCamera.scroll() and IsoCamera.applyZoom()
 * are only called when `phase === 'placement' || phase === 'active'`.
 * In 'loading' and 'briefing' phases the map must remain frozen regardless of
 * WASD/zoom input.
 *
 * These tests exercise the loop's camera-update branch in isolation by
 * replicating the exact conditional logic and verifying call counts.
 *
 * Uses Node.js built-in test runner (node:test).
 * Run: node --test tests/game-logic/game-iso-camera-phase-gate.spec.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Minimal replica of the camera-update branch from Game.loop() ───────────
//
// Extracted so tests don't need to load the full game-iso module (which
// requires a DOM, requestAnimationFrame, etc.).  The logic is exactly the
// conditional added in the diff:
//
//   if (phase === 'placement' || phase === 'active') {
//       const { dx, dy } = IsoInput.getScrollDir();
//       if (dx || dy) IsoCamera.scroll(dx, dy);
//       if (IsoInput.keys.zoomIn)  IsoCamera.applyZoom(zoomSpeed);
//       if (IsoInput.keys.zoomOut) IsoCamera.applyZoom(-zoomSpeed);
//   }

function runCameraUpdate(phase, isoInput, isoCamera) {
    if (phase === 'placement' || phase === 'active') {
        const { dx, dy } = isoInput.getScrollDir();
        if (dx || dy) isoCamera.scroll(dx, dy);
        if (isoInput.keys.zoomIn)  isoCamera.applyZoom(isoCamera.zoomSpeed);
        if (isoInput.keys.zoomOut) isoCamera.applyZoom(-isoCamera.zoomSpeed);
    }
}

// ─── Test helpers ─────────────────────────────────────────────────────────

function makeIsoInput({ dx = 0, dy = 0, zoomIn = false, zoomOut = false } = {}) {
    return {
        getScrollDir() { return { dx, dy }; },
        keys: { zoomIn, zoomOut },
    };
}

function makeIsoCamera() {
    const calls = [];
    return {
        zoomSpeed: 0.05,
        calls,
        scroll(dx, dy)   { calls.push({ method: 'scroll',    args: [dx, dy] }); },
        applyZoom(delta) { calls.push({ method: 'applyZoom', args: [delta] }); },
    };
}

// ─── Phase gate — scroll ─────────────────────────────────────────────────

describe('Camera phase gate — scroll', () => {
    for (const phase of ['loading', 'briefing']) {
        it(`should NOT call IsoCamera.scroll in '${phase}' phase even with scroll input`, () => {
            const input  = makeIsoInput({ dx: 1, dy: 0 });
            const camera = makeIsoCamera();
            runCameraUpdate(phase, input, camera);
            const scrollCalls = camera.calls.filter(c => c.method === 'scroll');
            assert.equal(scrollCalls.length, 0,
                `scroll() must not be called during '${phase}'`);
        });
    }

    for (const phase of ['placement', 'active']) {
        it(`should call IsoCamera.scroll in '${phase}' phase when dx is non-zero`, () => {
            const input  = makeIsoInput({ dx: 1, dy: 0 });
            const camera = makeIsoCamera();
            runCameraUpdate(phase, input, camera);
            const scrollCalls = camera.calls.filter(c => c.method === 'scroll');
            assert.equal(scrollCalls.length, 1,
                `scroll() must be called once during '${phase}'`);
            assert.deepEqual(scrollCalls[0].args, [1, 0]);
        });

        it(`should call IsoCamera.scroll in '${phase}' phase when dy is non-zero`, () => {
            const input  = makeIsoInput({ dx: 0, dy: -1 });
            const camera = makeIsoCamera();
            runCameraUpdate(phase, input, camera);
            const scrollCalls = camera.calls.filter(c => c.method === 'scroll');
            assert.equal(scrollCalls.length, 1);
            assert.deepEqual(scrollCalls[0].args, [0, -1]);
        });

        it(`should NOT call IsoCamera.scroll in '${phase}' phase when dx=0 and dy=0`, () => {
            const input  = makeIsoInput({ dx: 0, dy: 0 });
            const camera = makeIsoCamera();
            runCameraUpdate(phase, input, camera);
            const scrollCalls = camera.calls.filter(c => c.method === 'scroll');
            assert.equal(scrollCalls.length, 0,
                'scroll() must not be called when there is no scroll input');
        });
    }
});

// ─── Phase gate — zoom in ────────────────────────────────────────────────

describe('Camera phase gate — zoom in', () => {
    for (const phase of ['loading', 'briefing']) {
        it(`should NOT call IsoCamera.applyZoom in '${phase}' phase with zoomIn pressed`, () => {
            const input  = makeIsoInput({ zoomIn: true });
            const camera = makeIsoCamera();
            runCameraUpdate(phase, input, camera);
            assert.equal(camera.calls.length, 0,
                `applyZoom() must not be called during '${phase}'`);
        });
    }

    for (const phase of ['placement', 'active']) {
        it(`should call IsoCamera.applyZoom(+zoomSpeed) in '${phase}' phase with zoomIn pressed`, () => {
            const input  = makeIsoInput({ zoomIn: true });
            const camera = makeIsoCamera();
            runCameraUpdate(phase, input, camera);
            const zoomCalls = camera.calls.filter(c => c.method === 'applyZoom');
            assert.equal(zoomCalls.length, 1);
            assert.ok(zoomCalls[0].args[0] > 0,
                'zoom-in delta must be positive');
            assert.equal(zoomCalls[0].args[0], camera.zoomSpeed);
        });
    }
});

// ─── Phase gate — zoom out ───────────────────────────────────────────────

describe('Camera phase gate — zoom out', () => {
    for (const phase of ['loading', 'briefing']) {
        it(`should NOT call IsoCamera.applyZoom in '${phase}' phase with zoomOut pressed`, () => {
            const input  = makeIsoInput({ zoomOut: true });
            const camera = makeIsoCamera();
            runCameraUpdate(phase, input, camera);
            assert.equal(camera.calls.length, 0,
                `applyZoom() must not be called during '${phase}'`);
        });
    }

    for (const phase of ['placement', 'active']) {
        it(`should call IsoCamera.applyZoom(-zoomSpeed) in '${phase}' phase with zoomOut pressed`, () => {
            const input  = makeIsoInput({ zoomOut: true });
            const camera = makeIsoCamera();
            runCameraUpdate(phase, input, camera);
            const zoomCalls = camera.calls.filter(c => c.method === 'applyZoom');
            assert.equal(zoomCalls.length, 1);
            assert.ok(zoomCalls[0].args[0] < 0,
                'zoom-out delta must be negative');
            assert.equal(zoomCalls[0].args[0], -camera.zoomSpeed);
        });
    }
});

// ─── Phase gate — no input at all ───────────────────────────────────────

describe('Camera phase gate — no input in any phase', () => {
    for (const phase of ['loading', 'briefing', 'placement', 'active']) {
        it(`should make zero camera calls in '${phase}' phase when all inputs are idle`, () => {
            const input  = makeIsoInput(); // dx=0, dy=0, zoomIn=false, zoomOut=false
            const camera = makeIsoCamera();
            runCameraUpdate(phase, input, camera);
            assert.equal(camera.calls.length, 0,
                `No camera calls expected when no input is active in '${phase}'`);
        });
    }
});

// ─── Simultaneous scroll and zoom (interactive phases only) ─────────────

describe('Camera phase gate — simultaneous scroll + zoom in placement phase', () => {
    it('should call both scroll and applyZoom when both inputs are active', () => {
        const input  = makeIsoInput({ dx: 1, dy: 1, zoomIn: true });
        const camera = makeIsoCamera();
        runCameraUpdate('placement', input, camera);
        const scrollCalls = camera.calls.filter(c => c.method === 'scroll');
        const zoomCalls   = camera.calls.filter(c => c.method === 'applyZoom');
        assert.equal(scrollCalls.length, 1, 'expected one scroll call');
        assert.equal(zoomCalls.length, 1,   'expected one zoom call');
    });

    it('should call both scroll and applyZoom in active phase', () => {
        const input  = makeIsoInput({ dx: 0, dy: -1, zoomOut: true });
        const camera = makeIsoCamera();
        runCameraUpdate('active', input, camera);
        const scrollCalls = camera.calls.filter(c => c.method === 'scroll');
        const zoomCalls   = camera.calls.filter(c => c.method === 'applyZoom');
        assert.equal(scrollCalls.length, 1);
        assert.equal(zoomCalls.length, 1);
        assert.ok(zoomCalls[0].args[0] < 0, 'zoom-out delta must be negative');
    });

    it('should NOT call either scroll or zoom in briefing phase even with all inputs active', () => {
        const input  = makeIsoInput({ dx: 1, dy: -1, zoomIn: true, zoomOut: true });
        const camera = makeIsoCamera();
        runCameraUpdate('briefing', input, camera);
        assert.equal(camera.calls.length, 0,
            'briefing must be completely frozen regardless of input');
    });
});

// ─── zoomIn and zoomOut both pressed ────────────────────────────────────

describe('Camera phase gate — zoomIn and zoomOut simultaneously', () => {
    it('should call applyZoom twice (positive then negative) in active phase', () => {
        const input  = makeIsoInput({ zoomIn: true, zoomOut: true });
        const camera = makeIsoCamera();
        runCameraUpdate('active', input, camera);
        const zoomCalls = camera.calls.filter(c => c.method === 'applyZoom');
        assert.equal(zoomCalls.length, 2,
            'both zoom branches fire independently');
        assert.ok(zoomCalls[0].args[0] > 0, 'first call is zoom-in');
        assert.ok(zoomCalls[1].args[0] < 0, 'second call is zoom-out');
    });
});
