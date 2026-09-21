import { describe, expect, it } from "vitest";
import { newsForRegion } from "../../src/domain/region-news-match";
import { REGIONS } from "../../src/data/regions";
import type { NewsItem } from "../../src/domain/news-item";

const regionBySlug = (slug: string) => {
  const region = REGIONS.find((r) => r.slug === slug);
  if (!region) throw new Error(`unknown slug ${slug}`);
  return region;
};

function item(title: string, titleEn: string | null = null): NewsItem {
  return { title, titleEn, url: `https://example.pl/${encodeURIComponent(title)}`, sourceName: "Example", publishedAt: "2026-01-01T00:00:00.000Z" };
}

describe("newsForRegion", () => {
  it("matches the official voivodeship name in any inflected form", () => {
    const news = [item("Incydent w województwie mazowieckim"), item("Spokój na Podlasiu")];
    expect(newsForRegion(news, regionBySlug("mazowieckie")).map((n) => n.title)).toEqual(["Incydent w województwie mazowieckim"]);
  });

  it("matches colloquial region names used by headlines", () => {
    const news = [item("Dron nad Mazurami"), item("Alarm na Śląsku")];
    expect(newsForRegion(news, regionBySlug("warminsko-mazurskie"))).toHaveLength(1);
    expect(newsForRegion(news, regionBySlug("slaskie"))).toHaveLength(1);
  });

  it("matches a major city to its own region", () => {
    const news = [item("Alarm w Warszawie")];
    expect(newsForRegion(news, regionBySlug("mazowieckie"))).toHaveLength(1);
    expect(newsForRegion(news, regionBySlug("pomorskie"))).toHaveLength(0);
  });

  it("does not let the three '-pomorskie' regions match each other", () => {
    const news = [item("Incydent w Zachodniopomorskiem"), item("Ćwiczenia w Kujawsko-Pomorskiem"), item("Alarm na Pomorzu")];
    expect(newsForRegion(news, regionBySlug("zachodniopomorskie")).map((n) => n.title)).toEqual(["Incydent w Zachodniopomorskiem"]);
    expect(newsForRegion(news, regionBySlug("kujawsko-pomorskie")).map((n) => n.title)).toEqual(["Ćwiczenia w Kujawsko-Pomorskiem"]);
    expect(newsForRegion(news, regionBySlug("pomorskie")).map((n) => n.title)).toEqual(["Alarm na Pomorzu"]);
  });

  it("matches the English translation of a headline too", () => {
    const news = [item("Zdarzenie", "Drone spotted over Masovia")];
    expect(newsForRegion(news, regionBySlug("mazowieckie"))).toHaveLength(1);
  });

  it("returns nothing for Poland-wide reporting that names no region", () => {
    const news = [item("Polska podnosi gotowość wojsk")];
    for (const region of REGIONS) {
      expect(newsForRegion(news, region)).toHaveLength(0);
    }
  });
});
