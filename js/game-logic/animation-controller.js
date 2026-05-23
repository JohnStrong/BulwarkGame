/**
 * Animation Controller
 *
 * Manages frame cycling for animated sprite types (water, flags, etc.).
 * All sprites of the same type share a single timer and advance frames in unison.
 *
 * Requirements: 5.3, 7.5
 */

const AnimationController = (() => {
    /** @type {Map<string, { frameCount: number, intervalMs: number, currentFrame: number, timerId: ReturnType<typeof setInterval> | null }>} */
    const registry = new Map();

    const MIN_INTERVAL_MS = 100;
    const MAX_INTERVAL_MS = 2000;
    const DEFAULT_INTERVAL_MS = 500;

    /**
     * Clamps a value to the inclusive range [min, max].
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Registers an animated sprite type with its frame count and animation rate.
     * If the type is already registered, the existing timer is stopped and replaced.
     *
     * @param {string} spriteType - Identifier for the sprite type (e.g. 'water', 'flag')
     * @param {number} frameCount - Total number of animation frames (must be >= 1)
     * @param {number} [intervalMs=500] - Milliseconds per frame; clamped to [100, 2000]
     */
    function registerAnimatedType(spriteType, frameCount, intervalMs = DEFAULT_INTERVAL_MS) {
        // Stop any existing timer for this type
        if (registry.has(spriteType)) {
            const existing = registry.get(spriteType);
            if (existing.timerId !== null) {
                clearInterval(existing.timerId);
            }
        }

        const clampedInterval = clamp(intervalMs, MIN_INTERVAL_MS, MAX_INTERVAL_MS);

        if (clampedInterval !== intervalMs) {
            console.warn(
                `[AnimationController] Interval ${intervalMs}ms for '${spriteType}' is out of range ` +
                `[${MIN_INTERVAL_MS}, ${MAX_INTERVAL_MS}]. Clamped to ${clampedInterval}ms.`
            );
        }

        const entry = {
            frameCount: Math.max(1, frameCount),
            intervalMs: clampedInterval,
            currentFrame: 0,
            timerId: null,
        };

        // Start the shared timer for this sprite type
        entry.timerId = setInterval(() => {
            entry.currentFrame = (entry.currentFrame + 1) % entry.frameCount;
        }, clampedInterval);

        registry.set(spriteType, entry);
    }

    /**
     * Returns the current frame index for a sprite type.
     * All sprites of the same type share the same frame index (single shared timer).
     *
     * @param {string} spriteType - Identifier for the sprite type
     * @returns {number} Current frame index, or 0 if the type is not registered
     */
    function getCurrentFrame(spriteType) {
        const entry = registry.get(spriteType);
        if (!entry) {
            return 0;
        }
        return entry.currentFrame;
    }

    /**
     * Stops and removes all registered animation timers.
     * Useful for cleanup during tests or game teardown.
     */
    function reset() {
        for (const entry of registry.values()) {
            if (entry.timerId !== null) {
                clearInterval(entry.timerId);
            }
        }
        registry.clear();
    }

    /**
     * Returns whether a sprite type has been registered.
     * @param {string} spriteType
     * @returns {boolean}
     */
    function isRegistered(spriteType) {
        return registry.has(spriteType);
    }

    return {
        registerAnimatedType,
        getCurrentFrame,
        reset,
        isRegistered,
        MIN_INTERVAL_MS,
        MAX_INTERVAL_MS,
        DEFAULT_INTERVAL_MS,
    };
})();

// Export for Node.js (tests) while remaining usable as a browser global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnimationController;
}
