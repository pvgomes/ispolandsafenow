import type { ClassificationInput, ClassificationService, RegionClassification } from "./classification-service";
import { DEMO_CLASSIFICATIONS_BY_SLUG } from "../data/demo-classifications";

/**
 * Returns the fixed demonstration fixture instead of calling any real
 * classifier. This is the only `ClassificationService` implementation in
 * this phase — no news collection or TypeSafe AI calls are made.
 *
 * The production implementation will call `@typesafe-ai/sdk` with collected
 * news evidence and satisfy this same interface, so callers (repositories,
 * API routes, pages) will not need to change.
 */
export class DemoClassificationService implements ClassificationService {
  async classifyRegions(input: ClassificationInput): Promise<RegionClassification[]> {
    return input.regions.map((region) => {
      const demo = DEMO_CLASSIFICATIONS_BY_SLUG.get(region.slug);
      if (!demo) {
        return {
          regionCode: region.code,
          status: "UNKNOWN",
          confidence: null,
          rationale: "Demonstration value: no fixture entry for this region.",
          classifiedAt: input.asOf,
          expiresAt: null,
          evidence: [],
        };
      }
      return {
        regionCode: region.code,
        status: demo.status,
        confidence: demo.confidence,
        rationale: demo.rationale,
        classifiedAt: demo.classifiedAt,
        expiresAt: demo.expiresAt,
        evidence: demo.evidence,
      };
    });
  }
}
