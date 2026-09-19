import { describe, expect, it } from "vitest";
import { translateHeadlines } from "../../src/domain/headline-translator";

const CONFIG = { accountId: "acct", apiToken: "token" };

function fakeFetch(handler: (body: { messages: Array<{ role: string; content: string }> }) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return handler(JSON.parse(String(init?.body)));
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function aiResponse(translations: unknown, status = 200) {
  return new Response(JSON.stringify({ success: status === 200, result: { response: { translations } }, errors: [] }), { status });
}

describe("translateHeadlines", () => {
  it("passes English titles through without calling Workers AI", async () => {
    const { fetchImpl, calls } = fakeFetch(() => aiResponse([]));
    const out = await translateHeadlines(["Poland closes airspace near border"], CONFIG, { fetch: fetchImpl });
    expect(out).toEqual(["Poland closes airspace near border"]);
    expect(calls).toHaveLength(0);
  });

  it("translates non-English titles and keeps positions aligned", async () => {
    const { fetchImpl, calls } = fakeFetch((body) => {
      const inputs = JSON.parse(body.messages[1]!.content) as string[];
      return aiResponse(inputs.map((t) => `EN(${t})`));
    });
    const out = await translateHeadlines(["Drony nad Podlasiem", "NATO jets scrambled", "Rosja atakuje Lwów"], CONFIG, {
      fetch: fetchImpl,
    });
    expect(out).toEqual(["EN(Drony nad Podlasiem)", "NATO jets scrambled", "EN(Rosja atakuje Lwów)"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain("/accounts/acct/ai/run/@cf/meta/llama-3.1-8b-instruct-fast");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer token");
  });

  it("splits large inputs into batches of 20", async () => {
    const { fetchImpl, calls } = fakeFetch((body) => {
      const inputs = JSON.parse(body.messages[1]!.content) as string[];
      return aiResponse(inputs.map((t) => t.toUpperCase()));
    });
    const titles = Array.from({ length: 45 }, (_, i) => `Wiadomość ${i}`);
    const out = await translateHeadlines(titles, CONFIG, { fetch: fetchImpl });
    expect(calls).toHaveLength(3);
    expect(out.every((t) => t?.startsWith("WIADOMOŚĆ"))).toBe(true);
  });

  it("throws a permission hint on 401/403", async () => {
    const { fetchImpl } = fakeFetch(() => new Response("{}", { status: 403 }));
    await expect(translateHeadlines(["Drony nad Podlasiem"], CONFIG, { fetch: fetchImpl })).rejects.toThrow(/Workers AI: Read/);
  });

  it("leaves the batch null on other HTTP errors or misaligned output", async () => {
    const logs: string[] = [];
    const { fetchImpl: failing } = fakeFetch(() => new Response("oops", { status: 500 }));
    expect(await translateHeadlines(["Drony nad Podlasiem"], CONFIG, { fetch: failing, log: (m) => logs.push(m) })).toEqual([null]);

    const { fetchImpl: misaligned } = fakeFetch(() => aiResponse(["one", "two"]));
    expect(await translateHeadlines(["Drony nad Podlasiem"], CONFIG, { fetch: misaligned, log: (m) => logs.push(m) })).toEqual([null]);
    expect(logs).toHaveLength(2);
  });

  it("halves a misaligned batch and retries until the output lines up", async () => {
    const { fetchImpl, calls } = fakeFetch((body) => {
      const inputs = JSON.parse(body.messages[1]!.content) as string[];
      // Simulate the model dropping a line whenever it gets more than 2 headlines.
      if (inputs.length > 2) return aiResponse(inputs.slice(1).map((t) => `EN(${t})`));
      return aiResponse(inputs.map((t) => `EN(${t})`));
    });
    const titles = ["Wiadomość 1", "Wiadomość 2", "Wiadomość 3", "Wiadomość 4", "Wiadomość 5"];
    const out = await translateHeadlines(titles, CONFIG, { fetch: fetchImpl });
    expect(out).toEqual(titles.map((t) => `EN(${t})`));
    expect(calls.length).toBeGreaterThan(1);
  });

  it("accepts the model response as a JSON string too", async () => {
    const { fetchImpl } = fakeFetch(
      () => new Response(JSON.stringify({ success: true, result: { response: JSON.stringify({ translations: ["Drones over Podlasie"] }) } })),
    );
    expect(await translateHeadlines(["Drony nad Podlasiem"], CONFIG, { fetch: fetchImpl })).toEqual(["Drones over Podlasie"]);
  });
});
