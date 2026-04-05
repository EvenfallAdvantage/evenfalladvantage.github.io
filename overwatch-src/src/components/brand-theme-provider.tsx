"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";

// Convert hex to OKLCH-ish values for CSS variables
// We need to convert hex -> RGB -> relative luminance, then set CSS vars

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToOklch(r: number, g: number, b: number): string {
  // Simplified: convert to approximate oklch by using HSL-ish approach
  // For CSS variable injection, we'll use hex directly with color-mix
  // Actually, the simplest approach: just set hex colors directly
  return `${r}, ${g}, ${b}`;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Generate a lighter/darker variant of a hex color
function adjustBrightness(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return `#${[clamp(r * factor), clamp(g * factor), clamp(b * factor)]
    .map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

export default function BrandThemeProvider() {
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const brandColor = activeCompany?.brandColor || "#1d3451";
  const accentColor = (activeCompany as any)?.accentColor || "#d59b3c";

  useEffect(() => {
    const root = document.documentElement;
    
    // Primary brand color (dark, used for backgrounds)
    root.style.setProperty("--brand-primary", brandColor);
    root.style.setProperty("--brand-primary-light", adjustBrightness(brandColor, 1.3));
    root.style.setProperty("--brand-primary-lighter", adjustBrightness(brandColor, 1.6));
    root.style.setProperty("--brand-primary-dark", adjustBrightness(brandColor, 0.7));
    
    // Accent brand color (bright, used for highlights)
    root.style.setProperty("--brand-accent", accentColor);
    root.style.setProperty("--brand-accent-light", adjustBrightness(accentColor, 1.2));
    root.style.setProperty("--brand-accent-dark", adjustBrightness(accentColor, 0.8));
    
    // Also set as the primary/accent CSS vars that shadcn uses
    // Convert hex to an oklch-compatible format
    const [ar, ag, ab] = hexToRgb(accentColor);
    const [pr, pg, pb] = hexToRgb(brandColor);
    
    // For dark mode: accent becomes primary (buttons, active states)
    // We use color() function which all modern browsers support
    root.style.setProperty("--accent", accentColor);
    root.style.setProperty("--ring", accentColor);
    root.style.setProperty("--sidebar-primary", accentColor);
    root.style.setProperty("--sidebar-ring", accentColor);
    root.style.setProperty("--chart-1", accentColor);
    root.style.setProperty("--chart-2", accentColor);
    
    // Dark mode: set primary to accent
    if (root.classList.contains("dark") || (!root.classList.contains("light") && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      root.style.setProperty("--primary", accentColor);
      // Sidebar background uses brand primary
      root.style.setProperty("--sidebar", brandColor);
      root.style.setProperty("--sidebar-border", adjustBrightness(brandColor, 1.4));
    }
    
    // Clean up on unmount or company change
    return () => {
      // Don't remove -- let the next effect set new values
    };
  }, [brandColor, accentColor]);

  // Listen for theme changes to re-apply
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const root = document.documentElement;
      const isDark = root.classList.contains("dark") || (!root.classList.contains("light") && window.matchMedia("(prefers-color-scheme: dark)").matches);
      
      if (isDark) {
        root.style.setProperty("--primary", accentColor);
        root.style.setProperty("--sidebar", brandColor);
        root.style.setProperty("--sidebar-border", adjustBrightness(brandColor, 1.4));
      } else {
        root.style.removeProperty("--primary");
        root.style.setProperty("--sidebar", brandColor);
        root.style.setProperty("--sidebar-border", adjustBrightness(brandColor, 1.4));
      }
    });
    
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [brandColor, accentColor]);

  return null; // This is a side-effect-only component
}
