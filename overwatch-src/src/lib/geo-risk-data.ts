/**
 * State crime data — FBI UCR (Uniform Crime Reporting) estimates.
 * Data vintage: 2022. Rates are per 100,000 population.
 * Source: FBI Crime Data Explorer (https://cde.ucr.cjis.gov)
 */

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
