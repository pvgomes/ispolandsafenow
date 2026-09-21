import { describe, expect, it } from "vitest";
import { resolveEffectiveStatus } from "../../src/domain/region";

describe("resolveEffectiveStatus", () => {
  it("resolves to UNKNOWN when never classified", () => {
    const status = resolveEffectiveStatus({
      currentStatus: "GREEN",
      lastClassifiedAt: null,
      statusReason: null,
      statusDriver: null,
    });
    expect(status).toBe("UNKNOWN");
  });

  it("keeps an old classification, because statuses do not expire", () => {
    const status = resolveEffectiveStatus({
      currentStatus: "RED",
      lastClassifiedAt: "2020-01-01T00:00:00.000Z",
      statusReason: "Drone, missile or airspace activity was reported in or near this region.",
      statusDriver: "AIRSPACE_INCIDENT",
    });
    expect(status).toBe("RED");
  });

  it("returns the stored status once classified", () => {
    const status = resolveEffectiveStatus({
      currentStatus: "YELLOW",
      lastClassifiedAt: "2020-01-01T00:00:00.000Z",
      statusReason: null,
      statusDriver: null,
    });
    expect(status).toBe("YELLOW");
  });
});
