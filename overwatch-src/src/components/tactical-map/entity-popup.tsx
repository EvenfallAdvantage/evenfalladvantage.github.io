"use client";

import React, { useState, useCallback } from "react";
import { escapeHtml, sanitizeHtml } from "@/lib/security";
import { X, ExternalLink, Loader2 } from "lucide-react";

interface EntityPopupProps {
  entity: {
    id: string;
    name: string;
    description: string;
    screenX: number;
    screenY: number;
  };
  containerWidth: number;
  onClose: () => void;
}

export function EntityPopup({ entity, containerWidth, onClose }: EntityPopupProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);

  // Intercept clicks on links with data-embed-url to open in modal
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a[data-embed-url]") as HTMLAnchorElement | null;
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      setEmbedUrl(link.getAttribute("data-embed-url"));
      setIframeLoading(true);
    }
  }, []);

  return (
    <>
      <div
        className="absolute z-20 pointer-events-auto"
        style={{
          left: Math.min(Math.max(entity.screenX - 140, 8), containerWidth - 296),
          top: Math.max(entity.screenY - 10, 8),
          transform: "translateY(-100%)",
        }}
      >
        {/* Connector line */}
        <div
          className="absolute left-1/2 bottom-0 w-px h-2"
          style={{
            backgroundColor: "var(--brand-accent, #d59b3c)",
            transform: "translateX(-50%) translateY(100%)",
          }}
        />
        {/* Popup card */}
        <div
          className="w-72 rounded-xl backdrop-blur-md shadow-xl shadow-black/40 overflow-hidden"
          style={{
            backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 95%, transparent)",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "color-mix(in srgb, var(--brand-accent, #d59b3c) 30%, transparent)",
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-1.5 right-2 text-white/30 hover:text-white text-xs z-10"
          >
            ✕
          </button>
          {/* Body */}
          <div
            className="px-3 py-2.5 text-[11px] text-white/80 font-mono leading-relaxed max-h-48 overflow-y-auto [&_strong]:text-accent [&_b]:text-accent [&_a]:text-[#dd8c33] [&_a]:underline"
            onClick={handleClick}
            dangerouslySetInnerHTML={{
              __html: entity.description
                ? sanitizeHtml(entity.description)
                : `<b>${escapeHtml(entity.name)}</b>`,
            }}
          />
        </div>
      </div>

      {/* Embedded content modal */}
      {embedUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto" onClick={() => setEmbedUrl(null)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          {/* Modal */}
          <div
            className="relative w-[90vw] max-w-3xl h-[80vh] rounded-xl overflow-hidden shadow-2xl border border-white/10"
            style={{ backgroundColor: "var(--brand-primary, #0f1a2e)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <ExternalLink className="h-3.5 w-3.5 text-[#dd8c33] shrink-0" />
                <span className="text-xs font-mono text-white/60 truncate">{embedUrl.replace(/^https?:\/\//, "").slice(0, 60)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
                >
                  Open in new tab
                </a>
                <button onClick={() => setEmbedUrl(null)} className="text-white/40 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Loading indicator */}
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center pt-10">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              </div>
            )}
            {/* iframe */}
            <iframe
              src={embedUrl}
              className="w-full h-[calc(100%-40px)] border-0"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              onLoad={() => setIframeLoading(false)}
              title="Embedded content"
            />
          </div>
        </div>
      )}
    </>
  );
}
