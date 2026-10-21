/** Client-side Field Manual search (small corpus: titles, file names, text bodies). */
export interface KBSearchDoc {
  id: string;
  title: string;
  content?: string | null;
  file_name?: string | null;
  folder_name?: string | null;
}

export interface KBHit<T> { doc: T; score: number; snippet: string | null }

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

/** Every query word must appear somewhere; title matches rank highest. */
export function searchKB<T extends KBSearchDoc>(docs: T[], query: string, limit = 30): KBHit<T>[] {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  const hits: KBHit<T>[] = [];
  for (const doc of docs) {
    const title = norm(doc.title ?? ""), body = norm(doc.content ?? ""), meta = norm(`${doc.file_name ?? ""} ${doc.folder_name ?? ""}`);
    let score = 0, ok = true;
    for (const w of words) {
      const s = (title.includes(w) ? 10 : 0) + (meta.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0);
      if (!s) { ok = false; break; }
      score += s + (title.startsWith(w) ? 2 : 0);
    }
    if (!ok) continue;
    hits.push({ doc, score, snippet: snippetFor(doc.content ?? "", words[0]) });
  }
  return hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title)).slice(0, limit);
}

export function snippetFor(content: string, word: string, radius = 60): string | null {
  if (!content) return null;
  const i = norm(content).indexOf(word);
  if (i < 0) return null;
  const start = Math.max(0, i - radius), end = Math.min(content.length, i + word.length + radius);
  return `${start > 0 ? "…" : ""}${content.slice(start, end).replace(/\s+/g, " ").trim()}${end < content.length ? "…" : ""}`;
}
