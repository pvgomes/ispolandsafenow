import { afterEach, describe, expect, it, vi } from "vitest";
import { TypeSafeAiClassificationService } from "../../src/domain/typesafe-ai-classification-service";
import { ClassificationUnavailableError } from "../../src/domain/classification-service";
import type { NewsItem } from "../../src/domain/news-item";
import type { RegionIdentity } from "../../src/domain/region";

const REGION_A: RegionIdentity = { code: "PL-14", slug: "mazowieckie", namePl: "Mazowieckie", nameEn: "Mazowieckie" };
const REGION_B: RegionIdentity = { code: "PL-20", slug: "podlaskie", namePl: "Podlaskie", nameEn: "Podlaskie" };

const NO_NEWS = async (): Promise<NewsItem[]> => [];
/** Keeps retry tests instant. */
const NO_BACKOFF = [0, 0];

function stubFetch(typeSafeAiHandler: (init: RequestInit) => Response) {
  const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => typeSafeAiHandler(init ?? {}));
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

describe("TypeSafeAiClassificationService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails the run and makes no network call when no API key is configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const service = new TypeSafeAiClassificationService(undefined, NO_NEWS);

    await expect(service.classifyRegions({ regions: [REGION_A, REGION_B], asOf: "2026-09-18T00:00:00.000Z" })).rejects.toBeInstanceOf(
      ClassificationUnavailableError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses a successful TypeSafe AI response into region classifications, keeping only the news that names each region", async () => {
    const news: NewsItem[] = [
      {
        title: "Incydent na granicy polsko-białoruskiej na Podlasiu",
        titleEn: null,
        url: "https://example-news.pl/incydent",
        sourceName: "Example News",
        publishedAt: "2026-09-17T20:00:00.000Z",
      },
      {
        title: "Alarm w Warszawie",
        titleEn: null,
        url: "https://example-news.pl/warszawa",
        sourceName: "Example News",
        publishedAt: "2026-09-17T21:00:00.000Z",
      },
    ];

    const fetchSpy = stubFetch(
      () =>
        new Response(
          JSON.stringify({
            model: "jev-latest",
            answers: {
              "PL-14": { type: "choice", choice: "LOW", confidence: 0.81 },
              "PL-20": { type: "choice", choice: "ELEVATED", confidence: 0.9 },
            },
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { status: 200 },
        ),
    );

    const service = new TypeSafeAiClassificationService("test-key", async () => news);
    const result = await service.classifyRegions({ regions: [REGION_A, REGION_B], asOf: "2026-09-18T00:00:00.000Z" });

    // Exactly one network call: TypeSafe AI. News is supplied, never fetched here.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const typeSafeAiCall = fetchSpy.mock.calls.find((call) => call[0] === "https://api.typesafe.ai/v1/systemone");
    expect(typeSafeAiCall).toBeDefined();
    const body = JSON.parse((typeSafeAiCall?.[1] as RequestInit).body as string);
    expect(body.state).toContain("Incydent na granicy polsko-białoruskiej");
    // Two questions per region: the alert level and the driver behind it.
    expect(body.questions["PL-14"]).toBeDefined();
    expect(body.questions["PL-14:driver"]).toBeDefined();
    expect((typeSafeAiCall?.[1] as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBe("Bearer test-key");

    const byCode = new Map(result.map((r) => [r.regionCode, r]));
    expect(byCode.get("PL-14")?.status).toBe("LOW");
    expect(byCode.get("PL-14")?.confidence).toBe(0.81);
    // Evidence is scoped to the region: Warsaw news belongs to Mazowieckie,
    // the Podlasie headline to Podlaskie.
    expect(byCode.get("PL-14")?.evidence.map((e) => e.sourceUrl)).toEqual(["https://example-news.pl/warszawa"]);
    expect(byCode.get("PL-20")?.evidence.map((e) => e.sourceUrl)).toEqual(["https://example-news.pl/incydent"]);
    expect(byCode.get("PL-20")?.status).toBe("ELEVATED");
  });

  it("fails the run without retrying when the API responds with a non-retryable 4xx", async () => {
    const fetchSpy = stubFetch(() => new Response("error", { status: 401 }));

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS);

    await expect(service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" })).rejects.toThrow(
      /HTTP 401/,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("retries a transient 503 and succeeds, instead of blanking every region", async () => {
    let call = 0;
    const fetchSpy = stubFetch(() => {
      call += 1;
      if (call === 1) return new Response("upstream unavailable", { status: 503 });
      return new Response(JSON.stringify({ model: "jev-latest", answers: { "PL-14": { type: "choice", choice: "CALM" } } }), {
        status: 200,
      });
    });

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS, NO_BACKOFF);
    const result = await service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result[0]?.status).toBe("CALM");
  });

  it("fails the run when a 503 persists across every attempt, so stored statuses are left untouched", async () => {
    const fetchSpy = stubFetch(() => new Response("upstream unavailable", { status: 503 }));

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS, NO_BACKOFF);

    await expect(service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" })).rejects.toThrow(
      /HTTP 503/,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("fails the run when no region got a usable answer", async () => {
    stubFetch(() => new Response(JSON.stringify({ model: "jev-latest", answers: {} }), { status: 200 }));

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS);

    await expect(service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" })).rejects.toBeInstanceOf(
      ClassificationUnavailableError,
    );
  });

  it("omits only the regions whose answer is missing, keeping the ones that were answered", async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ model: "jev-latest", answers: { "PL-14": { type: "choice", choice: "LOW" } } }), {
          status: 200,
        }),
    );

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS);
    const result = await service.classifyRegions({ regions: [REGION_A, REGION_B], asOf: "2026-09-18T00:00:00.000Z" });

    expect(result).toHaveLength(1);
    expect(result[0]?.regionCode).toBe("PL-14");
    expect(result[0]?.status).toBe("LOW");
  });

  it("omits a region whose answer is UNKNOWN or an unrecognized choice, never writing UNKNOWN over it", async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({
            model: "jev-latest",
            answers: {
              "PL-14": { type: "choice", choice: "UNKNOWN" },
              "PL-20": { type: "choice", choice: "ORANGE" },
            },
          }),
          { status: 200 },
        ),
    );

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS);

    await expect(service.classifyRegions({ regions: [REGION_A, REGION_B], asOf: "2026-09-18T00:00:00.000Z" })).rejects.toBeInstanceOf(
      ClassificationUnavailableError,
    );
  });

  it("accepts CALM as a normal, evidence-based classification (not a failure)", async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ model: "jev-latest", answers: { "PL-14": { type: "choice", choice: "CALM" } } }), {
          status: 200,
        }),
    );

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS);
    const result = await service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" });

    expect(result[0]?.status).toBe("CALM");
    expect(result[0]?.rationale).toBeTruthy();
  });

  it("only offers CALM/LOW/ELEVATED/CRITICAL as AI-selectable criteria, not UNKNOWN", async () => {
    const fetchSpy = stubFetch(
      () =>
        new Response(JSON.stringify({ model: "jev-latest", answers: { "PL-14": { type: "choice", choice: "CALM" } } }), {
          status: 200,
        }),
    );

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS);
    await service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" });

    const typeSafeAiCall = fetchSpy.mock.calls.find((call) => call[0] === "https://api.typesafe.ai/v1/systemone");
    const body = JSON.parse((typeSafeAiCall?.[1] as RequestInit).body as string);
    const criteria = body.questions["PL-14"].criteria;
    expect(Object.keys(criteria).sort()).toEqual(["CALM", "CRITICAL", "ELEVATED", "LOW"]);
  });
});
