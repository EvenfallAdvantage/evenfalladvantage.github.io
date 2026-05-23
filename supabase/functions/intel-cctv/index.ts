/**
 * Intel — CCTV camera aggregator.
 *
 * **GATED PENDING LEGAL REVIEW.** This function is wired but the
 * `cctv` layer in INTEL_LAYER_FLAGS is disabled until commercial-use review
 * completes for the upstream sources. The function still returns the
 * advertised JSON shape for callers; the gating is enforced client-side by
 * the layer toggle in the UI.
 *
 * Initial sources (all free, open data — no commercial review needed in the
 * jurisdictions where Overwatch users operate; but legal still pending):
 *   - Singapore LTA traffic-images
 *   - Florida 511 (FL DOT)
 *   - Caltrans California districts
 *
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface CctvCamera {
  id: string;
  lat: number;
  lng: number;
  name: string;
  city: string;
  country: string;
  feed_url?: string;
  external_url?: string;
  source: string;
}

async function fetchSingaporeCameras(): Promise<CctvCamera[]> {
  try {
    const res = await fetch("https://api.data.gov.sg/v1/transport/traffic-images", {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{
        cameras?: Array<{
          camera_id?: string;
          location?: { latitude?: number; longitude?: number };
          image?: string;
        }>;
      }>;
    };
    const items = data.items?.[0]?.cameras ?? [];
    const cams: CctvCamera[] = [];
    for (const cam of items) {
      if (!cam.location?.latitude || !cam.location?.longitude || !cam.image) continue;
      cams.push({
        id: `sin-${cam.camera_id}`,
        lat: cam.location.latitude,
        lng: cam.location.longitude,
        name: `Camera ${cam.camera_id}`,
        city: "Singapore",
        country: "Singapore",
        feed_url: cam.image,
        source: "LTA Singapore",
      });
    }
    return cams;
  } catch (e) {
    console.warn("[intel-cctv] singapore error:", e);
    return [];
  }
}

async function fetchFloridaCameras(): Promise<CctvCamera[]> {
  try {
    const res = await fetch("https://fl511.com/api/v2/cameras", {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      latitude?: number; longitude?: number;
      description?: string; imageUrl?: string;
    }>;
    const cams: CctvCamera[] = [];
    for (const cam of data.slice(0, 800)) {
      if (!cam.latitude || !cam.longitude) continue;
      cams.push({
        id: `fl-${cams.length}`,
        lat: cam.latitude,
        lng: cam.longitude,
        name: cam.description ?? "FL-511 Camera",
        city: "Florida",
        country: "US",
        feed_url: cam.imageUrl ?? "",
        source: "FL-511",
      });
    }
    return cams;
  } catch (e) {
    console.warn("[intel-cctv] florida error:", e);
    return [];
  }
}

async function fetchCaltransCameras(): Promise<CctvCamera[]> {
  const allCams: CctvCamera[] = [];
  const districts = ["d03", "d04", "d05", "d06", "d07", "d08", "d10", "d11", "d12"];
  await Promise.allSettled(
    districts.map(async (dist) => {
      try {
        const res = await fetch(
          `https://cwwp2.dot.ca.gov/data/${dist}/cctv/cctvStatus${dist.toUpperCase()}.json`,
          { signal: AbortSignal.timeout(8_000) },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          data?: Array<{
            location?: { latitude?: string; longitude?: string; locationName?: string };
            cctv?: { imageData?: { static?: { currentImageURL?: string } } };
          }>;
        };
        for (const cam of data.data ?? []) {
          const lat = parseFloat(cam.location?.latitude ?? "");
          const lng = parseFloat(cam.location?.longitude ?? "");
          const url = cam.cctv?.imageData?.static?.currentImageURL;
          if (!lat || !lng || !url) continue;
          allCams.push({
            id: `cal-${allCams.length}`,
            lat,
            lng,
            name: cam.location?.locationName ?? "Caltrans",
            city: "California",
            country: "US",
            feed_url: url,
            source: "Caltrans",
          });
        }
      } catch (e) {
        console.warn("[intel-cctv] caltrans error:", e);
      }
    }),
  );
  return allCams;
}

const REGION_FETCHERS: Record<string, () => Promise<CctvCamera[]>> = {
  "sg": fetchSingaporeCameras,
  "us-fl": fetchFloridaCameras,
  "us-ca": fetchCaltransCameras,
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { searchParams } = new URL(req.url);
    const regionParam = searchParams.get("region");

    let regionsToFetch: string[];
    if (regionParam === "all" || !regionParam) {
      regionsToFetch = Object.keys(REGION_FETCHERS);
    } else {
      regionsToFetch = regionParam.split(",").filter((r) => r in REGION_FETCHERS);
    }

    const results = await Promise.allSettled(
      regionsToFetch.map((r) => REGION_FETCHERS[r]()),
    );

    const allCameras: CctvCamera[] = [];
    const sources: Record<string, number> = {};

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const cam of result.value) {
          allCameras.push(cam);
          sources[cam.source] = (sources[cam.source] ?? 0) + 1;
        }
      }
    }

    return new Response(
      JSON.stringify({
        cameras: allCameras,
        total: allCameras.length,
        sources,
        regions: regionsToFetch,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    console.error("[intel-cctv]", err);
    return new Response(
      JSON.stringify({
        cameras: [], total: 0, sources: {}, regions: [],
        timestamp: new Date().toISOString(),
        error: "Failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
