"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Search, Loader2, ChevronDown, Navigation, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";
import { US_STATES, FACILITY_TYPES } from "@/lib/geo-risk-data";
import type { NominatimResult } from "./shared";

export type AddressData = {
  address: string;
  city: string;
  state: string;
  county: string;
  lat: number | null;
  lon: number | null;
  facilityType: string;
};

type Props = {
  data: AddressData;
  onChange: (data: AddressData) => void;
  onAnalyze: () => void;
  analyzing: boolean;
};

export function AddressSearch({ data, onChange, onAnalyze, analyzing }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced Nominatim search
  const searchAddress = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", USA")}&format=json&addressdetails=1&limit=5&countrycodes=us`,
          { headers: { "User-Agent": "EvenfallAdvantage-GeoRisk/1.0" } }
        );
        const results: NominatimResult[] = await res.json();
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch { setSuggestions([]); }
      setSearching(false);
    }, 400);
  }, []);

  function selectSuggestion(s: NominatimResult) {
    const addr = s.address;
    const streetParts = [addr.house_number, addr.road].filter(Boolean).join(" ");
    const resolvedCity = addr.city || addr.town || addr.village || addr.hamlet || "";
    const resolvedState = addr.state || "";
    const resolvedCounty = addr.county || "";

    onChange({
      ...data,
      address: streetParts,
      city: resolvedCity,
      state: resolvedState,
      county: resolvedCounty,
      lat: parseFloat(s.lat),
      lon: parseFloat(s.lon),
    });
    setQuery(s.display_name.replace(", United States", "").replace(", USA", ""));
    setResolved(`${resolvedCity}${resolvedCounty ? `, ${resolvedCounty}` : ""}, ${resolvedState}`);
    setShowSuggestions(false);
  }

  function clearSearch() {
    setQuery("");
    onChange({ address: "", city: "", state: "", county: "", lat: null, lon: null, facilityType: data.facilityType });
    setResolved(null);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  return (
    <Card className="border-border/40">
      <CardContent className="p-4 space-y-4">
        <div ref={wrapperRef} className="relative">
          <label className="text-xs font-semibold mb-1 block">Search Address</label>
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Start typing an address, city, or ZIP..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); searchAddress(e.target.value); }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="pl-8 pr-8"
            />
            {query && (
              <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {searching && <Loader2 className="h-3.5 w-3.5 text-muted-foreground absolute right-8 top-1/2 -translate-y-1/2 animate-spin" />}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && (
            <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => selectSuggestion(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-start gap-2 border-b border-border/30 last:border-0">
                  <Navigation className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                  <span className="text-xs leading-relaxed">{s.display_name.replace(", United States", "")}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Resolved location badge */}
        {resolved && (
          <div className="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground">Resolved:</span>
            <span className="font-medium">{resolved}</span>
          </div>
        )}

        {/* Manual override row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold mb-1 block">City *</label>
            <Input placeholder="Miami" value={data.city} onChange={(e) => onChange({ ...data, city: e.target.value })} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block">State *</label>
            <div className="relative">
              <select className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm appearance-none"
                value={data.state} onChange={(e) => onChange({ ...data, state: e.target.value })}>
                <option value="">Select state</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Facility Type */}
        <div>
          <label className="text-xs font-semibold mb-1 block">Facility Type</label>
          <div className="relative">
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm appearance-none"
              value={data.facilityType} onChange={(e) => onChange({ ...data, facilityType: e.target.value })}>
              <option value="">Select facility type</option>
              {FACILITY_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <Button className="w-full gap-1.5" onClick={onAnalyze} disabled={!data.city || !data.state || analyzing}>
          {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Search className="h-4 w-4" /> Analyze Risk</>}
        </Button>
      </CardContent>
    </Card>
  );
}
