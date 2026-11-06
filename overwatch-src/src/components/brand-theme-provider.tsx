"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import {
  adjustBrightness,
  avatarInitialsForeground,
  companySurfaceHex,
  DEFAULT_ACCENT,
  DEFAULT_BRAND,
  readableOn,
  sidebarInitialsForeground,
} from "@/lib/brand-utils";

/**
 * One `<meta name="theme-color">` for the active company surface.
 * Android Chrome paints the status bar, and on current installed PWAs the
 * navigation bar behind back/home, from this meta (falling back to the
 * manifest `theme_color`). Media-qualified tags would follow the OS scheme
 * instead of the company, so they are removed. `color-scheme` is not used
 * here: it only hints light/dark glyphs, it does not set the bar colour.
 * iOS `apple-mobile-web-app-status-bar-style` is a different channel.
 */
export function syncThemeColorMeta(surface: string, doc: Document = document) {
  doc.querySelectorAll('meta[name="theme-color"][media]').forEach((node) => node.remove());
  let meta = doc.querySelector('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = doc.createElement("meta");
    meta.setAttribute("name", "theme-color");
    (doc.head ?? doc.documentElement).appendChild(meta);
  }
  meta.setAttribute("content", surface);
}

export function applyBrandTheme(brandColor: string, accentColor: string, doc: Document = document) {
  const root = doc.documentElement;

  // Sidebar always uses brand primary (dark color) in both light and dark modes
  root.style.setProperty("--sidebar", brandColor);
  root.style.setProperty("--sidebar-border", adjustBrightness(brandColor, 1.6));
  root.style.setProperty("--sidebar-accent", adjustBrightness(brandColor, 1.3));
  root.style.setProperty("--sidebar-accent-foreground", "#e0e0e0");

  // Accent color → primary in dark, accent everywhere
  root.style.setProperty("--sidebar-primary", accentColor);
  root.style.setProperty("--sidebar-primary-foreground", readableOn(accentColor));
  root.style.setProperty("--sidebar-ring", accentColor);

  // Accent used for highlights, focus rings, active states.
  // These stay the admin's selected colours — contrast fixes do not rewrite them.
  root.style.setProperty("--accent", accentColor);
  root.style.setProperty("--accent-foreground", readableOn(accentColor));
  root.style.setProperty("--ring", accentColor);
  root.style.setProperty("--chart-1", accentColor);
  root.style.setProperty("--chart-2", accentColor);

  // In dark mode, primary buttons use accent color
  const isDark = root.classList.contains("dark") ||
    (!root.classList.contains("light") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const mode = isDark ? "dark" : "light";

  if (isDark) {
    root.style.setProperty("--primary", accentColor);
    root.style.setProperty("--primary-foreground", readableOn(accentColor));
    // Background uses brand primary. Same hex as the Android chrome surface.
    root.style.setProperty("--background", companySurfaceHex(brandColor, "dark"));
    root.style.setProperty("--card", adjustBrightness(brandColor, 1.2));
    root.style.setProperty("--popover", adjustBrightness(brandColor, 1.15));
    root.style.setProperty("--muted", adjustBrightness(brandColor, 1.4));
    root.style.setProperty("--border", adjustBrightness(brandColor, 2.0));
    root.style.setProperty("--input", adjustBrightness(brandColor, 1.8));
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--background");
    root.style.removeProperty("--card");
    root.style.removeProperty("--popover");
    root.style.removeProperty("--muted");
    root.style.removeProperty("--border");
    root.style.removeProperty("--input");
  }

  // Initials only. The tinted avatar disc keeps bg-primary/20.
  root.style.setProperty("--avatar-initials-fg", avatarInitialsForeground(brandColor, accentColor, mode));
  root.style.setProperty("--avatar-initials-fg-sidebar", sidebarInitialsForeground(brandColor, accentColor, mode));

  // Custom properties for components that need raw hex values
  root.style.setProperty("--brand-primary", brandColor);
  root.style.setProperty("--brand-accent", accentColor);
  root.style.setProperty("--brand-primary-light", adjustBrightness(brandColor, 1.4));

  // System bars follow the surface the page already paints, not the accent.
  syncThemeColorMeta(companySurfaceHex(brandColor, mode), doc);
}

export default function BrandThemeProvider() {
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const brandColor = activeCompany?.brandColor || DEFAULT_BRAND;
  const accentColor = activeCompany?.accentColor || DEFAULT_ACCENT;

  // Apply on mount and when colors change
  useEffect(() => {
    applyBrandTheme(brandColor, accentColor);
  }, [brandColor, accentColor]);

  // Re-apply when theme (dark/light) changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      applyBrandTheme(brandColor, accentColor);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [brandColor, accentColor]);

  return null;
}
