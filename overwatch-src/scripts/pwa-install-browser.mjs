/**
 * Opt-in browser run for the built company install page.
 *
 * `npm test` does not call this. The Pages workflow runs `npm test` before
 * `npm run build`, and this file must not start a nested build there.
 *
 * The export is a gitignored `.pwa-install-export-*` directory inside this
 * app, because Next.js refuses an export directory outside the app. It is
 * deleted when the run finishes. prebuild rewrites
 * src/lib/generated-releases.json; the bytes from before this process are
 * written back in finally. Nothing is restored with git checkout.
 */
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteBuiltInstallDocument } from "./install-document-manifest.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releasesPath = path.join(rootDir, "src/lib/generated-releases.json");
const savedReleases = readFileSync(releasesPath);
const beforeHash = createHash("sha256").update(savedReleases).digest("hex");
const exportName = `.pwa-install-export-${randomBytes(6).toString("hex")}`;
const exportDir = path.join(rootDir, exportName);
mkdirSync(exportDir);
const chromeCandidates = [
  process.env.CHROME_PATH,
  "/usr/local/bin/google-chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
].filter((item) => Boolean(item));
const chromePath = chromeCandidates.find((item) => existsSync(item));

function hashFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: rootDir, env, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

let restored = false;
function restoreReleases() {
  if (restored) return;
  writeFileSync(releasesPath, savedReleases);
  restored = true;
}

let exitCode = 1;
try {
  if (!chromePath) {
    throw new Error("Google Chrome is required. Set CHROME_PATH or install google-chrome.");
  }
  const env = { ...process.env, OVERWATCH_EXPORT_DIR: exportName };
  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    env.NEXT_PUBLIC_SUPABASE_URL = "https://pwa-fixture.supabase.co";
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_pwa_fixture_test_key";
  }
  console.log(`Company install browser export: ${exportDir}`);
  exitCode = run(process.execPath, ["scripts/generate-releases.mjs"], env);
  if (exitCode !== 0) throw new Error("prebuild failed");
  exitCode = run(path.join(rootDir, "node_modules/.bin/next"), ["build"], env);
  if (exitCode !== 0) throw new Error("next build failed");
  rewriteBuiltInstallDocument(exportDir);
  restoreReleases();
  if (hashFile(releasesPath) !== beforeHash) {
    throw new Error("generated-releases.json changed after restore");
  }
  console.log(`generated-releases.json unchanged (${beforeHash})`);
  exitCode = run(path.join(rootDir, "node_modules/.bin/vitest"), ["run", "src/__tests__/pwa-company-install-flow.browser.integration.ts"], {
    ...process.env,
    PWA_INSTALL_BROWSER: "1",
    PWA_INSTALL_EXPORT: exportDir,
    CHROME_PATH: chromePath,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = exitCode === 0 ? 1 : exitCode;
} finally {
  restoreReleases();
  rmSync(exportDir, { recursive: true, force: true });
}

if (hashFile(releasesPath) !== beforeHash) {
  console.error("generated-releases.json was not restored to its original bytes");
  exitCode = 1;
}
process.exit(exitCode);
