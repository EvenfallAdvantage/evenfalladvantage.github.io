/**
 * Pure helpers for intel-region-dossier (no network), unit-tested in lib_test.ts.
 *
 * Sources (all free, no key):
 *  - Reverse geocode: Photon (komoot, OSM data) with lang=en. Nominatim is not used:
 *    it returns HTTP 403 to Supabase's shared egress IPs on every call (its usage
 *    policy discourages cloud bulk use), so it only added ~1s of latency per request.
 *  - Place article: Wikidata `wikibase:around` search for populated items near the
 *    click with an enwiki sitelink, matched to the Photon city (pickPlace).
 *  - Country facts + leaders: Wikidata SPARQL by ISO 3166-1 alpha-2 code (P297).
 *    Replaces RestCountries v3.1, which was retired (it now returns
 *    `{"success":false,...}` with HTTP 200 after a redirect, and v5 needs an API key).
 *  - Summary: Wikipedia REST page summary. Flag image: flagcdn.com.
 */

export const UA = "OverwatchIntel/1.1 (+https://www.evenfalladvantage.com; developer@evenfalladvantage.com)";

export interface LocationInfo {
  city?: string; state?: string; country?: string; country_code?: string; display_name?: string;
}

export interface PhotonResponse {
  features?: { properties?: Record<string, string | undefined> }[];
}
// Feature types that are themselves administrative/place names (safe to show).
const PLACE_TYPES = new Set(["city", "town", "village", "district", "locality", "county", "state", "country"]);

export function parsePhoton(d: PhotonResponse | null | undefined): LocationInfo | null {
  const p = d?.features?.[0]?.properties;
  if (!p || !p.countrycode) return null;
  // Photon's lang=en returns English names where OSM has them, else the local name.
  const city = p.city ?? p.town ?? p.village ?? p.district ?? "";
  // Skip POI / street names (often local-script only, e.g. a school in Tokyo).
  const lead = p.type && PLACE_TYPES.has(p.type) ? p.name : undefined;
  const parts = [lead, p.district, city, p.county, p.state, p.country]
    .filter((x): x is string => !!x);
  return {
    city,
    state: p.state ?? "",
    country: p.country ?? "",
    country_code: p.countrycode.toUpperCase(),
    display_name: [...new Set(parts)].join(", "),
  };
}

/** Wikidata query: populated items with an English Wikipedia article within `km` of the point. */
export function nearbyPlacesSparql(lat: number, lng: number, km = 15): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("bad coords");
  return `SELECT ?item ?label ?article (MAX(?p) AS ?pop) (MIN(?d) AS ?dist) WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?loc.
    bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral; wikibase:radius "${km}"; wikibase:distance ?d. }
  ?item wdt:P1082 ?p.
  FILTER NOT EXISTS { ?item wdt:P576 [] }
  ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>.
  OPTIONAL { ?item rdfs:label ?label FILTER(lang(?label)="en") }
} GROUP BY ?item ?label ?article ORDER BY DESC(?pop) LIMIT 40`;
}

export interface PlaceHit { title: string; label: string; pop: number; dist: number }

export function parseNearby(d: WikidataResponse | null | undefined): PlaceHit[] {
  return (d?.results?.bindings ?? []).flatMap((b) => {
    const url = b.article?.value ?? "";
    const m = url.match(/\/wiki\/(.+)$/);
    if (!m) return [];
    let title: string;
    try { title = decodeURIComponent(m[1]).replace(/_/g, " "); } catch { return []; }
    return [{ title, label: b.label?.value ?? title, pop: Number(b.pop?.value) || 0, dist: Number(b.dist?.value) || 0 }];
  });
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
// Non-place aggregates that tend to dominate by population.
const AGGREGATE = /\b(metropolitan|metro area|urban area|built-up|greater|empire|kingdom of|republic|monarchy|diocese|archdiocese|eparchy|area)\b/i;

/**
 * Choose the Wikipedia article for the clicked place.
 * 1) the most populous hit whose label (or title before a comma) equals the Photon city;
 * 2) else the most populous non-aggregate hit within 8 km.
 */
export function pickPlace(hits: PlaceHit[], city: string | undefined): PlaceHit | null {
  const byPop = [...hits].sort((a, b) => b.pop - a.pop);
  if (city) {
    const c = norm(city);
    const m = byPop.find((h) => [h.label, h.title, h.title.split(",")[0]].some((x) => norm(x) === c));
    if (m) return m;
  }
  return byPop.find((h) => h.dist <= 8 && !AGGREGATE.test(h.label) && !AGGREGATE.test(h.title)) ?? null;
}

/** Trim to <= max chars at a sentence end, else a word boundary (adds an ellipsis). */
export function trimExtract(text: string | undefined, max = 500): string | undefined {
  if (!text) return text;
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentence = Math.max(...[". ", "! ", "? "].map((p) => cut.lastIndexOf(p)));
  if (sentence >= max * 0.4) return cut.slice(0, sentence + 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[\s,;:]+$/, "") + "…";
}

/** ISO alpha-2 → regional-indicator flag emoji. */
export function flagEmoji(cc: string): string {
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function countrySparql(cc: string): string {
  if (!/^[A-Z]{2}$/.test(cc)) throw new Error("bad country code");
  const en = (v: string) => `FILTER(lang(${v})="en")`;
  return `SELECT ?c (SAMPLE(?cl) AS ?name) (SAMPLE(?ol) AS ?official) (SAMPLE(?capl) AS ?capital)
 (MAX(?pop) AS ?population) (MAX(?area) AS ?areaKm) (SAMPLE(?hosl) AS ?hos) (SAMPLE(?hogl) AS ?hog)
 (GROUP_CONCAT(DISTINCT ?curs; separator="|") AS ?currencies)
 (GROUP_CONCAT(DISTINCT ?langl; separator="|") AS ?languages) (SAMPLE(?contl) AS ?continent)
WHERE {
  ?c wdt:P297 "${cc}".
  FILTER NOT EXISTS { ?c wdt:P31 wd:Q3024240 }
  OPTIONAL { ?c rdfs:label ?cl ${en("?cl")} }
  OPTIONAL { ?c wdt:P1448 ?ol ${en("?ol")} }
  OPTIONAL { ?c wdt:P36/rdfs:label ?capl ${en("?capl")} }
  OPTIONAL { ?c wdt:P1082 ?pop }
  OPTIONAL { ?c wdt:P2046 ?area }
  OPTIONAL { ?c wdt:P35/rdfs:label ?hosl ${en("?hosl")} }
  OPTIONAL { ?c wdt:P6/rdfs:label ?hogl ${en("?hogl")} }
  OPTIONAL { ?c wdt:P38 ?cur. ?cur rdfs:label ?curl ${en("?curl")}
             OPTIONAL { ?cur wdt:P498 ?ccode }
             BIND(IF(BOUND(?ccode), CONCAT(?curl, " (", ?ccode, ")"), ?curl) AS ?curs) }
  OPTIONAL { ?c wdt:P37/rdfs:label ?langl ${en("?langl")} }
  OPTIONAL { ?c wdt:P30/rdfs:label ?contl ${en("?contl")} }
} GROUP BY ?c LIMIT 1`;
}

type Binding = Record<string, { value?: string } | undefined>;
export interface WikidataResponse { results?: { bindings?: Binding[] } }

export interface CountryOut {
  name: string; official_name: string; capital: string; population: number; area: number;
  region: string; subregion: string; languages: string[]; currencies: string[];
  flag: string; flag_url: string; timezones: string[];
}

export function parseCountry(
  d: WikidataResponse | null | undefined,
  cc: string,
  fallbackName: string,
): { country: CountryOut; head_of_state: { name?: string; position?: string } | null } | null {
  const b = d?.results?.bindings?.[0];
  if (!b) return null;
  const v = (k: string) => b[k]?.value ?? "";
  const list = (k: string) => v(k).split("|").map((s) => s.trim()).filter(Boolean);
  const num = (k: string) => { const n = Number(v(k)); return Number.isFinite(n) ? n : 0; };
  const name = v("name") || fallbackName;
  const hos = v("hos"), hog = v("hog");
  return {
    country: {
      name,
      official_name: v("official") || name,
      capital: v("capital"),
      population: Math.round(num("population")),
      area: Math.round(num("areaKm")),
      region: v("continent"),
      subregion: "",
      languages: list("languages"),
      currencies: list("currencies"),
      flag: flagEmoji(cc),
      flag_url: /^[A-Z]{2}$/.test(cc) ? `https://flagcdn.com/${cc.toLowerCase()}.svg` : "",
      timezones: [],
    },
    head_of_state: hos
      ? { name: hos, position: hog && hog !== hos ? `Head of State (Head of Government: ${hog})` : "Head of State" }
      : hog ? { name: hog, position: "Head of Government" } : null,
  };
}
