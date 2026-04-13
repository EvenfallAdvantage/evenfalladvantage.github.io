/**
 * Brand theme color utility functions.
 * Used by BrandThemeProvider and admin/settings for color manipulation & validation.
 */

/** Convert a 6-digit hex color to RGB tuple */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length !== 6) return [29, 52, 81]; // fallback navy
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Multiply each RGB channel by a factor, clamped to [0, 255] */
export function adjustBrightness(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return `#${[clamp(r * factor), clamp(g * factor), clamp(b * factor)]
    .map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Calculate relative luminance per WCAG 2.0 (0 = black, 1 = white) */
export function getLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
    .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
