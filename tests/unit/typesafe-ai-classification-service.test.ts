import { afterEach, describe, expect, it, vi } from "vitest";
import { TypeSafeAiClassificationService } from "../../src/domain/typesafe-ai-classification-service";
import type { RegionIdentity } from "../../src/domain/region";

const REGION_A: RegionIdentity = { code: "PL-14", slug: "mazowieckie", namePl: "Mazowieckie", nameEn: "Mazowieckie" };
const REGION_B: RegionIdentity = { code: "PL-20", slug: "podlaskie", namePl: "Podlaskie", nameEn: "Podlaskie" };

describe("TypeSafeAiClassificationService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves every region to UNKNOWN and makes no network call when no API key is configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const service = new TypeSafeAiClassificationService(undefined);
    const result = await service.classifyRegions({ regions: [REGION_A, REGION_B], asOf: "2026-09-18T00:00:00.000Z" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status === "UNKNOWN")).toBe(true);
  });

  it("parses a successful TypeSafe AI response into region classifications", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
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
    vi.stubGlobal("fetch", fetchSpy);

    const service = new TypeSafeAiClassificationService("test-key");
    const result = await service.classifyRegions({ regions: [REGION_A, REGION_B], asOf: "2026-09-18T00:00:00.000Z" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error("expected fetch to have been called");
    const [url, init] = call;
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.headers.Authorization).toBe("Bearer test-key");

    const byCode = new Map(result.map((r) => [r.regionCode, r]));
    expect(byCode.get("PL-14")?.status).toBe("YELLOW");
    expect(byCode.get("PL-14")?.confidence).toBe(0.81);
    expect(byCode.get("PL-20")?.status).toBe("RED");
  });

  it("resolves to UNKNOWN when the API responds with a non-2xx status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("error", { status: 401 })));

    const service = new TypeSafeAiClassificationService("test-key");
    const result = await service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" });

    expect(result[0]?.status).toBe("UNKNOWN");
  });

  it("resolves to UNKNOWN when a region's answer is missing from the response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ model: "jev-latest", answers: {} }), { status: 200 })),
    );

    const service = new TypeSafeAiClassificationService("test-key");
    const result = await service.classifyRegions({ regions: [REGION_A], asOf: "2026-09-18T00:00:00.000Z" });

    expect(result[0]?.status).toBe("UNKNOWN");
  });
});
