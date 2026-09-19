import { describe, expect, it } from "vitest";
import { isRussiaWarRelated } from "../../src/domain/news-topic";

describe("isRussiaWarRelated", () => {
  it("matches English war/Russia/Ukraine headlines", () => {
    expect(isRussiaWarRelated("Russia launches new strikes in Ukraine")).toBe(true);
    expect(isRussiaWarRelated("Kremlin responds to NATO statement")).toBe(true);
    expect(isRussiaWarRelated("Putin comments on border security")).toBe(true);
    expect(isRussiaWarRelated("Zelenskyy visits frontline troops")).toBe(true);
  });

  it("matches Polish war/Russia/Ukraine headlines", () => {
    expect(isRussiaWarRelated("Sytuacja na granicy z Rosją napięta")).toBe(true);
    expect(isRussiaWarRelated("Ukraina otrzyma nową pomoc wojskową")).toBe(true);
    expect(isRussiaWarRelated("Wojna w regionie trwa nadal")).toBe(true);
  });

  it("does not match unrelated headlines", () => {
    expect(isRussiaWarRelated("RCB wydało ostrzeżenie pogodowe dla Mazowsza")).toBe(false);
    expect(isRussiaWarRelated("Lotnisko w Warszawie wprowadza nowe zasady")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isRussiaWarRelated("RUSSIA-UKRAINE TALKS RESUME")).toBe(true);
  });
});
