import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hasManifestLink, rewriteBuiltInstallDocument, stripManifestLinks } from "../../scripts/install-document-manifest.mjs";

const SHARED = '<link rel="manifest" href="/overwatch/manifest.json"/>';
const STYLES = '<link rel="stylesheet" href="/overwatch/_next/static/app.css"/>';
const ICON = '<link rel="icon" href="/overwatch/favicon.png"/>';

function installPage(extra = ""): string {
  return `<!DOCTYPE html><html><head>${STYLES}${extra}${ICON}<script>/* ow-install-manifest */</script></head><body>Install</body></html>`;
}

describe("install document manifest", () => {
  it("removes only the manifest link, including when href comes first", () => {
    const swapped = installPage('<link href="/overwatch/manifest.json" rel="manifest">');
    const stripped = stripManifestLinks(swapped);
    expect(hasManifestLink(stripped)).toBe(false);
    expect(stripped).toContain(STYLES);
    expect(stripped).toContain(ICON);
    expect(stripped).toContain("ow-install-manifest");
    expect(hasManifestLink(stripManifestLinks(installPage(SHARED)))).toBe(false);
  });

  it("rewrites the install file and leaves the default document's manifest in place", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ow-install-"));
    fs.mkdirSync(path.join(dir, "install"));
    const home = `<!DOCTYPE html><html><head>${SHARED}${STYLES}</head><body>Overwatch</body></html>`;
    fs.writeFileSync(path.join(dir, "index.html"), home);
    fs.writeFileSync(path.join(dir, "install", "index.html"), installPage(SHARED));
    const result = rewriteBuiltInstallDocument(dir);
    const installHtml = fs.readFileSync(result.installPath, "utf8");
    const homeHtml = fs.readFileSync(result.homePath, "utf8");
    expect(hasManifestLink(installHtml)).toBe(false);
    expect(installHtml).toContain("ow-install-manifest");
    expect(homeHtml).toBe(home);
    expect(hasManifestLink(homeHtml)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
