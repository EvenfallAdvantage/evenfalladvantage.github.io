import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { companySurfaceHex, DEFAULT_ACCENT, DEFAULT_BRAND } from "@/lib/brand-utils";
import { OVERWATCH_ICONS, PWA_SCOPE, PWA_START_URL, selectInstallIcons } from "@/lib/pwa-install-policy";

const rootDir = path.resolve(__dirname, "../..");

describe("public manifest icons and chrome", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, "public/manifest.json"), "utf8"));

  it("ships the default Overwatch icons and no company logo", () => {
    expect(manifest.icons).toEqual(OVERWATCH_ICONS.map((icon) => ({ ...icon })));
    expect(manifest.start_url).toBe(PWA_START_URL);
    expect(manifest.scope).toBe(PWA_SCOPE);
    const raw = JSON.stringify(manifest);
    expect(raw).not.toMatch(/supabase|logo_url|companyId|company-logos/i);
  });

  it("uses the default company surface for theme_color, not the accent", () => {
    expect(manifest.theme_color).toBe(companySurfaceHex(DEFAULT_BRAND, "dark"));
    expect(manifest.theme_color).not.toBe("#dd8c33");
    expect(manifest.theme_color).not.toBe(DEFAULT_ACCENT);
    expect(manifest.background_color).toBe("#0b1422");
  });
});

describe("install icon selection", () => {
  const logoA = "https://cdn.example/storage/v1/object/public/company-logos/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/logo.png";
  const logoB = "https://cdn.example/storage/v1/object/public/company-logos/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/logo.png";

  it("falls back to Overwatch when there is no logo and when a logo is present", () => {
    const missing = selectInstallIcons({
      explicitInstallCompanyId: null,
      activeCompanyId: null,
      logoUrl: null,
      logoSameOriginOpaque: false,
    });
    const withLogo = selectInstallIcons({
      explicitInstallCompanyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      activeCompanyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      logoUrl: logoA,
      logoSameOriginOpaque: true,
    });
    expect(missing.icons).toEqual(OVERWATCH_ICONS);
    expect(withLogo.icons).toEqual(OVERWATCH_ICONS);
    expect(withLogo.usedClientLogo).toBe(false);
    expect(withLogo.manifestCompanyId).toBeNull();
    expect(withLogo.rewriteManifest).toBe(false);
    expect(withLogo.startUrl).toBe(PWA_START_URL);
    expect(JSON.stringify(withLogo)).not.toContain("aaaaaaaa");
    expect(JSON.stringify(withLogo)).not.toContain("logo.png");
  });

  it("keeps the same icons when the active company changes", () => {
    const installed = selectInstallIcons({
      explicitInstallCompanyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      activeCompanyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      logoUrl: logoA,
      logoSameOriginOpaque: true,
    });
    const switched = selectInstallIcons({
      explicitInstallCompanyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      activeCompanyId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      logoUrl: logoB,
      logoSameOriginOpaque: true,
    });
    const unauthenticated = selectInstallIcons({
      explicitInstallCompanyId: null,
      activeCompanyId: null,
      logoUrl: logoB,
      logoSameOriginOpaque: false,
    });
    expect(switched).toEqual(installed);
    expect(unauthenticated.icons).toEqual(installed.icons);
    expect(JSON.stringify(unauthenticated)).not.toContain("bbbbbbbb");
  });
});

describe("service worker cache version", () => {
  const sw = fs.readFileSync(path.join(rootDir, "public/sw.js"), "utf8");

  it("versions every cache from the deploy hash and drops stale overwatch caches", () => {
    expect(sw).toContain('const SW_VERSION = "__BUILD_HASH__"');
    expect(sw).toContain('const VERSION_TAG = SW_VERSION.startsWith("__") ? "dev" : SW_VERSION');
    expect(sw).toContain("overwatch-pages-${VERSION_TAG}");
    expect(sw).toContain("overwatch-static-${VERSION_TAG}");
    expect(sw).toContain("overwatch-runtime-${VERSION_TAG}");
    expect(sw).toContain("owCompanyPwa.shouldPreserveCompanyCache(k)");
    expect(sw).toContain('k.startsWith("overwatch-") && !owCompanyPwa.shouldPreserveCompanyCache(k) && !keep.has(k)');
  });

  it("precaches the shared manifest, not a per-company icon cache", () => {
    expect(sw).toContain("/manifest.json");
    expect(sw).toContain("/images/icon-192.png");
    expect(sw).toContain("/images/icon-512.png");
    expect(sw).not.toMatch(/company-logos|logo_url|activeCompany|brand_color/);
    expect(sw).not.toMatch(/overwatch-icon-\$\{/);
  });
});
