import { formatDayHeading, formatUtcTime, toUtcDay } from "./format-news-date.ts";
import { displayTitle, originalTitleIfTranslated, type NewsItem } from "./news-item.ts";

/** Page size shared by the server-rendered first page of `/news` and `/api/news`. */
export const NEWS_PAGE_SIZE = 25;
export const NEWS_PAGE_MAX_SIZE = 100;

/** One headline, pre-formatted so the client can render it without any date logic. */
export interface NewsFeedEntry {
  readonly url: string;
  readonly title: string;
  /** Original-language headline when `title` is a translation, else null. */
  readonly originalTitle: string | null;
  readonly sourceName: string | null;
  readonly publishedAt: string;
  /** UTC calendar day (YYYY-MM-DD) — the day group this entry belongs to. */
  readonly day: string;
  readonly dayHeading: string;
  readonly time: string;
}

export interface NewsFeedPage {
  readonly items: NewsFeedEntry[];
  readonly nextOffset: number;
  readonly hasMore: boolean;
}

export function toFeedEntry(item: NewsItem): NewsFeedEntry {
  return {
    url: item.url,
    title: displayTitle(item),
    originalTitle: originalTitleIfTranslated(item),
    sourceName: item.sourceName,
    publishedAt: item.publishedAt,
    day: toUtcDay(item.publishedAt),
    dayHeading: formatDayHeading(item.publishedAt),
    time: formatUtcTime(item.publishedAt),
  };
}

/**
 * Builds one page from `limit + 1` fetched items: the extra row only
 * tells us whether another page exists, so the client can stop asking.
 */
export function buildNewsFeedPage(fetched: readonly NewsItem[], offset: number, limit: number): NewsFeedPage {
  const items = fetched.slice(0, limit).map(toFeedEntry);
  return { items, nextOffset: offset + items.length, hasMore: fetched.length > limit };
}

/** Clamps a raw `?offset=`/`?limit=` query value to something sane; NaN and negatives fall back. */
export function parsePagingParam(raw: string | null, fallback: number, max: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(value, max);
}
