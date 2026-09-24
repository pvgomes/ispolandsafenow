import { describe, expect, it } from "vitest";
import { buildNationalFaq, buildRegionFaq, faqPageJsonLd } from "../../src/domain/faq";
import type { NationalSummary } from "../../src/domain/national-summary";

function summary(overrides: Partial<NationalSummary> = {}): NationalSummary {
  return {
    headlineLevel: "GREEN",
    counts: { GREEN: 16, YELLOW: 0, RED: 0, UNKNOWN: 0 },
    totalRegions: 16,
    ...overrides,
  };
}

const UPDATED = "2026-09-24T08:00:00.000Z";

describe("buildNationalFaq", () => {
  it("leads with the question people actually search for", () => {
    const first = buildNationalFaq(summary(), UPDATED)[0]!;
    expect(first.question).toBe("Is Poland safe to visit right now?");
    expect(first.answer).toContain("2026-09-24 08:00 UTC");
  });

  it("covers the Russia and war-in-Ukraine phrasing", () => {
    const questions = buildNationalFaq(summary(), UPDATED).map((entry) => entry.question);
    expect(questions).toContain("Is it safe to travel to Poland because of Russia and the war in Ukraine?");
    expect(questions).toContain("Is Poland at war with Russia?");
    expect(questions).toContain("Is it safe to fly to Poland right now?");
  });

  it("reports the real counts when regions are elevated", () => {
    const answer = buildNationalFaq(
      summary({ headlineLevel: "YELLOW", counts: { GREEN: 13, YELLOW: 3, RED: 0, UNKNOWN: 0 } }),
      UPDATED,
    )[0]!.answer;
    expect(answer).toContain("3 of Poland's 16 voivodeships");
  });

  it("never claims Poland is clear when there is no data", () => {
    const answer = buildNationalFaq(
      summary({ headlineLevel: "UNKNOWN", counts: { GREEN: 0, YELLOW: 0, RED: 0, UNKNOWN: 0 }, totalRegions: 0 }),
      UPDATED,
    )[0]!.answer;
    expect(answer).toContain("not enough verified information");
  });

  it("degrades gracefully when the timestamp is unusable", () => {
    expect(buildNationalFaq(summary(), "not-a-date")[0]!.answer).toContain("the most recent update");
  });
});

describe("buildRegionFaq", () => {
  const region = {
    namePl: "Mazowieckie",
    englishName: "Masovia",
    currentStatus: "GREEN" as const,
    statusReason: "No recent reporting names this region.",
    capitalName: "Warsaw",
    cityNames: ["Warsaw", "Radom"],
  };

  it("asks the travel question for the region and its cities", () => {
    const questions = buildRegionFaq(region).map((entry) => entry.question);
    expect(questions[0]).toBe("Is Mazowieckie safe to visit right now?");
    expect(questions).toContain(
      "Is it safe to travel to Mazowieckie (Masovia) because of Russia and the war in Ukraine?",
    );
    expect(questions).toContain("Is it safe to travel to Warsaw, Radom right now?");
  });

  it("uses the recorded status reason in the answer", () => {
    expect(buildRegionFaq(region)[0]!.answer).toContain("No recent reporting names this region.");
  });

  it("falls back to the level description when no reason was recorded", () => {
    const answer = buildRegionFaq({ ...region, statusReason: null })[0]!.answer;
    expect(answer).toContain("No elevated regional signal found.");
  });

  it("drops the bracketed English name when the region has none", () => {
    const questions = buildRegionFaq({ ...region, englishName: undefined }).map((entry) => entry.question);
    expect(questions).toContain("Is it safe to travel to Mazowieckie because of Russia and the war in Ukraine?");
  });

  it("omits the city question when the region has no listed cities", () => {
    const questions = buildRegionFaq({ ...region, cityNames: [] }).map((entry) => entry.question);
    expect(questions.some((q) => q.startsWith("Is it safe to travel to  "))).toBe(false);
    expect(questions).toHaveLength(3);
  });
});

describe("faqPageJsonLd", () => {
  it("emits a schema.org FAQPage graph", () => {
    const jsonLd = faqPageJsonLd([{ question: "Q?", answer: "A." }]) as Record<string, any>;
    expect(jsonLd["@type"]).toBe("FAQPage");
    expect(jsonLd.mainEntity).toEqual([
      { "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } },
    ]);
  });
});
