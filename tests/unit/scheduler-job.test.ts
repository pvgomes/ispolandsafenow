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
    status_reason: null,
    status_driver: null,
    updated_at: "2020-01-01T00:00:00.000Z",
  }));
}

/** Keeps retry-path tests instant. */
const NO_BACKOFF = [0, 0];

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
    for (const r of REGIONS) answers[r.code] = { type: "choice", choice: "CALM" };

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
    expect(db.regions.every((r) => r.current_status === "CALM")).toBe(true);
    // Evidence is the last 48h of news_items, stored only against the
    // regions each headline actually names — "Dron nad Podlasiem" is
    // Podlaskie only, and the 72h-old item is excluded entirely. Nothing
    // was fetched from Google News (Workers are blocked there).
    expect(db.evidence).toHaveLength(1);
    expect(db.evidence[0]?.source_url).toBe("https://a.pl/fresh");
    const podlaskie = db.classifications.find((c) => c.region_code === "PL-20");
    expect(db.evidence[0]?.classification_id).toBe(podlaskie?.id);
  });

  it("marks the job run failed and leaves existing region status untouched when TypeSafe AI is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const seeded = seedAllRegions();
    seeded[0]!.current_status = "CALM";
    seeded[0]!.last_classified_at = "2026-01-01T00:00:00.000Z";
    const db = new InMemoryD1Database(seeded);
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key", SCHEDULER_TRIGGER_SECRET: undefined };

    const result = await runClassificationJob(env, { retryDelaysMs: NO_BACKOFF });

    expect(result.status).toBe("failed");
    expect(db.jobRuns).toHaveLength(1);
    expect(db.jobRuns[0]?.status).toBe("failed");
    // Nothing is written: the previous CALM stands until it expires on
    // its own, rather than the whole map being blanked to UNKNOWN.
    expect(db.classifications).toHaveLength(0);
    expect(db.regions[0]?.current_status).toBe("CALM");
  });

  it("leaves every region untouched when a transient upstream 503 persists (the 2026-09-21 incident)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream unavailable", { status: 503 })),
    );

    const seeded = seedAllRegions();
    seeded[0]!.current_status = "CALM";
    seeded[0]!.last_classified_at = "2026-01-01T00:00:00.000Z";
    seeded[1]!.current_status = "LOW";
    seeded[1]!.last_classified_at = "2026-01-01T00:00:00.000Z";
    const db = new InMemoryD1Database(seeded);
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key", SCHEDULER_TRIGGER_SECRET: undefined };

    const result = await runClassificationJob(env, { retryDelaysMs: NO_BACKOFF });

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/HTTP 503/);
    expect(db.classifications).toHaveLength(0);
    expect(db.regions[0]?.current_status).toBe("CALM");
    expect(db.regions[1]?.current_status).toBe("LOW");
  });

  it("writes only the regions that were answered and leaves the rest untouched", async () => {
    const answers: Record<string, unknown> = {};
    for (const r of REGIONS.slice(0, 15)) answers[r.code] = { type: "choice", choice: "CALM" };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ model: "jev-latest", answers }), { status: 200 })),
    );

    const seeded = seedAllRegions();
    const lastRegion = REGIONS[15]!;
    const lastRow = seeded.find((r) => r.code === lastRegion.code)!;
    lastRow.current_status = "LOW";
    lastRow.last_classified_at = "2026-01-01T00:00:00.000Z";
    const db = new InMemoryD1Database(seeded);
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key", SCHEDULER_TRIGGER_SECRET: undefined };

    const result = await runClassificationJob(env, { retryDelaysMs: NO_BACKOFF });

    expect(result.status).toBe("succeeded");
    expect(result.regionCount).toBe(15);
    expect(result.skippedRegions).toEqual([lastRegion.code]);
    expect(db.classifications).toHaveLength(15);
    expect(db.regions.find((r) => r.code === lastRegion.code)?.current_status).toBe("LOW");
  });

  it("marks the job run failed without touching regions when the writer itself throws", async () => {
    const answers: Record<string, unknown> = {};
    for (const r of REGIONS) answers[r.code] = { type: "choice", choice: "CALM" };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ model: "jev-latest", answers }), { status: 200 })),
    );

    const seeded = seedAllRegions();
    seeded[0]!.current_status = "CALM";
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
    // The pre-existing CALM status is left alone rather than forced to
    // UNKNOWN by one failed run.
    expect(db.regions[0]?.current_status).toBe("CALM");
  });
});
