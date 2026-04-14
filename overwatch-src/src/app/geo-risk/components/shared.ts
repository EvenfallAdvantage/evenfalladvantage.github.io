import type { RiskLevel, Granularity } from "@/lib/geo-risk-data";

export type RiskResult = {
  address: string;
  city: string;
  state: string;
  facilityType: string;
  violentRate: number;
  propertyRate: number;
  crimeRating: RiskLevel;
  threatLikelihood: string;
  facilityImpact: string;
  riskScore: number;
  overallRating: RiskLevel;
  granularity: Granularity;
  source: string;
  population?: number;
  dynamic: boolean;
  lat?: number;
  lon?: number;
  analysisDate: string;
};

export type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};
