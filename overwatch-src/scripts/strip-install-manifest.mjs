/**
 * postbuild: drop the shared manifest link from the install document only.
 * See install-document-manifest.mjs for why this is not exportPathMap.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteBuiltInstallDocument } from "./install-document-manifest.mjs";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "out");
const result = rewriteBuiltInstallDocument(outDir);
console.log(`Install document has no shared manifest link: ${result.installPath}`);
console.log(`Default document still links /overwatch/manifest.json: ${result.homePath}`);
