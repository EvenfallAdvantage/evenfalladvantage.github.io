/**
 * MIL-STD-2525 Military Symbol Generator
 *
 * Uses the milsymbol library to generate proper tactical symbology
 * for intelligence data on the tactical map.
 *
 * Symbol Identification Codes (SIDC) follow APP-6/MIL-STD-2525 format.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ms: any = null;

async function loadMilSymbol() {
  if (ms) return ms;
  const mod = await import("milsymbol");
  ms = mod.default ?? mod;
  return ms;
}

// Cache generated data URLs to avoid re-rendering
const symbolCache = new Map<string, string>();

/**
 * Generate a MIL-STD-2525 symbol as a data URL (PNG).
 *
 * Common SIDCs for intelligence:
 *   SHGPE-----  = Hostile Ground Equipment (kinetic/threat)
 *   EHGPE-----  = Suspect Ground Equipment
 *   SFGPE-----  = Friendly Ground Equipment
 *   SHGPEV----  = Hostile Event
 *   WHGPE-----  = Hostile Weather (natural hazard)
 *   OHGPE-----  = Hostile Unknown
 *
 * Simplified mapping for S2 categories:
 *   kinetic     → Hostile event (red diamond)
 *   fire        → Natural event (yellow/orange)
 *   earthquake  → Natural event (yellow)
 *   infrastructure → Friendly installation (blue rectangle)
 */
export async function getSymbolDataUrl(
  category: "kinetic" | "fire" | "earthquake" | "infrastructure" | "weather",
  size = 32
): Promise<string> {
  const cacheKey = `${category}-${size}`;
  if (symbolCache.has(cacheKey)) return symbolCache.get(cacheKey)!;

  const milsymbol = await loadMilSymbol();

  // SIDC codes for each category
  const sidcMap: Record<string, string> = {
    kinetic: "SHGPEV----",        // Hostile event
    fire: "SHGPEVC---",           // Hostile civil disturbance/fire
    earthquake: "WOGDGE----",     // Weather/geo: earthquake
    infrastructure: "SFGPI-----", // Friendly installation
    weather: "WOGD------",        // Weather general
  };

  const sidc = sidcMap[category] ?? "SUGPE-----"; // Unknown default

  try {
    const symbol = new milsymbol.Symbol(sidc, {
      size,
      quantity: "",
      staffComments: "",
      additionalInformation: "",
      commonIdentifier: "",
      dtg: "",
      type: "",
    });

    const canvas = symbol.asCanvas();
    const dataUrl = canvas.toDataURL("image/png");
    symbolCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch {
    // Fallback: return empty string (will use point marker instead)
    return "";
  }
}

/**
 * Pre-generate all symbols for the S2 layer categories.
 * Call once when the S2 layer is enabled to warm the cache.
 */
export async function preloadSymbols(size = 28): Promise<Map<string, string>> {
  const categories = ["kinetic", "fire", "earthquake", "infrastructure", "weather"] as const;
  const results = new Map<string, string>();
  for (const cat of categories) {
    const url = await getSymbolDataUrl(cat, size);
    if (url) results.set(cat, url);
  }
  return results;
}
