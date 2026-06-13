// Geo-code all radio frequencies with city/state/county data
// Uses OpenStreetMap Nominatim API (1 req/sec rate limit)
// Outputs: prisma/radio-geocode.sql

const https = require("https");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://nneueuvyeohwnspbwfub.supabase.co";
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZXVldXZ5ZW9od25zcGJ3ZnViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU0MDU0NSwiZXhwIjoyMDg5MTE2NTQ1fQ.geCqJyyGqgLhgO3VYvQXXZPalpxhKt4Hug5wTJKD168";

const STATE_CAPITALS = {
  AL: { city: "Montgomery", lat: 32.377716, lon: -86.300568 },
  AK: { city: "Juneau", lat: 58.301598, lon: -134.420212 },
  AZ: { city: "Phoenix", lat: 33.448166, lon: -112.076847 },
  AR: { city: "Little Rock", lat: 34.746481, lon: -92.289595 },
  CA: { city: "Sacramento", lat: 38.575764, lon: -121.478851 },
  CO: { city: "Denver", lat: 39.739236, lon: -104.984862 },
  CT: { city: "Hartford", lat: 41.763336, lon: -72.685089 },
  DE: { city: "Dover", lat: 39.158169, lon: -75.524368 },
  FL: { city: "Tallahassee", lat: 30.438256, lon: -84.280733 },
  GA: { city: "Atlanta", lat: 33.749001, lon: -84.387978 },
  HI: { city: "Honolulu", lat: 21.309884, lon: -157.858140 },
  ID: { city: "Boise", lat: 43.598693, lon: -116.221245 },
  IL: { city: "Springfield", lat: 39.781721, lon: -89.650647 },
  IN: { city: "Indianapolis", lat: 39.768403, lon: -86.158068 },
  IA: { city: "Des Moines", lat: 41.590939, lon: -93.603366 },
  KS: { city: "Topeka", lat: 39.048332, lon: -95.678060 },
  KY: { city: "Frankfort", lat: 38.186706, lon: -84.875275 },
  LA: { city: "Baton Rouge", lat: 30.451467, lon: -91.187148 },
  ME: { city: "Augusta", lat: 44.307189, lon: -69.781490 },
  MD: { city: "Annapolis", lat: 38.978764, lon: -76.489922 },
  MA: { city: "Boston", lat: 42.360082, lon: -71.058880 },
  MI: { city: "Lansing", lat: 42.732535, lon: -84.555275 },
  MN: { city: "Saint Paul", lat: 44.953703, lon: -93.089958 },
  MS: { city: "Jackson", lat: 32.298757, lon: -90.184810 },
  MO: { city: "Jefferson City", lat: 38.576702, lon: -92.173516 },
  MT: { city: "Helena", lat: 46.588371, lon: -112.024505 },
  NE: { city: "Lincoln", lat: 40.813616, lon: -96.702596 },
  NV: { city: "Carson City", lat: 39.163914, lon: -119.766121 },
  NH: { city: "Concord", lat: 43.208137, lon: -71.537572 },
  NJ: { city: "Trenton", lat: 40.217053, lon: -74.742938 },
  NM: { city: "Santa Fe", lat: 35.686975, lon: -105.937799 },
  NY: { city: "Albany", lat: 42.652579, lon: -73.756232 },
  NC: { city: "Raleigh", lat: 35.779590, lon: -78.638179 },
  ND: { city: "Bismarck", lat: 46.808327, lon: -100.783739 },
  OH: { city: "Columbus", lat: 39.961176, lon: -82.998794 },
  OK: { city: "Oklahoma City", lat: 35.467560, lon: -97.516428 },
  OR: { city: "Salem", lat: 44.942898, lon: -123.035096 },
  PA: { city: "Harrisburg", lat: 40.273191, lon: -76.886701 },
  RI: { city: "Providence", lat: 41.823989, lon: -71.412834 },
  SC: { city: "Columbia", lat: 34.000710, lon: -81.034814 },
  SD: { city: "Pierre", lat: 44.368316, lon: -100.350967 },
  TN: { city: "Nashville", lat: 36.162664, lon: -86.781602 },
  TX: { city: "Austin", lat: 30.267153, lon: -97.743061 },
  UT: { city: "Salt Lake City", lat: 40.760779, lon: -111.891047 },
  VT: { city: "Montpelier", lat: 44.260059, lon: -72.575387 },
  VA: { city: "Richmond", lat: 37.540725, lon: -77.436048 },
  WA: { city: "Olympia", lat: 47.035574, lon: -122.902483 },
  WV: { city: "Charleston", lat: 38.349820, lon: -81.632623 },
  WI: { city: "Madison", lat: 43.073052, lon: -89.401230 },
  WY: { city: "Cheyenne", lat: 41.139981, lon: -104.820246 },
  DC: { city: "Washington", lat: 38.907192, lon: -77.036871 },
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: { "User-Agent": "OverwatchScanner/1.0", ...headers },
    };
    https.get(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse error: ${data.slice(0, 300)}`));
        }
      });
    }).on("error", reject);
  });
}

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;
  const results = await httpsGet(url);
  if (results && results.length > 0 && results[0].lat && results[0].lon) {
    return {
      lat: parseFloat(results[0].lat),
      lon: parseFloat(results[0].lon),
      display: results[0].display_name,
    };
  }
  return null;
}

async function main() {
  console.log("Fetching frequencies from Supabase...");
  const data = await httpsGet(
    `${SUPABASE_URL}/rest/v1/radio_frequencies?select=id,name,city,state,county,is_reference&order=state.asc,city.asc&limit=1000`,
    { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` }
  );
  console.log(`Got ${data.length} frequencies`);

  // Build unique location keys
  const locationMap = new Map();
  const freqLocations = [];

  for (const f of data) {
    let locationKey;
    let query;

    if (f.city) {
      const cleanCity = f.city.replace(/,?\s*(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s*$/, "").trim();
      locationKey = `${cleanCity}|${f.state}`;
      query = `${cleanCity}, ${f.state}, USA`;
    } else if (f.county) {
      const countyName = f.county.replace(/\s+(County|City|Parish)$/i, "").trim();
      locationKey = `county:${f.county}|${f.state}`;
      query = `${countyName} County, ${f.state}, USA`;
    } else {
      const cap = STATE_CAPITALS[f.state];
      if (cap) {
        locationKey = `statewide:${f.state}`;
        locationMap.set(locationKey, { lat: cap.lat, lon: cap.lon, source: "capital" });
        freqLocations.push({ id: f.id, locationKey });
        continue;
      }
      locationKey = `unknown:${f.state}`;
    }

    if (!locationMap.has(locationKey)) {
      locationMap.set(locationKey, { pending: true, query });
    }
    freqLocations.push({ id: f.id, locationKey });
  }

  const pendingKeys = [...locationMap.entries()].filter(([, v]) => v.pending);
  console.log(`Unique locations to geocode via Nominatim: ${pendingKeys.length}`);

  // Geocode each unique location
  let count = 0;
  for (const [key, val] of pendingKeys) {
    count++;
    try {
      const result = await geocode(val.query);
      if (result) {
        locationMap.set(key, { lat: result.lat, lon: result.lon, source: "nominatim", display: result.display });
        console.log(`  [${count}/${pendingKeys.length}] ${val.query} → ${result.lat}, ${result.lon}`);
      } else {
        console.log(`  [${count}/${pendingKeys.length}] ${val.query} → NOT FOUND`);
        locationMap.set(key, null);
      }
    } catch (e) {
      console.log(`  [${count}/${pendingKeys.length}] ${val.query} → ERROR: ${e.message}`);
      locationMap.set(key, null);
    }
    if (count < pendingKeys.length) await sleep(1100);
  }

  // Generate UPDATE SQL
  const sqlLines = [
    "-- ============================================================",
    "-- OVERWATCH -- Radio Frequency Geocoding",
    "-- Auto-generated lat/lon from OpenStreetMap Nominatim + state capitals",
    "-- Run AFTER: add-radio-system.sql (which adds latitude/longitude columns)",
    "-- ============================================================",
    "",
  ];

  let updatedCount = 0;
  for (const fl of freqLocations) {
    const loc = locationMap.get(fl.locationKey);
    if (loc && loc.lat != null && loc.lon != null) {
      sqlLines.push(
        `UPDATE radio_frequencies SET latitude = ${loc.lat}, longitude = ${loc.lon} WHERE id = '${fl.id}';`
      );
      updatedCount++;
    }
  }

  sqlLines.push("");
  sqlLines.push(`-- ${updatedCount} rows updated`);

  const outPath = path.join(__dirname, "..", "prisma", "radio-geocode.sql");
  fs.writeFileSync(outPath, sqlLines.join("\n"), "utf8");
  console.log(`\nWrote ${updatedCount} UPDATE statements to ${outPath}`);

  // Summary
  const nomCount = [...locationMap.values()].filter((v) => v && v.source === "nominatim").length;
  const capCount = [...locationMap.values()].filter((v) => v && v.source === "capital").length;
  const failCount = [...locationMap.values()].filter((v) => v === null).length;
  console.log(`\nSummary:`);
  console.log(`  Nominatim geocoded: ${nomCount}`);
  console.log(`  State capital fallback: ${capCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Frequencies with coords: ${updatedCount}`);
}

main().catch(console.error);
