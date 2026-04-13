"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { hexToRgb, adjustBrightness } from "@/lib/brand-utils";

function applyBrandTheme(brandColor: string, accentColor: string) {
  const root = document.documentElement;

  // Sidebar always uses brand primary (dark color) in both light and dark modes
  root.style.setProperty("--sidebar", brandColor);
  root.style.setProperty("--sidebar-border", adjustBrightness(brandColor, 1.6));
  root.style.setProperty("--sidebar-accent", adjustBrightness(brandColor, 1.3));
  root.style.setProperty("--sidebar-accent-foreground", "#e0e0e0");

  // Accent color → primary in dark, accent everywhere
  root.style.setProperty("--sidebar-primary", accentColor);
  root.style.setProperty("--sidebar-primary-foreground", "#ffffff");
  root.style.setProperty("--sidebar-ring", accentColor);

  // Accent used for highlights, focus rings, active states
  root.style.setProperty("--accent", accentColor);
  root.style.setProperty("--accent-foreground", "#ffffff");
  root.style.setProperty("--ring", accentColor);
  root.style.setProperty("--chart-1", accentColor);
  root.style.setProperty("--chart-2", accentColor);

  // In dark mode, primary buttons use accent color
  const isDark = root.classList.contains("dark") ||
    (!root.classList.contains("light") && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.style.setProperty("--primary", accentColor);
    root.style.setProperty("--primary-foreground", "#ffffff");
    // Background uses brand primary
    root.style.setProperty("--background", adjustBrightness(brandColor, 1.1));
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

  // Custom properties for components that need raw hex values
  root.style.setProperty("--brand-primary", brandColor);
  root.style.setProperty("--brand-accent", accentColor);
  root.style.setProperty("--brand-primary-light", adjustBrightness(brandColor, 1.4));
}

export default function BrandThemeProvider() {
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const brandColor = activeCompany?.brandColor || "#1d3451";
  const accentColor = (activeCompany as any)?.accentColor || "#d59b3c";

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
