import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    // The built-app install flow is opt-in (`npm run test:pwa-install`).
    // It is not part of `npm test`, which runs before the Pages build and
    // must not start a nested production build.
    include: process.env.PWA_INSTALL_BROWSER === "1"
      ? ["src/__tests__/pwa-company-install-flow.browser.integration.ts"]
      : ["src/__tests__/**/*.test.{ts,tsx}"],
    pool: "threads",
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/lib/**", "src/stores/**", "src/components/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
