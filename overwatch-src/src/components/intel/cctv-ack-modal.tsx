"use client";

import { Camera } from "lucide-react";
import { DATA_SOURCES_URL, TERMS_OVERWATCH_URL } from "@/lib/legal/links";

interface CctvAckModalProps {
  onAccept: () => void;
  onCancel: () => void;
}

/** One-time notice shown before the traffic-camera layer is first enabled. */
export function CctvAckModal({ onAccept, onCancel }: CctvAckModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cctv-ack-title"
    >
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl"
        style={{
          backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 97%, transparent)",
          border: "1px solid color-mix(in srgb, var(--brand-accent, #d59b3c) 30%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Camera className="h-4 w-4 text-emerald-400" />
          <span id="cctv-ack-title" className="text-sm font-semibold text-white">
            Public traffic cameras: before you continue
          </span>
        </div>
        <div className="px-4 py-3 space-y-2 text-xs text-white/80">
          <p>
            Camera images are provided by public transportation agencies. The images are
            third-party data, are provided as-is, and may be delayed, stale, mislabelled or offline.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Not for emergency, life-safety or navigation use. In an emergency, call 911.</li>
            <li>
              Do not use cameras to surveil, track or identify any person or vehicle. This includes
              facial or licence-plate recognition.
            </li>
            <li>
              Do not record, archive, scrape or redistribute images, and do not remove provider credits.
            </li>
            <li>Comply with applicable privacy laws and each provider&apos;s licence.</li>
          </ul>
          <p className="text-white/50">
            See{" "}
            <a href={TERMS_OVERWATCH_URL} target="_blank" rel="noopener noreferrer" className="underline text-amber-400">
              Terms §16
            </a>{" "}
            and the{" "}
            <a href={DATA_SOURCES_URL} target="_blank" rel="noopener noreferrer" className="underline text-amber-400">
              Data Sources Notice
            </a>
            .
          </p>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/10">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded-md text-white/70 hover:text-white">
            Cancel
          </button>
          <button
            onClick={onAccept}
            className="px-3 py-1.5 text-xs rounded-md font-semibold text-black"
            style={{ backgroundColor: "var(--brand-accent, #d59b3c)" }}
          >
            I understand, enable cameras
          </button>
        </div>
      </div>
    </div>
  );
}
