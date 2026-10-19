"use client";

/** Photo card for a street-level photo: image, date, author, licence and a link to the provider's page. */
import { ExternalLink, X } from "lucide-react";
import { STREET_PROVIDER_LABEL, type StreetPhoto } from "@/lib/map/street-level";

export function StreetPhotoViewer({ photo, onClose }: { photo: StreetPhoto; onClose: () => void }) {
  const when = photo.takenAt ? new Date(photo.takenAt) : null;
  return (
    <div className="absolute z-30 left-1/2 -translate-x-1/2 bottom-20 w-[min(92vw,560px)] rounded-lg border border-white/15 bg-black/85 text-white shadow-2xl backdrop-blur" role="dialog" aria-label="Street-level photo" data-testid="street-photo">
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-mono">
        <span className="font-bold">{STREET_PROVIDER_LABEL[photo.provider]}</span>
        <span className="text-white/50 truncate">{when && !Number.isNaN(when.getTime()) ? when.toISOString().slice(0, 10) : "date unknown"}{photo.heading != null ? ` · facing ${Math.round(photo.heading)}°` : ""}</span>
        <button onClick={onClose} className="ml-auto text-white/60 hover:text-white" aria-label="Close street photo"><X className="h-4 w-4" /></button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- third-party provider image, shown as served */}
      <img src={photo.imageUrl} alt={`Street-level photo from ${STREET_PROVIDER_LABEL[photo.provider]}`} referrerPolicy="no-referrer" className="block w-full max-h-[52vh] object-contain bg-black" />
      <div className="flex items-center gap-2 px-3 py-2 text-[10px] text-white/60">
        <span className="truncate">© {photo.author || `${STREET_PROVIDER_LABEL[photo.provider]} contributors`} · {photo.license} · faces and plates blurred by {STREET_PROVIDER_LABEL[photo.provider]}</span>
        <a href={photo.pageUrl} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0 inline-flex items-center gap-1 text-cyan-300 hover:underline">Open <ExternalLink className="h-3 w-3" /></a>
      </div>
    </div>
  );
}
