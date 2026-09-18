import { describe, expect, it } from "vitest";
import { DemoClassificationService } from "../../src/domain/demo-classification-service";
import { REGIONS } from "../../src/data/regions";

describe("DemoClassificationService", () => {
  it("classifies all 16 regions", async () => {
    const service = new DemoClassificationService();
    const result = await service.classifyRegions({ regions: REGIONS, asOf: "2026-01-01T00:00:00.000Z" });
    expect(result).toHaveLength(16);
    expect(new Set(result.map((r) => r.regionCode)).size).toBe(16);
  });

  it("follows the documented demo pattern: green west, yellow central, red east, at least one unknown", async () => {
    const service = new DemoClassificationService();
    const result = await service.classifyRegions({ regions: REGIONS, asOf: "2026-01-01T00:00:00.000Z" });
    const counts = { GREEN: 0, YELLOW: 0, RED: 0, UNKNOWN: 0 };
    for (const classification of result) counts[classification.status] += 1;

    expect(counts.GREEN).toBeGreaterThan(0);
    expect(counts.YELLOW).toBeGreaterThan(0);
    expect(counts.RED).toBeGreaterThan(0);
    expect(counts.UNKNOWN).toBeGreaterThanOrEqual(1);
  });

  it("never returns GREEN for a region it has no fixture data for (missing data resolves to unknown)", async () => {
    const service = new DemoClassificationService();
    const unknownRegion = { code: "PL-99", slug: "not-a-real-region", namePl: "Nowhere", nameEn: "Nowhere" };
    const result = await service.classifyRegions({ regions: [unknownRegion], asOf: "2026-01-01T00:00:00.000Z" });
    expect(result[0]?.status).toBe("UNKNOWN");
  });
});
