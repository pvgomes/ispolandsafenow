# Methodology

This is the repository-level counterpart to the in-app
[`/methodology`](src/pages/methodology.astro) page shown to visitors. It
goes into more implementation detail; the in-app page is the
visitor-facing summary.

## Status levels

```ts
type AlertLevel = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
```

- **GREEN** — no elevated regional signal found.
- **YELLOW** — elevated situation requiring attention.
- **RED** — serious active warning or confirmed incident.
- **UNKNOWN** — missing, stale, conflicting, or insufficient information.

**Invariant enforced in code, not just convention:** missing or invalid
data always resolves to `UNKNOWN`, never `GREEN`. See
`src/domain/alert-level.ts` (`toAlertLevel`), `src/domain/region.ts`
(`resolveEffectiveStatus`, which also expires stale classifications back to
`UNKNOWN`), and `src/domain/apply-classifications.ts` (a region with no
classification at all resolves to `UNKNOWN`). All three are covered by
tests in `tests/unit/`.

## Current phase: live, news-grounded classification

Every status shown on the site comes from `TypeSafeAiClassificationService`
(`src/domain/typesafe-ai-classification-service.ts`). On each request it:

1. Calls `collectRecentNews` (`src/domain/news-collection.ts`), which
   queries Google News RSS across a fixed set of Polish- and
   English-language topics (Belarus border activity, Kaliningrad, drone
   and airspace incidents, RCB warnings, the Russia-Ukraine war) and
   returns recent, deduplicated headlines — mostly Polish portals, plus
   some international outlets, covering roughly the last 48 hours.
2. Sends those headlines to TypeSafe AI's System One API
   (`POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`) as
   the prompt's evidence, asking one "choice" question per region
   (GREEN / YELLOW / RED / UNKNOWN). The model is instructed to answer
   UNKNOWN, not guess, when a region has no relevant headline.
3. Attaches the same collected headlines as `evidence` on every returned
   classification.

An in-isolate cache (10 minutes) avoids re-collecting news and re-calling
TypeSafe AI on every single page load or API hit — see the constants at
the top of that file. If `TYPESAFE_AI_API_KEY` is missing, the request
fails, or the response is unusable, affected regions resolve to `UNKNOWN`
rather than a guessed value. Every API response carries `"mode": "live"`.
`tests/unit/api-*.test.ts` check this, and
`tests/unit/typesafe-ai-classification-service.test.ts` checks the
request/response handling (including the no-news, no-API-key, and
failure paths) against a mocked `fetch` — no test makes a real network
call.

This is **not** the persisted, scheduled pipeline described below:
nothing is written to `job_runs` or `classification_evidence`, and
collection happens fresh on every request rather than on a schedule.

## The classification boundary

```ts
interface ClassificationService {
  classifyRegions(input: ClassificationInput): Promise<RegionClassification[]>;
}
```

`TypeSafeAiClassificationService` is the only implementation shipped
today. `RegionStatusService` (`src/services/region-status-service.ts`) is
the only code that instantiates a `ClassificationService`; every page and
API route goes through it. A future persisted/scheduled implementation
(or a swap to a different provider) satisfies the same interface, so
adopting it is a one-class swap, not a rewrite.

## Planned pipeline (not implemented)

1. Persist collected news and classifications to `region_classifications`
   and `classification_evidence` (rather than collecting fresh, in
   memory, on every request), and update `regions.current_status` /
   `last_classified_at` / `status_expires_at`.
2. Re-run on a schedule (see `scheduler/README.md`) via a Cron Trigger,
   instead of on-demand per request.
3. Broaden news collection beyond RSS search queries (e.g. RCB's own
   feed, dedicated regional outlets) and score relevance per region
   rather than sharing one evidence list across all 16.

No code for steps 1–3 exists yet.

## Limits

This is an independent information service, not an official warning
system, and it cannot guarantee safety. In an emergency, call 112. Always
follow instructions from Polish authorities and RCB
(https://www.gov.pl/web/rcb).
