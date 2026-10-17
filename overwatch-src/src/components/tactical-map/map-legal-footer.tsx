"use client";

import type { Ref } from "react";
import { Info } from "lucide-react";
import { DATA_SOURCES_URL, MAP_DISCLAIMER } from "@/lib/legal/links";

interface MapLegalFooterProps {
  /** Container Cesium renders data credits into. */
  creditRef: Ref<HTMLDivElement>;
  onOpenSources: () => void;
}

/** Persistent bottom strip: emergency-use disclaimer, sources link and provider credits. */
export function MapLegalFooter({ creditRef, onOpenSources }: MapLegalFooterProps) {
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
    </div>
  );
}
