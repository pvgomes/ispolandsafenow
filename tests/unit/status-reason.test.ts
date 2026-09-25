import { describe, expect, it } from "vitest";
import { buildStatusReason, toStatusDriver, STATUS_DRIVERS } from "../../src/domain/status-reason";

describe("buildStatusReason", () => {
  it("combines the driver phrase with the headline count", () => {
    const reason = buildStatusReason({
      status: "ELEVATED",
      driver: "AIRSPACE_INCIDENT",
      regionName: "Mazowieckie",
      matchedHeadlineCount: 3,
    });
    expect(reason).toBe(`${STATUS_DRIVERS.AIRSPACE_INCIDENT.phrase} Based on 3 recent headlines mentioning Mazowieckie.`);
  });

  it("uses the singular form for a single matched headline", () => {
    const reason = buildStatusReason({
      status: "LOW",
      driver: "BORDER_PRESSURE",
      regionName: "Podlaskie",
      matchedHeadlineCount: 1,
    });
    expect(reason).toContain("1 recent headline mentioning Podlaskie");
    expect(reason).not.toContain("headlines");
  });

  it("says so explicitly when no headline named the region", () => {
    const reason = buildStatusReason({
      status: "CALM",
      driver: "NOTHING_NOTABLE",
      regionName: "Opolskie",
      matchedHeadlineCount: 0,
    });
    expect(reason).toContain("nothing named Opolskie directly");
  });

  it("falls back to the evidence sentence alone when the classifier gave no driver", () => {
    const reason = buildStatusReason({
      status: "LOW",
      driver: null,
      regionName: "Lubelskie",
      matchedHeadlineCount: 2,
    });
    expect(reason).toBe("Based on 2 recent headlines mentioning Lubelskie.");
  });

  it("never claims a cause for an UNKNOWN region", () => {
    const reason = buildStatusReason({
      status: "UNKNOWN",
      driver: "AIRSPACE_INCIDENT",
      regionName: "Lubuskie",
      matchedHeadlineCount: 5,
    });
    expect(reason).toBe("Not enough current, trustworthy information about Lubuskie.");
  });
});

describe("toStatusDriver", () => {
  it("accepts a known driver", () => {
    expect(toStatusDriver("SABOTAGE_INFRASTRUCTURE")).toBe("SABOTAGE_INFRASTRUCTURE");
  });

  it("rejects anything else rather than trusting stored or model output", () => {
    expect(toStatusDriver("NOT_A_DRIVER")).toBeNull();
    expect(toStatusDriver(null)).toBeNull();
    expect(toStatusDriver(42)).toBeNull();
  });
});
