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
 * Boundary between the app and whatever produces regional classifications.
 *
 * This phase ships only `DemoClassificationService`. The production
 * implementation will call the TypeSafe AI SDK (`@typesafe-ai/sdk`, not
 * installed yet) with collected news evidence and return real
 * classifications through this same interface — no caller changes needed.
 */
export interface ClassificationService {
  classifyRegions(input: ClassificationInput): Promise<RegionClassification[]>;
}
