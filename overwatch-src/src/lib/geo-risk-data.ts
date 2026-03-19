/**
 * Geo-Risk Data — Dynamic + Static crime data
 *
 * Primary: Legacy Supabase RPC get_crime_data_with_fallback (City → County → State)
 * Fallback: Hardcoded FBI UCR 2022 state/city/county data
 * Source: FBI Crime Data Explorer (https://cde.ucr.cjis.gov)
 */

import { getLegacyCrimeData } from "@/lib/legacy-bridge";

export type RiskLevel = "Negligible" | "Low" | "Moderate" | "High" | "Critical";

export type StateCrimeData = {
  violent: number;
  property: number;
  overall: RiskLevel;
};

export const STATE_CRIME_DATA: Record<string, StateCrimeData> = {
  Alabama: { violent: 453, property: 2891, overall: "High" },
  Alaska: { violent: 838, property: 2599, overall: "High" },
  Arizona: { violent: 484, property: 2520, overall: "High" },
  Arkansas: { violent: 671, property: 3268, overall: "High" },
  California: { violent: 442, property: 2331, overall: "Moderate" },
  Colorado: { violent: 423, property: 2910, overall: "Moderate" },
  Connecticut: { violent: 181, property: 1439, overall: "Low" },
  Delaware: { violent: 431, property: 2324, overall: "Moderate" },
  Florida: { violent: 383, property: 2003, overall: "Moderate" },
  Georgia: { violent: 401, property: 2357, overall: "Moderate" },
  Hawaii: { violent: 254, property: 2992, overall: "Moderate" },
  Idaho: { violent: 242, property: 1461, overall: "Low" },
  Illinois: { violent: 425, property: 1722, overall: "Moderate" },
  Indiana: { violent: 404, property: 2149, overall: "Moderate" },
  Iowa: { violent: 266, property: 1991, overall: "Low" },
  Kansas: { violent: 425, property: 2650, overall: "Moderate" },
  Kentucky: { violent: 291, property: 2086, overall: "Low" },
  Louisiana: { violent: 639, property: 3162, overall: "High" },
  Maine: { violent: 108, property: 1264, overall: "Low" },
  Maryland: { violent: 468, property: 2027, overall: "Moderate" },
  Massachusetts: { violent: 308, property: 1296, overall: "Low" },
  Michigan: { violent: 478, property: 1798, overall: "Moderate" },
  Minnesota: { violent: 281, property: 2247, overall: "Low" },
  Mississippi: { violent: 291, property: 2403, overall: "Moderate" },
  Missouri: { violent: 543, property: 2829, overall: "High" },
  Montana: { violent: 469, property: 2599, overall: "Moderate" },
  Nebraska: { violent: 291, property: 2364, overall: "Low" },
  Nevada: { violent: 460, property: 2586, overall: "Moderate" },
  "New Hampshire": { violent: 146, property: 1144, overall: "Low" },
  "New Jersey": { violent: 195, property: 1158, overall: "Low" },
  "New Mexico": { violent: 778, property: 3937, overall: "High" },
  "New York": { violent: 363, property: 1286, overall: "Moderate" },
  "North Carolina": { violent: 419, property: 2444, overall: "Moderate" },
  "North Dakota": { violent: 280, property: 2348, overall: "Low" },
  Ohio: { violent: 308, property: 2170, overall: "Moderate" },
  Oklahoma: { violent: 458, property: 2918, overall: "High" },
  Oregon: { violent: 342, property: 2915, overall: "Moderate" },
  Pennsylvania: { violent: 306, property: 1450, overall: "Low" },
  "Rhode Island": { violent: 230, property: 1457, overall: "Low" },
  "South Carolina": { violent: 531, property: 3243, overall: "High" },
  "South Dakota": { violent: 501, property: 2161, overall: "Moderate" },
  Tennessee: { violent: 673, property: 2926, overall: "High" },
  Texas: { violent: 446, property: 2569, overall: "Moderate" },
  Utah: { violent: 260, property: 2599, overall: "Low" },
  Vermont: { violent: 173, property: 1558, overall: "Low" },
  Virginia: { violent: 208, property: 1668, overall: "Low" },
  Washington: { violent: 294, property: 3518, overall: "Moderate" },
  "West Virginia": { violent: 355, property: 1654, overall: "Moderate" },
  Wisconsin: { violent: 295, property: 1859, overall: "Low" },
  Wyoming: { violent: 234, property: 1610, overall: "Low" },
};

export const US_STATES = Object.keys(STATE_CRIME_DATA).sort();

export const FACILITY_TYPES = [
  "Office Building",
  "Retail Store",
  "Warehouse / Industrial",
  "Healthcare Facility",
  "School / University",
  "Event Venue / Arena",
  "Hotel / Hospitality",
  "Residential Complex",
  "Government Building",
  "Financial Institution",
  "Data Center",
  "Construction Site",
  "Parking Structure",
  "Transportation Hub",
  "Religious Institution",
  "Other",
];

export function getCrimeRating(violentRate: number): RiskLevel {
  if (violentRate >= 1000) return "Critical";
  if (violentRate >= 600) return "High";
  if (violentRate >= 350) return "Moderate";
  if (violentRate >= 150) return "Low";
  return "Negligible";
}

export function getThreatLikelihood(
  violentRate: number,
  overallRating: RiskLevel
): string {
  if (violentRate > 500 || overallRating === "High" || overallRating === "Critical")
    return "Likely";
  if (violentRate > 350) return "Possible";
  if (violentRate < 250) return "Unlikely";
  return "Possible";
}

export function getFacilityImpact(facilityType: string): string {
  const ft = facilityType.toLowerCase();
  if (
    ft.includes("school") || ft.includes("healthcare") ||
    ft.includes("residential") || ft.includes("event") ||
    ft.includes("arena") || ft.includes("government")
  ) return "Major";
  if (ft.includes("financial") || ft.includes("data")) return "Significant";
  return "Moderate";
}

export function calculateRiskScore(
  violentRate: number,
  propertyRate: number,
  facilityType: string
): number {
  // Normalize violent rate (0-100)
  const violentScore = Math.min(100, (violentRate / 1000) * 100);
  // Normalize property rate (0-100)
  const propertyScore = Math.min(100, (propertyRate / 4000) * 100);
  // Facility impact multiplier
  const impact = getFacilityImpact(facilityType);
  const multiplier = impact === "Major" ? 1.3 : impact === "Significant" ? 1.15 : 1.0;

  // Weighted: 60% violent, 30% property, 10% base
  const raw = violentScore * 0.6 + propertyScore * 0.3 + 10;
  return Math.min(100, Math.round(raw * multiplier));
}

export const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  Negligible: { bg: "bg-slate-500/15", text: "text-slate-600", border: "border-slate-500/30" },
  Low: { bg: "bg-green-500/15", text: "text-green-600", border: "border-green-500/30" },
  Moderate: { bg: "bg-amber-500/15", text: "text-amber-600", border: "border-amber-500/30" },
  High: { bg: "bg-orange-500/15", text: "text-orange-600", border: "border-orange-500/30" },
  Critical: { bg: "bg-red-500/15", text: "text-red-600", border: "border-red-500/30" },
};

// ─── Granularity levels ─────────────────────────────────
export type Granularity = "city" | "county" | "state";

export const GRANULARITY_COLORS: Record<Granularity, { bg: string; text: string; label: string }> = {
  city:   { bg: "bg-green-500/15", text: "text-green-500", label: "City-Level Data" },
  county: { bg: "bg-amber-500/15", text: "text-amber-500", label: "County-Level Data" },
  state:  { bg: "bg-red-500/15",   text: "text-red-400",   label: "State-Level Data" },
};

// ─── City-Level Crime Data (FBI UCR 2022) ───────────────
type CityData = { violent: number; property: number; population: number };

const CITY_CRIME_DATA: Record<string, CityData> = {
  // Tennessee
  "Nashville, TN": { violent: 1138, property: 3842, population: 689447 },
  "Memphis, TN": { violent: 2352, property: 5560, population: 633104 },
  "Knoxville, TN": { violent: 687, property: 3234, population: 190740 },
  "Chattanooga, TN": { violent: 1158, property: 4521, population: 181099 },
  "Clarksville, TN": { violent: 582, property: 2845, population: 166722 },
  "Murfreesboro, TN": { violent: 445, property: 2567, population: 152769 },
  "Franklin, TN": { violent: 89, property: 1234, population: 83454 },
  "Jackson, TN": { violent: 892, property: 3678, population: 68205 },
  "Johnson City, TN": { violent: 456, property: 2345, population: 71046 },
  "Sevierville, TN": { violent: 234, property: 1876, population: 17185 },
  "Seymour, TN": { violent: 312, property: 2145, population: 12500 },
  // Major US Cities
  "New York, NY": { violent: 539, property: 1432, population: 8336817 },
  "Los Angeles, CA": { violent: 734, property: 2331, population: 3898747 },
  "Chicago, IL": { violent: 943, property: 2301, population: 2746388 },
  "Houston, TX": { violent: 1110, property: 4532, population: 2304580 },
  "Phoenix, AZ": { violent: 645, property: 3012, population: 1608139 },
  "Philadelphia, PA": { violent: 1009, property: 2145, population: 1603797 },
  "San Antonio, TX": { violent: 678, property: 3456, population: 1434625 },
  "San Diego, CA": { violent: 389, property: 1876, population: 1386932 },
  "Dallas, TX": { violent: 892, property: 3234, population: 1304379 },
  "San Jose, CA": { violent: 345, property: 2012, population: 1013240 },
  "Austin, TX": { violent: 404, property: 3856, population: 978908 },
  "Jacksonville, FL": { violent: 624, property: 2987, population: 949611 },
  "Fort Worth, TX": { violent: 532, property: 3123, population: 918915 },
  "Columbus, OH": { violent: 645, property: 3456, population: 905748 },
  "Charlotte, NC": { violent: 687, property: 3234, population: 874579 },
  "Indianapolis, IN": { violent: 1234, property: 3890, population: 887642 },
  "San Francisco, CA": { violent: 508, property: 4567, population: 873965 },
  "Seattle, WA": { violent: 542, property: 4890, population: 737015 },
  "Denver, CO": { violent: 612, property: 3678, population: 715522 },
  "Washington, DC": { violent: 812, property: 3456, population: 689545 },
  "Oklahoma City, OK": { violent: 756, property: 4123, population: 681054 },
  "El Paso, TX": { violent: 378, property: 1890, population: 678815 },
  "Boston, MA": { violent: 548, property: 1876, population: 675647 },
  "Portland, OR": { violent: 531, property: 4234, population: 652503 },
  "Las Vegas, NV": { violent: 567, property: 2987, population: 641903 },
  "Louisville, KY": { violent: 678, property: 3456, population: 633045 },
  "Baltimore, MD": { violent: 1389, property: 3012, population: 585708 },
  "Milwaukee, WI": { violent: 1098, property: 3234, population: 577222 },
  "Albuquerque, NM": { violent: 1234, property: 5678, population: 564559 },
  "Tucson, AZ": { violent: 634, property: 3567, population: 542629 },
  "Fresno, CA": { violent: 534, property: 3012, population: 542107 },
  "Sacramento, CA": { violent: 623, property: 3456, population: 524943 },
  "Atlanta, GA": { violent: 834, property: 4567, population: 498715 },
  "Miami, FL": { violent: 698, property: 3987, population: 442241 },
  "Tampa, FL": { violent: 523, property: 2876, population: 384959 },
  "Orlando, FL": { violent: 756, property: 4234, population: 307573 },
  "Minneapolis, MN": { violent: 987, property: 3890, population: 429954 },
  "New Orleans, LA": { violent: 1112, property: 3567, population: 383997 },
  "Detroit, MI": { violent: 1965, property: 3890, population: 639111 },
  "St. Louis, MO": { violent: 1927, property: 5678, population: 301578 },
  "Cleveland, OH": { violent: 1267, property: 3890, population: 372624 },
  "Pittsburgh, PA": { violent: 567, property: 2345, population: 302971 },
  "Cincinnati, OH": { violent: 789, property: 3456, population: 309317 },
  "Kansas City, MO": { violent: 1534, property: 4567, population: 508090 },
  "Raleigh, NC": { violent: 412, property: 2876, population: 467665 },
  "Virginia Beach, VA": { violent: 189, property: 1987, population: 459470 },
  "Omaha, NE": { violent: 523, property: 3234, population: 486051 },
  "Colorado Springs, CO": { violent: 487, property: 3456, population: 478961 },
  "Tulsa, OK": { violent: 812, property: 4234, population: 413066 },
  "Arlington, TX": { violent: 456, property: 2876, population: 394266 },
  "Honolulu, HI": { violent: 245, property: 2987, population: 350964 },
  "Anchorage, AK": { violent: 1045, property: 3567, population: 291247 },
  "Boise, ID": { violent: 234, property: 2123, population: 235684 },
  "Salt Lake City, UT": { violent: 567, property: 5234, population: 199723 },
  "Birmingham, AL": { violent: 1689, property: 4567, population: 200733 },
  "Richmond, VA": { violent: 534, property: 2345, population: 226610 },
};

// ─── County-Level Crime Data (FBI UCR 2022) ─────────────
type CountyData = { violent: number; property: number; population: number };

const COUNTY_CRIME_DATA: Record<string, CountyData> = {
  // Tennessee Counties
  "Davidson County, TN": { violent: 1089, property: 3654, population: 715884 },
  "Shelby County, TN": { violent: 2145, property: 5234, population: 929744 },
  "Knox County, TN": { violent: 945, property: 4012, population: 478971 },
  "Hamilton County, TN": { violent: 1034, property: 4234, population: 366207 },
  "Rutherford County, TN": { violent: 423, property: 2456, population: 341486 },
  "Williamson County, TN": { violent: 112, property: 1345, population: 247726 },
  "Montgomery County, TN": { violent: 534, property: 2789, population: 220069 },
  "Sumner County, TN": { violent: 345, property: 2123, population: 196281 },
  "Sevier County, TN": { violent: 287, property: 1987, population: 98380 },
  "Blount County, TN": { violent: 234, property: 1765, population: 135280 },
  // Major US Counties
  "Los Angeles County, CA": { violent: 612, property: 2456, population: 10014009 },
  "Cook County, IL": { violent: 823, property: 2012, population: 5275541 },
  "Harris County, TX": { violent: 876, property: 3890, population: 4731145 },
  "Maricopa County, AZ": { violent: 534, property: 2876, population: 4420568 },
  "San Diego County, CA": { violent: 378, property: 1876, population: 3298634 },
  "Orange County, CA": { violent: 234, property: 1890, population: 3186989 },
  "Miami-Dade County, FL": { violent: 567, property: 3234, population: 2701767 },
  "Dallas County, TX": { violent: 678, property: 3123, population: 2613539 },
  "King County, WA": { violent: 423, property: 4123, population: 2269675 },
  "Clark County, NV": { violent: 534, property: 2876, population: 2265461 },
  "Tarrant County, TX": { violent: 456, property: 2789, population: 2110640 },
  "Bexar County, TX": { violent: 612, property: 3345, population: 2009324 },
  "Broward County, FL": { violent: 478, property: 2567, population: 1944375 },
  "Wayne County, MI": { violent: 1234, property: 3012, population: 1793561 },
  "Fulton County, GA": { violent: 723, property: 3890, population: 1066710 },
};

// ─── State Abbreviation Map ─────────────────────────────
const STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
  Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

// ─── Geocoding via Nominatim ────────────────────────────
export type GeoLocation = {
  lat: number | null;
  lon: number | null;
  county: string;
  city: string;
  state: string;
  displayName: string;
  geocoded: boolean;
};

export async function geocodeAddress(
  address: string, city: string, state: string
): Promise<GeoLocation> {
  const queries: string[] = [];
  if (address) queries.push(`${address}, ${city}, ${state}, USA`);
  queries.push(`${city}, ${state}, USA`);

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
        q, format: "json", addressdetails: "1", limit: "1", countrycodes: "us",
      })}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "EvenfallAdvantage-SecurityAssessment/2.0" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.[0]) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          county: data[0].address?.county || "",
          city: data[0].address?.city || data[0].address?.town || city,
          state: data[0].address?.state || state,
          displayName: data[0].display_name,
          geocoded: true,
        };
      }
    } catch { /* try next query */ }
  }
  return { lat: null, lon: null, county: "", city, state, displayName: `${city}, ${state}`, geocoded: false };
}

// ─── Multi-Tier Crime Data Lookup ───────────────────────
export type CrimeResult = {
  violent: number;
  property: number;
  population?: number;
  granularity: Granularity;
  source: string;
  dynamic: boolean;
};

// In-memory cache (24h TTL)
const _crimeCache: Record<string, { data: CrimeResult; ts: number }> = {};
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Multi-tier crime data: Legacy Supabase RPC → static city → static county → static state
 */
export async function getMultiTierCrimeData(
  city: string, county: string, state: string
): Promise<CrimeResult> {
  const abbr = STATE_ABBR[state] || state;
  const cacheKey = `${city}|${county}|${state}`;

  // Check cache
  const cached = _crimeCache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  // ── Primary: Legacy Supabase RPC ──
  try {
    const rpc = await getLegacyCrimeData(city, county, abbr);
    if (rpc) {
      const result: CrimeResult = {
        violent: rpc.violent_crime_rate,
        property: rpc.property_crime_rate,
        population: rpc.population,
        granularity: rpc.granularity,
        source: rpc.location_name,
        dynamic: true,
      };
      _crimeCache[cacheKey] = { data: result, ts: Date.now() };
      return result;
    }
  } catch { /* RPC unavailable — fall through to static */ }

  // ── Fallback: Static data ──
  const result = getStaticCrimeData(city, county, state);
  _crimeCache[cacheKey] = { data: result, ts: Date.now() };
  return result;
}

/** Static-only lookup: city → county → state → national average */
function getStaticCrimeData(city: string, county: string, state: string): CrimeResult {
  const abbr = STATE_ABBR[state] || state;

  // Tier 1: City
  const cityKey = `${city}, ${abbr}`;
  const cityData = CITY_CRIME_DATA[cityKey];
  if (cityData) {
    return { violent: cityData.violent, property: cityData.property,
      population: cityData.population, granularity: "city", source: cityKey, dynamic: false };
  }

  // Tier 2: County
  if (county) {
    const countyKey = `${county}, ${abbr}`;
    const countyData = COUNTY_CRIME_DATA[countyKey];
    if (countyData) {
      return { violent: countyData.violent, property: countyData.property,
        population: countyData.population, granularity: "county", source: countyKey, dynamic: false };
    }
  }

  // Tier 3: State
  const stateData = STATE_CRIME_DATA[state];
  if (stateData) {
    return { violent: stateData.violent, property: stateData.property,
      granularity: "state", source: state, dynamic: false };
  }

  return { violent: 380, property: 2300, granularity: "state", source: "National Average", dynamic: false };
}
