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

## Current phase: demonstration data only

Every status shown on the site right now comes from
`src/data/demo-classifications.ts`, a fixed, hand-authored fixture — not
from any real report, sensor, or feed. The pattern is deliberately
geographic and deterministic for demo purposes:

- western regions (Zachodniopomorskie, Lubuskie, Dolnośląskie,
  Wielkopolskie, Opolskie) → GREEN,
- central regions (Pomorskie, Kujawsko-Pomorskie, Łódzkie, Śląskie,
  Małopolskie, Mazowieckie) → YELLOW,
- Świętokrzyskie → UNKNOWN (demonstrating the missing/insufficient-data
  case),
- eastern border regions (Warmińsko-Mazurskie, Podlaskie, Lubelskie,
  Podkarpackie) → RED.

This is **visual demo data only**. It is labelled as such everywhere it
appears: a banner on every page ("Demonstration data only. Live automated
classifications are not enabled yet."), and an explicit `"mode":
"demonstration"` field on every API response. `tests/unit/api-*.test.ts`
and the DOM test suite check that this labelling is present.

## The classification boundary

```ts
interface ClassificationService {
  classifyRegions(input: ClassificationInput): Promise<RegionClassification[]>;
}
```

`DemoClassificationService` (the only implementation shipped in this
phase) returns the fixture above. `RegionStatusService`
(`src/services/region-status-service.ts`) is the only code that
instantiates a `ClassificationService`; every page and API route goes
through it. A future TypeSafe AI-backed implementation satisfies the same
interface, so adopting it is a one-class swap, not a rewrite.

## Planned pipeline (not implemented)

1. Collect public news relevant to Poland's regional security situation
   (the Russia-Ukraine war, Belarus border activity, Kaliningrad, airspace
   violations, drone/missile incidents, RCB warnings, border/airport/
   transport disruptions).
2. Send that evidence to TypeSafe AI (`@typesafe-ai/sdk`, not installed)
   for region-by-region classification.
3. Persist results to `region_classifications` and
   `classification_evidence`, and update `regions.current_status` /
   `last_classified_at` / `status_expires_at`.
4. Re-run on a schedule (see `scheduler/README.md`).

No code for steps 1–4 exists yet, and no network call to any AI service
is made anywhere in this codebase.

## Limits

This is an independent information service, not an official warning
system, and it cannot guarantee safety. In an emergency, call 112. Always
follow instructions from Polish authorities and RCB
(https://www.gov.pl/web/rcb).
