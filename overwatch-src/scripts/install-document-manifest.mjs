/**
 * The install document is one static file (out/install/index.html).
 * Next's root metadata emits <link rel="manifest" href="/overwatch/manifest.json">
 * on every page, and a nested layout cannot clear that field
 * (https://nextjs.org/docs/app/api-reference/functions/generate-metadata#manifest).
 * exportPathMap is a Pages Router hook; this app is the App Router.
 *
 * After `next build`, the install file loses every manifest link. The inline
 * head script (marker ow-install-manifest) inserts one during parse:
 * the company manifest when ?company= is a uuid, otherwise the shared manifest.
 * Other HTML files are not rewritten.
 */

import fs from "node:fs";
import path from "node:path";

function manifestLinkPattern() {
  return /<link\b[^>]*\brel\s*=\s*(["'])manifest\1[^>]*>/gi;
}

export function stripManifestLinks(html) {
  return html.replace(manifestLinkPattern(), "");
}

export function hasManifestLink(html) {
  return manifestLinkPattern().test(html);
}

export function rewriteBuiltInstallDocument(outDir) {
  const candidates = ["install/index.html", "install.html"].map((name) => path.join(outDir, name));
  const installPath = candidates.find((file) => fs.existsSync(file));
  if (!installPath) {
    throw new Error(`No install document under ${outDir} (looked for ${candidates.join(", ")})`);
  }
  const before = fs.readFileSync(installPath, "utf8");
  if (!before.includes("ow-install-manifest")) {
    throw new Error(`${installPath} is missing the install manifest boot script`);
  }
  const after = stripManifestLinks(before);
  if (hasManifestLink(after)) {
    throw new Error(`${installPath} still has a manifest link after stripping`);
  }
  fs.writeFileSync(installPath, after);

  const homePath = path.join(outDir, "index.html");
  if (!fs.existsSync(homePath)) {
    throw new Error(`Missing ${homePath}; refusing to finish without checking the default manifest`);
  }
  const home = fs.readFileSync(homePath, "utf8");
  if (!hasManifestLink(home) || !home.includes("/overwatch/manifest.json")) {
    throw new Error("The default Overwatch document lost its manifest link");
  }
  return { installPath, homePath };
}
