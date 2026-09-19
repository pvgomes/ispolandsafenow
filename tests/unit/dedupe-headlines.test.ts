import { describe, expect, it } from "vitest";
import { dedupeHeadlinesByUrl, type RecentHeadline } from "../../src/domain/dedupe-headlines";

function headline(sourceUrl: string, title = "title"): RecentHeadline {
  return { sourceUrl, title, sourceName: null };
}

describe("dedupeHeadlinesByUrl", () => {
  it("keeps only the first occurrence of each source URL", () => {
    const items = [headline("https://a.com/1"), headline("https://a.com/1"), headline("https://b.com/2")];
    const result = dedupeHeadlinesByUrl(items, 10);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.sourceUrl)).toEqual(["https://a.com/1", "https://b.com/2"]);
  });

  it("preserves input order (the caller is expected to order by recency)", () => {
    const items = [headline("https://c.com"), headline("https://a.com"), headline("https://b.com")];
    const result = dedupeHeadlinesByUrl(items, 10);
    expect(result.map((r) => r.sourceUrl)).toEqual(["https://c.com", "https://a.com", "https://b.com"]);
  });

  it("stops once the limit is reached even if more unique items remain", () => {
    const items = [headline("https://a.com"), headline("https://b.com"), headline("https://c.com")];
    const result = dedupeHeadlinesByUrl(items, 2);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.sourceUrl)).toEqual(["https://a.com", "https://b.com"]);
  });

  it("returns an empty array for no input", () => {
    expect(dedupeHeadlinesByUrl([], 5)).toEqual([]);
  });
});
