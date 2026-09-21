-- Explain the colour, and stop expiring it.
--
-- 1. Each region now carries the short "why this colour" sentence and the
--    machine-readable driver behind it, written by the hourly
--    classification job, so the map panel, region page and /api/regions
--    can show a real reason instead of the generic level description.
-- 2. Statuses no longer expire: a classification stands until a later run
--    replaces it. The expiry columns are dropped so nothing can silently
--    keep reading them.

ALTER TABLE regions ADD COLUMN status_reason TEXT;
ALTER TABLE regions ADD COLUMN status_driver TEXT;

ALTER TABLE region_classifications ADD COLUMN driver TEXT;

ALTER TABLE regions DROP COLUMN status_expires_at;
ALTER TABLE region_classifications DROP COLUMN expires_at;
