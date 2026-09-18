import { describe, expect, it } from "vitest";
import { resolveEffectiveStatus } from "../../src/domain/region";

describe("resolveEffectiveStatus", () => {
  it("resolves to UNKNOWN when never classified", () => {
    const status = resolveEffectiveStatus({ currentStatus: "GREEN", lastClassifiedAt: null, statusExpiresAt: null });
    expect(status).toBe("UNKNOWN");
  });

  it("resolves to UNKNOWN once the status has expired", () => {
    const status = resolveEffectiveStatus(
      {
        currentStatus: "RED",
        lastClassifiedAt: "2020-01-01T00:00:00.000Z",
        statusExpiresAt: "2020-01-02T00:00:00.000Z",
      },
      new Date("2020-01-03T00:00:00.000Z"),
    );
    expect(status).toBe("UNKNOWN");
  });

  it("returns the stored status while it is fresh", () => {
    const status = resolveEffectiveStatus(
      {
        currentStatus: "YELLOW",
        lastClassifiedAt: "2020-01-01T00:00:00.000Z",
        statusExpiresAt: "2020-01-03T00:00:00.000Z",
      },
      new Date("2020-01-02T00:00:00.000Z"),
    );
    expect(status).toBe("YELLOW");
  });
});
