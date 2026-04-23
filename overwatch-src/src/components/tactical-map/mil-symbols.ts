/**
 * MIL-STD-2525 Military Symbol Generator with Fuzzy Matching
 *
 * Maps S2 Underground feature properties (Attack Type, incident type, etc.)
 * to appropriate tactical symbology using fuzzy keyword matching.
 *
 * SIDC format (10-character): XFGPXXXXXX
 *   X = coding scheme (S=warfighting, W=weather, E=EMS)
 *   F = affiliation (H=hostile, F=friendly, N=neutral, U=unknown)
 *   G = battle dimension (G=ground, A=air, S=sea, P=space)
 *   P = status (P=present)
 *   XXXXXX = function ID
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ms: any = null;

async function loadMilSymbol() {
  if (ms) return ms;
  const mod = await import("milsymbol");
  ms = mod.default ?? mod;
  return ms;
}

// Cache generated data URLs by SIDC+size to avoid re-rendering
const symbolCache = new Map<string, string>();

// ─── Fuzzy SIDC Mapping ───────────────────────────────────

interface SIDCRule {
  keywords: string[];    // any of these keywords triggers this SIDC
  sidc: string;          // 10-char MIL-STD-2525 symbol code
  label: string;         // human-readable description
}

/**
 * Comprehensive keyword → SIDC mapping for intelligence events.
 * Uses verified 15-char letter SIDCs that milsymbol renders correctly.
 * Rules are checked in order; first match wins.
 * Keywords are case-insensitive and matched as substrings.
 *
 * SIDC format (15-char 2525C letter):
 *   S = warfighting, W = METOC, G = tactical graphics, E = EMS
 *   H = hostile, F = friendly, N = neutral, U = unknown
 *   G = ground, A = air, S = sea
 *   P = present
 */
const SIDC_RULES: SIDCRule[] = [
  // ── Specific attack/incident types ──
  // Using verified ground unit/equipment SIDCs that produce distinct icons
  { keywords: ["shooting", "gunfire", "gun", "firearm", "shot fired", "active shooter"], sidc: "SHG-UCFMS------", label: "Shooting" },
  { keywords: ["bombing", "bomb", "ied", "explosive", "detonation", "blast"], sidc: "SHG-UCFM-------", label: "Bombing/IED" },
  { keywords: ["stabbing", "knife", "edged weapon", "blade", "cutting"], sidc: "SHG-UCI--------", label: "Stabbing" },
  { keywords: ["arson", "fire attack", "incendiary", "firebomb", "molotov"], sidc: "SHG-EVC--------", label: "Arson" },
  { keywords: ["vehicle ramming", "vehicle attack", "vehicular", "car attack", "truck attack"], sidc: "SHG-EVCA-------", label: "Vehicle Attack" },
  { keywords: ["kidnapping", "abduction", "hostage", "kidnap"], sidc: "SHG-UCI--------", label: "Kidnapping" },
  { keywords: ["assassination", "assassin", "targeted killing"], sidc: "SHG-UCFMS------", label: "Assassination" },
  { keywords: ["hijack", "carjack", "skyjack", "piracy"], sidc: "SHG-UCI--------", label: "Hijacking" },
  { keywords: ["chemical", "cbrn", "biological", "radiological", "nuclear", "hazmat", "wmd"], sidc: "SHG-UCFML------", label: "CBRN" },
  { keywords: ["cyber", "hack", "ransomware", "ddos", "malware", "data breach"], sidc: "SHG-USS--------", label: "Cyber Attack" },
  { keywords: ["riot", "civil unrest", "protest", "demonstration", "civil disturbance", "mob"], sidc: "SHG-EVC--------", label: "Civil Unrest" },
  { keywords: ["robbery", "armed robbery", "heist", "holdup", "theft"], sidc: "SHG-UCI--------", label: "Robbery" },
  { keywords: ["assault", "battery", "attack", "beating", "violence", "random violence"], sidc: "SHG-UCI--------", label: "Assault" },
  { keywords: ["vandalism", "sabotage", "property damage", "graffiti", "destruction"], sidc: "SHG-EVC--------", label: "Vandalism/Sabotage" },
  { keywords: ["threats", "threat", "intimidation", "menacing", "terroristic threat"], sidc: "SHG-UCI--------", label: "Threat" },
  { keywords: ["sexual", "rape", "sexual assault"], sidc: "SHG-UCI--------", label: "Sexual Assault" },
  { keywords: ["killing", "homicide", "murder", "manslaughter", "fatal"], sidc: "SHG-UCFMS------", label: "Homicide" },

  // ── Infrastructure / disruption ──
  { keywords: ["power outage", "blackout", "grid failure", "electrical"], sidc: "SHG-UCFML------", label: "Power Disruption" },
  { keywords: ["pipeline", "fuel", "oil", "gas leak"], sidc: "SHG-UCFML------", label: "Energy Infrastructure" },
  { keywords: ["water", "dam", "flood", "reservoir", "contamination"], sidc: "SNG-IB---------", label: "Water Infrastructure" },
  { keywords: ["telecommunications", "comms", "cell tower", "internet"], sidc: "SHG-USS--------", label: "Comms Disruption" },
  { keywords: ["transportation", "bridge", "highway", "railroad", "rail", "transit"], sidc: "SNG-IB---------", label: "Transport Infrastructure" },

  // ── Natural hazards (use neutral ground with distinct function IDs) ──
  { keywords: ["earthquake", "seismic", "tremor", "quake"], sidc: "WAS-WSF-LVP----", label: "Earthquake" },
  { keywords: ["wildfire", "forest fire", "brush fire", "wildland fire"], sidc: "WAS-WSFGSO-----", label: "Wildfire" },
  { keywords: ["fire", "structure fire", "blaze"], sidc: "WAS-WSFGSO-----", label: "Fire" },
  { keywords: ["tornado", "twister", "funnel"], sidc: "WAS-WST-FCF----", label: "Tornado" },
  { keywords: ["hurricane", "tropical storm", "cyclone", "typhoon"], sidc: "WAS-WSTSS------", label: "Hurricane" },
  { keywords: ["flood", "flooding", "flash flood", "inundation"], sidc: "WAS-WSF-LVP----", label: "Flood" },
  { keywords: ["volcano", "volcanic", "eruption", "lava"], sidc: "WAS-WSF-LVP----", label: "Volcanic" },
  { keywords: ["tsunami", "tidal wave"], sidc: "WAS-WSTSS------", label: "Tsunami" },
  { keywords: ["landslide", "mudslide", "debris flow", "avalanche"], sidc: "WAS-WSF-LVP----", label: "Landslide" },

  // ── Military/tactical ──
  { keywords: ["drone", "uav", "uas", "unmanned aerial", "quadcopter"], sidc: "SHA-MFQ--------", label: "Drone/UAS" },
  { keywords: ["aircraft", "plane", "jet", "aviation"], sidc: "SHA-MF---------", label: "Hostile Aircraft" },
  { keywords: ["naval", "ship", "vessel", "maritime", "boat"], sidc: "SHS-CLCV-------", label: "Naval Threat" },
  { keywords: ["missile", "rocket", "projectile", "mortar", "artillery"], sidc: "SHG-UCFM-------", label: "Missile/Rocket" },
  { keywords: ["sniper", "marksman", "long range"], sidc: "SHG-UCFMS------", label: "Sniper" },
  { keywords: ["ambush", "raid", "insurgent", "guerrilla"], sidc: "SHG-UCI--------", label: "Ambush/Raid" },

  // ── Friendly / infrastructure ──
  { keywords: ["hospital", "medical", "clinic", "ems", "ambulance"], sidc: "SFG-IBA--------", label: "Medical Facility" },
  { keywords: ["police", "law enforcement", "sheriff", "patrol"], sidc: "SFG-UCIL-------", label: "Law Enforcement" },
  { keywords: ["military base", "installation", "fort", "camp"], sidc: "SFG-IB---------", label: "Military Installation" },
  { keywords: ["school", "university", "campus", "education"], sidc: "SFG-IB---------", label: "Education Facility" },
  { keywords: ["power plant", "reactor", "generator", "energy"], sidc: "SNG-IB---------", label: "Power Plant" },

  // ── Catch-all by category ──
  { keywords: ["kinetic", "attack", "hostile", "terrorism", "terror"], sidc: "SHG-UCI--------", label: "Hostile Event" },
  { keywords: ["suspect", "unknown", "unidentified"], sidc: "SUG-UCI--------", label: "Unknown Event" },
];

/**
 * Fuzzy-match feature properties to find the best SIDC.
 * Checks Attack Type, type, category, description, notes, and title fields.
 */
export function matchSIDC(properties: Record<string, unknown>, category: string): { sidc: string; label: string } {
  // Build a search string from all relevant text fields
  const searchFields = [
    properties["Attack Type"],
    properties["attack_type"],
    properties["AttackType"],
    properties["Attack Motive"],
    properties["attack_motive"],
    properties["IncidentType"],
    properties["incident_type"],
    properties["type"],
    properties["Type"],
    properties["category"],
    properties["Category"],
    properties["Description"],
    properties["description"],
    properties["Notes"],
    properties["notes"],
    properties["IncidentName"],
    properties["Name"],
    properties["name"],
    properties["title"],
  ].filter(Boolean).map(String).join(" ").toLowerCase();

  // Check rules in order — first keyword match wins
  for (const rule of SIDC_RULES) {
    for (const keyword of rule.keywords) {
      if (searchFields.includes(keyword.toLowerCase())) {
        return { sidc: rule.sidc, label: rule.label };
      }
    }
  }

  // Fallback by S2 layer category — using verified SIDCs
  const categoryDefaults: Record<string, { sidc: string; label: string }> = {
    kinetic: { sidc: "SHG-UCI--------", label: "Hostile Event" },
    fire: { sidc: "WAS-WSFGSO-----", label: "Fire" },
    earthquake: { sidc: "WAS-WSF-LVP----", label: "Earthquake" },
    infrastructure: { sidc: "SNG-IB---------", label: "Installation" },
    weather: { sidc: "WAS-WST-FCF----", label: "Weather" },
  };

  return categoryDefaults[category] ?? { sidc: "SUGPE-----", label: "Unknown" };
}

/**
 * Generate a MIL-STD-2525 symbol as a data URL (PNG).
 */
export async function getSymbolDataUrl(sidc: string, size = 32): Promise<string> {
  const cacheKey = `${sidc}-${size}`;
  if (symbolCache.has(cacheKey)) return symbolCache.get(cacheKey)!;

  const milsymbol = await loadMilSymbol();

  try {
    const symbol = new milsymbol.Symbol(sidc, { size });
    const canvas = symbol.asCanvas();
    const dataUrl = canvas.toDataURL("image/png");
    symbolCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch {
    return "";
  }
}

/**
 * Pre-generate symbols for a batch of features.
 * Returns a Map of feature index → data URL for efficient billboard assignment.
 */
export async function preloadSymbolsForFeatures(
  features: { properties: Record<string, unknown>; layerCategory: string }[],
  size = 28
): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  // Deduplicate SIDCs to minimize canvas renders
  const sidcToIndices = new Map<string, number[]>();

  for (let i = 0; i < features.length; i++) {
    const { sidc } = matchSIDC(features[i].properties, features[i].layerCategory);
    const existing = sidcToIndices.get(sidc) ?? [];
    existing.push(i);
    sidcToIndices.set(sidc, existing);
  }

  for (const [sidc, indices] of sidcToIndices) {
    const url = await getSymbolDataUrl(sidc, size);
    if (url) {
      for (const idx of indices) results.set(idx, url);
    }
  }

  return results;
}
