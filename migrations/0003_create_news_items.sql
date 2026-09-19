-- Curated headlines about Poland's security situation (the Russia-Ukraine
-- war and its spillover, Belarus border activity, Kaliningrad, airspace
-- incidents, RCB warnings). Filled by `scripts/fetch-news.ts` (run from
-- GitHub Actions, see .github/workflows/fetch-news.yml), which backfills
-- the last several days on first run and then keeps appending. Read by
-- the site (homepage ticker, /news) and by the scheduler as
-- classification evidence. `url` is unique so re-running the fetch is
-- idempotent (INSERT OR IGNORE).
CREATE TABLE IF NOT EXISTS news_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_name TEXT,
  published_at TEXT NOT NULL,            -- ISO 8601 UTC timestamp
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_news_items_published_at ON news_items (published_at DESC);
