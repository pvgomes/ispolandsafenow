import type { AlertLevel } from "../domain/alert-level";
import type { RegionClassification } from "../domain/classification-service";

/**
 * DEMONSTRATION DATA ONLY.
 *
 * These are fixed, hand-authored classifications used to exercise the map,
 * homepage, and API before the real news-collection + TypeSafe AI pipeline
 * exists. They are not derived from any real report and must never be
 * presented as current security information.
 *
 * Kept in this one file, isolated from domain/repository code, so it can be
 * deleted outright once `DemoClassificationService` is replaced by a real
 * `ClassificationService` implementation.
 */

const DEMO_CLASSIFIED_AT = "2026-09-18T06:00:00.000Z";
const DEMO_EXPIRES_AT = "2026-09-19T06:00:00.000Z";

interface DemoEntry {
  readonly slug: string;
  readonly status: AlertLevel;
  readonly rationale: string;
}

// Deterministic, geography-based demo pattern: western regions green,
// central regions yellow, eastern border regions red, and one region left
// unknown to demonstrate missing/stale data handling.
const DEMO_ENTRIES: readonly DemoEntry[] = [
  { slug: "zachodniopomorskie", status: "GREEN", rationale: "Demonstration value: western region, no signal." },
  { slug: "lubuskie", status: "GREEN", rationale: "Demonstration value: western region, no signal." },
  { slug: "dolnoslaskie", status: "GREEN", rationale: "Demonstration value: western region, no signal." },
  { slug: "wielkopolskie", status: "GREEN", rationale: "Demonstration value: western region, no signal." },
  { slug: "opolskie", status: "GREEN", rationale: "Demonstration value: western region, no signal." },

  { slug: "pomorskie", status: "YELLOW", rationale: "Demonstration value: central/coastal region, elevated attention." },
  { slug: "kujawsko-pomorskie", status: "YELLOW", rationale: "Demonstration value: central region, elevated attention." },
  { slug: "lodzkie", status: "YELLOW", rationale: "Demonstration value: central region, elevated attention." },
  { slug: "slaskie", status: "YELLOW", rationale: "Demonstration value: central region, elevated attention." },
  { slug: "malopolskie", status: "YELLOW", rationale: "Demonstration value: central region, elevated attention." },
  { slug: "mazowieckie", status: "YELLOW", rationale: "Demonstration value: central region, elevated attention." },

  { slug: "swietokrzyskie", status: "UNKNOWN", rationale: "Demonstration value: insufficient information available." },

  { slug: "warminsko-mazurskie", status: "RED", rationale: "Demonstration value: eastern border region, active-incident example." },
  { slug: "podlaskie", status: "RED", rationale: "Demonstration value: eastern border region, active-incident example." },
  { slug: "lubelskie", status: "RED", rationale: "Demonstration value: eastern border region, active-incident example." },
  { slug: "podkarpackie", status: "RED", rationale: "Demonstration value: eastern border region, active-incident example." },
];

/** Demo classifications keyed by region slug. */
export const DEMO_CLASSIFICATIONS_BY_SLUG: ReadonlyMap<string, RegionClassification & { slug: string }> = new Map(
  DEMO_ENTRIES.map((entry) => [
    entry.slug,
    {
      slug: entry.slug,
      regionCode: "", // filled in by DemoClassificationService once matched to a real region code
      status: entry.status,
      confidence: null,
      rationale: entry.rationale,
      classifiedAt: DEMO_CLASSIFIED_AT,
      expiresAt: DEMO_EXPIRES_AT,
      evidence: [],
    },
  ]),
);

export const DEMO_MODE_LABEL = "demonstration" as const;
