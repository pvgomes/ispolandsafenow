import { describe, expect, it } from "vitest";
import { buildStatusPayload } from "../../src/pages/api/status";
import { FakeD1Database } from "../fakes/fake-d1";
import { buildSeededRows } from "../fakes/seeded-rows";

describe("GET /api/status logic", () => {
  it("summarizes the demo fixture's national status", async () => {
    const payload = await buildStatusPayload(new FakeD1Database(buildSeededRows()) as never);
    expect(payload.mode).toBe("demonstration");
    expect(payload.totalRegions).toBe(16);
    expect(payload.nationalStatus).toBe("RED");
    expect(payload.regionCounts).toEqual({ GREEN: 5, YELLOW: 6, RED: 4, UNKNOWN: 1 });
  });
});
