import path from "node:path";
import type { NextConfig } from "next";

// Opt-in static export directory for `npm run test:pwa-install`.
// Unset in the Pages build, which keeps writing `out/`. Next joins this
// value onto the app directory, so it has to be a relative gitignored
// `.pwa-install-export-*` folder. The runner deletes it when the run finishes.
function isolatedExportDir(): string | undefined {
  const configured = process.env.OVERWATCH_EXPORT_DIR;
  if (!configured) return undefined;
  if (path.isAbsolute(configured) || configured.split(/[\\/]/).includes("..") || !/^\.pwa-install-export-[A-Za-z0-9]+$/.test(configured)) {
    throw new Error("OVERWATCH_EXPORT_DIR must be a relative .pwa-install-export-* directory name");
  }
  return configured;
}

// Cesium ion is used only when the deployment licensed it for commercial use.
// Pin both values at build time so an unset flag is inlined as "" and a leftover
// NEXT_PUBLIC_CESIUM_TOKEN never reaches the public bundle (docs/SECRETS.md).
const ionCommercial = process.env.NEXT_PUBLIC_CESIUM_ION_COMMERCIAL === "true";

const isolatedExport = isolatedExportDir();

const nextConfig: NextConfig = {
  ...(isolatedExport ? { distDir: isolatedExport } : {}),
  env: {
    NEXT_PUBLIC_CESIUM_ION_COMMERCIAL: ionCommercial ? "true" : "",
    NEXT_PUBLIC_CESIUM_TOKEN: ionCommercial ? (process.env.NEXT_PUBLIC_CESIUM_TOKEN ?? "") : "",
  },
  reactCompiler: true,
  output: "export",
  basePath: "/overwatch",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // CesiumJS is loaded from CDN (not bundled) — see cesium-config.ts
};

export default nextConfig;
