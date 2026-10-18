import type { NextConfig } from "next";

// Cesium ion is used only when the deployment licensed it for commercial use.
// Pin both values at build time so an unset flag is inlined as "" and a leftover
// NEXT_PUBLIC_CESIUM_TOKEN never reaches the public bundle (docs/SECRETS.md).
const ionCommercial = process.env.NEXT_PUBLIC_CESIUM_ION_COMMERCIAL === "true";

const nextConfig: NextConfig = {
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
