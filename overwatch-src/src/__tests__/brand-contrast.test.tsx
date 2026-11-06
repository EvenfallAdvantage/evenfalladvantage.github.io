// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { applyBrandTheme } from "@/components/brand-theme-provider";
import {
  AVATAR_TINT_ALPHAS,
  adjustBrightness,
  avatarInitialsForeground,
  companySurfaceHex,
  compositeOver,
  contrastRatio,
  darkBrandSurfaces,
  DEFAULT_ACCENT,
  DEFAULT_BRAND,
  DEFAULT_LIGHT_PRIMARY,
  LIGHT_CANVAS,
  sidebarInitialsForeground,
  TEXT_CONTRAST_MIN,
} from "@/lib/brand-utils";
import { selectInstallIcons } from "@/lib/pwa-install-policy";

const rootDir = path.resolve(__dirname, "../..");

/** Dark brands at or under this luminance clear 4.5:1 for the accents below. */
const SUPPORTED_BRANDS = ["#1d3451", "#080626", "#0a1929", "#1a0f2e", "#000000", "#101820", "#0b1422", "#1e293b", "#404040"];
const SUPPORTED_ACCENTS = ["#d59b3c", "#dd8c33", "#d63d3d", "#22c55e", "#3b82f6", "#a855f7", "#f97316", "#e11d48", "#111111", "#facc15", "#ffffff", "#000000", "#ffff00"];

function minTintContrast(fg: string, ink: string, surfaces: string[]) {
  let min = Number.POSITIVE_INFINITY;
  for (const surface of surfaces) {
    for (const alpha of AVATAR_TINT_ALPHAS) {
      min = Math.min(min, contrastRatio(fg, compositeOver(ink, surface, alpha)));
    }
  }
  return min;
}

function clearTheme() {
  document.documentElement.removeAttribute("style");
  document.documentElement.className = "";
  document.querySelectorAll('meta[name="theme-color"]').forEach((node) => node.remove());
}

function assertInitials(fg: string, ink: string, surfaces: string[]) {
  for (const surface of surfaces) {
    for (const alpha of AVATAR_TINT_ALPHAS) {
      const bg = compositeOver(ink, surface, alpha);
      expect(contrastRatio(fg, bg), `${fg} on ${bg} (ink ${ink} @ ${alpha} over ${surface})`).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN);
    }
  }
}

describe("configured palette stays the selected colours", () => {
  beforeEach(clearTheme);

  it("dark mode writes the stored brand and accent through unchanged", () => {
    document.documentElement.classList.add("dark");
    const brand = "#080626";
    const accent = "#d63d3d";
    applyBrandTheme(brand, accent);

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--brand-primary").trim()).toBe(brand);
    expect(root.style.getPropertyValue("--brand-accent").trim()).toBe(accent);
    expect(root.style.getPropertyValue("--primary").trim()).toBe(accent);
    expect(root.style.getPropertyValue("--accent").trim()).toBe(accent);
    expect(root.style.getPropertyValue("--sidebar").trim()).toBe(brand);
    expect(root.style.getPropertyValue("--sidebar-primary").trim()).toBe(accent);
    expect(root.style.getPropertyValue("--background").trim()).toBe(companySurfaceHex(brand, "dark"));
    expect(root.style.getPropertyValue("--card").trim()).toBe(adjustBrightness(brand, 1.2));
    expect(root.style.getPropertyValue("--background").trim()).toBe(adjustBrightness(brand, 1.1));
    // Initials are a separate foreground. They must not replace the accent.
    expect(root.style.getPropertyValue("--avatar-initials-fg").trim()).not.toBe("");
    expect(root.style.getPropertyValue("--primary").trim()).toBe(accent);
    expect(root.style.getPropertyValue("--accent").trim()).toBe(accent);
  });

  it("light mode does not override the page palette with the company accent", () => {
    document.documentElement.classList.add("light");
    applyBrandTheme("#1d3451", "#dd8c33");
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--primary").trim()).toBe("");
    expect(root.style.getPropertyValue("--background").trim()).toBe("");
    expect(root.style.getPropertyValue("--card").trim()).toBe("");
    expect(root.style.getPropertyValue("--accent").trim()).toBe("#dd8c33");
    expect(root.style.getPropertyValue("--brand-primary").trim()).toBe("#1d3451");
    expect(root.style.getPropertyValue("--brand-accent").trim()).toBe("#dd8c33");
    expect(root.style.backgroundColor).toBe("");
  });

  it("keeps an HQ preview node painted with the raw selected colours", () => {
    document.documentElement.classList.add("dark");
    const brand = "#102030";
    const accent = "#abcdef";
    applyBrandTheme(brand, accent);
    const preview = document.createElement("div");
    preview.style.background = brand;
    const accentBar = document.createElement("div");
    accentBar.style.background = accent;
    accentBar.style.color = accent;
    document.body.append(preview, accentBar);

    expect(preview.style.background).toBe(brand);
    expect(accentBar.style.background).toBe(accent);
    expect(accentBar.style.color).toBe(accent);
    expect(document.documentElement.style.getPropertyValue("--accent").trim()).toBe(accent);
    expect(document.documentElement.style.getPropertyValue("--brand-primary").trim()).toBe(brand);
  });
});

describe("avatar initials contrast", () => {
  beforeEach(clearTheme);

  it("default amber accent fails 4.5:1 on its own 20% tint, and the initials foreground passes", () => {
    document.documentElement.classList.add("dark");
    applyBrandTheme(DEFAULT_BRAND, DEFAULT_ACCENT);
    const fg = document.documentElement.style.getPropertyValue("--avatar-initials-fg").trim();
    const surface = companySurfaceHex(DEFAULT_BRAND, "dark");
    const tint = compositeOver(DEFAULT_ACCENT, surface, 0.2);
    expect(contrastRatio(DEFAULT_ACCENT, tint)).toBeLessThan(TEXT_CONTRAST_MIN);
    expect(contrastRatio(fg, tint)).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN);
    assertInitials(fg, DEFAULT_ACCENT, darkBrandSurfaces(DEFAULT_BRAND));
  });

  it("clears 4.5:1 for dark brands, including white and black accents", () => {
    for (const brand of SUPPORTED_BRANDS) {
      for (const accent of SUPPORTED_ACCENTS) {
        const darkFg = avatarInitialsForeground(brand, accent, "dark");
        assertInitials(darkFg, accent, darkBrandSurfaces(brand));
        const sideFg = sidebarInitialsForeground(brand, accent, "light");
        assertInitials(sideFg, DEFAULT_LIGHT_PRIMARY, [brand]);
      }
    }
  });

  it("does not claim a mid-slate brand with a white accent", () => {
    // #545454 is still under the HQ "too light" warning (0.15) but the 20%
    // white tint crosses the 4.5 boundary. One initials colour cannot clear
    // every surface. The choice is the better opposite, not a swapped brand.
    const fg = avatarInitialsForeground("#545454", "#ffffff", "dark");
    const min = minTintContrast(fg, "#ffffff", darkBrandSurfaces("#545454"));
    expect(min).toBeLessThan(TEXT_CONTRAST_MIN);
    const white = minTintContrast("#ffffff", "#ffffff", darkBrandSurfaces("#545454"));
    const black = minTintContrast("#000000", "#ffffff", darkBrandSurfaces("#545454"));
    expect(min).toBeGreaterThanOrEqual(Math.max(white, black) - 0.02);
  });

  it("leaves light-mode page initials on the default primary, which already clears the light canvas", () => {
    const fg = DEFAULT_LIGHT_PRIMARY;
    assertInitials(fg, DEFAULT_LIGHT_PRIMARY, [LIGHT_CANVAS, "#ffffff"]);
    document.documentElement.classList.add("light");
    applyBrandTheme("#000000", "#ffffff");
    // The page variable may be computed, but the light-mode page rule does not
    // retint --primary. The stylesheet primary stays the default token.
    expect(document.documentElement.style.getPropertyValue("--primary").trim()).toBe("");
  });

  it("applies the initials variable to avatar fallback text and not to other primary text", () => {
    document.documentElement.classList.add("dark");
    applyBrandTheme(DEFAULT_BRAND, DEFAULT_ACCENT);
    const fg = document.documentElement.style.getPropertyValue("--avatar-initials-fg").trim();
    const style = document.createElement("style");
    style.textContent = [
      ".dark .text-primary { color: var(--primary); }",
      '.dark [data-slot="avatar-fallback"].text-primary { color: var(--avatar-initials-fg); }',
    ].join("\n");
    document.head.append(style);
    const button = document.createElement("span");
    button.className = "text-primary";
    button.textContent = "Save";
    const initials = document.createElement("span");
    initials.className = "text-primary";
    initials.setAttribute("data-slot", "avatar-fallback");
    initials.textContent = "ZZ";
    document.body.append(button, initials);

    const buttonColor = getComputedStyle(button).color;
    const initialsColor = getComputedStyle(initials).color;
    expect(initialsColor).not.toBe(buttonColor);
    const rgb = initialsColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const rendered = rgb
      ? `#${[rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`
      : initialsColor.trim().toLowerCase();
    expect(rendered).toMatch(/^#[0-9a-f]{6}$/);
    expect(rendered).not.toBe(DEFAULT_ACCENT);
    const tint = compositeOver(DEFAULT_ACCENT, companySurfaceHex(DEFAULT_BRAND, "dark"), 0.2);
    expect(contrastRatio(rendered, tint)).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN);
    expect(contrastRatio(fg, tint)).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN);
    const css = fs.readFileSync(path.join(rootDir, "src/app/globals.css"), "utf8");
    expect(css).toContain('.dark [data-slot="avatar-fallback"].text-primary { color: var(--avatar-initials-fg); }');
    expect(css).toContain('html:not(.dark) [data-surface="sidebar"][data-slot="avatar-fallback"].text-primary');
    expect(css).toContain("color: var(--avatar-initials-fg-sidebar)");
  });
});

describe("Android chrome surface", () => {
  beforeEach(clearTheme);

  it("sets one theme-color meta to the company surface and drops OS-scheme tags", () => {
    document.documentElement.classList.add("dark");
    const os = document.createElement("meta");
    os.setAttribute("name", "theme-color");
    os.setAttribute("media", "(prefers-color-scheme: light)");
    os.setAttribute("content", "#f8f9fa");
    document.head.append(os);

    applyBrandTheme("#102030", "#abcdef");
    const tags = [...document.querySelectorAll('meta[name="theme-color"]')];
    expect(tags).toHaveLength(1);
    expect(tags[0].getAttribute("media")).toBeNull();
    const surface = companySurfaceHex("#102030", "dark");
    expect(tags[0].getAttribute("content")).toBe(surface);
    expect(tags[0].getAttribute("content")).toBe(document.documentElement.style.getPropertyValue("--background").trim());
    expect(tags[0].getAttribute("content")).not.toBe("#abcdef");
    expect(tags[0].getAttribute("content")).not.toBe("#dd8c33");
  });

  it("updates the bar colour when the active company changes and does not touch icons", () => {
    document.documentElement.classList.add("dark");
    const logo = "https://example.supabase.co/storage/v1/object/public/company-logos/company-a/logo.png";
    const iconsFor = (active: string) => selectInstallIcons({
      explicitInstallCompanyId: "company-a",
      activeCompanyId: active,
      logoUrl: logo,
      logoSameOriginOpaque: true,
    });

    applyBrandTheme("#111827", "#f59e0b");
    const first = iconsFor("company-a");
    const firstBar = document.querySelector('meta[name="theme-color"]')!.getAttribute("content");

    applyBrandTheme("#3f1d2e", "#22c55e");
    const second = iconsFor("company-b");
    const secondBar = document.querySelector('meta[name="theme-color"]')!.getAttribute("content");

    expect(first).toEqual(second);
    expect(JSON.stringify(second)).not.toContain("company-a");
    expect(JSON.stringify(second)).not.toContain("supabase");
    expect(second.rewriteManifest).toBe(false);
    expect(second.usedClientLogo).toBe(false);
    expect(firstBar).toBe(companySurfaceHex("#111827", "dark"));
    expect(secondBar).toBe(companySurfaceHex("#3f1d2e", "dark"));
    expect(secondBar).not.toBe(firstBar);
    expect(document.documentElement.style.getPropertyValue("--accent").trim()).toBe("#22c55e");
  });

  it("uses the light canvas, not the accent, when the app is in light mode", () => {
    document.documentElement.classList.add("light");
    applyBrandTheme("#1d3451", "#dd8c33");
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute("content")).toBe(LIGHT_CANVAS);
  });

  it("styles the root and the nav inset with the background token and the safe area", () => {
    const css = fs.readFileSync(path.join(rootDir, "src/app/globals.css"), "utf8");
    expect(css).toMatch(/html \{[^}]*bg-background/);
    expect(css).toContain("min-height: 100%");
    expect(css).toContain("padding-bottom: env(safe-area-inset-bottom, 0px)");
    expect(css).toContain("nav.safe-area-bottom::after");
    expect(css).toContain("background-color: var(--background)");
    expect(css).toContain("height: env(safe-area-inset-bottom, 0px)");
  });
});
