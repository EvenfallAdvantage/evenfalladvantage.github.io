"use client";

import type { Ref } from "react";
import { Info } from "lucide-react";
import { DATA_SOURCES_URL, MAP_DISCLAIMER } from "@/lib/legal/links";
import { OPENFREEMAP_URL, OSM_COPYRIGHT_URL } from "@/lib/map/osm-buildings";

interface MapLegalFooterProps {
  /** Container Cesium renders data credits into. */
  creditRef: Ref<HTMLDivElement>;
  onOpenSources: () => void;
  /** OSM 3D buildings are on: show their required attribution (never truncated). */
  osmBuildings?: boolean;
  /** CC BY 4.0 3D aircraft models are on screen: show their credit. */
  models?: boolean;
}

/** Persistent bottom strip: emergency-use disclaimer, sources link and provider credits. */
export function MapLegalFooter({ creditRef, onOpenSources, osmBuildings, models }: MapLegalFooterProps) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[5] flex items-center gap-2 px-2 py-0.5 text-[9px] leading-tight text-white/60 pointer-events-none"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
    >
      <span className="truncate" title={MAP_DISCLAIMER}>{MAP_DISCLAIMER}</span>
      <button
        type="button"
        onClick={onOpenSources}
        className="pointer-events-auto inline-flex items-center gap-0.5 text-amber-400/90 hover:text-amber-300 shrink-0"
        title="Data sources and attribution"
      >
        <Info className="h-2.5 w-2.5" /> Sources
      </button>
      <a
        href={DATA_SOURCES_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto underline hover:text-white shrink-0 hidden sm:inline"
      >
        Licences
      </a>
      <div ref={creditRef} className="map-credit-container pointer-events-auto ml-auto min-w-0 truncate text-right" />
      {models && (
        <a href={`${DATA_SOURCES_URL}#models`} target="_blank" rel="noopener noreferrer" data-testid="models-attribution"
          className="pointer-events-auto shrink-0 whitespace-nowrap underline hover:text-white"
          title="3D aircraft models by their creators on Sketchfab, CC BY 4.0, modified (see credits)">
          3D models: CC BY 4.0 · modified · credits
        </a>
      )}
      {osmBuildings && (
        <span className="pointer-events-auto shrink-0 whitespace-nowrap"
          title="Required attribution for the 3D buildings layer (kept at the right edge, clear of the map toolbars)" data-testid="osm-buildings-attribution">
          3D buildings:{" "}
          <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">© OpenMapTiles</a>{" "}
          <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">© OpenStreetMap contributors</a>
          <a href={OPENFREEMAP_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:inline underline hover:text-white ml-1">OpenFreeMap</a>
        </span>
      )}
    </div>
  );
}
