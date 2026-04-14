"use client";

import { ExternalLink } from "lucide-react";

// Extract YouTube video ID from various URL formats
export function getYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return m?.[1] ?? null;
}

// Extract Vimeo video ID
export function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m?.[1] ?? null;
}

// Check if URL is a direct image
export function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url);
}

// Render embedded media for a URL
export function MediaEmbed({ url }: { url: string }) {
  const ytId = getYouTubeId(url);
  if (ytId) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-border/40">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  const vimeoId = getVimeoId(url);
  if (vimeoId) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-border/40">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}`}
            title="Vimeo video"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  if (isImageUrl(url)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Attachment"
        className="mt-3 max-h-[400px] w-full rounded-xl border border-border/40 object-cover"
      />
    );
  }

  // Generic link card
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex items-center gap-3 rounded-xl border border-border/40 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/60"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <ExternalLink className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{new URL(url).hostname}</p>
        <p className="truncate text-xs text-muted-foreground">{url}</p>
      </div>
    </a>
  );
}

// Auto-detect URLs in text content and render embeds
export function ContentWithEmbeds({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s<]+)/gi;
  const urls = text.match(urlRegex) ?? [];
  const uniqueUrls = [...new Set(urls)];

  return (
    <>
      <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{text}</p>
      {uniqueUrls.map((url) => (
        <MediaEmbed key={url} url={url} />
      ))}
    </>
  );
}
