"use client";

/**
 * CCTV viewer modal — handles three feed types:
 *   - jpg     (MJPEG/JPG snapshot, auto-refresh every 5s)
 *   - hls     (HLS .m3u8 — best-effort native <video>, no hls.js dep yet)
 *   - iframe  (broadcaster embeds e.g. YouTube / EarthCam)
 *   - external_url only (no feed_url) — shows an "Open in new tab" button
 */

import { useEffect, useState } from "react";
import { X, ExternalLink, Camera } from "lucide-react";
import type { CctvCamera } from "@/lib/intel-types";

interface CctvViewerProps {
  camera: CctvCamera;
  onClose: () => void;
}

function detectStreamType(cam: CctvCamera): "jpg" | "hls" | "iframe" | "external" {
  if (cam.stream_type) return cam.stream_type;
  const url = cam.feed_url ?? cam.stream_url;
  if (!url) return "external";
  if (/\.m3u8(\?|$)/i.test(url)) return "hls";
  if (
    /youtube\.com\/embed|youtube-nocookie\.com\/embed|rtsp\.me\/embed|ipcamlive\.com\/player|click2stream\.com|windy\.com\/webcams\/\d+\/embed|earthcam\.com/i.test(
      url,
    )
  ) {
    return "iframe";
  }
  return "jpg";
}

export function CctvViewer({ camera, onClose }: CctvViewerProps) {
  const streamType = detectStreamType(camera);
  const url = camera.feed_url ?? camera.stream_url ?? camera.external_url ?? "";
  const [cacheBust, setCacheBust] = useState(0);

  // For JPG snapshots, force the image to refresh every 5 seconds via a
  // cache-busting query string.
  useEffect(() => {
    if (streamType !== "jpg") return;
    const id = setInterval(() => setCacheBust((c) => c + 1), 5_000);
    return () => clearInterval(id);
  }, [streamType]);

  const refreshedUrl =
    streamType === "jpg" && url
      ? `${url}${url.includes("?") ? "&" : "?"}_=${cacheBust}`
      : url;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--brand-primary, #0f1a2e) 97%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--brand-accent, #d59b3c) 30%, transparent)",
          maxHeight: "85vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">{camera.name}</span>
            <span className="text-[10px] text-white/40 font-mono uppercase">
              {camera.city}, {camera.country} · {camera.source}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
          {streamType === "jpg" && refreshedUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- external camera snapshot, not a Next.js asset
            <img
              src={refreshedUrl}
              alt={camera.name}
              className="max-w-full max-h-full"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          {streamType === "hls" && refreshedUrl && (
            <video
              src={refreshedUrl}
              autoPlay
              muted
              playsInline
              controls
              className="w-full aspect-video"
            />
          )}
          {streamType === "iframe" && refreshedUrl && (
            <iframe
              src={refreshedUrl}
              className="w-full aspect-video"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              title={camera.name}
            />
          )}
          {streamType === "external" && (
            <div className="text-center p-8 space-y-3">
              <p className="text-white/70 text-sm">External feed only.</p>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--brand-accent, #d59b3c) 80%, transparent)",
                    color: "var(--brand-primary, #0f1a2e)",
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in new tab
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
