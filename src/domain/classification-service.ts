import type { AlertLevel } from "./alert-level";
import type { RegionIdentity } from "./region";

/**
 * A single piece of evidence (news article, official notice, etc.) backing
 * a region classification. Mirrors the `classification_evidence` table.
 */
export interface ClassificationEvidence {
  readonly sourceUrl: string;
  readonly sourceName: string | null;
  readonly title: string | null;
  readonly publishedAt: string | null;
  readonly excerpt: string | null;
  readonly relevanceScore: number | null;
}

/** The result of classifying one region, before it is persisted. */
export interface RegionClassification {
  readonly regionCode: string;
  readonly status: AlertLevel;
  readonly confidence: number | null;
  readonly rationale: string | null;
  readonly classifiedAt: string;
  readonly expiresAt: string | null;
  readonly evidence: readonly ClassificationEvidence[];
}

/** Input the future news-collection pipeline will hand to the classifier. */
export interface ClassificationInput {
  readonly regions: readonly RegionIdentity[];
  readonly asOf: string;
}

/**
 * Boundary between the classification pipeline and whatever produces
 * regional classifications.
 *
 * `TypeSafeAiClassificationService` (`./typesafe-ai-classification-service`)
 * is the live implementation: it collects recent news and calls TypeSafe
 * AI's System One API with that evidence. It is called by the scheduled
 * worker (`scheduler/src/index.ts`), roughly once per hour, which persists
 * the result to D1 — the main site only ever reads that persisted state
 * (`RegionRepository`), it never calls a `ClassificationService` directly.
 */
export interface ClassificationService {
  classifyRegions(input: ClassificationInput): Promise<RegionClassification[]>;
}
