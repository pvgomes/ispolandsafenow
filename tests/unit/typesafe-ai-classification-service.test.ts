import { afterEach, describe, expect, it, vi } from "vitest";
import { TypeSafeAiClassificationService } from "../../src/domain/typesafe-ai-classification-service";
import type { NewsItem } from "../../src/domain/news-item";
import type { RegionIdentity } from "../../src/domain/region";

const REGION_A: RegionIdentity = { code: "PL-14", slug: "mazowieckie", namePl: "Mazowieckie", nameEn: "Mazowieckie" };
const REGION_B: RegionIdentity = { code: "PL-20", slug: "podlaskie", namePl: "Podlaskie", nameEn: "Podlaskie" };

const NO_NEWS = async (): Promise<NewsItem[]> => [];

function stubFetch(typeSafeAiHandler: (init: RequestInit) => Response) {
  const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => typeSafeAiHandler(init ?? {}));
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

describe("TypeSafeAiClassificationService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves every region to UNKNOWN and makes no network call when no API key is configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const service = new TypeSafeAiClassificationService(undefined, NO_NEWS);
    const result = await service.classifyRegions({ regions: [REGION_A, REGION_B], asOf: "2026-09-18T00:00:00.000Z" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status === "UNKNOWN")).toBe(true);
  });

  it("parses a successful TypeSafe AI response into region classifications, using the supplied news as evidence", async () => {
    const news: NewsItem[] = [
      {
        title: "Incydent na granicy polsko-białoruskiej",
        url: "https://example-news.pl/incydent",
        sourceName: "Example News",
        publishedAt: "2026-09-17T20:00:00.000Z",
      },
    ];

    const fetchSpy = stubFetch(
      () =>
        new Response(
          JSON.stringify({
            model: "jev-latest",
            answers: {
              "PL-14": { type: "choice", choice: "YELLOW", confidence: 0.81 },
              "PL-20": { type: "choice", choice: "RED", confidence: 0.9 },
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
    expect((typeSafeAiCall?.[1] as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBe("Bearer test-key");

    const byCode = new Map(result.map((r) => [r.regionCode, r]));
    expect(byCode.get("PL-14")?.status).toBe("YELLOW");
    expect(byCode.get("PL-14")?.confidence).toBe(0.81);
    expect(byCode.get("PL-14")?.evidence).toHaveLength(1);
    expect(byCode.get("PL-14")?.evidence[0]?.sourceUrl).toBe("https://example-news.pl/incydent");
    expect(byCode.get("PL-20")?.status).toBe("RED");
  });

  it("resolves to UNKNOWN when the API responds with a non-2xx status", async () => {
    stubFetch(() => new Response("error", { status: 401 }));

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS);
    const result = await service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" });

    expect(result[0]?.status).toBe("UNKNOWN");
  });

  it("resolves to UNKNOWN when a region's answer is missing from the response", async () => {
    stubFetch(() => new Response(JSON.stringify({ model: "jev-latest", answers: {} }), { status: 200 }));

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS);
    const result = await service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" });

    expect(result[0]?.status).toBe("UNKNOWN");
  });

  it("resolves to UNKNOWN when TypeSafe AI itself answers UNKNOWN (not an AI-selectable choice)", async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ model: "jev-latest", answers: { "PL-14": { type: "choice", choice: "UNKNOWN" } } }), {
          status: 200,
        }),
    );

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS);
    const result = await service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" });

    expect(result[0]?.status).toBe("UNKNOWN");
  });

  it("resolves to UNKNOWN when TypeSafe AI returns a choice outside GREEN/YELLOW/RED", async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ model: "jev-latest", answers: { "PL-14": { type: "choice", choice: "ORANGE" } } }), {
          status: 200,
        }),
    );

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS);
    const result = await service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" });

    expect(result[0]?.status).toBe("UNKNOWN");
  });

  it("accepts GREEN as a normal, evidence-based classification (not a failure)", async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ model: "jev-latest", answers: { "PL-14": { type: "choice", choice: "GREEN" } } }), {
          status: 200,
        }),
    );

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS);
    const result = await service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" });

    expect(result[0]?.status).toBe("GREEN");
    expect(result[0]?.expiresAt).not.toBeNull();
  });

  it("only offers GREEN/YELLOW/RED as AI-selectable criteria, not UNKNOWN", async () => {
    const fetchSpy = stubFetch(
      () =>
        new Response(JSON.stringify({ model: "jev-latest", answers: { "PL-14": { type: "choice", choice: "GREEN" } } }), {
          status: 200,
        }),
    );

    const service = new TypeSafeAiClassificationService("test-key", NO_NEWS);
    await service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" });

    const typeSafeAiCall = fetchSpy.mock.calls.find((call) => call[0] === "https://api.typesafe.ai/v1/systemone");
    const body = JSON.parse((typeSafeAiCall?.[1] as RequestInit).body as string);
    const criteria = body.questions["PL-14"].criteria;
    expect(Object.keys(criteria).sort()).toEqual(["GREEN", "RED", "YELLOW"]);
  });
});
