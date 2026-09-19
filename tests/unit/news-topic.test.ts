import { describe, expect, it } from "vitest";
import { isRussiaUkraineRelated } from "../../src/domain/news-topic";

describe("isRussiaUkraineRelated", () => {
  it("matches English war/Russia/Ukraine headlines", () => {
    expect(isRussiaUkraineRelated("Russia launches new strikes in Ukraine")).toBe(true);
    expect(isRussiaUkraineRelated("Kremlin responds to NATO statement")).toBe(true);
    expect(isRussiaUkraineRelated("Putin comments on border security")).toBe(true);
    expect(isRussiaUkraineRelated("Zelenskyy visits frontline troops")).toBe(true);
  });

  it("matches Polish war/Russia/Ukraine headlines", () => {
    expect(isRussiaUkraineRelated("Sytuacja na granicy z Rosją napięta")).toBe(true);
    expect(isRussiaUkraineRelated("Ukraina otrzyma nową pomoc wojskową")).toBe(true);
    expect(isRussiaUkraineRelated("Wojna w regionie trwa nadal")).toBe(true);
  });

  it("matches broader Russia-connected threat/sanctions headlines without the word war", () => {
    expect(isRussiaUkraineRelated("EU imposes new sanctions on Moscow")).toBe(true);
    expect(isRussiaUkraineRelated("UE nakłada nowe sankcje na Rosję")).toBe(true);
    expect(isRussiaUkraineRelated("Analysts warn of growing Russian aggression")).toBe(true);
    expect(isRussiaUkraineRelated("Rosja stanowi zagrożenie dla regionu, ostrzega ekspert")).toBe(true);
  });

  it("does not match unrelated headlines", () => {
    expect(isRussiaUkraineRelated("RCB wydało ostrzeżenie pogodowe dla Mazowsza")).toBe(false);
    expect(isRussiaUkraineRelated("Lotnisko w Warszawie wprowadza nowe zasady")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isRussiaUkraineRelated("RUSSIA-UKRAINE TALKS RESUME")).toBe(true);
  });
});
