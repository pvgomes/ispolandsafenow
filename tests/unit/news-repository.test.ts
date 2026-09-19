import { describe, expect, it } from "vitest";
import { NewsRepository } from "../../src/repositories/news-repository";
import { InMemoryD1Database, type InMemoryNewsRow } from "../fakes/in-memory-d1";

const ROWS: InMemoryNewsRow[] = [
  { id: 1, url: "https://a.pl/1", title: "Older", title_en: null, source_name: "A", published_at: "2026-09-15T10:00:00.000Z" },
  { id: 2, url: "https://b.pl/2", title: "Newest", title_en: "Newest (en)", source_name: null, published_at: "2026-09-19T08:00:00.000Z" },
  { id: 3, url: "https://c.pl/3", title: "Middle", title_en: null, source_name: "C", published_at: "2026-09-17T12:00:00.000Z" },
];

describe("NewsRepository", () => {
  it("lists the latest items newest first, mapped to NewsItem", async () => {
    const repo = new NewsRepository(new InMemoryD1Database([], ROWS) as never);
    const items = await repo.listLatest(10);

    expect(items.map((i) => i.title)).toEqual(["Newest", "Middle", "Older"]);
    expect(items[0]).toEqual({
      url: "https://b.pl/2",
      title: "Newest",
      titleEn: "Newest (en)",
      sourceName: null,
      publishedAt: "2026-09-19T08:00:00.000Z",
    });
  });

  it("respects the limit", async () => {
    const repo = new NewsRepository(new InMemoryD1Database([], ROWS) as never);
    await expect(repo.listLatest(2)).resolves.toHaveLength(2);
  });

  it("filters by published_at when listing since a timestamp", async () => {
    const repo = new NewsRepository(new InMemoryD1Database([], ROWS) as never);
    const items = await repo.listPublishedSince("2026-09-17T00:00:00.000Z", 10);
    expect(items.map((i) => i.title)).toEqual(["Newest", "Middle"]);
  });

  it("returns an empty array when there is no news yet", async () => {
    const repo = new NewsRepository(new InMemoryD1Database([]) as never);
    await expect(repo.listLatest(8)).resolves.toEqual([]);
  });
});
