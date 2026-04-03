// sanitize.js - Shared HTML sanitization utilities for Evenfall Advantage
// Loaded globally on all portals via script tag

/**
 * Escapes HTML special characters to prevent XSS injection.
 * @param {*} str - Any value; non-strings are coerced then escaped.
 * @returns {string} HTML-safe string.
 */
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/**
 * Escapes a value for safe use inside an HTML attribute (double-quoted).
 * @param {*} str
 * @returns {string}
 */
function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Expose globally so all inline scripts and JS files can use them
window.escapeHTML = escapeHTML;
window.escapeAttr = escapeAttr;
