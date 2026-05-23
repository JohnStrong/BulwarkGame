/**
 * Sprite atlas bin-packing module.
 *
 * Packs sprite frames into power-of-two atlas image(s) using a shelf-based
 * bin-packing algorithm with 1-pixel padding between frames. Automatically
 * splits into multiple atlas files if the packed area exceeds 2048px in
 * either axis.
 *
 * Outputs raw RGBA pixel buffers for each atlas and a JSON metadata object
 * describing frame positions, source sizes, atlas indices, and animation
 * frame sequences.
 *
 * Requirements:
 *   4.1 - No overlapping regions, minimum 1-pixel padding between adjacent frames
 *   4.2 - JSON metadata with name, x, y, width, height for each frame
 *   4.3 - Power-of-two dimensions (256, 512, 1024, 2048)
 *   4.4 - Auto-split into multiple atlas files if exceeding 2048px
 */

'use strict';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Valid power-of-two atlas dimensions, ascending. */
const POWER_OF_TWO_SIZES = [256, 512, 1024, 2048];

/** Maximum atlas dimension in either axis. */
const MAX_ATLAS_SIZE = 2048;

/** Padding between adjacent sprite frames (pixels). */
const PADDING = 1;

// ─── Bin-Packing (Shelf Algorithm) ─────────────────────────────────────────

/**
 * A shelf-based bin packer that places rectangles left-to-right on shelves,
 * opening a new shelf when the current one is full.
 */
class ShelfPacker {
  /**
   * @param {number} maxWidth - Maximum width of the packing area.
   * @param {number} maxHeight - Maximum height of the packing area.
   */
  constructor(maxWidth, maxHeight) {
    this.maxWidth = maxWidth;
    this.maxHeight = maxHeight;
    this.shelves = [];
    this.currentShelfY = 0;
    this.currentShelfHeight = 0;
    this.currentShelfX = 0;
    this.placements = [];
  }

  /**
   * Attempts to place a rectangle in the packing area.
   *
   * @param {number} width - Width of the rectangle (including padding).
   * @param {number} height - Height of the rectangle (including padding).
   * @returns {{x: number, y: number}|null} Placement position or null if it doesn't fit.
   */
  place(width, height) {
    // Try to fit on the current shelf
    if (this.currentShelfX + width <= this.maxWidth) {
      // Check vertical fit
      if (this.currentShelfY + height > this.maxHeight) {
        return null;
      }
      const pos = { x: this.currentShelfX, y: this.currentShelfY };
      this.currentShelfX += width;
      if (height > this.currentShelfHeight) {
        this.currentShelfHeight = height;
      }
      return pos;
    }

    // Start a new shelf
    const newShelfY = this.currentShelfY + this.currentShelfHeight;
    if (newShelfY + height > this.maxHeight) {
      return null; // Doesn't fit vertically
    }
    if (width > this.maxWidth) {
      return null; // Doesn't fit horizontally
    }

    this.currentShelfY = newShelfY;
    this.currentShelfHeight = height;
    this.currentShelfX = width;
    return { x: 0, y: this.currentShelfY };
  }

  /**
   * Returns the used height (bottom of the last shelf).
   * @returns {number}
   */
  getUsedHeight() {
    return this.currentShelfY + this.currentShelfHeight;
  }
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Returns the smallest power-of-two value from POWER_OF_TWO_SIZES that is >= value.
 * If value exceeds MAX_ATLAS_SIZE, returns MAX_ATLAS_SIZE.
 *
 * @param {number} value - The minimum required dimension.
 * @returns {number} A power-of-two dimension.
 */
function nextPowerOfTwo(value) {
  for (const size of POWER_OF_TWO_SIZES) {
    if (size >= value) return size;
  }
  return MAX_ATLAS_SIZE;
}

/**
 * Expands individual sprites with multiple frames into separate frame entries.
 *
 * @param {Array<{name: string, buffer: Buffer, width: number, height: number, frames?: number}>} sprites
 * @returns {Array<{name: string, buffer: Buffer, width: number, height: number, originalName: string, frameIndex: number|null}>}
 */
function expandFrames(sprites) {
  const expanded = [];

  for (const sprite of sprites) {
    const frameCount = sprite.frames || 1;

    if (frameCount === 1) {
      expanded.push({
        name: sprite.name,
        buffer: sprite.buffer,
        width: sprite.width,
        height: sprite.height,
        originalName: sprite.name,
        frameIndex: null,
      });
    } else {
      // Multi-frame sprite: buffer contains frames stacked vertically
      const frameHeight = sprite.height;
      const frameWidth = sprite.width;
      const bytesPerFrame = frameWidth * frameHeight * 4;

      for (let i = 0; i < frameCount; i++) {
        const frameBuffer = sprite.buffer.subarray(
          i * bytesPerFrame,
          (i + 1) * bytesPerFrame
        );
        expanded.push({
          name: `${sprite.name}-frame-${i}`,
          buffer: Buffer.from(frameBuffer),
          width: frameWidth,
          height: frameHeight,
          originalName: sprite.name,
          frameIndex: i,
        });
      }
    }
  }

  return expanded;
}

/**
 * Builds the animations section of the metadata by grouping frame entries
 * by their original sprite name.
 *
 * @param {Array<{name: string, originalName: string, frameIndex: number|null}>} frames
 * @returns {Object} Animations mapping: { spriteName: [frameName, ...] }
 */
function buildAnimations(frames) {
  const animations = {};

  for (const frame of frames) {
    if (frame.frameIndex !== null) {
      if (!animations[frame.originalName]) {
        animations[frame.originalName] = [];
      }
      animations[frame.originalName].push(frame.name);
    }
  }

  return animations;
}

/**
 * Composes an atlas pixel buffer from placed frames.
 *
 * @param {Array<{frame: Object, buffer: Buffer, width: number, height: number}>} placements
 * @param {number} atlasWidth - Width of the atlas in pixels.
 * @param {number} atlasHeight - Height of the atlas in pixels.
 * @returns {Buffer} RGBA pixel buffer for the atlas.
 */
function composeAtlasBuffer(placements, atlasWidth, atlasHeight) {
  const buffer = Buffer.alloc(atlasWidth * atlasHeight * 4);

  for (const placement of placements) {
    const { x, y } = placement.frame;
    const srcWidth = placement.width;
    const srcHeight = placement.height;
    const srcBuffer = placement.buffer;

    for (let row = 0; row < srcHeight; row++) {
      const srcOffset = row * srcWidth * 4;
      const dstOffset = ((y + row) * atlasWidth + x) * 4;
      srcBuffer.copy(buffer, dstOffset, srcOffset, srcOffset + srcWidth * 4);
    }
  }

  return buffer;
}

// ─── Main Export ────────────────────────────────────────────────────────────

/**
 * Packs sprite frames into power-of-two atlas(es).
 *
 * Uses a shelf-based bin-packing algorithm with 1-pixel padding between frames.
 * Automatically splits into multiple atlas files if sprites exceed 2048px in
 * either axis.
 *
 * @param {Array<{name: string, buffer: Buffer, width: number, height: number, frames?: number}>} sprites
 *   Each sprite has:
 *   - name: Unique identifier for the sprite
 *   - buffer: RGBA pixel data (for multi-frame sprites, frames are stacked vertically)
 *   - width: Width of a single frame in pixels
 *   - height: Height of a single frame in pixels
 *   - frames: Optional number of animation frames (default 1)
 *
 * @returns {{atlases: Buffer[], metadata: Object}}
 *   - atlases: Array of RGBA pixel buffers, one per atlas image
 *   - metadata: JSON-serializable object with frame positions and animations
 *
 * @throws {Error} 'Invalid sprite name' if any sprite has empty or duplicate name
 * @throws {Error} 'Atlas metadata serialization failed' on JSON serialization failure
 */
function packAtlas(sprites) {
  // ─── Validate sprite names ──────────────────────────────────────────────
  const names = new Set();
  for (const sprite of sprites) {
    if (!sprite.name || typeof sprite.name !== 'string' || sprite.name.trim() === '') {
      const spriteList = sprites.map(s => s.name || '<empty>');
      process.stderr.write(
        `[SPRITE-BUILD-ERROR] atlas-packer: Invalid sprite name\n` +
        `  Sprite: "${sprite.name || ''}"\n` +
        `  Stage: packing\n` +
        `  Details: Sprite name is empty or invalid\n` +
        `  Full sprite list: ${JSON.stringify(spriteList)}\n`
      );
      throw new Error('Invalid sprite name');
    }
    if (names.has(sprite.name)) {
      const spriteList = sprites.map(s => s.name);
      process.stderr.write(
        `[SPRITE-BUILD-ERROR] atlas-packer: Invalid sprite name\n` +
        `  Sprite: "${sprite.name}"\n` +
        `  Stage: packing\n` +
        `  Details: Duplicate sprite name detected\n` +
        `  Full sprite list: ${JSON.stringify(spriteList)}\n`
      );
      throw new Error('Invalid sprite name');
    }
    names.add(sprite.name);
  }

  // ─── Expand multi-frame sprites into individual frame entries ────────────
  const expandedFrames = expandFrames(sprites);

  // ─── Sort frames by height descending for better shelf packing ──────────
  const sortedFrames = [...expandedFrames].sort((a, b) => b.height - a.height);

  // ─── Pack frames into atlas pages ───────────────────────────────────────
  const atlasPages = [];
  let remaining = [...sortedFrames];

  while (remaining.length > 0) {
    // Try to fit as many frames as possible into one atlas page
    const packer = new ShelfPacker(MAX_ATLAS_SIZE, MAX_ATLAS_SIZE);
    const placed = [];
    const notPlaced = [];

    for (const frame of remaining) {
      const paddedWidth = frame.width + PADDING;
      const paddedHeight = frame.height + PADDING;
      const pos = packer.place(paddedWidth, paddedHeight);

      if (pos) {
        placed.push({
          ...frame,
          frame: { x: pos.x, y: pos.y, w: frame.width, h: frame.height },
        });
      } else {
        notPlaced.push(frame);
      }
    }

    if (placed.length === 0) {
      // Should not happen with valid sprites <= 2048px, but guard against infinite loop
      const spriteList = remaining.map(f => `${f.name} (${f.width}x${f.height})`);
      process.stderr.write(
        `[SPRITE-BUILD-ERROR] atlas-packer: Cannot pack remaining sprites\n` +
        `  Stage: packing\n` +
        `  Details: ${JSON.stringify(spriteList)}\n`
      );
      throw new Error('Atlas metadata serialization failed');
    }

    // Determine atlas dimensions (power-of-two)
    let maxX = 0;
    let maxY = 0;
    for (const p of placed) {
      const right = p.frame.x + p.frame.w;
      const bottom = p.frame.y + p.frame.h;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }

    const atlasWidth = nextPowerOfTwo(maxX);
    const atlasHeight = nextPowerOfTwo(maxY);

    // Compose the atlas buffer
    const atlasBuffer = composeAtlasBuffer(placed, atlasWidth, atlasHeight);

    atlasPages.push({
      buffer: atlasBuffer,
      width: atlasWidth,
      height: atlasHeight,
      placements: placed,
    });

    remaining = notPlaced;
  }

  // ─── Build metadata ─────────────────────────────────────────────────────
  const frames = {};
  const atlasIndex = atlasPages.length > 1;

  for (let i = 0; i < atlasPages.length; i++) {
    const page = atlasPages[i];
    for (const placement of page.placements) {
      frames[placement.name] = {
        frame: {
          x: placement.frame.x,
          y: placement.frame.y,
          w: placement.frame.w,
          h: placement.frame.h,
        },
        sourceSize: {
          w: placement.frame.w,
          h: placement.frame.h,
        },
        atlasIndex: i,
      };
    }
  }

  // Build animations section
  const animations = buildAnimations(expandedFrames);

  // Build the full metadata object
  const metadata = {
    meta: {
      version: '1.0',
      image: 'atlas-0.png',
      size: { w: atlasPages[0].width, h: atlasPages[0].height },
      format: 'RGBA8888',
    },
    frames,
    animations,
  };

  // ─── Validate JSON serialization ────────────────────────────────────────
  try {
    JSON.stringify(metadata);
  } catch (err) {
    process.stderr.write(
      `[SPRITE-BUILD-ERROR] atlas-packer: Atlas metadata serialization failed\n` +
      `  Stage: packing\n` +
      `  Details: ${err.message}\n` +
      `  Metadata keys: ${JSON.stringify(Object.keys(metadata))}\n`
    );
    throw new Error('Atlas metadata serialization failed');
  }

  return {
    atlases: atlasPages.map(page => page.buffer),
    metadata,
  };
}

module.exports = { packAtlas };
