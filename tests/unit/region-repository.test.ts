import { describe, expect, it } from "vitest";
import { RegionRepository } from "../../src/repositories/region-repository";
import { ClassificationWriter } from "../../src/repositories/classification-writer";
import { FakeD1Database } from "../fakes/fake-d1";
import { InMemoryD1Database, type InMemoryRegionRow } from "../fakes/in-memory-d1";
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

  it("reads the stored reason and driver behind a region's colour", async () => {
    const rows = buildSeededRows();
    rows[0]!.current_status = "LOW";
    rows[0]!.last_classified_at = "2026-01-01T00:00:00.000Z";
    rows[0]!.status_reason = "Incidents or pressure at the border were reported. Based on 2 recent headlines mentioning Dolnośląskie.";
    rows[0]!.status_driver = "BORDER_PRESSURE";
    const repo = new RegionRepository(new FakeD1Database(rows) as never);
    const regions = await repo.listAll();
    expect(regions[0]?.statusReason).toContain("border");
    expect(regions[0]?.statusDriver).toBe("BORDER_PRESSURE");
  });

  it("ignores an unrecognized stored driver instead of passing it through", async () => {
    const rows = buildSeededRows();
    rows[0]!.status_driver = "NOT_A_DRIVER";
    const repo = new RegionRepository(new FakeD1Database(rows) as never);
    const regions = await repo.listAll();
    expect(regions[0]?.statusDriver).toBeNull();
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

  it("resolves a never-classified region to UNKNOWN rather than trusting its stored colour", async () => {
    const rows = buildSeededRows();
    rows[0]!.current_status = "ELEVATED";
    rows[0]!.last_classified_at = null;
    const repo = new RegionRepository(new FakeD1Database(rows) as never);
    const regions = await repo.listAll();
    expect(regions[0]?.currentStatus).toBe("UNKNOWN");
  });

  it("keeps a classification as-is however old it is, because statuses no longer expire", async () => {
    const rows = buildSeededRows();
    rows[0]!.current_status = "ELEVATED";
    rows[0]!.last_classified_at = "2020-01-01T00:00:00.000Z";
    const repo = new RegionRepository(new FakeD1Database(rows) as never);
    const regions = await repo.listAll();
    expect(regions[0]?.currentStatus).toBe("ELEVATED");
  });
});

describe("RegionRepository.listLatestEvidence", () => {
  function seedRegion(code: string): InMemoryRegionRow {
    return {
      code,
      slug: code.toLowerCase(),
      name_pl: code,
      name_en: code,
      current_status: "UNKNOWN",
      last_classified_at: null,
      status_reason: null,
      status_driver: null,
      updated_at: "2020-01-01T00:00:00.000Z",
    };
  }

  async function write(db: InMemoryD1Database, classifiedAt: string, urls: string[]) {
    const writer = new ClassificationWriter(db as never);
    const jobRunId = await writer.startJobRun("classification");
    await writer.writeClassification(
      {
        regionCode: "PL-14",
        status: "LOW",
        confidence: null,
        rationale: "because",
        driver: "BORDER_PRESSURE",
        classifiedAt,
        evidence: urls.map((url, i) => ({
          sourceUrl: url,
          sourceName: "Example",
          title: `Headline ${i}`,
          publishedAt: `2026-01-0${i + 1}T00:00:00.000Z`,
          excerpt: null,
          relevanceScore: null,
        })),
      },
      jobRunId,
    );
  }

  it("returns only the news behind the most recent classification", async () => {
    const db = new InMemoryD1Database([seedRegion("PL-14")]);
    await write(db, "2026-01-01T00:00:00.000Z", ["https://old.pl/a"]);
    await write(db, "2026-01-02T00:00:00.000Z", ["https://new.pl/a", "https://new.pl/b"]);

    const repo = new RegionRepository(db as never);
    const evidence = await repo.listLatestEvidence("PL-14", 8);
    expect(evidence.map((e) => e.sourceUrl).sort()).toEqual(["https://new.pl/a", "https://new.pl/b"]);
  });

  it("returns an empty list for a region that has never been classified", async () => {
    const db = new InMemoryD1Database([seedRegion("PL-14")]);
    const repo = new RegionRepository(db as never);
    await expect(repo.listLatestEvidence("PL-14", 8)).resolves.toEqual([]);
  });
});
