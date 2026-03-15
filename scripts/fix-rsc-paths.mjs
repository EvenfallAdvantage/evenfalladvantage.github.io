/**
 * Post-build script: creates dot-separated copies of RSC prefetch files
 * so GitHub Pages can serve them at the URLs Next.js requests.
 *
 * e.g. feed/__next.feed/__PAGE__.txt → feed/__next.feed.__PAGE__.txt
 *      admin/events/__next.admin/events/__PAGE__.txt → admin/events/__next.admin.events.__PAGE__.txt
 */
import fs from "fs";
import path from "path";

const OUT_DIR = path.resolve("out");
let count = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // If this is a __next.* directory, flatten its contents
      if (entry.name.startsWith("__next.")) {
        flattenRscDir(dir, entry.name, full);
      } else {
        walk(full);
      }
    }
  }
}

function flattenRscDir(parentDir, prefix, rscDir) {
  for (const entry of fs.readdirSync(rscDir, { withFileTypes: true })) {
    const full = path.join(rscDir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".txt")) {
      // e.g. __next.feed/__PAGE__.txt → __next.feed.__PAGE__.txt
      const dotName = `${prefix}.${entry.name}`;
      const dest = path.join(parentDir, dotName);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(full, dest);
        count++;
      }
    } else if (entry.isDirectory()) {
      // e.g. __next.admin/events/__PAGE__.txt → __next.admin.events.__PAGE__.txt
      flattenNestedDir(parentDir, prefix, full, entry.name);
    }
  }
}

function flattenNestedDir(parentDir, prefix, nestedDir, segment) {
  for (const entry of fs.readdirSync(nestedDir, { withFileTypes: true })) {
    const full = path.join(nestedDir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".txt")) {
      const dotName = `${prefix}.${segment}.${entry.name}`;
      const dest = path.join(parentDir, dotName);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(full, dest);
        count++;
      }
    } else if (entry.isDirectory()) {
      // Recurse deeper
      flattenNestedDir(parentDir, `${prefix}.${segment}`, full, entry.name);
    }
  }
}

walk(OUT_DIR);
console.log(`✓ Created ${count} dot-separated RSC prefetch files`);
