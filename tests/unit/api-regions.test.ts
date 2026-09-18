import { describe, expect, it } from "vitest";
import { buildRegionsPayload } from "../../src/pages/api/regions";
import { FakeD1Database } from "../fakes/fake-d1";
import { buildSeededRows } from "../fakes/seeded-rows";

describe("GET /api/regions logic", () => {
  it("marks the response as demonstration mode", async () => {
    const payload = await buildRegionsPayload(new FakeD1Database(buildSeededRows()) as never);
    expect(payload.mode).toBe("demonstration");
  });

  it("returns all 16 regions with a status from the demo fixture", async () => {
    const payload = await buildRegionsPayload(new FakeD1Database(buildSeededRows()) as never);
    expect(payload.regions).toHaveLength(16);
    const bySlug = new Map(payload.regions.map((r) => [r.slug, r]));
    expect(bySlug.get("dolnoslaskie")?.status).toBe("GREEN");
    expect(bySlug.get("mazowieckie")?.status).toBe("YELLOW");
    expect(bySlug.get("podkarpackie")?.status).toBe("RED");
    expect(bySlug.get("swietokrzyskie")?.status).toBe("UNKNOWN");
  });
});
