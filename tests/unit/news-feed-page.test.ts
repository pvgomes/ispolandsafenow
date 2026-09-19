import { describe, expect, it } from "vitest";
import { buildNewsFeedPage, parsePagingParam, toFeedEntry } from "../../src/domain/news-feed-page";
import type { NewsItem } from "../../src/domain/news-item";

const item = (n: number, titleEn: string | null = null): NewsItem => ({
  url: `https://x.pl/${n}`,
  title: `Tytuł ${n}`,
  titleEn,
  sourceName: "X",
  publishedAt: `2026-09-1${n}T09:05:00.000Z`,
});

describe("toFeedEntry", () => {
  it("prefers the English title and keeps the original for the tooltip", () => {
    const entry = toFeedEntry(item(2, "Title 2"));
    expect(entry.title).toBe("Title 2");
    expect(entry.originalTitle).toBe("Tytuł 2");
    expect(entry.day).toBe("2026-09-12");
    expect(entry.time).toBe("09:05 UTC");
  });

  it("has no originalTitle when nothing was translated", () => {
    expect(toFeedEntry(item(1)).originalTitle).toBeNull();
  });
});

describe("buildNewsFeedPage", () => {
  it("returns limit items and flags hasMore from the extra fetched row", () => {
    const page = buildNewsFeedPage([item(1), item(2), item(3)], 10, 2);
    expect(page.items.map((i) => i.url)).toEqual(["https://x.pl/1", "https://x.pl/2"]);
    expect(page.nextOffset).toBe(12);
    expect(page.hasMore).toBe(true);
  });

  it("reports the end of the feed when fewer rows than limit+1 come back", () => {
    const page = buildNewsFeedPage([item(1)], 0, 25);
    expect(page.hasMore).toBe(false);
    expect(page.nextOffset).toBe(1);
  });
});

describe("parsePagingParam", () => {
  it("falls back on junk and negatives, clamps to max", () => {
    expect(parsePagingParam(null, 25, 100)).toBe(25);
    expect(parsePagingParam("abc", 25, 100)).toBe(25);
    expect(parsePagingParam("-5", 25, 100)).toBe(25);
    expect(parsePagingParam("500", 25, 100)).toBe(100);
    expect(parsePagingParam("40", 25, 100)).toBe(40);
  });
});
