import { describe, expect, it } from "vitest";
import { buildRegionsPayload } from "../../src/pages/api/regions";
import { FakeD1Database } from "../fakes/fake-d1";
import { buildSeededRows } from "../fakes/seeded-rows";

describe("GET /api/regions logic", () => {
  it("marks the response as live mode", async () => {
    const payload = await buildRegionsPayload(new FakeD1Database(buildSeededRows()) as never);
    expect(payload.mode).toBe("live");
  });

  it("returns all 16 regions, resolving to UNKNOWN when TypeSafe AI is unconfigured", async () => {
    const payload = await buildRegionsPayload(new FakeD1Database(buildSeededRows()) as never);
    expect(payload.regions).toHaveLength(16);
    expect(payload.regions.every((r) => r.status === "UNKNOWN")).toBe(true);
  });
});
