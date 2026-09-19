import { dedupeHeadlinesByUrl, type RecentHeadline } from "../domain/dedupe-headlines";

interface HeadlineRow {
  source_url: string;
  title: string;
  source_name: string | null;
}

function rowToHeadline(row: HeadlineRow): RecentHeadline {
  return { sourceUrl: row.source_url, title: row.title, sourceName: row.source_name };
}

/**
 * Reads recent headlines from `classification_evidence` — the same
 * evidence the scheduler (scheduler/src/index.ts) attaches to region
 * classifications. Over-fetches raw rows and dedupes by `source_url` in
 * JS (see `dedupeHeadlinesByUrl`) rather than in SQL, since one run
 * currently inserts the same shared evidence list per region.
 */
export class NewsRepository {
  constructor(private readonly db: D1Database) {}

  async listRecentHeadlines(limit: number): Promise<RecentHeadline[]> {
    const { results } = await this.db
      .prepare(
        "SELECT source_url, title, source_name FROM classification_evidence " +
          "WHERE title IS NOT NULL AND source_url IS NOT NULL ORDER BY id DESC LIMIT ?1",
      )
      .bind(limit * 20)
      .all<HeadlineRow>();
    return dedupeHeadlinesByUrl(results.map(rowToHeadline), limit);
  }
}
