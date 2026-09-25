-- Rescale the alert levels so the map stops shouting.
--
-- The old three-step scale (GREEN / YELLOW / RED) painted a large part of
-- Poland yellow or red for things that were, in practice, ordinary news:
-- an exercise, a statement, a drone that never reached the ground. The new
-- four-step scale shifts every old level one step down the alarm axis and
-- reserves red for an actual attack:
--
--   GREEN  -> CALM      (dark green) nothing notable
--   YELLOW -> LOW       (green)      minor or indirect signals
--   RED    -> ELEVATED  (yellow)     a real situation, no impact on the ground
--              CRITICAL (red)        confirmed physical impact in that region
--
-- SQLite cannot alter a CHECK constraint in place, so both tables are
-- rebuilt. Existing rows are rescaled with the mapping above, which keeps
-- the map populated across the deploy instead of blanking it to UNKNOWN.

-- D1 ignores `PRAGMA foreign_keys = OFF`, so the rebuild defers foreign-key
-- checks instead: `regions` and `region_classifications` are dropped and
-- recreated with the same primary keys, so every reference is satisfied
-- again by the end of the migration.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE regions_new (
  code TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_pl TEXT NOT NULL,
  name_en TEXT NOT NULL,
  current_status TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (current_status IN ('CALM', 'LOW', 'ELEVATED', 'CRITICAL', 'UNKNOWN')),
  last_classified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  status_reason TEXT,
  status_driver TEXT
);

INSERT INTO regions_new (
  code, slug, name_pl, name_en, current_status, last_classified_at,
  created_at, updated_at, status_reason, status_driver
)
SELECT
  code, slug, name_pl, name_en,
  CASE current_status
    WHEN 'GREEN' THEN 'CALM'
    WHEN 'YELLOW' THEN 'LOW'
    WHEN 'RED' THEN 'ELEVATED'
    WHEN 'CALM' THEN 'CALM'
    WHEN 'LOW' THEN 'LOW'
    WHEN 'ELEVATED' THEN 'ELEVATED'
    WHEN 'CRITICAL' THEN 'CRITICAL'
    ELSE 'UNKNOWN'
  END,
  last_classified_at, created_at, updated_at, status_reason, status_driver
FROM regions;

DROP TABLE regions;
ALTER TABLE regions_new RENAME TO regions;

CREATE INDEX IF NOT EXISTS idx_regions_slug ON regions (slug);

CREATE TABLE region_classifications_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_code TEXT NOT NULL REFERENCES regions (code),
  status TEXT NOT NULL
    CHECK (status IN ('CALM', 'LOW', 'ELEVATED', 'CRITICAL', 'UNKNOWN')),
  confidence REAL,
  rationale TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  classified_at TEXT NOT NULL,
  job_run_id INTEGER REFERENCES job_runs (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  driver TEXT
);

INSERT INTO region_classifications_new (
  id, region_code, status, confidence, rationale, source, classified_at,
  job_run_id, created_at, driver
)
SELECT
  id, region_code,
  CASE status
    WHEN 'GREEN' THEN 'CALM'
    WHEN 'YELLOW' THEN 'LOW'
    WHEN 'RED' THEN 'ELEVATED'
    WHEN 'CALM' THEN 'CALM'
    WHEN 'LOW' THEN 'LOW'
    WHEN 'ELEVATED' THEN 'ELEVATED'
    WHEN 'CRITICAL' THEN 'CRITICAL'
    ELSE 'UNKNOWN'
  END,
  confidence, rationale, source, classified_at, job_run_id, created_at, driver
FROM region_classifications;

DROP TABLE region_classifications;
ALTER TABLE region_classifications_new RENAME TO region_classifications;

CREATE INDEX IF NOT EXISTS idx_region_classifications_region_time
  ON region_classifications (region_code, classified_at DESC);
