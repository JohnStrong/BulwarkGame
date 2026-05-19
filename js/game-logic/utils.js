/**
 * Utility functions
 */

const TILE_SIZE = 32;
const HEX_WIDTH = 32;
const HEX_HEIGHT = 28;          // 32 * sqrt(3)/2 ≈ 28
const HEX_ROW_HEIGHT = 21;     // 28 * 0.75 = 21 (rows overlap by 25%)
const HEX_COL_OFFSET = 16;     // half width offset for odd rows

/**
 * Load an image and return a promise
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        img.src = src;
    });
}

/**
 * Load a text file and return its content
 */
function loadTextFile(src) {
    return fetch(src).then(response => {
        if (!response.ok) throw new Error(`Failed to load: ${src}`);
        return response.text();
    });
}

/**
 * Convert hex grid coordinates (row, col) to pixel position
 */
function hexToPixel(row, col) {
    const x = col * HEX_WIDTH + (row % 2 === 1 ? HEX_COL_OFFSET : 0);
    const y = row * HEX_ROW_HEIGHT;
    return { x, y };
}
