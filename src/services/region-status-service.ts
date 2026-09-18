import { applyClassifications } from "../domain/apply-classifications";
import { DemoClassificationService } from "../domain/demo-classification-service";
import type { RegionIdentity, RegionWithStatus } from "../domain/region";
import { REGIONS } from "../data/regions";

/**
 * Application-level service that combines region identity data with a
 * `ClassificationService` implementation. This phase always uses
 * `DemoClassificationService`; swapping in a real TypeSafe AI-backed
 * implementation later only requires changing the class instantiated here.
 */
export class RegionStatusService {
  private readonly classificationService = new DemoClassificationService();

  async getRegionsWithStatus(regions: readonly RegionIdentity[] = REGIONS): Promise<RegionWithStatus[]> {
    const asOf = new Date().toISOString();
    const classifications = await this.classificationService.classifyRegions({ regions, asOf });
    return applyClassifications(regions, classifications);
  }
}
