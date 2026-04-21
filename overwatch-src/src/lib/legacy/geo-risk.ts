import { getLegacyClient } from "./client";
import type { LegacyCrimeData } from "./types";

/** Call legacy RPC get_crime_data_with_fallback for dynamic crime data */
export async function getLegacyCrimeData(
  city: string, county: string, stateCode: string, dataYear = 2022
): Promise<LegacyCrimeData | null> {
  const client = getLegacyClient();
  try {
    const { data, error } = await client.rpc("get_crime_data_with_fallback", {
      p_city: city,
      p_county: county,
      p_state_code: stateCode,
      p_data_year: dataYear,
    });
    if (error) {
      console.error("Legacy: getCrimeData RPC error:", error);
      return null;
    }
    if (data && data.length > 0) return data[0] as LegacyCrimeData;
    return null;
  } catch (e) {
    console.error("Legacy: getCrimeData fetch error:", e);
    return null;
  }
}
