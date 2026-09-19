import { describe, expect, it } from "vitest";
import { looksEnglish } from "../../src/domain/headline-language";

describe("looksEnglish", () => {
  it("accepts ordinary English headlines", () => {
    expect(looksEnglish("Poland scrambles jets after Russian strike on western Ukraine")).toBe(true);
    expect(looksEnglish("NATO to boost air defences on eastern flank")).toBe(true);
  });

  it("rejects headlines with Polish diacritics", () => {
    expect(looksEnglish("Rosja atakuje Ukrainę, Polska podnosi myśliwce")).toBe(false);
  });

  it("rejects Polish headlines even without diacritics, by function words", () => {
    expect(looksEnglish("Drony nad Podlasiem. Wojsko nie potwierdza")).toBe(false);
    expect(looksEnglish("Premier: Polska jest bezpieczna")).toBe(false);
  });

  it("rejects Cyrillic headlines", () => {
    expect(looksEnglish("Россия нанесла удар по Львову")).toBe(false);
  });
});
