-- Foundation schema for Is Poland Safe Now?
-- Designed to support the current demo-data phase plus the future automated
-- news collection + TypeSafe AI classification pipeline without changes.

CREATE TABLE IF NOT EXISTS regions (
  code TEXT PRIMARY KEY,                 -- ISO 3166-2:PL code, e.g. "PL-14"
  slug TEXT NOT NULL UNIQUE,             -- english-compatible URL slug, e.g. "mazowieckie"
  name_pl TEXT NOT NULL,                 -- Polish name, e.g. "Mazowieckie"
  name_en TEXT NOT NULL,                 -- English-compatible display name
  current_status TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (current_status IN ('GREEN', 'YELLOW', 'RED', 'UNKNOWN')),
  last_classified_at TEXT,               -- ISO 8601 UTC timestamp, NULL until classified
  status_expires_at TEXT,                -- ISO 8601 UTC timestamp, NULL until classified
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_regions_slug ON regions (slug);

-- One row per classification event, so a region's status history can be
-- reconstructed later. The current demo phase does not write to this table;
-- it exists so the future classification job can start writing immediately.
CREATE TABLE IF NOT EXISTS region_classifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_code TEXT NOT NULL REFERENCES regions (code),
  status TEXT NOT NULL CHECK (status IN ('GREEN', 'YELLOW', 'RED', 'UNKNOWN')),
  confidence REAL,                       -- 0..1, NULL when not provided by the classifier
  rationale TEXT,                        -- short AI-assisted explanation
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'demo' | 'typesafe-ai'
  classified_at TEXT NOT NULL,
  expires_at TEXT,
  job_run_id INTEGER REFERENCES job_runs (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_region_classifications_region_time
  ON region_classifications (region_code, classified_at DESC);

-- Evidence (news articles, official notices, etc.) backing a classification.
CREATE TABLE IF NOT EXISTS classification_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  classification_id INTEGER NOT NULL REFERENCES region_classifications (id),
  source_url TEXT NOT NULL,
  source_name TEXT,
  title TEXT,
  published_at TEXT,
  excerpt TEXT,
  relevance_score REAL,                  -- 0..1, NULL when not scored
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_classification_evidence_classification
  ON classification_evidence (classification_id);

-- Execution log for future scheduled jobs (news collection, classification).
CREATE TABLE IF NOT EXISTS job_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL,                -- 'news_collection' | 'classification' | ...
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  started_at TEXT,
  finished_at TEXT,
  error_message TEXT,
  summary TEXT,                          -- JSON blob with run statistics
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
