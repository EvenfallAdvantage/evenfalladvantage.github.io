/**
 * What kind of operator an aircraft is (for colour), separate from its airframe
 * class (aircraft-class.ts, which picks the 3D model).
 *
 * Signals, strongest first:
 *  1. readsb dbFlags military bit (adsb.lol database) → military
 *  2. ADS-B emergency status "lifeguard" (medical priority) → government / EMS
 *  3. Callsign prefix heuristics: known military, government/law-enforcement/EMS
 *     and cargo-airline ICAO telephony prefixes
 *  4. Airframe class from the ICAO type designator: fast jets/UAVs → military,
 *     helicopters → helicopter, light/glider/bizjet → general aviation
 *  5. ADS-B emitter category (A1–A7, B1–B4)
 *  6. Airline-style callsign (3 letters + digits) → commercial
 * Heuristics are best-effort: a callsign can't prove an operator.
 */
import { classifyAircraft } from "./aircraft-class";

export type AircraftCategory = "commercial" | "ga" | "helicopter" | "military" | "government" | "cargo" | "unknown";

export const AIRCRAFT_CATEGORIES: readonly AircraftCategory[] = ["commercial", "cargo", "ga", "helicopter", "military", "government", "unknown"];

/** Okabe–Ito based, lightened for the dark map; military matches ships (vermillion). */
export const AIRCRAFT_CATEGORY_COLOR: Record<AircraftCategory, string> = {
  commercial: "#56b4e9", // sky blue
  cargo: "#e69f00",      // orange
  ga: "#f0e442",         // yellow
  helicopter: "#cc79a7", // reddish purple
  military: "#ff5a36",   // vermillion
  government: "#2ec4a0", // bluish green
  unknown: "#b8bec8",    // grey
};
export const AIRCRAFT_CATEGORY_LABEL: Record<AircraftCategory, string> = {
  commercial: "Airliner", cargo: "Cargo", ga: "General aviation", helicopter: "Helicopter",
  military: "Military", government: "Gov / police / EMS", unknown: "Unknown",
};
/** Emergencies keep their own colour (and larger icon) over any category. */
export const AIRCRAFT_EMERGENCY_COLOR = "#ff1f4b";

const MIL_PREFIX = ["RCH", "REACH", "CNV", "SPAR", "SAM", "PAT", "RRR", "ASCOT", "TARTN", "NAVY", "ARMY", "USAF", "CFC", "GAF", "IAM", "FAF", "BAF", "HKY", "DUKE", "KING", "EVAC", "TOPCAT", "VVLX"];
const GOV_PREFIX = ["CHP", "LAPD", "LASD", "NYPD", "CBP", "OMAHA", "USCG", "COAST", "FBI", "MEDIC", "LIFE", "MERCY", "AIRMED", "CARE", "ANGEL", "NHPD", "POLICE", "SHERIFF", "TROOPER", "NPAS", "HEMS", "HELIMED", "RESCUE", "CALFIRE", "FIRE", "TANKER"];
const CARGO_PREFIX = ["FDX", "UPS", "GTI", "ABX", "ATN", "CKS", "CLX", "BOX", "CAO", "DHK", "DHX", "BCS", "KFS", "AJT", "PAC", "NCA", "MPH", "CKK", "ABW", "SOO", "WGN", "AMF", "SRR", "ADB", "TAY", "GEC", "UCA", "LCO", "CMB", "NPT", "WEN", "FFL"];

// 3-letter (ICAO telephony) prefixes must be followed by a digit, so "SAM" doesn't catch "SAMx" names; longer words match as a prefix.
const startsWithAny = (cs: string, list: readonly string[]) => list.some((p) => cs.startsWith(p) && (p.length > 3 || cs.length === p.length || /[0-9]/.test(cs[p.length])));
const airlineCallsign = (cs: string) => /^[A-Z]{3}[0-9]{1,4}[A-Z]{0,2}$/.test(cs);
const tailCallsign = (cs: string) => /^N[0-9][0-9A-Z]{0,4}$/.test(cs) || /^[A-Z]-?[A-Z]{3,4}$/.test(cs) || /^C-?[FG][A-Z]{3}$/.test(cs);

export function aircraftCategory(p: {
  callsign?: string | null; typeCode?: string | null; category?: string | number | null;
  military?: boolean | null; emergencyStatus?: string | null;
}): AircraftCategory {
  if (p.military) return "military";
  if ((p.emergencyStatus ?? "").toLowerCase() === "lifeguard") return "government";
  const cs = String(p.callsign ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const cat = typeof p.category === "string" ? p.category.trim().toUpperCase() : "";
  if (cs && startsWithAny(cs, MIL_PREFIX)) return "military";
  if (cs && startsWithAny(cs, GOV_PREFIX)) return "government";
  if (cs && startsWithAny(cs, CARGO_PREFIX)) return "cargo";
  const type = String(p.typeCode ?? "").trim();
  if (type) {
    const cls = classifyAircraft({ typeCode: type });
    if (cls === "fastjet" || cls === "uav") return "military";
    if (cls === "helicopter") return "helicopter";
    if (cls === "light" || cls === "glider" || cls === "bizjet") return airlineCallsign(cs) ? "commercial" : "ga";
  }
  if (cat === "A7") return "helicopter";
  if (cat === "A6") return "military";
  if (cat === "A1" || cat === "A2" || cat === "B1" || cat === "B4" || cat === "B6") return airlineCallsign(cs) ? "commercial" : "ga";
  if (tailCallsign(cs)) return "ga";
  if (airlineCallsign(cs)) return "commercial";
  if (type || cat === "A3" || cat === "A4" || cat === "A5") return "commercial";
  return "unknown";
}
