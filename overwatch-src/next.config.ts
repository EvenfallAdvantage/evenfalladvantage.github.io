import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
