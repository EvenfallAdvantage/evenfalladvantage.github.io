/**
 * Merge GDELT events and RSS news into one de-duplicated, located list for
 * the single "News" layer (panel v2).
 */
import type { IntelGdeltEvent, IntelNewsItem } from "@/lib/intel-types";

export interface MergedNewsItem {
  id: string;
  lat: number;
  lng: number;
  title: string;
  source: string;
  url: string;
  published?: string;
  /** 0–10; GDELT conflict events count as 6. */
  risk: number;
}

/** RSS items need a keyword location that isn't the feed's default, and some risk. */
export const MIN_RSS_RISK = 4;

export function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/&[a-z]+;/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 10).join(" ");
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return u.trim().toLowerCase();
  }
}

export function mergeNews(gdelt: readonly IntelGdeltEvent[], rss: readonly IntelNewsItem[]): MergedNewsItem[] {
  const seen = new Set<string>();
  const out: MergedNewsItem[] = [];
  const push = (item: MergedNewsItem) => {
    const keys = [item.url ? `u:${normalizeUrl(item.url)}` : "", `t:${normalizeTitle(item.title)}`].filter(Boolean);
    if (keys.some((k) => seen.has(k))) return;
    keys.forEach((k) => seen.add(k));
    out.push(item);
  };
  // RSS first: it carries a risk score and publish time.
  for (const n of rss) {
    if (!n.coords || n.coords_default || n.risk_score < MIN_RSS_RISK) continue;
    const [lat, lng] = n.coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    push({ id: `rss:${normalizeUrl(n.link) || normalizeTitle(n.title)}`, lat, lng, title: n.title, source: n.source, url: n.link, published: n.published, risk: n.risk_score });
  }
  for (const e of gdelt) {
    if (!Number.isFinite(e.lat) || !Number.isFinite(e.lng) || !e.title) continue;
    push({ id: `gdelt:${e.id}`, lat: e.lat, lng: e.lng, title: e.title, source: e.source, url: e.url, risk: 6 });
  }
  return out;
}
