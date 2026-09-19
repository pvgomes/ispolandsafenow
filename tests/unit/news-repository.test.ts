import { describe, expect, it } from "vitest";
import { NewsRepository } from "../../src/repositories/news-repository";

interface EvidenceRow {
  id: number;
  source_url: string | null;
  title: string | null;
  source_name: string | null;
}

/** Minimal fake covering the one SELECT ... ORDER BY id DESC LIMIT ?1 query NewsRepository issues. */
class FakeEvidenceD1 {
  constructor(private readonly rows: EvidenceRow[]) {}

  prepare(_sql: string) {
    const rows = this.rows;
    return {
      bind(...args: unknown[]) {
        return {
          async all<T>() {
            const limit = args[0] as number;
            const results = [...rows]
              .filter((r) => r.title !== null && r.source_url !== null)
              .sort((a, b) => b.id - a.id)
              .slice(0, limit);
            return { results: results as unknown as T[] };
          },
        };
      },
    };
  }
}

describe("NewsRepository", () => {
  it("returns deduplicated recent headlines, most recent first", async () => {
    // A single run currently inserts the same evidence row once per
    // region (up to 16 identical copies of the same headline) — ids 1
    // and 3 stand in for two such copies of the same headline.
    const rows: EvidenceRow[] = [
      { id: 1, source_url: "https://a.com", title: "A", source_name: "Source A" },
      { id: 2, source_url: "https://b.com", title: "B", source_name: null },
      { id: 3, source_url: "https://a.com", title: "A", source_name: "Source A" },
    ];
    const repo = new NewsRepository(new FakeEvidenceD1(rows) as never);
    const headlines = await repo.listRecentHeadlines(8);

    expect(headlines).toHaveLength(2);
    // Most recently inserted (highest id) first, and only one copy per URL.
    expect(headlines[0]).toEqual({ sourceUrl: "https://a.com", title: "A", sourceName: "Source A" });
    expect(headlines[1]).toEqual({ sourceUrl: "https://b.com", title: "B", sourceName: null });
  });

  it("returns an empty array when there is no evidence yet", async () => {
    const repo = new NewsRepository(new FakeEvidenceD1([]) as never);
    await expect(repo.listRecentHeadlines(8)).resolves.toEqual([]);
  });

  it("respects the requested limit after deduplication", async () => {
    const rows: EvidenceRow[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      source_url: `https://example.com/${i}`,
      title: `Title ${i}`,
      source_name: null,
    }));
    const repo = new NewsRepository(new FakeEvidenceD1(rows) as never);
    const headlines = await repo.listRecentHeadlines(2);
    expect(headlines).toHaveLength(2);
  });
});
