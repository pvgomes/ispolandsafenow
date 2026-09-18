import { env } from "cloudflare:workers";
import { applyClassifications } from "../domain/apply-classifications";
import { TypeSafeAiClassificationService } from "../domain/typesafe-ai-classification-service";
import type { RegionIdentity, RegionWithStatus } from "../domain/region";
import { REGIONS } from "../data/regions";

/**
 * Application-level service that combines region identity data with a
 * `ClassificationService` implementation. Uses `TypeSafeAiClassificationService`,
 * backed by the `TYPESAFE_AI_API_KEY` binding — missing regions to UNKNOWN
 * if it isn't configured.
 */
export class RegionStatusService {
  private readonly classificationService = new TypeSafeAiClassificationService(env.TYPESAFE_AI_API_KEY);

  async getRegionsWithStatus(regions: readonly RegionIdentity[] = REGIONS): Promise<RegionWithStatus[]> {
    const asOf = new Date().toISOString();
    const classifications = await this.classificationService.classifyRegions({ regions, asOf });
    return applyClassifications(regions, classifications);
  }
}
