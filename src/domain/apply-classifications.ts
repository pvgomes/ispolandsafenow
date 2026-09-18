import type { RegionClassification } from "./classification-service";
import type { RegionIdentity, RegionWithStatus } from "./region";

/**
 * Combines region identity data with classification results into the
 * shape shown on the map, region pages, and API. Works with any
 * `ClassificationService` implementation unchanged.
 *
 * A region with no matching classification resolves to UNKNOWN — missing
 * data must never resolve to GREEN.
 */
export function applyClassifications(
  regions: readonly RegionIdentity[],
  classifications: readonly RegionClassification[],
): RegionWithStatus[] {
  const byCode = new Map(classifications.map((c) => [c.regionCode, c]));
  return regions.map((region) => {
    const classification = byCode.get(region.code);
    if (!classification) {
      return {
        ...region,
        currentStatus: "UNKNOWN",
        lastClassifiedAt: null,
        statusExpiresAt: null,
      };
    }
    return {
      ...region,
      currentStatus: classification.status,
      lastClassifiedAt: classification.classifiedAt,
      statusExpiresAt: classification.expiresAt,
    };
  });
}
