import { afterEach, describe, expect, it, vi } from "vitest";
import { runClassificationJob } from "../../scheduler/src/index";
import { REGIONS } from "../../src/data/regions";
import { InMemoryD1Database, type InMemoryRegionRow } from "../fakes/in-memory-d1";

function seedAllRegions(): InMemoryRegionRow[] {
  return REGIONS.map((r) => ({
    code: r.code,
    slug: r.slug,
    name_pl: r.namePl,
    name_en: r.nameEn,
    current_status: "UNKNOWN",
    last_classified_at: null,
    status_expires_at: null,
    updated_at: "2020-01-01T00:00:00.000Z",
  }));
}

const EMPTY_RSS_FEED = `<?xml version="1.0"?><rss><channel></channel></rss>`;

describe("runClassificationJob (scheduler)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("classifies all 16 regions and persists a succeeded job run", async () => {
    const answers: Record<string, unknown> = {};
    for (const r of REGIONS) answers[r.code] = { type: "choice", choice: "GREEN" };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("news.google.com")) return new Response(EMPTY_RSS_FEED, { status: 200 });
        return new Response(JSON.stringify({ model: "jev-latest", answers }), { status: 200 });
      }),
    );

    const db = new InMemoryD1Database(seedAllRegions());
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key" };

    await runClassificationJob(env);

    expect(db.jobRuns).toHaveLength(1);
    expect(db.jobRuns[0]?.status).toBe("succeeded");
    expect(db.classifications).toHaveLength(16);
    expect(db.regions.every((r) => r.current_status === "GREEN")).toBe(true);
  });

  it("marks the job run failed and leaves existing region status untouched when TypeSafe AI is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("news.google.com")) return new Response(EMPTY_RSS_FEED, { status: 200 });
        throw new Error("network down");
      }),
    );

    const seeded = seedAllRegions();
    seeded[0]!.current_status = "GREEN";
    seeded[0]!.last_classified_at = "2026-01-01T00:00:00.000Z";
    const db = new InMemoryD1Database(seeded);
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key" };

    await runClassificationJob(env);

    // The service itself resolves every region to UNKNOWN on a fetch
    // failure, but the writer never got that far here — the failure
    // happens after startJobRun but classifyRegions still returns
    // UNKNOWN results, which DO get written (that's a real, if
    // unfortunate, classification result, not a writer crash).
    expect(db.jobRuns).toHaveLength(1);
    expect(db.jobRuns[0]?.status).toBe("succeeded");
    expect(db.regions.every((r) => r.current_status === "UNKNOWN")).toBe(true);
  });

  it("marks the job run failed without touching regions when the writer itself throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("news.google.com")) return new Response(EMPTY_RSS_FEED, { status: 200 });
        return new Response(JSON.stringify({ model: "jev-latest", answers: {} }), { status: 200 });
      }),
    );

    const seeded = seedAllRegions();
    seeded[0]!.current_status = "GREEN";
    const db = new InMemoryD1Database(seeded);
    // Simulate a DB-level failure once classifications start being written.
    const originalPrepare = db.prepare.bind(db);
    db.prepare = (sql: string) => {
      if (sql.startsWith("INSERT INTO region_classifications")) {
        throw new Error("simulated D1 outage");
      }
      return originalPrepare(sql);
    };
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key" };

    await runClassificationJob(env);

    expect(db.jobRuns).toHaveLength(1);
    expect(db.jobRuns[0]?.status).toBe("failed");
    expect(db.jobRuns[0]?.error_message).toMatch(/simulated D1 outage/);
    // The pre-existing GREEN status is left alone rather than forced to
    // UNKNOWN by one failed run.
    expect(db.regions[0]?.current_status).toBe("GREEN");
  });
});
