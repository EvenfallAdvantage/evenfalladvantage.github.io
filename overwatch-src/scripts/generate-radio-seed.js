const fs = require("fs");
const path = require("path");

const tsPath = path.resolve(__dirname, "../src/lib/supabase/radio-frequency-data.ts");
const outPath = path.resolve(__dirname, "../prisma/radio-seed.sql");

const lines = fs.readFileSync(tsPath, "utf8").split("\n");

// Each data entry is on a single line like:
//   { name: 'AL State Troopers Dispatch', frequency: 154.680, mode: 'FM', ... },
const entryPattern = /^\s*\{\s*name:\s*'([^']*)',/
const entries = [];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) continue;
  if (trimmed.startsWith("//")) continue;
  if (trimmed.includes("interface")) continue;
  if (!entryPattern.test(trimmed)) continue;

  const kvpairs = {};
  // Match key: value pairs where value is a single-quoted string or a number
  const kvPattern = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)"|(\d+\.?\d*))\s*(?:[,}]|$)/g;
  let kvMatch;
  while ((kvMatch = kvPattern.exec(trimmed)) !== null) {
    const key = kvMatch[1];
    const val = kvMatch[2] ?? kvMatch[3] ?? kvMatch[4];
    kvpairs[key] = val;
  }
  if (kvpairs.name) entries.push(kvpairs);
}

const esc = (s) => (s != null && s !== "") ? `'${String(s).replace(/'/g, "''")}'` : "NULL";

const sqlLines = [
  "-- ============================================================",
  "-- OVERWATCH -- Radio Frequency Seed Data",
  `-- ${entries.length} reference entries generated from radio-frequency-data.ts`,
  "-- Run in: Supabase Dashboard -> SQL Editor -> New Query",
  "-- ============================================================",
  "",
  "INSERT INTO radio_frequencies (name, frequency, mode, band, ctcss_dcs, description, category, state, city, county, priority, is_reference, sort_order)",
  "VALUES",
];

for (let i = 0; i < entries.length; i++) {
  const f = entries[i];
  const row = [
    esc(f.name),
    parseFloat(f.frequency) || 0,
    esc(f.mode),
    esc(f.band),
    esc(f.ctcss_dcs),
    esc(f.description),
    esc(f.category),
    esc(f.state),
    esc(f.city),
    esc(f.county),
    parseInt(f.priority, 10) || 5,
    "true",
    i + 1,
  ].join(", ");
  sqlLines.push(`  (${row})${i < entries.length - 1 ? "," : ";"}`);
}

sqlLines.push("");
sqlLines.push("CREATE INDEX IF NOT EXISTS idx_radio_frequencies_state ON radio_frequencies(state);");
sqlLines.push("CREATE INDEX IF NOT EXISTS idx_radio_frequencies_category ON radio_frequencies(category);");
sqlLines.push("CREATE INDEX IF NOT EXISTS idx_radio_frequencies_is_reference ON radio_frequencies(is_reference);");
sqlLines.push("");

fs.writeFileSync(outPath, sqlLines.join("\n"), "utf8");
console.log(`Wrote ${entries.length} INSERT statements to ${outPath}`);
