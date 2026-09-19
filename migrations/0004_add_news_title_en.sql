-- English rendering of each headline, filled by scripts/fetch-news.ts via
-- Workers AI. NULL until translated (the site falls back to `title`);
-- equals `title` when the headline was already English.
ALTER TABLE news_items ADD COLUMN title_en TEXT;

CREATE INDEX IF NOT EXISTS idx_news_items_untranslated
  ON news_items (published_at DESC)
  WHERE title_en IS NULL;
