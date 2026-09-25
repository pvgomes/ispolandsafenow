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

-- Why not the usual "create _new, copy, drop, rename" rebuild: D1 ignores
-- `PRAGMA foreign_keys = OFF`, and `defer_foreign_keys` does not rescue it.
-- `DROP TABLE regions` runs an implicit DELETE that orphans every
-- region_classifications row, and SQLite counts each one as a deferred
-- violation. Rows inserted into `regions_new` never pay that count back,
-- because at insert time they are not in the table the children point at,
-- and a later RENAME does not re-check. The count is still non-zero at
-- COMMIT, so D1 rolls the whole migration back ("FOREIGN KEY constraint
-- failed"), which is what blocked the 2026-09-25 deploy.
--
-- So the rebuild runs children-first instead: snapshot the three tables
-- into plain backup tables (no foreign keys), empty/drop them leaf-first so
-- no drop ever orphans a row, recreate them under their final names, and
-- restore parent-first so every reference is valid the moment it is written.

-- 1. Snapshot, rescaling statuses on the way (GREEN->CALM, YELLOW->LOW,
--    RED->ELEVATED; new names pass through; anything else is UNKNOWN).
CREATE TABLE _rescale_regions AS
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
  END AS current_status,
  last_classified_at, created_at, updated_at, status_reason, status_driver
FROM regions;

CREATE TABLE _rescale_region_classifications AS
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
  END AS status,
  confidence, rationale, source, classified_at, job_run_id, created_at, driver
FROM region_classifications;

CREATE TABLE _rescale_classification_evidence AS
SELECT
  id, classification_id, source_url, source_name, title, published_at,
  excerpt, relevance_score, created_at
FROM classification_evidence;

-- 2. Tear down leaf-first. classification_evidence keeps its schema (it has
--    no status column), so it is only emptied; its REFERENCES clause names
--    region_classifications and will resolve to the recreated table.
DELETE FROM classification_evidence;
DROP TABLE region_classifications;
DROP TABLE regions;

-- 3. Recreate with the new CHECK constraints and restore parent-first.
CREATE TABLE regions (
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

INSERT INTO regions (
  code, slug, name_pl, name_en, current_status, last_classified_at,
  created_at, updated_at, status_reason, status_driver
)
SELECT
  code, slug, name_pl, name_en, current_status, last_classified_at,
  created_at, updated_at, status_reason, status_driver
FROM _rescale_regions;

CREATE INDEX IF NOT EXISTS idx_regions_slug ON regions (slug);

CREATE TABLE region_classifications (
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

INSERT INTO region_classifications (
  id, region_code, status, confidence, rationale, source, classified_at,
  job_run_id, created_at, driver
)
SELECT
  id, region_code, status, confidence, rationale, source, classified_at,
  job_run_id, created_at, driver
FROM _rescale_region_classifications;

CREATE INDEX IF NOT EXISTS idx_region_classifications_region_time
  ON region_classifications (region_code, classified_at DESC);

INSERT INTO classification_evidence (
  id, classification_id, source_url, source_name, title, published_at,
  excerpt, relevance_score, created_at
)
SELECT
  id, classification_id, source_url, source_name, title, published_at,
  excerpt, relevance_score, created_at
FROM _rescale_classification_evidence;

-- 4. Drop the snapshots.
DROP TABLE _rescale_classification_evidence;
DROP TABLE _rescale_region_classifications;
DROP TABLE _rescale_regions;
