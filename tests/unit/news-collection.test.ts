import { describe, expect, it } from "vitest";
import { buildQueryUrl, curateNewsItems, NEWS_QUERIES, parseRssItems } from "../../src/domain/news-collection";
import type { NewsItem } from "../../src/domain/news-item";

const NOW = new Date("2026-09-19T12:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

function item(overrides: Partial<NewsItem> & { url: string }): NewsItem {
  return { title: "Rosja atakuje Ukrainę, Polska podnosi myśliwce", titleEn: null, sourceName: "X", publishedAt: daysAgo(1), ...overrides };
}

describe("parseRssItems", () => {
  it("parses Google News items, decodes entities, and strips the ' - Source' title suffix", () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item>
        <title>&quot;Polska przestanie istnieć&quot;. Odpowiedź na groźbę Rosji - Wiadomości Onet</title>
        <link>https://news.google.com/rss/articles/abc</link>
        <pubDate>Fri, 18 Sep 2026 04:39:00 GMT</pubDate>
        <source url="https://wiadomosci.onet.pl">Wiadomości Onet</source>
      </item>
      <item>
        <title>No date, dropped</title>
        <link>https://example.com/nodate</link>
      </item>
    </channel></rss>`;

    const items = parseRssItems(xml);
    expect(items).toEqual([
      {
        title: '"Polska przestanie istnieć". Odpowiedź na groźbę Rosji',
        titleEn: null,
        url: "https://news.google.com/rss/articles/abc",
        sourceName: "Wiadomości Onet",
        publishedAt: "2026-09-18T04:39:00.000Z",
      },
    ]);
  });

  it("leaves a title alone when the suffix does not match the source", () => {
    const xml = `<rss><channel><item>
      <title>Rosja - Ukraina: rozmowy pokojowe</title>
      <link>https://x.pl/1</link>
      <pubDate>Fri, 18 Sep 2026 04:39:00 GMT</pubDate>
      <source url="https://x.pl">X</source>
    </item></channel></rss>`;
    expect(parseRssItems(xml)[0]?.title).toBe("Rosja - Ukraina: rozmowy pokojowe");
  });
});

describe("buildQueryUrl", () => {
  it("adds Google News' when:Nd recency operator and locale parameters", () => {
    const url = buildQueryUrl(NEWS_QUERIES[0]!, 8);
    expect(url).toContain("https://news.google.com/rss/search?q=");
    expect(url).toContain(encodeURIComponent("when:8d"));
    expect(url).toContain("&hl=pl&gl=PL&ceid=PL:pl");
  });
});

describe("curateNewsItems", () => {
  it("dedupes by URL, drops irrelevant and too-old items, and sorts newest first", () => {
    const items: NewsItem[] = [
      item({ url: "https://a.pl", publishedAt: daysAgo(2) }),
      item({ url: "https://a.pl", publishedAt: daysAgo(2), title: "duplicate" }),
      item({ url: "https://b.pl", publishedAt: daysAgo(0.5) }),
      item({ url: "https://c.pl", publishedAt: daysAgo(9) }),
      item({ url: "https://d.pl", publishedAt: daysAgo(1), title: "Polska wygrywa mecz z Ukrainą" }),
    ];

    const curated = curateNewsItems(items, NOW, 8);
    expect(curated.map((i) => i.url)).toEqual(["https://b.pl", "https://a.pl"]);
  });

  it("returns an empty list for empty input", () => {
    expect(curateNewsItems([], NOW, 8)).toEqual([]);
  });
});
