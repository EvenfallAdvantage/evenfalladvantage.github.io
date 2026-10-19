#!/usr/bin/env node
/**
 * Build the pre-built OpenStreetMap infrastructure extract served from
 * public/data/infra/ (Infrastructure > "Power, data & military sites").
 *
 * Inputs (all © OpenStreetMap contributors, ODbL 1.0):
 *   --gev <dir>   gods-eye-view src/data/local_data (MIT code, ODbL data,
 *                 © 2026 Bilawal Sidhu): datacenters, dams (via Open
 *                 Infrastructure Map) and named military areas (via Overture
 *                 Maps base/land_use).
 *   --overpass    also fetch high-voltage substations (>= 110 kV) and
 *                 transmission lines (>= 345 kV) for the US from Overpass,
 *                 tile by tile, politely (User-Agent, 1 request at a time,
 *                 pause between tiles, retry with backoff). If Overpass is
 *                 unavailable the build still writes the GEV layers and
 *                 records the power layers as pending in index.json.
 *
 * Output: public/data/infra/index.json + one c_<lat>_<lng>.json per 10° cell.
 * Cell rows: [kind, lng, lat, name, extra?]; kind d=datacenter, w=dam,
 * m=military area, s=substation. Lines: [kv, [[lng,lat],...]].
 * Contact-type tags are never copied. The output is a derived database
 * under ODbL 1.0; keep the "© OpenStreetMap contributors (ODbL)" credit.
 *
 * Usage: node scripts/build-infra-extract.mjs --gev /tmp/gev/src/data/local_data [--overpass]
 */
import fs from "node:fs";
import path from "node:path";

const UA = "EvenfallOverwatch-infra-extract/1.0 (+https://www.evenfalladvantage.com)";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const CELL = 10;
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../public/data/infra");

const args = process.argv.slice(2);
const gevDir = args[args.indexOf("--gev") + 1];
const withOverpass = args.includes("--overpass");
if (!args.includes("--gev") || !gevDir) { console.error("usage: --gev <local_data dir> [--overpass]"); process.exit(2); }

const r5 = (n) => Math.round(n * 1e5) / 1e5;
const clean = (s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, 80) : "");

function ringCentroid(coords) {
  // Average of the outer ring's vertices (closing vertex dropped): good enough for a label point.
  const ring = coords[0][0] === coords[0].at(-1)[0] && coords[0][1] === coords[0].at(-1)[1] ? coords.slice(0, -1) : coords;
  let x = 0, y = 0;
  for (const [lng, lat] of ring) { x += lng; y += lat; }
  return [x / ring.length, y / ring.length];
}
function centroid(geom) {
  if (!geom) return null;
  if (geom.type === "Point") return geom.coordinates;
  if (geom.type === "Polygon") return ringCentroid(geom.coordinates[0]);
  if (geom.type === "MultiPolygon") return ringCentroid(geom.coordinates[0][0]);
  if (geom.type === "LineString") return geom.coordinates[Math.floor(geom.coordinates.length / 2)];
  if (geom.type === "MultiLineString") return geom.coordinates[0][Math.floor(geom.coordinates[0].length / 2)];
  return null;
}
function cellKey(lng, lat) {
  const a = Math.floor(lat / CELL) * CELL, b = Math.floor(lng / CELL) * CELL;
  return `${a}_${b}`;
}

const cells = new Map();
const counts = { datacenter: 0, dam: 0, military: 0, substation: 0, line: 0 };
function put(row) {
  const [, lng, lat] = row;
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  const k = cellKey(lng, lat);
  if (!cells.has(k)) cells.set(k, { f: [], l: [] });
  cells.get(k).f.push(row);
  return true;
}

function readLines(file) {
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// Datacenters
for (const f of readLines(path.join(gevDir, "datacenters/datacenters.geojsonl"))) {
  const c = centroid(f.geometry); if (!c) continue;
  const t = f.properties?.tags ?? {};
  const name = clean(t.name) || clean(t.operator) || "Data centre";
  const op = clean(t.operator);
  if (put(["d", r5(c[0]), r5(c[1]), name, op && op !== name ? op : undefined].filter((v) => v !== undefined))) counts.datacenter++;
}
// Dams
for (const f of readLines(path.join(gevDir, "dams/dams.geojsonl"))) {
  const c = centroid(f.geometry); if (!c) continue;
  const p = f.properties ?? {};
  const t = p.tags ?? p;
  if (put(["w", r5(c[0]), r5(c[1]), clean(t.name) || "Dam"])) counts.dam++;
}
// Military areas: [typedOsmId, name, lon, lat, w, s, e, n, classIndex, areaM2]
const mil = JSON.parse(fs.readFileSync(path.join(gevDir, "osm_military_names/names.json"), "utf8"));
for (const r of mil.records) {
  const cls = mil.classes[r[8]] ?? "military_land";
  if (put(["m", r5(r[2]), r5(r[3]), clean(r[1]) || "Military area", `${cls}|${r[0]}`])) counts.military++;
}

// Overpass (optional, US tiles)
const pending = [];
async function overpass(query) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = OVERPASS[attempt % OVERPASS.length];
    try {
      const res = await fetch(url, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(query), signal: AbortSignal.timeout(200_000) });
      if (res.ok) return await res.json();
      console.warn(`overpass ${url} -> ${res.status}`);
    } catch (e) { console.warn(`overpass ${url} -> ${e.message}`); }
    await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)));
  }
  return null;
}
const kv = (v) => { const n = Math.max(...String(v ?? "").split(/[;,]/).map(Number).filter(Number.isFinite)); return Number.isFinite(n) ? Math.round(n / 1000) : 0; };
if (withOverpass) {
  const tiles = [];
  for (let s = 24; s < 50; s += 6) for (let w = -125; w < -66; w += 10) tiles.push([s, w, Math.min(s + 6, 50), Math.min(w + 10, -66)]);
  for (const [s, w, n, e] of tiles) {
    const bb = `${s},${w},${n},${e}`;
    const q = `[out:json][timeout:180];(nwr["power"="substation"]["voltage"~"^(1[1-9]|[2-9][0-9]|[1-9][0-9]{2})[0-9]{4}"](${bb}););out center tags qt;way["power"="line"]["voltage"~"^([3-9][4-9][0-9]|[4-9][0-9]{2}|[1-9][0-9]{3})[0-9]{3}"](${bb});out geom qt;`;
    const data = await overpass(q);
    if (!data) { pending.push(bb); continue; }
    for (const el of data.elements ?? []) {
      const t = el.tags ?? {};
      if (t.power === "substation") {
        const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
        if (put(["s", r5(lng), r5(lat), clean(t.name) || "Substation", String(kv(t.voltage))])) counts.substation++;
      } else if (t.power === "line" && el.geometry?.length > 1) {
        const pts = el.geometry.filter((_, i, a) => i % 4 === 0 || i === a.length - 1).map((g) => [r5(g.lon), r5(g.lat)]);
        const k = cellKey(pts[0][0], pts[0][1]);
        if (!cells.has(k)) cells.set(k, { f: [], l: [] });
        cells.get(k).l.push([kv(t.voltage), pts]);
        counts.line++;
      }
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/^c_.*\.json$/.test(f)) fs.unlinkSync(path.join(OUT, f));
const index = {
  v: 1,
  built: new Date().toISOString().slice(0, 10),
  cell: CELL,
  credit: "© OpenStreetMap contributors (ODbL 1.0)",
  sources: {
    datacenter: "OpenStreetMap via gods-eye-view (ODbL)",
    dam: "OpenStreetMap via Open Infrastructure Map / gods-eye-view (ODbL)",
    military: `OpenStreetMap via Overture Maps ${mil.release} / gods-eye-view (ODbL)`,
    power: withOverpass && pending.length === 0 ? "OpenStreetMap via Overpass API (ODbL)" : "pending: Overpass unavailable at build time",
  },
  counts,
  pendingTiles: withOverpass ? pending : ["power layers not built (run with --overpass)"],
  cells: {},
};
for (const [k, c] of [...cells.entries()].sort()) {
  const body = c.l.length ? { f: c.f, l: c.l } : { f: c.f };
  fs.writeFileSync(path.join(OUT, `c_${k}.json`), JSON.stringify(body));
  index.cells[k] = c.f.length + c.l.length;
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1));
console.log(JSON.stringify({ counts, cells: cells.size, pending: pending.length }));
