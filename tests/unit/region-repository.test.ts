import { describe, expect, it } from "vitest";
import { RegionRepository } from "../../src/repositories/region-repository";
import { FakeD1Database } from "../fakes/fake-d1";
import { buildSeededRows } from "../fakes/seeded-rows";

describe("RegionRepository", () => {
  it("lists exactly the 16 seeded regions, sorted by code", async () => {
    const repo = new RegionRepository(new FakeD1Database(buildSeededRows()) as never);
    const regions = await repo.listAll();
    expect(regions).toHaveLength(16);
    const codes = regions.map((r) => r.code);
    expect(codes).toEqual([...codes].sort());
  });

  it("counts the seeded regions", async () => {
    const repo = new RegionRepository(new FakeD1Database(buildSeededRows()) as never);
    await expect(repo.count()).resolves.toBe(16);
  });

  it("finds a region by slug", async () => {
    const repo = new RegionRepository(new FakeD1Database(buildSeededRows()) as never);
    const region = await repo.findBySlug("mazowieckie");
    expect(region?.code).toBe("PL-14");
    expect(region?.namePl).toBe("Mazowieckie");
  });

  it("returns null for an unknown slug", async () => {
    const repo = new RegionRepository(new FakeD1Database(buildSeededRows()) as never);
    const region = await repo.findBySlug("not-a-real-slug");
    expect(region).toBeNull();
  });

  it("coerces an invalid stored status to UNKNOWN rather than passing it through", async () => {
    const rows = buildSeededRows();
    rows[0]!.current_status = "not-a-real-status";
    const repo = new RegionRepository(new FakeD1Database(rows) as never);
    const regions = await repo.listAll();
    expect(regions[0]?.currentStatus).toBe("UNKNOWN");
  });
});
