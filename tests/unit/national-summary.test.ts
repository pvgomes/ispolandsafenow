import { describe, expect, it } from "vitest";
import { summarizeNational } from "../../src/domain/national-summary";
import type { RegionWithStatus } from "../../src/domain/region";

function region(status: RegionWithStatus["currentStatus"], code = "PL-00"): RegionWithStatus {
  return {
    code,
    slug: code.toLowerCase(),
    namePl: code,
    nameEn: code,
    currentStatus: status,
    lastClassifiedAt: null,
    statusReason: null,
    statusDriver: null,
  };
}

describe("summarizeNational", () => {
  it("returns UNKNOWN with zero regions when the list is empty", () => {
    const summary = summarizeNational([]);
    expect(summary.headlineLevel).toBe("UNKNOWN");
    expect(summary.totalRegions).toBe(0);
  });

  it("picks ELEVATED as the headline whenever any region is ELEVATED", () => {
    const summary = summarizeNational([region("CALM"), region("LOW"), region("ELEVATED"), region("UNKNOWN")]);
    expect(summary.headlineLevel).toBe("ELEVATED");
    expect(summary.counts).toEqual({ CALM: 1, LOW: 1, ELEVATED: 1, CRITICAL: 0, UNKNOWN: 1 });
  });

  it("picks LOW over UNKNOWN and CALM when no ELEVATED is present", () => {
    const summary = summarizeNational([region("CALM"), region("UNKNOWN"), region("LOW")]);
    expect(summary.headlineLevel).toBe("LOW");
  });

  it("treats UNKNOWN as more cautionary than CALM", () => {
    const summary = summarizeNational([region("CALM"), region("UNKNOWN")]);
    expect(summary.headlineLevel).toBe("UNKNOWN");
  });
});
