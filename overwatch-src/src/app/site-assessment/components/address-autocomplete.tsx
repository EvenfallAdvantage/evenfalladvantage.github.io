"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, Loader2, Navigation, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { NominatimResult } from "./assessment-types";

interface AddressAutocompleteProps {
  onSelect: (result: NominatimResult) => void;
  onClear: () => void;
  addrResolved: string | null;
  externalQuery?: string;
}

export default function AddressAutocomplete({ onSelect, onClear, addrResolved, externalQuery }: AddressAutocompleteProps) {
  const [addrQuery, setAddrQuery] = useState(externalQuery ?? "");
  const [addrSuggestions, setAddrSuggestions] = useState<NominatimResult[]>([]);
  const [showAddrSuggestions, setShowAddrSuggestions] = useState(false);
  const [addrSearching, setAddrSearching] = useState(false);
  const addrDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addrWrapperRef = useRef<HTMLDivElement>(null);

  // Sync external query changes (e.g. after selecting a suggestion in the parent)
  useEffect(() => {
    if (externalQuery !== undefined) setAddrQuery(externalQuery);
  }, [externalQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addrWrapperRef.current && !addrWrapperRef.current.contains(e.target as Node)) {
        setShowAddrSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced Nominatim search
  const searchAddress = useCallback((q: string) => {
    if (addrDebounceRef.current) clearTimeout(addrDebounceRef.current);
    if (q.length < 3) { setAddrSuggestions([]); setShowAddrSuggestions(false); return; }
    addrDebounceRef.current = setTimeout(async () => {
      setAddrSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", USA")}&format=json&addressdetails=1&limit=5&countrycodes=us`,
          { headers: { "User-Agent": "EvenfallAdvantage-SiteAssessment/1.0" } }
        );
        const results: NominatimResult[] = await res.json();
        setAddrSuggestions(results);
        setShowAddrSuggestions(results.length > 0);
      } catch { setAddrSuggestions([]); }
      setAddrSearching(false);
    }, 400);
  }, []);

  function handleSelect(s: NominatimResult) {
    setAddrQuery(s.display_name.replace(", United States", "").replace(", USA", ""));
    setShowAddrSuggestions(false);
    onSelect(s);
  }

  function handleClear() {
    setAddrQuery("");
    setAddrSuggestions([]);
    setShowAddrSuggestions(false);
    onClear();
  }

  return (
    <div className="sm:col-span-2" ref={addrWrapperRef}>
      <label className="text-xs font-semibold mb-1 block">Search Address</label>
      <div className="relative">
        <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
        <Input
          placeholder="Start typing an address, city, or ZIP..."
          value={addrQuery}
          onChange={(e) => { setAddrQuery(e.target.value); searchAddress(e.target.value); }}
          onFocus={() => addrSuggestions.length > 0 && setShowAddrSuggestions(true)}
          className="pl-8 pr-8 h-8 text-sm"
        />
        {addrQuery && (
          <button onClick={handleClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {addrSearching && <Loader2 className="h-3.5 w-3.5 text-muted-foreground absolute right-8 top-1/2 -translate-y-1/2 animate-spin" />}
      </div>

      {showAddrSuggestions && (
        <div className="absolute z-50 w-[calc(100%-2rem)] mt-1 rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
          {addrSuggestions.map((s, i) => (
            <button key={i} onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-start gap-2 border-b border-border/30 last:border-0">
              <Navigation className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
              <span className="text-xs leading-relaxed">{s.display_name.replace(", United States", "")}</span>
            </button>
          ))}
        </div>
      )}

      {addrResolved && (
        <div className="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 rounded-md px-3 py-2 mt-2">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground">Resolved:</span>
          <span className="font-medium">{addrResolved}</span>
        </div>
      )}
    </div>
  );
}
