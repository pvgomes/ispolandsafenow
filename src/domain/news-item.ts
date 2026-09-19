/** A curated headline, as stored in the `news_items` table. */
export interface NewsItem {
  readonly url: string;
  readonly title: string;
  readonly sourceName: string | null;
  /** ISO 8601 UTC timestamp. */
  readonly publishedAt: string;
}
