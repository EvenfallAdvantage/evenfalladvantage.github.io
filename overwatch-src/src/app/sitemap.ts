import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const BASE = "https://evenfalladvantage.github.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPages = [
    { url: `${BASE}/`, changeFrequency: "weekly" as const, priority: 1.0 },
    { url: `${BASE}/login`, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${BASE}/register`, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${BASE}/join`, changeFrequency: "monthly" as const, priority: 0.6 },
    { url: `${BASE}/courses`, changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${BASE}/state-laws`, changeFrequency: "monthly" as const, priority: 0.7 },
  ];

  return publicPages.map((page) => ({
    ...page,
    lastModified: new Date(),
  }));
}
