import { describe, expect, it } from "vitest";
import { isRelevantHeadline } from "../../src/domain/news-relevance";

describe("isRelevantHeadline", () => {
  it("keeps Polish headlines about the Russia-Ukraine war touching Poland", () => {
    expect(isRelevantHeadline('"Polska przestanie istnieć". Sikorski odpowiada na groźbę Rosji')).toBe(true);
    expect(isRelevantHeadline("Dron spadł przy granicy z Białorusią. RCB wydało ostrzeżenie")).toBe(true);
    expect(isRelevantHeadline("Rosyjskie rakiety nad Ukrainą, myśliwce NATO w powietrzu nad Polską")).toBe(true);
    expect(isRelevantHeadline("Kaliningrad: wojska rosyjskie ćwiczą przy granicy")).toBe(true);
  });

  it("keeps English headlines about Poland's security situation", () => {
    expect(isRelevantHeadline("Poland scrambles fighter jets after Russian strikes on western Ukraine")).toBe(true);
    expect(isRelevantHeadline("NATO reinforces eastern flank as drones cross into Polish airspace")).toBe(true);
    expect(isRelevantHeadline("Belarus border: Poland reports new provocation")).toBe(true);
  });

  it("drops headlines with an actor but no security context", () => {
    expect(isRelevantHeadline("Poland beats Ukraine 2-1 in friendly match")).toBe(false);
    expect(isRelevantHeadline("Warsaw marathon draws record crowd")).toBe(false);
    expect(isRelevantHeadline("Rosja: nowy film o Tołstoju bije rekordy")).toBe(false);
  });

  it("drops headlines with security context but no relevant actor", () => {
    expect(isRelevantHeadline("Drone show lights up the sky over Dubai")).toBe(false);
    expect(isRelevantHeadline("Bezpieczeństwo na drogach: nowe przepisy od stycznia")).toBe(false);
  });

  it("does not let 'war' fire on Warsaw or warning alone", () => {
    expect(isRelevantHeadline("Warsaw opens new tram line")).toBe(false);
  });

  it("drops hashtag-cloud social posts", () => {
    expect(isRelevantHeadline("#wojna #polska #rosja #ukraina (@panDario)")).toBe(false);
    expect(isRelevantHeadline("Wojna w Ukrainie: Polska wzmacnia granicę #bezpieczeństwo")).toBe(true);
  });
});
