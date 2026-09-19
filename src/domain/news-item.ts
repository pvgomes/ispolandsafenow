/** A curated headline, as stored in the `news_items` table. */
export interface NewsItem {
  readonly url: string;
  /** Headline as published, in its original language. */
  readonly title: string;
  /**
   * English rendering of `title` (see `headline-translator.ts`). `null`
   * until translated; equal to `title` when it was already English.
   */
  readonly titleEn: string | null;
  readonly sourceName: string | null;
  /** ISO 8601 UTC timestamp. */
  readonly publishedAt: string;
}

/** The headline to show visitors: English when available, original otherwise. */
export function displayTitle(item: Pick<NewsItem, "title" | "titleEn">): string {
  return item.titleEn ?? item.title;
}

/** The original headline, only when it differs from what is displayed (for a tooltip). */
export function originalTitleIfTranslated(item: Pick<NewsItem, "title" | "titleEn">): string | null {
  return item.titleEn !== null && item.titleEn !== item.title ? item.title : null;
}
