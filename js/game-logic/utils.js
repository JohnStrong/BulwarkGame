/**
 * Utility functions
 */

const TILE_SIZE = 32;

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
