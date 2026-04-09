import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "export",
  basePath: "/overwatch",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["cesium"],
};

export default nextConfig;
