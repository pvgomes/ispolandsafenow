/**
 * News collection: queries Google News RSS (which aggregates real outlets —
 * mainly Polish portals, plus international coverage) for a fixed set of
 * topics about Poland's security situation, with the Russia-Ukraine war
 * and its spillover onto Poland as the main focus, and returns recent,
 * relevant, deduplicated items.
 *
 * Google blocks requests coming from Cloudflare Workers (HTTP 503), so
 * this runs from GitHub Actions via `scripts/fetch-news.ts` — not from a
 * Worker — and the result is persisted to the `news_items` table, which
 * is what the site and the scheduler read. Pure functions here have no
 * framework or Node dependencies (only `fetch`).
 */
import type { NewsItem } from "./news-item.ts";
import { isRelevantHeadline } from "./news-relevance.ts";

interface NewsQuery {
  readonly query: string;
  readonly hl: string;
  readonly gl: string;
  readonly ceid: string;
}

const PL = { hl: "pl", gl: "PL", ceid: "PL:pl" } as const;
const EN = { hl: "en", gl: "US", ceid: "US:en" } as const;

export const NEWS_QUERIES: readonly NewsQuery[] = [
  // Russia-Ukraine war, as it touches Poland
  { query: "Polska Rosja wojna", ...PL },
  { query: "Ukraina Rosja Polska granica wojna", ...PL },
  { query: "Rosja zagrożenie Polska NATO", ...PL },
  { query: "Poland Russia Ukraine war", ...EN },
  { query: "Poland Russia threat NATO eastern flank", ...EN },
  // Airspace / drones / missiles
  { query: "dron Polska granica NATO", ...PL },
  { query: "rakieta przestrzeń powietrzna Polska", ...PL },
  { query: "Poland drone airspace violation NATO", ...EN },
  // Belarus border, Kaliningrad
  { query: "Białoruś granica Polska", ...PL },
  { query: "Kaliningrad Polska granica", ...PL },
  { query: "Poland Belarus border", ...EN },
  // Official warnings / civil protection
  { query: "RCB ostrzeżenie Polska", ...PL },
  { query: "Poland Russia Ukraine border security incident", ...EN },
];

export const DEFAULT_LOOKBACK_DAYS = 8;
const MAX_ITEMS = 1000;

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

/** Google News appends " - Source Name" to every title; strip it (only) when it matches the item's <source>. */
function stripSourceSuffix(title: string, sourceName: string | null): string {
  const suffix = sourceName ? ` - ${sourceName}` : null;
  const stripped = suffix && title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
  // Google occasionally leaves a dangling separator behind (`... - - Source`).
  return stripped.replace(/\s+-\s*$/, "").trim() || title;
}

export function parseRssItems(xml: string): NewsItem[] {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const items: NewsItem[] = [];
  for (const block of itemBlocks) {
    const rawTitle = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDateRaw = extractTag(block, "pubDate");
    const parsedMs = pubDateRaw ? Date.parse(pubDateRaw) : NaN;
    if (!rawTitle || !link || Number.isNaN(parsedMs)) continue;
    const sourceName = extractTag(block, "source");
    items.push({
      title: stripSourceSuffix(rawTitle, sourceName),
      titleEn: null,
      url: link,
      sourceName,
      publishedAt: new Date(parsedMs).toISOString(),
    });
  }
  return items;
}

export function buildQueryUrl(newsQuery: NewsQuery, lookbackDays: number): string {
  // `when:Nd` is Google News' own recency operator; it makes the feed
  // return items from the last N days instead of just the freshest ~100.
  const q = `${newsQuery.query} when:${lookbackDays}d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${newsQuery.hl}&gl=${newsQuery.gl}&ceid=${newsQuery.ceid}`;
}

async function fetchQuery(newsQuery: NewsQuery, lookbackDays: number): Promise<NewsItem[]> {
  try {
    const response = await fetch(buildQueryUrl(newsQuery, lookbackDays), {
      headers: { "user-agent": "Mozilla/5.0 (compatible; IsPolandSafeNowBot/1.0)" },
    });
    if (!response.ok) return [];
    return parseRssItems(await response.text());
  } catch {
    return [];
  }
}

/**
 * Dedupes by URL, drops irrelevant and out-of-window items, and returns
 * newest first. Exposed separately from the network call so it is unit
 * testable with canned feeds.
 */
export function curateNewsItems(items: readonly NewsItem[], now: Date, lookbackDays: number): NewsItem[] {
  const cutoff = now.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
  const byUrl = new Map<string, NewsItem>();
  for (const item of items) {
    if (byUrl.has(item.url)) continue;
    if (new Date(item.publishedAt).getTime() < cutoff) continue;
    if (!isRelevantHeadline(item.title)) continue;
    byUrl.set(item.url, item);
  }
  return [...byUrl.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, MAX_ITEMS);
}

export interface CollectNewsOptions {
  readonly now?: Date;
  readonly lookbackDays?: number;
}

/** Collects, filters, and deduplicates news items across all topic queries. */
export async function collectRecentNews(options: CollectNewsOptions = {}): Promise<NewsItem[]> {
  const now = options.now ?? new Date();
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const results = await Promise.all(NEWS_QUERIES.map((q) => fetchQuery(q, lookbackDays)));
  return curateNewsItems(results.flat(), now, lookbackDays);
}
