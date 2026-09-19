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

  it("resolves a stale (expired) classification to UNKNOWN rather than showing a frozen status", async () => {
    const rows = buildSeededRows();
    rows[0]!.current_status = "RED";
    rows[0]!.last_classified_at = "2020-01-01T00:00:00.000Z";
    rows[0]!.status_expires_at = "2020-01-01T02:00:00.000Z"; // long expired
    const repo = new RegionRepository(new FakeD1Database(rows) as never);
    const regions = await repo.listAll();
    // A missed scheduler run (see scheduler/src/index.ts) must never leave
    // an old RED/YELLOW/GREEN showing indefinitely as if still current.
    expect(regions[0]?.currentStatus).toBe("UNKNOWN");
  });

  it("keeps a fresh, non-expired classification as-is", async () => {
    const rows = buildSeededRows();
    rows[0]!.current_status = "RED";
    rows[0]!.last_classified_at = new Date().toISOString();
    rows[0]!.status_expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const repo = new RegionRepository(new FakeD1Database(rows) as never);
    const regions = await repo.listAll();
    expect(regions[0]?.currentStatus).toBe("RED");
  });
});
