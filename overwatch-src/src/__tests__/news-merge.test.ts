import { describe, expect, it } from "vitest";
import { mergeNews, normalizeTitle } from "@/lib/map/news-merge";
import type { IntelGdeltEvent, IntelNewsItem } from "@/lib/intel-types";

const rss = (o: Partial<IntelNewsItem>): IntelNewsItem => ({ title: "t", link: "https://x.com/a", published: "", source: "S", risk_score: 6, coords: [1, 2], coords_default: false, ...o });
const gd = (o: Partial<IntelGdeltEvent>): IntelGdeltEvent => ({ id: "g1", lat: 3, lng: 4, title: "g", source: "G", url: "https://y.com/b", type: "conflict", ...o });

describe("mergeNews", () => {
  it("drops RSS items without a real location or with low risk", () => {
    const out = mergeNews([], [rss({ coords: null }), rss({ coords_default: true, link: "https://x.com/2", title: "b" }), rss({ risk_score: 2, link: "https://x.com/3", title: "c" }), rss({ title: "ok", link: "https://x.com/4" })]);
    expect(out.map((o) => o.title)).toEqual(["ok"]);
  });
  it("de-duplicates by URL (ignoring www, trailing slash, query) and by title", () => {
    const out = mergeNews(
      [gd({ url: "https://www.x.com/a/?utm=1", title: "Different" }), gd({ id: "g2", url: "https://z.com/q", title: "Explosion reported near port!" })],
      [rss({ link: "https://x.com/a", title: "Original" }), rss({ link: "https://k.com/9", title: "explosion reported near port" })],
    );
    expect(out.map((o) => o.title)).toEqual(["Original", "explosion reported near port"]);
  });
  it("keeps GDELT-only events with a default risk", () => {
    const out = mergeNews([gd({})], []);
    expect(out).toHaveLength(1);
    expect(out[0].risk).toBe(6);
  });
  it("normalizes titles", () => {
    expect(normalizeTitle("Hello, &amp; World!!")).toBe("hello world");
  });
});
