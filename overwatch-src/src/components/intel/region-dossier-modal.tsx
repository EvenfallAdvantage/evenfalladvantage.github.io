"use client";

/**
 * Region dossier modal — shown when the user right-clicks a point on the
 * tactical map. Fetches /intel-region-dossier for the clicked coordinates
 * and renders a country brief (Nominatim reverse-geocode + RestCountries
 * facts + Wikipedia summary + Wikidata head of state).
 *
 * Attribution required: Nominatim, RestCountries, Wikipedia, Wikidata.
 */

import { useEffect, useState } from "react";
import { X, Loader2, ExternalLink } from "lucide-react";
import { fetchIntelRegionDossier } from "@/lib/intel-client";
import type { IntelRegionDossierResponse } from "@/lib/intel-types";

interface RegionDossierModalProps {
  lat: number;
  lng: number;
  onClose: () => void;
}

export function RegionDossierModal({ lat, lng, onClose }: RegionDossierModalProps) {
  // Initial state is "busy=true, no data, no error" so the effect doesn't
  // need to set these synchronously on mount (React Compiler purity rule).
  const [busy, setBusy] = useState(true);
  const [data, setData] = useState<IntelRegionDossierResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchIntelRegionDossier(lat, lng)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setData(null);
        setError(e instanceof Error ? e.message : "Failed to fetch dossier");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl shadow-2xl"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--brand-primary, #0f1a2e) 97%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--brand-accent, #d59b3c) 30%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 sticky top-0 z-10"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 97%, transparent)" }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Region Dossier</span>
            <span className="text-[10px] text-white/40 font-mono">
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white" title="Close (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-3 text-[12px] text-white/80 font-mono space-y-3">
          {busy && (
            <div className="flex items-center gap-2 text-white/50 py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Fetching dossier…
            </div>
          )}

          {error && (
            <div className="text-red-300 text-[11px]">{error}</div>
          )}

          {data && (
            <>
              {data.location?.display_name && (
                <div className="text-white/60 text-[11px]">
                  {data.location.display_name}
                </div>
              )}

              {data.country && (
                <div className="space-y-1 border-t border-white/10 pt-2">
                  <div className="flex items-center gap-2">
                    {data.country.flag && (
                      <span className="text-xl">{data.country.flag}</span>
                    )}
                    <span className="text-white font-bold">
                      {data.country.name}
                    </span>
                    <span className="text-white/40 text-[10px]">
                      ({data.country.official_name})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                    {data.country.capital && (
                      <div>
                        <span className="text-white/40">Capital:</span>{" "}
                        {data.country.capital}
                      </div>
                    )}
                    {data.country.population > 0 && (
                      <div>
                        <span className="text-white/40">Population:</span>{" "}
                        {data.country.population.toLocaleString()}
                      </div>
                    )}
                    {data.country.area > 0 && (
                      <div>
                        <span className="text-white/40">Area:</span>{" "}
                        {data.country.area.toLocaleString()} km²
                      </div>
                    )}
                    {data.country.region && (
                      <div>
                        <span className="text-white/40">Region:</span>{" "}
                        {data.country.region}
                        {data.country.subregion ? ` / ${data.country.subregion}` : ""}
                      </div>
                    )}
                    {data.country.languages.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-white/40">Languages:</span>{" "}
                        {data.country.languages.join(", ")}
                      </div>
                    )}
                    {data.country.currencies.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-white/40">Currencies:</span>{" "}
                        {data.country.currencies.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {data.head_of_state && (
                <div className="border-t border-white/10 pt-2">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider">
                    Head of State
                  </div>
                  <div className="text-white">
                    {data.head_of_state.name}
                    {data.head_of_state.position && (
                      <span className="text-white/60">
                        {" "}— {data.head_of_state.position}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {data.wikipedia && (
                <div className="border-t border-white/10 pt-2">
                  <div className="flex items-baseline justify-between">
                    <div className="text-white/40 text-[10px] uppercase tracking-wider">
                      {data.wikipedia.title ?? "Wikipedia"}
                    </div>
                    {data.wikipedia.title && (
                      <a
                        href={`https://en.wikipedia.org/wiki/${encodeURIComponent(data.wikipedia.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-300 hover:text-sky-200 inline-flex items-center gap-1 text-[10px]"
                      >
                        Open <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  {data.wikipedia.extract && (
                    <p className="text-white/80 leading-relaxed mt-1 whitespace-pre-wrap">
                      {data.wikipedia.extract}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-white/10 pt-2 text-[9px] text-white/30">
                Sources: Nominatim · RestCountries · Wikipedia · Wikidata
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
