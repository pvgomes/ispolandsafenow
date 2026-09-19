import type { NewsItem } from "../domain/news-item";

interface NewsRow {
  url: string;
  title: string;
  source_name: string | null;
  published_at: string;
}

function rowToItem(row: NewsRow): NewsItem {
  return { url: row.url, title: row.title, sourceName: row.source_name, publishedAt: row.published_at };
}

/**
 * Reads curated headlines from `news_items` (filled by
 * `scripts/fetch-news.ts`, see `.github/workflows/fetch-news.yml`). Used
 * by the homepage ticker and `/news`, and by the scheduler to hand the
 * classifier its evidence. `url` is unique in the table, so no
 * deduplication is needed here.
 */
export class NewsRepository {
  constructor(private readonly db: D1Database) {}

  /** Newest first, regardless of age. */
  async listLatest(limit: number): Promise<NewsItem[]> {
    const { results } = await this.db
      .prepare("SELECT url, title, source_name, published_at FROM news_items ORDER BY published_at DESC, id DESC LIMIT ?1")
      .bind(limit)
      .all<NewsRow>();
    return results.map(rowToItem);
  }

  /** Newest first, only items published at or after `sinceIso`. */
  async listPublishedSince(sinceIso: string, limit: number): Promise<NewsItem[]> {
    const { results } = await this.db
      .prepare(
        "SELECT url, title, source_name, published_at FROM news_items WHERE published_at >= ?1 " +
          "ORDER BY published_at DESC, id DESC LIMIT ?2",
      )
      .bind(sinceIso, limit)
      .all<NewsRow>();
    return results.map(rowToItem);
  }
}
