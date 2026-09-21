# Methodology

This is the repository-level counterpart to the in-app
[`/methodology`](src/pages/methodology.astro) page shown to visitors. It
goes into more implementation detail; the in-app page is the
visitor-facing summary.

## Status levels

```ts
type AlertLevel = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
```

- **GREEN** — no elevated regional signal found. This is the expected,
  normal answer for most regions most of the time: it means the evidence
  was checked and nothing concerning was found, not "we don't know."
- **YELLOW** — elevated situation requiring attention, supported by
  collected evidence.
- **RED** — serious active warning or confirmed incident, supported by
  collected evidence.
- **UNKNOWN** — the pipeline itself failed or the data is stale, not a
  possible outcome of a successful classification. See below.

**Invariant enforced in code, not just convention:** missing or
untrustworthy data always resolves to `UNKNOWN`, never `GREEN`. This is
enforced at two specific boundaries rather than left to the model's
judgment:

1. **Pipeline failures**, in `TypeSafeAiClassificationService`
   (`src/domain/typesafe-ai-classification-service.ts`): no
   `TYPESAFE_AI_API_KEY` configured, the request to TypeSafe AI failing,
   a non-2xx response after retries, unparseable JSON, or no usable
   answer for any region. The model itself is only ever offered
   GREEN/YELLOW/RED as choices — `UNKNOWN` is not something it can pick.
   A failed run does **not** publish `UNKNOWN`: it raises
   `ClassificationUnavailableError`, is recorded as a `failed` job run,
   and every stored status is left untouched, so a momentary upstream
   outage can no longer blank the map.
2. **Never classified**, in `resolveEffectiveStatus`
   (`src/domain/region.ts`, applied when `RegionRepository` reads a row):
   a region with no `last_classified_at` resolves to `UNKNOWN` whatever
   colour is stored beside it. Statuses themselves do not expire — an
   assessment stands until a later run replaces it.

Also: `toAlertLevel` (`src/domain/alert-level.ts`) coerces any
unrecognized string to `UNKNOWN`, and `applyClassifications`
(`src/domain/apply-classifications.ts`) resolves a region with no
classification at all to `UNKNOWN`. All of this is covered by tests in
`tests/unit/`.

## Current phase: hourly, news-grounded classification

Every status shown on the site is read from D1 (`RegionRepository`) —
the site itself never calls TypeSafe AI. A separate scheduled Worker
(`scheduler/`, see `scheduler/README.md`) runs once per hour and:

1. Reads the last 48 hours of headlines (up to 40) from the `news_items`
   table (`NewsRepository.listPublishedSince`). That table is filled
   separately by `scripts/fetch-news.ts` in GitHub Actions
   (`.github/workflows/fetch-news.yml`, every two hours and on deploy),
   which queries Google News RSS across a fixed set of Polish- and
   English-language topics (Belarus border activity, Kaliningrad, drone
   and airspace incidents, RCB warnings, the Russia-Ukraine war) over an
   8-day window and keeps relevant, deduplicated headlines — mostly
   Polish portals, plus some international outlets. Collection runs
   outside Cloudflare because Google rejects RSS requests from Workers
   (HTTP 503).
2. Sends those headlines to TypeSafe AI's System One API
   (`POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`) as
   the prompt's evidence, asking one "choice" question per region,
   offering only GREEN / YELLOW / RED, plus a second "choice" question per
   region (`<code>:driver`) for the main driver behind that level. The
   model is instructed to default to GREEN — not invent an incident —
   when a region has no relevant headline.
3. Turns that driver into a one-sentence reason
   (`src/domain/status-reason.ts`) and matches the collected headlines to
   each region by name, colloquial name and major city
   (`src/domain/region-news-match.ts`).
4. Persists each region's classification, its driver, its evidence (the
   headlines that actually name that region, max 8), and a `job_runs`
   record of the run itself
   (`src/repositories/classification-writer.ts`), and updates that
   region's live snapshot (`regions.current_status` /
   `last_classified_at` / `status_reason` / `status_driver`).

Because the site only reads this persisted snapshot, per-visitor cost is
flat regardless of traffic — 10 users or 10,000 make the same number of
TypeSafe AI calls (roughly 24 a day). Every API response carries
`"mode": "live"`. `tests/unit/scheduler-job.test.ts` and
`tests/unit/classification-writer.test.ts` cover the write path;
`tests/unit/typesafe-ai-classification-service.test.ts` covers the
request/response handling (including the no-news, no-API-key, and
failure paths) against a mocked `fetch` — no test makes a real network
call.

## The classification boundary

```ts
interface ClassificationService {
  classifyRegions(input: ClassificationInput): Promise<RegionClassification[]>;
}
```

`TypeSafeAiClassificationService` is the only implementation shipped
today, and `scheduler/src/index.ts` is the only code that instantiates
it — the site's pages and API routes never do. A future
implementation (broader news sourcing, a different AI provider, per-region
relevance scoring) satisfies the same interface, so adopting it is a
one-class swap in the scheduler, not a rewrite of the site.

## Still limited

- News collection is a fixed set of RSS search queries plus a keyword
  relevance filter shared across all 16 regions, not scored or sourced
  per region from dedicated outlets (e.g. RCB's own feed). It depends on
  the GitHub Actions cron; if that stops, the scheduler keeps running
  with a shrinking evidence window.
- No retry/alerting beyond "the next hourly run tries again" — a
  `job_runs` row records success/failure, nothing pages anyone.
- The headlines themselves are public (homepage ticker, `/news`), but
  which ones backed a given classification (`classification_evidence`) is
  not yet exposed — not in the UI, not in `/api/regions`. It's there for
  a future region-page "sources" section or an evidence field on the API
  response.

## Limits

This is an independent information service, not an official warning
system, and it cannot guarantee safety. In an emergency, call 112. Always
follow instructions from Polish authorities and RCB
(https://www.gov.pl/web/rcb).
