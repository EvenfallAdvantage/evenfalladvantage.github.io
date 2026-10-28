"use client";

import type { Ref } from "react";
import { Info } from "lucide-react";
import { DATA_SOURCES_URL, MAP_DISCLAIMER } from "@/lib/legal/links";
import { OPENFREEMAP_URL, OSM_COPYRIGHT_URL } from "@/lib/map/osm-buildings";

export interface MapLegalFooterProps {
  /** Container Cesium renders data credits into (anchored bottom-left). */
  creditRef: Ref<HTMLDivElement>;
  onOpenSources: () => void;
  /** OSM 3D buildings are on: show their required attribution. */
  osmBuildings?: boolean;
  /** Hybrid place-name labels (OpenFreeMap / OpenMapTiles vector tiles). */
  placeLabels?: boolean;
  /** CC BY 4.0 3D aircraft/ship models are on screen: show their credit. */
  models?: boolean;
  /** Live AIS ships layer is on: credit its sources (Digitraffic is CC BY 4.0). */
  ais?: boolean;
  /** Live TomTom traffic flow or DOT/511 road incidents layer is on. */
  traffic?: boolean;
}

/**
 * Clean, collision-free bottom attribution layout:
 * - Bottom-left (left-0 bottom-0): dedicated container for Cesium native logo & Data attribution.
 * - Bottom-right (bottom-1 right-2, max-w-[calc(100vw-180px)]): compact pill with concise
 *   navigation/emergency notice, active layer short credits, and unified "ⓘ Sources & Licences" modal trigger.
 */
export function MapLegalFooter({
  creditRef,
  onOpenSources,
  osmBuildings,
  placeLabels,
  models,
  ais,
  traffic,
}: MapLegalFooterProps) {
  return (
    <>
      {/* Native Cesium credit container stays cleanly at bottom-left, never overlapped */}
      <div
        ref={creditRef}
        data-testid="cesium-credit-slot"
        className="map-credit-container pointer-events-auto absolute bottom-0 left-0 z-[5]"
      />

      {/* Compact right-aligned attribution pill */}
      <div
        data-testid="map-legal-footer"
        className="absolute bottom-1 right-2 z-[5] max-w-[calc(100vw-180px)] flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-0.5 text-[9px] leading-tight text-white/75 backdrop-blur-sm pointer-events-none overflow-hidden"
        style={{ backgroundColor: "rgba(7, 12, 22, 0.72)" }}
      >
        <span className="truncate" title={MAP_DISCLAIMER}>
          Not for navigation/911
        </span>

        <span aria-hidden="true" className="text-white/30 shrink-0">·</span>

        {(osmBuildings || placeLabels) && (
          <>
            <span
              className="pointer-events-auto shrink-0 whitespace-nowrap"
              title="3D buildings & place names: © OpenMapTiles · © OpenStreetMap contributors · OpenFreeMap"
              data-testid="osm-buildings-attribution"
            >
              <a
                href={OSM_COPYRIGHT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                © OSM
              </a>
              <span className="hidden sm:inline">
                {" · "}
                <a
                  href="https://openmaptiles.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  © OpenMapTiles
                </a>
              </span>
              <a
                href={OPENFREEMAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline underline hover:text-white ml-1"
              >
                · OpenFreeMap
              </a>
            </span>
            <span aria-hidden="true" className="text-white/30 shrink-0">·</span>
          </>
        )}

        {traffic && (
          <>
            <a
              href={`${DATA_SOURCES_URL}#roads-traffic`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="traffic-attribution"
              className="pointer-events-auto shrink-0 whitespace-nowrap underline hover:text-white"
              title="Live traffic flow & road incidents: © TomTom · State DOT & 511"
            >
              © TomTom
            </a>
            <span aria-hidden="true" className="text-white/30 shrink-0">·</span>
          </>
        )}

        {ais && (
          <>
            <a
              href={`${DATA_SOURCES_URL}#ais`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="ais-attribution"
              className="pointer-events-auto shrink-0 whitespace-nowrap underline hover:text-white"
              title="Live ship positions: aisstream.io and Fintraffic Digitraffic (CC BY 4.0)"
            >
              AIS: aisstream.io / Fintraffic
            </a>
            <span aria-hidden="true" className="text-white/30 shrink-0">·</span>
          </>
        )}

        {models && (
          <>
            <a
              href={`${DATA_SOURCES_URL}#models`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="models-attribution"
              className="pointer-events-auto shrink-0 whitespace-nowrap underline hover:text-white"
              title="3D aircraft and ship models by their creators on Sketchfab, CC BY 4.0, modified (see credits)"
            >
              3D: CC BY 4.0
            </a>
            <span aria-hidden="true" className="text-white/30 shrink-0">·</span>
          </>
        )}

        <button
          type="button"
          onClick={onOpenSources}
          data-testid="map-sources-button"
          className="pointer-events-auto inline-flex items-center gap-0.5 text-amber-400/90 hover:text-amber-300 shrink-0 font-medium whitespace-nowrap"
          title="View full data sources, attribution, and licences"
        >
          <Info className="h-2.5 w-2.5" /> Sources &amp; Licences
        </button>
      </div>
    </>
  );
}
