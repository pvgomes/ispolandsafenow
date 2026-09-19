import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../scheduler/src/index";
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

describe("scheduler fetch handler (POST /trigger)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects requests without a matching secret", async () => {
    const db = new InMemoryD1Database(seedAllRegions());
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key", SCHEDULER_TRIGGER_SECRET: "correct-secret" };

    const noHeader = await worker.fetch(new Request("https://example.com/trigger", { method: "POST" }), env);
    expect(noHeader.status).toBe(401);

    const wrongHeader = await worker.fetch(
      new Request("https://example.com/trigger", { method: "POST", headers: { "x-trigger-secret": "wrong" } }),
      env,
    );
    expect(wrongHeader.status).toBe(401);

    expect(db.jobRuns).toHaveLength(0);
  });

  it("rejects when no trigger secret is configured on the environment", async () => {
    const db = new InMemoryD1Database(seedAllRegions());
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key", SCHEDULER_TRIGGER_SECRET: undefined };

    const response = await worker.fetch(
      new Request("https://example.com/trigger", { method: "POST", headers: { "x-trigger-secret": "" } }),
      env,
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 for any other path or method", async () => {
    const db = new InMemoryD1Database(seedAllRegions());
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key", SCHEDULER_TRIGGER_SECRET: "correct-secret" };

    const wrongPath = await worker.fetch(
      new Request("https://example.com/", { method: "POST", headers: { "x-trigger-secret": "correct-secret" } }),
      env,
    );
    expect(wrongPath.status).toBe(404);

    const wrongMethod = await worker.fetch(
      new Request("https://example.com/trigger", { method: "GET", headers: { "x-trigger-secret": "correct-secret" } }),
      env,
    );
    expect(wrongMethod.status).toBe(404);
  });

  it("runs the classification job and returns a summary when the secret matches", async () => {
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
    const env = { DB: db as never, TYPESAFE_AI_API_KEY: "test-key", SCHEDULER_TRIGGER_SECRET: "correct-secret" };

    const response = await worker.fetch(
      new Request("https://example.com/trigger", { method: "POST", headers: { "x-trigger-secret": "correct-secret" } }),
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "succeeded", regionCount: 16, counts: { GREEN: 16 } });
    expect(db.jobRuns).toHaveLength(1);
  });
});
