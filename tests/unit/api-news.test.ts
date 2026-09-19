import { describe, expect, it } from "vitest";
import { buildNewsPage } from "../../src/pages/api/news";
import { InMemoryD1Database, type InMemoryNewsRow } from "../fakes/in-memory-d1";

const NOW = new Date("2026-09-19T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();

const ROWS: InMemoryNewsRow[] = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  url: `https://n.pl/${i + 1}`,
  title: `Nagłówek ${i + 1}`,
  title_en: i % 2 === 0 ? `Headline ${i + 1}` : null,
  source_name: "N",
  published_at: hoursAgo(i * 3),
}));
// Older than the 8-day window — must never be served.
ROWS.push({ id: 99, url: "https://n.pl/old", title: "Stare", title_en: null, source_name: "N", published_at: hoursAgo(9 * 24) });

describe("GET /api/news logic", () => {
  it("serves the first page newest first with hasMore", async () => {
    const page = await buildNewsPage(new InMemoryD1Database([], ROWS) as never, new URL("https://site/api/news"), NOW);
    expect(page.items).toHaveLength(25);
    expect(page.items[0]!.url).toBe("https://n.pl/1");
    expect(page.items[0]!.title).toBe("Headline 1");
    expect(page.items[1]!.title).toBe("Nagłówek 2");
    expect(page.hasMore).toBe(true);
    expect(page.nextOffset).toBe(25);
  });

  it("serves the tail page and stops, excluding items outside the window", async () => {
    const page = await buildNewsPage(new InMemoryD1Database([], ROWS) as never, new URL("https://site/api/news?offset=25"), NOW);
    expect(page.items.map((i) => i.url)).toEqual(["https://n.pl/26", "https://n.pl/27", "https://n.pl/28", "https://n.pl/29", "https://n.pl/30"]);
    expect(page.hasMore).toBe(false);
  });

  it("honours a custom limit", async () => {
    const page = await buildNewsPage(new InMemoryD1Database([], ROWS) as never, new URL("https://site/api/news?limit=5&offset=5"), NOW);
    expect(page.items.map((i) => i.url)).toEqual(["https://n.pl/6", "https://n.pl/7", "https://n.pl/8", "https://n.pl/9", "https://n.pl/10"]);
    expect(page.nextOffset).toBe(10);
  });
});
