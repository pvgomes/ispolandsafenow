import { describe, expect, it } from "vitest";
import { buildStatusPayload } from "../../src/pages/api/status";
import { FakeD1Database } from "../fakes/fake-d1";
import { buildSeededRows } from "../fakes/seeded-rows";

describe("GET /api/status logic", () => {
  it("marks the response as live mode and resolves to UNKNOWN when TypeSafe AI is unconfigured", async () => {
    const payload = await buildStatusPayload(new FakeD1Database(buildSeededRows()) as never);
    expect(payload.mode).toBe("live");
    expect(payload.totalRegions).toBe(16);
    expect(payload.nationalStatus).toBe("UNKNOWN");
    expect(payload.regionCounts).toEqual({ CALM: 0, LOW: 0, ELEVATED: 0, CRITICAL: 0, UNKNOWN: 16 });
  });
});
