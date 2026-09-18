import { describe, expect, it } from "vitest";
import { applyClassifications } from "../../src/domain/apply-classifications";
import type { RegionClassification } from "../../src/domain/classification-service";
import type { RegionIdentity } from "../../src/domain/region";

const regions: RegionIdentity[] = [
  { code: "PL-02", slug: "dolnoslaskie", namePl: "Dolnośląskie", nameEn: "Dolnoslaskie" },
  { code: "PL-14", slug: "mazowieckie", namePl: "Mazowieckie", nameEn: "Mazowieckie" },
];

describe("applyClassifications", () => {
  it("resolves a region with no matching classification to UNKNOWN, never GREEN", () => {
    const result = applyClassifications(regions, []);
    const dolnoslaskie = result.find((r) => r.code === "PL-02");
    expect(dolnoslaskie?.currentStatus).toBe("UNKNOWN");
    expect(dolnoslaskie?.lastClassifiedAt).toBeNull();
    expect(dolnoslaskie?.statusExpiresAt).toBeNull();
  });

  it("applies a matching classification's status and timestamps", () => {
    const classifications: RegionClassification[] = [
      {
        regionCode: "PL-14",
        status: "RED",
        confidence: null,
        rationale: "test",
        classifiedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-01-02T00:00:00.000Z",
        evidence: [],
      },
    ];
    const result = applyClassifications(regions, classifications);
    const mazowieckie = result.find((r) => r.code === "PL-14");
    expect(mazowieckie?.currentStatus).toBe("RED");
    expect(mazowieckie?.lastClassifiedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(mazowieckie?.statusExpiresAt).toBe("2026-01-02T00:00:00.000Z");
  });
});
