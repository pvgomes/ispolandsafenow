import type { NewsItem } from "./news-item";
import type { RegionWithStatus } from "./region";

export type ChangeFrequency = "hourly" | "daily" | "weekly" | "monthly";

export interface SitemapEntry {
  readonly loc: string;
  /** ISO 8601 timestamp, or omitted when we have no honest signal for the page. */
  readonly lastmod?: string;
  readonly changefreq: ChangeFrequency;
  readonly priority: number;
}

export interface SitemapInput {
  readonly site: string;
  readonly regions: readonly RegionWithStatus[];
  readonly latestNews: NewsItem | null;
}

function latestIso(...values: ReadonlyArray<string | null | undefined>): string | undefined {
  const present = values.filter((v): v is string => typeof v === "string" && v.length > 0);
  if (present.length === 0) return undefined;
  return present.reduce((a, b) => (a > b ? a : b));
}

/**
 * Builds the list of indexable pages. `lastmod` only reflects real content
 * changes — the latest classification for the map/region pages, the newest
 * headline for `/news` — rather than the request time, so search engines
 * can trust it. Static pages carry no `lastmod` at all rather than a fake one.
 */
export function buildSitemapEntries({ site, regions, latestNews }: SitemapInput): SitemapEntry[] {
  const base = site.replace(/\/$/, "");
  const latestClassification = latestIso(...regions.map((r) => r.lastClassifiedAt));
  const newsAt = latestNews?.publishedAt;

  return [
    { loc: `${base}/`, lastmod: latestIso(latestClassification, newsAt), changefreq: "hourly", priority: 1.0 },
    { loc: `${base}/news`, lastmod: newsAt, changefreq: "hourly", priority: 0.8 },
    ...regions.map<SitemapEntry>((region) => ({
      loc: `${base}/regions/${region.slug}`,
      lastmod: region.lastClassifiedAt ?? undefined,
      changefreq: "hourly",
      priority: 0.7,
    })),
    { loc: `${base}/methodology`, changefreq: "monthly", priority: 0.5 },
    { loc: `${base}/about`, changefreq: "monthly", priority: 0.4 },
  ];
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function renderSitemapXml(entries: readonly SitemapEntry[]): string {
  const urls = entries.map((entry) => {
    const lines = [`    <loc>${escapeXml(entry.loc)}</loc>`];
    if (entry.lastmod) lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    lines.push(`    <changefreq>${entry.changefreq}</changefreq>`, `    <priority>${entry.priority.toFixed(1)}</priority>`);
    return `  <url>\n${lines.join("\n")}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
