"use client";

/**
 * WATCH tab: live broadcaster streams (moved here from the map layer list in
 * the grouped layers panel). Opening one uses the same LiveFeedViewer modal.
 */

import { useEffect, useState } from "react";
import { Tv, ExternalLink } from "lucide-react";
import { fetchIntelLiveNews } from "@/lib/intel-client";
import type { IntelLiveNewsFeed } from "@/lib/intel-types";
import { logger } from "@/lib/logger";

export function WatchTab({ onOpenLiveFeed }: { onOpenLiveFeed?: (feed: IntelLiveNewsFeed) => void }) {
  const [feeds, setFeeds] = useState<IntelLiveNewsFeed[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchIntelLiveNews()
      .then((r) => { if (!cancelled) setFeeds(r.feeds ?? []); })
      .catch((e) => { logger.swallow("intel:watch-tab", e, "warn"); if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <p className="text-[11px] font-mono text-white/50">Live streams are unavailable right now.</p>;
  if (!feeds) return <p className="text-[11px] font-mono text-white/40">Loading live streams…</p>;

  const byCategory = new Map<string, IntelLiveNewsFeed[]>();
  for (const f of feeds) byCategory.set(f.category, [...(byCategory.get(f.category) ?? []), f]);

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-mono text-white/40">Public live news streams from the broadcasters&apos; own players.</p>
      {[...byCategory.entries()].map(([cat, list]) => (
        <div key={cat}>
          <p className="text-[9px] font-mono uppercase tracking-wider text-white/30 mb-1">{cat}</p>
          <div className="space-y-1">
            {list.map((f) => (
              <button
                key={f.id}
                onClick={() => onOpenLiveFeed?.(f)}
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-white/80 bg-white/[0.03] hover:bg-white/10"
              >
                <Tv className="h-3.5 w-3.5 text-white/40 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{f.name}</span>
                  <span className="block text-[9px] font-mono text-white/35 truncate">{f.city}, {f.country} · {f.language}</span>
                </span>
                {!f.embed_allowed && <ExternalLink className="h-3 w-3 text-white/30" aria-label="Opens on the broadcaster's site" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
