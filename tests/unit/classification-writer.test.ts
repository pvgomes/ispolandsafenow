import { describe, expect, it } from "vitest";
import { ClassificationWriter } from "../../src/repositories/classification-writer";
import type { RegionClassification } from "../../src/domain/classification-service";
import { InMemoryD1Database, type InMemoryRegionRow } from "../fakes/in-memory-d1";

function seedRegion(code: string): InMemoryRegionRow {
  return {
    code,
    slug: code.toLowerCase(),
    name_pl: code,
    name_en: code,
    current_status: "UNKNOWN",
    last_classified_at: null,
    status_expires_at: null,
    updated_at: "2020-01-01T00:00:00.000Z",
  };
}

describe("ClassificationWriter", () => {
  it("persists a classification, its evidence, and updates the region's live snapshot", async () => {
    const db = new InMemoryD1Database([seedRegion("PL-14")]);
    const writer = new ClassificationWriter(db as never);
    const jobRunId = await writer.startJobRun("classification");

    const classification: RegionClassification = {
      regionCode: "PL-14",
      status: "YELLOW",
      confidence: 0.7,
      rationale: "test rationale",
      classifiedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T02:00:00.000Z",
      evidence: [
        {
          sourceUrl: "https://example.com/a",
          sourceName: "Example",
          title: "A headline",
          publishedAt: "2025-12-31T23:00:00.000Z",
          excerpt: null,
          relevanceScore: null,
        },
      ],
    };

    await writer.writeClassification(classification, jobRunId);

    expect(db.classifications).toHaveLength(1);
    expect(db.classifications[0]?.status).toBe("YELLOW");
    expect(db.evidence).toHaveLength(1);
    expect(db.evidence[0]?.source_url).toBe("https://example.com/a");
    expect(db.evidence[0]?.classification_id).toBe(db.classifications[0]?.id);

    const region = db.regions.find((r) => r.code === "PL-14");
    expect(region?.current_status).toBe("YELLOW");
    expect(region?.last_classified_at).toBe("2026-01-01T00:00:00.000Z");
    expect(region?.status_expires_at).toBe("2026-01-01T02:00:00.000Z");
  });

  it("records multiple classifications under the same job run without overwriting history", async () => {
    const db = new InMemoryD1Database([seedRegion("PL-02"), seedRegion("PL-04")]);
    const writer = new ClassificationWriter(db as never);
    const jobRunId = await writer.startJobRun("classification");

    for (const code of ["PL-02", "PL-04"]) {
      await writer.writeClassification(
        {
          regionCode: code,
          status: "GREEN",
          confidence: null,
          rationale: null,
          classifiedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-01T02:00:00.000Z",
          evidence: [],
        },
        jobRunId,
      );
    }

    expect(db.classifications).toHaveLength(2);
    expect(db.classifications.every((c) => c.job_run_id === jobRunId)).toBe(true);
  });

  it("marks a job run finished with a summary", async () => {
    const db = new InMemoryD1Database([]);
    const writer = new ClassificationWriter(db as never);
    const jobRunId = await writer.startJobRun("classification");

    await writer.finishJobRun(jobRunId, "succeeded", { regionCount: 16 });

    const jobRun = db.jobRuns.find((r) => r.id === jobRunId);
    expect(jobRun?.status).toBe("succeeded");
    expect(jobRun?.finished_at).not.toBeNull();
    expect(JSON.parse(jobRun?.summary ?? "{}")).toEqual({ regionCount: 16 });
  });
});
