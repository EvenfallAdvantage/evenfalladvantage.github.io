"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type NominatimResult = {
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

export type AddressSelection = {
  displayName: string;
  street: string;
  city: string;
  state: string;
  county: string;
  postcode: string;
  lat: number;
  lon: number;
};

interface AddressAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (selection: AddressSelection) => void;
  onClear?: () => void;
  placeholder?: string;
  label?: string;
  className?: string;
  inputClassName?: string;
  countryCode?: string;
}

export default function AddressAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  onClear,
  placeholder = "e.g. 123 Main St, Los Angeles, CA",
  label,
  className,
  inputClassName,
  countryCode = "us",
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolved, setResolved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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
  const search = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const suffix = countryCode === "us" ? ", USA" : "";
          const params = new URLSearchParams({
            q: q + suffix,
            format: "json",
            addressdetails: "1",
            limit: "5",
          });
          if (countryCode) params.set("countrycodes", countryCode);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?${params}`,
            { headers: { "User-Agent": "EvenfallAdvantage-Overwatch/1.0" } }
          );
          const results: NominatimResult[] = await res.json();
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch {
          setSuggestions([]);
        }
        setSearching(false);
      }, 400);
    },
    [countryCode]
  );

  // Detect lat/lng coordinate input (e.g. "39.744885, -78.368760")
  const COORD_REGEX = /^\s*(-?\d{1,3}\.?\d*)\s*[,\s]\s*(-?\d{1,3}\.?\d*)\s*$/;

  function handleInputChange(q: string) {
    onChange(q);
    setResolved(false);

    // Check if input looks like coordinates
    const coordMatch = q.match(COORD_REGEX);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        // Reverse geocode the coordinates
        reverseGeocode(lat, lng);
        return;
      }
    }

    search(q);
  }

  async function reverseGeocode(lat: number, lng: number) {
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { "User-Agent": "EvenfallAdvantage-Overwatch/1.0" } }
      );
      const result: NominatimResult = await res.json();
      if (result?.display_name) {
        // Show as a single suggestion
        setSuggestions([result]);
        setShowSuggestions(true);
      } else {
        // No reverse geocode result — use raw coordinates
        const display = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        onChange(display);
        setResolved(true);
        setShowSuggestions(false);
        onSelect?.({
          displayName: display,
          street: "",
          city: "",
          state: "",
          county: "",
          postcode: "",
          lat,
          lon: lng,
        });
      }
    } catch {
      // Fallback: use raw coordinates
      const display = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      onChange(display);
      setResolved(true);
      onSelect?.({ displayName: display, street: "", city: "", state: "", county: "", postcode: "", lat, lon: lng });
    }
    setSearching(false);
  }

  function selectSuggestion(s: NominatimResult) {
    const addr = s.address;
    const street = [addr.house_number, addr.road].filter(Boolean).join(" ");
    const city = addr.city || addr.town || addr.village || addr.hamlet || "";
    const state = addr.state || "";
    const county = addr.county || "";
    const postcode = addr.postcode || "";
    const display = s.display_name
      .replace(", United States", "")
      .replace(", USA", "");

    onChange(display);
    setResolved(true);
    setShowSuggestions(false);
    setSuggestions([]);

    onSelect?.({
      displayName: display,
      street,
      city,
      state,
      county,
      postcode,
      lat: parseFloat(s.lat),
      lon: parseFloat(s.lon),
    });
  }

  function handleClear() {
    onChange("");
    setResolved(false);
    setSuggestions([]);
    setShowSuggestions(false);
    onClear?.();
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {label && (
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0 && !resolved) setShowSuggestions(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-16",
            resolved && "border-emerald-500/40",
            inputClassName
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {resolved && (
            <MapPin className="h-3.5 w-3.5 text-emerald-500" />
          )}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
          {suggestions.map((s, i) => {
            const display = s.display_name
              .replace(", United States", "")
              .replace(", USA", "");
            return (
              <button
                key={i}
                type="button"
                onClick={() => selectSuggestion(s)}
                className="flex items-start gap-2 w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{display}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
