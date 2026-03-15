/**
 * Post-build script: Flatten nested RSC payload directories.
 *
 * Next.js 15 with trailingSlash: true + output: "export" generates RSC
 * payload .txt files inside nested __next.* directories, e.g.:
 *   feed/__next.feed/__PAGE__.txt
 *
 * But the client-side router requests them as dot-separated flat files:
 *   feed/__next.feed.__PAGE__.txt
 *
 * GitHub Pages can't do server-side rewrites, so this script creates the
 * flat copies that the client expects.
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.resolve(__dirname, "../out");

let created = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith("__next.")) {
        flattenNextDir(dir, entry.name, fullPath);
      }
      walk(fullPath);
    }
  }
}

function flattenNextDir(parentDir, prefix, nextDir) {
  for (const entry of fs.readdirSync(nextDir, { withFileTypes: true })) {
    const childPath = path.join(nextDir, entry.name);
    if (entry.isFile()) {
      const flatName = prefix + "." + entry.name;
      const flatPath = path.join(parentDir, flatName);
      if (!fs.existsSync(flatPath)) {
        fs.copyFileSync(childPath, flatPath);
        created++;
      }
    } else if (entry.isDirectory()) {
      flattenSubDir(parentDir, prefix + "." + entry.name, childPath);
    }
  }
}

function flattenSubDir(parentDir, prefix, subDir) {
  for (const entry of fs.readdirSync(subDir, { withFileTypes: true })) {
    const childPath = path.join(subDir, entry.name);
    if (entry.isFile()) {
      const flatName = prefix + "." + entry.name;
      const flatPath = path.join(parentDir, flatName);
      if (!fs.existsSync(flatPath)) {
        fs.copyFileSync(childPath, flatPath);
        created++;
      }
    } else if (entry.isDirectory()) {
      flattenSubDir(parentDir, prefix + "." + entry.name, childPath);
    }
  }
}

walk(OUT_DIR);
console.log(`Flattened ${created} RSC payload files.`);
