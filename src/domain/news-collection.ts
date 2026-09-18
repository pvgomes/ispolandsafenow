/**
 * Lightweight, ad-hoc news collection: queries Google News RSS (which
 * aggregates real outlets — mainly Polish portals, plus some
 * international coverage) for a fixed set of topics relevant to Poland's
 * regional security situation, and returns recent, deduplicated items.
 *
 * This is not the persisted, scheduled pipeline described in
 * `scheduler/README.md` (no `job_runs`/`classification_evidence` rows are
 * written) — it runs fresh on every classification request and only
 * feeds `TypeSafeAiClassificationService`'s prompt for that one request.
 */
export interface CollectedNewsItem {
  readonly title: string;
  readonly url: string;
  readonly sourceName: string | null;
  readonly publishedAt: string | null;
}

interface NewsQuery {
  readonly query: string;
  readonly hl: string;
  readonly gl: string;
  readonly ceid: string;
}

const NEWS_QUERIES: readonly NewsQuery[] = [
  { query: "Białoruś granica Polska", hl: "pl", gl: "PL", ceid: "PL:pl" },
  { query: "Kaliningrad Polska granica", hl: "pl", gl: "PL", ceid: "PL:pl" },
  { query: "dron Polska granica NATO", hl: "pl", gl: "PL", ceid: "PL:pl" },
  { query: "RCB ostrzeżenie Polska", hl: "pl", gl: "PL", ceid: "PL:pl" },
  { query: "Ukraina Rosja Polska granica wojna", hl: "pl", gl: "PL", ceid: "PL:pl" },
  { query: "Poland Russia Ukraine border security incident", hl: "en", gl: "US", ceid: "US:en" },
  { query: "Poland drone airspace violation NATO", hl: "en", gl: "US", ceid: "US:en" },
];

const MAX_ITEMS = 25;
const LOOKBACK_MS = 48 * 60 * 60 * 1000;

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1] !== undefined ? decodeXmlEntities(match[1]) : null;
}

function parseRssItems(xml: string): CollectedNewsItem[] {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const items: CollectedNewsItem[] = [];
  for (const block of itemBlocks) {
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    if (!title || !link) continue;
    const pubDateRaw = extractTag(block, "pubDate");
    const parsedMs = pubDateRaw ? Date.parse(pubDateRaw) : NaN;
    items.push({
      title,
      url: link,
      sourceName: extractTag(block, "source"),
      publishedAt: Number.isNaN(parsedMs) ? null : new Date(parsedMs).toISOString(),
    });
  }
  return items;
}

async function fetchQuery(newsQuery: NewsQuery): Promise<CollectedNewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(newsQuery.query)}&hl=${newsQuery.hl}&gl=${newsQuery.gl}&ceid=${newsQuery.ceid}`;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; IsPolandSafeNowBot/1.0)" },
    });
    if (!response.ok) return [];
    return parseRssItems(await response.text());
  } catch {
    return [];
  }
}

/**
 * Collects and deduplicates recent news items across all topic queries.
 * Prefers items published within the last 48 hours; if none qualify
 * (e.g. every feed is stale or unreachable), falls back to the most
 * recent items available rather than returning nothing.
 */
export async function collectRecentNews(now: Date = new Date()): Promise<CollectedNewsItem[]> {
  const results = await Promise.all(NEWS_QUERIES.map(fetchQuery));

  const byUrl = new Map<string, CollectedNewsItem>();
  for (const item of results.flat()) {
    if (!byUrl.has(item.url)) byUrl.set(item.url, item);
  }

  const all = [...byUrl.values()];
  const cutoff = now.getTime() - LOOKBACK_MS;
  const recent = all.filter((item) => item.publishedAt !== null && new Date(item.publishedAt).getTime() >= cutoff);
  const pool = recent.length > 0 ? recent : all;

  return pool.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")).slice(0, MAX_ITEMS);
}
