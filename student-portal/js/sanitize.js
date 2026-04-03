// sanitize.js - HTML sanitization utilities for Evenfall Advantage

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} str - The string to escape
 * @returns {string} Escaped string safe for insertion into HTML
 */
export function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Sanitizes HTML string using DOMPurify (if available) or falls back to escaping
 * @param {string} html - The HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
export function sanitizeHTML(html) {
    if (typeof html !== 'string') return '';
    // If DOMPurify is loaded, use it
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(html);
    }
    // Otherwise, escape all HTML (safe fallback)
    return escapeHTML(html);
}

// For backward compatibility with existing code
window.escapeHTML = escapeHTML;
window.sanitizeHTML = sanitizeHTML;