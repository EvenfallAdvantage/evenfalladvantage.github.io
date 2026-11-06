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

/** Text colour (white or near-black) with the higher WCAG contrast on `bg`. */
export function readableOn(bg: string): string {
  const L = getLuminance(bg);
  const onWhite = 1.05 / (L + 0.05);
  const onDark = (L + 0.05) / (getLuminance("#0b1422") + 0.05);
  return onWhite >= onDark ? "#ffffff" : "#0b1422";
}

/** HQ defaults. BrandThemeProvider and the static PWA manifest share these. */
export const DEFAULT_BRAND = "#1d3451";
export const DEFAULT_ACCENT = "#d59b3c";

/**
 * sRGB of `:root` tokens (globals.css). Light mode does not override them.
 * --background: oklch(0.98 0.003 240). --primary: oklch(0.30 0.06 240).
 */
export const LIGHT_CANVAS = "#f7f9fa";
export const DEFAULT_LIGHT_PRIMARY = "#0a3149";

/** Near-black already used by readableOn. Kept as an on-brand opposite. */
export const READABLE_DARK = "#0b1422";

/** WCAG 2.2 AA 1.4.3 for text under 18pt (avatar initials are 12–18px). */
export const TEXT_CONTRAST_MIN = 4.5;

/** Dark-mode surfaces BrandThemeProvider derives from the stored brand colour. */
export const DARK_SURFACE_FACTOR = 1.1;
export const DARK_CARD_FACTOR = 1.2;

/** Tailwind bg-primary/10, /15, and /20 — the initials tints in the app. */
export const AVATAR_TINT_ALPHAS = [0.1, 0.15, 0.2] as const;

export function contrastRatio(foreground: string, background: string): number {
  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Source-over composite of `ink` at `alpha` on an opaque `surface`. */
export function compositeOver(ink: string, surface: string, alpha: number): string {
  const [ir, ig, ib] = hexToRgb(ink);
  const [sr, sg, sb] = hexToRgb(surface);
  const mix = (a: number, b: number) => a * alpha + b * (1 - alpha);
  return rgbToHex(mix(ir, sr), mix(ig, sg), mix(ib, sb));
}

/** sRGB mix. t = 0 keeps `from`; t = 1 is `to`. */
export function mixHex(from: string, to: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(from);
  const [br, bg, bb] = hexToRgb(to);
  const mix = (a: number, b: number) => a + (b - a) * t;
  return rgbToHex(mix(ar, br), mix(ag, bg), mix(ab, bb));
}

/** Page/sidebar surfaces the dark theme actually paints from the stored brand. */
export function darkBrandSurfaces(brandColor: string): string[] {
  return [
    brandColor,
    adjustBrightness(brandColor, DARK_SURFACE_FACTOR),
    adjustBrightness(brandColor, DARK_CARD_FACTOR),
  ];
}

/**
 * Android system bars and the safe-area strip follow this surface.
 * Dark mode matches `--background` (brand × 1.1). Light mode matches the
 * light canvas, not the accent. The stored brand and accent are not modified.
 */
export function companySurfaceHex(brandColor: string, mode: "dark" | "light"): string {
  if (mode === "light") return LIGHT_CANVAS;
  return adjustBrightness(brandColor, DARK_SURFACE_FACTOR);
}

function tintBackgrounds(ink: string, surfaces: string[]): string[] {
  const out: string[] = [];
  for (const surface of surfaces) {
    for (const alpha of AVATAR_TINT_ALPHAS) out.push(compositeOver(ink, surface, alpha));
  }
  return out;
}

/**
 * Foreground for avatar initials on a 10–20% tint of `ink`.
 * Uses `ink` itself when it already clears 4.5:1 on every tint. Otherwise
 * walks `ink` toward white or toward the near-black opposite and keeps the
 * closest mix that clears. Does not return a different brand hue.
 */
export function onBrandForeground(ink: string, surfaces: string[]): string {
  const backgrounds = tintBackgrounds(ink, surfaces);
  const score = (fg: string) => Math.min(...backgrounds.map((bg) => contrastRatio(fg, bg)));
  const passes = (fg: string) => score(fg) >= TEXT_CONTRAST_MIN;

  if (passes(ink)) return ink;

  const closest = (to: string): { color: string; t: number } | null => {
    if (!passes(to)) return null;
    let lo = 0;
    let hi = 1;
    let best = to;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const mixed = mixHex(ink, to, mid);
      if (passes(mixed)) {
        best = mixed;
        hi = mid;
      } else {
        lo = mid;
      }
    }
    return { color: best, t: hi };
  };

  const options = [closest("#ffffff"), closest(READABLE_DARK), closest("#000000")].filter(
    (x): x is { color: string; t: number } => x !== null,
  );
  if (options.length === 0) {
    // No single foreground clears every tint. Keep the mix with the best
    // worst-case ratio. Callers must not treat that as a universal pass.
    let best = ink;
    let bestScore = score(ink);
    const consider = (fg: string) => {
      const next = score(fg);
      if (next > bestScore) {
        best = fg;
        bestScore = next;
      }
    };
    consider("#ffffff");
    consider(READABLE_DARK);
    consider("#000000");
    for (let step = 1; step <= 20; step++) {
      const t = step / 20;
      consider(mixHex(ink, "#ffffff", t));
      consider(mixHex(ink, READABLE_DARK, t));
      consider(mixHex(ink, "#000000", t));
    }
    return best;
  }
  options.sort((a, b) => a.t - b.t || score(b.color) - score(a.color));
  return options[0].color;
}

/** Initials colour for page avatars. Dark mode also covers the sidebar. */
export function avatarInitialsForeground(brandColor: string, accentColor: string, mode: "dark" | "light"): string {
  if (mode === "dark") return onBrandForeground(accentColor, darkBrandSurfaces(brandColor));
  return onBrandForeground(DEFAULT_LIGHT_PRIMARY, [LIGHT_CANVAS, "#ffffff"]);
}

/** Light-mode sidebar sits on the stored brand colour, not the light canvas. */
export function sidebarInitialsForeground(brandColor: string, accentColor: string, mode: "dark" | "light"): string {
  const ink = mode === "dark" ? accentColor : DEFAULT_LIGHT_PRIMARY;
  return onBrandForeground(ink, [brandColor]);
}
