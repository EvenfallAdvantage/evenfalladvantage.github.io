"use client";

/**
 * Modal that plays a broadcaster's live feed. Two modes:
 *   - iframe (broadcaster allows embed) — renders the URL in an <iframe>
 *   - external (broadcaster blocks embed) — shows an "Open in new tab" button
 *
 * Driven from the live-news layer's click handler.
 */

import { X, ExternalLink } from "lucide-react";

interface LiveFeedViewerProps {
  feed: {
    id: string;
    name: string;
    city: string;
    country: string;
    url: string;
    embed_allowed: boolean;
    category: string;
    language: string;
  };
  onClose: () => void;
}

export function LiveFeedViewer({ feed, onClose }: LiveFeedViewerProps) {
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
          <div>
            <span className="text-sm font-semibold text-white">{feed.name}</span>
            <span className="ml-2 text-[10px] text-white/40 font-mono uppercase">
              {feed.city}, {feed.country} · {feed.category} · {feed.language}
            </span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
          {feed.embed_allowed ? (
            <iframe
              src={feed.url}
              className="w-full aspect-video"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              title={feed.name}
            />
          ) : (
            <div className="text-center p-8 space-y-3">
              <p className="text-white/70 text-sm">
                {feed.name} blocks embedded playback.
              </p>
              <a
                href={feed.url}
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
                Open feed in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
