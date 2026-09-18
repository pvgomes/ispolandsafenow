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
    statusExpiresAt: null,
  };
}

describe("summarizeNational", () => {
  it("returns UNKNOWN with zero regions when the list is empty", () => {
    const summary = summarizeNational([]);
    expect(summary.headlineLevel).toBe("UNKNOWN");
    expect(summary.totalRegions).toBe(0);
  });

  it("picks RED as the headline whenever any region is RED", () => {
    const summary = summarizeNational([region("GREEN"), region("YELLOW"), region("RED"), region("UNKNOWN")]);
    expect(summary.headlineLevel).toBe("RED");
    expect(summary.counts).toEqual({ GREEN: 1, YELLOW: 1, RED: 1, UNKNOWN: 1 });
  });

  it("picks YELLOW over UNKNOWN and GREEN when no RED is present", () => {
    const summary = summarizeNational([region("GREEN"), region("UNKNOWN"), region("YELLOW")]);
    expect(summary.headlineLevel).toBe("YELLOW");
  });

  it("treats UNKNOWN as more cautionary than GREEN", () => {
    const summary = summarizeNational([region("GREEN"), region("UNKNOWN")]);
    expect(summary.headlineLevel).toBe("UNKNOWN");
  });
});
