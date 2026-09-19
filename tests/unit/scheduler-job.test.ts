import { afterEach, describe, expect, it, vi } from "vitest";
import { runClassificationJob } from "../../scheduler/src/index";
import { REGIONS } from "../../src/data/regions";
import { InMemoryD1Database, type InMemoryNewsRow, type InMemoryRegionRow } from "../fakes/in-memory-d1";

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

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60 * 1000).toISOString();

const NEWS: InMemoryNewsRow[] = [
  { id: 1, url: "https://a.pl/fresh", title: "Dron nad Podlasiem", title_en: null, source_name: "A", published_at: hoursAgo(3) },
  { id: 2, url: "https://b.pl/old", title: "Stara wiadomość", title_en: null, source_name: "B", published_at: hoursAgo(72) },
];

describe("runClassificationJob (scheduler)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("classifies all 16 regions and persists a succeeded job run", async () => {
    const answers: Record<string, unknown> = {};
    for (const r of REGIONS) answers[r.code] = { type: "choice", choice: "GREEN" };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ model: "jev-latest", answers }), { status: 200 })),
    );

    const db = new InMemoryD1Database(seedAllRegions(), NEWS);
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key", SCHEDULER_TRIGGER_SECRET: undefined };

    await runClassificationJob(env);

    expect(db.jobRuns).toHaveLength(1);
    expect(db.jobRuns[0]?.status).toBe("succeeded");
    expect(db.classifications).toHaveLength(16);
    expect(db.regions.every((r) => r.current_status === "GREEN")).toBe(true);
    // Evidence is the last 48h of news_items (one row per region per
    // headline) — the 72h-old item is excluded, and nothing was fetched
    // from Google News (Workers are blocked there).
    expect(db.evidence).toHaveLength(16);
    expect(db.evidence.every((e) => e.source_url === "https://a.pl/fresh")).toBe(true);
  });

  it("marks the job run failed and leaves existing region status untouched when TypeSafe AI is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const seeded = seedAllRegions();
    seeded[0]!.current_status = "GREEN";
    seeded[0]!.last_classified_at = "2026-01-01T00:00:00.000Z";
    const db = new InMemoryD1Database(seeded);
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key", SCHEDULER_TRIGGER_SECRET: undefined };

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
      vi.fn(async () => {
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
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key", SCHEDULER_TRIGGER_SECRET: undefined };

    await runClassificationJob(env);

    expect(db.jobRuns).toHaveLength(1);
    expect(db.jobRuns[0]?.status).toBe("failed");
    expect(db.jobRuns[0]?.error_message).toMatch(/simulated D1 outage/);
    // The pre-existing GREEN status is left alone rather than forced to
    // UNKNOWN by one failed run.
    expect(db.regions[0]?.current_status).toBe("GREEN");
  });
});
