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

## Current phase: live, AI-assisted classification

Every status shown on the site comes from `TypeSafeAiClassificationService`
(`src/domain/typesafe-ai-classification-service.ts`), which calls TypeSafe
AI's System One API (`POST https://api.typesafe.ai/v1/systemone`, model
`jev-latest`) once per request. It asks one "choice" question per region
(GREEN / YELLOW / RED), based on the model's own knowledge of publicly
reported developments connected to the Russia-Ukraine war, Belarus border
activity, Kaliningrad, airspace violations, drone/missile incidents, RCB
warnings, and border/airport/transport disruptions.

There is **no news-collection pipeline yet** (see "Planned pipeline"
below), so classifications are not backed by a stored, citable evidence
trail — `evidence` is always empty. If `TYPESAFE_AI_API_KEY` is missing,
the request fails, or the response is unusable, affected regions resolve
to `UNKNOWN` rather than a guessed value. Every API response carries
`"mode": "live"`. `tests/unit/api-*.test.ts` check this, and
`tests/unit/typesafe-ai-classification-service.test.ts` checks the
request/response handling (including the no-API-key and failure paths)
against a mocked `fetch` — no test makes a real network call.

## The classification boundary

```ts
interface ClassificationService {
  classifyRegions(input: ClassificationInput): Promise<RegionClassification[]>;
}
```

`TypeSafeAiClassificationService` is the only implementation shipped
today. `RegionStatusService` (`src/services/region-status-service.ts`) is
the only code that instantiates a `ClassificationService`; every page and
API route goes through it. A future news-collection-backed implementation
(or a swap to a different provider) satisfies the same interface, so
adopting it is a one-class swap, not a rewrite.

## Planned pipeline (not implemented)

1. Collect public news relevant to Poland's regional security situation
   (the Russia-Ukraine war, Belarus border activity, Kaliningrad, airspace
   violations, drone/missile incidents, RCB warnings, border/airport/
   transport disruptions).
2. Pass that evidence to TypeSafe AI alongside each region's question, so
   classifications are backed by citable sources instead of the model's
   own knowledge alone.
3. Persist results to `region_classifications` and
   `classification_evidence`, and update `regions.current_status` /
   `last_classified_at` / `status_expires_at`.
4. Re-run on a schedule (see `scheduler/README.md`), instead of once per
   request.

No code for steps 1–4 exists yet.

## Limits

This is an independent information service, not an official warning
system, and it cannot guarantee safety. In an emergency, call 112. Always
follow instructions from Polish authorities and RCB
(https://www.gov.pl/web/rcb).
