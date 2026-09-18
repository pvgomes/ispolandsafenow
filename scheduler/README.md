# Scheduler (design only — nothing here is deployed)

This directory is a placeholder for the future scheduled classification
job. Nothing in it runs today; there is no Cron Trigger, no second Worker,
and no deployment. It exists so the intended design is written down before
it's built.

## Intended design (future phase)

1. A Cloudflare Cron Trigger (declared in this project's own
   `wrangler.jsonc` `triggers` block, or a dedicated one if the job ever
   needs isolation from the web Worker) fires on a schedule.
2. It collects recent news relevant to Poland's regional security
   situation from public sources.
3. It calls a `ClassificationService` implementation backed by
   `@typesafe-ai/sdk` (see `src/domain/classification-service.ts` for the
   interface every implementation — demo or real — must satisfy) with that
   evidence.
4. It writes:
   - a row to `job_runs` (start/finish/status/summary),
   - a row to `region_classifications` per region, referencing that
     `job_runs.id`, and
   - one row per source article to `classification_evidence`, referencing
     the classification.
5. It updates `regions.current_status`, `regions.last_classified_at`, and
   `regions.status_expires_at` from the latest classification.

## Why this isn't built yet

This phase's scope is the site foundation and demo-data vertical slice
only. Building the pipeline now would mean calling a real AI service and
collecting real news before the surrounding product (map, homepage, API)
even exists to display it. The `ClassificationService` interface and the
D1 schema (`region_classifications`, `classification_evidence`,
`job_runs`) are already shaped for this, specifically so implementing it
later doesn't require schema or interface changes — only a new class and a
cron trigger.
