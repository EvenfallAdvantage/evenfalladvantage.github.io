"use client";

import { useMemo, useState } from "react";
import { Search, Pin, X, Loader2, WifiOff } from "lucide-react";
import { getAllKBDocuments } from "@/lib/supabase/db";
import { cachedRead, isOffline } from "@/lib/offline/cached-read";
import { searchKB } from "@/lib/kb/search";
import type { PinnedDoc } from "@/lib/kb/pins";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

/** Field Manual search box + "Pinned for offline" list. */
export function KBSearchAndPins({ companyId, onOpen, pins }: { companyId: string; onOpen: (d: Doc) => void; pins: PinnedDoc[] }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState<Doc[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  // Load the whole (small) corpus once, on the first keystroke.
  function onQuery(v: string) {
    setQ(v);
    if (!v.trim() || all || loadingAll) return;
    setLoadingAll(true);
    cachedRead(`kb-all:${companyId}`, () => getAllKBDocuments(companyId))
      .then((d) => setAll(d ?? []))
      .catch(() => setAll([]))
      .finally(() => setLoadingAll(false));
  }

  // Offline (or not loaded yet): search pinned docs too.
  const corpus = useMemo(() => {
    const byId = new Map<string, Doc>();
    for (const p of pins) byId.set(p.id, p);
    for (const d of all ?? []) byId.set(d.id, d);
    return [...byId.values()];
  }, [all, pins]);
  const hits = useMemo(() => searchKB(corpus, q), [corpus, q]);

  return (
    <div className="space-y-3" data-testid="kb-search">
      <label className="relative block">
        <span className="sr-only">Search the Field Manual</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => onQuery(e.target.value)} placeholder="Search the Field Manual…" type="search"
          className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-10 text-base sm:text-sm" />
        {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground"><X className="h-4 w-4" /></button>}
      </label>

      {q.trim() ? (
        <div className="space-y-1.5" data-testid="kb-results">
          {loadingAll && !all ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            : hits.length === 0 ? <p className="text-sm text-muted-foreground">No documents match &ldquo;{q}&rdquo;.{isOffline() ? " Offline: only pinned documents are searchable." : ""}</p>
            : hits.map(({ doc, snippet }) => (
              <button key={doc.id} type="button" onClick={() => onOpen(doc)} className="block w-full rounded-lg border border-border/40 bg-card px-3 py-2 text-left hover:bg-accent" style={{ minHeight: 44 }}>
                <span className="block text-sm font-medium">{doc.title}</span>
                <span className="block text-xs text-muted-foreground">{doc.folder_name ?? ""}{doc.file_name ? ` · ${doc.file_name}` : ""}</span>
                {snippet && <span className="mt-0.5 block text-xs text-muted-foreground/80">{snippet}</span>}
              </button>
            ))}
        </div>
      ) : pins.length > 0 ? (
        <div className="space-y-1.5" data-testid="kb-pins">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Pin className="h-3 w-3" /> Pinned for offline ({pins.length}){isOffline() && <span className="ml-1 inline-flex items-center gap-1 text-amber-500"><WifiOff className="h-3 w-3" />offline</span>}</p>
          {pins.map((p) => (
            <button key={p.id} type="button" onClick={() => onOpen(p)} className="block w-full rounded-lg border border-border/40 bg-card px-3 py-2 text-left hover:bg-accent" style={{ minHeight: 44 }}>
              <span className="block text-sm font-medium">{p.title}</span>
              <span className="block text-xs text-muted-foreground">{p.folder_name ?? ""}{p.file_url && !p.fileCached ? " · file needs signal" : ""}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
